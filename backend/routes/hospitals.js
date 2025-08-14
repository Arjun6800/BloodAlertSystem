const express = require('express');
const { body, validationResult } = require('express-validator');
const Hospital = require('../models/Hospital');
const Alert = require('../models/Alert');
const Donor = require('../models/Donor');
const { authorize, requireVerifiedHospital } = require('../middleware/auth');

const router = express.Router();

// Create hospital profile
router.post('/profile', authorize('hospital', 'blood_bank'), [
  body('basicInfo.name').trim().isLength({ min: 2 }),
  body('basicInfo.registrationNumber').trim().isLength({ min: 3 }),
  body('basicInfo.type').isIn(['government', 'private', 'blood_bank', 'clinic']),
  body('basicInfo.category').isIn(['primary', 'secondary', 'tertiary', 'specialty']),
  body('basicInfo.bedCapacity').isNumeric().isInt({ min: 1 }),
  body('contactInfo.primaryPhone').matches(/^\+?[\d\s-()]+$/),
  body('contactInfo.emergencyPhone').matches(/^\+?[\d\s-()]+$/),
  body('contactInfo.email').isEmail(),
  body('location.address.street').trim().isLength({ min: 5 }),
  body('location.address.city').trim().isLength({ min: 2 }),
  body('location.address.state').trim().isLength({ min: 2 }),
  body('location.coordinates.coordinates').isArray({ min: 2, max: 2 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if hospital profile already exists
    const existingHospital = await Hospital.findOne({ user: req.user._id });
    if (existingHospital) {
      return res.status(400).json({ message: 'Hospital profile already exists' });
    }

    const hospitalData = {
      user: req.user._id,
      ...req.body
    };

    const hospital = new Hospital(hospitalData);
    await hospital.save();

    await hospital.populate('user', '-password');

    res.status(201).json({
      message: 'Hospital profile created successfully',
      hospital
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get hospital profile
router.get('/profile', authorize('hospital', 'blood_bank'), async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ user: req.user._id })
      .populate('user', '-password')
      .populate('partnerships.hospitalId', 'basicInfo.name location.address');

    if (!hospital) {
      return res.status(404).json({ message: 'Hospital profile not found' });
    }

    res.json({ hospital });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update hospital profile
router.put('/profile', authorize('hospital', 'blood_bank'), async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ user: req.user._id });
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital profile not found' });
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        if (typeof req.body[key] === 'object' && !Array.isArray(req.body[key])) {
          hospital[key] = { ...hospital[key].toObject(), ...req.body[key] };
        } else {
          hospital[key] = req.body[key];
        }
      }
    });

    await hospital.save();
    await hospital.populate('user', '-password');

    res.json({
      message: 'Hospital profile updated successfully',
      hospital
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get hospital dashboard data
router.get('/dashboard', requireVerifiedHospital, async (req, res) => {
  try {
    const hospital = req.hospital;

    // Get current alerts
    const activeAlerts = await Alert.find({
      hospital: hospital._id,
      status: { $in: ['active', 'partially_fulfilled'] },
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    // Get recent alerts (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentAlerts = await Alert.find({
      hospital: hospital._id,
      createdAt: { $gte: thirtyDaysAgo }
    }).sort({ createdAt: -1 });

    // Calculate statistics
    const totalAlerts = recentAlerts.length;
    const fulfilledAlerts = recentAlerts.filter(a => a.status === 'fulfilled').length;
    const fulfillmentRate = totalAlerts > 0 ? Math.round((fulfilledAlerts / totalAlerts) * 100) : 0;

    // Get critical shortages
    const criticalShortages = hospital.getCriticalShortages();

    // Get inventory status
    const inventoryStatus = Object.keys(hospital.inventory.bloodUnits).map(bloodType => ({
      bloodType,
      available: hospital.inventory.bloodUnits[bloodType].available,
      critical: hospital.inventory.bloodUnits[bloodType].critical,
      isCritical: hospital.isCriticalShortage(bloodType),
      lastUpdated: hospital.inventory.bloodUnits[bloodType].lastUpdated
    }));

    // Get response statistics for active alerts
    const responseStats = activeAlerts.map(alert => ({
      alertId: alert._id,
      bloodType: alert.bloodType,
      sent: alert.notifications.sent,
      opened: alert.notifications.opened,
      responded: alert.notifications.responded,
      responseRate: alert.getResponseRate(),
      conversionRate: alert.getConversionRate()
    }));

    res.json({
      hospital: {
        name: hospital.basicInfo.name,
        type: hospital.basicInfo.type,
        verificationStatus: hospital.verificationStatus
      },
      statistics: {
        totalAlerts,
        fulfilledAlerts,
        fulfillmentRate,
        activeAlerts: activeAlerts.length,
        criticalShortages: criticalShortages.length
      },
      activeAlerts,
      criticalShortages,
      inventoryStatus,
      responseStats
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update blood inventory
router.put('/inventory/:bloodType', requireVerifiedHospital, [
  body('available').optional().isNumeric().isInt({ min: 0 }),
  body('reserved').optional().isNumeric().isInt({ min: 0 }),
  body('critical').optional().isNumeric().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { bloodType } = req.params;
    const hospital = req.hospital;

    if (!hospital.inventory.bloodUnits[bloodType]) {
      return res.status(400).json({ message: 'Invalid blood type' });
    }

    // Update inventory
    if (req.body.available !== undefined) {
      hospital.inventory.bloodUnits[bloodType].available = req.body.available;
    }
    if (req.body.reserved !== undefined) {
      hospital.inventory.bloodUnits[bloodType].reserved = req.body.reserved;
    }
    if (req.body.critical !== undefined) {
      hospital.inventory.bloodUnits[bloodType].critical = req.body.critical;
    }

    hospital.inventory.bloodUnits[bloodType].lastUpdated = new Date();
    await hospital.save();

    // Check if this creates a critical shortage and auto-alert is enabled
    if (hospital.alerts.autoAlertEnabled && hospital.isCriticalShortage(bloodType)) {
      // Create automatic alert
      const autoAlert = new Alert({
        hospital: hospital._id,
        bloodType,
        urgencyLevel: 'critical',
        unitsNeeded: hospital.inventory.bloodUnits[bloodType].critical - 
                    hospital.inventory.bloodUnits[bloodType].available,
        reason: 'Automatic critical shortage alert',
        patientInfo: {
          condition: 'Critical blood shortage - automatic alert',
          isEmergency: true,
          requiredBy: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        },
        location: {
          coordinates: hospital.location.coordinates,
          searchRadius: 50
        },
        createdBy: req.user._id
      });

      await autoAlert.save();

      // Emit real-time update
      const io = req.app.get('io');
      io.to(`hospital-${hospital._id}`).emit('critical-shortage', {
        bloodType,
        available: hospital.inventory.bloodUnits[bloodType].available,
        critical: hospital.inventory.bloodUnits[bloodType].critical,
        alertId: autoAlert._id
      });
    }

    res.json({
      message: 'Inventory updated successfully',
      bloodType,
      inventory: hospital.inventory.bloodUnits[bloodType],
      isCritical: hospital.isCriticalShortage(bloodType)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get nearby hospitals for partnership/sharing
router.get('/nearby', requireVerifiedHospital, async (req, res) => {
  try {
    const { maxDistance = 100 } = req.query; // Default 100km
    const hospital = req.hospital;

    const nearbyHospitals = await Hospital.find({
      _id: { $ne: hospital._id },
      verificationStatus: 'verified',
      isActive: true,
      'bloodBank.hasBloodBank': true,
      'location.coordinates': {
        $near: {
          $geometry: hospital.location.coordinates,
          $maxDistance: maxDistance * 1000 // Convert km to meters
        }
      }
    })
    .select('basicInfo.name location.address contactInfo.primaryPhone inventory.bloodUnits')
    .limit(20);

    // Calculate distances and add partnership status
    const hospitalsWithDetails = nearbyHospitals.map(nearbyHospital => {
      const partnership = hospital.partnerships.find(p => 
        p.hospitalId.toString() === nearbyHospital._id.toString()
      );

      return {
        ...nearbyHospital.toObject(),
        partnership: partnership ? {
          type: partnership.type,
          status: partnership.status
        } : null
      };
    });

    res.json({ hospitals: hospitalsWithDetails });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Request partnership with another hospital
router.post('/partnerships', requireVerifiedHospital, [
  body('hospitalId').isMongoId(),
  body('type').isIn(['blood_sharing', 'emergency_backup', 'referral'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { hospitalId, type } = req.body;
    const hospital = req.hospital;

    if (hospitalId === hospital._id.toString()) {
      return res.status(400).json({ message: 'Cannot create partnership with yourself' });
    }

    // Check if target hospital exists
    const targetHospital = await Hospital.findById(hospitalId);
    if (!targetHospital) {
      return res.status(404).json({ message: 'Target hospital not found' });
    }

    // Check if partnership already exists
    const existingPartnership = hospital.partnerships.find(p => 
      p.hospitalId.toString() === hospitalId
    );
    if (existingPartnership) {
      return res.status(400).json({ message: 'Partnership already exists' });
    }

    // Add partnership to both hospitals
    const partnershipData = {
      hospitalId,
      type,
      status: 'active',
      establishedDate: new Date()
    };

    hospital.partnerships.push(partnershipData);
    targetHospital.partnerships.push({
      hospitalId: hospital._id,
      type,
      status: 'active',
      establishedDate: new Date()
    });

    await hospital.save();
    await targetHospital.save();

    res.json({
      message: 'Partnership created successfully',
      partnership: partnershipData
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get hospital analytics
router.get('/analytics', requireVerifiedHospital, async (req, res) => {
  try {
    const { period = '30' } = req.query; // Default 30 days
    const hospital = req.hospital;
    const startDate = new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000);

    // Get alerts data
    const alerts = await Alert.find({
      hospital: hospital._id,
      createdAt: { $gte: startDate }
    });

    // Calculate metrics
    const totalAlerts = alerts.length;
    const fulfilledAlerts = alerts.filter(a => a.status === 'fulfilled').length;
    const partiallyFulfilled = alerts.filter(a => a.status === 'partially_fulfilled').length;
    const expiredAlerts = alerts.filter(a => a.status === 'expired').length;

    // Blood type breakdown
    const bloodTypeStats = {};
    ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].forEach(type => {
      const typeAlerts = alerts.filter(a => a.bloodType === type);
      bloodTypeStats[type] = {
        total: typeAlerts.length,
        fulfilled: typeAlerts.filter(a => a.status === 'fulfilled').length,
        pending: typeAlerts.filter(a => a.status === 'active').length
      };
    });

    // Response analytics
    const totalNotificationsSent = alerts.reduce((sum, alert) => sum + alert.notifications.sent, 0);
    const totalResponses = alerts.reduce((sum, alert) => sum + alert.notifications.responded, 0);
    const averageResponseRate = totalNotificationsSent > 0 ? 
      Math.round((totalResponses / totalNotificationsSent) * 100) : 0;

    // Time-based analytics
    const alertsByDate = {};
    alerts.forEach(alert => {
      const date = alert.createdAt.toISOString().split('T')[0];
      if (!alertsByDate[date]) {
        alertsByDate[date] = { total: 0, fulfilled: 0 };
      }
      alertsByDate[date].total++;
      if (alert.status === 'fulfilled') {
        alertsByDate[date].fulfilled++;
      }
    });

    res.json({
      period: `${period} days`,
      summary: {
        totalAlerts,
        fulfilledAlerts,
        partiallyFulfilled,
        expiredAlerts,
        fulfillmentRate: totalAlerts > 0 ? Math.round((fulfilledAlerts / totalAlerts) * 100) : 0,
        averageResponseRate
      },
      bloodTypeStats,
      alertsByDate,
      notifications: {
        sent: totalNotificationsSent,
        responses: totalResponses,
        responseRate: averageResponseRate
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
