import React, { createContext, useContext, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useDeepFocusStore } from '../store/deepFocusStore';
import { useUserStore } from '../store/userStore';
import { Source } from '../types/models';

// Global state locks to prevent concurrent operations
let isInitializing = false;
let hasInitialized = false;
const initializationLock = { current: false };

// Global processed messages tracking for override sessions (persist across component unmounts)
const globalProcessedMessages = new Set<string>();

// Global message deduplication
const processedMessages = new Set<string>();
const MESSAGE_DEBOUNCE = 500; // ms
let lastMessageTime = 0;

// Error recovery configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms
const retryAttempts = new Map<string, number>();

// Retry helper function
const retryOperation = async (
  operationId: string,
  operation: () => Promise<void>,
  maxRetries: number = MAX_RETRIES,
  delay: number = RETRY_DELAY
): Promise<void> => {
  try {
    await operation();
    // Clear retry count on success
    retryAttempts.delete(operationId);
  } catch (error) {
    const attempts = retryAttempts.get(operationId) || 0;
    if (attempts < maxRetries) {
      console.log(`🔄 Retry attempt ${attempts + 1} for operation: ${operationId}`);
      retryAttempts.set(operationId, attempts + 1);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryOperation(operationId, operation, maxRetries, delay);
    } else {
      retryAttempts.delete(operationId);
      throw error;
    }
  }
};

interface DeepFocusContextType {
  isDeepFocusActive: boolean;
  enableDeepFocus: (source?: Source) => Promise<void>;
  disableDeepFocus: () => Promise<void>;
  toggleDeepFocus: () => Promise<void>;
  isInitialized: boolean;
}

const DeepFocusContext = createContext<DeepFocusContextType | undefined>(undefined);

interface DeepFocusProviderProps {
  children: ReactNode;
}

