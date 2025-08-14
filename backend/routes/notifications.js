const express = require('express');
const { body, validationResult } = require('express-validator');
const { authorize } = require('../middleware/auth');

const router = express.Router();

// Get notification preferences
router.get('/preferences', authorize('donor', 'hospital'), async (req, res) => {
  try {
    if (req.user.role === 'donor') {
      const Donor = require('../models/Donor');
      const donor = await Donor.findOne({ user: req.user._id });
      
      if (!donor) {
        return res.status(404).json({ message: 'Donor profile not found' });
      }

      res.json({
        preferences: donor.preferences.notificationMethods,
        maxTravelDistance: donor.preferences.maxTravelDistance,
        emergencyOnly: donor.preferences.emergencyOnly
      });
    } else {
      const Hospital = require('../models/Hospital');
      const hospital = await Hospital.findOne({ user: req.user._id });
      
      if (!hospital) {
        return res.status(404).json({ message: 'Hospital profile not found' });
      }

      res.json({
        preferences: hospital.alerts.notificationPreferences,
        autoAlertEnabled: hospital.alerts.autoAlertEnabled,
        criticalShortageThreshold: hospital.alerts.criticalShortageThreshold
      });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update notification preferences
router.put('/preferences', authorize('donor', 'hospital'), [
  body('email').optional().isBoolean(),
  body('sms').optional().isBoolean(),
  body('push').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (req.user.role === 'donor') {
      const Donor = require('../models/Donor');
      const donor = await Donor.findOne({ user: req.user._id });
      
      if (!donor) {
        return res.status(404).json({ message: 'Donor profile not found' });
      }

      // Update notification preferences
      if (req.body.email !== undefined) {
        donor.preferences.notificationMethods.email = req.body.email;
      }
      if (req.body.sms !== undefined) {
        donor.preferences.notificationMethods.sms = req.body.sms;
      }
      if (req.body.push !== undefined) {
        donor.preferences.notificationMethods.push = req.body.push;
      }
      if (req.body.maxTravelDistance !== undefined) {
        donor.preferences.maxTravelDistance = req.body.maxTravelDistance;
      }
      if (req.body.emergencyOnly !== undefined) {
        donor.preferences.emergencyOnly = req.body.emergencyOnly;
      }

      await donor.save();

      res.json({
        message: 'Notification preferences updated successfully',
        preferences: donor.preferences.notificationMethods
      });
    } else {
      const Hospital = require('../models/Hospital');
      const hospital = await Hospital.findOne({ user: req.user._id });
      
      if (!hospital) {
        return res.status(404).json({ message: 'Hospital profile not found' });
      }

      // Update notification preferences
      if (req.body.email !== undefined) {
        hospital.alerts.notificationPreferences.email = req.body.email;
      }
      if (req.body.sms !== undefined) {
        hospital.alerts.notificationPreferences.sms = req.body.sms;
      }
      if (req.body.push !== undefined) {
        hospital.alerts.notificationPreferences.push = req.body.push;
      }
      if (req.body.autoAlertEnabled !== undefined) {
        hospital.alerts.autoAlertEnabled = req.body.autoAlertEnabled;
      }
      if (req.body.criticalShortageThreshold !== undefined) {
        hospital.alerts.criticalShortageThreshold = req.body.criticalShortageThreshold;
      }

      await hospital.save();

      res.json({
        message: 'Notification preferences updated successfully',
        preferences: hospital.alerts.notificationPreferences
      });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get notification history (simplified implementation)
router.get('/history', authorize('donor', 'hospital'), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    if (req.user.role === 'donor') {
      const Alert = require('../models/Alert');
      
      // Find alerts where notifications were sent to this donor
      const alerts = await Alert.find({
        'notifications.sentTo.donor': req.user._id
      })
      .populate('hospital', 'basicInfo.name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

      const notifications = alerts.map(alert => {
        const notification = alert.notifications.sentTo.find(n => 
          n.donor.toString() === req.user._id.toString()
        );
        
        return {
          id: alert._id,
          type: 'blood_shortage_alert',
          title: `${alert.bloodType} Blood Needed`,
          message: `${alert.urgencyLevel} shortage at ${alert.hospital?.basicInfo?.name}`,
          bloodType: alert.bloodType,
          urgencyLevel: alert.urgencyLevel,
          hospital: alert.hospital?.basicInfo?.name,
          sentAt: notification?.sentAt,
          opened: notification?.opened,
          openedAt: notification?.openedAt,
          responded: notification?.responded,
          respondedAt: notification?.respondedAt,
          method: notification?.method
        };
      });

      res.json({
        notifications,
        pagination: {
          current: page,
          total: notifications.length
        }
      });
    } else {
      // Hospital notification history
      res.json({
        notifications: [],
        message: 'Hospital notification history not implemented'
      });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Mark notification as read
router.put('/:notificationId/read', authorize('donor', 'hospital'), async (req, res) => {
  try {
    if (req.user.role === 'donor') {
      const Alert = require('../models/Alert');
      
      const alert = await Alert.findOne({
        _id: req.params.notificationId,
        'notifications.sentTo.donor': req.user._id
      });

      if (!alert) {
        return res.status(404).json({ message: 'Notification not found' });
      }

      // Find and update the notification
      const notification = alert.notifications.sentTo.find(n => 
        n.donor.toString() === req.user._id.toString()
      );

      if (notification && !notification.opened) {
        notification.opened = true;
        notification.openedAt = new Date();
        alert.notifications.opened += 1;
        await alert.save();
      }

      res.json({
        message: 'Notification marked as read',
        notificationId: req.params.notificationId
      });
    } else {
      res.json({
        message: 'Hospital notification read status not implemented'
      });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Test notification sending
router.post('/test', authorize('donor', 'hospital'), [
  body('type').isIn(['email', 'sms', 'push']),
  body('message').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const notificationService = require('../services/notificationService');
    const { type, message } = req.body;

    // Send test notification based on user role
    if (req.user.role === 'donor') {
      const Donor = require('../models/Donor');
      const donor = await Donor.findOne({ user: req.user._id });
      
      if (!donor) {
        return res.status(404).json({ message: 'Donor profile not found' });
      }

      const testMessage = message || 'This is a test notification from Blood Shortage Alert System';

      try {
        if (type === 'email') {
          await notificationService.emailTransporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: req.user.email,
            subject: '🩸 Test Notification - Blood Shortage Alert System',
            html: `
              <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Test Notification</h2>
                <p>${testMessage}</p>
                <p>This is a test email to verify your notification settings.</p>
              </div>
            `
          });
        } else if (type === 'sms') {
          if (notificationService.twilioClient) {
            await notificationService.twilioClient.messages.create({
              body: `Test SMS: ${testMessage}`,
              from: process.env.TWILIO_PHONE_NUMBER,
              to: donor.personalInfo.phone
            });
          } else {
            return res.status(400).json({ message: 'SMS service not configured' });
          }
        } else if (type === 'push') {
          // Push notification test (mock implementation)
          console.log('Push notification test:', testMessage);
        }

        res.json({
          message: `Test ${type} notification sent successfully`,
          type,
          sentTo: type === 'email' ? req.user.email : donor.personalInfo.phone
        });
      } catch (notificationError) {
        res.status(500).json({ 
          message: `Failed to send test ${type} notification`,
          error: notificationError.message 
        });
      }
    } else {
      res.json({
        message: 'Hospital test notifications not implemented'
      });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get notification statistics
router.get('/stats', authorize('donor', 'hospital'), async (req, res) => {
  try {
    if (req.user.role === 'donor') {
      const Alert = require('../models/Alert');
      
      const stats = await Alert.aggregate([
        { $match: { 'notifications.sentTo.donor': req.user._id } },
        { $unwind: '$notifications.sentTo' },
        { $match: { 'notifications.sentTo.donor': req.user._id } },
        {
          $group: {
            _id: null,
            totalReceived: { $sum: 1 },
            totalOpened: { $sum: { $cond: ['$notifications.sentTo.opened', 1, 0] } },
            totalResponded: { $sum: { $cond: ['$notifications.sentTo.responded', 1, 0] } },
            avgResponseTime: { $avg: '$notifications.sentTo.responseTime' }
          }
        }
      ]);

      const result = stats[0] || {
        totalReceived: 0,
        totalOpened: 0,
        totalResponded: 0,
        avgResponseTime: 0
      };

      result.openRate = result.totalReceived > 0 ? 
        Math.round((result.totalOpened / result.totalReceived) * 100) : 0;
      result.responseRate = result.totalReceived > 0 ? 
        Math.round((result.totalResponded / result.totalReceived) * 100) : 0;

      res.json(result);
    } else {
      const Alert = require('../models/Alert');
      
      const stats = await Alert.aggregate([
        { $match: { hospital: req.hospital._id } },
        {
          $group: {
            _id: null,
            totalAlerts: { $sum: 1 },
            totalNotificationsSent: { $sum: '$notifications.sent' },
            totalOpened: { $sum: '$notifications.opened' },
            totalResponded: { $sum: '$notifications.responded' }
          }
        }
      ]);

      const result = stats[0] || {
        totalAlerts: 0,
        totalNotificationsSent: 0,
        totalOpened: 0,
        totalResponded: 0
      };

      result.openRate = result.totalNotificationsSent > 0 ? 
        Math.round((result.totalOpened / result.totalNotificationsSent) * 100) : 0;
      result.responseRate = result.totalNotificationsSent > 0 ? 
        Math.round((result.totalResponded / result.totalNotificationsSent) * 100) : 0;

      res.json(result);
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
