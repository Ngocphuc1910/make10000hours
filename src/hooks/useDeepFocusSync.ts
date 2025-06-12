import { useEffect } from 'react';
import { useDeepFocusStore } from '../store/deepFocusStore';

export const useDeepFocusSync = () => {
  const { syncFocusStatus, loadFocusStatus } = useDeepFocusStore();

  useEffect(() => {
    // Don't automatically load focus status on mount to avoid overriding persisted state
    // The extension sync hook handles initial loading and syncing
    
    // Listen for focus changes from other components
    const handleFocusChange = (event: CustomEvent) => {
      const { isActive } = event.detail;
      syncFocusStatus(isActive);
    };

    // Listen for page visibility changes - only sync if coming from hidden state
    // This prevents unnecessary syncing that might override persisted state
    let wasHidden = document.hidden;
    const handleVisibilityChange = () => {
      if (!document.hidden && wasHidden) {
        // Page was hidden and is now visible - only load if extension might have changed
        // Don't override persisted state unnecessarily
        setTimeout(() => {
          // Only load if we detect potential extension state drift
          loadFocusStatus();
        }, 500); // Small delay to avoid conflicts with other sync mechanisms
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
  }, [syncFocusStatus, loadFocusStatus]);
}; 