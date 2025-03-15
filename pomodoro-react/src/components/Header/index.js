import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useAuthModal } from '../Auth';
import { Bell, Settings, Clock, LogOut } from 'lucide-react';

const Header = () => {
  const { currentUser, signOut } = useAuth();
  const { openAuthModal } = useAuthModal();
  const [showDropdown, setShowDropdown] = useState(false);
  
  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };
  
  const handleSignOut = async () => {
    try {
      await signOut();
      setShowDropdown(false);
    } catch (error) {
      console.error("Sign out error:", error);
    }
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
          <div className="relative">
            <button
              className="flex items-center gap-2 ml-2"
              onClick={toggleDropdown}
            >
              <div className="w-9 h-9 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-sm font-medium">
                {currentUser.photoURL ? (
                  <img 
                    src={currentUser.photoURL} 
                    alt="User"
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    {currentUser.displayName ? (
                      currentUser.displayName.substring(0, 2).toUpperCase()
                    ) : (
                      currentUser.email.substring(0, 2).toUpperCase()
                    )}
                  </div>
                )}
              </div>
              <span className="text-sm hidden md:inline-block">
                {currentUser.displayName || currentUser.email.split('@')[0]}
              </span>
            </button>
            
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-10">
                <button
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={handleSignOut}
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            className="ml-2 px-4 py-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded-md text-sm font-medium transition-colors"
            onClick={openAuthModal}
          >
            Sign In
          </button>
        )}
      </div>
    </header>
  );
};

export default Header; 