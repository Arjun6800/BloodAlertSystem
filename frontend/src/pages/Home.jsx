import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Heart, Users, Building2, MapPin, Clock, Shield, Phone, Droplets } from 'lucide-react';

const Home = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blood-50 to-red-100 py-20">
        <div className="container mx-auto px-4 text-center">
          <div className="flex justify-center mb-6">
            <Heart className="h-16 w-16 text-blood-600 blood-drop" />
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Blood<span className="text-blood-600">Alert</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Real-time blood shortage alerts connecting donors with hospitals in emergency situations. 
            Join our life-saving community and help save lives through timely blood donations.
          </p>
          
          {!user ? (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="btn btn-primary text-lg px-8 py-3"
              >
                Join as Donor
              </Link>
              <Link
                to="/register"
                className="btn btn-secondary text-lg px-8 py-3"
              >
                Register Hospital
              </Link>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-lg text-gray-700 mb-4">
                Welcome back, {user.profile?.fullName || user.profile?.name || user.email}!
              </p>
              <Link
                to={user.role === 'donor' ? '/donor/dashboard' : '/hospital/dashboard'}
                className="btn btn-primary text-lg px-8 py-3"
              >
                Go to Dashboard
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              How BloodAlert Works
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Our platform connects blood banks, hospitals, and donors in real-time to ensure 
              blood is available when and where it's needed most.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-blood-100 rounded-full flex items-center justify-center">
                  <Building2 className="h-8 w-8 text-blood-600" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Hospitals Alert
              </h3>
              <p className="text-gray-600">
                Hospitals and blood banks post real-time alerts when blood supplies run low, 
                specifying blood type and urgency level.
              </p>
            </div>

            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-blood-100 rounded-full flex items-center justify-center">
                  <MapPin className="h-8 w-8 text-blood-600" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Smart Matching
              </h3>
              <p className="text-gray-600">
                Our system automatically matches compatible donors within the specified radius 
                and sends instant notifications via SMS and email.
              </p>
            </div>

            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-blood-100 rounded-full flex items-center justify-center">
                  <Users className="h-8 w-8 text-blood-600" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Donors Respond
              </h3>
              <p className="text-gray-600">
                Eligible donors receive alerts and can quickly respond to confirm their availability, 
                helping coordinate timely blood donations.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Key Features */}
      <div className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Key Features
            </h2>
            <p className="text-lg text-gray-600">
              Advanced features designed for emergency blood donation coordination
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="card text-center">
              <Clock className="h-8 w-8 text-blood-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Real-time Alerts</h3>
              <p className="text-sm text-gray-600">
                Instant notifications for emergency blood requests
              </p>
            </div>

            <div className="card text-center">
              <MapPin className="h-8 w-8 text-blood-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Location-based</h3>
              <p className="text-sm text-gray-600">
                Find donors and hospitals within specified radius
              </p>
            </div>

            <div className="card text-center">
              <Droplets className="h-8 w-8 text-blood-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Blood Compatibility</h3>
              <p className="text-sm text-gray-600">
                Automatic matching based on blood type compatibility
              </p>
            </div>

            <div className="card text-center">
              <Phone className="h-8 w-8 text-blood-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Multi-channel Alerts</h3>
              <p className="text-sm text-gray-600">
                SMS, email, and push notifications for urgent requests
              </p>
            </div>

            <div className="card text-center">
              <Users className="h-8 w-8 text-blood-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Donor Network</h3>
              <p className="text-sm text-gray-600">
                Large network of verified and eligible blood donors
              </p>
            </div>

            <div className="card text-center">
              <Shield className="h-8 w-8 text-blood-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Secure Platform</h3>
              <p className="text-sm text-gray-600">
                HIPAA compliant with verified user authentication
              </p>
            </div>

            <div className="card text-center">
              <Building2 className="h-8 w-8 text-blood-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Hospital Dashboard</h3>
              <p className="text-sm text-gray-600">
                Comprehensive inventory and alert management tools
              </p>
            </div>

            <div className="card text-center">
              <Heart className="h-8 w-8 text-blood-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Impact Tracking</h3>
              <p className="text-sm text-gray-600">
                Track your contribution and lives saved through donations
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Section */}
      <div className="py-20 bg-blood-600 text-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Making a Difference Together
            </h2>
            <p className="text-lg text-blood-100">
              Join thousands of donors and healthcare facilities saving lives
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">10,000+</div>
              <div className="text-blood-100">Registered Donors</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">500+</div>
              <div className="text-blood-100">Partner Hospitals</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">50,000+</div>
              <div className="text-blood-100">Lives Saved</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">24/7</div>
              <div className="text-blood-100">Emergency Response</div>
            </div>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="py-20 bg-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Ready to Save Lives?
          </h2>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Join BloodAlert today and become part of a community dedicated to ensuring 
            blood is available for those who need it most.
          </p>
          
          {!user && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="btn btn-primary text-lg px-8 py-3"
              >
                Get Started
              </Link>
              <Link
                to="/login"
                className="btn btn-secondary text-lg px-8 py-3"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
