import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const AuthCallback = () => {
  const [status, setStatus] = useState('processing'); // 'processing', 'success', 'error'
  const [message, setMessage] = useState('Verifying your email...');
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyEmail } = useAuth();

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      // Check for token from URL hash
      if (location.hash) {
        try {
          // Parse the hash params
          const hashParams = new URLSearchParams(location.hash.substring(1));
          const token = hashParams.get('token_hash');
          const type = hashParams.get('type');
          const error = hashParams.get('error');
          const errorDescription = hashParams.get('error_description');

          // If there's an error in the URL, display it
          if (error) {
            setStatus('error');
            setMessage(errorDescription || 'Email verification failed');
            return;
          }

          // If there's a token, verify it
          if (token && type === 'email') {
            await verifyEmail(token);
            setStatus('success');
            setMessage('Email verified successfully! Redirecting to login...');
            
            // Redirect to login page after a delay
            setTimeout(() => {
              navigate('/');
            }, 3000);
          } else {
            setStatus('error');
            setMessage('Invalid verification link');
          }
        } catch (error) {
          console.error('Error verifying email:', error);
          setStatus('error');
          setMessage(error.message || 'Failed to verify email');
        }
      } else {
        setStatus('error');
        setMessage('No verification token found in URL');
      }
    };

    handleEmailConfirmation();
  }, [location, navigate, verifyEmail]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
        {status === 'processing' && (
          <div className="animate-pulse">
            <div className="w-16 h-16 mx-auto border-4 border-gray-300 dark:border-gray-600 border-t-gray-800 dark:border-t-gray-200 rounded-full animate-spin"></div>
            <h2 className="text-2xl font-bold mt-6 mb-2 dark:text-white">Verifying Your Email</h2>
            <p className="text-gray-600 dark:text-gray-300">Please wait while we verify your email address...</p>
          </div>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
              <Check className="w-8 h-8 text-green-600 dark:text-green-300" />
            </div>
            <h2 className="text-2xl font-bold mt-6 mb-2 dark:text-white">Email Verified!</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Your email has been successfully verified. You'll be redirected to login.
            </p>
            <button 
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-gray-800 dark:bg-gray-700 text-white rounded-md hover:bg-gray-700 dark:hover:bg-gray-600"
            >
              Go to Login
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-300" />
            </div>
            <h2 className="text-2xl font-bold mt-6 mb-2 dark:text-white">Verification Failed</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {message}
            </p>
            <button 
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-gray-800 dark:bg-gray-700 text-white rounded-md hover:bg-gray-700 dark:hover:bg-gray-600"
            >
              Back to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback; 