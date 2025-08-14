const express = require('express');
const { body, validationResult } = require('express-validator');
const Hospital = require('../models/Hospital');
const { authorize, requireVerifiedHospital } = require('../middleware/auth');

const router = express.Router();

// Get current inventory
router.get('/', requireVerifiedHospital, async (req, res) => {
  try {
    const hospital = req.hospital;
    
    const inventory = Object.keys(hospital.inventory.bloodUnits).map(bloodType => ({
      bloodType,
      available: hospital.inventory.bloodUnits[bloodType].available,
      reserved: hospital.inventory.bloodUnits[bloodType].reserved,
      critical: hospital.inventory.bloodUnits[bloodType].critical,
      isCritical: hospital.isCriticalShortage(bloodType),
      lastUpdated: hospital.inventory.bloodUnits[bloodType].lastUpdated,
      deficit: hospital.isCriticalShortage(bloodType) ? 
        hospital.inventory.bloodUnits[bloodType].critical - hospital.inventory.bloodUnits[bloodType].available : 0
    }));

    // Get critical shortages
    const criticalShortages = hospital.getCriticalShortages();

    // Calculate total inventory metrics
    const totalUnits = inventory.reduce((sum, item) => sum + item.available, 0);
    const totalCritical = criticalShortages.length;
    const totalDeficit = inventory.reduce((sum, item) => sum + item.deficit, 0);

    res.json({
      inventory,
      summary: {
        totalUnits,
        totalCritical,
        totalDeficit,
        criticalShortages
      },
      components: hospital.inventory.components,
      lastUpdated: Math.max(...inventory.map(item => new Date(item.lastUpdated).getTime()))
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update blood inventory for specific blood type
router.put('/:bloodType', requireVerifiedHospital, [
  body('available').optional().isNumeric().isInt({ min: 0 }),
  body('reserved').optional().isNumeric().isInt({ min: 0 }),
  body('critical').optional().isNumeric().isInt({ min: 0 }),
  body('change').optional().isNumeric().isInt(),
  body('reason').optional().trim()
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

    const oldInventory = { ...hospital.inventory.bloodUnits[bloodType].toObject() };

    // Handle direct updates or changes
    if (req.body.change !== undefined) {
      // Apply change (positive for addition, negative for subtraction)
      hospital.updateInventory(bloodType, req.body.change, 'available');
    } else {
      // Direct updates
      if (req.body.available !== undefined) {
        hospital.inventory.bloodUnits[bloodType].available = req.body.available;
      }
      if (req.body.reserved !== undefined) {
        hospital.inventory.bloodUnits[bloodType].reserved = req.body.reserved;
      }
      if (req.body.critical !== undefined) {
        hospital.inventory.bloodUnits[bloodType].critical = req.body.critical;
      }
    }

    hospital.inventory.bloodUnits[bloodType].lastUpdated = new Date();
    await hospital.save();

    const newInventory = hospital.inventory.bloodUnits[bloodType];
    const wasCritical = oldInventory.available <= oldInventory.critical;
    const isCritical = hospital.isCriticalShortage(bloodType);

    // Log inventory change
    console.log(`Inventory updated for ${hospital.basicInfo.name}: ${bloodType} from ${oldInventory.available} to ${newInventory.available} units`);

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`hospital-${hospital._id}`).emit('inventory-updated', {
      bloodType,
      oldValue: oldInventory.available,
      newValue: newInventory.available,
      isCritical,
      change: req.body.change,
      reason: req.body.reason
    });

    // Check for critical shortage transitions
    if (!wasCritical && isCritical) {
      io.to(`hospital-${hospital._id}`).emit('critical-shortage-alert', {
        bloodType,
        available: newInventory.available,
        critical: newInventory.critical,
        deficit: newInventory.critical - newInventory.available
      });
    } else if (wasCritical && !isCritical) {
      io.to(`hospital-${hospital._id}`).emit('shortage-resolved', {
        bloodType,
        available: newInventory.available,
        critical: newInventory.critical
      });
    }

    res.json({
      message: 'Inventory updated successfully',
      bloodType,
      oldInventory: oldInventory,
      newInventory: newInventory.toObject(),
      isCritical,
      change: req.body.change || 'Direct update'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Bulk update inventory
router.put('/', requireVerifiedHospital, [
  body('updates').isArray({ min: 1 }),
  body('updates.*.bloodType').isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  body('updates.*.available').optional().isNumeric().isInt({ min: 0 }),
  body('updates.*.reserved').optional().isNumeric().isInt({ min: 0 }),
  body('updates.*.critical').optional().isNumeric().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const hospital = req.hospital;
    const updates = req.body.updates;
    const results = [];

    for (const update of updates) {
      const { bloodType } = update;
      const oldInventory = { ...hospital.inventory.bloodUnits[bloodType].toObject() };

      // Apply updates
      if (update.available !== undefined) {
        hospital.inventory.bloodUnits[bloodType].available = update.available;
      }
      if (update.reserved !== undefined) {
        hospital.inventory.bloodUnits[bloodType].reserved = update.reserved;
      }
      if (update.critical !== undefined) {
        hospital.inventory.bloodUnits[bloodType].critical = update.critical;
      }

      hospital.inventory.bloodUnits[bloodType].lastUpdated = new Date();

      results.push({
        bloodType,
        oldValue: oldInventory.available,
        newValue: hospital.inventory.bloodUnits[bloodType].available,
        isCritical: hospital.isCriticalShortage(bloodType)
      });
    }

    await hospital.save();

    // Emit real-time update for bulk changes
    const io = req.app.get('io');
    io.to(`hospital-${hospital._id}`).emit('bulk-inventory-updated', {
      updates: results,
      timestamp: new Date()
    });

    res.json({
      message: 'Bulk inventory update completed',
      results
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get inventory history (simplified - in production you'd want separate collection)
router.get('/history/:bloodType', requireVerifiedHospital, async (req, res) => {
  try {
    const { bloodType } = req.params;
    const { days = 30 } = req.query;

    // This is a simplified implementation
    // In production, you'd want a separate InventoryHistory collection
    const hospital = req.hospital;

    if (!hospital.inventory.bloodUnits[bloodType]) {
      return res.status(400).json({ message: 'Invalid blood type' });
    }

    // For now, return current state as history point
    // In production, implement proper history tracking
    const currentInventory = hospital.inventory.bloodUnits[bloodType];
    
    res.json({
      bloodType,
      history: [{
        date: currentInventory.lastUpdated,
        available: currentInventory.available,
        reserved: currentInventory.reserved,
        change: 0,
        reason: 'Current state'
      }],
      message: 'Inventory history feature requires implementation of history tracking'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update component inventory
router.put('/components', requireVerifiedHospital, [
  body('redCells').optional().isNumeric().isInt({ min: 0 }),
  body('plasma').optional().isNumeric().isInt({ min: 0 }),
  body('platelets').optional().isNumeric().isInt({ min: 0 }),
  body('cryoprecipitate').optional().isNumeric().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const hospital = req.hospital;
    const oldComponents = { ...hospital.inventory.components.toObject() };

    // Update components
    if (req.body.redCells !== undefined) {
      hospital.inventory.components.redCells = req.body.redCells;
    }
    if (req.body.plasma !== undefined) {
      hospital.inventory.components.plasma = req.body.plasma;
    }
    if (req.body.platelets !== undefined) {
      hospital.inventory.components.platelets = req.body.platelets;
    }
    if (req.body.cryoprecipitate !== undefined) {
      hospital.inventory.components.cryoprecipitate = req.body.cryoprecipitate;
    }

    await hospital.save();

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`hospital-${hospital._id}`).emit('components-updated', {
      oldComponents,
      newComponents: hospital.inventory.components,
      timestamp: new Date()
    });

    res.json({
      message: 'Component inventory updated successfully',
      oldComponents,
      newComponents: hospital.inventory.components
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get critical shortages across all hospitals (admin/analytics)
router.get('/critical/global', authorize('admin', 'hospital', 'blood_bank'), async (req, res) => {
  try {
    const { bloodType, radius, latitude, longitude } = req.query;

    let query = {
      verificationStatus: 'verified',
      isActive: true,
      'bloodBank.hasBloodBank': true
    };

    // Location-based filtering
    if (latitude && longitude && radius) {
      query['location.coordinates'] = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseFloat(radius) * 1000 // Convert km to meters
        }
      };
    }

    const hospitals = await Hospital.find(query)
      .select('basicInfo.name location.address inventory.bloodUnits contactInfo.emergencyPhone');

    const criticalShortages = [];

    hospitals.forEach(hospital => {
      const shortages = hospital.getCriticalShortages();
      
      // Filter by blood type if specified
      const filteredShortages = bloodType ? 
        shortages.filter(s => s.bloodType === bloodType) : 
        shortages;

      if (filteredShortages.length > 0) {
        criticalShortages.push({
          hospital: {
            id: hospital._id,
            name: hospital.basicInfo.name,
            address: hospital.location.address,
            phone: hospital.contactInfo.emergencyPhone
          },
          shortages: filteredShortages
        });
      }
    });

    // Calculate summary statistics
    const summary = {
      hospitalsWithShortages: criticalShortages.length,
      totalHospitals: hospitals.length,
      bloodTypeBreakdown: {}
    };

    // Count shortages by blood type
    ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].forEach(type => {
      summary.bloodTypeBreakdown[type] = criticalShortages.reduce((count, hospital) => 
        count + hospital.shortages.filter(s => s.bloodType === type).length, 0
      );
    });

    res.json({
      criticalShortages,
      summary,
      filters: { bloodType, radius, location: { latitude, longitude } }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
