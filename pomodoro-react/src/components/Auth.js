import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import '../styles/Auth.css';

const Auth = () => {
  const { 
    currentUser, 
    googleSignIn, 
    emailSignIn, 
    emailSignUp, 
    signOut,
    authError,
    setAuthError,
    isAuthLoading
  } = useAuth();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showWelcome, setShowWelcome] = useState(!currentUser);

  // Reset form on tab change
  useEffect(() => {
    setEmail('');
    setPassword('');
    setAuthError('');
  }, [activeTab, setAuthError]);

  // Hide welcome screen when user is authenticated
  useEffect(() => {
    if (currentUser) {
      setShowWelcome(false);
    }
  }, [currentUser]);

  const toggleAuthModal = () => {
    setShowAuthModal(!showAuthModal);
    if (showAuthModal) {
      // Reset form when closing
      setEmail('');
      setPassword('');
      setAuthError('');
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (activeTab === 'login') {
        await emailSignIn(email, password);
      } else {
        await emailSignUp(email, password);
      }
      toggleAuthModal();
    } catch (error) {
      console.error("Auth error:", error);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await googleSignIn();
      toggleAuthModal();
    } catch (error) {
      console.error("Google sign in error:", error);
    }
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
        {renderAuthModal()}
      </div>
    );
  }

  function renderAuthModal() {
    return (
      <div className={`auth-container ${showAuthModal ? 'visible' : ''}`}>
        <div className="auth-modal">
          <button className="auth-close" onClick={toggleAuthModal}>×</button>
          <h2 className="auth-heading">
            {activeTab === 'login' ? 'Sign In' : 'Create Account'}
          </h2>
          
          <div className="auth-tabs">
            <div 
              className={`auth-tab ${activeTab === 'login' ? 'active' : ''}`}
              onClick={() => handleTabChange('login')}
            >
              Sign In
            </div>
            <div 
              className={`auth-tab ${activeTab === 'register' ? 'active' : ''}`}
              onClick={() => handleTabChange('register')}
            >
              Register
            </div>
          </div>
          
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-input-group">
              <label className="auth-label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="auth-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="auth-input-group">
              <label className="auth-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="auth-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            {authError && (
              <div className="auth-error visible">{authError}</div>
            )}
            
            <button 
              type="submit" 
              className="auth-button"
              disabled={isAuthLoading}
            >
              {isAuthLoading 
                ? 'Loading...' 
                : activeTab === 'login' ? 'Sign In' : 'Create Account'
              }
            </button>
          </form>
          
          <div className="auth-divider">
            <span>or</span>
          </div>
          
          <div className="social-login">
            <button 
              className="social-button google-button"
              onClick={handleGoogleSignIn}
              disabled={isAuthLoading}
            >
              <img 
                src="https://developers.google.com/identity/images/g-logo.png" 
                alt="Google" 
                className="social-icon" 
              />
              Continue with Google
            </button>
          </div>
          
          <div className="auth-footer">
            {activeTab === 'login' 
              ? "Don't have an account? " 
              : "Already have an account? "
            }
            <span 
              className="auth-link"
              onClick={() => handleTabChange(activeTab === 'login' ? 'register' : 'login')}
            >
              {activeTab === 'login' ? 'Sign up' : 'Sign in'}
            </span>
          </div>
        </div>
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
      
      {renderAuthModal()}
    </>
  );
};

export default Auth; 