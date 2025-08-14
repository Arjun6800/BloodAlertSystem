const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  basicInfo: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    registrationNumber: {
      type: String,
      required: true,
      unique: true
    },
    type: {
      type: String,
      enum: ['government', 'private', 'blood_bank', 'clinic'],
      required: true
    },
    category: {
      type: String,
      enum: ['primary', 'secondary', 'tertiary', 'specialty'],
      required: true
    },
    bedCapacity: {
      type: Number,
      required: true,
      min: 1
    },
    establishedYear: Number,
    website: String,
    description: String
  },
  contactInfo: {
    primaryPhone: {
      type: String,
      required: true
    },
    secondaryPhone: String,
    emergencyPhone: {
      type: String,
      required: true
    },
    fax: String,
    email: {
      type: String,
      required: true,
      lowercase: true
    },
    emergencyEmail: String
  },
  location: {
    address: {
      street: {
        type: String,
        required: true
      },
      area: String,
      city: {
        type: String,
        required: true
      },
      state: {
        type: String,
        required: true
      },
      zipCode: {
        type: String,
        required: true
      },
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
    },
    landmarks: [String],
    accessibilityInfo: String
  },
  bloodBank: {
    hasBloodBank: {
      type: Boolean,
      default: false
    },
    bloodBankLicense: String,
    storageCapacity: {
      type: Number,
      default: 0 // in units
    },
    refrigerationUnits: Number,
    plasmaSeparator: {
      type: Boolean,
      default: false
    },
    componentSeparation: {
      type: Boolean,
      default: false
    },
    operatingHours: {
      weekdays: {
        open: String, // HH:mm format
        close: String
      },
      weekends: {
        open: String,
        close: String
      },
      is24x7: {
        type: Boolean,
        default: false
      }
    }
  },
  inventory: {
    bloodUnits: {
      'A+': {
        available: { type: Number, default: 0 },
        reserved: { type: Number, default: 0 },
        critical: { type: Number, default: 5 },
        lastUpdated: { type: Date, default: Date.now }
      },
      'A-': {
        available: { type: Number, default: 0 },
        reserved: { type: Number, default: 0 },
        critical: { type: Number, default: 3 },
        lastUpdated: { type: Date, default: Date.now }
      },
      'B+': {
        available: { type: Number, default: 0 },
        reserved: { type: Number, default: 0 },
        critical: { type: Number, default: 5 },
        lastUpdated: { type: Date, default: Date.now }
      },
      'B-': {
        available: { type: Number, default: 0 },
        reserved: { type: Number, default: 0 },
        critical: { type: Number, default: 3 },
        lastUpdated: { type: Date, default: Date.now }
      },
      'AB+': {
        available: { type: Number, default: 0 },
        reserved: { type: Number, default: 0 },
        critical: { type: Number, default: 2 },
        lastUpdated: { type: Date, default: Date.now }
      },
      'AB-': {
        available: { type: Number, default: 0 },
        reserved: { type: Number, default: 0 },
        critical: { type: Number, default: 1 },
        lastUpdated: { type: Date, default: Date.now }
      },
      'O+': {
        available: { type: Number, default: 0 },
        reserved: { type: Number, default: 0 },
        critical: { type: Number, default: 10 },
        lastUpdated: { type: Date, default: Date.now }
      },
      'O-': {
        available: { type: Number, default: 0 },
        reserved: { type: Number, default: 0 },
        critical: { type: Number, default: 5 },
        lastUpdated: { type: Date, default: Date.now }
      }
    },
    components: {
      redCells: { type: Number, default: 0 },
      plasma: { type: Number, default: 0 },
      platelets: { type: Number, default: 0 },
      cryoprecipitate: { type: Number, default: 0 }
    }
  },
  staff: {
    totalDoctors: Number,
    totalNurses: Number,
    totalTechnicians: Number,
    bloodBankStaff: Number,
    administrativeStaff: Number,
    emergencyContacts: [{
      name: String,
      designation: String,
      phone: String,
      email: String,
      department: String
    }]
  },
  services: {
    emergencyServices: {
      type: Boolean,
      default: false
    },
    ambulanceService: {
      type: Boolean,
      default: false
    },
    bloodDonationCamps: {
      type: Boolean,
      default: false
    },
    bloodTesting: {
      type: Boolean,
      default: false
    },
    componentSeparation: {
      type: Boolean,
      default: false
    },
    plasmapheresis: {
      type: Boolean,
      default: false
    },
    crossMatching: {
      type: Boolean,
      default: false
    }
  },
  certifications: [{
    name: String,
    issuedBy: String,
    issuedDate: Date,
    expiryDate: Date,
    certificateNumber: String,
    status: {
      type: String,
      enum: ['active', 'expired', 'suspended'],
      default: 'active'
    }
  }],
  partnerships: [{
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hospital'
    },
    type: {
      type: String,
      enum: ['blood_sharing', 'emergency_backup', 'referral']
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    },
    establishedDate: {
      type: Date,
      default: Date.now
    }
  }],
  statistics: {
    totalBloodRequests: {
      type: Number,
      default: 0
    },
    totalBloodSupplied: {
      type: Number,
      default: 0
    },
    totalDonationsConducted: {
      type: Number,
      default: 0
    },
    averageResponseTime: {
      type: Number,
      default: 0 // in minutes
    },
    lastMonthStats: {
      requests: Number,
      fulfilled: Number,
      donations: Number
    }
  },
  alerts: {
    criticalShortageThreshold: {
      type: Number,
      default: 3 // units
    },
    autoAlertEnabled: {
      type: Boolean,
      default: true
    },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    }
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected', 'suspended'],
    default: 'pending'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  documents: [{
    type: {
      type: String,
      enum: ['license', 'registration', 'certification', 'insurance']
    },
    fileName: String,
    filePath: String,
    uploadDate: {
      type: Date,
      default: Date.now
    },
    expiryDate: Date
  }]
}, {
  timestamps: true
});

