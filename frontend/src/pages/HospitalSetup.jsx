import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { Heart, Building2, MapPin, Phone, Clock, Shield, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { ButtonLoader } from '../components/LoadingSpinner';

const HospitalSetup = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { updateProfile, user } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm();

  const facilityType = watch('facilityType');

  const onSubmit = async (data) => {
    setIsLoading(true);

    try {
      // Format the data according to the Hospital model
      const hospitalData = {
        profile: {
          name: data.name,
          facilityType: data.facilityType,
          licenseNumber: data.licenseNumber,
          contactInfo: {
            phone: data.phone,
            email: data.email,
            website: data.website,
          },
          address: {
            street: data.street,
            city: data.city,
            state: data.state,
            zipCode: data.zipCode,
            coordinates: [], // Will be set by geolocation or geocoding
          },
          operatingHours: {
            monday: { open: data.mondayOpen, close: data.mondayClose, is24Hours: data.monday24Hours },
            tuesday: { open: data.tuesdayOpen, close: data.tuesdayClose, is24Hours: data.tuesday24Hours },
            wednesday: { open: data.wednesdayOpen, close: data.wednesdayClose, is24Hours: data.wednesday24Hours },
            thursday: { open: data.thursdayOpen, close: data.thursdayClose, is24Hours: data.thursday24Hours },
            friday: { open: data.fridayOpen, close: data.fridayClose, is24Hours: data.friday24Hours },
            saturday: { open: data.saturdayOpen, close: data.saturdayClose, is24Hours: data.saturday24Hours },
            sunday: { open: data.sundayOpen, close: data.sundayClose, is24Hours: data.sunday24Hours },
          },
          emergencyContact: {
            name: data.emergencyContactName,
            phone: data.emergencyContactPhone,
            designation: data.emergencyContactDesignation,
          },
          capacity: {
            totalBeds: parseInt(data.totalBeds) || 0,
            emergencyBeds: parseInt(data.emergencyBeds) || 0,
            icuBeds: parseInt(data.icuBeds) || 0,
          },
          departments: data.departments ? data.departments.split(',').map(d => d.trim()) : [],
          certifications: data.certifications ? data.certifications.split(',').map(c => c.trim()) : [],
        },
        settings: {
          autoAlertRadius: parseInt(data.autoAlertRadius),
          criticalLevelThreshold: parseInt(data.criticalLevelThreshold),
          lowLevelThreshold: parseInt(data.lowLevelThreshold),
          allowPublicRequests: data.allowPublicRequests,
          requireDonorVerification: data.requireDonorVerification,
          enableEmergencyProtocol: data.enableEmergencyProtocol,
        },
      };

      await updateProfile(hospitalData);
      toast.success('Hospital profile setup completed successfully!');
      navigate('/hospital/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to setup profile');
    } finally {
      setIsLoading(false);
    }
  };

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const dayLabels = {
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blood-50 to-red-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center">
            <div className="flex items-center space-x-2">
              <Heart className="h-12 w-12 text-blood-600" />
              <span className="text-3xl font-bold text-gray-900">BloodAlert</span>
            </div>
          </div>
          <h1 className="mt-6 text-3xl font-extrabold text-gray-900">
            Setup Your Healthcare Facility
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            Configure your facility profile to receive blood donation alerts
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center">
              <div className="flex items-center text-blood-600">
                <div className="flex items-center justify-center w-8 h-8 bg-blood-600 text-white rounded-full text-sm font-medium">
                  1
                </div>
                <span className="ml-2 text-sm font-medium">Account Created</span>
              </div>
              <div className="flex-1 h-1 bg-blood-600 mx-4"></div>
              <div className="flex items-center text-blood-600">
                <div className="flex items-center justify-center w-8 h-8 bg-blood-600 text-white rounded-full text-sm font-medium">
                  2
                </div>
                <span className="ml-2 text-sm font-medium">Facility Setup</span>
              </div>
              <div className="flex-1 h-1 bg-gray-300 mx-4"></div>
              <div className="flex items-center text-gray-400">
                <div className="flex items-center justify-center w-8 h-8 bg-gray-300 text-gray-600 rounded-full text-sm font-medium">
                  3
                </div>
                <span className="ml-2 text-sm font-medium">Ready to Receive</span>
              </div>
            </div>
          </div>
        </div>

        {/* Setup Form */}
        <div className="card">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* Basic Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Building2 className="h-5 w-5 mr-2" />
                Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Facility Name *
                  </label>
                  <input
                    type="text"
                    className={`input-field ${errors.name ? 'border-red-500' : ''}`}
                    placeholder="Enter facility name"
                    {...register('name', { required: 'Facility name is required' })}
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Facility Type *
                  </label>
                  <select
                    className={`input-field ${errors.facilityType ? 'border-red-500' : ''}`}
                    {...register('facilityType', { required: 'Facility type is required' })}
                  >
                    <option value="">Select facility type</option>
                    <option value="hospital">Hospital</option>
                    <option value="blood_bank">Blood Bank</option>
                    <option value="clinic">Clinic</option>
                    <option value="trauma_center">Trauma Center</option>
                    <option value="research_center">Research Center</option>
                  </select>
                  {errors.facilityType && (
                    <p className="mt-1 text-sm text-red-600">{errors.facilityType.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    License Number *
                  </label>
                  <input
                    type="text"
                    className={`input-field ${errors.licenseNumber ? 'border-red-500' : ''}`}
                    placeholder="Enter license number"
                    {...register('licenseNumber', { required: 'License number is required' })}
                  />
                  {errors.licenseNumber && (
                    <p className="mt-1 text-sm text-red-600">{errors.licenseNumber.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Phone *
                  </label>
                  <input
                    type="tel"
                    className={`input-field ${errors.phone ? 'border-red-500' : ''}`}
                    placeholder="Enter contact phone"
                    {...register('phone', {
                      required: 'Phone number is required',
                      pattern: {
                        value: /^[+]?[\d\s\-\(\)]{10,}$/,
                        message: 'Enter a valid phone number',
                      },
                    })}
                  />
                  {errors.phone && (
                    <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Email *
                  </label>
                  <input
                    type="email"
                    className={`input-field ${errors.email ? 'border-red-500' : ''}`}
                    placeholder="Enter contact email"
                    {...register('email', {
                      required: 'Email is required',
                      pattern: {
                        value: /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
                        message: 'Enter a valid email address',
                      },
                    })}
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Website
                  </label>
                  <input
                    type="url"
                    className="input-field"
                    placeholder="Enter website URL"
                    {...register('website')}
                  />
                </div>
              </div>
            </div>

            {/* Address Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <MapPin className="h-5 w-5 mr-2" />
                Address Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Street Address *
                  </label>
                  <input
                    type="text"
                    className={`input-field ${errors.street ? 'border-red-500' : ''}`}
                    placeholder="Enter street address"
                    {...register('street', { required: 'Street address is required' })}
                  />
                  {errors.street && (
                    <p className="mt-1 text-sm text-red-600">{errors.street.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    City *
                  </label>
                  <input
                    type="text"
                    className={`input-field ${errors.city ? 'border-red-500' : ''}`}
                    placeholder="Enter city"
                    {...register('city', { required: 'City is required' })}
                  />
                  {errors.city && (
                    <p className="mt-1 text-sm text-red-600">{errors.city.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    State *
                  </label>
                  <input
                    type="text"
                    className={`input-field ${errors.state ? 'border-red-500' : ''}`}
                    placeholder="Enter state"
                    {...register('state', { required: 'State is required' })}
                  />
                  {errors.state && (
                    <p className="mt-1 text-sm text-red-600">{errors.state.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ZIP Code *
                  </label>
                  <input
                    type="text"
                    className={`input-field ${errors.zipCode ? 'border-red-500' : ''}`}
                    placeholder="Enter ZIP code"
                    {...register('zipCode', { required: 'ZIP code is required' })}
                  />
                  {errors.zipCode && (
                    <p className="mt-1 text-sm text-red-600">{errors.zipCode.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Facility Details */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Users className="h-5 w-5 mr-2" />
                Facility Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Beds
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="input-field"
                    placeholder="Total bed capacity"
                    {...register('totalBeds')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Emergency Beds
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="input-field"
                    placeholder="Emergency bed capacity"
                    {...register('emergencyBeds')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ICU Beds
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="input-field"
                    placeholder="ICU bed capacity"
                    {...register('icuBeds')}
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Departments (comma separated)
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g., Emergency, Surgery, Cardiology, Oncology"
                    {...register('departments')}
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Certifications (comma separated)
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g., NABH, NABL, JCI, ISO 9001"
                    {...register('certifications')}
                  />
                </div>
              </div>
            </div>

            {/* Operating Hours */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Operating Hours
              </h3>
              <div className="space-y-4">
                {days.map((day) => (
                  <div key={day} className="flex items-center space-x-4">
                    <div className="w-24">
                      <span className="text-sm font-medium text-gray-700">
                        {dayLabels[day]}
                      </span>
                    </div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-blood-600 focus:ring-blood-500 border-gray-300 rounded mr-2"
                        {...register(`${day}24Hours`)}
                      />
                      <span className="text-sm text-gray-700">24 Hours</span>
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="time"
                        className="input-field w-auto"
                        {...register(`${day}Open`)}
                      />
                      <span className="text-sm text-gray-500">to</span>
                      <input
                        type="time"
                        className="input-field w-auto"
                        {...register(`${day}Close`)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Emergency Contact */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Phone className="h-5 w-5 mr-2" />
                Emergency Contact
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Name *
                  </label>
                  <input
                    type="text"
                    className={`input-field ${errors.emergencyContactName ? 'border-red-500' : ''}`}
                    placeholder="Emergency contact name"
                    {...register('emergencyContactName', { required: 'Emergency contact name is required' })}
                  />
                  {errors.emergencyContactName && (
                    <p className="mt-1 text-sm text-red-600">{errors.emergencyContactName.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Phone *
                  </label>
                  <input
                    type="tel"
                    className={`input-field ${errors.emergencyContactPhone ? 'border-red-500' : ''}`}
                    placeholder="Emergency contact phone"
                    {...register('emergencyContactPhone', { required: 'Emergency contact phone is required' })}
                  />
                  {errors.emergencyContactPhone && (
                    <p className="mt-1 text-sm text-red-600">{errors.emergencyContactPhone.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Designation *
                  </label>
                  <input
                    type="text"
                    className={`input-field ${errors.emergencyContactDesignation ? 'border-red-500' : ''}`}
                    placeholder="e.g., Chief Medical Officer"
                    {...register('emergencyContactDesignation', { required: 'Designation is required' })}
                  />
                  {errors.emergencyContactDesignation && (
                    <p className="mt-1 text-sm text-red-600">{errors.emergencyContactDesignation.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Alert Settings */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                Alert Settings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Auto Alert Radius (km) *
                  </label>
                  <select
                    className={`input-field ${errors.autoAlertRadius ? 'border-red-500' : ''}`}
                    {...register('autoAlertRadius', { required: 'Alert radius is required' })}
                  >
                    <option value="">Select radius</option>
                    <option value="5">5 km</option>
                    <option value="10">10 km</option>
                    <option value="20">20 km</option>
                    <option value="50">50 km</option>
                    <option value="100">100 km</option>
                  </select>
                  {errors.autoAlertRadius && (
                    <p className="mt-1 text-sm text-red-600">{errors.autoAlertRadius.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Critical Level Threshold (units) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    className={`input-field ${errors.criticalLevelThreshold ? 'border-red-500' : ''}`}
                    placeholder="e.g., 5"
                    {...register('criticalLevelThreshold', {
                      required: 'Critical threshold is required',
                      min: { value: 1, message: 'Minimum value is 1' },
                    })}
                  />
                  {errors.criticalLevelThreshold && (
                    <p className="mt-1 text-sm text-red-600">{errors.criticalLevelThreshold.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Low Level Threshold (units) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    className={`input-field ${errors.lowLevelThreshold ? 'border-red-500' : ''}`}
                    placeholder="e.g., 20"
                    {...register('lowLevelThreshold', {
                      required: 'Low threshold is required',
                      min: { value: 1, message: 'Minimum value is 1' },
                    })}
                  />
                  {errors.lowLevelThreshold && (
                    <p className="mt-1 text-sm text-red-600">{errors.lowLevelThreshold.message}</p>
                  )}
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blood-600 focus:ring-blood-500 border-gray-300 rounded"
                    defaultChecked
                    {...register('allowPublicRequests')}
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Allow public to see your blood requests
                  </span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blood-600 focus:ring-blood-500 border-gray-300 rounded"
                    defaultChecked
                    {...register('requireDonorVerification')}
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Require donor verification before acceptance
                  </span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blood-600 focus:ring-blood-500 border-gray-300 rounded"
                    defaultChecked
                    {...register('enableEmergencyProtocol')}
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Enable emergency protocol for critical situations
                  </span>
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-center pt-6">
              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary px-8 py-3 text-lg"
              >
                {isLoading && <ButtonLoader />}
                {isLoading ? 'Setting up facility...' : 'Complete Setup'}
              </button>
            </div>
          </form>
        </div>

        {/* Info Cards */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card bg-blue-50 border-blue-200">
            <h3 className="text-sm font-medium text-blue-800 mb-2">Platform Benefits</h3>
            <div className="text-xs text-blue-700 space-y-1">
              <p>• Real-time blood inventory management</p>
              <p>• Instant donor alerts for shortages</p>
              <p>• Automated matching with compatible donors</p>
              <p>• Emergency response coordination</p>
            </div>
          </div>

          <div className="card bg-green-50 border-green-200">
            <h3 className="text-sm font-medium text-green-800 mb-2">Security & Compliance</h3>
            <div className="text-xs text-green-700 space-y-1">
              <p>• HIPAA compliant data handling</p>
              <p>• Verified donor and facility network</p>
              <p>• Secure communication protocols</p>
              <p>• Audit trail for all transactions</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HospitalSetup;
