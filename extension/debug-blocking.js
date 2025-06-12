/**
 * Debug script for testing blocking functionality
 * Run this in the browser console on the extension background page
 */

async function debugBlocking() {
  console.log('🐛 Starting Blocking Debug...');
  
  try {
    // Get debug info
    const debugResponse = await chrome.runtime.sendMessage({ 
      type: 'GET_DEBUG_INFO', 
      payload: { domain: 'facebook.com' } 
    });
    
    console.log('📊 Debug Info:', debugResponse);
    
    // Get blocked sites
    const blockedSitesResponse = await chrome.runtime.sendMessage({ type: 'GET_BLOCKED_SITES' });
    console.log('🚫 Blocked Sites:', blockedSitesResponse);
    
    // Get current dynamic rules
    const dynamicRules = await chrome.declarativeNetRequest.getDynamicRules();
    console.log('⚙️ Dynamic Rules:', dynamicRules);
    
    // Get static rules
    const staticRules = await chrome.declarativeNetRequest.getSessionRules();
    console.log('📋 Session Rules:', staticRules);
    
    // Test focus mode status
    const currentState = await chrome.runtime.sendMessage({ type: 'GET_CURRENT_STATE' });
    console.log('🎯 Current State:', currentState);
    
  } catch (error) {
    console.error('❌ Error during debug:', error);
  }
}

async function resetAndTest() {
  console.log('🧹 Resetting blocking state...');
  
  try {
    // Reset blocking state
    const resetResponse = await chrome.runtime.sendMessage({ type: 'RESET_BLOCKING_STATE' });
    console.log('✅ Reset Result:', resetResponse);
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Run debug again
    await debugBlocking();
    
  } catch (error) {
    console.error('❌ Error during reset and test:', error);
  }
}

// Auto-run debug when script loads
debugBlocking();

console.log('🔧 Debug functions available:');
console.log('- debugBlocking() - Get current debug info');
console.log('- resetAndTest() - Reset state and test again'); 