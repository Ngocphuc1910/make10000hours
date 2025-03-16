import React, { useState, useEffect } from 'react';
import { Bell, Settings, Clock, User, LogOut, ChevronDown } from 'lucide-react';
import LoginModal from '../LoginModal';
import SignupModal from '../SignupModal';
import { useAuth } from '../../hooks/useAuth';

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
    await signOut();
    setShowUserMenu(false);
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