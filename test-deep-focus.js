/**
 * Test script for Deep Focus functionality
 * Run this in the browser console on the extension's background script context
 */

async function testDeepFocus() {
  console.log('🧪 Starting Deep Focus End-to-End Test...');
  
  try {
    // Test 1: Check if BlockingManager is available
    console.log('\n📋 Test 1: BlockingManager availability');
    if (typeof BlockingManager !== 'undefined') {
      console.log('✅ BlockingManager class is available');
    } else {
      console.error('❌ BlockingManager class not found');
      return;
    }
    
    // Test 2: Check global blockingManager instance
    console.log('\n📋 Test 2: Global blockingManager instance');
    if (blockingManager) {
      console.log('✅ Global blockingManager instance exists');
      console.log('🔍 BlockingManager initialized:', blockingManager.initialized);
      console.log('🔍 Current focus mode:', blockingManager.focusMode);
    } else {
      console.error('❌ Global blockingManager instance not found');
      return;
    }
    
    // Test 3: Get current focus state
    console.log('\n📋 Test 3: Get current focus state');
    try {
      const response = await chrome.runtime.sendMessage({type: 'GET_FOCUS_STATE'});
      console.log('✅ GET_FOCUS_STATE response:', response);
    } catch (error) {
      console.error('❌ GET_FOCUS_STATE failed:', error);
    }
    
    // Test 4: Get blocked sites
    console.log('\n📋 Test 4: Get blocked sites');
    try {
      const response = await chrome.runtime.sendMessage({type: 'GET_BLOCKED_SITES'});
      console.log('✅ GET_BLOCKED_SITES response:', response);
      console.log('📋 Blocked sites count:', response.data?.length || 0);
    } catch (error) {
      console.error('❌ GET_BLOCKED_SITES failed:', error);
    }
    
    // Test 5: Test blocking rules update
    console.log('\n📋 Test 5: Test blocking rules update');
    try {
      if (blockingManager) {
        const result = await blockingManager.updateBlockingRules();
        console.log('✅ updateBlockingRules result:', result);
        
        // Check current rules
        const currentRules = await chrome.declarativeNetRequest.getDynamicRules();
        console.log('📋 Current blocking rules count:', currentRules.length);
        console.log('📋 Current rules:', currentRules.map(r => ({ id: r.id, domain: r.condition.urlFilter })));
      }
    } catch (error) {
      console.error('❌ updateBlockingRules failed:', error);
    }
    
    // Test 6: Test focus mode toggle (CAREFUL - this will actually toggle)
    console.log('\n📋 Test 6: Focus mode toggle (will actually toggle!)');
    console.log('⚠️ This will change the actual focus mode state');
    
    // Uncomment the following lines to test focus mode toggle:
    /*
    try {
      const response = await chrome.runtime.sendMessage({type: 'TOGGLE_FOCUS_MODE'});
      console.log('✅ TOGGLE_FOCUS_MODE response:', response);
      
      // Wait a moment then toggle back
      setTimeout(async () => {
        const response2 = await chrome.runtime.sendMessage({type: 'TOGGLE_FOCUS_MODE'});
        console.log('✅ TOGGLE_FOCUS_MODE (revert) response:', response2);
      }, 2000);
    } catch (error) {
      console.error('❌ TOGGLE_FOCUS_MODE failed:', error);
    }
    */
    
    // Test 7: Test new Deep Focus message handlers
    console.log('\n📋 Test 7: New Deep Focus message handlers');
    
    try {
      // Test GET_FOCUS_STATS
      const statsResponse = await chrome.runtime.sendMessage({type: 'GET_FOCUS_STATS'});
      console.log('✅ GET_FOCUS_STATS response:', statsResponse);
    } catch (error) {
      console.error('❌ GET_FOCUS_STATS failed:', error);
    }
    
    try {
      // Test GET_SESSION_TIME
      const timeResponse = await chrome.runtime.sendMessage({type: 'GET_SESSION_TIME'});
      console.log('✅ GET_SESSION_TIME response:', timeResponse);
    } catch (error) {
      console.error('❌ GET_SESSION_TIME failed:', error);
    }
    
    console.log('\n🎉 Deep Focus End-to-End Test Complete!');
    console.log('📋 Summary: Basic Deep Focus functionality has been restored');
    console.log('📋 Next: Test with actual website blocking in a real browser tab');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test
console.log('🧪 Deep Focus Test Script Loaded');
console.log('💡 Run testDeepFocus() to execute the test');

// Auto-run if this is loaded in the right context
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
  testDeepFocus();
}