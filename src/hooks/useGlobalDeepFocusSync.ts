import { useEffect, useRef } from 'react';
import { useDeepFocusStore } from '../store/deepFocusStore';
import { useUserStore } from '../store/userStore';
import { debugDeepFocus, debugGeneral } from '../utils/debugUtils';

/**
 * Global Deep Focus synchronization hook
 * Replaces individual component-level focus state management
 * Provides centralized extension message handling for all pages
 */
export const useGlobalDeepFocusSync = () => {
  const { 
    syncFocusStatus, 
    loadFocusStatus,
    isDeepFocusActive,
    enableDeepFocus,
    disableDeepFocus,
    syncCompleteFocusState
  } = useDeepFocusStore();
  
  const { isInitialized: isUserInitialized, user } = useUserStore();
  
  // Add refs to track state changes and prevent circular updates
  const lastSyncTime = useRef(0);
  const lastExtensionUpdate = useRef(0);
  const syncInProgress = useRef(false);

  // CRITICAL: Initialize deep focus status immediately on mount to handle session recovery
  useEffect(() => {
    const initializeDeepFocusState = async () => {
      if (!user?.uid || !isUserInitialized || syncInProgress.current) {
        return;
      }

      try {
        syncInProgress.current = true;
        
        // First, load the focus status which handles session recovery/restart
        await loadFocusStatus();
        
        // Only log completion with essential info
        debugDeepFocus('✅ Deep Focus initialization completed', {
          userId: user.uid,
          isActive: useDeepFocusStore.getState().isDeepFocusActive
        });
        
        // Import the service directly to avoid circular dependencies
        const { deepFocusSessionService } = await import('../api/deepFocusSessionService');
        
        // Check if we need to recover a session (either from reload or new tab)
        const currentState = useDeepFocusStore.getState();
        const storedState = localStorage.getItem('deep-focus-storage');
        const parsedState = storedState ? JSON.parse(storedState) : null;
        
        // If there's an active session in storage but not in current state, we're in a new tab
        const isNewTab = parsedState?.isDeepFocusActive && !currentState.activeSessionId;
        
        if (isNewTab) {
          debugDeepFocus('📱 New tab detected, syncing state', {
            activeSession: parsedState.activeSessionId,
            isActive: parsedState.isDeepFocusActive
          });
          
          useDeepFocusStore.setState({
            isDeepFocusActive: parsedState.isDeepFocusActive,
            activeSessionId: parsedState.activeSessionId,
            activeSessionStartTime: new Date(parsedState.activeSessionStartTime),
            activeSessionDuration: parsedState.activeSessionDuration,
            activeSessionElapsedSeconds: parsedState.activeSessionElapsedSeconds,
            isSessionPaused: parsedState.isSessionPaused,
            pausedAt: parsedState.pausedAt ? new Date(parsedState.pausedAt) : null,
            totalPausedTime: parsedState.totalPausedTime
          });
        }
      } catch (error) {
        console.error('❌ Error during deep focus initialization:', error);
      } finally {
        syncInProgress.current = false;
      }
    };

    initializeDeepFocusState();
  }, [user?.uid, isUserInitialized, loadFocusStatus]);

  // Listen for focus changes from other components (internal state sync)
  useEffect(() => {
    // Wait for user authentication to initialize
    if (!isUserInitialized) {
      debugGeneral('🔐 Global sync waiting for user authentication...');
      return;
    }

    const handleFocusChange = (event: CustomEvent) => {
      const { isActive } = event.detail;
      const now = Date.now();
      
      // Prevent rapid re-syncs
      if (now - lastSyncTime.current < 1000) {
        return;
      }
      
      lastSyncTime.current = now;
      debugDeepFocus('🔄 Internal focus change event:', isActive);
      syncFocusStatus(isActive);
    };

    // Listen for real-time focus state changes from extension
    const handleExtensionFocusChange = async (event: MessageEvent) => {
      if (event.data?.type === 'EXTENSION_FOCUS_STATE_CHANGED') {
        const now = Date.now();
        
        // Prevent rapid re-syncs from extension
        if (now - lastExtensionUpdate.current < 1000) {
          return;
        }
        
        lastExtensionUpdate.current = now;
        
        const hasExtensionId = !!event.data?.extensionId;
        const hasPayload = !!event.data?.payload;
        const isActiveBoolean = typeof event.data.payload?.isActive === 'boolean';
        const hasBlockedSites = Array.isArray(event.data.payload?.blockedSites);
        
        // Verify message is from our extension with proper structure
        if (hasExtensionId && hasPayload && isActiveBoolean && !syncInProgress.current) {
          debugDeepFocus('🔄 Real-time focus state change from extension:', event.data.payload);
          const { isActive, blockedSites = [] } = event.data.payload;
          
          syncInProgress.current = true;
          try {
            // Use syncCompleteFocusState instead of syncFocusStatus
            await syncCompleteFocusState(isActive, blockedSites);
          } finally {
            syncInProgress.current = false;
          }
        }
      }
    };

    // Handle page visibility changes - sync when coming back from hidden state
    let wasHidden = document.hidden;
    const handleVisibilityChange = () => {
      if (!document.hidden && wasHidden) {
        const now = Date.now();
        
        // Prevent rapid re-syncs on visibility change
        if (now - lastSyncTime.current < 1000) {
          return;
        }
        
        lastSyncTime.current = now;
        debugGeneral('📖 Page became visible - checking for extension state updates');
        setTimeout(() => {
          if (!syncInProgress.current) {
            loadFocusStatus();
          }
        }, 500);
      }
      wasHidden = document.hidden;
    };

    // Add event listeners
    window.addEventListener('deepFocusChanged', handleFocusChange as EventListener);
    window.addEventListener('message', handleExtensionFocusChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      window.removeEventListener('deepFocusChanged', handleFocusChange as EventListener);
      window.removeEventListener('message', handleExtensionFocusChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [syncFocusStatus, loadFocusStatus, isUserInitialized]);

  // Return deep focus state and control functions for components to use
  return {
    isDeepFocusActive,
    enableDeepFocus,
    disableDeepFocus,
    toggleDeepFocus: async () => {
      if (syncInProgress.current) {
        return;
      }
      
      syncInProgress.current = true;
      try {
        if (isDeepFocusActive) {
          await disableDeepFocus();
        } else {
          await enableDeepFocus();
        }
      } finally {
        syncInProgress.current = false;
      }
    }
  };
}; 