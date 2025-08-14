const express = require('express');
const { body, validationResult } = require('express-validator');
const Donor = require('../models/Donor');
const Alert = require('../models/Alert');
const { authorize, requireVerifiedDonor } = require('../middleware/auth');

const router = express.Router();

// Create donor profile
router.post('/profile', authorize('donor'), [
  body('personalInfo.firstName').trim().isLength({ min: 2 }),
  body('personalInfo.lastName').trim().isLength({ min: 2 }),
  body('personalInfo.dateOfBirth').isISO8601(),
  body('personalInfo.gender').isIn(['male', 'female', 'other']),
  body('personalInfo.phone').matches(/^\+?[\d\s-()]+$/),
  body('medicalInfo.bloodGroup').isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  body('medicalInfo.weight').isNumeric().isFloat({ min: 45 }),
  body('medicalInfo.height').isNumeric().isFloat({ min: 100 }),
  body('location.address.city').trim().isLength({ min: 2 }),
  body('location.coordinates.coordinates').isArray({ min: 2, max: 2 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if donor profile already exists
    const existingDonor = await Donor.findOne({ user: req.user._id });
    if (existingDonor) {
      return res.status(400).json({ message: 'Donor profile already exists' });
    }

    const donorData = {
      user: req.user._id,
      ...req.body
    };

    const donor = new Donor(donorData);
    await donor.save();

    await donor.populate('user', '-password');

    res.status(201).json({
      message: 'Donor profile created successfully',
      donor
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get donor profile
router.get('/profile', authorize('donor'), async (req, res) => {
  try {
    const donor = await Donor.findOne({ user: req.user._id })
      .populate('user', '-password')
      .populate('donationHistory.bloodBank', 'basicInfo.name location.address');

    if (!donor) {
      return res.status(404).json({ message: 'Donor profile not found' });
    }

    res.json({ donor });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update donor profile
router.put('/profile', authorize('donor'), async (req, res) => {
  try {
    const donor = await Donor.findOne({ user: req.user._id });
    if (!donor) {
      return res.status(404).json({ message: 'Donor profile not found' });
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        if (typeof req.body[key] === 'object' && !Array.isArray(req.body[key])) {
          donor[key] = { ...donor[key].toObject(), ...req.body[key] };
        } else {
          donor[key] = req.body[key];
        }
      }
    });

    await donor.save();
    await donor.populate('user', '-password');

    res.json({
      message: 'Donor profile updated successfully',
      donor
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get donor eligibility status
router.get('/eligibility', authorize('donor'), async (req, res) => {
  try {
    const donor = await Donor.findOne({ user: req.user._id });
    if (!donor) {
      return res.status(404).json({ message: 'Donor profile not found' });
    }

    const eligibility = donor.checkEligibility();
    
    res.json({
      eligibility,
      nextEligibleDate: donor.eligibility.nextEligibleDate,
      lastDonationDate: donor.eligibility.lastDonationDate,
      restrictions: donor.eligibility.restrictions
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get available alerts for donor
router.get('/alerts', authorize('donor'), async (req, res) => {
  try {
    const donor = await Donor.findOne({ user: req.user._id });
    if (!donor) {
      return res.status(404).json({ message: 'Donor profile not found' });
    }

    // Check donor eligibility
    const eligibility = donor.checkEligibility();
    if (!eligibility.eligible) {
      return res.json({ 
        alerts: [], 
        message: `You are currently not eligible: ${eligibility.reason}` 
      });
    }

    // Find compatible blood type alerts within donor's travel distance
    const compatibleBloodTypes = this.getCompatibleBloodTypes(donor.medicalInfo.bloodGroup);
    
    const alerts = await Alert.find({
      bloodType: { $in: compatibleBloodTypes },
      status: 'active',
      expiresAt: { $gt: new Date() },
      'location.coordinates': {
        $near: {
          $geometry: donor.location.coordinates,
          $maxDistance: (donor.preferences.maxTravelDistance || 50) * 1000 // Convert km to meters
        }
      }
    })
    .populate('hospital', 'basicInfo.name location.address contactInfo.emergencyPhone')
    .sort({ urgencyLevel: -1, createdAt: -1 })
    .limit(20);

    // Filter out alerts already responded to
    const respondedAlertIds = alerts
      .filter(alert => alert.responses.some(r => r.donor.toString() === donor._id.toString()))
      .map(alert => alert._id);

    const availableAlerts = alerts.filter(alert => 
      !respondedAlertIds.includes(alert._id)
    );

    res.json({ alerts: availableAlerts });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Respond to alert
router.post('/alerts/:alertId/respond', authorize('donor'), [
  body('responseType').isIn(['interested', 'committed', 'not_available', 'not_eligible']),
  body('message').optional().trim(),
  body('estimatedArrival').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const donor = await Donor.findOne({ user: req.user._id });
    if (!donor) {
      return res.status(404).json({ message: 'Donor profile not found' });
    }

    const alert = await Alert.findById(req.params.alertId);
    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    if (alert.status !== 'active') {
      return res.status(400).json({ message: 'Alert is no longer active' });
    }

    // Check if donor already responded
    const existingResponse = alert.responses.find(r => 
      r.donor.toString() === donor._id.toString()
    );
    if (existingResponse) {
      return res.status(400).json({ message: 'You have already responded to this alert' });
    }

    // Add response to alert
    const responseData = {
      donor: donor._id,
      responseType: req.body.responseType,
      message: req.body.message,
      estimatedArrival: req.body.estimatedArrival,
      contactInfo: {
        phone: donor.personalInfo.phone,
        email: req.user.email
      }
    };

    alert.addResponse(donor._id, req.body.responseType, responseData);
    await alert.save();

    // Emit real-time update to hospital
    const io = req.app.get('io');
    io.to(`hospital-${alert.hospital}`).emit('alert-response', {
      alertId: alert._id,
      response: responseData,
      donorName: `${donor.personalInfo.firstName} ${donor.personalInfo.lastName}`,
      donorBloodType: donor.medicalInfo.bloodGroup
    });

    res.json({
      message: 'Response recorded successfully',
      alert: alert.toObject()
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get donation history
router.get('/donations', authorize('donor'), async (req, res) => {
  try {
    const donor = await Donor.findOne({ user: req.user._id })
      .populate('donationHistory.bloodBank', 'basicInfo.name location.address');

    if (!donor) {
      return res.status(404).json({ message: 'Donor profile not found' });
    }

    res.json({
      donations: donor.donationHistory,
      statistics: donor.statistics
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update notification preferences
router.put('/preferences', authorize('donor'), async (req, res) => {
  try {
    const donor = await Donor.findOne({ user: req.user._id });
    if (!donor) {
      return res.status(404).json({ message: 'Donor profile not found' });
    }

    if (req.body.preferences) {
      donor.preferences = { ...donor.preferences.toObject(), ...req.body.preferences };
    }

    await donor.save();

    res.json({
      message: 'Preferences updated successfully',
      preferences: donor.preferences
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Helper function to get compatible blood types
function getCompatibleBloodTypes(donorBloodType) {
  const compatibility = {
    'A+': ['A+', 'AB+'],
    'A-': ['A+', 'A-', 'AB+', 'AB-'],
    'B+': ['B+', 'AB+'],
    'B-': ['B+', 'B-', 'AB+', 'AB-'],
    'AB+': ['AB+'],
    'AB-': ['AB+', 'AB-'],
    'O+': ['A+', 'B+', 'AB+', 'O+'],
    'O-': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
  };
  
  return compatibility[donorBloodType] || [];
}

module.exports = router;
