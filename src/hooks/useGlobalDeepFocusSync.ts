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
  
  const { isInitialized: isUserInitialized } = useUserStore();

  useEffect(() => {
    // Wait for user authentication to initialize
    if (!isUserInitialized) {
      console.log('🔐 Global sync waiting for user authentication...');
      return;
    }

    // Listen for focus changes from other components (internal state sync)
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

    console.log('✅ Global Deep Focus sync initialized');

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