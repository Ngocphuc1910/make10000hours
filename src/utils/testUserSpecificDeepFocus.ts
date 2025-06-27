/**
 * Test utility for verifying user-specific deep focus state isolation
 * Run this in browser console to test multi-user scenario
 */

export const testUserSpecificDeepFocus = () => {
  console.log('🧪 Testing User-Specific Deep Focus State Isolation');
  console.log('===================================================');
  
  // Test 1: Check current storage keys
  console.log('1. Current localStorage keys:');
  const keys = Object.keys(localStorage);
  const deepFocusKeys = keys.filter(key => key.startsWith('deep-focus-storage'));
  deepFocusKeys.forEach(key => {
    console.log(`   📦 ${key}:`, localStorage.getItem(key) ? 'has data' : 'empty');
  });
  
  // Test 2: Check current user context
  console.log('\n2. Current user context:');
  try {
    const userStorage = localStorage.getItem('user-store');
    if (userStorage) {
      const parsed = JSON.parse(userStorage);
      const userId = parsed?.state?.user?.uid;
      console.log(`   👤 Current user ID: ${userId || 'none'}`);
      console.log(`   📧 Current user email: ${parsed?.state?.user?.email || 'none'}`);
    } else {
      console.log('   ❌ No user store found');
    }
  } catch (error) {
    console.log('   ❌ Error reading user store:', error);
  }
  
  // Test 3: Simulate user switch
  console.log('\n3. Test user-specific storage isolation:');
  console.log('   📝 Instructions:');
  console.log('   1. Open this page in another tab');
  console.log('   2. Login with a different account in the new tab');
  console.log('   3. Toggle deep focus in one tab');
  console.log('   4. Check if the other tab is affected');
  
  // Test 4: Check extension sync state
  console.log('\n4. Extension sync test:');
  console.log('   🔄 Testing extension user sync...');
  window.postMessage({
    type: 'EXTENSION_REQUEST',
    messageId: Date.now(),
    payload: { type: 'GET_USER_INFO' }
  }, '*');
  
  return {
    deepFocusKeys,
    currentUser: (() => {
      try {
        const userStorage = localStorage.getItem('user-store');
        return userStorage ? JSON.parse(userStorage)?.state?.user : null;
      } catch {
        return null;
      }
    })()
  };
};

// Helper function to clear all deep focus storage for testing
export const clearAllDeepFocusStorage = () => {
  console.log('🧹 Clearing all deep focus storage...');
  const keys = Object.keys(localStorage);
  const deepFocusKeys = keys.filter(key => key.startsWith('deep-focus-storage'));
  
  deepFocusKeys.forEach(key => {
    localStorage.removeItem(key);
    console.log(`   ✅ Removed: ${key}`);
  });
  
  console.log('✅ All deep focus storage cleared');
};

// Helper function to simulate user switch
export const simulateUserSwitch = (newUserId: string) => {
  console.log(`🔄 Simulating user switch to: ${newUserId}`);
  
  // This would normally be handled by the auth system
  console.log('⚠️ Note: This is a simulation - actual user switching requires proper authentication');
  console.log('📝 Expected behavior:');
  console.log(`   - New storage key: deep-focus-storage-${newUserId}`);
  console.log('   - Previous user storage should be isolated');
  console.log('   - Extension should sync with new user context');
};

// Global helpers for console usage
if (typeof window !== 'undefined') {
  (window as any).testUserSpecificDeepFocus = testUserSpecificDeepFocus;
  (window as any).clearAllDeepFocusStorage = clearAllDeepFocusStorage;
  (window as any).simulateUserSwitch = simulateUserSwitch;
} 