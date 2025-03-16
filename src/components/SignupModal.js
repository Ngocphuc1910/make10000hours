import React, { useState, useEffect } from 'react';
import { X, Clock, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import SecurityMessageRemover from './SecurityMessageRemover';

const SignupModal = ({ onClose, onSwitchToLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [formError, setFormError] = useState('');
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [signupFailed, setSignupFailed] = useState(false);
  
  // Use useEffect to remove any security messages that might be injected by external scripts
  useEffect(() => {
    // Find and remove any security delay messages
    const removeSecurityMessages = () => {
      const messages = document.querySelectorAll('div');
      messages.forEach(element => {
        if (element.textContent && element.textContent.includes('For security purposes')) {
          element.style.display = 'none';
        }
      });
    };
    
    // Run initially and set up an interval to keep checking
    removeSecurityMessages();
    const interval = setInterval(removeSecurityMessages, 500);
    
    return () => clearInterval(interval);
  }, []);
  
  // Auto-close the modal when signup is successful
  useEffect(() => {
    if (signupSuccess) {
      const timer = setTimeout(() => {
        onClose();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [signupSuccess, onClose]);
  
  const { 
    emailSignUp,
    googleSignIn, 
    authError, 
    isAuthLoading,
    setAuthError 
  } = useAuth();

  const validateForm = () => {
    if (password !== confirmPassword) {
      setFormError('Passwords do not match');
      return false;
    }
    
    if (password.length < 6) {
      setFormError('Password must be at least 6 characters');
      return false;
    }
    
    setFormError('');
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    try {
      await emailSignUp(email, password, { full_name: fullName });
      setSignupSuccess(true);
      setSignupFailed(false);
      // Don't close the modal immediately - show success message first
    } catch (error) {
      // Error is handled by the useAuth hook
      console.error("Signup error:", error);
      setSignupFailed(true);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await googleSignIn();
      setSignupSuccess(true);
      setSignupFailed(false);
      // Don't close the modal immediately - show success message first
    } catch (error) {
      // Error is handled by the useAuth hook
      console.error("Google sign-in error:", error);
      setSignupFailed(true);
    }
  };
  
  const handleTryAgain = () => {
    setSignupFailed(false);
    setAuthError('');
  }

  // Success screen after successful signup
  if (signupSuccess) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md p-8 relative text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
              <Check className="w-8 h-8 text-green-600 dark:text-green-300" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold mb-2 dark:text-white">Account Created!</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Your PomoPro account has been successfully created.
          </p>
          
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Redirecting you to the dashboard...
          </p>
        </div>
      </div>
    );
  }

  // Error screen after failed signup
  if (signupFailed) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md p-8 relative text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-300" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold mb-2 dark:text-white">Sign Up Failed</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {authError || "There was a problem creating your account. Please try again."}
          </p>
          
          <div className="flex space-x-3 justify-center">
            <button
              onClick={handleTryAgain}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Try Again
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-900 dark:bg-gray-800 text-white rounded-md hover:bg-gray-800 dark:hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <SecurityMessageRemover />
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
        
        {/* Welcome text */}
        <h2 className="text-2xl font-bold text-center mb-2 dark:text-white">Join PomoPro</h2>
        <p className="text-gray-500 dark:text-gray-400 text-center mb-6">Start tracking your 10,000 hours journey</p>
        
        {/* Signup form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 dark:text-gray-300 mb-2">Full Name</label>
            <input
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 dark:text-gray-300 mb-2">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 dark:text-gray-300 mb-2">Password</label>
            <input
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
              autoComplete="new-password"
              data-lpignore="true"
              data-form-type="password"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 dark:text-gray-300 mb-2">Confirm Password</label>
            <input
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
              autoComplete="new-password"
              data-lpignore="true"
              data-form-type="password-confirm"
            />
          </div>
          
          {formError && (
            <div className="mb-4 text-sm text-red-500 dark:text-red-400">
              {formError}
            </div>
          )}
          
          {authError && (
            <div className="mb-4 text-sm text-red-500 dark:text-red-400">
              {authError}
            </div>
          )}
          
          <button
            type="submit"
            disabled={isAuthLoading}
            className="w-full py-2 px-4 bg-gray-900 dark:bg-gray-800 text-white font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-70"
          >
            {isAuthLoading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>
        
        {/* Google sign in */}
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
          
          <button
            onClick={handleGoogleSignIn}
            disabled={isAuthLoading}
            className="mt-4 w-full flex items-center justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-70"
          >
            <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
              <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
              </g>
            </svg>
            Continue with Google
          </button>
        </div>
        
        {/* Login link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <button 
              className="font-medium text-primary hover:underline" 
              onClick={onSwitchToLogin}
            >
              Sign In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignupModal; 