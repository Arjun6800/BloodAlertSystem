import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { 
  Heart, 
  Plus, 
  Droplets, 
  Users, 
  AlertTriangle, 
  Clock, 
  Activity,
  Bell,
  Settings,
  Calendar,
  PhoneCall,
  TrendingUp,
  MapPin
} from 'lucide-react';
import LoadingSpinner, { ButtonLoader } from '../components/LoadingSpinner';
import { hospitalAPI, alertAPI, inventoryAPI, donorAPI, handleAPIError } from '../services/api';
import toast from 'react-hot-toast';

const HospitalDashboard = ({ defaultTab = 'overview' }) => {
  const { user } = useAuth();
  const { socket, isConnected, joinRoom, emitEvent } = useSocket();
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [inventory, setInventory] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [donors, setDonors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateAlert, setShowCreateAlert] = useState(false);

  // Real data loading from API
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setIsLoading(true);
        
        // Load all dashboard data in parallel
        const [
          inventoryResponse,
          alertsResponse,
          donorsResponse,
          dashboardResponse
        ] = await Promise.all([
          inventoryAPI.getInventory(),
          alertAPI.getAlerts({ status: 'active' }),
          donorAPI.getProfile(), // This will need to be updated to get nearby donors
          hospitalAPI.getDashboard()
        ]);

        // Set inventory data
        if (inventoryResponse.data) {
          const inventoryData = {};
          inventoryResponse.data.forEach(item => {
            inventoryData[item.bloodType] = {
              current: item.currentStock,
              minimum: item.minimumThreshold,
              critical: item.criticalThreshold
            };
          });
          setInventory(inventoryData);
        }

        // Set alerts data
        if (alertsResponse.data) {
          setAlerts(alertsResponse.data.map(alert => ({
            id: alert._id,
            bloodType: alert.bloodType,
            urgency: alert.urgencyLevel,
            unitsNeeded: alert.unitsNeeded,
            patientAge: alert.patientAge,
            department: alert.department,
            createdAt: alert.createdAt,
            status: alert.status,
            responses: alert.responses?.length || 0
          })));
        }

        // Set nearby donors (this would need a separate endpoint)
        // For now, using mock data until the nearby donors endpoint is implemented
        setDonors([
          {
            id: 1,
            name: 'John Doe',
            bloodType: 'O-',
            distance: '2.3 km',
            lastDonation: '2024-11-15',
            status: 'available',
            phone: '+1234567890'
          },
          {
            id: 2,
            name: 'Jane Smith',
            bloodType: 'A+',
            distance: '4.1 km',
            lastDonation: '2024-10-20',
            status: 'responding',
            phone: '+1234567891'
          }
        ]);

      } catch (error) {
        console.error('Failed to load dashboard data:', error);
        toast.error(handleAPIError(error));
        
        // Fallback to mock data if API fails
        setInventory({
          'A+': { current: 12, minimum: 20, critical: 5 },
          'A-': { current: 3, minimum: 15, critical: 3 },
          'B+': { current: 18, minimum: 20, critical: 5 },
          'B-': { current: 2, minimum: 10, critical: 3 },
          'AB+': { current: 8, minimum: 10, critical: 3 },
          'AB-': { current: 1, minimum: 5, critical: 2 },
          'O+': { current: 25, minimum: 30, critical: 8 },
          'O-': { current: 4, minimum: 25, critical: 8 },
        });

        setAlerts([
          {
            id: 1,
            bloodType: 'O-',
            urgency: 'critical',
            unitsNeeded: 5,
            patientAge: 35,
            department: 'Emergency',
            createdAt: new Date().toISOString(),
            status: 'active',
            responses: 12
          },
          {
            id: 2,
            bloodType: 'A+',
            urgency: 'high',
            unitsNeeded: 3,
            patientAge: 28,
            department: 'Surgery',
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            status: 'active',
            responses: 8
          }
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  // Socket.io real-time updates
  useEffect(() => {
    if (socket && isConnected && user) {
      // Join hospital room for real-time updates
      joinRoom(`hospital_${user._id}`);
      joinRoom('all_hospitals');

      // Listen for alert responses from donors
      socket.on('alert_response', (response) => {
        setAlerts(prevAlerts => 
          prevAlerts.map(alert => 
            alert._id === response.alertId 
              ? { ...alert, responses: (alert.responses || 0) + 1 }
              : alert
          )
        );
        toast.success(`Donor responded to ${response.bloodType} alert!`);
      });

      // Listen for inventory updates from other hospitals
      socket.on('inventory_updated', (update) => {
        if (update.hospitalId === user._id) {
          setInventory(prevInventory => ({
            ...prevInventory,
            [update.bloodType]: {
              ...prevInventory[update.bloodType],
              current: update.quantity
            }
          }));
        }
      });

      // Listen for new donor registrations
      socket.on('new_donor_registered', (donor) => {
        if (donor.profile?.address?.city === user.profile?.address?.city) {
          setDonors(prevDonors => [donor, ...prevDonors]);
          toast.info(`New ${donor.profile?.bloodGroup} donor registered nearby!`);
        }
      });

      return () => {
        socket.off('alert_response');
        socket.off('inventory_updated');
        socket.off('new_donor_registered');
      };
    }
  }, [socket, isConnected, user, joinRoom]);

  const getInventoryStatus = (bloodType) => {
    const data = inventory[bloodType];
    if (!data) return 'unknown';
    
    if (data.current <= data.critical) return 'critical';
    if (data.current <= data.minimum) return 'low';
    return 'normal';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'low': return 'text-yellow-600 bg-yellow-100';
      case 'normal': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
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

  const CreateAlertForm = () => {
    const [formData, setFormData] = useState({
      bloodType: '',
      unitsNeeded: '',
      urgency: '',
      patientAge: '',
      department: '',
      description: ''
    });

    const handleSubmit = async (e) => {
      e.preventDefault();
      try {
        // Create alert using real API
        const alertData = {
          bloodType: formData.bloodType,
          unitsNeeded: parseInt(formData.unitsNeeded),
          urgencyLevel: formData.urgency,
          patientAge: formData.patientAge ? parseInt(formData.patientAge) : undefined,
          department: formData.department,
          description: formData.description,
          contactInfo: {
            phone: user?.profile?.contactInfo?.phone || '',
            email: user?.profile?.contactInfo?.email || user?.email || ''
          }
        };

        await alertAPI.createAlert(alertData);
        
        // Emit real-time event for new alert
        if (socket && isConnected) {
          emitEvent('new_alert_created', {
            ...alertData,
            hospitalId: user._id,
            hospitalName: user.profile?.name || 'Unknown Hospital'
          });
        }
        
        toast.success('Blood alert created successfully!');
        setShowCreateAlert(false);
        
        // Reload alerts data
        const alertsResponse = await alertAPI.getAlerts({ status: 'active' });
        if (alertsResponse.data) {
          setAlerts(alertsResponse.data.map(alert => ({
            id: alert._id,
            bloodType: alert.bloodType,
            urgency: alert.urgencyLevel,
            unitsNeeded: alert.unitsNeeded,
            patientAge: alert.patientAge,
            department: alert.department,
            createdAt: alert.createdAt,
            status: alert.status,
            responses: alert.responses?.length || 0
          })));
        }
      } catch (error) {
        console.error('Failed to create alert:', error);
        toast.error(handleAPIError(error));
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <h3 className="text-lg font-semibold mb-4">Create Blood Alert</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Blood Type *
              </label>
              <select
                className="input-field"
                value={formData.bloodType}
                onChange={(e) => setFormData({...formData, bloodType: e.target.value})}
                required
              >
                <option value="">Select blood type</option>
                {Object.keys(inventory).map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Units Needed *
              </label>
              <input
                type="number"
                min="1"
                className="input-field"
                value={formData.unitsNeeded}
                onChange={(e) => setFormData({...formData, unitsNeeded: e.target.value})}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Urgency Level *
              </label>
              <select
                className="input-field"
                value={formData.urgency}
                onChange={(e) => setFormData({...formData, urgency: e.target.value})}
                required
              >
                <option value="">Select urgency</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Patient Age
              </label>
              <input
                type="number"
                min="0"
                max="120"
                className="input-field"
                value={formData.patientAge}
                onChange={(e) => setFormData({...formData, patientAge: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <input
                type="text"
                className="input-field"
                value={formData.department}
                onChange={(e) => setFormData({...formData, department: e.target.value})}
                placeholder="e.g., Emergency, Surgery"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                className="input-field"
                rows="3"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Additional details about the blood requirement"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowCreateAlert(false)}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary flex-1"
              >
                Create Alert
              </button>
            </div>
          </form>
        </div>
      </div>
    );
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
                Hospital Dashboard
              </h1>
              <p className="text-gray-600 mt-1">
                Welcome, {user?.profile?.name || 'Hospital Admin'}
              </p>
            </div>
            <button
              onClick={() => setShowCreateAlert(true)}
              className="btn btn-primary flex items-center"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create Blood Alert
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: Activity },
              { id: 'inventory', label: 'Blood Inventory', icon: Droplets },
              { id: 'alerts', label: 'Active Alerts', icon: Bell },
              { id: 'donors', label: 'Nearby Donors', icon: Users },
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
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Droplets className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Units</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {Object.values(inventory).reduce((acc, item) => acc + item.current, 0)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Critical Alerts</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {alerts.filter(alert => alert.urgency === 'critical').length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Users className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Available Donors</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {donors.filter(donor => donor.status === 'available').length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Response Rate</p>
                    <p className="text-2xl font-bold text-gray-900">85%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Alerts</h3>
                <div className="space-y-4">
                  {alerts.slice(0, 3).map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full mr-3 ${
                          alert.urgency === 'critical' ? 'bg-red-500' : 'bg-orange-500'
                        }`}></div>
                        <div>
                          <p className="font-medium">{alert.bloodType} - {alert.unitsNeeded} units</p>
                          <p className="text-sm text-gray-600">{alert.department}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{alert.responses} responses</p>
                        <p className="text-xs text-gray-500">
                          {new Date(alert.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Blood Inventory Status</h3>
                <div className="space-y-3">
                  {Object.entries(inventory).slice(0, 4).map(([bloodType, data]) => {
                    const status = getInventoryStatus(bloodType);
                    return (
                      <div key={bloodType} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <span className="font-medium text-gray-900 w-8">{bloodType}</span>
                          <div className="ml-4 flex-1">
                            <div className="w-24 h-2 bg-gray-200 rounded-full">
                              <div
                                className={`h-2 rounded-full ${
                                  status === 'critical' ? 'bg-red-500' :
                                  status === 'low' ? 'bg-yellow-500' : 'bg-green-500'
                                }`}
                                style={{ width: `${Math.min((data.current / data.minimum) * 100, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-medium">{data.current}</span>
                          <span className="text-sm text-gray-500">/{data.minimum}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Blood Inventory</h2>
              <button className="btn btn-secondary">
                Update Inventory
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {Object.entries(inventory).map(([bloodType, data]) => {
                const status = getInventoryStatus(bloodType);
                return (
                  <div key={bloodType} className="card">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-gray-900">{bloodType}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </span>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Current Stock:</span>
                        <span className="font-medium">{data.current} units</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Minimum Level:</span>
                        <span className="text-gray-700">{data.minimum} units</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Critical Level:</span>
                        <span className="text-red-600">{data.critical} units</span>
                      </div>
                      
                      <div className="mt-4">
                        <div className="w-full h-3 bg-gray-200 rounded-full">
                          <div
                            className={`h-3 rounded-full ${
                              status === 'critical' ? 'bg-red-500' :
                              status === 'low' ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min((data.current / data.minimum) * 100, 100)}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {Math.round((data.current / data.minimum) * 100)}% of minimum level
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Active Blood Alerts</h2>
              <button
                onClick={() => setShowCreateAlert(true)}
                className="btn btn-primary"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Alert
              </button>
            </div>

            <div className="space-y-4">
              {alerts.map((alert) => (
                <div key={alert.id} className={`card border-l-4 ${getUrgencyColor(alert.urgency)}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <span className="text-2xl font-bold text-gray-900 mr-4">
                          {alert.bloodType}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getUrgencyColor(alert.urgency)}`}>
                          {alert.urgency.charAt(0).toUpperCase() + alert.urgency.slice(1)} Priority
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Units Needed:</span>
                          <span className="font-medium ml-2">{alert.unitsNeeded}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Patient Age:</span>
                          <span className="font-medium ml-2">{alert.patientAge} years</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Department:</span>
                          <span className="font-medium ml-2">{alert.department}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Created:</span>
                          <span className="font-medium ml-2">
                            {new Date(alert.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right ml-6">
                      <div className="text-2xl font-bold text-green-600">{alert.responses}</div>
                      <div className="text-sm text-gray-600">Responses</div>
                      <button className="btn btn-sm btn-primary mt-2">
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'donors' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Nearby Donors</h2>
              <button className="btn btn-secondary">
                <MapPin className="h-4 w-4 mr-2" />
                View on Map
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {donors.map((donor) => (
                <div key={donor.id} className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">{donor.name}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      donor.status === 'available' ? 'bg-green-100 text-green-800' :
                      donor.status === 'responding' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {donor.status}
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Blood Type:</span>
                      <span className="font-medium text-blood-600">{donor.bloodType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Distance:</span>
                      <span className="font-medium">{donor.distance}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Last Donation:</span>
                      <span className="font-medium">{new Date(donor.lastDonation).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex gap-2">
                    <button className="btn btn-sm btn-primary flex-1">
                      <PhoneCall className="h-4 w-4 mr-1" />
                      Call
                    </button>
                    <button className="btn btn-sm btn-secondary flex-1">
                      Send Alert
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Hospital Settings</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Alert Preferences</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Email Notifications</span>
                    <input type="checkbox" className="toggle" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">SMS Notifications</span>
                    <input type="checkbox" className="toggle" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Auto-create alerts when inventory is low</span>
                    <input type="checkbox" className="toggle" />
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventory Thresholds</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Critical Level Alert (units)
                    </label>
                    <input type="number" className="input-field" defaultValue="5" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Low Level Alert (units)
                    </label>
                    <input type="number" className="input-field" defaultValue="20" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Donor Search Radius (km)
                    </label>
                    <input type="number" className="input-field" defaultValue="50" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Alert Modal */}
      {showCreateAlert && <CreateAlertForm />}
    </div>
  );
};

export default HospitalDashboard;
