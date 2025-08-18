/**
 * Test Extension Communication Protocol
 * Simulate what the extension should send back
 */

declare global {
  interface Window {
    simulateExtensionResponse: () => void;
    testExtensionProtocol: () => void;
  }
}

// Simulate what the extension should send back
window.simulateExtensionResponse = () => {
  console.log('🧪 ================================');
  console.log('🧪 SIMULATING EXTENSION RESPONSE');
  console.log('🧪 ================================');
  
  // Get current user for realistic data
  const { useUserStore } = window as any;
  const user = useUserStore?.getState?.()?.user;
  const userId = user?.uid || 'test-user-id';
  
  // Create realistic session data that the extension should send
  const mockSessions = [
    {
      domain: 'github.com',
      duration: 1800, // 30 minutes in seconds
      startTimeUTC: new Date(Date.now() - 1800000).toISOString(),
      endTimeUTC: new Date().toISOString(),
      status: 'completed',
      utcDate: new Date().toISOString().split('T')[0],
      userId: userId
    },
    {
      domain: 'stackoverflow.com',
      duration: 900, // 15 minutes in seconds  
      startTimeUTC: new Date(Date.now() - 900000).toISOString(),
      endTimeUTC: new Date().toISOString(),
      status: 'completed',
      utcDate: new Date().toISOString().split('T')[0],
      userId: userId
    },
    {
      domain: 'docs.google.com',
      duration: 1200, // 20 minutes in seconds
      startTimeUTC: new Date(Date.now() - 1200000).toISOString(), 
      endTimeUTC: new Date().toISOString(),
      status: 'completed',
      utcDate: new Date().toISOString().split('T')[0],
      userId: userId
    }
  ];
  
  console.log('📦 Mock extension sessions:', mockSessions);
  
  // Simulate the correct extension response message
  const extensionResponse = {
    type: 'EXTENSION_SITE_USAGE_SESSION_BATCH',
    payload: {
      sessions: mockSessions
    },
    source: 'extension',
    timestamp: new Date().toISOString()
  };
  
  console.log('🚀 Sending simulated extension response...');
  console.log('📤 Response format:', extensionResponse);
  
  // Send the message that the extension should send
  window.postMessage(extensionResponse, '*');
  
  console.log('✅ Simulated extension response sent');
};

// Test the complete protocol
window.testExtensionProtocol = () => {
  console.log('🔄 ================================');
  console.log('🔄 TESTING EXTENSION PROTOCOL');
  console.log('🔄 ================================');
  
  console.log('1. 📤 Sending request to extension...');
  
  // Send request like our sync listener does
  window.postMessage({ 
    type: 'REQUEST_SITE_USAGE_SESSIONS', 
    source: 'web-app',
    timestamp: new Date().toISOString()
  }, '*');
  
  console.log('2. ⏱️ Waiting 2 seconds for extension response...');
  
  setTimeout(() => {
    console.log('3. 🧪 No real extension response, simulating correct response...');
    window.simulateExtensionResponse();
  }, 2000);
};

export {};