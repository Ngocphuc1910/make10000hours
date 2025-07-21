import { useState, useEffect } from 'react';
import { auth } from '../api/firebase';
import { googleOAuthService } from '../services/auth/googleOAuth';
import { useUserStore } from '../store/userStore';
import { UserGoogleAccount } from '../types/models';

interface GoogleCalendarAuthState {
  hasCalendarAccess: boolean;
  isCheckingAccess: boolean;
  error: string | null;
  requestCalendarAccess: () => Promise<void>;
  // Multi-account properties
  connectedAccounts: UserGoogleAccount[];
  addGoogleAccount: () => Promise<UserGoogleAccount | null>;
  removeAccount: (accountId: string) => Promise<void>;
  switchAccount: (accountId: string) => Promise<void>;
  hasMultipleAccounts: boolean;
}

export const useGoogleCalendarAuth = (): GoogleCalendarAuthState => {
  const [hasCalendarAccess, setHasCalendarAccess] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectedAccounts, setConnectedAccounts] = useState<UserGoogleAccount[]>([]);
  
  // Get current user from store to react to user changes
  const { user } = useUserStore();

  useEffect(() => {
    // Reset state when user changes
    setHasCalendarAccess(false);
    setError(null);
    setIsCheckingAccess(true);
    setConnectedAccounts([]);
    
    if (user) {
      checkCalendarAccess();
      loadConnectedAccounts();
      
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

  const loadConnectedAccounts = async () => {
    try {
      const accounts = await googleOAuthService.getConnectedAccounts();
      setConnectedAccounts(accounts);
    } catch (err) {
      console.error('Error loading connected accounts:', err);
      setConnectedAccounts([]);
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

      // Try to migrate legacy tokens first
      await googleOAuthService.migrateToMultiAccount();

      // Check multi-account calendar access
      const hasAccess = await googleOAuthService.hasMultiAccountCalendarAccess();
      setHasCalendarAccess(hasAccess);
      
      if (hasAccess) {
        console.log('✅ Multi-account calendar access verified');
      } else {
        console.log('❌ No valid calendar access found across accounts');
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

      // Use the new multi-account method
      console.log('🔄 Adding Google Calendar account...');
      const newAccount = await googleOAuthService.addGoogleAccount();
      
      // Refresh the connected accounts list
      await loadConnectedAccounts();
      
      // Recheck calendar access
      await checkCalendarAccess();
      
      console.log('✅ Google Calendar account added successfully:', newAccount.email);
    } catch (err) {
      console.error('Error requesting calendar access:', err);
      setError(err instanceof Error ? err.message : 'Failed to request calendar access');
      throw err;
    }
  };

  const addGoogleAccount = async (): Promise<UserGoogleAccount | null> => {
    setError(null);
    
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      if (!googleOAuthService.isConfigured()) {
        throw new Error('Google OAuth2 Client ID not configured');
      }

      console.log('🔄 Adding new Google account...');
      const newAccount = await googleOAuthService.addGoogleAccount();
      
      // Refresh the connected accounts list
      await loadConnectedAccounts();
      
      // Recheck calendar access
      await checkCalendarAccess();
      
      console.log('✅ New Google account added:', newAccount.email);
      return newAccount;
    } catch (err) {
      console.error('Error adding Google account:', err);
      setError(err instanceof Error ? err.message : 'Failed to add Google account');
      return null;
    }
  };

  const removeAccount = async (accountId: string): Promise<void> => {
    setError(null);
    
    try {
      console.log('🗑️ Removing Google account:', accountId);
      await googleOAuthService.removeAccount(accountId);
      
      // Refresh the connected accounts list
      await loadConnectedAccounts();
      
      // Recheck calendar access
      await checkCalendarAccess();
      
      console.log('✅ Google account removed successfully');
    } catch (err) {
      console.error('Error removing Google account:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove Google account');
      throw err;
    }
  };

  const switchAccount = async (accountId: string): Promise<void> => {
    setError(null);
    
    try {
      console.log('🔄 Switching to account:', accountId);
      await googleOAuthService.switchAccount(accountId);
      
      // Refresh the connected accounts list
      await loadConnectedAccounts();
      
      console.log('✅ Switched to account successfully');
    } catch (err) {
      console.error('Error switching account:', err);
      setError(err instanceof Error ? err.message : 'Failed to switch account');
      throw err;
    }
  };

  return {
    hasCalendarAccess,
    isCheckingAccess,
    error,
    requestCalendarAccess,
    // Multi-account properties
    connectedAccounts,
    addGoogleAccount,
    removeAccount,
    switchAccount,
    hasMultipleAccounts: connectedAccounts.length > 1,
  };
};

export default useGoogleCalendarAuth;