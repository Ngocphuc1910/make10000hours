import React, { useState } from 'react';
import { X, KeySquare, Check } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const ForgotPasswordModal = ({ onClose, onSwitchToLogin }) => {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const { 
    resetPassword,
    authError, 
    isAuthLoading 
  } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      await resetPassword(email);
      setIsSubmitted(true);
    } catch (error) {
      // Error is handled by the useAuth hook
      console.error("Password reset error:", error);
    }
  };

  // Success screen after submitting
  if (isSubmitted) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md p-8 relative text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
              <Check className="w-8 h-8 text-green-600 dark:text-green-300" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold mb-2 dark:text-white">Check Your Email</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            If an account exists for {email}, you'll receive a password reset link shortly.
          </p>
          
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-900 dark:bg-gray-800 text-white rounded-md hover:bg-gray-800 dark:hover:bg-gray-700 w-full"
          >
            Close
          </button>
        </div>
      </div>
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
        
        {/* Key icon */}
        <div className="flex justify-center mb-6 mt-4">
          <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
            <KeySquare className="w-6 h-6 text-gray-700 dark:text-gray-300" />
          </div>
        </div>
        
        {/* Title */}
        <h2 className="text-2xl font-bold text-center mb-2 dark:text-white">Reset Password</h2>
        <p className="text-gray-500 dark:text-gray-400 text-center mb-6">Enter your email to receive a password reset link</p>
        
        {/* Reset password form */}
        <form onSubmit={handleSubmit}>
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
            {isAuthLoading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>
        
        {/* Back to login link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Remember your password?{' '}
            <button 
              className="font-medium text-primary hover:underline" 
              onClick={onSwitchToLogin}
            >
              Back to Login
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordModal; 