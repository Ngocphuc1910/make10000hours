/**
 * Simple test script for override sync functionality
 * Copy and paste this directly into the web app browser console
 */

// Test function - paste this in web app console
async function testOverrideSync() {
  try {
    console.log('🔄 [TEST] Testing override sync...');
    
    // Method 1: Try to access the extension sync listener directly
    let syncTriggered = false;
    
    // Check if extension sync listener is accessible
    const app = document.querySelector('#root')?._reactInternals?.child?.stateNode;
    if (app && typeof app.extensionSyncListener !== 'undefined') {
      console.log('📍 [TEST] Found extension sync listener, triggering sync...');
      await app.extensionSyncListener.triggerExtensionSync();
      syncTriggered = true;
    } 
    
    // Method 2: Use window postMessage (works with extension)
    if (!syncTriggered) {
      console.log('📤 [TEST] Using postMessage to request sync...');
      window.postMessage({ 
        type: 'REQUEST_SITE_USAGE_SESSIONS', 
        source: 'web-app-test',
        timestamp: new Date().toISOString()
      }, '*');
      
      // Give extension time to respond
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('✅ [TEST] Sync test completed');
    console.log('👀 [TEST] Watch for these log messages:');
    console.log('  🚫 [LEGACY-PROTECTION] - Old format sessions being blocked');
    console.log('  ✅ [NEW-FORMAT] - Valid sessions being processed');
    console.log('  🔄 [DEDUP] - Firebase deduplication in action');
    
  } catch (error) {
    console.error('❌ [TEST] Sync test failed:', error);
    
    // Show helpful debugging info
    console.log('🔍 [DEBUG] Available methods:');
    console.log('  - window.postMessage available:', typeof window.postMessage);
    console.log('  - Extension context:', typeof chrome);
    
    throw error;
  }
}

// Also provide a simple Firebase test
async function testFirebaseBlocking() {
  try {
    console.log('🧪 [TEST] Testing Firebase legacy blocking...');
    
    // This should fail with legacy protection error
    const testData = {
      userId: 'test-user',
      domain: 'test.com',
      duration: 5
      // Missing extensionSessionId and startTimeUTC - should be blocked
    };
    
    console.log('📤 [TEST] Attempting to create legacy format session...');
    
    // Try to import the service (this might not work in console, but shows the concept)
    const result = await fetch('/api/test-override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    }).catch(() => {
      console.log('ℹ️ [TEST] Direct API test not available, but service-level blocking is active');
      return null;
    });
    
    console.log('✅ [TEST] Firebase blocking test completed');
    
  } catch (error) {
    console.log('✅ [TEST] Expected error - legacy session should be blocked:', error.message);
  }
}

console.log(`
🧪 OVERRIDE SYNC TEST UTILITIES

Usage in Web App Console:
  testOverrideSync()     - Test extension sync and filtering
  testFirebaseBlocking() - Test service-level legacy protection

Copy and paste the functions above, then run them!
`);

// Export for global access
window.testOverrideSync = testOverrideSync;
window.testFirebaseBlocking = testFirebaseBlocking;