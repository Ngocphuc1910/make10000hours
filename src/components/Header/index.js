import React, { useState, useEffect, useRef } from 'react';
import { Settings, User, LogOut } from 'lucide-react';
import LoginModal from '../LoginModal';
import SignupModal from '../SignupModal';
import { useAuth } from '../../hooks/useAuth';
import { ThemeToggle } from '../ThemeToggle';

// Always show login button in production
const FORCE_SHOW_LOGIN = false;

function Header() {
  const { currentUser, userProfile, signOut } = useAuth();
  
  // State for showing modals
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [forceShowLogin] = useState(FORCE_SHOW_LOGIN);
  const [error, setError] = useState(null);
  
  // Refs for dropdown
  const dropdownRef = useRef(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    
    // Add the event listener for mousedown (captures clicks)
    document.addEventListener('mousedown', handleClickOutside);
    
    // Also handle escape key to close dropdown
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        setShowDropdown(false);
      }
    };
    
    document.addEventListener('keydown', handleEscKey);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscKey);
    };
  }, []);
  
  // Debugging info about the current environment
  useEffect(() => {
    try {
      console.log("=== HEADER DEBUGGING INFO ===");
      console.log("Current hostname:", window.location.hostname);
      console.log("Current pathname:", window.location.pathname);
      console.log("Auth state - currentUser:", currentUser);
      console.log("Auth state - userProfile:", userProfile);
      console.log("Force show login:", forceShowLogin);
      console.log("Environment:", process.env.NODE_ENV);
      console.log("PUBLIC_URL:", process.env.PUBLIC_URL);
    } catch (err) {
      console.error("Error in header debug:", err);
      setError(err.message);
    }
  }, [currentUser, userProfile, forceShowLogin]);
  
  // Toggle user dropdown
  const toggleDropdown = () => {
    setShowDropdown(prev => !prev);
  };
  
  // Handle sign out
  const handleSignOut = async (e) => {
    // Prevent event bubbling
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    try {
      console.log("Sign out initiated - closing dropdown first");
      // Close dropdown first to provide immediate UI feedback
      setShowDropdown(false);
      
      console.log("Calling signOut function");
      await signOut();
      console.log("User signed out successfully");
    } catch (err) {
      console.error("Error signing out:", err);
      setError(err.message);
    }
  };
  
  // Modal handlers
  const handleOpenLoginModal = () => {
    try {
      setShowLoginModal(true);
      setShowSignupModal(false);
    } catch (err) {
      console.error("Error opening login modal:", err);
      setError(err.message);
    }
  };
  
  const handleCloseLoginModal = () => {
    try {
      setShowLoginModal(false);
    } catch (err) {
      console.error("Error closing login modal:", err);
      setError(err.message);
    }
  };
  
  const handleCloseSignupModal = () => {
    try {
      setShowSignupModal(false);
    } catch (err) {
      console.error("Error closing signup modal:", err);
      setError(err.message);
    }
  };
  
  const handleSwitchToSignup = () => {
    try {
      setShowLoginModal(false);
      setShowSignupModal(true);
    } catch (err) {
      console.error("Error switching to signup:", err);
      setError(err.message);
    }
  };
  
  const handleSwitchToLogin = () => {
    try {
      setShowSignupModal(false);
      setShowLoginModal(true);
    } catch (err) {
      console.error("Error switching to login:", err);
      setError(err.message);
    }
  };

  // Generate initials for avatar
  const getInitials = (user) => {
    if (!user) return "?";
    
    if (userProfile?.full_name) {
      return userProfile.full_name
        .split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    
    return user.email.charAt(0).toUpperCase();
  };

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 flex items-center" role="alert">
          <span>Error: {error}</span>
        </div>
      )}
      
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">10,000 Hours</h1>
          {process.env.NODE_ENV === 'development' && (
            <span className="ml-3 text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-gray-800 dark:text-gray-300">
              development
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Theme toggle button */}
          <ThemeToggle />
          
          {/* Settings button */}
          <button
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5 text-gray-700 dark:text-gray-300" />
          </button>
          
          {/* Sign-in button or User Profile */}
          {!currentUser || forceShowLogin ? (
            <button
              onClick={handleOpenLoginModal}
              className="flex items-center gap-1 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-md text-sm font-medium"
              id="sign-in-button"
              type="button"
              style={{ minWidth: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <User className="h-4 w-4 mr-1" />
              <span className="whitespace-nowrap">Sign In</span>
            </button>
          ) : (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={toggleDropdown}
                className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-md"
                type="button"
              >
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-300 font-medium">
                  {userProfile?.avatar_url ? (
                    <img 
                      src={userProfile.avatar_url} 
                      alt="Avatar" 
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    getInitials(currentUser)
                  )}
                </div>
                <span className="text-gray-800 dark:text-gray-200 max-w-[100px] truncate hidden sm:inline">
                  {userProfile?.full_name || currentUser.email.split('@')[0]}
                </span>
              </button>
              
              {/* User Dropdown */}
              {showDropdown && (
                <div 
                  className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-700"
                  style={{ minWidth: '180px' }}
                >
                  <button
                    onClick={handleSignOut}
                    className="flex items-center w-full px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    style={{ cursor: 'pointer' }}
                    type="button"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Login Modal */}
      {showLoginModal && (
        <LoginModal 
          onClose={handleCloseLoginModal}
          onSwitchToSignup={handleSwitchToSignup}
        />
      )}
      
      {/* Signup Modal */}
      {showSignupModal && (
        <SignupModal
          onClose={handleCloseSignupModal}
          onSwitchToLogin={handleSwitchToLogin}
        />
      )}
    </header>
  );
}

export default Header; 