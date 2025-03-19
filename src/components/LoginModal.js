import React, { useState, useEffect } from 'react';
import { X, Clock, Github, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import ForgotPasswordModal from './ForgotPasswordModal';

const LoginModal = ({ onClose, onSwitchToSignup }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [emailConfirmationNeeded, setEmailConfirmationNeeded] = useState(false);
  const [lastSubmitTime, setLastSubmitTime] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { 
    emailSignIn, 
    googleSignIn,
    githubSignIn,
    authError, 
    isAuthLoading 
  } = useAuth();
  
  // Reset form when modal opens
  useEffect(() => {
    // Reset all form state
    setEmail('');
    setPassword('');
    setRememberMe(false);
    setIsSubmitting(false);
    setLastSubmitTime(0);
  }, [onClose]);
  
  // Check for email confirmation error
  useEffect(() => {
    if (authError && (
      authError.includes('Email not confirmed') || 
      authError.includes('not verified') || 
      authError.includes('not confirmed')
    )) {
      setEmailConfirmationNeeded(true);
    } else {
      setEmailConfirmationNeeded(false);
    }
  }, [authError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Prevent submission if already submitting
    if (isSubmitting || isAuthLoading) {
      console.log('Form is already being submitted');
      return;
    }
    
    // Prevent duplicate/automated submissions by requiring at least 1 second between attempts
    const now = Date.now();
    if (now - lastSubmitTime < 2000) {
      console.log('Please wait before submitting again');
      return;
    }
    
    try {
      setIsSubmitting(true);
      setLastSubmitTime(now);
      console.log('Starting sign in for:', email);
      const result = await emailSignIn(email, password);
      console.log('Sign in completed successfully:', result?.user?.email);
      
      // Give the auth state a moment to update before closing
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Sign in failed:', error);
      // Error is handled by the useAuth hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isSubmitting || isAuthLoading) {
      return;
    }
    
    try {
      setIsSubmitting(true);
      await googleSignIn();
      onClose();
    } catch (error) {
      // Error is handled by the useAuth hook
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleGithubSignIn = async () => {
    if (isSubmitting || isAuthLoading) {
      return;
    }
    
    try {
      setIsSubmitting(true);
      await githubSignIn();
      onClose();
    } catch (error) {
      // Error is handled by the useAuth hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = () => {
    setShowForgotPassword(true);
  };
  
  // Show forgot password modal
  if (showForgotPassword) {
    return (
      <ForgotPasswordModal 
        onClose={() => setShowForgotPassword(false)} 
        onSwitchToLogin={() => setShowForgotPassword(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md p-6 relative">
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <X className="w-5 h-5" />
        </button>
        
        {/* Clock icon */}
        <div className="flex justify-center mb-6 mt-4">
          <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
            <Clock className="w-6 h-6 text-gray-700 dark:text-gray-300" />
          </div>
        </div>
        
        {/* Welcome back text */}
        <h2 className="text-2xl font-bold text-center mb-2 dark:text-white">Welcome back to PomoPro</h2>
        <p className="text-gray-500 dark:text-gray-400 text-center mb-6">Track your productivity journey</p>
        
        {/* Login form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label className="block text-gray-700 dark:text-gray-300 mb-2">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
              disabled={isSubmitting || isAuthLoading}
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 dark:text-gray-300 mb-2">Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
              disabled={isSubmitting || isAuthLoading}
              autoComplete="current-password"
            />
          </div>
          
          {/* Email confirmation error */}
          {emailConfirmationNeeded && (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-md">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-yellow-500 dark:text-yellow-400 mr-2 mt-0.5" />
                <div>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">Email verification required</p>
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                    Please check your inbox and verify your email address before signing in.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Other auth errors */}
          {authError && !emailConfirmationNeeded && (
            <div className="mb-4 text-sm text-red-500 dark:text-red-400">
              {authError}
            </div>
          )}
          
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="remember-me"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                disabled={isSubmitting || isAuthLoading}
              />
              <label htmlFor="remember-me" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Remember me
              </label>
            </div>
            
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary"
              disabled={isSubmitting || isAuthLoading}
            >
              Forgot password?
            </button>
          </div>
          
          <button
            type="submit"
            disabled={isSubmitting || isAuthLoading}
            className="w-full py-2 px-4 bg-gray-900 dark:bg-gray-800 text-white font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-70"
          >
            {isSubmitting || isAuthLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        
        {/* Social logins */}
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                Or continue with
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3 mt-4">
            {/* Google login */}
            <button
              onClick={handleGoogleSignIn}
              disabled={isSubmitting || isAuthLoading}
              className="flex items-center justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-70"
            >
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                  <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                  <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                  <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                  <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
                </g>
              </svg>
              Google
            </button>
            
            {/* GitHub login */}
            <button
              onClick={handleGithubSignIn}
              disabled={isSubmitting || isAuthLoading}
              className="flex items-center justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-70"
            >
              <Github className="h-5 w-5 mr-2" />
              GitHub
            </button>
          </div>
        </div>
        
        {/* Sign up link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Don't have an account?{' '}
            <button 
              className="font-medium text-primary hover:underline" 
              onClick={onSwitchToSignup}
              disabled={isSubmitting || isAuthLoading}
            >
              Sign Up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginModal; 