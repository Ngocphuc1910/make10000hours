import React, { useState, useEffect } from 'react';
import { Bell, Settings, Clock, User, LogOut, ChevronDown } from 'lucide-react';
import LoginModal from '../LoginModal';
import SignupModal from '../SignupModal';
import { useAuth } from '../../hooks/useAuth';
import { ThemeToggle } from '../ThemeToggle';

const Header = () => {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { currentUser, userProfile, signOut } = useAuth();

  useEffect(() => {
    if (currentUser) {
      setShowLoginModal(false);
      setShowSignupModal(false);
    }
  }, [currentUser]);

  const handleLogout = async () => {
    try {
      console.log("Header: Initiating logout");
      // Show visual feedback that logout is in progress
      const logoutButton = document.querySelector('button[data-action="logout"]');
      if (logoutButton) {
        logoutButton.innerHTML = '<svg class="animate-spin w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg> Signing out...';
        logoutButton.disabled = true;
      }
      
      await signOut();
      console.log("Header: Logout successful");
      
      // Only close the menu if signOut was successful
      setShowUserMenu(false);
    } catch (error) {
      console.error("Header: Logout failed", error);
      alert("Failed to sign out. Please try again.");
      
      // Restore button state
      const logoutButton = document.querySelector('button[data-action="logout"]');
      if (logoutButton) {
        logoutButton.innerHTML = '<svg class="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg> Sign out';
        logoutButton.disabled = false;
      }
    }
  };

  const handleSwitchToSignup = () => {
    setShowLoginModal(false);
    setShowSignupModal(true);
  };

  const handleSwitchToLogin = () => {
    setShowSignupModal(false);
    setShowLoginModal(true);
  };

  const handleCloseModals = () => {
    setShowLoginModal(false);
    setShowSignupModal(false);
  };

  return (
    <header className="h-16 border-b border-gray-200 dark:border-gray-800 flex items-center px-6">
      {/* Logo */}
      <div className="flex items-center gap-2 font-semibold">
        <Clock className="w-5 h-5 text-primary" />
        <span>PomoPro</span>
      </div>
      
      {/* Spacer */}
      <div className="flex-grow"></div>
      
      {/* Right side icons */}
      <div className="flex items-center gap-4">
        <button className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
          <Bell className="w-5 h-5" />
        </button>
        
        {/* Theme Toggle Button */}
        <ThemeToggle />
        
        <button className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
          <Settings className="w-5 h-5" />
        </button>
        
        {currentUser ? (
          /* User avatar - with dropdown for logout */
          <div className="relative">
            <div 
              className="flex items-center gap-1.5 cursor-pointer"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <div className="w-9 h-9 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-sm font-medium overflow-hidden">
                {userProfile?.avatar_url || currentUser.user_metadata?.avatar_url ? (
                  <img 
                    src={userProfile?.avatar_url || currentUser.user_metadata?.avatar_url} 
                    alt={userProfile?.full_name || currentUser.email} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{(userProfile?.full_name?.[0] || currentUser.email?.[0] || '').toUpperCase()}</span>
                )}
              </div>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </div>
            
            {showUserMenu && (
              <div className="absolute top-full right-0 mt-1 py-1 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{userProfile?.full_name || 'User'}</p>
                  <p className="text-xs text-gray-500 truncate">{currentUser.email}</p>
                </div>
                <button 
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={handleLogout}
                  data-action="logout"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Login button */
          <button 
            onClick={() => setShowLoginModal(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 px-3 py-1.5"
          >
            <User className="w-4 h-4" />
            <span>Sign in</span>
          </button>
        )}
      </div>

      {showLoginModal && (
        <LoginModal 
          onClose={handleCloseModals} 
          onSwitchToSignup={handleSwitchToSignup} 
        />
      )}
      
      {showSignupModal && (
        <SignupModal 
          onClose={handleCloseModals} 
          onSwitchToLogin={handleSwitchToLogin} 
        />
      )}
    </header>
  );
};

export default Header; 