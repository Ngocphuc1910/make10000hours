import React, { useState, useEffect, useMemo } from 'react';
import { Moon, Sun, Settings, User, LogOut, ChevronDown, AlertTriangle } from 'lucide-react';
import LoginModal from '../LoginModal';
import SignupModal from '../SignupModal';
import { useAuth } from '../../hooks/useAuth';

// Hardcoded to always show login in production
const FORCE_SHOW_LOGIN = true;

function Header() {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || 'light';
    }
    return 'light';
  });
  
  const { user, signOut } = useAuth();
  
  // State for showing modals
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
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
      
      // Detect localhost vs production
      const isLocalhost = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1';
      
      console.log("Is localhost:", isLocalhost);
      
      if (!isLocalhost) {
        setForceShowLogin(true);
        console.log("Production environment detected, forcing login button");
      }
    } catch (err) {
      console.error("Error in header debug:", err);
      setError(err.message);
    }
  }, [user]);
  
  // Toggle theme function
  const toggleTheme = () => {
    try {
      const newTheme = theme === 'light' ? 'dark' : 'light';
      setTheme(newTheme);
      localStorage.setItem('theme', newTheme);
      document.documentElement.classList.toggle('dark', newTheme === 'dark');
    } catch (err) {
      console.error("Error toggling theme:", err);
      setError(err.message);
    }
  };
  
  // Apply theme on mount
  useEffect(() => {
    try {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    } catch (err) {
      console.error("Error applying theme:", err);
      setError(err.message);
    }
  }, [theme]);
  
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
  
  const handleLogout = () => {
    try {
      signOut();
      setShowUserMenu(false);
    } catch (err) {
      console.error("Error during logout:", err);
      setError(err.message);
    }
  };
  
  // Memoized value for whether to show login based on user state or forced visibility
  const shouldShowLogin = useMemo(() => {
    try {
      return !user || forceShowLogin;
    } catch (err) {
      console.error("Error determining login visibility:", err);
      setError(err.message);
      return true; // Default to showing login button on error
    }
  }, [user, forceShowLogin]);
  
  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 flex items-center" role="alert">
          <AlertTriangle className="h-5 w-5 mr-2" />
          <span>Error: {error}</span>
        </div>
      )}
      
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">10,000 Hours</h1>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Theme toggle button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? (
              <Moon className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            ) : (
              <Sun className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            )}
          </button>
          
          {/* Settings button */}
          <button
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5 text-gray-700 dark:text-gray-300" />
          </button>
          
          {/* Login/User button with debugging */}
          <div>
            {shouldShowLogin ? (
              <button
                onClick={handleOpenLoginModal}
                className="flex items-center gap-1 bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-md text-sm"
              >
                <User className="h-4 w-4" />
                <span>Sign In</span>
              </button>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-md"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <span className="hidden sm:inline">{user?.email || 'User'}</span>
                  <ChevronDown className="h-4 w-4" />
                </button>
                
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                    <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-medium">{user?.email || 'User'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Signed in</p>
                    </div>
                    <div className="p-2">
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-sm"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Sign out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
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