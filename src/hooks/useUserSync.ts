import { useEffect } from 'react';
import { useUserStore } from '../store/userStore';

/**
 * Hook to sync authenticated user ID with Chrome extension
 * This ensures the extension knows which user to associate override sessions with
 */
export const useUserSync = () => {
  const { user } = useUserStore();

  useEffect(() => {
    const syncUserWithExtension = async () => {
      if (!user?.uid) {
        console.log('🔄 No user authenticated, skipping extension sync');
        return;
      }

      const payload = { 
        userId: user.uid,
        userEmail: user.email || '',
        displayName: user.displayName || ''
      };

      console.log('🔍 DEBUG: Starting user sync with extension:', payload);

      try {
        // Send user ID to extension via window message
        window.postMessage({
          type: 'SET_USER_ID',
          payload,
          source: 'make10000hours'
        }, '*');
        console.log('📤 DEBUG: Sent SET_USER_ID via window.postMessage');

        // Also try Chrome extension API if available
        if (typeof (window as any).chrome !== 'undefined' && 
            (window as any).chrome?.runtime?.sendMessage) {
          
          try {
            // NOTE: Direct chrome.runtime.sendMessage from web pages requires extension ID
            // We'll rely on window.postMessage + content script bridge instead
            console.log('ℹ️ Chrome extension API available, but using window.postMessage bridge for security');
          } catch (error) {
            console.warn('⚠️ Chrome API sync failed:', error);
          }
        } else {
          console.log('ℹ️ Chrome extension API not available, using window.postMessage only');
        }
        
      } catch (error) {
        console.warn('⚠️ Failed to sync user with extension:', error);
        console.warn('🔍 DEBUG: User sync error details:', {
          name: (error as Error)?.name,
          message: (error as Error)?.message,
          userId: user.uid
        });
      }
    };

    // Sync immediately when user changes
    syncUserWithExtension();

    // Also sync periodically to ensure extension stays updated
    const syncInterval = setInterval(syncUserWithExtension, 30000); // Every 30 seconds

    return () => {
      clearInterval(syncInterval);
    };
  }, [user?.uid, user?.email, user?.displayName]);

  return { user };
}; 