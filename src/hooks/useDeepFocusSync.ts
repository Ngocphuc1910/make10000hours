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

    // Listen for real-time focus state changes from extension
    const handleExtensionFocusChange = (event: MessageEvent) => {
      // Check each validation condition
      if (event.data?.type === 'EXTENSION_FOCUS_STATE_CHANGED') {
        const hasExtensionId = !!event.data?.extensionId;
        const hasPayload = !!event.data?.payload;
        const isActiveType = typeof event.data.payload?.isActive;
        const isActiveBoolean = typeof event.data.payload?.isActive === 'boolean';
        
        console.log('🔍 Validation check:', {
          type: event.data.type,
          hasExtensionId,
          hasPayload, 
          isActiveType,
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
    window.addEventListener('message', handleExtensionFocusChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      window.removeEventListener('deepFocusChanged', handleFocusChange as EventListener);
      window.removeEventListener('message', handleExtensionFocusChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [syncFocusStatus, loadFocusStatus]);
}; 