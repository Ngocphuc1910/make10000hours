import React, { useState } from 'react';
import { Bell, Settings, Clock, User } from 'lucide-react';
import LoginModal from '../LoginModal';
import { useAuth } from '../../hooks/useAuth';

const Header = () => {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const { currentUser, signOut } = useAuth();

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
              className="w-9 h-9 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-sm font-medium cursor-pointer"
              onClick={() => signOut()}
              title="Click to log out"
            >
              {currentUser.user_metadata?.avatar_url ? (
                <img 
                  src={currentUser.user_metadata.avatar_url} 
                  alt={currentUser.email} 
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span>{currentUser.email?.charAt(0).toUpperCase()}</span>
              )}
            </div>
          </div>
        ) : (
          /* Login button */
          <button 
            onClick={() => setShowLoginModal(true)}
            className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <User className="w-5 h-5" />
          </button>
        )}
      </div>

      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
    </header>
  );
};

export default Header; 