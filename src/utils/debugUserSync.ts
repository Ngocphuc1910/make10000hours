/**
 * Debug utility to test user sync step by step
 */

export async function debugUserSync() {
  console.log('🔍 Debugging User Sync');
  console.log('======================');
  
  // Step 1: Check if user is authenticated in web app
  console.log('Step 1: Checking web app authentication...');
  const { useUserStore } = await import('../store/userStore');
  const user = useUserStore.getState().user;
  
  if (user?.uid) {
    console.log('✅ User authenticated in web app:', {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName
    });
  } else {
    console.log('❌ No user authenticated in web app');
    return;
  }
  
  // Step 2: Check Chrome extension availability
  console.log('Step 2: Checking Chrome extension availability...');
  if (typeof (window as any).chrome === 'undefined') {
    console.log('❌ Chrome API not available');
    return;
  }
  
  if (!(window as any).chrome?.runtime?.sendMessage) {
    console.log('❌ Chrome runtime not available');
    return;
  }
  
  console.log('✅ Chrome extension API available');
  
  // Step 3: Try to send user ID to extension using both methods
  console.log('Step 3: Sending user ID to extension...');
  
  const userPayload = { 
    userId: user.uid,
    userEmail: user.email || '',
    displayName: user.displayName || ''
  };

  // Method 1: Try window.postMessage (for content script communication)
  try {
    console.log('🔄 Trying window.postMessage method...');
    window.postMessage({
      type: 'SET_USER_ID',
      payload: userPayload,
      source: 'make10000hours-debug'
    }, '*');
    console.log('✅ Window message sent successfully');
  } catch (error) {
    console.log('❌ Error with window.postMessage:', error);
  }
  
  // Method 2: Try chrome.runtime.sendMessage (for external communication)
  let extSuccess = false;
  try {
    console.log('🔄 Trying chrome.runtime.sendMessage method...');
    
    // Try without extension ID first (works if extension allows it)
    const response = await new Promise((resolve, reject) => {
      (window as any).chrome.runtime.sendMessage({
        type: 'SET_USER_ID',
        payload: userPayload
      }, (response: any) => {
        if ((window as any).chrome.runtime.lastError) {
          reject(new Error((window as any).chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
    
    console.log('✅ Extension response:', response);
    extSuccess = true;
    
    if ((response as any)?.success && (response as any)?.userId) {
      console.log('✅ User ID successfully set in extension:', (response as any).userId);
    } else {
      console.log('❌ Failed to set user ID in extension:', response);
    }
    
  } catch (error) {
    console.log('❌ Error sending user ID to extension:', error);
    console.log('💡 This might be normal - the extension needs to be installed and have external communication enabled');
  }
  
  // Step 4: Test override session if extension communication worked
  if (extSuccess) {
    console.log('Step 4: Testing override session...');
    try {
      const overrideResponse = await new Promise((resolve, reject) => {
        (window as any).chrome.runtime.sendMessage({
          type: 'RECORD_OVERRIDE_SESSION',
          payload: {
            domain: 'debug-test.com',
            duration: 5
          }
        }, (response: any) => {
          if ((window as any).chrome.runtime.lastError) {
            reject(new Error((window as any).chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
      
      console.log('✅ Override test response:', overrideResponse);
      
      // Step 5: Check if web app received the message
      console.log('Step 5: Checking if message was forwarded to web app...');
      console.log('(Check the console for override messages with user ID)');
      
    } catch (error) {
      console.log('❌ Error testing override session:', error);
    }
  } else {
    console.log('Step 4: Skipped (extension communication failed)');
    console.log('💡 To fix this, ensure the extension is installed and loaded properly');
  }
}

export async function forceUserSync() {
  console.log('🔄 Force User Sync');
  console.log('==================');
  
  const { useUserStore } = await import('../store/userStore');
  const user = useUserStore.getState().user;
  
  if (!user?.uid) {
    console.log('❌ No user to sync');
    return;
  }
  
  const userPayload = { 
    userId: user.uid,
    userEmail: user.email || '',
    displayName: user.displayName || ''
  };

  try {
    // Send via window.postMessage
    window.postMessage({
      type: 'SET_USER_ID',
      payload: userPayload,
      source: 'make10000hours-force-sync'
    }, '*');
    console.log('✅ Window message sent');
    
    // Send via Chrome extension API if available
    if (typeof (window as any).chrome !== 'undefined' && 
        (window as any).chrome?.runtime?.sendMessage) {
      
      try {
        const response = await new Promise((resolve, reject) => {
          (window as any).chrome.runtime.sendMessage({
            type: 'SET_USER_ID',
            payload: userPayload
          }, (response: any) => {
            if ((window as any).chrome.runtime.lastError) {
              reject(new Error((window as any).chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        });
        
        console.log('✅ Extension sync response:', response);
      } catch (extError) {
        console.log('⚠️ Extension sync failed (this might be normal):', extError);
      }
    }
    
    console.log('✅ Force sync completed for user:', user.uid);
    
  } catch (error) {
    console.log('❌ Force sync failed:', error);
  }
} 