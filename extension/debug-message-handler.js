/**
 * Debug script to test message handlers
 * Run this in any webpage console after reloading the extension
 */

async function debugMessageHandlers() {
  console.log('🔍 Debug: Testing all message handlers...');
  
  const messagesToTest = [
    'GET_REALTIME_STATS',
    'GET_REALTIME_TOP_SITES',
    'GET_TODAY_STATS',
    'GET_TOP_SITES',
    'GET_CURRENT_STATE'
  ];
  
  for (const messageType of messagesToTest) {
    try {
      console.log(`📡 Testing ${messageType}...`);
      
      const response = await chrome.runtime.sendMessage({
        type: messageType,
        payload: { limit: 5 }
      });
      
      if (response && response.success) {
        console.log(`✅ ${messageType}: Working`);
        if (messageType === 'GET_REALTIME_TOP_SITES') {
          console.log(`📊 Data count: ${response.data?.length || 0}`);
        }
      } else {
        console.log(`❌ ${messageType}: Failed -`, response);
      }
    } catch (error) {
      console.log(`❌ ${messageType}: Error -`, error.message);
    }
  }
  
  console.log('🎯 Debug complete!');
}

// Check if extension is loaded and responsive
async function checkExtensionStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_CURRENT_STATE' });
    if (response) {
      console.log('✅ Extension is loaded and responsive');
      return true;
    } else {
      console.log('❌ Extension not responding');
      return false;
    }
  } catch (error) {
    console.log('❌ Extension communication failed:', error.message);
    return false;
  }
}

// Run the debug
console.log('🚀 Extension Debug Script Loaded');
console.log('Run: debugMessageHandlers() to test all handlers');
console.log('Run: checkExtensionStatus() to verify extension is loaded');

// Export functions
window.debugMessageHandlers = debugMessageHandlers;
window.checkExtensionStatus = checkExtensionStatus; 