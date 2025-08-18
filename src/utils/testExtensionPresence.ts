/**
 * Simple Extension Presence Test
 * Tests if Chrome extension content script is loaded and responding
 */

declare global {
  interface Window {
    testExtensionPresence: () => Promise<void>;
    pingExtension: () => Promise<void>;
  }
}

// Test if extension content script is loaded and responding
window.testExtensionPresence = async () => {
  console.log('🔍 ====================================');
  console.log('🔍 TESTING EXTENSION PRESENCE');
  console.log('🔍 ====================================');

  // Test 1: Check if extension globals are injected
  console.log('\n📍 Test 1: Checking for extension globals...');
  const extensionGlobals = [
    'chrome',
    'browser'
  ];
  
  extensionGlobals.forEach(global => {
    const exists = typeof (window as any)[global] !== 'undefined';
    console.log(`${exists ? '✅' : '❌'} ${global}: ${exists ? 'Available' : 'Not available'}`);
  });

  // Test 2: Check if extension content script is responding to messages
  console.log('\n📍 Test 2: Testing extension content script response...');
  
  return new Promise((resolve) => {
    let responseReceived = false;
    
    // Listen for any response from extension
    const messageHandler = (event: MessageEvent) => {
      console.log('📨 Received message:', {
        type: event.data?.type,
        source: event.data?.source,
        origin: event.origin,
        hasPayload: !!event.data?.payload
      });
      
      // Look for any extension response
      if (event.data?.source === 'extension' || 
          event.data?.type?.includes('EXTENSION') ||
          event.data?.type === 'EXTENSION_SITE_USAGE_SESSION_BATCH') {
        responseReceived = true;
        console.log('✅ Extension content script is responding!');
        window.removeEventListener('message', messageHandler);
        resolve(undefined);
      }
    };
    
    window.addEventListener('message', messageHandler);
    
    // Send a simple test message
    console.log('📤 Sending test message to extension...');
    window.postMessage({
      type: 'EXTENSION_PRESENCE_TEST',
      source: 'web-app',
      timestamp: new Date().toISOString()
    }, '*');
    
    // Also try the actual sync request
    setTimeout(() => {
      console.log('📤 Sending actual sync request...');
      window.postMessage({
        type: 'REQUEST_SITE_USAGE_SESSIONS',
        source: 'web-app',
        timestamp: new Date().toISOString()
      }, '*');
    }, 1000);
    
    // Timeout after 5 seconds
    setTimeout(() => {
      if (!responseReceived) {
        console.log('❌ No response from extension content script within 5 seconds');
        console.log('💡 This could mean:');
        console.log('   1. Extension is not installed or enabled');
        console.log('   2. Extension content script is not loaded on this page');
        console.log('   3. Extension content script is not listening for postMessage events');
        console.log('   4. Extension content script has an error and is not responding');
      }
      window.removeEventListener('message', messageHandler);
      resolve(undefined);
    }, 5000);
  });
};

// Quick ping test
window.pingExtension = async () => {
  console.log('🏓 Pinging extension...');
  
  return new Promise((resolve) => {
    let responseReceived = false;
    
    const messageHandler = (event: MessageEvent) => {
      if (event.data?.source === 'extension') {
        responseReceived = true;
        console.log('🏓 Extension responded:', event.data.type);
        window.removeEventListener('message', messageHandler);
        resolve(undefined);
      }
    };
    
    window.addEventListener('message', messageHandler);
    
    // Send ping
    window.postMessage({
      type: 'PING',
      source: 'web-app',
      timestamp: new Date().toISOString()
    }, '*');
    
    setTimeout(() => {
      if (!responseReceived) {
        console.log('🏓 No ping response from extension');
      }
      window.removeEventListener('message', messageHandler);
      resolve(undefined);
    }, 2000);
  });
};

// Auto-run when loaded
setTimeout(() => {
  console.log('🔧 Extension presence tester loaded');
  console.log('🔧 Available functions:');
  console.log('  - testExtensionPresence() - Full presence test');
  console.log('  - pingExtension() - Quick ping test');
}, 1000);

export {};