// Create geospatial index for location-based queries
hospitalSchema.index({ 'location.coordinates': '2dsphere' });

// Index for blood inventory searches
hospitalSchema.index({ 'inventory.bloodUnits': 1 });

// Index for verification status
hospitalSchema.index({ verificationStatus: 1, isActive: 1 });

// Method to check if blood type is in critical shortage
hospitalSchema.methods.isCriticalShortage = function(bloodType) {
  const inventory = this.inventory.bloodUnits[bloodType];
  return inventory && inventory.available <= inventory.critical;
};

// Method to get all critical shortages
hospitalSchema.methods.getCriticalShortages = function() {
  const criticalShortages = [];
  const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  
  bloodTypes.forEach(bloodType => {
    if (this.isCriticalShortage(bloodType)) {
      criticalShortages.push({
        bloodType,
        available: this.inventory.bloodUnits[bloodType].available,
        critical: this.inventory.bloodUnits[bloodType].critical,
        deficit: this.inventory.bloodUnits[bloodType].critical - this.inventory.bloodUnits[bloodType].available
      });
    }
  });
  
  return criticalShortages;
};

// Method to update inventory
hospitalSchema.methods.updateInventory = function(bloodType, change, type = 'available') {
  if (this.inventory.bloodUnits[bloodType]) {
    this.inventory.bloodUnits[bloodType][type] += change;
    this.inventory.bloodUnits[bloodType].lastUpdated = new Date();
    
    // Ensure non-negative values
    if (this.inventory.bloodUnits[bloodType][type] < 0) {
      this.inventory.bloodUnits[bloodType][type] = 0;
    }
  }
};

// Method to check compatibility for blood sharing
hospitalSchema.methods.canShareBloodWith = function(requestingHospital) {
  // Check if hospitals are partners
  const partnership = this.partnerships.find(p => 
    p.hospitalId.toString() === requestingHospital._id.toString() && 
    p.status === 'active' &&
    ['blood_sharing', 'emergency_backup'].includes(p.type)
  );
  
  return !!partnership;
};

module.exports = mongoose.model('Hospital', hospitalSchema);
