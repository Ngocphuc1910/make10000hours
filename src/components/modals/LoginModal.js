import React, { useState, useEffect } from 'react';
import { X, Clock, Github, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import ForgotPasswordModal from './ForgotPasswordModal';
import testSupabaseConnection from '../../lib/testSupabase';
import { checkSupabaseConnection, advancedSupabaseTest, checkForCORSIssues } from '../../utils/networkUtils';
import { checkInternetConnection } from '../../utils/networkUtils';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://ccxhdmyfmfwincvzqjhg.supabase.co';

const LoginModal = ({ onClose, onSwitchToSignup }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [emailConfirmationNeeded, setEmailConfirmationNeeded] = useState(false);
  const [lastSubmitTime, setLastSubmitTime] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [showPasswordResetSent, setShowPasswordResetSent] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showDiagnosticButton, setShowDiagnosticButton] = useState(true);
  
  const { 
    emailSignIn, 
    googleSignIn,
    githubSignIn,
    authError: hookAuthError, 
    isAuthLoading,
    verifyEmail,
    resetPassword,
    currentUser
  } = useAuth();
  
  // Create ref for email input
  const emailInputRef = React.useRef(null);
  
  // Add ref for preventing auto-submission on load
  const hasAttemptedAutoSubmit = React.useRef(false);
  const initialRenderComplete = React.useRef(false);
  
  // Focus the email input when modal opens
  useEffect(() => {
    // Short timeout to ensure the DOM is ready
    const timer = setTimeout(() => {
      if (emailInputRef.current) {
        emailInputRef.current.focus();
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);
  
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
    if (hookAuthError && (
      hookAuthError.includes('Email not confirmed') || 
      hookAuthError.includes('not verified') || 
      hookAuthError.includes('not confirmed')
    )) {
      setEmailConfirmationNeeded(true);
    } else {
      setEmailConfirmationNeeded(false);
    }
  }, [hookAuthError]);

  // Use both the hook's authError and our local one
  useEffect(() => {
    if (hookAuthError) {
      setAuthError(hookAuthError);
    }
  }, [hookAuthError]);

  // Add console logging to track disabled state
  useEffect(() => {
    console.log('Button state:', { isSubmitting, isAuthLoading });
  }, [isSubmitting, isAuthLoading]);

  // Check if this is a page reload and prevent auto-submission
  useEffect(() => {
    // Skip on first render
    if (!initialRenderComplete.current) {
      initialRenderComplete.current = true;
      return;
    }

    const isPageReload = performance.navigation ? 
      performance.navigation.type === 1 : // Type 1 is reload
      window.performance.getEntriesByType('navigation')
        .some(nav => nav.type === 'reload');
    
    if (isPageReload && !hasAttemptedAutoSubmit.current) {
      console.log('LoginModal: Page reload detected, preventing auto-submission');
      hasAttemptedAutoSubmit.current = true;
      setAuthError('Please click the sign in button to log in');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation(); // Stop any event bubbling
    
    // Enhanced check to prevent auto-submission
    // Check if the event is trusted (came from user interaction)
    if (!e || !e.isTrusted) {
      console.log('LoginModal: Prevented automated form submission');
      setAuthError('Please click the sign in button directly');
      return false;
    }
    
    // Prevent submission if already submitting
    if (isSubmitting || isAuthLoading) {
      console.log('LoginModal: Form is already being submitted');
      return;
    }
    
    // Prevent submission if email or password is empty
    if (!email.trim() || !password.trim()) {
      setAuthError('Please enter both email and password');
      return;
    }
    
    // Prevent duplicate/automated submissions by requiring at least 1 second between attempts
    const now = Date.now();
    if (now - lastSubmitTime < 2000) {
      console.log('LoginModal: Please wait before submitting again');
      setAuthError('Please wait a moment before trying again');
      return;
    }
    
    try {
      setIsSubmitting(true);
      setLastSubmitTime(now);
      setAuthError(''); // Clear any previous errors
      console.log('LoginModal: Starting sign in for:', email);
      
      // Explicitly mark this as a user-initiated event
      // The original DOM event is important to ensure it's not triggered by a page reload
      e.isUserInitiated = true; // Add custom property to help identify user actions
      const result = await emailSignIn(email, password, e);
      
      if (result?.user) {
        console.log('LoginModal: Sign in completed successfully:', result.user.email);
        
        // Give the auth state a moment to update before closing
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        console.log('LoginModal: Sign in did not complete - no result returned');
        if (!authError) {
          setAuthError('Sign in failed. Please try again.');
        }
      }
    } catch (error) {
      console.error('LoginModal: Sign in failed:', error);
      // Error is handled by the useAuth hook, but ensure we have a fallback
      if (!authError) {
        setAuthError('An error occurred during sign in. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async (e) => {
    // Check if the event is trusted (came from user interaction)
    if (!e || !e.isTrusted) {
      console.log('Prevented automated Google sign-in');
      return false;
    }
    
    try {
      setIsSubmitting(true);
      const result = await googleSignIn(e); // Pass the event to the function
      console.log('Google sign in initiated');
    } catch (error) {
      console.error('Google sign in error:', error);
      // Error is handled by the useAuth hook
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleGithubSignIn = async (e) => {
    // Check if the event is trusted (came from user interaction)
    if (!e || !e.isTrusted) {
      console.log('Prevented automated GitHub sign-in');
      return false;
    }
    
    try {
      setIsSubmitting(true);
      const result = await githubSignIn(e); // Pass the event to the function
      console.log('GitHub sign in initiated');
    } catch (error) {
      console.error('GitHub sign in error:', error);
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

  // Update runDiagnostics function
  const runDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    setDiagnosticResults(null);
    
    try {
      console.log('Starting advanced connection diagnostics...');
      
      // Step 1: Check basic internet connectivity
      const internetStatus = await checkInternetConnection();
      console.log('Internet connectivity:', internetStatus);
      
      // Step 2: Check for CORS issues
      console.log('Checking for CORS issues...');
      const corsCheck = await checkForCORSIssues();
      console.log('CORS check results:', corsCheck);
      
      // Step 3: Run advanced Supabase tests
      console.log('Running advanced Supabase tests...');
      const advancedResults = await advancedSupabaseTest();
      console.log('Advanced test results:', advancedResults);
      
      // Step 4: Check environment variables
      const envCheck = {
        url: !!process.env.REACT_APP_SUPABASE_URL,
        key: !!process.env.REACT_APP_SUPABASE_ANON_KEY,
        urlValue: process.env.REACT_APP_SUPABASE_URL ? 
          `${process.env.REACT_APP_SUPABASE_URL.substring(0, 20)}...` : 'not set',
        keyValue: process.env.REACT_APP_SUPABASE_ANON_KEY ? 
          `${process.env.REACT_APP_SUPABASE_ANON_KEY.substring(0, 5)}...${
            process.env.REACT_APP_SUPABASE_ANON_KEY.substring(
              process.env.REACT_APP_SUPABASE_ANON_KEY.length - 3
            )
          }` : 'not set'
      };
      console.log('Environment variables:', envCheck);
      
      // Compile all results
      const fullResults = {
        internet: internetStatus,
        cors: corsCheck,
        supabase: advancedResults,
        env: envCheck,
        timestamp: new Date().toISOString()
      };
      
      setDiagnosticResults(fullResults);
      
      // Determine overall status
      const isSuccessful = internetStatus.success && advancedResults.success;
      
      if (isSuccessful) {
        setErrorMessage('Diagnostics passed successfully. Try logging in again.');
      } else {
        let errorDetails = '';
        if (!internetStatus.success) {
          errorDetails += 'Internet connection issue. ';
        }
        if (!corsCheck.success) {
          errorDetails += 'CORS issues detected. ';
        }
        if (!advancedResults.success) {
          errorDetails += 'Supabase connection failed. ';
        }
        if (!envCheck.url || !envCheck.key) {
          errorDetails += 'Environment variables missing. ';
        }
        
        setErrorMessage(`Connection issues detected: ${errorDetails}`);
      }
    } catch (error) {
      console.error('Diagnostic error:', error);
      setDiagnosticResults({ error: error.message, timestamp: new Date().toISOString() });
      setErrorMessage(`Diagnostics error: ${error.message}`);
    } finally {
      setIsRunningDiagnostics(false);
    }
  };
  
  // Update the diagnostic results display
  const renderDiagnosticResults = () => {
    if (!diagnosticResults) return null;
    
    return (
      <div className="diagnostic-results mt-3 p-3 border rounded bg-light">
        <h6>Diagnostic Results:</h6>
        <div className="small">
          <div><strong>Timestamp:</strong> {diagnosticResults.timestamp}</div>
          
          {diagnosticResults.internet && (
            <div className="mt-2">
              <div><strong>Internet:</strong> {diagnosticResults.internet.success ? '✅ Connected' : '❌ Not connected'}</div>
              {!diagnosticResults.internet.success && <div className="text-danger">{diagnosticResults.internet.error}</div>}
            </div>
          )}
          
          {diagnosticResults.cors && (
            <div className="mt-2">
              <div><strong>CORS:</strong> {diagnosticResults.cors.success ? '✅ Passed' : '❌ Failed'}</div>
              {!diagnosticResults.cors.success && <div className="text-danger">{diagnosticResults.cors.error}</div>}
              {diagnosticResults.cors.status && <div>Status: {diagnosticResults.cors.status}</div>}
            </div>
          )}
          
          {diagnosticResults.env && (
            <div className="mt-2">
              <div><strong>Environment:</strong></div>
              <div>URL: {diagnosticResults.env.url ? '✅' : '❌'} {diagnosticResults.env.urlValue}</div>
              <div>API Key: {diagnosticResults.env.key ? '✅' : '❌'} {diagnosticResults.env.keyValue}</div>
            </div>
          )}
          
          {diagnosticResults.supabase && (
            <div className="mt-2">
              <div>
                <strong>Supabase:</strong> 
                {diagnosticResults.supabase.success ? '✅ Connected' : '❌ Connection failed'}
              </div>
              
              {diagnosticResults.supabase.methods && (
                <div>
                  <div className="mt-1"><strong>Connection Methods:</strong></div>
                  {Object.entries(diagnosticResults.supabase.methods).map(([method, result]) => (
                    <div key={method} className={`ml-2 ${result.success ? 'text-success' : 'text-danger'}`}>
                      {method}: {result.success ? `✅ (${result.status})` : `❌ ${result.error || 'Failed'}`}
                    </div>
                  ))}
                </div>
              )}
              
              {diagnosticResults.supabase.error && (
                <div className="text-danger">{diagnosticResults.supabase.error}</div>
              )}
            </div>
          )}
          
          {diagnosticResults.error && (
            <div className="mt-2 text-danger">
              <strong>Error:</strong> {diagnosticResults.error}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Prevent modal close when clicking inside the modal
  const handleModalClick = (e) => {
    // Only prevent default and stop propagation, don't close the modal
    e.preventDefault();
    e.stopPropagation();
  };
  
  // Close modal only when explicitly clicking the backdrop
  const handleBackdropClick = (e) => {
    // Only close if clicking directly on the backdrop
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4" 
      style={{ pointerEvents: 'auto' }}
      onClick={handleBackdropClick}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md p-6 relative" 
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          type="button"
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
        
        {authError && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-md">
            <p>{authError}</p>
            {errorMessage && errorMessage.includes('network') && (
              <div className="mt-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm w-100"
                  onClick={runDiagnostics}
                  disabled={isRunningDiagnostics}
                >
                  {isRunningDiagnostics ? 'Running Diagnostics...' : 'Run Connection Diagnostics'}
                </button>
                {renderDiagnosticResults()}
              </div>
            )}
          </div>
        )}
        
        {/* Login form */}
        <form 
          onSubmit={handleSubmit} 
          noValidate 
          onClick={(e) => e.stopPropagation()}
          style={{ position: 'relative', zIndex: 10 }}
        >
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
              ref={emailInputRef}
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
            className="w-full py-3 px-4 bg-gray-900 dark:bg-gray-800 text-white font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-70"
            style={{ position: 'relative', zIndex: 20 }}
            onClick={(e) => {
              e.stopPropagation();
              if (!isSubmitting && !isAuthLoading) {
                handleSubmit(e);
              }
            }}
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
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleGoogleSignIn(e);
              }}
              disabled={isSubmitting || isAuthLoading}
              className="flex items-center justify-center py-3 px-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-70"
              style={{ position: 'relative', zIndex: 20 }}
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
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleGithubSignIn(e);
              }}
              disabled={isSubmitting || isAuthLoading}
              className="flex items-center justify-center py-3 px-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-70"
              style={{ position: 'relative', zIndex: 20 }}
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