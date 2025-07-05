/**
 * Extension Verification Script
 * Quick test to verify the real-time stats are working
 */

// Simple test function that you can run in the browser console
async function quickTest() {
  console.log('🔍 Quick Extension Test...');
  
  try {
    // Test the basic message communication
    const testResponse = await chrome.runtime.sendMessage({ type: 'GET_REALTIME_STATS' });
    console.log('GET_REALTIME_STATS Response:', testResponse);
    
    // Test the new top sites endpoint
    const topSitesResponse = await chrome.runtime.sendMessage({ 
      type: 'GET_REALTIME_TOP_SITES', 
      payload: { limit: 10 } 
    });
    console.log('GET_REALTIME_TOP_SITES Response:', topSitesResponse);
    
    // Check if we have data
    if (testResponse.success && testResponse.data.totalTime > 0) {
      console.log('✅ Extension is tracking time properly');
      console.log(`📊 Total time: ${testResponse.data.totalTime}ms`);
      
      if (topSitesResponse.success && topSitesResponse.data.length > 0) {
        console.log('✅ Top sites data is available');
        console.log(`📋 Sites count: ${topSitesResponse.data.length}`);
        console.log('🌐 Sites:', topSitesResponse.data.map(s => `${s.domain}: ${s.timeSpent}ms`));
      } else {
        console.log('❌ No top sites data - this is the issue!');
      }
    } else {
      console.log('❌ Extension is not tracking time properly');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Export for global use
window.quickTest = quickTest;

console.log('🚀 Extension verification loaded. Run quickTest() to test the fix.'); 