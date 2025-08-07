/**
 * Console Commands for Extension Circuit Breaker Debugging
 * Copy and paste these commands into the browser console on the Deep Focus page
 */

// 1. Check circuit breaker status
function checkCircuitBreaker() {
  console.log('🔍 Checking circuit breaker status...');
  try {
    if (typeof ExtensionDataService !== 'undefined') {
      const status = ExtensionDataService.getCircuitBreakerStatus();
      console.table(status);
      return status;
    } else {
      console.error('❌ ExtensionDataService not found - make sure you\'re on the Deep Focus page');
      return null;
    }
  } catch (error) {
    console.error('❌ Error checking circuit breaker:', error);
    return null;
  }
}

// 2. Reset circuit breaker
function resetCircuitBreaker() {
  console.log('🔄 Resetting circuit breaker...');
  try {
    if (typeof ExtensionDataService !== 'undefined') {
      ExtensionDataService.resetCircuitBreaker();
      console.log('✅ Circuit breaker reset successfully');
      
      // Check status after reset
      setTimeout(() => {
        checkCircuitBreaker();
      }, 1000);
    } else {
      console.error('❌ ExtensionDataService not found');
    }
  } catch (error) {
    console.error('❌ Error resetting circuit breaker:', error);
  }
}

// 3. Test extension communication directly
async function testExtensionDirect() {
  console.log('📡 Testing extension communication...');
  
  try {
    // Test ping first
    console.log('Trying ping...');
    const pingResponse = await ExtensionDataService.ping();
    console.log('✅ Ping response:', pingResponse);
    
    // Test get sessions
    console.log('Trying to get sessions...');
    const sessionsResponse = await ExtensionDataService.getLast10DeepFocusSessions();
    console.log('✅ Sessions response:', sessionsResponse);
    
    if (sessionsResponse.success && sessionsResponse.data) {
      console.log(`📊 Found ${sessionsResponse.data.length} sessions`);
      if (sessionsResponse.data.length > 0) {
        console.log('📋 Sample session:', sessionsResponse.data[0]);
      }
    }
    
    return { ping: pingResponse, sessions: sessionsResponse };
    
  } catch (error) {
    console.error('❌ Extension communication test failed:', error);
    
    // Check circuit breaker status after failure
    checkCircuitBreaker();
    
    return { error: error.message };
  }
}

// 4. Test postMessage directly (bypass ExtensionDataService)
async function testPostMessageDirect() {
  console.log('🔌 Testing postMessage communication directly...');
  
  return new Promise((resolve, reject) => {
    const messageId = Math.random().toString(36).substring(2, 15);
    const timeout = setTimeout(() => {
      window.removeEventListener('message', responseHandler);
      reject(new Error('PostMessage timeout'));
    }, 5000);

    const responseHandler = (event) => {
      if (event.data?.extensionResponseId === messageId) {
        clearTimeout(timeout);
        window.removeEventListener('message', responseHandler);
        console.log('✅ PostMessage response:', event.data.response);
        resolve(event.data.response);
      }
    };

    window.addEventListener('message', responseHandler);
    
    console.log('Sending postMessage...');
    window.postMessage({
      type: 'EXTENSION_REQUEST',
      messageId,
      payload: { type: 'PING' }
    }, '*');
  });
}

// 5. Full diagnostic sequence
async function fullDiagnostic() {
  console.log('🚀 Running full extension diagnostic...');
  
  console.log('\n--- Step 1: Circuit Breaker Status ---');
  const status = checkCircuitBreaker();
  
  console.log('\n--- Step 2: Reset Circuit Breaker ---');
  resetCircuitBreaker();
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('\n--- Step 3: Test PostMessage Direct ---');
  try {
    const postMessageResult = await testPostMessageDirect();
    console.log('PostMessage test result:', postMessageResult);
  } catch (error) {
    console.error('PostMessage test failed:', error.message);
  }
  
  console.log('\n--- Step 4: Test ExtensionDataService ---');
  const serviceResult = await testExtensionDirect();
  
  console.log('\n--- Step 5: Final Status Check ---');
  checkCircuitBreaker();
  
  console.log('\n🏁 Diagnostic complete. Results summary:');
  console.log('- Initial status:', status);
  console.log('- Service result:', serviceResult);
}

// Instructions
console.log(`
🔧 Extension Circuit Breaker Debug Commands Available:

1. checkCircuitBreaker()     - Check current status
2. resetCircuitBreaker()     - Reset the circuit breaker  
3. testExtensionDirect()     - Test ExtensionDataService
4. testPostMessageDirect()   - Test raw postMessage
5. fullDiagnostic()          - Run complete diagnostic

Usage: Just type the function name and press Enter
Example: checkCircuitBreaker()
`);

// Export functions to global scope
window.checkCircuitBreaker = checkCircuitBreaker;
window.resetCircuitBreaker = resetCircuitBreaker;
window.testExtensionDirect = testExtensionDirect;
window.testPostMessageDirect = testPostMessageDirect;
window.fullDiagnostic = fullDiagnostic;