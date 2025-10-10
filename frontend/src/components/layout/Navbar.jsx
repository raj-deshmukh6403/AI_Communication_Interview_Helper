import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Video, LayoutDashboard, PlusCircle, User, LogOut, Menu, X } from 'lucide-react';
import { useAuthContext } from '../../context/AuthContext';
import { getInitials } from '../../utils/helpers';

/**
 * Navigation Bar Component
 */
const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuthContext();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Navigation links for authenticated users
  const navLinks = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/new-session', label: 'New Session', icon: PlusCircle },
  ];

  return (
    <nav className="bg-white shadow-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <Video className="text-primary-600" size={32} />
              <span className="text-xl font-bold text-gray-900">AI Interview Coach</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                {/* Nav Links */}
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      className={`flex items-center space-x-1 px-3 py-2 rounded-lg transition-colors ${
                        isActive(link.path)
                          ? 'bg-primary-50 text-primary-600'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Icon size={18} />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}

                {/* User Menu */}
                <div className="relative group">
                  <button className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100">
                    <div className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center font-medium">
                      {getInitials(user?.full_name)}
                    </div>
                    <span className="text-gray-700">{user?.full_name?.split(' ')[0]}</span>
                  </button>

                  {/* Dropdown */}
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 hidden group-hover:block">
                    <Link
                      to="/profile"
                      className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100"
                    >
                      <User size={18} />
                      <span>Profile</span>
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex items-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 w-full text-left"
                    >
                      <LogOut size={18} />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-gray-700 hover:text-primary-600 px-3 py-2"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-gray-700 hover:text-primary-600"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200">
          <div className="px-4 py-4 space-y-2">
            {isAuthenticated ? (
              <>
                {/* User Info */}
                <div className="flex items-center space-x-3 pb-4 border-b border-gray-200">
                  <div className="w-10 h-10 rounded-full bg-primary-600 text-white flex items-center justify-center font-medium">
                    {getInitials(user?.full_name)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{user?.full_name}</p>
                    <p className="text-sm text-gray-500">{user?.email}</p>
                  </div>
                </div>

                {/* Nav Links */}
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
                        isActive(link.path)
                          ? 'bg-primary-50 text-primary-600'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Icon size={20} />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}

                <Link
                  to="/profile"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100"
                >
                  <User size={20} />
                  <span>Profile</span>
                </Link>

                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 w-full text-left"
                >
                  <LogOut size={20} />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 text-center"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;