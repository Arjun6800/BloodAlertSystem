import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  User, 
  LogOut, 
  Bell, 
  Heart, 
  Activity,
  Menu,
  X 
} from 'lucide-react';
import { useState } from 'react';

const Navbar = () => {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navItems = [
    {
      name: 'Dashboard',
      path: hasRole('donor') ? '/donor/dashboard' : '/hospital/dashboard',
      show: !!user
    },
    {
      name: 'Alerts',
      path: hasRole('donor') ? '/donor/alerts' : '/hospital/alerts',
      show: !!user
    },
    {
      name: 'Profile',
      path: hasRole('donor') ? '/donor/profile' : '/hospital/profile',
      show: !!user
    },
    {
      name: 'Inventory',
      path: '/hospital/inventory',
      show: hasRole('hospital') || hasRole('blood_bank')
    },
    {
      name: 'Analytics',
      path: '/hospital/analytics',
      show: hasRole('hospital') || hasRole('blood_bank')
    }
  ];

  return (
    <nav className="bg-white shadow-lg border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and brand */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <div className="flex items-center">
                <Heart className="h-8 w-8 text-blood-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">
                  BloodAlert
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {user ? (
              <>
                {navItems
                  .filter(item => item.show)
                  .map((item) => (
                    <Link
                      key={item.name}
                      to={item.path}
                      className="text-gray-700 hover:text-blood-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      {item.name}
                    </Link>
                  ))}
                
                <div className="flex items-center space-x-4">
                  <button className="relative p-2 text-gray-400 hover:text-gray-500">
                    <Bell className="h-6 w-6" />
                    {/* Notification badge */}
                    <span className="absolute top-0 right-0 block h-2 w-2 bg-red-400 rounded-full"></span>
                  </button>
                  
                  <div className="flex items-center space-x-2">
                    <User className="h-5 w-5 text-gray-400" />
                    <span className="text-sm text-gray-700">{user.email}</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blood-100 text-blood-800">
                      {user.role}
                    </span>
                  </div>
                  
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-1 text-gray-700 hover:text-red-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  to="/login"
                  className="text-gray-700 hover:text-blood-600 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="btn btn-primary"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
            >
              {isMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {user ? (
                <>
                  {navItems
                    .filter(item => item.show)
                    .map((item) => (
                      <Link
                        key={item.name}
                        to={item.path}
                        className="text-gray-700 hover:text-blood-600 block px-3 py-2 rounded-md text-base font-medium"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        {item.name}
                      </Link>
                    ))}
                  
                  <div className="border-t border-gray-200 pt-4 pb-3">
                    <div className="flex items-center px-3">
                      <User className="h-5 w-5 text-gray-400 mr-2" />
                      <div>
                        <div className="text-base font-medium text-gray-800">{user.email}</div>
                        <div className="text-sm text-gray-500">{user.role}</div>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1">
                      <button
                        onClick={handleLogout}
                        className="flex items-center space-x-2 text-gray-700 hover:text-red-600 block px-3 py-2 rounded-md text-base font-medium w-full text-left"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Sign out</span>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-gray-700 hover:text-blood-600 block px-3 py-2 rounded-md text-base font-medium"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    className="text-gray-700 hover:text-blood-600 block px-3 py-2 rounded-md text-base font-medium"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
