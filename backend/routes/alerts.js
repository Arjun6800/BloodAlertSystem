const express = require('express');
const { body, validationResult } = require('express-validator');
const Alert = require('../models/Alert');
const Donor = require('../models/Donor');
const Hospital = require('../models/Hospital');
const notificationService = require('../services/notificationService');
const { authorize, requireVerifiedHospital } = require('../middleware/auth');

const router = express.Router();

// Create new blood shortage alert
router.post('/', requireVerifiedHospital, [
  body('bloodType').isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  body('urgencyLevel').isIn(['low', 'medium', 'high', 'critical']),
  body('unitsNeeded').isNumeric().isInt({ min: 1, max: 100 }),
  body('reason').trim().isLength({ min: 10 }),
  body('patientInfo.requiredBy').isISO8601(),
  body('location.searchRadius').optional().isNumeric().isInt({ min: 5, max: 200 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const hospital = req.hospital;
    
    // Create alert
    const alertData = {
      hospital: hospital._id,
      bloodType: req.body.bloodType,
      urgencyLevel: req.body.urgencyLevel,
      unitsNeeded: req.body.unitsNeeded,
      reason: req.body.reason,
      patientInfo: req.body.patientInfo,
      location: {
        coordinates: hospital.location.coordinates,
        searchRadius: req.body.location?.searchRadius || 50
      },
      createdBy: req.user._id,
      tags: req.body.tags || []
    };

    const alert = new Alert(alertData);
    await alert.save();

    // Find eligible donors
    const eligibleDonors = await findEligibleDonors(alert);
    
    // Send notifications
    const notificationResults = await notificationService.sendBloodShortageAlert(alert, eligibleDonors);

    // Send confirmation to hospital
    await notificationService.sendHospitalAlert(hospital, alertData);

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`hospital-${hospital._id}`).emit('alert-created', {
      alert: alert.toObject(),
      notificationResults,
      eligibleDonors: eligibleDonors.length
    });

    // Update hospital statistics
    hospital.statistics.totalBloodRequests += 1;
    await hospital.save();

    res.status(201).json({
      message: 'Blood shortage alert created successfully',
      alert: alert.toObject(),
      notificationResults,
      eligibleDonors: eligibleDonors.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all alerts for hospital
router.get('/', requireVerifiedHospital, async (req, res) => {
  try {
    const { status, bloodType, page = 1, limit = 20 } = req.query;
    const hospital = req.hospital;

    // Build query
    const query = { hospital: hospital._id };
    if (status) query.status = status;
    if (bloodType) query.bloodType = bloodType;

    const alerts = await Alert.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('responses.donor', 'personalInfo.firstName personalInfo.lastName medicalInfo.bloodGroup personalInfo.phone');

    const total = await Alert.countDocuments(query);

    res.json({
      alerts,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get specific alert details
router.get('/:alertId', requireVerifiedHospital, async (req, res) => {
  try {
    const alert = await Alert.findOne({
      _id: req.params.alertId,
      hospital: req.hospital._id
    })
    .populate('hospital', 'basicInfo.name location.address')
    .populate('responses.donor', 'personalInfo.firstName personalInfo.lastName medicalInfo.bloodGroup personalInfo.phone user')
    .populate('sharing.sharedWith.hospital', 'basicInfo.name contactInfo.primaryPhone');

    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    // Calculate additional metrics
    const metrics = {
      completionPercentage: alert.completionPercentage,
      timeRemaining: alert.timeRemaining,
      responseRate: alert.getResponseRate(),
      conversionRate: alert.getConversionRate()
    };

    res.json({
      alert: alert.toObject(),
      metrics
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update alert status
router.put('/:alertId/status', requireVerifiedHospital, [
  body('status').isIn(['active', 'partially_fulfilled', 'fulfilled', 'expired', 'cancelled']),
  body('reason').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const alert = await Alert.findOne({
      _id: req.params.alertId,
      hospital: req.hospital._id
    });

    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    const oldStatus = alert.status;
    alert.status = req.body.status;
    alert.lastModifiedBy = req.user._id;

    if (req.body.reason) {
      alert.internalNotes = `${alert.internalNotes || ''}\n${new Date().toISOString()}: Status changed from ${oldStatus} to ${req.body.status}. Reason: ${req.body.reason}`;
    }

    await alert.save();

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`hospital-${req.hospital._id}`).emit('alert-status-updated', {
      alertId: alert._id,
      oldStatus,
      newStatus: alert.status,
      reason: req.body.reason
    });

    res.json({
      message: 'Alert status updated successfully',
      alert: alert.toObject()
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Extend alert expiry
router.put('/:alertId/extend', requireVerifiedHospital, [
  body('hours').isNumeric().isInt({ min: 1, max: 168 }) // Max 1 week
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const alert = await Alert.findOne({
      _id: req.params.alertId,
      hospital: req.hospital._id
    });

    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    if (alert.status !== 'active' && alert.status !== 'partially_fulfilled') {
      return res.status(400).json({ message: 'Only active alerts can be extended' });
    }

    const oldExpiry = alert.expiresAt;
    alert.extendExpiry(req.body.hours);
    await alert.save();

    res.json({
      message: `Alert extended by ${req.body.hours} hours`,
      oldExpiry,
      newExpiry: alert.expiresAt
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Share alert with partner hospitals
router.post('/:alertId/share', requireVerifiedHospital, [
  body('hospitalIds').isArray({ min: 1 }),
  body('hospitalIds.*').isMongoId(),
  body('message').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const alert = await Alert.findOne({
      _id: req.params.alertId,
      hospital: req.hospital._id
    });

    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    if (!alert.sharing.allowSharing) {
      return res.status(400).json({ message: 'Alert sharing is not allowed' });
    }

    const { hospitalIds, message } = req.body;
    const results = [];

    for (const hospitalId of hospitalIds) {
      // Check if hospital is a partner
      const isPartner = req.hospital.partnerships.some(p => 
        p.hospitalId.toString() === hospitalId && 
        p.status === 'active' &&
        ['blood_sharing', 'emergency_backup'].includes(p.type)
      );

      if (!isPartner) {
        results.push({
          hospitalId,
          success: false,
          reason: 'Hospital is not a partner'
        });
        continue;
      }

      // Check if already shared
      const alreadyShared = alert.sharing.sharedWith.some(s => 
        s.hospital.toString() === hospitalId
      );

      if (alreadyShared) {
        results.push({
          hospitalId,
          success: false,
          reason: 'Alert already shared with this hospital'
        });
        continue;
      }

      // Add to shared list
      alert.sharing.sharedWith.push({
        hospital: hospitalId,
        notes: message
      });

      // Emit real-time notification to partner hospital
      const io = req.app.get('io');
      io.to(`hospital-${hospitalId}`).emit('alert-shared', {
        alert: alert.toObject(),
        sharedBy: req.hospital.basicInfo.name,
        message
      });

      results.push({
        hospitalId,
        success: true
      });
    }

    await alert.save();

    res.json({
      message: 'Alert sharing completed',
      results
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Respond to shared alert
router.post('/:alertId/respond-share', requireVerifiedHospital, [
  body('response').isIn(['accepted', 'declined', 'partially_fulfilled']),
  body('unitsPromised').optional().isNumeric().isInt({ min: 0 }),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const alert = await Alert.findById(req.params.alertId);
    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    // Find sharing entry
    const sharingEntry = alert.sharing.sharedWith.find(s => 
      s.hospital.toString() === req.hospital._id.toString()
    );

    if (!sharingEntry) {
      return res.status(404).json({ message: 'Alert was not shared with your hospital' });
    }

    if (sharingEntry.response !== 'pending') {
      return res.status(400).json({ message: 'You have already responded to this alert' });
    }

    // Update response
    sharingEntry.response = req.body.response;
    sharingEntry.unitsPromised = req.body.unitsPromised || 0;
    sharingEntry.notes = req.body.notes;

    await alert.save();

    // Notify original hospital
    const io = req.app.get('io');
    io.to(`hospital-${alert.hospital}`).emit('share-response', {
      alertId: alert._id,
      respondingHospital: req.hospital.basicInfo.name,
      response: req.body.response,
      unitsPromised: req.body.unitsPromised
    });

    res.json({
      message: 'Response recorded successfully',
      response: {
        alert: alert._id,
        response: req.body.response,
        unitsPromised: req.body.unitsPromised
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get shared alerts (alerts shared with this hospital)
router.get('/shared/received', requireVerifiedHospital, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const alerts = await Alert.find({
      'sharing.sharedWith.hospital': req.hospital._id,
      status: { $in: ['active', 'partially_fulfilled'] }
    })
    .populate('hospital', 'basicInfo.name location.address contactInfo.emergencyPhone')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    // Filter to show only relevant sharing information
    const filteredAlerts = alerts.map(alert => {
      const sharing = alert.sharing.sharedWith.find(s => 
        s.hospital.toString() === req.hospital._id.toString()
      );
      
      return {
        ...alert.toObject(),
        sharing: sharing
      };
    });

    res.json({
      alerts: filteredAlerts,
      pagination: {
        current: page,
        total: alerts.length
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Helper function to find eligible donors
async function findEligibleDonors(alert) {
  try {
    // Blood type compatibility mapping
    const compatibleDonorTypes = {
      'A+': ['A+', 'A-', 'O+', 'O-'],
      'A-': ['A-', 'O-'],
      'B+': ['B+', 'B-', 'O+', 'O-'],
      'B-': ['B-', 'O-'],
      'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      'AB-': ['A-', 'B-', 'AB-', 'O-'],
      'O+': ['O+', 'O-'],
      'O-': ['O-']
    };

    const eligibleBloodTypes = compatibleDonorTypes[alert.bloodType] || [];

    // Find donors within search radius
    const donors = await Donor.find({
      'medicalInfo.bloodGroup': { $in: eligibleBloodTypes },
      'eligibility.isEligible': true,
      'verificationStatus': 'verified',
      'isActive': true,
      'location.coordinates': {
        $near: {
          $geometry: alert.location.coordinates,
          $maxDistance: alert.location.searchRadius * 1000 // Convert km to meters
        }
      }
    }).populate('user', 'email');

    // Filter by individual donor preferences and eligibility
    const eligibleDonors = [];
    
    for (const donor of donors) {
      // Check individual eligibility
      const eligibility = donor.checkEligibility();
      if (!eligibility.eligible) continue;

      // Check if donor's max travel distance includes this location
      // This is a simplified check - in production, you'd calculate actual distance
      if (donor.preferences.maxTravelDistance < alert.location.searchRadius) continue;

      // Check if donor hasn't already responded to this alert
      const hasResponded = await Alert.exists({
        _id: alert._id,
        'responses.donor': donor._id
      });
      if (hasResponded) continue;

      // Check emergency-only preference
      if (donor.preferences.emergencyOnly && alert.urgencyLevel !== 'critical') continue;

      eligibleDonors.push(donor);
    }

    return eligibleDonors;
  } catch (error) {
    console.error('Error finding eligible donors:', error);
    return [];
  }
}

module.exports = router;