export const DeepFocusProvider: React.FC<DeepFocusProviderProps> = ({ children }) => {
  const initRef = useRef(false);
  const [isContextInitialized, setIsContextInitialized] = React.useState(false);
  
  const { 
    syncFocusStatus, 
    loadFocusStatus,
    isDeepFocusActive,
    enableDeepFocus: storeEnableDeepFocus,
    disableDeepFocus: storeDisableDeepFocus,
    syncCompleteFocusState,
    recordOverrideSession,
    loadOverrideSessions
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
        console.log('🚀 CENTRALIZED Deep Focus initialization for session recovery...');
        
        // First, load the focus status which handles session recovery/restart
        await loadFocusStatus();
        console.log('✅ Centralized Focus status loaded, checking for active session recovery...');
        
        // Import the service directly to avoid circular dependencies
        const { deepFocusSessionService } = await import('../api/deepFocusSessionService');
        
        // Check if we need to recover a session (either from reload or new tab)
        const currentState = useDeepFocusStore.getState();
        const storedState = localStorage.getItem('deep-focus-storage');
        const parsedState = storedState ? JSON.parse(storedState) : null;
        
        // If there's an active session in storage but not in current state, we're in a new tab
        const isNewTab = parsedState?.isDeepFocusActive && !currentState.activeSessionId;
        
        if (isNewTab) {
          console.log('📱 New tab detected via context, syncing deep focus state...');
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
        
        // DISABLED: Context recovery logic that was creating sessions at wrong times
        // Only clean up orphaned sessions, don't auto-create new ones
        if (currentState.isDeepFocusActive && !currentState.activeSessionId && !currentState.recoveryInProgress) {
          console.log('🔄 Context: Deep Focus active but no session - cleaning up and resetting state...');
          
          // Clean up any orphaned sessions first
          const cleanedCount = await deepFocusSessionService.cleanupOrphanedSessions(user.uid);
          if (cleanedCount > 0) {
            console.log(`✅ Context: Cleaned up ${cleanedCount} orphaned session(s)`);
          }
          
          // Reset state to inactive since no active session exists
          useDeepFocusStore.setState({
            isDeepFocusActive: false,
            activeSessionId: null,
            activeSessionStartTime: null,
            activeSessionDuration: 0,
            activeSessionElapsedSeconds: 0,
            timer: null,
            secondTimer: null,
            hasRecoveredSession: false,
            recoveryInProgress: false
          });
          
          console.log('✅ Context: Reset deep focus state to inactive (no active session)');
        }
        
        hasInitialized = true;
        setIsContextInitialized(true);
      } catch (error) {
        console.error('❌ Error during centralized deep focus initialization:', error);
      } finally {
        isInitializing = false;
        initializationLock.current = false;
      }
    };

    initializeDeepFocusState();
  }, [user?.uid, isUserInitialized, loadFocusStatus]);

  // GLOBAL OVERRIDE SESSION RECORDING - Works regardless of current page
  useEffect(() => {
    // Wait for user authentication to initialize
    if (!isUserInitialized || !user?.uid) {
      return;
    }

    const handleExtensionMessage = async (event: any) => {
      try {
        // Handle both Chrome extension messages and window messages
        const messageData = event.data || event;
        
        // Only handle override session recording messages
        if (messageData?.type === 'RECORD_OVERRIDE_SESSION' && 
            (messageData?.source?.includes('make10000hours') || 
             messageData?.source?.includes('extension'))) {
          
          console.log('🌐 GLOBAL: RECORD_OVERRIDE_SESSION received in DeepFocusContext:', messageData);
          console.log('🌐 GLOBAL: Current page:', window.location.pathname);
          console.log('🌐 GLOBAL: User state:', { user: user?.uid, isLoggedIn: !!user });
          
          const { domain, duration, userId: incomingUserId, timestamp, extensionTimestamp } = messageData.payload || {};
          
          // Create unique message ID to prevent duplicate processing
          const messageId = `${domain}_${duration}_${extensionTimestamp || timestamp || Date.now()}`;
          
          if (globalProcessedMessages.has(messageId)) {
            console.log('🔄 GLOBAL: Skipping duplicate override session message:', messageId);
            return;
          }
          
          // Mark message as processed globally
          globalProcessedMessages.add(messageId);
          
          // Clean up old processed messages (keep only last 100)
          if (globalProcessedMessages.size > 100) {
            const array = Array.from(globalProcessedMessages);
            const toKeep = array.slice(-50); // Keep only last 50
            globalProcessedMessages.clear();
            toKeep.forEach(id => globalProcessedMessages.add(id));
          }
          
          // Use incoming userId or fallback to current user
          const effectiveUserId = incomingUserId || user?.uid;
          
          console.log('🌐 GLOBAL: Override session data validation:', {
            domain,
            duration,
            incomingUserId,
            currentUserUid: user?.uid,
            effectiveUserId,
            timestamp,
            hasUser: !!user
          });

          if (!effectiveUserId) {
            console.error('❌ GLOBAL: No user ID available for override session');
            return;
          }

          if (!domain || !duration) {
            console.error('❌ GLOBAL: Missing required override session data:', { domain, duration });
            return;
          }

          try {
            console.log('📝 GLOBAL: Recording override session from extension:', domain, duration, 'for user:', effectiveUserId);
            
            // Record the override session using the store function
            await recordOverrideSession(domain, duration);
            console.log('✅ GLOBAL: Override session recorded successfully');
            
            // Broadcast custom event to notify any listening components (like DeepFocusPage)
            window.dispatchEvent(new CustomEvent('overrideSessionRecorded', {
              detail: { domain, duration, userId: effectiveUserId, timestamp: Date.now() }
            }));
            
          } catch (error) {
            console.error('❌ GLOBAL: Failed to record override session:', error);
            console.error('🔍 GLOBAL: Override session error details:', {
              name: (error as Error)?.name,
              message: (error as Error)?.message,
              stack: (error as Error)?.stack,
              domain,
              duration,
              userId: effectiveUserId
            });
          }
        }
      } catch (error) {
        console.error('Error in global extension message handler:', error);
      }
    };

    console.log('🌐 GLOBAL: Setting up override session recording listeners');

    // Listen for window messages (for extension communication)
    window.addEventListener('message', handleExtensionMessage);
    
    // Listen for Chrome extension messages if available (with try-catch)
    try {
      if (typeof (window as any).chrome !== 'undefined' && 
          (window as any).chrome?.runtime?.onMessage?.addListener) {
        (window as any).chrome.runtime.onMessage.addListener(handleExtensionMessage);
      }
    } catch (error) {
      console.warn('Could not set up Chrome extension listener in context:', error);
    }

    // Cleanup function
    return () => {
      try {
        console.log('🌐 GLOBAL: Cleaning up override session recording listeners');
        window.removeEventListener('message', handleExtensionMessage);
        if (typeof (window as any).chrome !== 'undefined' && 
            (window as any).chrome?.runtime?.onMessage?.removeListener) {
          (window as any).chrome.runtime.onMessage.removeListener(handleExtensionMessage);
        }
      } catch (error) {
        console.warn('Error cleaning up global extension listeners:', error);
      }
    };
  }, [user?.uid, isUserInitialized, recordOverrideSession]);

  // Enhanced message handling with retry
  useEffect(() => {
    if (!isUserInitialized || !user?.uid) {
      console.log('🔄 Waiting for user initialization before setting up message handler...');
      return;
    }

    const handleExtensionMessage = async (event: MessageEvent) => {
      const now = Date.now();
      
      try {
        // Handle focus state changes from extension
        if (event.data?.type === 'EXTENSION_FOCUS_STATE_CHANGED' || 
            event.data?.type === 'FOCUS_STATE_CHANGED') {
          
          if (now - lastMessageTime < MESSAGE_DEBOUNCE) {
            console.log('🔄 Skipping message due to debounce');
            return;
          }
          lastMessageTime = now;

          // Message deduplication
          const messageId = `${event.data.extensionId}_${event.data.payload?.isActive}_${now}`;
          if (processedMessages.has(messageId)) {
            console.log('🔄 Skipping duplicate message:', messageId);
            return;
          }
          processedMessages.add(messageId);

          // Clean up old message IDs (keep last 5 minutes)
          const CLEANUP_THRESHOLD = 5 * 60 * 1000; // 5 minutes
          processedMessages.forEach(id => {
            const [, , timestamp] = id.split('_');
            if (now - parseInt(timestamp) > CLEANUP_THRESHOLD) {
              processedMessages.delete(id);
            }
          });

          console.log('🔄 Processing focus state change:', event.data);
          const { isActive, blockedSites = [] } = event.data.payload;

          // Sync complete focus state with retry
          await retryOperation(
            `sync_focus_${messageId}`,
            async () => {
              await syncCompleteFocusState(isActive, blockedSites);
              
              // Broadcast that state was handled
              window.dispatchEvent(new CustomEvent('focusStateHandled', { 
                detail: { isActive, timestamp: now } 
              }));
            }
          );
        }
      } catch (error) {
        console.error('Error handling extension message:', error);
        // Broadcast error for error boundary handling
        window.dispatchEvent(new CustomEvent('focusStateError', { 
          detail: { error, timestamp: now } 
        }));
      }
    };

    // Add message listener
    window.addEventListener('message', handleExtensionMessage);
    
    // Cleanup
    return () => {
      window.removeEventListener('message', handleExtensionMessage);
    };
  }, [isUserInitialized, user?.uid, syncCompleteFocusState]);

  // Listen for focus changes from other components (internal state sync)
  useEffect(() => {
    // Wait for user authentication to initialize
    if (!isUserInitialized || !hasInitialized) {
      return;
    }

    let lastMessageTime = 0;
    const MESSAGE_DEBOUNCE = 500;

    const handleFocusChange = (event: CustomEvent) => {
      const now = Date.now();
      if (now - lastMessageTime < MESSAGE_DEBOUNCE) {
        return; // Skip rapid messages
      }
      lastMessageTime = now;
      
      const { isActive } = event.detail;
      console.log('🔄 Context: Internal focus change event:', isActive);
      // Only sync if change comes from internal webapp actions, not extension
      if (!event.detail.fromExtension) {
        syncFocusStatus(isActive);
      }
    };

    // Listen for centrally handled extension focus changes
    const handleExtensionFocusHandled = (event: CustomEvent) => {
      console.log('🔄 Context: Extension focus state handled centrally:', event.detail);
      // Extension message has been processed by useGlobalDeepFocusSync
      // No action needed here, just log for debugging
    };

    // Handle page visibility changes - sync when coming back from hidden state
    let wasHidden = document.hidden;
    let lastVisibilityChange = 0;
    const handleVisibilityChange = () => {
      const now = Date.now();
      if (now - lastVisibilityChange < 2000) {
        return; // Debounce visibility changes
      }
      lastVisibilityChange = now;
      
      if (!document.hidden && wasHidden) {
        console.log('📖 Context: Page became visible - checking for extension state updates');
        setTimeout(() => {
          loadFocusStatus();
        }, 1000);
      }
      wasHidden = document.hidden;
    };

    // Add event listeners
    window.addEventListener('deepFocusChanged', handleFocusChange as EventListener);
    window.addEventListener('extensionFocusHandled', handleExtensionFocusHandled as EventListener);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      window.removeEventListener('deepFocusChanged', handleFocusChange as EventListener);
      window.removeEventListener('extensionFocusHandled', handleExtensionFocusHandled as EventListener);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [syncFocusStatus, loadFocusStatus, isUserInitialized, hasInitialized, syncCompleteFocusState]);

  // Enhanced session guards with comprehensive checking
  const enableDeepFocus = useCallback(async (source?: Source) => {
    const state = useDeepFocusStore.getState();
    
    // Authentication guard
    if (!user?.uid) {
      console.warn('⚠️ Context: User not authenticated - cannot enable deep focus');
      return;
    }
    
    // Comprehensive guards to prevent duplicate sessions
    if (state.isDeepFocusActive) {
      console.log('🟢 Context: enableDeepFocus ignored - already active');
      return;
    }
    
    if (state.activeSessionId) {
      console.log('🟢 Context: enableDeepFocus ignored - session already exists:', state.activeSessionId);
      return;
    }
    
    if (state.recoveryInProgress) {
      console.log('🟢 Context: enableDeepFocus ignored - recovery in progress');
      return;
    }
    
    console.log('🟢 Context: enableDeepFocus called for user:', user.uid);
    
    try {
      await storeEnableDeepFocus(source);
    } catch (error) {
      console.error('❌ Context: Failed to enable deep focus:', error);
      throw error;
    }
  }, [user?.uid, storeEnableDeepFocus]);

  const disableDeepFocus = useCallback(async () => {
    if (!user?.uid) {
      console.warn('⚠️ Context: User not authenticated - cannot disable deep focus');
      return;
    }
    
    console.log('🔴 Context: disableDeepFocus called for user:', user.uid);
    
    try {
      await storeDisableDeepFocus();
    } catch (error) {
      console.error('❌ Context: Failed to disable deep focus:', error);
      throw error;
    }
  }, [user?.uid, storeDisableDeepFocus]);

  // Memoize toggleDeepFocus to prevent infinite re-renders
  const toggleDeepFocus = useCallback(async () => {
    if (isDeepFocusActive) {
      await disableDeepFocus();
    } else {
      await enableDeepFocus();
    }
  }, [isDeepFocusActive, enableDeepFocus, disableDeepFocus]);

  const contextValue: DeepFocusContextType = {
    isDeepFocusActive,
    enableDeepFocus,
    disableDeepFocus,
    toggleDeepFocus,
    isInitialized: isContextInitialized
  };

  return (
    <DeepFocusContext.Provider value={contextValue}>
      {children}
    </DeepFocusContext.Provider>
  );
};

export const useDeepFocusContext = () => {
  const context = useContext(DeepFocusContext);
  if (context === undefined) {
    throw new Error('useDeepFocusContext must be used within a DeepFocusProvider');
  }
  return context;
}; 