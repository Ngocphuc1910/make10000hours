/**
 * Direct Extension Test Script
 * Tests extension communication without ExtensionDataService dependencies
 */

console.log('🔧 Starting Direct Extension Test...');

// Direct postMessage test function
function testExtensionDirect(messageType, payload = null) {
  return new Promise((resolve, reject) => {
    const messageId = Math.random().toString(36);
    const timeout = setTimeout(() => {
      window.removeEventListener('message', responseHandler);
      reject(new Error('Extension communication timeout'));
    }, 5000);

    const responseHandler = (event) => {
      if (event.data?.extensionResponseId === messageId) {
        clearTimeout(timeout);
        window.removeEventListener('message', responseHandler);
        resolve(event.data.response);
      }
    };

    window.addEventListener('message', responseHandler);
    
    console.log(`📤 Sending message: ${messageType}`);
    window.postMessage({
      type: 'EXTENSION_REQUEST',
      messageId,
      payload: { type: messageType, payload }
    }, '*');
  });
}

// Test the specific deep focus handlers
async function runDirectTests() {
  const results = {};
  
  console.log('\n📡 Testing Extension Communication...');
  
  // Basic connection test
  try {
    const basicTest = await testExtensionDirect('GET_TODAY_STATS');
    console.log('✅ Basic extension connection:', basicTest?.success ? 'WORKS' : 'FAILS');
    results.basicConnection = basicTest?.success || false;
  } catch (error) {
    console.log('❌ Basic extension connection: FAILED -', error.message);
    results.basicConnection = false;
    return results;
  }
  
  console.log('\n🎯 Testing Deep Focus Handlers...');
  
  const deepFocusTests = [
    'GET_ALL_DEEP_FOCUS_SESSIONS',
    'GET_TODAY_DEEP_FOCUS_SESSIONS',
    'GET_LAST_10_DEEP_FOCUS_SESSIONS',
    'GET_RECENT_7_DAYS_DEEP_FOCUS_SESSIONS',
    'GET_ACTIVE_DEEP_FOCUS_SESSION'
  ];
  
  for (const testType of deepFocusTests) {
    try {
      console.log(`🧪 Testing ${testType}...`);
      const response = await testExtensionDirect(testType);
      const status = response?.success ? 'WORKS' : 'FAILS';
      
      console.log(`${testType}: ${status === 'WORKS' ? '✅' : '❌'} ${status}`);
      if (response?.data) {
        console.log(`  Data: ${Array.isArray(response.data) ? response.data.length + ' items' : typeof response.data}`);
      }
      if (response?.error) {
        console.log(`  Error: ${response.error}`);
      }
      
      results[testType] = {
        status,
        hasData: !!response?.data,
        dataCount: Array.isArray(response?.data) ? response.data.length : 0,
        error: response?.error
      };
      
    } catch (error) {
      console.log(`❌ ${testType}: ERROR - ${error.message}`);
      results[testType] = { status: 'ERROR', error: error.message };
    }
  }
  
  // Summary
  console.log('\n📊 TEST SUMMARY:');
  const working = Object.values(results).filter(r => r.status === 'WORKS' || r === true).length;
  const total = Object.keys(results).length;
  console.log(`Working handlers: ${working}/${total}`);
  
  if (working === 0) {
    console.log('🚨 CRITICAL: All handlers failing - check extension is loaded and active');
  } else if (working < total) {
    console.log('⚠️ WARNING: Some handlers failing - partial implementation');
  } else {
    console.log('✅ All handlers working!');
  }
  
  return results;
}

// Run the test
window.testResults = null;
runDirectTests().then(results => {
  window.testResults = results;
  console.log('\n📋 Test results saved to window.testResults');
}).catch(error => {
  console.error('❌ Direct test failed:', error);
});