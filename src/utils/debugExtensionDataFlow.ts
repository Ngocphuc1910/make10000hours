/**
 * Debug Extension Data Flow
 * Comprehensive testing of extension data retrieval and sync
 */

declare global {
  interface Window {
    debugExtensionDataFlow: () => Promise<void>;
    testExtensionStorageAccess: () => Promise<void>;
    debugExtensionCommunication: () => Promise<void>;
    forceExtensionSync: () => Promise<void>;
  }
}

// Main debug function to test entire flow
window.debugExtensionDataFlow = async () => {
  console.log('🔍 ====================================');
  console.log('🔍 DEBUG EXTENSION DATA FLOW');
  console.log('🔍 ====================================');
  
  try {
    // Step 1: Test basic extension presence via postMessage
    console.log('📍 Step 1: Testing extension presence via postMessage...');
    const extensionPresent = await testExtensionPresenceViaPostMessage();
    console.log('🔌 Extension present:', extensionPresent);
    
    if (!extensionPresent) {
      console.error('❌ Extension not responding to postMessage communication');
      return;
    }

    // Step 2: Test direct extension communication
    console.log('\n📍 Step 2: Testing direct extension communication...');
    await testDirectExtensionCommunication();
    
    // Step 3: Test extension storage access
    console.log('\n📍 Step 3: Testing extension storage access...');
    await testExtensionStorageAccess();
    
    // Step 4: Test web app sync pipeline
    console.log('\n📍 Step 4: Testing web app sync pipeline...');
    await testWebAppSyncPipeline();
    
    // Step 5: Test Firebase write
    console.log('\n📍 Step 5: Testing Firebase write capability...');
    await testFirebaseWrite();
    
    console.log('\n✅ Extension data flow debug completed');
    
  } catch (error) {
    console.error('❌ Debug flow failed:', error);
  }
};

// Test extension presence via postMessage
async function testExtensionPresenceViaPostMessage(): Promise<boolean> {
  return new Promise((resolve) => {
    console.log('📤 Testing extension presence via postMessage...');
    
    let responseReceived = false;
    
    // Set up message listener for extension response
    const messageHandler = (event: MessageEvent) => {
      if (event.data?.type === 'EXTENSION_PRESENCE_RESPONSE' || 
          event.data?.type === 'EXTENSION_SITE_USAGE_SESSION_BATCH' ||
          (event.data?.source === 'extension' && event.data?.type)) {
        responseReceived = true;
        console.log('✅ Extension responded to presence test');
        window.removeEventListener('message', messageHandler);
        resolve(true);
      }
    };
    
    window.addEventListener('message', messageHandler);
    
    // Send test message
    window.postMessage({
      type: 'REQUEST_SITE_USAGE_SESSIONS',
      source: 'web-app',
      timestamp: new Date().toISOString()
    }, '*');
    
    // Timeout after 3 seconds
    setTimeout(() => {
      if (!responseReceived) {
        console.log('❌ No response from extension within 3 seconds');
        window.removeEventListener('message', messageHandler);
        resolve(false);
      }
    }, 3000);
  });
}

// Test direct communication with extension via postMessage
async function testDirectExtensionCommunication() {
  console.log('📤 Testing extension communication via postMessage...');
  
  return new Promise((resolve) => {
    let responseReceived = false;
    
    const messageHandler = (event: MessageEvent) => {
      if (event.data?.source === 'extension') {
        responseReceived = true;
        console.log('✅ Extension postMessage response:', {
          type: event.data.type,
          hasPayload: !!event.data.payload,
          source: event.data.source
        });
        window.removeEventListener('message', messageHandler);
        resolve(event.data);
      }
    };
    
    window.addEventListener('message', messageHandler);
    
    // Send test message
    window.postMessage({
      type: 'REQUEST_SITE_USAGE_SESSIONS',
      source: 'web-app',
      timestamp: new Date().toISOString()
    }, '*');
    
    // Timeout after 5 seconds
    setTimeout(() => {
      if (!responseReceived) {
        console.log('❌ No postMessage response from extension within 5 seconds');
        window.removeEventListener('message', messageHandler);
        resolve(null);
      }
    }, 5000);
  });
}

