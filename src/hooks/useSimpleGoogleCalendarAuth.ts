import { useState, useEffect } from 'react';
import { auth } from '../api/firebase';
import { simpleGoogleOAuthService } from '../services/auth/simpleGoogleOAuth';
import { useUserStore } from '../store/userStore';
import { UserGoogleCalendarToken } from '../types/models';

interface SimpleGoogleCalendarAuthState {
  hasCalendarAccess: boolean;
  isCheckingAccess: boolean;
  error: string | null;
  requestCalendarAccess: () => Promise<void>;
  revokeAccess: () => Promise<void>;
  refreshToken: () => void;
  token: UserGoogleCalendarToken | null;
}

export const useSimpleGoogleCalendarAuth = (): SimpleGoogleCalendarAuthState => {
  const [hasCalendarAccess, setHasCalendarAccess] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<UserGoogleCalendarToken | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Get current user from store to react to user changes
  const { user } = useUserStore();

  useEffect(() => {
    // Reset state when user changes or when explicitly refreshed
    setHasCalendarAccess(false);
    setError(null);
    setIsCheckingAccess(true);
    setToken(null);
    
    if (user) {
      checkCalendarAccess();
    } else {
      setIsCheckingAccess(false);
    }
  }, [user, refreshTrigger]); // Re-run when user changes or refresh is triggered

  const checkCalendarAccess = async () => {
    setIsCheckingAccess(true);
    setError(null);

    try {
      const user = auth.currentUser;
      if (!user) {
        setHasCalendarAccess(false);
        setToken(null);
        return;
      }

      // Check if OAuth2 is configured
      if (!simpleGoogleOAuthService.isConfigured()) {
        console.warn('📅 Google OAuth2 not configured - calendar access unavailable');
        setHasCalendarAccess(false);
        setToken(null);
        return;
      }

      // Check if user has valid calendar access
      const hasAccess = await simpleGoogleOAuthService.hasCalendarAccess();
      const userToken = await simpleGoogleOAuthService.getStoredToken();
      
      setHasCalendarAccess(hasAccess);
      setToken(userToken);
      
      if (hasAccess) {
        console.log('✅ Google Calendar access verified for user:', user.uid);
      } else {
        console.log('❌ No valid calendar access found for user:', user.uid);
      }
    } catch (err) {
      console.error('Error checking calendar access:', err);
      setError(err instanceof Error ? err.message : 'Failed to check calendar access');
      setHasCalendarAccess(false);
      setToken(null);
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

      if (!simpleGoogleOAuthService.isConfigured()) {
        throw new Error('Google OAuth2 Client ID not configured. Please set VITE_GOOGLE_OAUTH_CLIENT_ID in your environment variables.');
      }

      console.log('🔄 Requesting Google Calendar access...');
      const newToken = await simpleGoogleOAuthService.requestCalendarAccess();
      
      // Update state
      setHasCalendarAccess(true);
      setToken(newToken);
      
      console.log('✅ Google Calendar access granted for user:', user.uid);
    } catch (err) {
      console.error('Error requesting calendar access:', err);
      setError(err instanceof Error ? err.message : 'Failed to request calendar access');
      throw err;
    }
  };

  const revokeAccess = async () => {
    setError(null);
    
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      console.log('🗑️ Revoking Google Calendar access...');
      await simpleGoogleOAuthService.revokeAccess();
      
      // Update state
      setHasCalendarAccess(false);
      setToken(null);
      
      console.log('✅ Google Calendar access revoked for user:', user.uid);
    } catch (err) {
      console.error('Error revoking calendar access:', err);
      setError(err instanceof Error ? err.message : 'Failed to revoke calendar access');
      throw err;
    }
  };

  const refreshToken = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return {
    hasCalendarAccess,
    isCheckingAccess,
    error,
    requestCalendarAccess,
    revokeAccess,
    refreshToken,
    token,
  };
};