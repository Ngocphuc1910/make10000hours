import React, { createContext, useContext, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useDeepFocusStore } from '../store/deepFocusStore';
import { useUserStore } from '../store/userStore';
import { Source } from '../types/models';

// Global state locks to prevent concurrent operations
let isInitializing = false;
let hasInitialized = false;
const initializationLock = { current: false };

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