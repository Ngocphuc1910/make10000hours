/**
 * Test utility to verify user sync between web app and extension
 */

export async function testUserSync(userId: string) {
  console.log('🧪 Testing User Sync with Extension');
  console.log('===================================');
  
  try {
    // Test 1: Send user ID to extension
    console.log('📤 Sending user ID to extension...');
    
    if (typeof (window as any).chrome !== 'undefined' && 
        (window as any).chrome?.runtime?.sendMessage) {
      
      const response = await (window as any).chrome.runtime.sendMessage({
        type: 'SET_USER_ID',
        payload: { 
          userId,
          userEmail: 'test@example.com',
          displayName: 'Test User'
        }
      });
      
      console.log('✅ Extension response:', response);
      
      // Test 2: Simulate override session
      console.log('📤 Testing override session with user ID...');
      
      const overrideResponse = await (window as any).chrome.runtime.sendMessage({
        type: 'RECORD_OVERRIDE_SESSION',
        payload: {
          domain: 'test-sync.com',
          duration: 5
        }
      });
      
      console.log('✅ Override response:', overrideResponse);
      
    } else {
      console.warn('⚠️ Chrome extension API not available');
    }
    
  } catch (error) {
    console.error('❌ User sync test failed:', error);
  }
}

export async function checkExtensionUserState() {
  console.log('🔍 Checking Extension User State');
  console.log('================================');
  
  try {
    if (typeof (window as any).chrome !== 'undefined' && 
        (window as any).chrome?.runtime?.sendMessage) {
      
      // We don't have a direct way to get user state, but we can test with a dummy override
      const response = await (window as any).chrome.runtime.sendMessage({
        type: 'RECORD_OVERRIDE_SESSION',
        payload: {
          domain: 'state-check.com',
          duration: 1
        }
      });
      
      console.log('📊 Extension state check response:', response);
      
    } else {
      console.warn('⚠️ Chrome extension API not available');
    }
    
  } catch (error) {
    console.error('❌ Extension state check failed:', error);
  }
} 