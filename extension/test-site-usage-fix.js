/**
 * Test script to verify the site usage fix
 * Run this in the browser console to test the debugging changes
 */

async function testSiteUsageFix() {
  console.log('🧪 TESTING SITE USAGE FIX');
  console.log('==========================');
  
  try {
    // Test 1: Direct storage check
    console.log('\n📦 Test 1: Checking raw storage...');
    const storage = await chrome.storage.local.get(['stats']);
    const today = new Date().toISOString().split('T')[0];
    const todayStats = storage.stats?.[today];
    
    console.log('📅 Today:', today);
    console.log('💾 Storage stats exists:', !!storage.stats);
    console.log('📊 Today stats exists:', !!todayStats);
    
    if (todayStats) {
      console.log('✅ Storage data found:', {
        totalTime: todayStats.totalTime,
        sitesCount: Object.keys(todayStats.sites || {}).length,
        sites: todayStats.sites
      });
    } else {
      console.warn('⚠️ No storage data found for today');
    }
    
    // Test 2: Test GET_REALTIME_TOP_SITES with debug logging
    console.log('\n🏆 Test 2: Testing GET_REALTIME_TOP_SITES with debug logging...');
    console.log('📋 Check the background script console for debug messages starting with "🔍 DEBUG"');
    
    const topSitesResponse = await chrome.runtime.sendMessage({
      type: 'GET_REALTIME_TOP_SITES',
      payload: { limit: 20 }
    });
    
    console.log('📨 GET_REALTIME_TOP_SITES response:', topSitesResponse);
    
    if (topSitesResponse?.success) {
      const sites = topSitesResponse.data;
      console.log('✅ Message successful');
      console.log('📋 Sites count:', sites.length);
      console.log('🗂️ Sites data:', sites);
      
      if (sites.length === 0) {
        console.warn('⚠️ Still returning empty array - check background console for debug logs');
      } else {
        console.log('✅ Sites found! Issue should be fixed');
        sites.forEach((site, index) => {
          console.log(`${index + 1}. ${site.domain}: ${site.timeSpent}ms (${site.visits} visits)`);
        });
      }
    } else {
      console.error('❌ GET_REALTIME_TOP_SITES failed:', topSitesResponse);
    }
    
    // Test 3: Test popup behavior
    console.log('\n🎯 Test 3: Popup behavior test...');
    console.log('📋 Instructions:');
    console.log('1. Open the extension popup');
    console.log('2. Go to the "Site Usage" tab');
    console.log('3. Check if it shows sites instead of "Loading stats..."');
    console.log('4. Check the popup console for any error messages');
    
    // Test 4: Compare with stored data
    if (todayStats && topSitesResponse?.success) {
      console.log('\n🔍 Test 4: Data comparison...');
      const storedSitesCount = Object.keys(todayStats.sites || {}).length;
      const returnedSitesCount = topSitesResponse.data.length;
      
      console.log('📊 Stored sites count:', storedSitesCount);
      console.log('🏆 Returned sites count:', returnedSitesCount);
      
      if (storedSitesCount > 0 && returnedSitesCount === 0) {
        console.error('❌ MISMATCH: Storage has sites but API returns empty');
        console.log('🔍 Check the background console debug logs for filtering issues');
      } else if (storedSitesCount > 0 && returnedSitesCount > 0) {
        console.log('✅ Data flow working correctly');
      } else {
        console.log('ℹ️ No stored data to compare');
      }
    }
    
    return {
      storageData: todayStats,
      apiResponse: topSitesResponse,
      success: topSitesResponse?.success && topSitesResponse?.data?.length > 0
    };
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return { error };
  }
}

// Test the fix
console.log('🚀 Running Site Usage Fix Test...');
testSiteUsageFix().then(result => {
  console.log('\n🎉 Test completed!');
  console.log('Result:', result);
  
  if (result.success) {
    console.log('✅ Site usage fix appears to be working!');
  } else if (result.error) {
    console.error('❌ Test encountered an error');
  } else {
    console.warn('⚠️ Issue may still exist - check debug logs');
  }
  
  console.log('\n📋 Next steps:');
  console.log('1. Check the background script console for debug logs');
  console.log('2. Open the popup and test the Site Usage tab');
  console.log('3. If still not working, examine the debug logs to identify the issue');
});

// Make function available for manual testing
window.testSiteUsageFix = testSiteUsageFix;