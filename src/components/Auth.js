import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import LoginModal from './LoginModal';
import SignupModal from './SignupModal';
import '../styles/Auth.css';

const Auth = () => {
  const { 
    currentUser, 
    signOut
  } = useAuth();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showWelcome, setShowWelcome] = useState(!currentUser);

  // Hide welcome screen when user is authenticated
  useEffect(() => {
    if (currentUser) {
      setShowWelcome(false);
    }
  }, [currentUser]);

  const toggleAuthModal = () => {
    setShowAuthModal(!showAuthModal);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setShowDropdown(false);
      setShowWelcome(true);
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  if (showWelcome) {
    return (
      <div className="app-overlay">
        <div className="welcome-content">
          <h1>Pomodoro Timer</h1>
          <p>Stay focused, be productive with the Pomodoro technique.</p>
          <button 
            className="auth-button" 
            onClick={toggleAuthModal}
          >
            Get Started
          </button>
        </div>
        {showAuthModal && (
          activeTab === 'login' ? (
            <LoginModal 
              onClose={toggleAuthModal} 
              onSwitchToSignup={() => handleTabChange('register')} 
            />
          ) : (
            <SignupModal 
              onClose={toggleAuthModal} 
              onSwitchToLogin={() => handleTabChange('login')} 
            />
          )
        )}
      </div>
    );
  }

  return (
    <>
      {currentUser && (
        <div className="user-profile" onClick={toggleDropdown}>
          <div className="user-avatar">
            {currentUser.photoURL ? (
              <img src={currentUser.photoURL} alt={currentUser.displayName || currentUser.email} />
            ) : (
              currentUser.email.charAt(0).toUpperCase()
            )}
          </div>
          <div className="user-name">
            {currentUser.displayName || currentUser.email.split('@')[0]}
          </div>
          
          <div className={`profile-dropdown ${showDropdown ? 'visible' : ''}`}>
            <div className="dropdown-item logout" onClick={handleSignOut}>
              Sign Out
            </div>
          </div>
        </div>
      )}
      
      {!currentUser && (
        <button className="login-button" onClick={toggleAuthModal}>
          Sign In
        </button>
      )}
      
      {showAuthModal && (
        activeTab === 'login' ? (
          <LoginModal 
            onClose={toggleAuthModal} 
            onSwitchToSignup={() => handleTabChange('register')} 
          />
        ) : (
          <SignupModal 
            onClose={toggleAuthModal} 
            onSwitchToLogin={() => handleTabChange('login')} 
          />
        )
      )}
    </>
  );
};

export default Auth; 