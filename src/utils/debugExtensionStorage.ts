/**
 * Debug Extension Storage
 * Helps debug what's stored in the Chrome extension storage
 */

declare global {
  interface Window {
    debugExtensionStorage: () => Promise<void>;
    checkExtensionUserInfo: () => Promise<void>;
  }
}

// Debug extension storage contents
window.debugExtensionStorage = async () => {
  console.log('🔍 ====================================');
  console.log('🔍 DEBUG EXTENSION STORAGE');
  console.log('🔍 ====================================');

  try {
    // Test postMessage communication to get storage data
    return new Promise((resolve) => {
      let responseReceived = false;
      
      const messageHandler = (event: MessageEvent) => {
        if (event.data?.type === 'EXTENSION_STORAGE_DEBUG_RESPONSE') {
          responseReceived = true;
          console.log('📊 Extension storage contents:', event.data.payload);
          window.removeEventListener('message', messageHandler);
          resolve(undefined);
        }
      };
      
      window.addEventListener('message', messageHandler);
      
      // Send storage debug request
      console.log('📤 Requesting storage debug info from extension...');
      window.postMessage({
        type: 'EXTENSION_STORAGE_DEBUG',
        source: 'web-app',
        timestamp: new Date().toISOString()
      }, '*');
      
      // Timeout after 5 seconds
      setTimeout(() => {
        if (!responseReceived) {
          console.log('❌ No storage debug response from extension within 5 seconds');
        }
        window.removeEventListener('message', messageHandler);
        resolve(undefined);
      }, 5000);
    });
  } catch (error) {
    console.error('❌ Storage debug failed:', error);
  }
};

// Check specifically for user info
window.checkExtensionUserInfo = async () => {
  console.log('👤 ====================================');
  console.log('👤 CHECK EXTENSION USER INFO');
  console.log('👤 ====================================');

  try {
    return new Promise((resolve) => {
      let responseReceived = false;
      
      const messageHandler = (event: MessageEvent) => {
        if (event.data?.type === 'EXTENSION_USER_INFO_RESPONSE') {
          responseReceived = true;
          const userInfo = event.data.payload;
          console.log('👤 Extension user info:', {
            hasUserInfo: !!userInfo,
            userId: userInfo?.userId,
            displayName: userInfo?.displayName,
            userEmail: userInfo?.userEmail,
            isLoggedIn: userInfo?.isLoggedIn,
            lastUpdated: userInfo?.lastUpdated
          });
          window.removeEventListener('message', messageHandler);
          resolve(undefined);
        }
      };
      
      window.addEventListener('message', messageHandler);
      
      // Send user info request
      console.log('📤 Requesting user info from extension...');
      window.postMessage({
        type: 'GET_USER_INFO_VIA_POSTMESSAGE',
        source: 'web-app',
        timestamp: new Date().toISOString()
      }, '*');
      
      // Timeout after 5 seconds
      setTimeout(() => {
        if (!responseReceived) {
          console.log('❌ No user info response from extension within 5 seconds');
        }
        window.removeEventListener('message', messageHandler);
        resolve(undefined);
      }, 5000);
    });
  } catch (error) {
    console.error('❌ User info check failed:', error);
  }
};

// Auto-run when loaded
setTimeout(() => {
  console.log('🔧 Extension storage debugger loaded');
  console.log('🔧 Available functions:');
  console.log('  - debugExtensionStorage() - Check all storage contents');
  console.log('  - checkExtensionUserInfo() - Check user info specifically');
}, 1000);

export {};