// Test extension storage access via postMessage
window.testExtensionStorageAccess = async () => {
  console.log('💾 ====================================');
  console.log('💾 TEST EXTENSION STORAGE ACCESS');
  console.log('💾 ====================================');
  
  return new Promise((resolve) => {
    console.log('📤 Requesting site_usage_sessions from extension via postMessage...');
    
    let responseReceived = false;
    
    // Set up message listener for extension response
    const messageHandler = (event: MessageEvent) => {
      if (event.data?.type === 'EXTENSION_SITE_USAGE_SESSION_BATCH') {
        responseReceived = true;
        
        const sessions = event.data.payload?.sessions || [];
        console.log('📊 Extension storage response via postMessage:', {
          sessionCount: sessions.length,
          source: event.data.source,
          timestamp: event.data.timestamp,
          hasPayload: !!event.data.payload,
          firstSession: sessions[0] || null,
          sampleSessions: sessions.slice(0, 3)
        });
        
        if (sessions.length > 0) {
          console.log('✅ Found real extension data!');
          console.log('📋 Sample session data:', JSON.stringify(sessions[0], null, 2));
        } else {
          console.log('⚠️ No sessions found in extension storage');
        }
        
        window.removeEventListener('message', messageHandler);
        resolve({ 
          success: true, 
          sessions,
          totalSessions: sessions.length,
          source: 'postMessage' 
        });
      }
    };
    
    window.addEventListener('message', messageHandler);
    
    // Send request via postMessage
    window.postMessage({
      type: 'REQUEST_SITE_USAGE_SESSIONS',
      source: 'web-app',
      timestamp: new Date().toISOString()
    }, '*');
    
    // Timeout after 10 seconds
    setTimeout(() => {
      if (!responseReceived) {
        console.log('❌ No storage response from extension within 10 seconds');
        window.removeEventListener('message', messageHandler);
        resolve(null);
      }
    }, 10000);
  });
};

// Test web app communication pipeline
async function testWebAppSyncPipeline() {
  console.log('🌐 Testing web app sync pipeline...');
  
  // Test postMessage communication
  return new Promise((resolve) => {
    let messageReceived = false;
    
    // Set up message listener
    const messageHandler = (event) => {
      if (event.data?.type === 'EXTENSION_SITE_USAGE_SESSION_BATCH') {
        messageReceived = true;
        console.log('✅ Received EXTENSION_SITE_USAGE_SESSION_BATCH from extension');
        console.log('📊 Session data received:', {
          sessionCount: event.data.payload?.sessions?.length || 0,
          source: event.data.source,
          timestamp: event.data.timestamp,
          firstSession: event.data.payload?.sessions?.[0]
        });
        
        window.removeEventListener('message', messageHandler);
        resolve(event.data);
      }
    };
    
    window.addEventListener('message', messageHandler);
    
    // Send sync request
    console.log('📤 Sending REQUEST_SITE_USAGE_SESSIONS via postMessage...');
    window.postMessage({
      type: 'REQUEST_SITE_USAGE_SESSIONS',
      source: 'web-app',
      timestamp: new Date().toISOString()
    }, '*');
    
    // Timeout after 10 seconds
    setTimeout(() => {
      if (!messageReceived) {
        console.log('⚠️ No response received via postMessage within 10 seconds');
        window.removeEventListener('message', messageHandler);
        resolve(null);
      }
    }, 10000);
  });
}

// Test Firebase write capability
async function testFirebaseWrite() {
  try {
    const { testSessionWrite } = window as any;
    if (testSessionWrite) {
      console.log('🔥 Testing Firebase write...');
      await testSessionWrite();
    } else {
      console.log('⚠️ Firebase test function not available');
    }
  } catch (error) {
    console.error('❌ Firebase test failed:', error);
  }
}

