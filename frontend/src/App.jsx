import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import DonorSetup from './pages/DonorSetup';
import HospitalSetup from './pages/HospitalSetup';
import DonorDashboard from './pages/DonorDashboard';
import HospitalDashboard from './pages/HospitalDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SocketProvider>
          <Router>
          <div className="min-h-screen bg-gray-50">
            <Navbar />
            <main>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route
                  path="/donor/setup"
                  element={
                    <ProtectedRoute allowedRoles={['donor']}>
                      <DonorSetup />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/hospital/setup"
                  element={
                    <ProtectedRoute allowedRoles={['hospital', 'blood_bank']}>
                      <HospitalSetup />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/donor/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['donor']}>
                      <DonorDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/donor/alerts"
                  element={
                    <ProtectedRoute allowedRoles={['donor']}>
                      <DonorDashboard defaultTab="alerts" />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/donor/history"
                  element={
                    <ProtectedRoute allowedRoles={['donor']}>
                      <DonorDashboard defaultTab="history" />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/donor/profile"
                  element={
                    <ProtectedRoute allowedRoles={['donor']}>
                      <DonorDashboard defaultTab="profile" />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/hospital/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['hospital', 'blood_bank', 'admin']}>
                      <HospitalDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/hospital/inventory"
                  element={
                    <ProtectedRoute allowedRoles={['hospital', 'blood_bank', 'admin']}>
                      <HospitalDashboard defaultTab="inventory" />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/hospital/alerts"
                  element={
                    <ProtectedRoute allowedRoles={['hospital', 'blood_bank', 'admin']}>
                      <HospitalDashboard defaultTab="alerts" />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/hospital/donors"
                  element={
                    <ProtectedRoute allowedRoles={['hospital', 'blood_bank', 'admin']}>
                      <HospitalDashboard defaultTab="donors" />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/hospital/settings"
                  element={
                    <ProtectedRoute allowedRoles={['hospital', 'blood_bank', 'admin']}>
                      <HospitalDashboard defaultTab="settings" />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <div className="container mx-auto px-4 py-8">
                        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                        <p className="mt-4 text-gray-600">Welcome to BloodAlert Dashboard</p>
                      </div>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </main>
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
              }}
            />
          </div>
        </Router>
        </SocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
