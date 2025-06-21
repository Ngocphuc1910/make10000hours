/**
 * Test script to verify user information sync between web app and extension
 * Run this in the browser console on the web app page to test user sync
 */

async function testUserSync() {
  console.log('🧪 Starting user sync test...');

  // Test data
  const testUser = {
    userId: 'test-user-123',
    userEmail: 'test@example.com',
    displayName: 'Test User'
  };

  try {
    // 1. Test sending user info to extension
    console.log('📤 Sending user info to extension:', testUser);
    
    window.postMessage({
      type: 'SET_USER_ID',
      payload: testUser,
      source: 'make10000hours-webapp'
    }, '*');

    console.log('✅ User info sent to extension');

    // 2. Wait a moment for processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. Test retrieving user info
    console.log('📥 Testing user info retrieval...');
    
    // This would be done from the popup - simulated here
    const testRetrieve = () => {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
          type: 'GET_USER_INFO'
        }, (response) => {
          console.log('📋 Retrieved user info:', response);
          if (response?.success && response.data) {
            console.log('✅ User sync test PASSED');
            console.log('👤 User data:', {
              userId: response.data.userId,
              email: response.data.userEmail,
              name: response.data.displayName
            });
          } else {
            console.log('❌ User sync test FAILED - no user data');
          }
        });
      } else {
        console.log('ℹ️ Chrome extension API not available (run this in extension context)');
      }
    };

    testRetrieve();

  } catch (error) {
    console.error('❌ User sync test error:', error);
  }
}

// Test clearing user info
async function testUserClear() {
  console.log('🧹 Testing user info clearing...');
  
  window.postMessage({
    type: 'SET_USER_ID',
    payload: {
      userId: null,
      userEmail: null,
      displayName: null
    },
    source: 'make10000hours-webapp'
  }, '*');

  console.log('✅ User clear command sent');
}

// Helper function to generate test users
function generateTestUser(index = 1) {
  return {
    userId: `test-user-${index}`,
    userEmail: `user${index}@example.com`,
    displayName: `Test User ${index}`
  };
}

// Export functions for console use
window.testUserSync = testUserSync;
window.testUserClear = testUserClear;
window.generateTestUser = generateTestUser;

console.log('🎯 User sync test functions loaded');
console.log('📝 Run testUserSync() to test user info sync');
console.log('📝 Run testUserClear() to test user info clearing');
console.log('📝 Run generateTestUser(n) to generate test user data'); 