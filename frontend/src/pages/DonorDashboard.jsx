import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { 
  Heart, 
  MapPin, 
  Clock, 
  Calendar, 
  Activity,
  Bell,
  Settings,
  User,
  Award,
  Phone,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Navigation
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { donorAPI, alertAPI, handleAPIError } from '../services/api';
import { toast } from 'react-hot-toast';

export default function DonorDashboard({ defaultTab = 'overview' }) {
  const { user } = useAuth();
  const { socket, isConnected, joinRoom } = useSocket();
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [alerts, setAlerts] = useState([]);
  const [donationHistory, setDonationHistory] = useState([]);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);

  // Real data loading from API
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setIsLoading(true);
        
        // Load all dashboard data in parallel
        const [
          profileResponse,
          alertsResponse,
          historyResponse
        ] = await Promise.all([
          donorAPI.getProfile(),
          donorAPI.getAlerts(),
          donorAPI.getDonationHistory()
        ]);

        // Set profile data
        if (profileResponse.data) {
          const donor = profileResponse.data;
          setProfile({
            fullName: donor.profile?.fullName || 'Unknown',
            bloodType: donor.profile?.bloodGroup || 'Unknown',
            lastDonation: donor.donationHistory?.lastDonationDate || null,
            totalDonations: donor.donationHistory?.totalDonations || 0,
            weight: donor.profile?.weight || 0,
            city: donor.profile?.address?.city || 'Unknown',
            emergencyContact: donor.profile?.emergencyContact?.phone || 'Not provided'
          });
        }

        // Set alerts data
        if (alertsResponse.data) {
          setAlerts(alertsResponse.data.map(alert => ({
            id: alert._id,
            hospitalName: alert.hospital?.profile?.name || 'Unknown Hospital',
            bloodType: alert.bloodType,
            urgency: alert.urgencyLevel,
            unitsNeeded: alert.unitsNeeded,
            distance: alert.distance ? `${alert.distance.toFixed(1)} km` : 'Unknown',
            patientAge: alert.patientAge,
            department: alert.department,
            createdAt: alert.createdAt,
            status: 'pending',
            estimatedTime: alert.estimatedTime || '15 mins',
            hospitalPhone: alert.contactInfo?.phone || ''
          })));
        }

        // Set donation history
        if (historyResponse.data) {
          setDonationHistory(historyResponse.data.map(donation => ({
            id: donation._id,
            hospitalName: donation.hospital?.profile?.name || 'Unknown Hospital',
            date: donation.donationDate,
            bloodType: donation.bloodType,
            unitsGiven: donation.unitsGiven || 1,
            purpose: donation.purpose || 'Blood donation',
            status: donation.status
          })));
        }

        // Mock notifications for now
        setNotifications([
          {
            id: 1,
            title: 'Welcome to BloodAlert!',
            message: 'Thank you for joining our life-saving community.',
            type: 'info',
            date: new Date().toISOString(),
            read: false
          }
        ]);

      } catch (error) {
        console.error('Failed to load dashboard data:', error);
        toast.error(handleAPIError(error));
        
        // Fallback to mock data if API fails
        setAlerts([
          {
            id: 1,
            hospitalName: 'City General Hospital',
            bloodType: 'O-',
            urgency: 'critical',
            unitsNeeded: 5,
            distance: '2.3 km',
            patientAge: 35,
            department: 'Emergency',
            createdAt: new Date().toISOString(),
            status: 'pending',
            estimatedTime: '15 mins',
            hospitalPhone: '+1234567890'
          }
        ]);

        setProfile({
          fullName: 'Donor User',
          bloodType: 'O+',
          lastDonation: null,
          totalDonations: 0,
          weight: 70,
          city: 'Unknown',
          emergencyContact: 'Not provided'
        });

        setDonationHistory([]);
        setNotifications([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  // Socket.io real-time updates
  useEffect(() => {
    if (socket && isConnected && user) {
      // Join donor room for real-time updates
      joinRoom(`donor_${user._id}`);
      joinRoom(`blood_type_${user.profile?.bloodGroup}`);

      // Listen for new alerts matching this donor's blood type
      socket.on('new_alert', (alert) => {
        if (alert.bloodType === user.profile?.bloodGroup) {
          setAlerts(prevAlerts => [alert, ...prevAlerts]);
          toast.success(`New ${alert.urgencyLevel} alert: ${alert.bloodType} needed!`);
        }
      });

      // Listen for alert status updates
      socket.on('alert_updated', (updatedAlert) => {
        setAlerts(prevAlerts => 
          prevAlerts.map(alert => 
            alert._id === updatedAlert._id ? updatedAlert : alert
          )
        );
      });

      // Listen for donation confirmation
      socket.on('donation_confirmed', (donation) => {
        setDonationHistory(prevHistory => [donation, ...prevHistory]);
        toast.success('Donation confirmed! Thank you for saving lives.');
      });

      return () => {
        socket.off('new_alert');
        socket.off('alert_updated');
        socket.off('donation_confirmed');
      };
    }
  }, [socket, isConnected, user, joinRoom]);

  const handleAlertResponse = async (alertId, response) => {
    try {
      // Call API to respond to alert
      const apiResponse = await donorAPI.respondToAlert(alertId, {
        response: response,
        timestamp: new Date().toISOString()
      });

      // Update local state
      setAlerts(alerts.map(alert => 
        alert.id === alertId 
          ? { ...alert, status: response }
          : alert
      ));
      
      if (response === 'accepted') {
        toast.success('Response sent! Hospital will contact you shortly.');
      } else {
        toast.info('Alert declined. Thank you for responding.');
      }
    } catch (error) {
      console.error('Failed to respond to alert:', error);
      toast.error(handleAPIError(error));
    }
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'critical': return 'text-red-600 bg-red-100 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-100 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-100 border-blue-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const canDonate = () => {
    if (!profile?.lastDonation) return true;
    const lastDonationDate = new Date(profile.lastDonation);
    const nextEligibleDate = new Date(lastDonationDate);
    nextEligibleDate.setDate(nextEligibleDate.getDate() + 56); // 8 weeks
    return new Date() >= nextEligibleDate;
  };

  const getDaysUntilEligible = () => {
    if (!profile?.lastDonation) return 0;
    const lastDonationDate = new Date(profile.lastDonation);
    const nextEligibleDate = new Date(lastDonationDate);
    nextEligibleDate.setDate(nextEligibleDate.getDate() + 56);
    const diffTime = nextEligibleDate - new Date();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Heart className="h-8 w-8 text-blood-600 mr-3" />
                Donor Dashboard
              </h1>
              <p className="text-gray-600 mt-1">
                Welcome, {profile?.fullName || 'Donor'}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-2xl font-bold text-blood-600">{profile?.bloodType}</div>
                <div className="text-sm text-gray-600">Blood Type</div>
              </div>
              <div className={`px-3 py-2 rounded-lg border ${
                canDonate() 
                  ? 'bg-green-100 text-green-800 border-green-200' 
                  : 'bg-yellow-100 text-yellow-800 border-yellow-200'
              }`}>
                {canDonate() ? 'Eligible to Donate' : `Eligible in ${getDaysUntilEligible()} days`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: Activity },
              { id: 'alerts', label: 'Blood Requests', icon: Bell },
              { id: 'history', label: 'Donation History', icon: Calendar },
              { id: 'profile', label: 'Profile', icon: User },
              { id: 'settings', label: 'Settings', icon: Settings },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`py-4 px-2 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === id
                    ? 'border-blood-500 text-blood-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="card">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blood-100 rounded-lg flex items-center justify-center">
                    <Heart className="h-6 w-6 text-blood-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Donations</p>
                    <p className="text-2xl font-bold text-gray-900">{profile?.totalDonations}</p>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Award className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Lives Saved</p>
                    <p className="text-2xl font-bold text-gray-900">{(profile?.totalDonations || 0) * 3}</p>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Bell className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Active Alerts</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {alerts.filter(alert => alert.status === 'pending').length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <Clock className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Days Since Last</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {profile?.lastDonation 
                        ? Math.floor((new Date() - new Date(profile.lastDonation)) / (1000 * 60 * 60 * 24))
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Blood Requests</h3>
                <div className="space-y-4">
                  {alerts.slice(0, 3).map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full mr-3 ${
                          alert.urgency === 'critical' ? 'bg-red-500' : 
                          alert.urgency === 'high' ? 'bg-orange-500' : 'bg-yellow-500'
                        }`}></div>
                        <div>
                          <p className="font-medium">{alert.hospitalName}</p>
                          <p className="text-sm text-gray-600">{alert.bloodType} - {alert.distance}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{alert.estimatedTime}</p>
                        <p className="text-xs text-gray-500">{alert.urgency}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Donations</h3>
                <div className="space-y-4">
                  {donationHistory.slice(0, 3).map((donation) => (
                    <div key={donation.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                        <div>
                          <p className="font-medium">{donation.hospitalName}</p>
                          <p className="text-sm text-gray-600">{donation.purpose}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{new Date(donation.date).toLocaleDateString()}</p>
                        <p className="text-xs text-gray-500">{donation.unitsGiven} unit</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Notifications */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Notifications</h3>
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <div key={notification.id} className={`p-4 rounded-lg border ${
                    notification.read ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{notification.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                      </div>
                      <span className="text-xs text-gray-500 ml-4">
                        {new Date(notification.date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Blood Requests Near You</h2>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <MapPin className="h-4 w-4" />
                <span>Showing requests within 50km</span>
              </div>
            </div>

            {alerts.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No active blood requests</h3>
                <p className="text-gray-600">You'll be notified when hospitals near you need your blood type.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {alerts.map((alert) => (
                  <div key={alert.id} className={`card border-l-4 ${getUrgencyColor(alert.urgency)}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-3">
                          <h3 className="text-xl font-bold text-gray-900 mr-4">
                            {alert.hospitalName}
                          </h3>
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getUrgencyColor(alert.urgency)}`}>
                            {alert.urgency.charAt(0).toUpperCase() + alert.urgency.slice(1)} Priority
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm mb-4">
                          <div>
                            <span className="text-gray-600">Blood Type:</span>
                            <span className="font-medium ml-2 text-blood-600">{alert.bloodType}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Units Needed:</span>
                            <span className="font-medium ml-2">{alert.unitsNeeded}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Distance:</span>
                            <span className="font-medium ml-2">{alert.distance}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Est. Time:</span>
                            <span className="font-medium ml-2">{alert.estimatedTime}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Patient Age:</span>
                            <span className="font-medium ml-2">{alert.patientAge} years</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Department:</span>
                            <span className="font-medium ml-2">{alert.department}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Posted:</span>
                            <span className="font-medium ml-2">
                              {new Date(alert.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="ml-6">
                        {alert.status === 'pending' && canDonate() && (
                          <div className="flex flex-col space-y-2">
                            <button
                              onClick={() => handleAlertResponse(alert.id, 'accepted')}
                              className="btn btn-primary flex items-center"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Accept
                            </button>
                            <button
                              onClick={() => handleAlertResponse(alert.id, 'declined')}
                              className="btn btn-secondary flex items-center"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Decline
                            </button>
                            <button className="btn btn-sm btn-outline flex items-center">
                              <Phone className="h-4 w-4 mr-1" />
                              Call Hospital
                            </button>
                          </div>
                        )}
                        
                        {alert.status === 'accepted' && (
                          <div className="text-center">
                            <div className="text-green-600 font-medium mb-2">✓ Accepted</div>
                            <button className="btn btn-sm btn-primary">
                              <Navigation className="h-4 w-4 mr-1" />
                              Get Directions
                            </button>
                          </div>
                        )}
                        
                        {alert.status === 'declined' && (
                          <div className="text-gray-500 font-medium">Declined</div>
                        )}

                        {!canDonate() && (
                          <div className="text-center">
                            <div className="text-yellow-600 font-medium text-sm">
                              Not eligible
                            </div>
                            <div className="text-xs text-gray-500">
                              {getDaysUntilEligible()} days remaining
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Donation History</h2>
              <div className="text-right">
                <div className="text-2xl font-bold text-blood-600">{profile?.totalDonations}</div>
                <div className="text-sm text-gray-600">Total Donations</div>
              </div>
            </div>

            <div className="card">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Date</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Hospital</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Blood Type</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Units</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Purpose</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {donationHistory.map((donation) => (
                      <tr key={donation.id} className="border-b border-gray-100">
                        <td className="py-3 px-4">{new Date(donation.date).toLocaleDateString()}</td>
                        <td className="py-3 px-4 font-medium">{donation.hospitalName}</td>
                        <td className="py-3 px-4">
                          <span className="text-blood-600 font-medium">{donation.bloodType}</span>
                        </td>
                        <td className="py-3 px-4">{donation.unitsGiven}</td>
                        <td className="py-3 px-4">{donation.purpose}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                            {donation.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Achievement Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="card text-center">
                <Award className="h-12 w-12 text-gold-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-900">Life Saver</h3>
                <p className="text-sm text-gray-600">Donated 10+ times</p>
              </div>
              
              <div className="card text-center">
                <Heart className="h-12 w-12 text-blood-600 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-900">Hero</h3>
                <p className="text-sm text-gray-600">Emergency response donor</p>
              </div>
              
              <div className="card text-center">
                <Calendar className="h-12 w-12 text-blue-600 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-900">Regular Donor</h3>
                <p className="text-sm text-gray-600">Consistent donation schedule</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Donor Profile</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Full Name:</span>
                    <span className="font-medium">{profile?.fullName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Blood Type:</span>
                    <span className="font-medium text-blood-600">{profile?.bloodType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Weight:</span>
                    <span className="font-medium">{profile?.weight} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">City:</span>
                    <span className="font-medium">{profile?.city}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Emergency Contact:</span>
                    <span className="font-medium">{profile?.emergencyContact}</span>
                  </div>
                </div>
                <button className="btn btn-secondary mt-4 w-full">
                  Update Profile
                </button>
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Donation Status</h3>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Donation:</span>
                    <span className="font-medium">{new Date(profile?.lastDonation).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Donations:</span>
                    <span className="font-medium">{profile?.totalDonations}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Donation Eligibility:</span>
                    <span className={`font-medium ${canDonate() ? 'text-green-600' : 'text-yellow-600'}`}>
                      {canDonate() ? 'Eligible Now' : `Eligible in ${getDaysUntilEligible()} days`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Lives Saved:</span>
                    <span className="font-medium text-green-600">{(profile?.totalDonations || 0) * 3}</span>
                  </div>
                </div>
                
                {!canDonate() && (
                  <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-sm text-yellow-800">
                      You'll be eligible to donate again on {new Date(profile?.eligibleToDonateSince).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Preferences</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Email Alerts</span>
                    <input type="checkbox" className="toggle" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">SMS Alerts</span>
                    <input type="checkbox" className="toggle" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Push Notifications</span>
                    <input type="checkbox" className="toggle" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Critical Alerts Only</span>
                    <input type="checkbox" className="toggle" />
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Availability Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Maximum Travel Distance (km)
                    </label>
                    <input type="range" min="5" max="100" defaultValue="50" className="w-full" />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>5km</span>
                      <span>50km</span>
                      <span>100km</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Preferred Days
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                        <label key={day} className="flex items-center">
                          <input type="checkbox" className="mr-2" defaultChecked={!['Saturday', 'Sunday'].includes(day)} />
                          <span className="text-sm">{day}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