// Test extension communication via postMessage only
window.debugExtensionCommunication = async () => {
  console.log('📡 ====================================');
  console.log('📡 DEBUG EXTENSION COMMUNICATION');
  console.log('📡 ====================================');
  
  // Test postMessage communication method only (Chrome API not available from web app)
  const tests = [
    'REQUEST_SITE_USAGE_SESSIONS'
  ];
  
  for (const testType of tests) {
    console.log(`\n🧪 Testing ${testType} via postMessage...`);
    
    try {
      await new Promise((resolve) => {
        let responseReceived = false;
        
        const messageHandler = (event: MessageEvent) => {
          if (event.data?.type === 'EXTENSION_SITE_USAGE_SESSION_BATCH') {
            responseReceived = true;
            console.log(`✅ ${testType} postMessage response:`, {
              sessionCount: event.data.payload?.sessions?.length || 0,
              source: event.data.source,
              timestamp: event.data.timestamp,
              hasError: !!event.data.error
            });
            window.removeEventListener('message', messageHandler);
            resolve(event.data);
          }
        };
        
        window.addEventListener('message', messageHandler);
        
        // Send test message
        console.log(`📤 Sending ${testType} via postMessage...`);
        window.postMessage({
          type: testType,
          source: 'web-app',
          timestamp: new Date().toISOString()
        }, '*');
        
        // Timeout after 5 seconds
        setTimeout(() => {
          if (!responseReceived) {
            console.log(`❌ ${testType} - No postMessage response within 5 seconds`);
          }
          window.removeEventListener('message', messageHandler);
          resolve(null);
        }, 5000);
      });
      
    } catch (error) {
      console.error(`❌ ${testType} test failed:`, error);
    }
  }
};

// Force extension sync with detailed logging
window.forceExtensionSync = async () => {
  console.log('🚀 ====================================');
  console.log('🚀 FORCE EXTENSION SYNC');
  console.log('🚀 ====================================');
  
  try {
    // Step 1: Test storage access
    console.log('📍 Step 1: Testing storage access...');
    const storageData = await window.testExtensionStorageAccess();
    
    if (!storageData || !storageData.sessions || storageData.sessions.length === 0) {
      console.log('⚠️ No extension data found - cannot sync');
      return;
    }
    
    // Step 2: Use sync service
    console.log('📍 Step 2: Using extension sync service...');
    const { extensionSyncListener } = await import('../services/extensionSyncListener');
    await extensionSyncListener.triggerExtensionSync();
    
    // Step 3: Wait and check Firebase
    console.log('📍 Step 3: Checking Firebase after sync...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 4: Load dashboard data
    console.log('📍 Step 4: Loading dashboard data...');
    const { useDeepFocusDashboardStore } = await import('../store/deepFocusDashboardStore');
    await useDeepFocusDashboardStore.getState().loadSessionData();
    
    console.log('✅ Force sync completed');
    
  } catch (error) {
    console.error('❌ Force sync failed:', error);
  }
};

// Note: Storage key debugging requires Chrome extension API access
// which is not available from web app context. Use extension dev tools instead.
const debugStorageKeys = async () => {
  console.log('🔑 Storage key debugging not available from web app context');
  console.log('💡 Use Chrome extension dev tools to inspect extension storage:');
  console.log('   1. Open chrome://extensions/');
  console.log('   2. Enable Developer Mode');
  console.log('   3. Find your extension and click "Service Worker" or "background page"');
  console.log('   4. In console run: chrome.storage.local.get(null, console.log)');
};

// Auto-run debug on load
setTimeout(() => {
  console.log('🔧 Extension data flow debugger loaded');
  console.log('🔧 Available functions:');
  console.log('  - debugExtensionDataFlow() - Complete flow test');
  console.log('  - testExtensionStorageAccess() - Test storage access');  
  console.log('  - debugExtensionCommunication() - Test communication');
  console.log('  - forceExtensionSync() - Force sync with logging');
}, 1000);

export {};