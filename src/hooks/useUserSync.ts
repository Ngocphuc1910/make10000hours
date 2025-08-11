import { useEffect } from 'react';
import { useUserStore } from '../store/userStore';
import { useDeepFocusStore } from '../store/deepFocusStore';
// Removed useFormEditStore import to prevent subscription

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
  // Don't subscribe to formEditStore - check state only when needed

  useEffect(() => {
    const syncUserWithExtension = async () => {
      if (!user?.uid) {
        console.log('🔄 No user authenticated, skipping extension sync');
        return;
      }
      
      // Skip sync if any form is currently active to prevent TaskForm rerenders
      const { useFormEditStore } = await import('../store/formEditStore');
      const { isAnyFormActive } = useFormEditStore.getState();
      if (isAnyFormActive()) {
        console.log('🛡️ Extension sync blocked - TaskForm is active');
        return;
      }

      const payload = { 
        userId: user.uid,
        userEmail: user.email || '',
        displayName: user.displayName || '',
        timezone: user.settings?.timezone?.current || null
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

        // Also try direct chrome extension API if available (bypass content script)
        if (typeof (window as any).chrome !== 'undefined' && 
            (window as any).chrome?.runtime?.sendMessage) {
          try {
            console.log('📤 DEBUG: Attempting direct extension message for user:', user.uid);
            
            // Try sending without extension ID first (for extensions that allow external messaging)
            (window as any).chrome.runtime.sendMessage(
              {
                type: 'SET_USER_ID',
                payload,
                source: 'web_app_direct'
              },
              (response: any) => {
                if ((window as any).chrome.runtime.lastError) {
                  console.log('⚠️ Direct extension message failed (no ID):', (window as any).chrome.runtime.lastError.message);
                  
                  // Fallback: Try to detect extension ID from DOM injection
                  const extensionElements = document.querySelectorAll('[data-extension-id]');
                  if (extensionElements.length > 0) {
                    const extensionId = extensionElements[0].getAttribute('data-extension-id');
                    console.log('🔍 Found extension ID in DOM:', extensionId);
                    
                    if (extensionId) {
                      (window as any).chrome.runtime.sendMessage(
                        extensionId,
                        {
                          type: 'SET_USER_ID',
                          payload,
                          source: 'web_app_direct'
                        },
                        (response: any) => {
                          if ((window as any).chrome.runtime.lastError) {
                            console.log('⚠️ Direct extension message with ID failed:', (window as any).chrome.runtime.lastError.message);
                          } else {
                            console.log('✅ Direct extension message with ID response:', response);
                          }
                        }
                      );
                    }
                  }
                } else {
                  console.log('✅ Direct extension message response:', response);
                }
              }
            );
          } catch (error) {
            console.log('⚠️ Direct extension message failed:', error);
          }
        }

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
  }, [user?.uid, user?.email, user?.displayName, user?.settings?.timezone?.current]);

  return { user };
}; 