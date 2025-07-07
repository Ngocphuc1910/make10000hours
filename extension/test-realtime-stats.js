/**
 * Test script to verify real-time stats functionality
 * Run this in the browser console to test the changes
 */

async function waitForExtensionReady(maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Try to get extension info - this will fail if not ready
      await chrome.runtime.sendMessage({ type: 'GET_CURRENT_STATE' });
      return true;
    } catch (error) {
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  return false;
}

async function testRealTimeStats() {
  console.log('🧪 Testing Real-Time Stats Implementation...');
  
  try {
    // Wait for extension to be ready
    const isReady = await waitForExtensionReady();
    if (!isReady) {
      console.error('❌ Extension not ready after retries');
      return null;
    }

    // Test 1: Check if GET_REALTIME_STATS message is working
    console.log('📡 Test 1: Testing GET_REALTIME_STATS message...');
    
    const response = await chrome.runtime.sendMessage({
      type: 'GET_REALTIME_STATS'
    });
    
    if (response && response.success) {
      console.log('✅ GET_REALTIME_STATS is working!');
      console.log('📊 Real-time stats data:', response.data);
      
      // Verify data structure with safe access - updated to match actual structure
      if (response.data && typeof response.data === 'object') {
        console.log('✅ Data structure is correct');
        // Use nullish coalescing to handle initialization state
        const totalTime = response.data.totalTime ?? 0;
        const sitesVisited = response.data.sitesVisited ?? 0;
        const sites = response.data.sites || {};
        
        console.log(`📈 Total time: ${totalTime}ms`);
        console.log(`🌐 Sites visited: ${sitesVisited}`);
        console.log(`📋 Site count: ${Object.keys(sites).length}`);
        console.log('🗂️ Sites data:', sites);
      } else {
        console.warn('⚠️ Missing or invalid stats data in response');
      }
    } else {
      console.error('❌ GET_REALTIME_STATS failed:', response);
    }
    
    // Test 2: Compare with old GET_TODAY_STATS
    console.log('\n📡 Test 2: Comparing with GET_TODAY_STATS...');
    
    const oldResponse = await chrome.runtime.sendMessage({
      type: 'GET_TODAY_STATS'
    });
    
    if (oldResponse && oldResponse.success) {
      console.log('📊 Old stats total time:', oldResponse.data?.todayStats?.totalTime ?? 0);
      console.log('📊 Old stats sites:', oldResponse.data?.todayStats?.sites);
      console.log('📊 Real-time total time:', response.data?.totalTime ?? 0);
      
      const timeDifference = (response.data?.totalTime ?? 0) - (oldResponse.data?.todayStats?.totalTime ?? 0);
      console.log(`⏱️ Time difference: ${timeDifference}ms`);
      
      if (timeDifference >= 0) {
        console.log('✅ Real-time stats show equal or more recent data');
      } else {
        console.warn('⚠️ Real-time stats show less time than stored stats');
      }
    }
    
    // Test 3: Test new GET_REALTIME_TOP_SITES
    console.log('\n📡 Test 3: Testing GET_REALTIME_TOP_SITES...');
    
    const topSitesResponse = await chrome.runtime.sendMessage({
      type: 'GET_REALTIME_TOP_SITES',
      payload: { limit: 20 }
    });
    
    if (topSitesResponse && topSitesResponse.success) {
      console.log('✅ GET_REALTIME_TOP_SITES is working!');
      console.log('📊 Top sites data:', topSitesResponse.data);
      console.log(`📋 Top sites count: ${topSitesResponse.data.length}`);
      
      if (topSitesResponse.data.length === 0) {
        console.warn('⚠️ Top sites returned empty array - this explains "No sites tracked today"');
      } else {
        const totalSiteTime = topSitesResponse.data.reduce((sum, site) => sum + site.timeSpent, 0);
        console.log(`📈 Total time from sites: ${totalSiteTime}ms`);
      }
    } else {
      console.error('❌ GET_REALTIME_TOP_SITES failed:', topSitesResponse);
    }
    
    // Test 4: Test current session detection
    console.log('\n📡 Test 4: Testing current session detection...');
    
    const currentStateResponse = await chrome.runtime.sendMessage({
      type: 'GET_CURRENT_STATE'
    });
    
    if (currentStateResponse && currentStateResponse.success) {
      console.log('🔍 Current session state:', currentStateResponse.data);
      
      if (currentStateResponse.data.tracking) {
        console.log('✅ Active session detected');
        console.log(`🌐 Current domain: ${currentStateResponse.data.currentSession?.domain || 'N/A'}`);
        console.log(`⏰ Session start: ${currentStateResponse.data.currentSession?.startTime ? new Date(currentStateResponse.data.currentSession.startTime) : 'N/A'}`);
      } else {
        console.log('ℹ️ No active session');
      }
    }
    
    console.log('\n🎉 Real-time stats test completed!');
    return {
      realTimeStats: response.data,
      oldStats: oldResponse.data,
      topSites: topSitesResponse.data,
      currentState: currentStateResponse.data
    };
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return null;
  }
}

// Test popup integration
async function testPopupIntegration() {
  console.log('\n🧪 Testing Popup Integration...');
  
  // Check if popup is using the new message
  console.log('📋 To test popup integration:');
  console.log('1. Open the extension popup');
  console.log('2. Check the browser console for messages from popup.js');
  console.log('3. Look for "GET_REALTIME_TOP_SITES" instead of "GET_TOP_SITES"');
  console.log('4. Verify the On Screen Time updates quickly (within 5 seconds)');
  console.log('5. Compare with Deep Focus page on make10000hours.com');
  console.log('6. Check for debug logs starting with "🔍 DEBUG"');
}

// Quick test for stored data
async function testStoredData() {
  console.log('\n🧪 Testing Stored Data...');
  
  try {
    const storage = await chrome.storage.local.get(['stats']);
    const today = new Date().toISOString().split('T')[0];
    const todayStats = storage.stats?.[today];
    
    console.log('📊 Chrome storage data for today:', {
      hasStats: !!storage.stats,
      hasTodayStats: !!todayStats,
      todayDate: today,
      todayStats: todayStats
    });
    
    if (todayStats) {
      console.log('✅ Found stored data for today');
      console.log(`📈 Total time: ${todayStats.totalTime}ms`);
      console.log(`📋 Sites count: ${Object.keys(todayStats.sites || {}).length}`);
      console.log('🗂️ Sites:', todayStats.sites);
    } else {
      console.warn('⚠️ No stored data found for today - extension may not be tracking properly');
    }
    
  } catch (error) {
    console.error('❌ Error checking stored data:', error);
  }
}

// Run the tests
console.log('🚀 Starting Comprehensive Real-Time Stats Tests...');
testRealTimeStats().then(results => {
  if (results) {
    console.log('\n📊 Test Results Summary:');
    console.log('Real-time total time:', results.realTimeStats?.totalTime || 0);
    console.log('Stored total time:', results.oldStats?.todayStats?.totalTime || 0);
    console.log('Top sites count:', results.topSites?.length || 0);
    console.log('Active session:', results.currentState?.tracking || false);
  }
  
  testPopupIntegration();
  testStoredData();
});

// Export functions for manual testing
window.testRealTimeStats = testRealTimeStats;
window.testPopupIntegration = testPopupIntegration;
window.testStoredData = testStoredData; 