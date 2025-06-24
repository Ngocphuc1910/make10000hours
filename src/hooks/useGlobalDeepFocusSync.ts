import { useEffect } from 'react';
import { useDeepFocusStore } from '../store/deepFocusStore';
import { useUserStore } from '../store/userStore';

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
    disableDeepFocus
  } = useDeepFocusStore();
  
  const { isInitialized: isUserInitialized, user } = useUserStore();

  // CRITICAL: Initialize deep focus status immediately on mount to handle session recovery
  useEffect(() => {
    const initializeDeepFocusState = async () => {
      if (!user?.uid || !isUserInitialized) {
        console.log('🔄 Global Deep Focus initialization waiting for user...');
        return;
      }

      console.log('🚀 IMMEDIATE Global Deep Focus initialization for reload session recovery...');
      
      try {
        // First, load the focus status which handles session recovery/restart
        await loadFocusStatus();
        console.log('✅ Global Focus status loaded, checking for active session recovery...');
        
        // Import the service directly to avoid circular dependencies
        const deepFocusSessionService = await import('../api/deepFocusSessionService').then(m => m.deepFocusSessionService);
        
        // If we still don't have an active session but deep focus is active, force recovery
        const currentState = useDeepFocusStore.getState();
        if (currentState.isDeepFocusActive && !currentState.activeSessionId && !currentState.recoveryInProgress) {
          console.log('🔄 Forcing immediate session recovery...');
          
          // Clean up any orphaned sessions first
          const cleaned = await deepFocusSessionService.cleanupOrphanedSessions(user.uid);
          if (cleaned > 0) {
            console.log(`🧹 Cleaned up ${cleaned} orphaned sessions`);
          }
          
          // Start a new session immediately
          const newSessionId = await deepFocusSessionService.startSession(user.uid);
          console.log('✅ IMMEDIATE session recovery completed:', newSessionId);
          
          // Reload sessions to update UI
          await useDeepFocusStore.getState().loadDeepFocusSessions(user.uid);
          
          // Notify extension immediately of the new session state
          try {
            const ExtensionDataService = await import('../services/extensionDataService').then(m => m.default);
            await ExtensionDataService.enableFocusMode();
            console.log('🔄 Extension notified of immediate session recovery');
          } catch (extError) {
            console.warn('⚠️ Could not notify extension of immediate session recovery:', extError);
          }
        }
      } catch (error) {
        console.error('❌ Failed to initialize deep focus state immediately:', error);
      }
    };

    // Run immediately without delay
    initializeDeepFocusState();
  }, [user?.uid, isUserInitialized, loadFocusStatus]);

  // Listen for focus changes from other components (internal state sync)
  useEffect(() => {
    // Wait for user authentication to initialize
    if (!isUserInitialized) {
      console.log('🔐 Global sync waiting for user authentication...');
      return;
    }

    const handleFocusChange = (event: CustomEvent) => {
      const { isActive } = event.detail;
      console.log('🔄 Internal focus change event:', isActive);
      syncFocusStatus(isActive);
    };

    // Listen for real-time focus state changes from extension
    const handleExtensionFocusChange = (event: MessageEvent) => {
      if (event.data?.type === 'EXTENSION_FOCUS_STATE_CHANGED') {
        const hasExtensionId = !!event.data?.extensionId;
        const hasPayload = !!event.data?.payload;
        const isActiveBoolean = typeof event.data.payload?.isActive === 'boolean';
        
        console.log('🔍 Extension message validation:', {
          type: event.data.type,
          hasExtensionId,
          hasPayload, 
          isActiveBoolean,
          allValid: hasExtensionId && hasPayload && isActiveBoolean
        });
        
        // Verify message is from our extension with proper structure
        if (hasExtensionId && hasPayload && isActiveBoolean) {
          console.log('🔄 Real-time focus state change from extension:', event.data.payload.isActive);
          syncFocusStatus(event.data.payload.isActive);
        }
      }
    };

    // Handle page visibility changes - sync when coming back from hidden state
    let wasHidden = document.hidden;
    const handleVisibilityChange = () => {
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
  }, [syncFocusStatus, loadFocusStatus, isUserInitialized]);

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