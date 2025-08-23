// COPY AND PASTE THIS DIRECTLY INTO WEB APP CONSOLE

async function testOverrideSync() {
  console.log('🔄 Testing override sync...');
  
  // Send message to extension to trigger sync
  window.postMessage({ 
    type: 'REQUEST_SITE_USAGE_SESSIONS', 
    source: 'web-app-test',
    timestamp: new Date().toISOString()
  }, '*');
  
  console.log('📤 Sync request sent to extension');
  console.log('👀 Watch for these console messages:');
  console.log('  🚫 [LEGACY-PROTECTION] - Old sessions blocked');
  console.log('  ✅ [NEW-FORMAT] - Valid sessions processed');
  console.log('  🔄 [DEDUP] - Duplicates prevented');
  
  // Wait for sync to complete
  setTimeout(() => {
    console.log('✅ Test completed - check above for filtering results');
  }, 3000);
}

// Run the test
testOverrideSync();