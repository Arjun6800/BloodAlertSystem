const nodemailer = require('nodemailer');
const twilio = require('twilio');
const webpush = require('web-push');
const Alert = require('../models/Alert');
const Donor = require('../models/Donor');

class NotificationService {
  constructor() {
    this.initializeServices();
  }

  initializeServices() {
    // Email service
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      this.emailTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
    } else {
      console.log('Email service not configured - EMAIL_USER and EMAIL_PASS required');
    }

    // SMS service
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && 
        process.env.TWILIO_ACCOUNT_SID.startsWith('AC')) {
      this.twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    } else {
      console.log('Twilio SMS service not configured - valid TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN required');
    }

    // Web Push service
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && 
        process.env.VAPID_PUBLIC_KEY.length > 10 && process.env.VAPID_PRIVATE_KEY.length > 10) {
      try {
        webpush.setVapidDetails(
          `mailto:${process.env.VAPID_EMAIL}`,
          process.env.VAPID_PUBLIC_KEY,
          process.env.VAPID_PRIVATE_KEY
        );
      } catch (error) {
        console.log('Web Push service configuration error:', error.message);
      }
    } else {
      console.log('Web Push service not configured - valid VAPID keys required');
    }
  }

  async sendBloodShortageAlert(alert, donors) {
    const results = {
      email: { sent: 0, failed: 0 },
      sms: { sent: 0, failed: 0 },
      push: { sent: 0, failed: 0 }
    };

    for (const donor of donors) {
      try {
        // Send email notification
        if (donor.preferences.notificationMethods.email) {
          await this.sendEmailAlert(alert, donor);
          results.email.sent++;
        }

        // Send SMS notification
        if (donor.preferences.notificationMethods.sms) {
          await this.sendSMSAlert(alert, donor);
          results.sms.sent++;
        }

        // Send push notification
        if (donor.preferences.notificationMethods.push) {
          await this.sendPushAlert(alert, donor);
          results.push.sent++;
        }

        // Record notification in alert
        alert.notifications.sentTo.push({
          donor: donor._id,
          method: this.getPreferredMethod(donor),
          sentAt: new Date()
        });

      } catch (error) {
        console.error(`Failed to send notification to donor ${donor._id}:`, error);
        this.incrementFailedCount(results, donor);
      }
    }

    // Update alert statistics
    alert.notifications.sent += donors.length;
    await alert.save();

    return results;
  }

  async sendEmailAlert(alert, donor) {
    if (!this.emailTransporter) {
      throw new Error('Email service not configured');
    }

    const hospitalData = await alert.populate('hospital');
    const urgencyClass = this.getUrgencyClass(alert.urgencyLevel);
    
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: donor.user.email,
      subject: `🩸 URGENT: ${alert.bloodType} Blood Needed - ${alert.urgencyLevel.toUpperCase()} Alert`,
      html: this.generateEmailTemplate(alert, donor, hospitalData.hospital)
    };

    return await this.emailTransporter.sendMail(mailOptions);
  }

  async sendSMSAlert(alert, donor) {
    if (!this.twilioClient) {
      throw new Error('SMS service not configured');
    }

    const hospitalData = await alert.populate('hospital');
    const message = this.generateSMSMessage(alert, donor, hospitalData.hospital);

    return await this.twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: donor.personalInfo.phone
    });
  }

  async sendPushAlert(alert, donor) {
    // This would require storing push subscriptions from the frontend
    // For now, we'll implement the structure
    const payload = JSON.stringify({
      title: `🩸 ${alert.bloodType} Blood Needed`,
      body: `${alert.urgencyLevel.toUpperCase()} shortage at nearby hospital`,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      data: {
        alertId: alert._id,
        bloodType: alert.bloodType,
        urgencyLevel: alert.urgencyLevel,
        url: `/alerts/${alert._id}`
      }
    });

    // In a real implementation, you would retrieve the donor's push subscriptions
    // and send to each subscription endpoint
    console.log('Push notification payload prepared:', payload);
    return { success: true, payload };
  }

  generateEmailTemplate(alert, donor, hospital) {
    const urgencyColor = {
      low: '#28a745',
      medium: '#ffc107',
      high: '#fd7e14',
      critical: '#dc3545'
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Blood Donation Alert</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${urgencyColor[alert.urgencyLevel]}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
          .alert-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid ${urgencyColor[alert.urgencyLevel]}; }
          .btn { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
          .btn-danger { background: #dc3545; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 15px 0; }
          .info-item { background: white; padding: 10px; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🩸 BLOOD DONATION ALERT</h1>
            <h2>${alert.urgencyLevel.toUpperCase()} SHORTAGE</h2>
          </div>
          
          <div class="content">
            <div class="alert-box">
              <h3>Dear ${donor.personalInfo.firstName},</h3>
              <p>We urgently need your help! A nearby hospital has a <strong>${alert.urgencyLevel}</strong> shortage of <strong>${alert.bloodType}</strong> blood.</p>
            </div>

            <div class="info-grid">
              <div class="info-item">
                <strong>Blood Type Needed:</strong><br>
                <span style="color: ${urgencyColor[alert.urgencyLevel]}; font-size: 1.2em;">${alert.bloodType}</span>
              </div>
              <div class="info-item">
                <strong>Units Needed:</strong><br>
                ${alert.unitsNeeded} units
              </div>
              <div class="info-item">
                <strong>Hospital:</strong><br>
                ${hospital.basicInfo.name}
              </div>
              <div class="info-item">
                <strong>Required By:</strong><br>
                ${new Date(alert.patientInfo.requiredBy).toLocaleString()}
              </div>
            </div>

            <div class="alert-box">
              <h4>Patient Information:</h4>
              <p><strong>Condition:</strong> ${alert.patientInfo.condition}</p>
              <p><strong>Age:</strong> ${alert.patientInfo.age} years</p>
              <p><strong>Emergency:</strong> ${alert.patientInfo.isEmergency ? 'Yes' : 'No'}</p>
            </div>

            <div style="text-align: center; margin: 20px 0;">
              <a href="http://localhost:5173/alerts/${alert._id}/respond?response=interested" class="btn">
                I Can Donate
              </a>
              <a href="http://localhost:5173/alerts/${alert._id}/respond?response=not_available" class="btn" style="background: #6c757d;">
                Not Available
              </a>
            </div>

            <div class="alert-box">
              <h4>Hospital Contact Information:</h4>
              <p><strong>Phone:</strong> ${hospital.contactInfo.emergencyPhone}</p>
              <p><strong>Address:</strong> ${hospital.location.address.street}, ${hospital.location.address.city}</p>
            </div>

            <p style="font-size: 0.9em; color: #666;">
              Your blood type (${donor.medicalInfo.bloodGroup}) is compatible with this request. 
              Every donation can save up to 3 lives. Thank you for being a hero!
            </p>

            <p style="font-size: 0.8em; color: #999;">
              If you no longer wish to receive these alerts, 
              <a href="http://localhost:5173/unsubscribe/${donor._id}">click here to unsubscribe</a>.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generateSMSMessage(alert, donor, hospital) {
    return `🩸 BLOOD ALERT: ${alert.urgencyLevel.toUpperCase()} shortage of ${alert.bloodType} blood at ${hospital.basicInfo.name}. ${alert.unitsNeeded} units needed by ${new Date(alert.patientInfo.requiredBy).toLocaleDateString()}. Can you help? Reply YES to confirm or call ${hospital.contactInfo.emergencyPhone}. Thank you for saving lives!`;
  }

  getPreferredMethod(donor) {
    if (donor.preferences.notificationMethods.email) return 'email';
    if (donor.preferences.notificationMethods.sms) return 'sms';
    if (donor.preferences.notificationMethods.push) return 'push';
    return 'email';
  }

  getUrgencyClass(urgencyLevel) {
    const classes = {
      low: 'success',
      medium: 'warning',
      high: 'orange',
      critical: 'danger'
    };
    return classes[urgencyLevel] || 'info';
  }

  incrementFailedCount(results, donor) {
    if (donor.preferences.notificationMethods.email) results.email.failed++;
    if (donor.preferences.notificationMethods.sms) results.sms.failed++;
    if (donor.preferences.notificationMethods.push) results.push.failed++;
  }

  async sendDonationConfirmation(donor, donationDetails) {
    const subject = '🎉 Thank You for Your Blood Donation!';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #28a745; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1>🎉 Thank You, Hero!</h1>
        </div>
        
        <div style="background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px;">
          <h3>Dear ${donor.personalInfo.firstName},</h3>
          
          <p>Thank you for your life-saving blood donation! Your generosity can help save up to 3 lives.</p>
          
          <div style="background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #28a745;">
            <h4>Donation Details:</h4>
            <p><strong>Date:</strong> ${new Date(donationDetails.date).toLocaleDateString()}</p>
            <p><strong>Location:</strong> ${donationDetails.location}</p>
            <p><strong>Volume:</strong> ${donationDetails.volume}ml</p>
            <p><strong>Blood Type:</strong> ${donor.medicalInfo.bloodGroup}</p>
          </div>
          
          <div style="background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #007bff;">
            <h4>Important Reminders:</h4>
            <ul>
              <li>Drink plenty of fluids for the next 24 hours</li>
              <li>Avoid heavy lifting or strenuous exercise today</li>
              <li>You'll be eligible to donate again in 56 days</li>
              <li>Watch for any unusual symptoms and contact us if concerned</li>
            </ul>
          </div>
          
          <p>Your next eligible donation date is: <strong>${new Date(Date.now() + 56 * 24 * 60 * 60 * 1000).toLocaleDateString()}</strong></p>
          
          <p>Thank you for being a hero in our community!</p>
        </div>
      </div>
    `;

    return await this.emailTransporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: donor.user.email,
      subject,
      html
    });
  }

  async sendHospitalAlert(hospital, alertDetails) {
    const subject = `🚨 Blood Shortage Alert Created - ${alertDetails.bloodType}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1>🚨 Blood Shortage Alert Created</h1>
        </div>
        
        <div style="background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px;">
          <h3>Alert Details:</h3>
          <div style="background: white; padding: 15px; margin: 15px 0;">
            <p><strong>Blood Type:</strong> ${alertDetails.bloodType}</p>
            <p><strong>Units Needed:</strong> ${alertDetails.unitsNeeded}</p>
            <p><strong>Urgency Level:</strong> ${alertDetails.urgencyLevel}</p>
            <p><strong>Required By:</strong> ${new Date(alertDetails.requiredBy).toLocaleString()}</p>
          </div>
          
          <p>Notifications have been sent to eligible donors in your area. You can monitor responses in your dashboard.</p>
        </div>
      </div>
    `;

    return await this.emailTransporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: hospital.contactInfo.email,
      subject,
      html
    });
  }
}

module.exports = new NotificationService();
