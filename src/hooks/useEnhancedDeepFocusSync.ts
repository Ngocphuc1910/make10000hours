import { useEffect } from 'react';
import { useDeepFocusStore } from '../store/deepFocusStore';
import { useActivityDetection } from './useActivityDetection';

export const useEnhancedDeepFocusSync = () => {
  const { 
    syncFocusStatus, 
    loadFocusStatus,
    isDeepFocusActive,
    autoSessionManagement,
    pauseSessionOnInactivity,
    resumeSessionOnActivity,
    isSessionPaused
  } = useDeepFocusStore();

  // Configure activity detection with session management integration
  const { 
    isActive, 
    isVisible, 
    inactivityDuration,
    lastActivity 
  } = useActivityDetection({
    inactivityThreshold: 300, // 5 minutes before considering inactive
    heartbeatInterval: 30, // Check every 30 seconds
    onActivityChange: (state) => {
      // Only handle if auto session management is enabled and deep focus is active
      if (!autoSessionManagement || !isDeepFocusActive) {
        return;
      }

      console.log('🔍 Activity state changed:', {
        isActive: state.isActive,
        isVisible: state.isVisible,
        inactivityDuration: state.inactivityDuration,
        isSessionPaused,
        deepFocusActive: isDeepFocusActive
      });

      // Resume session if user became active and session was paused
      if (state.isActive && isSessionPaused) {
        resumeSessionOnActivity();
      }
    },
    onInactivityTimeout: (duration) => {
      // Only handle if auto session management is enabled and deep focus is active
      if (!autoSessionManagement || !isDeepFocusActive) {
        return;
      }

      console.log('⏰ Inactivity timeout detected:', duration, 'seconds');
      
      // Pause session if not already paused
      if (!isSessionPaused) {
        pauseSessionOnInactivity(duration);
      }
    },
    onVisibilityChange: (isVisible) => {
      // Handle page visibility changes for session management
      if (!autoSessionManagement || !isDeepFocusActive) {
        return;
      }

      console.log('👁️ Page visibility changed:', isVisible);

      if (isVisible && isSessionPaused) {
        // Page became visible and session was paused - resume after brief delay
        setTimeout(() => {
          if (useDeepFocusStore.getState().isSessionPaused) {
            resumeSessionOnActivity();
          }
        }, 1000);
      }
    }
  });

  useEffect(() => {
    // Listen for focus changes from other components (preserve existing behavior)
    const handleFocusChange = (event: CustomEvent) => {
      const { isActive } = event.detail;
      syncFocusStatus(isActive);
    };

    // Enhanced visibility change handling
    let wasHidden = document.hidden;
    const handleVisibilityChange = () => {
      if (!document.hidden && wasHidden) {
        // Page was hidden and is now visible
        console.log('📖 Page became visible - checking for state updates');
        
        // Load focus status to check for extension state changes
        setTimeout(() => {
          loadFocusStatus();
        }, 500);
        
        // If auto session management is enabled and deep focus is active, resume if paused
        if (autoSessionManagement && isDeepFocusActive && isSessionPaused) {
          setTimeout(() => {
            resumeSessionOnActivity();
          }, 1000);
        }
      }
      wasHidden = document.hidden;
    };

    // Add event listeners
    window.addEventListener('deepFocusChanged', handleFocusChange as EventListener);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      window.removeEventListener('deepFocusChanged', handleFocusChange as EventListener);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    syncFocusStatus, 
    loadFocusStatus, 
    autoSessionManagement, 
    isDeepFocusActive, 
    isSessionPaused,
    resumeSessionOnActivity
  ]);

  // Return activity state for optional use by components
  return {
    isActive,
    isVisible,
    inactivityDuration,
    lastActivity,
    isSessionPaused,
    autoSessionManagement
  };
}; 