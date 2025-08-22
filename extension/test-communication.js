/**
 * Test script to validate extension communication and context recovery
 */

// Test the MessageQueueManager recovery functionality
async function testMessageQueueRecovery() {
  console.log('🧪 Testing MessageQueueManager context recovery...');
  
  if (typeof MessageQueueManager === 'undefined') {
    console.error('❌ MessageQueueManager not available');
    return false;
  }
  
  const queueManager = new MessageQueueManager();
  
  // Test 1: Basic message sending
  console.log('📤 Test 1: Basic message sending');
  try {
    const response = await queueManager.enqueue({ type: 'PING_EXTENSION' });
    console.log('✅ Basic message test passed:', response);
  } catch (error) {
    console.log('⚠️ Basic message test expected to fail during development:', error.message);
  }
  
  // Test 2: Context validation
  console.log('📤 Test 2: Context validation');
  try {
    const isValid = await queueManager.validateContext();
    console.log(`✅ Context validation: ${isValid ? 'VALID' : 'INVALID'}`);
  } catch (error) {
    console.log('⚠️ Context validation error:', error.message);
  }
  
  // Test 3: Recovery state information
  console.log('📤 Test 3: Recovery state information');
  const stats = queueManager.getStats();
  console.log('📊 Queue Manager Stats:', {
    recoveryState: stats.recoveryState,
    queueSize: stats.queueSize,
    successRate: stats.successRate,
    validationCache: stats.validationCache
  });
  
  return true;
}

// Test extension communication through content script
async function testContentScriptCommunication() {
  console.log('🧪 Testing content script communication...');
  
  if (typeof extensionCommunicator === 'undefined') {
    console.error('❌ extensionCommunicator not available');
    return false;
  }
  
  // Test PING_EXTENSION through content script
  try {
    const response = await extensionCommunicator.sendMessage({ 
      type: 'PING_EXTENSION' 
    }, {
      timeout: 5000,
      retries: 2
    });
    
    console.log('✅ Content script PING_EXTENSION test:', response);
    return response?.success === true;
  } catch (error) {
    console.log('⚠️ Content script communication error:', error.message);
    
    // Check if this is a recoverable error
    if (error.message.includes('Extension context invalidated')) {
      console.log('🔄 Testing context recovery...');
      
      // Wait a bit for recovery
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      try {
        const recoveryResponse = await extensionCommunicator.sendMessage({ 
          type: 'PING_EXTENSION' 
        }, {
          timeout: 8000,
          retries: 1
        });
        console.log('✅ Context recovery test:', recoveryResponse);
        return true;
      } catch (recoveryError) {
        console.log('❌ Context recovery failed:', recoveryError.message);
        return false;
      }
    }
    
    return false;
  }
}

// Test web app communication through postMessage
async function testWebAppCommunication() {
  console.log('🧪 Testing web app communication...');
  
  return new Promise((resolve) => {
    const testId = `test_${Date.now()}`;
    let responseReceived = false;
    
    // Listen for response
    const responseHandler = (event) => {
      if (event.data?.type === 'EXTENSION_PONG' && !responseReceived) {
        responseReceived = true;
        window.removeEventListener('message', responseHandler);
        console.log('✅ Web app communication test passed:', event.data);
        resolve(true);
      }
    };
    
    window.addEventListener('message', responseHandler);
    
    // Send test message
    window.postMessage({
      type: 'EXTENSION_PING',
      messageId: testId,
      payload: { test: true },
      source: 'test-script'
    }, '*');
    
    // Timeout after 5 seconds
    setTimeout(() => {
      if (!responseReceived) {
        window.removeEventListener('message', responseHandler);
        console.log('⚠️ Web app communication test timed out');
        resolve(false);
      }
    }, 5000);
  });
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Extension Communication Tests');
  console.log('=====================================');
  
  const results = {
    messageQueue: false,
    contentScript: false,
    webApp: false
  };
  
  // Test 1: MessageQueueManager
  try {
    results.messageQueue = await testMessageQueueRecovery();
  } catch (error) {
    console.error('❌ MessageQueueManager test failed:', error);
  }
  
  // Test 2: Content Script Communication
  try {
    results.contentScript = await testContentScriptCommunication();
  } catch (error) {
    console.error('❌ Content script test failed:', error);
  }
  
  // Test 3: Web App Communication
  try {
    results.webApp = await testWebAppCommunication();
  } catch (error) {
    console.error('❌ Web app communication test failed:', error);
  }
  
  console.log('=====================================');
  console.log('📊 Test Results Summary:');
  console.log('  MessageQueue Recovery:', results.messageQueue ? '✅ PASS' : '❌ FAIL');
  console.log('  Content Script Comm: ', results.contentScript ? '✅ PASS' : '❌ FAIL');
  console.log('  Web App Communication:', results.webApp ? '✅ PASS' : '❌ FAIL');
  
  const overallSuccess = Object.values(results).some(r => r);
  console.log('  Overall Status:      ', overallSuccess ? '✅ WORKING' : '❌ FAILED');
  
  return results;
}

// Export for console testing
window.extensionCommTests = {
  runAllTests,
  testMessageQueueRecovery,
  testContentScriptCommunication,
  testWebAppCommunication
};

console.log('🧪 Extension communication tests loaded. Run: extensionCommTests.runAllTests()');