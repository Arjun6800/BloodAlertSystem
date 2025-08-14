const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true
  },
  bloodType: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    required: true
  },
  urgencyLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true
  },
  unitsNeeded: {
    type: Number,
    required: true,
    min: 1
  },
  unitsCollected: {
    type: Number,
    default: 0
  },
  reason: {
    type: String,
    required: true,
    trim: true
  },
  patientInfo: {
    age: Number,
    gender: {
      type: String,
      enum: ['male', 'female', 'other']
    },
    condition: String,
    isEmergency: {
      type: Boolean,
      default: false
    },
    requiredBy: {
      type: Date,
      required: true
    }
  },
  location: {
    searchRadius: {
      type: Number,
      default: 50, // km
      min: 5,
      max: 200
    },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number] // [longitude, latitude]
      }
    }
  },
  status: {
    type: String,
    enum: ['active', 'partially_fulfilled', 'fulfilled', 'expired', 'cancelled'],
    default: 'active'
  },
  notifications: {
    sent: {
      type: Number,
      default: 0
    },
    opened: {
      type: Number,
      default: 0
    },
    responded: {
      type: Number,
      default: 0
    },
    sentTo: [{
      donor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Donor'
      },
      method: {
        type: String,
        enum: ['email', 'sms', 'push']
      },
      sentAt: {
        type: Date,
        default: Date.now
      },
      opened: {
        type: Boolean,
        default: false
      },
      openedAt: Date,
      responded: {
        type: Boolean,
        default: false
      },
      respondedAt: Date,
      response: {
        type: String,
        enum: ['interested', 'not_available', 'not_eligible']
      }
    }]
  },
  responses: [{
    donor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Donor',
      required: true
    },
    responseType: {
      type: String,
      enum: ['interested', 'committed', 'donated', 'not_available', 'not_eligible'],
      required: true
    },
    message: String,
    contactInfo: {
      phone: String,
      email: String,
      preferredTime: String
    },
    estimatedArrival: Date,
    actualArrival: Date,
    donationCompleted: {
      type: Boolean,
      default: false
    },
    donationDetails: {
      volume: Number,
      date: Date,
      location: String,
      notes: String
    },
    responseTime: {
      type: Number // minutes from alert sent to response
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  sharing: {
    allowSharing: {
      type: Boolean,
      default: true
    },
    sharedWith: [{
      hospital: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hospital'
      },
      sharedAt: {
        type: Date,
        default: Date.now
      },
      response: {
        type: String,
        enum: ['pending', 'accepted', 'declined', 'partially_fulfilled']
      },
      unitsPromised: {
        type: Number,
        default: 0
      },
      unitsDelivered: {
        type: Number,
        default: 0
      },
      notes: String
    }]
  },
  analytics: {
    averageResponseTime: Number, // minutes
    conversionRate: Number, // percentage of responses to actual donations
    geographicReach: {
      averageDistance: Number, // km
      maxDistance: Number
    },
    demographicBreakdown: {
      ageGroups: {
        '18-25': Number,
        '26-35': Number,
        '36-45': Number,
        '46-55': Number,
        '56-65': Number
      },
      gender: {
        male: Number,
        female: Number,
        other: Number
      }
    }
  },
  expiresAt: {
    type: Date,
    required: true,
    default: function() {
      // Default expiry: 24 hours for critical, 72 hours for others
      const hours = this.urgencyLevel === 'critical' ? 24 : 72;
      return new Date(Date.now() + hours * 60 * 60 * 1000);
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  tags: [String], // For categorization and filtering
  internalNotes: String // For hospital staff use only
}, {
  timestamps: true
});

// Create indexes for efficient queries
alertSchema.index({ hospital: 1, status: 1 });
alertSchema.index({ bloodType: 1, status: 1 });
alertSchema.index({ urgencyLevel: 1, status: 1 });
alertSchema.index({ expiresAt: 1 });
alertSchema.index({ 'location.coordinates': '2dsphere' });
alertSchema.index({ createdAt: -1 });

// TTL index to automatically remove expired alerts
alertSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for completion percentage
alertSchema.virtual('completionPercentage').get(function() {
  if (this.unitsNeeded === 0) return 0;
  return Math.round((this.unitsCollected / this.unitsNeeded) * 100);
});

// Virtual for time remaining
alertSchema.virtual('timeRemaining').get(function() {
  const now = new Date();
  const remaining = this.expiresAt - now;
  if (remaining <= 0) return 0;
  return Math.floor(remaining / (1000 * 60 * 60)); // hours
});

// Method to check if alert is expired
alertSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt;
};

// Method to calculate response rate
alertSchema.methods.getResponseRate = function() {
  if (this.notifications.sent === 0) return 0;
  return Math.round((this.notifications.responded / this.notifications.sent) * 100);
};

// Method to calculate conversion rate (responses to actual donations)
alertSchema.methods.getConversionRate = function() {
  const totalResponses = this.responses.length;
  if (totalResponses === 0) return 0;
  
  const donations = this.responses.filter(r => r.donationCompleted).length;
  return Math.round((donations / totalResponses) * 100);
};

// Method to add response
alertSchema.methods.addResponse = function(donorId, responseType, additionalData = {}) {
  const response = {
    donor: donorId,
    responseType,
    ...additionalData
  };
  
  // Calculate response time if notification was sent to this donor
  const notification = this.notifications.sentTo.find(n => n.donor.toString() === donorId.toString());
  if (notification) {
    response.responseTime = Math.floor((new Date() - notification.sentAt) / (1000 * 60)); // minutes
    notification.responded = true;
    notification.respondedAt = new Date();
    notification.response = responseType;
  }
  
  this.responses.push(response);
  this.notifications.responded += 1;
  
  // Update units collected if donation completed
  if (responseType === 'donated' && additionalData.donationDetails) {
    this.unitsCollected += 1;
    
    // Update status based on completion
    if (this.unitsCollected >= this.unitsNeeded) {
      this.status = 'fulfilled';
    } else if (this.unitsCollected > 0) {
      this.status = 'partially_fulfilled';
    }
  }
};

// Method to extend expiry time
alertSchema.methods.extendExpiry = function(hours) {
  this.expiresAt = new Date(this.expiresAt.getTime() + hours * 60 * 60 * 1000);
};

// Method to check if donor is eligible for this alert
alertSchema.statics.checkDonorEligibility = function(donor, alert) {
  // Check blood type compatibility
  const compatibleBloodTypes = {
    'A+': ['A+', 'A-', 'O+', 'O-'],
    'A-': ['A-', 'O-'],
    'B+': ['B+', 'B-', 'O+', 'O-'],
    'B-': ['B-', 'O-'],
    'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    'AB-': ['A-', 'B-', 'AB-', 'O-'],
    'O+': ['O+', 'O-'],
    'O-': ['O-']
  };
  
  const eligibleBloodTypes = compatibleBloodTypes[alert.bloodType] || [];
  if (!eligibleBloodTypes.includes(donor.medicalInfo.bloodGroup)) {
    return { eligible: false, reason: 'Blood type incompatible' };
  }
  
  // Check general donor eligibility
  const donorEligibility = donor.checkEligibility();
  if (!donorEligibility.eligible) {
    return donorEligibility;
  }
  
  // Check if donor is within search radius
  // This would be handled by geospatial query, but we can add additional checks here
  
  return { eligible: true, reason: 'Eligible for this alert' };
};

module.exports = mongoose.model('Alert', alertSchema);
