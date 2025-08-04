import { useState, useEffect, useCallback } from 'react';
import { extensionServiceUTC } from '../services/extension/extensionServiceUTC';
import { useUserStore } from '../store/userStore';
import { utcFeatureFlags } from '../services/featureFlags';
import { utcMonitoring } from '../services/monitoring';
import type { ExtensionStatus, DeepFocusSession } from '../types/extension';
import type { DeepFocusSessionUTC } from '../services/extension/extensionServiceUTC';

interface UseExtensionUTCReturn {
  // Status
  isExtensionAvailable: boolean;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Extension info
  extensionStatus: ExtensionStatus | null;
  utcSupported: boolean;
  
  // Deep Focus functionality
  activeSession: DeepFocusSessionUTC | null;
  isDeepFocusActive: boolean;
  
  // Actions
  initializeExtension: () => Promise<void>;
  startDeepFocus: (taskId: string, blockedSites?: string[]) => Promise<string | null>;
  endDeepFocus: (sessionId: string) => Promise<DeepFocusSessionUTC | null>;
  trackWebsiteUsage: (url: string, duration: number, category?: string) => Promise<void>;
  refreshStatus: () => Promise<void>;
  handleTimezoneChange: (newTimezone: string) => Promise<void>;
}

export const useExtensionUTC = (): UseExtensionUTCReturn => {
  const { user } = useUserStore();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus | null>(null);
  const [activeSession, setActiveSession] = useState<DeepFocusSessionUTC | null>(null);
  const [utcSupported, setUtcSupported] = useState(false);

  // Check if extension features are enabled for user
  const isFeatureEnabled = useCallback((feature: string): boolean => {
    if (!user) return false;
    return utcFeatureFlags.isFeatureEnabled(feature, user.uid);
  }, [user]);

  // Initialize extension connection
  const initializeExtension = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      // Check if UTC extension features are enabled
      const utcEnabled = isFeatureEnabled('utcExtensionIntegration');
      if (!utcEnabled) {
        console.log('UTC extension integration disabled for user');
        setIsLoading(false);
        return;
      }

      await extensionServiceUTC.initialize(user.uid, user.timezone);
      
      const status = await extensionServiceUTC.getExtensionStatus();
      setIsConnected(status.connected);
      setUtcSupported(status.utcSupported);
      
      setExtensionStatus({
        isInstalled: status.connected,
        isConnected: status.connected,
        features: {
          deepFocus: true,
          websiteTracking: true,
          siteBlocking: true,
          utcSupport: status.utcSupported
        }
      });

      utcMonitoring.trackOperation('extension_hook_initialize', true);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize extension';
      setError(errorMessage);
      setIsConnected(false);
      utcMonitoring.trackOperation('extension_hook_initialize', false);
      console.error('Extension initialization failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, isFeatureEnabled]);

  // Start deep focus session
  const startDeepFocus = useCallback(async (
    taskId: string,
    blockedSites: string[] = []
  ): Promise<string | null> => {
    if (!user || !isConnected) {
      setError('Extension not connected');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const sessionId = await extensionServiceUTC.startDeepFocusSession(
        user.uid,
        taskId,
        blockedSites
      );

      // Create active session object for state management
      const session: DeepFocusSessionUTC = {
        sessionId,
        userId: user.uid,
        startTimeUTC: new Date().toISOString(),
        blockedSites,
        distractionAttempts: 0,
        timezoneContext: {
          timezone: user.timezone || 'UTC',
          source: 'user',
          utcOffset: new Date().getTimezoneOffset()
        }
      };

      setActiveSession(session);
      utcMonitoring.trackOperation('extension_start_deep_focus', true);
      
      return sessionId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start deep focus';
      setError(errorMessage);
      utcMonitoring.trackOperation('extension_start_deep_focus', false);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user, isConnected]);

  // End deep focus session
  const endDeepFocus = useCallback(async (
    sessionId: string
  ): Promise<DeepFocusSessionUTC | null> => {
    if (!user || !isConnected) {
      setError('Extension not connected');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const completedSession = await extensionServiceUTC.endDeepFocusSession(sessionId);
      setActiveSession(null);
      utcMonitoring.trackOperation('extension_end_deep_focus', true);
      
      return completedSession;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to end deep focus';
      setError(errorMessage);
      utcMonitoring.trackOperation('extension_end_deep_focus', false);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user, isConnected]);

  // Track website usage
  const trackWebsiteUsage = useCallback(async (
    url: string,
    duration: number,
    category?: string
  ): Promise<void> => {
    if (!user || !isConnected) return;

    try {
      await extensionServiceUTC.trackWebsiteUsage(user.uid, url, duration, category);
      utcMonitoring.trackOperation('extension_track_usage', true);
    } catch (err) {
      console.error('Failed to track website usage:', err);
      utcMonitoring.trackOperation('extension_track_usage', false);
    }
  }, [user, isConnected]);

  // Refresh extension status
  const refreshStatus = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      const status = await extensionServiceUTC.getExtensionStatus();
      setIsConnected(status.connected);
      setUtcSupported(status.utcSupported);
      
      setExtensionStatus(prev => prev ? {
        ...prev,
        isConnected: status.connected,
        features: {
          ...prev.features,
          utcSupport: status.utcSupported
        }
      } : null);
      
    } catch (err) {
      console.error('Failed to refresh extension status:', err);
      setIsConnected(false);
    }
  }, [user]);

  // Handle timezone changes
  const handleTimezoneChange = useCallback(async (newTimezone: string): Promise<void> => {
    if (!user || !isConnected) return;

    try {
      await extensionServiceUTC.handleTimezoneChange(newTimezone);
      utcMonitoring.trackOperation('extension_timezone_change', true);
    } catch (err) {
      console.error('Failed to handle timezone change in extension:', err);
      utcMonitoring.trackOperation('extension_timezone_change', false);
    }
  }, [user, isConnected]);

  // Initialize extension on user authentication
  useEffect(() => {
    if (user && !isLoading) {
      initializeExtension();
    }
  }, [user, initializeExtension]);

  // Monitor extension connection
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      refreshStatus();
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [isConnected, refreshStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      extensionServiceUTC.cleanup();
    };
  }, []);

  return {
    // Status
    isExtensionAvailable: !!extensionStatus?.isInstalled,
    isConnected,
    isLoading,
    error,
    
    // Extension info
    extensionStatus,
    utcSupported,
    
    // Deep Focus functionality
    activeSession,
    isDeepFocusActive: !!activeSession,
    
    // Actions
    initializeExtension,
    startDeepFocus,
    endDeepFocus,
    trackWebsiteUsage,
    refreshStatus,
    handleTimezoneChange
  };
};