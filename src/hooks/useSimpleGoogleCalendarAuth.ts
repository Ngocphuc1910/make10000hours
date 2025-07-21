import { useState, useEffect, useRef } from 'react';
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
  
  // Track if monitoring is currently active
  const isMonitoringActiveRef = useRef(false);

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

  // Manage webhook monitoring based on sync state
  useEffect(() => {
    const manageWebhookMonitoring = async () => {
      if (!user?.uid || !token) {
        // Stop monitoring if no user or token
        if (isMonitoringActiveRef.current) {
          try {
            const { useSyncStore } = await import('../store/syncStore');
            const { syncManager } = await import('../services/sync/syncManager');
            
            useSyncStore.getState().stopWebhookMonitoring();
            syncManager.stopPolling();
            isMonitoringActiveRef.current = false;
            console.log('🔕 Stopped Google Calendar monitoring - user/token unavailable');
          } catch (error) {
            console.warn('⚠️ Error stopping webhook monitoring:', error);
          }
        }
        return;
      }

      try {
        const { useSyncStore } = await import('../store/syncStore');
        const syncStore = useSyncStore.getState();
        
        // Check if sync should be active
        const shouldMonitor = token.syncEnabled && syncStore.syncEnabled && hasCalendarAccess;
        
        if (shouldMonitor && !isMonitoringActiveRef.current) {
          // Start monitoring
          console.log('🔔 Starting Google Calendar webhook monitoring for user:', user.uid);
          syncStore.startWebhookMonitoring();
          
          // Start polling as fallback
          const { createSyncManager } = await import('../services/sync/syncManager');
          const syncManager = createSyncManager(user.uid);
          syncManager.startPolling();
          
          isMonitoringActiveRef.current = true;
          console.log('✅ Google Calendar monitoring started');
          
        } else if (!shouldMonitor && isMonitoringActiveRef.current) {
          // Stop monitoring
          console.log('🔕 Stopping Google Calendar webhook monitoring');
          syncStore.stopWebhookMonitoring();
          
          const { createSyncManager } = await import('../services/sync/syncManager');
          const syncManager = createSyncManager(user.uid);
          syncManager.stopPolling();
          
          isMonitoringActiveRef.current = false;
          console.log('✅ Google Calendar monitoring stopped');
        }
      } catch (error) {
        console.warn('⚠️ Error managing webhook monitoring:', error);
      }
    };

    manageWebhookMonitoring();
  }, [user?.uid, token?.syncEnabled, hasCalendarAccess]);

  // Cleanup monitoring on unmount
  useEffect(() => {
    return () => {
      if (isMonitoringActiveRef.current) {
        import('../store/syncStore').then(({ useSyncStore }) => {
          useSyncStore.getState().stopWebhookMonitoring();
        }).catch(console.warn);
        
        import('../services/sync/syncManager').then(({ createSyncManager }) => {
          if (user?.uid) {
            const syncManager = createSyncManager(user.uid);
            syncManager.stopPolling();
          }
        }).catch(console.warn);
        
        isMonitoringActiveRef.current = false;
      }
    };
  }, []);

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