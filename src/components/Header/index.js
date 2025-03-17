import React, { useState, useEffect } from 'react';
import { Settings, User } from 'lucide-react';
import LoginModal from '../LoginModal';
import SignupModal from '../SignupModal';
import { useAuth } from '../../hooks/useAuth';
import { ThemeToggle } from '../ThemeToggle';

// Always show login button in production
const FORCE_SHOW_LOGIN = true;

function Header() {
  const { user, signOut } = useAuth();
  
  // State for showing modals
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [forceShowLogin, setForceShowLogin] = useState(FORCE_SHOW_LOGIN);
  const [error, setError] = useState(null);
  
  // Debugging info about the current environment
  useEffect(() => {
    try {
      console.log("=== HEADER DEBUGGING INFO ===");
      console.log("Current hostname:", window.location.hostname);
      console.log("Current pathname:", window.location.pathname);
      console.log("Auth state - user:", user);
      console.log("Force show login:", forceShowLogin);
      console.log("Environment:", process.env.NODE_ENV);
      console.log("PUBLIC_URL:", process.env.PUBLIC_URL);
      
      // Always force login button in production
      if (process.env.NODE_ENV === 'production') {
        setForceShowLogin(true);
        console.log("Production environment detected, forcing login button");
      }
    } catch (err) {
      console.error("Error in header debug:", err);
      setError(err.message);
    }
  }, [user, forceShowLogin]);
  
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
  
  const handleOpenSignupModal = () => {
    try {
      setShowSignupModal(true);
      setShowLoginModal(false);
    } catch (err) {
      console.error("Error opening signup modal:", err);
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
      console.log("Switching to signup from login");
      handleOpenSignupModal();
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
          
          {/* Always show the sign-in button */}
          <button
            onClick={handleOpenLoginModal}
            className="flex items-center gap-1 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-md text-sm"
            id="sign-in-button"
          >
            <User className="h-4 w-4" />
            <span>Sign In</span>
          </button>
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