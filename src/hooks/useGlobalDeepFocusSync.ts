import { useEffect, useRef } from 'react';
import { useDeepFocusStore } from '../store/deepFocusStore';
import { useUserStore } from '../store/userStore';

// Global state locks to prevent concurrent operations
let isInitializing = false;
let hasInitialized = false;
const initializationLock = { current: false };

/**
 * Global Deep Focus synchronization hook
 * Replaces individual component-level focus state management
 * Provides centralized extension message handling for all pages
 */
export const useGlobalDeepFocusSync = () => {
  const initRef = useRef(false);
  const { 
    syncFocusStatus, 
    loadFocusStatus,
    isDeepFocusActive,
    enableDeepFocus,
    disableDeepFocus,
    syncCompleteFocusState
  } = useDeepFocusStore();
  
  const { isInitialized: isUserInitialized, user } = useUserStore();

  // CRITICAL: Initialize deep focus status immediately on mount to handle session recovery
  useEffect(() => {
    // Prevent multiple initialization calls
    if (initRef.current || isInitializing || hasInitialized) {
      return;
    }

    const initializeDeepFocusState = async () => {
      if (!user?.uid || !isUserInitialized || initializationLock.current) {
        return;
      }

      initializationLock.current = true;
      isInitializing = true;
      initRef.current = true;
      
      try {
        console.log('🚀 IMMEDIATE Global Deep Focus initialization for reload/new tab session recovery...');
        
        // First, load the focus status which handles session recovery/restart
        await loadFocusStatus();
        console.log('✅ Global Focus status loaded, checking for active session recovery...');
        
        // Import the service directly to avoid circular dependencies
        const { deepFocusSessionService } = await import('../api/deepFocusSessionService');
        
        // Check if we need to recover a session (either from reload or new tab)
        const currentState = useDeepFocusStore.getState();
        const storedState = localStorage.getItem('deep-focus-storage');
        const parsedState = storedState ? JSON.parse(storedState) : null;
        
        // If there's an active session in storage but not in current state, we're in a new tab
        const isNewTab = parsedState?.isDeepFocusActive && !currentState.activeSessionId;
        
        if (isNewTab) {
          console.log('📱 New tab detected, syncing deep focus state...');
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
        
        hasInitialized = true;
      } catch (error) {
        console.error('❌ Error during deep focus initialization:', error);
      } finally {
        isInitializing = false;
        initializationLock.current = false;
      }
    };

    initializeDeepFocusState();
  }, [user?.uid, isUserInitialized, loadFocusStatus]);

  // Listen for focus changes from other components (internal state sync)
  useEffect(() => {
    // Wait for user authentication to initialize
    if (!isUserInitialized || !hasInitialized) {
      return;
    }

    let lastMessageTime = 0;
    const MESSAGE_DEBOUNCE = 200; // Reduced from 500ms to 200ms for faster response

    const handleFocusChange = (event: CustomEvent) => {
      const now = Date.now();
      if (now - lastMessageTime < MESSAGE_DEBOUNCE) {
        return; // Skip rapid messages
      }
      lastMessageTime = now;
      
      const { isActive } = event.detail;
      console.log('🔄 Internal focus change event:', isActive);
      syncFocusStatus(isActive);
    };

    // Listen for real-time focus state changes from extension
    const handleExtensionFocusChange = async (event: MessageEvent) => {
      if (event.data?.type === 'EXTENSION_FOCUS_STATE_CHANGED') {
        const now = Date.now();
        if (now - lastMessageTime < MESSAGE_DEBOUNCE) {
          return; // Skip rapid messages
        }
        lastMessageTime = now;
        
        const hasExtensionId = !!event.data?.extensionId;
        const hasPayload = !!event.data?.payload;
        const isActiveBoolean = typeof event.data.payload?.isActive === 'boolean';
        const hasBlockedSites = Array.isArray(event.data.payload?.blockedSites);
        
        // Verify message is from our extension with proper structure
        if (hasExtensionId && hasPayload && isActiveBoolean) {
          console.log('🔄 Real-time focus state change from extension:', event.data.payload);
          const { isActive, blockedSites = [] } = event.data.payload;
          
          // Use syncCompleteFocusState instead of syncFocusStatus
          await syncCompleteFocusState(isActive, blockedSites);
        }
      }
    };

    // Handle page visibility changes - sync when coming back from hidden state
    let wasHidden = document.hidden;
    let lastVisibilityChange = 0;
    const handleVisibilityChange = () => {
      const now = Date.now();
      if (now - lastVisibilityChange < 1000) {
        return; // Debounce visibility changes
      }
      lastVisibilityChange = now;
      
      if (!document.hidden && wasHidden) {
        console.log('📖 Page became visible - checking for extension state updates');
        setTimeout(() => {
          loadFocusStatus();
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
  }, [syncFocusStatus, loadFocusStatus, isUserInitialized, hasInitialized]);

  // Return deep focus state and control functions for components to use
  return {
    isDeepFocusActive,
    enableDeepFocus,
    disableDeepFocus,
    toggleDeepFocus: async () => {
      if (isDeepFocusActive) {
        await disableDeepFocus();
      } else {
        await enableDeepFocus();
      }
    }
  };
}; 