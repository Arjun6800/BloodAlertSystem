const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid token. User not found.' });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: 'Account is deactivated.' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired.' });
    }
    res.status(500).json({ message: 'Server error during authentication.' });
  }
};

// Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Access denied. Required roles: ${roles.join(', ')}` 
      });
    }

    next();
  };
};

// Hospital verification middleware
const requireVerifiedHospital = async (req, res, next) => {
  try {
    if (req.user.role !== 'hospital' && req.user.role !== 'blood_bank') {
      return res.status(403).json({ message: 'Hospital access required.' });
    }

    const Hospital = require('../models/Hospital');
    const hospital = await Hospital.findOne({ user: req.user._id });
    
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital profile not found.' });
    }

    if (hospital.verificationStatus !== 'verified') {
      return res.status(403).json({ 
        message: `Hospital verification required. Current status: ${hospital.verificationStatus}` 
      });
    }

    req.hospital = hospital;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error during hospital verification.' });
  }
};

// Donor verification middleware
const requireVerifiedDonor = async (req, res, next) => {
  try {
    if (req.user.role !== 'donor') {
      return res.status(403).json({ message: 'Donor access required.' });
    }

    const Donor = require('../models/Donor');
    const donor = await Donor.findOne({ user: req.user._id });
    
    if (!donor) {
      return res.status(404).json({ message: 'Donor profile not found.' });
    }

    if (donor.verificationStatus !== 'verified') {
      return res.status(403).json({ 
        message: `Donor verification required. Current status: ${donor.verificationStatus}` 
      });
    }

    req.donor = donor;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error during donor verification.' });
  }
};

module.exports = {
  authMiddleware,
  authorize,
  requireVerifiedHospital,
  requireVerifiedDonor
};
