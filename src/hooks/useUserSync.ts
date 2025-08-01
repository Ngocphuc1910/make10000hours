import { useEffect } from 'react';
import { useUserStore } from '../store/userStore';
import { useDeepFocusStore } from '../store/deepFocusStore';

// Helper function to clear storage when user changes
const clearPreviousUserStorage = () => {
  // Get all localStorage keys that match our pattern
  const keys = Object.keys(localStorage);
  const deepFocusKeys = keys.filter(key => 
    key.startsWith('deep-focus-storage-') && 
    !key.includes('anonymous')
  );
  
  // Clear old user storage
  deepFocusKeys.forEach(key => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Failed to clear old deep focus storage:', error);
    }
  });
};

// Track last synced user to prevent unnecessary operations
let lastUserId: string | null = null;

/**
 * Hook to sync authenticated user ID with Chrome extension
 * This ensures the extension knows which user to associate override sessions with
 */
export const useUserSync = () => {
  const { user } = useUserStore();
  const { loadBlockedSites } = useDeepFocusStore();

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

      console.log('🔍 DEBUG: Starting user sync with extension for user:', user.uid);

      try {
        // Clear previous user storage for clean state isolation (only if user changed)
        if (lastUserId !== user.uid) {
          clearPreviousUserStorage();
          lastUserId = user.uid;
        }
        
        // Send user ID to extension via window message
        window.postMessage({
          type: 'SET_USER_ID',
          payload,
          source: 'make10000hours'
        }, '*');
        console.log('📤 DEBUG: Sent SET_USER_ID via window.postMessage for user:', user.uid);

        // Load and sync blocking sites to extension (same as Deep Focus page)
        try {
          console.log('🔒 Loading and syncing blocked sites to extension...');
          await loadBlockedSites(user.uid);
          console.log('✅ Blocked sites loaded and synced to extension');
        } catch (error) {
          console.warn('⚠️ Failed to sync blocked sites to extension:', error);
        }

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
    const syncInterval = setInterval(syncUserWithExtension, 60000); // Every 60 seconds (less frequent since we're also syncing blocking sites)

    return () => {
      clearInterval(syncInterval);
    };
  }, [user?.uid, user?.email, user?.displayName]);

  return { user };
}; 