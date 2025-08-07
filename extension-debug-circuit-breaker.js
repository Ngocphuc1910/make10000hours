/**
 * Extension Circuit Breaker Debug Script
 * Run this in the browser console to debug extension communication issues
 */

console.log('🔧 Starting Extension Circuit Breaker Debug...');

// Import the service (this assumes the script is run in the web app context)
async function debugExtensionCircuitBreaker() {
  try {
    // Check if ExtensionDataService is available
    if (typeof ExtensionDataService === 'undefined') {
      console.error('❌ ExtensionDataService not available - make sure you run this in the web app');
      return;
    }

    console.log('📊 Current Circuit Breaker Status:');
    const status = ExtensionDataService.getCircuitBreakerStatus();
    console.table(status);

    // Reset circuit breaker
    console.log('🔄 Resetting circuit breaker...');
    ExtensionDataService.resetCircuitBreaker();
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test basic extension ping
    console.log('📡 Testing extension ping...');
    try {
      const pingResponse = await ExtensionDataService.ping();
      console.log('✅ Extension ping successful:', pingResponse);
    } catch (error) {
      console.error('❌ Extension ping failed:', error.message);
      return;
    }

    // Test getting last 10 deep focus sessions
    console.log('🎯 Testing getLast10DeepFocusSessions...');
    try {
      const sessionsResponse = await ExtensionDataService.getLast10DeepFocusSessions();
      console.log('✅ Extension sessions response:', sessionsResponse);
      
      if (sessionsResponse.success && sessionsResponse.data) {
        console.log(`📊 Found ${sessionsResponse.data.length} sessions in extension`);
        
        // Show sample sessions
        if (sessionsResponse.data.length > 0) {
          console.log('📋 Sample sessions:');
          console.table(sessionsResponse.data.slice(0, 3));
        }
      }
    } catch (error) {
      console.error('❌ Extension sessions test failed:', error.message);
    }

    // Final circuit breaker status
    console.log('🏁 Final Circuit Breaker Status:');
    const finalStatus = ExtensionDataService.getCircuitBreakerStatus();
    console.table(finalStatus);

  } catch (error) {
    console.error('❌ Debug script error:', error);
  }
}

// Test extension background script directly via chrome.runtime
async function testExtensionDirectly() {
  console.log('🔌 Testing extension directly via chrome.runtime...');
  
  if (!window.chrome || !window.chrome.runtime) {
    console.error('❌ Chrome runtime not available');
    return;
  }

  try {
    // Test if extension is available
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage('ldcadlkfamhdanbcbfmbmpckffjonbml', // Your extension ID 
        { type: 'PING' }, 
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        }
      );
    });
    
    console.log('✅ Extension direct communication successful:', response);
    
    // Test getting sessions directly
    const sessionsResponse = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage('ldcadlkfamhdanbcbfmbmpckffjonbml',
        { type: 'GET_LAST_10_DEEP_FOCUS_SESSIONS' }, 
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        }
      );
    });
    
    console.log('✅ Extension sessions direct:', sessionsResponse);
    
  } catch (error) {
    console.error('❌ Extension direct communication failed:', error.message);
  }
}

// Run both tests
console.log('🚀 Running extension circuit breaker debug...');
debugExtensionCircuitBreaker().then(() => {
  console.log('🔧 Testing direct extension communication...');
  return testExtensionDirectly();
}).then(() => {
  console.log('✅ All tests completed');
}).catch(error => {
  console.error('❌ Test suite failed:', error);
});