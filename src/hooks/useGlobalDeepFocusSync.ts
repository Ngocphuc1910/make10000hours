import { useEffect, useRef, useCallback } from 'react';
import { useDeepFocusStore } from '../store/deepFocusStore';
import { useUserStore } from '../store/userStore';

// Global message deduplication to prevent multiple handlers processing same message
let lastProcessedMessage: { timestamp: number; isActive: boolean; messageId: string } | null = null;
const MESSAGE_DEDUPLICATION_WINDOW = 1000; // 1 second

/**
 * Global Deep Focus synchronization hook
 * Handles extension communication and provides centralized deep focus control
 * SINGLE POINT OF TRUTH for extension communication
 */
export const useGlobalDeepFocusSync = () => {
  const isInitialized = useRef(false);
  const { 
    syncFocusStatus, 
    loadFocusStatus,
    isDeepFocusActive,
    enableDeepFocus,
    disableDeepFocus,
    syncCompleteFocusState
  } = useDeepFocusStore();
  
  const { isInitialized: isUserInitialized, user } = useUserStore();

  // Initialize deep focus status on mount
  useEffect(() => {
    if (!user?.uid || !isUserInitialized || isInitialized.current) {
      return;
    }

    const initializeDeepFocusState = async () => {
      try {
        console.log('🚀 Global Deep Focus initialization...');
        await loadFocusStatus();
        console.log('✅ Global Focus status loaded');
        isInitialized.current = true;
      } catch (error) {
        console.error('❌ Error during deep focus initialization:', error);
      }
    };

    initializeDeepFocusState();
  }, [user?.uid, isUserInitialized, loadFocusStatus]);

  // CENTRALIZED extension message handling
  useEffect(() => {
    // Only set up message handler if user is initialized
    if (!isUserInitialized || !user?.uid) {
      console.log('🔄 Waiting for user initialization before setting up extension message handler...');
      return;
    }

    console.log('🔄 Setting up extension message handler for user:', user.uid);

    let lastMessageTime = 0;
    const MESSAGE_DEBOUNCE = 500;

    const handleFocusChange = (event: CustomEvent) => {
      const now = Date.now();
      if (now - lastMessageTime < MESSAGE_DEBOUNCE) {
        return;
      }
      lastMessageTime = now;
      
      const { isActive } = event.detail;
      console.log('🔄 Internal focus change event:', isActive);
      
      if (!event.detail.fromExtension) {
        syncFocusStatus(isActive);
      }
    };

    // CENTRALIZED extension message handler with global deduplication
    const handleExtensionFocusChange = async (event: MessageEvent) => {
      if (event.data?.type === 'EXTENSION_FOCUS_STATE_CHANGED') {
        console.log('🔄 GLOBAL: Extension message received!', event.data);
        
        const now = Date.now();
        if (now - lastMessageTime < MESSAGE_DEBOUNCE) {
          console.log('🔄 GLOBAL: Skipping due to debounce');
          return;
        }
        lastMessageTime = now;
        
        const hasExtensionId = !!event.data?.extensionId;
        const hasPayload = !!event.data?.payload;
        const isActiveBoolean = typeof event.data.payload?.isActive === 'boolean';
        const timestamp = event.data.payload?.timestamp || now;
        
        // Global message deduplication
        const messageId = `${event.data.extensionId}_${event.data.payload.isActive}_${timestamp}`;
        
        if (lastProcessedMessage) {
          const timeDiff = now - lastProcessedMessage.timestamp;
          if (timeDiff < MESSAGE_DEDUPLICATION_WINDOW && 
              lastProcessedMessage.isActive === event.data.payload.isActive &&
              lastProcessedMessage.messageId === messageId) {
            console.log('🔄 GLOBAL: Skipping duplicate extension message:', {
              messageId,
              timeDiff,
              isActive: event.data.payload.isActive
            });
            return;
          }
        }
        
        // Store processed message for deduplication
        lastProcessedMessage = {
          timestamp: now,
          isActive: event.data.payload.isActive,
          messageId
        };
        
        // Verify message is from our extension with proper structure
        if (hasExtensionId && hasPayload && isActiveBoolean) {
          console.log('🔄 GLOBAL: Processing extension focus state change:', event.data.payload);
          const { isActive, blockedSites = [] } = event.data.payload;
          
          try {
            // Use syncCompleteFocusState for extension-originated changes
            await syncCompleteFocusState(isActive, blockedSites);
            console.log('✅ GLOBAL: Extension focus state synchronized successfully');
            
            // Broadcast to other components that the state has been handled globally
            window.dispatchEvent(new CustomEvent('extensionFocusHandled', { 
              detail: { isActive, blockedSites, timestamp: now } 
            }));
          } catch (error) {
            console.error('❌ GLOBAL: Error synchronizing extension focus state:', error);
          }
        } else {
          console.warn('⚠️ GLOBAL: Invalid extension message structure:', {
            hasExtensionId,
            hasPayload,
            isActiveBoolean,
            payload: event.data.payload
          });
        }
      }
    };

    // Handle page visibility changes
    let wasHidden = document.hidden;
    let lastVisibilityChange = 0;
    const handleVisibilityChange = () => {
      const now = Date.now();
      if (now - lastVisibilityChange < 2000) {
        return;
      }
      lastVisibilityChange = now;
      
      if (!document.hidden && wasHidden) {
        console.log('📖 Page became visible - checking for extension state updates');
        setTimeout(() => {
          loadFocusStatus();
        }, 1000);
      }
      wasHidden = document.hidden;
    };

    // Add event listeners
    console.log('🔄 GLOBAL: Adding extension message listeners...');
    window.addEventListener('deepFocusChanged', handleFocusChange as EventListener);
    window.addEventListener('message', handleExtensionFocusChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      console.log('🔄 GLOBAL: Removing extension message listeners...');
      window.removeEventListener('deepFocusChanged', handleFocusChange as EventListener);
      window.removeEventListener('message', handleExtensionFocusChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [syncFocusStatus, loadFocusStatus, isUserInitialized, user?.uid, syncCompleteFocusState]);

  // Memoize toggleDeepFocus to prevent infinite re-renders
  const toggleDeepFocus = useCallback(async () => {
    if (isDeepFocusActive) {
      await disableDeepFocus();
    } else {
      await enableDeepFocus();
    }
  }, [isDeepFocusActive, enableDeepFocus, disableDeepFocus]);

  // Return deep focus state and control functions for components to use
  return {
    isDeepFocusActive,
    enableDeepFocus,
    disableDeepFocus,
    toggleDeepFocus
  };
}; 