import React, { useState } from 'react';
import { KeySquare, Check } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const ResetPasswordForm = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const navigate = useNavigate();
  
  const { 
    updatePassword,
    authError, 
    isAuthLoading 
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
      await updatePassword(password);
      setIsSubmitted(true);
      
      // Redirect to login page after 3 seconds
      setTimeout(() => {
        navigate('/');
      }, 3000);
    } catch (error) {
      // Error is handled by the useAuth hook
      console.error("Password update error:", error);
    }
  };

  // Success screen after submitting
  if (isSubmitted) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
            <Check className="w-8 h-8 text-green-600 dark:text-green-300" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold mb-2 dark:text-white">Password Updated</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Your password has been successfully updated. You'll be redirected to login shortly.
        </p>
        
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-gray-900 dark:bg-gray-800 text-white rounded-md hover:bg-gray-800 dark:hover:bg-gray-700 w-full"
        >
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto my-12 p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      {/* Key icon */}
      <div className="flex justify-center mb-6">
        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
          <KeySquare className="w-6 h-6 text-gray-700 dark:text-gray-300" />
        </div>
      </div>
      
      {/* Title */}
      <h2 className="text-2xl font-bold text-center mb-2 dark:text-white">Reset Your Password</h2>
      <p className="text-gray-500 dark:text-gray-400 text-center mb-6">Enter your new password below</p>
      
      {/* Reset password form */}
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-700 dark:text-gray-300 mb-2">New Password</label>
          <input
            type="password"
            placeholder="Enter new password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            required
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
          {isAuthLoading ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
};

export default ResetPasswordForm; 