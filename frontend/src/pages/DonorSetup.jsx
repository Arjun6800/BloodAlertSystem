import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { Heart, User, MapPin, Phone, Calendar, Droplets, Activity } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner, { ButtonLoader } from '../components/LoadingSpinner';

const DonorSetup = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { updateProfile } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm();

  const bloodGroup = watch('bloodGroup');

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      // Transform data to match backend Donor schema
      const donorData = {
        personalInfo: {
          firstName: data.fullName?.split(' ')[0] || '',
          lastName: data.fullName?.split(' ').slice(1).join(' ') || '',
          dateOfBirth: data.dateOfBirth,
          gender: data.gender,
          phone: data.phone,
          emergencyContact: {
            name: data.emergencyContactName,
            phone: data.emergencyContactPhone,
            relationship: data.emergencyContactRelationship,
          },
        },
        medicalInfo: {
          bloodGroup: data.bloodGroup,
          weight: parseFloat(data.weight),
          height: data.height ? parseFloat(data.height) : 170, // Default height if not provided
          allergies: data.allergies ? data.allergies.split(',').map(a => a.trim()) : [],
          medications: data.medications ? data.medications.split(',').map(m => m.trim()) : [],
          medicalConditions: data.chronicConditions ? data.chronicConditions.split(',').map(c => c.trim()) : [],
          lastMedicalCheckup: null,
          isDiabetic: false,
          hasHeartCondition: false,
          hasInfectiousDisease: false
        },
        location: {
          address: {
            street: data.street,
            city: data.city,
            state: data.state,
            zipCode: data.zipCode,
            country: 'India',
          },
          coordinates: {
            type: 'Point',
            coordinates: [0, 0], // You can update this with real geolocation if available
          },
        },
        preferences: {
          notificationMethods: {
            email: data.receiveEmailAlerts ?? true,
            sms: data.receiveSMSAlerts ?? true,
            push: true,
          },
          maxTravelDistance: parseInt(data.maxTravelDistance),
          availableDays: Array.isArray(data.preferredDonationDays) ? data.preferredDonationDays.map(d => d.toLowerCase()) : [],
          availableTimeSlots: Array.isArray(data.availableTimeSlots) ? data.availableTimeSlots.map(slot => ({ start: slot.split(' ')[0], end: slot.split(' ')[2] || '' })) : [],
          emergencyOnly: false,
        },
      };
      await updateProfile(donorData);
      toast.success('Profile setup completed successfully!');
      navigate('/donor/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to setup profile');
    } finally {
      setIsLoading(false);
    }
  };

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const timeSlots = ['Morning (6AM-12PM)', 'Afternoon (12PM-6PM)', 'Evening (6PM-10PM)'];

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
            Complete Your Donor Profile
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            Help us match you with emergency blood requests effectively
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
                <span className="ml-2 text-sm font-medium">Profile Setup</span>
              </div>
              <div className="flex-1 h-1 bg-gray-300 mx-4"></div>
              <div className="flex items-center text-gray-400">
                <div className="flex items-center justify-center w-8 h-8 bg-gray-300 text-gray-600 rounded-full text-sm font-medium">
                  3
                </div>
                <span className="ml-2 text-sm font-medium">Ready to Help</span>
              </div>
            </div>
          </div>
        </div>

        {/* Setup Form */}
        <div className="card">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* Personal Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <User className="h-5 w-5 mr-2" />
                Personal Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    className={`input-field ${errors.fullName ? 'border-red-500' : ''}`}
                    placeholder="Enter your full name"
                    {...register('fullName', { required: 'Full name is required' })}
                  />
                  {errors.fullName && (
                    <p className="mt-1 text-sm text-red-600">{errors.fullName.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    className={`input-field ${errors.phone ? 'border-red-500' : ''}`}
                    placeholder="Enter your phone number"
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
                    Date of Birth *
                  </label>
                  <input
                    type="date"
                    className={`input-field ${errors.dateOfBirth ? 'border-red-500' : ''}`}
                    {...register('dateOfBirth', { required: 'Date of birth is required' })}
                  />
                  {errors.dateOfBirth && (
                    <p className="mt-1 text-sm text-red-600">{errors.dateOfBirth.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gender *
                  </label>
                  <select
                    className={`input-field ${errors.gender ? 'border-red-500' : ''}`}
                    {...register('gender', { required: 'Gender is required' })}
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                  {errors.gender && (
                    <p className="mt-1 text-sm text-red-600">{errors.gender.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Blood Group *
                  </label>
                  <select
                    className={`input-field ${errors.bloodGroup ? 'border-red-500' : ''}`}
                    {...register('bloodGroup', { required: 'Blood group is required' })}
                  >
                    <option value="">Select blood group</option>
                    {bloodGroups.map((group) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))}
                  </select>
                  {errors.bloodGroup && (
                    <p className="mt-1 text-sm text-red-600">{errors.bloodGroup.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Weight (kg) *
                  </label>
                  <input
                    type="number"
                    min="45"
                    max="200"
                    className={`input-field ${errors.weight ? 'border-red-500' : ''}`}
                    placeholder="Enter your weight"
                    {...register('weight', {
                      required: 'Weight is required',
                      min: { value: 45, message: 'Minimum weight for donation is 45kg' },
                      max: { value: 200, message: 'Please enter a valid weight' },
                    })}
                  />
                  {errors.weight && (
                    <p className="mt-1 text-sm text-red-600">{errors.weight.message}</p>
                  )}
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
                    placeholder="Enter your street address"
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
                    placeholder="Enter your city"
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
                    placeholder="Enter your state"
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
                    placeholder="Enter your ZIP code"
                    {...register('zipCode', { required: 'ZIP code is required' })}
                  />
                  {errors.zipCode && (
                    <p className="mt-1 text-sm text-red-600">{errors.zipCode.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Maximum Travel Distance (km) *
                  </label>
                  <select
                    className={`input-field ${errors.maxTravelDistance ? 'border-red-500' : ''}`}
                    {...register('maxTravelDistance', { required: 'Please select travel distance' })}
                  >
                    <option value="">Select distance</option>
                    <option value="5">Within 5 km</option>
                    <option value="10">Within 10 km</option>
                    <option value="20">Within 20 km</option>
                    <option value="50">Within 50 km</option>
                    <option value="100">Within 100 km</option>
                  </select>
                  {errors.maxTravelDistance && (
                    <p className="mt-1 text-sm text-red-600">{errors.maxTravelDistance.message}</p>
                  )}
                </div>
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
                    Relationship *
                  </label>
                  <select
                    className={`input-field ${errors.emergencyContactRelationship ? 'border-red-500' : ''}`}
                    {...register('emergencyContactRelationship', { required: 'Relationship is required' })}
                  >
                    <option value="">Select relationship</option>
                    <option value="spouse">Spouse</option>
                    <option value="parent">Parent</option>
                    <option value="sibling">Sibling</option>
                    <option value="child">Child</option>
                    <option value="friend">Friend</option>
                    <option value="other">Other</option>
                  </select>
                  {errors.emergencyContactRelationship && (
                    <p className="mt-1 text-sm text-red-600">{errors.emergencyContactRelationship.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Medical Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                Medical Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Donation Date (if any)
                  </label>
                  <input
                    type="date"
                    className="input-field"
                    {...register('lastDonationDate')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Recent Tattoo/Piercing Date (if any)
                  </label>
                  <input
                    type="date"
                    className="input-field"
                    {...register('tattooPiercingDate')}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Allergies (comma separated)
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g., Penicillin, Shellfish, None"
                    {...register('allergies')}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Medications (comma separated)
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g., Aspirin, Vitamin D, None"
                    {...register('medications')}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Chronic Conditions (comma separated)
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g., Diabetes, Hypertension, None"
                    {...register('chronicConditions')}
                  />
                </div>
              </div>
            </div>

            {/* Availability Preferences */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Availability Preferences
              </h3>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Preferred Donation Days
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {days.map((day) => (
                      <label key={day} className="flex items-center">
                        <input
                          type="checkbox"
                          value={day}
                          className="h-4 w-4 text-blood-600 focus:ring-blood-500 border-gray-300 rounded"
                          {...register('preferredDonationDays')}
                        />
                        <span className="ml-2 text-sm text-gray-700">{day}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Available Time Slots
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {timeSlots.map((slot) => (
                      <label key={slot} className="flex items-center">
                        <input
                          type="checkbox"
                          value={slot}
                          className="h-4 w-4 text-blood-600 focus:ring-blood-500 border-gray-300 rounded"
                          {...register('availableTimeSlots')}
                        />
                        <span className="ml-2 text-sm text-gray-700">{slot}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Notification Preferences */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Droplets className="h-5 w-5 mr-2" />
                Notification Preferences
              </h3>
              <div className="space-y-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blood-600 focus:ring-blood-500 border-gray-300 rounded"
                    defaultChecked
                    {...register('receiveEmailAlerts')}
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Receive email alerts for emergency blood requests
                  </span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blood-600 focus:ring-blood-500 border-gray-300 rounded"
                    defaultChecked
                    {...register('receiveSMSAlerts')}
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Receive SMS alerts for urgent blood requests
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
                {isLoading ? 'Setting up profile...' : 'Complete Setup'}
              </button>
            </div>
          </form>
        </div>

        {/* Info Cards */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card bg-blue-50 border-blue-200">
            <h3 className="text-sm font-medium text-blue-800 mb-2">Donation Eligibility</h3>
            <div className="text-xs text-blue-700 space-y-1">
              <p>• Must be 18-65 years old</p>
              <p>• Minimum weight: 45 kg</p>
              <p>• 56 days gap between whole blood donations</p>
              <p>• Good general health required</p>
            </div>
          </div>

          <div className="card bg-green-50 border-green-200">
            <h3 className="text-sm font-medium text-green-800 mb-2">Your Impact</h3>
            <div className="text-xs text-green-700 space-y-1">
              <p>• One donation can save up to 3 lives</p>
              <p>• Get instant alerts for matching requests</p>
              <p>• Track your donation history</p>
              <p>• Join a community of lifesavers</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DonorSetup;
