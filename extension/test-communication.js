/**
 * Test script for extension communication
 * Run this in the browser console on the web app to test extension communication
 */

console.log('🧪 Testing extension communication...');

// Test the new EXTENSION_REQUEST method
const testExtensionCommunication = () => {
  return new Promise((resolve, reject) => {
    const messageId = Math.random().toString(36);
    const timeoutId = setTimeout(() => {
      window.removeEventListener('message', responseHandler);
      reject(new Error('Communication timeout'));
    }, 5000);

    const responseHandler = (event) => {
      if (event.data?.extensionResponseId === messageId) {
        clearTimeout(timeoutId);
        window.removeEventListener('message', responseHandler);
        console.log('✅ Extension response received:', event.data.response);
        resolve(event.data.response);
      }
    };

    window.addEventListener('message', responseHandler);
    
    console.log('📤 Sending test message to extension...');
    window.postMessage({
      type: 'EXTENSION_REQUEST',
      messageId,
      payload: { type: 'GET_TODAY_STATS' }
    }, '*');
  });
};

// Run the test
testExtensionCommunication()
  .then(response => {
    console.log('🎉 Extension communication test successful!');
    console.log('📊 Response data:', response);
  })
  .catch(error => {
    console.error('❌ Extension communication test failed:', error);
  }); 