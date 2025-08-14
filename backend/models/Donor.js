const mongoose = require('mongoose');

const donorSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  personalInfo: {
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    dateOfBirth: {
      type: Date,
      required: true
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: true
    },
    phone: {
      type: String,
      required: true,
      match: [/^\+?[\d\s-()]+$/, 'Please enter a valid phone number']
    },
    emergencyContact: {
      name: String,
      phone: String,
      relationship: String
    }
  },
  medicalInfo: {
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      required: true
    },
    weight: {
      type: Number,
      required: true,
      min: 45 // Minimum weight for donation
    },
    height: {
      type: Number,
      required: true
    },
    allergies: [String],
    medications: [String],
    medicalConditions: [String],
    lastMedicalCheckup: Date,
    isDiabetic: {
      type: Boolean,
      default: false
    },
    hasHeartCondition: {
      type: Boolean,
      default: false
    },
    hasInfectiousDisease: {
      type: Boolean,
      default: false
    }
  },
  location: {
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: {
        type: String,
        default: 'India'
      }
    },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true
      }
    }
  },
  donationHistory: [{
    donationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Donation'
    },
    date: {
      type: Date,
      required: true
    },
    location: String,
    bloodBank: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital'
    },
    volume: {
      type: Number,
      default: 450 // ml
    },
    type: {
      type: String,
      enum: ['whole_blood', 'plasma', 'platelets', 'red_cells'],
      default: 'whole_blood'
    },
    notes: String
  }],
  eligibility: {
    isEligible: {
      type: Boolean,
      default: true
    },
    lastDonationDate: Date,
    nextEligibleDate: Date,
    restrictions: [String],
    temporaryDeferral: {
      reason: String,
      until: Date
    }
  },
  preferences: {
    notificationMethods: {
      email: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      }
    },
    maxTravelDistance: {
      type: Number,
      default: 25, // km
      min: 5,
      max: 100
    },
    availableDays: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }],
    availableTimeSlots: [{
      start: String, // HH:mm format
      end: String
    }],
    emergencyOnly: {
      type: Boolean,
      default: false
    }
  },
  statistics: {
    totalDonations: {
      type: Number,
      default: 0
    },
    totalVolumeDonated: {
      type: Number,
      default: 0
    },
    firstDonationDate: Date,
    lastDonationDate: Date,
    streak: {
      current: {
        type: Number,
        default: 0
      },
      longest: {
        type: Number,
        default: 0
      }
    },
    livesImpacted: {
      type: Number,
      default: 0
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  documents: [{
    type: {
      type: String,
      enum: ['id_proof', 'medical_certificate', 'blood_test_report']
    },
    fileName: String,
    filePath: String,
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Create geospatial index for location-based queries
donorSchema.index({ 'location.coordinates': '2dsphere' });

// Index for blood group searches
donorSchema.index({ 'medicalInfo.bloodGroup': 1 });

// Index for eligibility searches
donorSchema.index({ 'eligibility.isEligible': 1, 'eligibility.nextEligibleDate': 1 });

// Virtual for age calculation
donorSchema.virtual('age').get(function() {
  if (!this.personalInfo.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.personalInfo.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
});

// Method to check current eligibility
donorSchema.methods.checkEligibility = function() {
  const now = new Date();
  const age = this.age;
  
  // Basic age check (18-65)
  if (age < 18 || age > 65) {
    return { eligible: false, reason: 'Age not within eligible range (18-65)' };
  }
  
  // Weight check
  if (this.medicalInfo.weight < 45) {
    return { eligible: false, reason: 'Weight below minimum requirement (45kg)' };
  }
  
  // Check last donation date (56 days for whole blood)
  if (this.eligibility.lastDonationDate) {
    const daysSinceLastDonation = Math.floor((now - this.eligibility.lastDonationDate) / (1000 * 60 * 60 * 24));
    if (daysSinceLastDonation < 56) {
      return { eligible: false, reason: `Must wait ${56 - daysSinceLastDonation} more days since last donation` };
    }
  }
  
  // Check temporary deferral
  if (this.eligibility.temporaryDeferral && this.eligibility.temporaryDeferral.until > now) {
    return { eligible: false, reason: this.eligibility.temporaryDeferral.reason };
  }
  
  // Check medical conditions
  if (this.medicalInfo.hasInfectiousDisease) {
    return { eligible: false, reason: 'Medical condition prevents donation' };
  }
  
  return { eligible: true, reason: 'Eligible for donation' };
};

// Method to update eligibility after donation
donorSchema.methods.updateEligibilityAfterDonation = function() {
  this.eligibility.lastDonationDate = new Date();
  this.eligibility.nextEligibleDate = new Date(Date.now() + 56 * 24 * 60 * 60 * 1000); // 56 days later
  this.statistics.totalDonations += 1;
  this.statistics.totalVolumeDonated += 450; // Assuming 450ml per donation
  this.statistics.lastDonationDate = new Date();
  
  if (!this.statistics.firstDonationDate) {
    this.statistics.firstDonationDate = new Date();
  }
};

module.exports = mongoose.model('Donor', donorSchema);
