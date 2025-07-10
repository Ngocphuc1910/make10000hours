import { useState, useEffect } from 'react';
import { auth } from '../api/firebase';
import { googleOAuthService } from '../services/auth/googleOAuth';
import { useUserStore } from '../store/userStore';

interface GoogleCalendarAuthState {
  hasCalendarAccess: boolean;
  isCheckingAccess: boolean;
  error: string | null;
  requestCalendarAccess: () => Promise<void>;
}

export const useGoogleCalendarAuth = (): GoogleCalendarAuthState => {
  const [hasCalendarAccess, setHasCalendarAccess] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Get current user from store to react to user changes
  const { user } = useUserStore();

  useEffect(() => {
    // Reset state when user changes
    setHasCalendarAccess(false);
    setError(null);
    setIsCheckingAccess(true);
    
    if (user) {
      checkCalendarAccess();
      
      // Check for OAuth callback on page load
      handleOAuthCallback();
    } else {
      setIsCheckingAccess(false);
    }
  }, [user]); // Re-run when user changes

  const handleOAuthCallback = async () => {
    try {
      const handled = await googleOAuthService.handleOAuthCallback();
      if (handled) {
        // OAuth flow completed, recheck access
        await checkCalendarAccess();
      }
    } catch (err) {
      console.error('OAuth callback error:', err);
      setError(err instanceof Error ? err.message : 'OAuth callback failed');
    }
  };

  const checkCalendarAccess = async () => {
    setIsCheckingAccess(true);
    setError(null);

    try {
      const user = auth.currentUser;
      if (!user) {
        setHasCalendarAccess(false);
        return;
      }

      // Check if OAuth2 is configured
      if (!googleOAuthService.isConfigured()) {
        console.warn('📅 Google OAuth2 not configured - calendar access unavailable');
        setHasCalendarAccess(false);
        return;
      }

      // Check if we have a valid calendar access token
      const hasAccess = await googleOAuthService.hasCalendarAccess();
      setHasCalendarAccess(hasAccess);
      
      if (hasAccess) {
        console.log('✅ Calendar access verified');
      } else {
        console.log('❌ No calendar access token found');
      }
    } catch (err) {
      console.error('Error checking calendar access:', err);
      setError(err instanceof Error ? err.message : 'Failed to check calendar access');
      setHasCalendarAccess(false);
    } finally {
      setIsCheckingAccess(false);
    }
  };

  const requestCalendarAccess = async () => {
    setError(null);
    
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      if (!googleOAuthService.isConfigured()) {
        throw new Error('Google OAuth2 Client ID not configured. Please set VITE_GOOGLE_OAUTH_CLIENT_ID in your environment variables.');
      }

      // Start OAuth2 flow - this will redirect to Google
      console.log('🔄 Starting Google Calendar authorization...');
      await googleOAuthService.requestCalendarAccess();
      
      // Note: This line won't execute because requestCalendarAccess() redirects the page
      // The OAuth callback will be handled when the user returns from Google
    } catch (err) {
      console.error('Error requesting calendar access:', err);
      setError(err instanceof Error ? err.message : 'Failed to request calendar access');
      throw err;
    }
  };

  return {
    hasCalendarAccess,
    isCheckingAccess,
    error,
    requestCalendarAccess,
  };
};

export default useGoogleCalendarAuth;