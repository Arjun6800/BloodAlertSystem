import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  profile: () => api.get('/auth/profile'),
  changePassword: (passwords) => api.put('/auth/change-password', passwords),
  refreshToken: () => api.post('/auth/refresh-token'),
  logout: () => api.post('/auth/logout'),
};

// Donor API
export const donorAPI = {
  createProfile: (profileData) => api.post('/donors/profile', profileData),
  getProfile: () => api.get('/donors/profile'),
  updateProfile: (profileData) => api.put('/donors/profile', profileData),
  getEligibility: () => api.get('/donors/eligibility'),
  getAlerts: () => api.get('/donors/alerts'),
  respondToAlert: (alertId, response) => api.post(`/donors/alerts/${alertId}/respond`, response),
  getDonationHistory: () => api.get('/donors/donations'),
  updatePreferences: (preferences) => api.put('/donors/preferences', preferences),
};

// Hospital API
export const hospitalAPI = {
  createProfile: (profileData) => api.post('/hospitals/profile', profileData),
  getProfile: () => api.get('/hospitals/profile'),
  updateProfile: (profileData) => api.put('/hospitals/profile', profileData),
  getDashboard: () => api.get('/hospitals/dashboard'),
  updateInventory: (bloodType, inventoryData) => api.put(`/hospitals/inventory/${bloodType}`, inventoryData),
  getNearbyHospitals: (params) => api.get('/hospitals/nearby', { params }),
  createPartnership: (partnershipData) => api.post('/hospitals/partnerships', partnershipData),
  getAnalytics: (params) => api.get('/hospitals/analytics', { params }),
};

// Alert API
export const alertAPI = {
  createAlert: (alertData) => api.post('/alerts', alertData),
  getAlerts: (params) => api.get('/alerts', { params }),
  getAlert: (alertId) => api.get(`/alerts/${alertId}`),
  updateAlertStatus: (alertId, statusData) => api.put(`/alerts/${alertId}/status`, statusData),
  extendAlert: (alertId, hours) => api.put(`/alerts/${alertId}/extend`, { hours }),
  shareAlert: (alertId, shareData) => api.post(`/alerts/${alertId}/share`, shareData),
  respondToSharedAlert: (alertId, response) => api.post(`/alerts/${alertId}/respond-share`, response),
  getSharedAlerts: (params) => api.get('/alerts/shared/received', { params }),
};

// Inventory API
export const inventoryAPI = {
  getInventory: () => api.get('/inventory'),
  updateBloodType: (bloodType, data) => api.put(`/inventory/${bloodType}`, data),
  bulkUpdate: (updates) => api.put('/inventory', { updates }),
  getHistory: (bloodType, params) => api.get(`/inventory/history/${bloodType}`, { params }),
  updateComponents: (componentData) => api.put('/inventory/components', componentData),
  getCriticalShortages: (params) => api.get('/inventory/critical/global', { params }),
};

// Notification API
export const notificationAPI = {
  getPreferences: () => api.get('/notifications/preferences'),
  updatePreferences: (preferences) => api.put('/notifications/preferences', preferences),
  getHistory: (params) => api.get('/notifications/history', { params }),
  markAsRead: (notificationId) => api.put(`/notifications/${notificationId}/read`),
  testNotification: (testData) => api.post('/notifications/test', testData),
  getStats: () => api.get('/notifications/stats'),
};

// Utility functions
export const handleAPIError = (error) => {
  if (error.response) {
    // Server responded with error status
    return error.response.data.message || 'An error occurred';
  } else if (error.request) {
    // Request made but no response received
    return 'Network error. Please check your connection.';
  } else {
    // Something else happened
    return error.message || 'An unexpected error occurred';
  }
};

export default api;
