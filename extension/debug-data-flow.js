/**
 * Debug script to test the exact data flow issue
 */

async function testDataFlow() {
  console.log('🔍 TESTING DATA FLOW ISSUE');
  console.log('============================');
  
  // Test 1: Check storage directly
  console.log('\n📦 Test 1: Direct storage check...');
  const storage = await chrome.storage.local.get(['stats']);
  const today = new Date().toISOString().split('T')[0];
  const todayStats = storage.stats?.[today];
  
  console.log('📅 Today:', today);
  console.log('💾 Has storage.stats:', !!storage.stats);
  console.log('📊 Has today stats:', !!todayStats);
  
  if (todayStats) {
    console.log('✅ Today stats found:', {
      totalTime: todayStats.totalTime,
      sitesVisited: todayStats.sitesVisited,
      sitesCount: Object.keys(todayStats.sites || {}).length,
      sites: todayStats.sites
    });
    
    // Test the filtering logic manually
    console.log('\n🔍 Manual filtering test...');
    const sitesWithTime = Object.entries(todayStats.sites || {})
      .map(([domain, data]) => ({
        domain,
        timeSpent: data.timeSpent || 0,
        visits: data.visits || 0
      }))
      .filter(site => site.timeSpent > 0);
    
    console.log('📋 Sites with time > 0:', sitesWithTime.length);
    console.log('🗂️ Filtered sites:', sitesWithTime);
  }
  
  // Test 2: Test getTodayStats message
  console.log('\n📊 Test 2: getTodayStats message...');
  const todayStatsMsg = await chrome.runtime.sendMessage({ type: 'GET_TODAY_STATS' });
  console.log('📊 getTodayStats response:', todayStatsMsg.success);
  if (todayStatsMsg.success) {
    const stats = todayStatsMsg.data.todayStats;
    console.log('📈 Message total time:', stats.totalTime);
    console.log('🌐 Message sites count:', Object.keys(stats.sites || {}).length);
  }
  
  // Test 3: Test getRealTimeStatsWithSession
  console.log('\n🔄 Test 3: getRealTimeStatsWithSession...');
  const realTimeMsg = await chrome.runtime.sendMessage({ type: 'GET_REALTIME_STATS' });
  console.log('🔄 getRealTimeStats response:', realTimeMsg.success);
  if (realTimeMsg.success) {
    const stats = realTimeMsg.data;
    console.log('📈 Real-time total time:', stats.totalTime);
    console.log('🌐 Real-time sites count:', Object.keys(stats.sites || {}).length);
    console.log('🗂️ Real-time sites:', stats.sites);
  }
  
  // Test 4: Test getRealTimeTopSites
  console.log('\n🏆 Test 4: getRealTimeTopSites...');
  const topSitesMsg = await chrome.runtime.sendMessage({ 
    type: 'GET_REALTIME_TOP_SITES', 
    payload: { limit: 20 } 
  });
  console.log('🏆 getRealTimeTopSites response:', topSitesMsg.success);
  if (topSitesMsg.success) {
    console.log('📋 Top sites count:', topSitesMsg.data.length);
    console.log('🗂️ Top sites data:', topSitesMsg.data);
    
    if (topSitesMsg.data.length === 0) {
      console.error('❌ ISSUE CONFIRMED: getRealTimeTopSites returns empty array');
      console.log('🔍 Comparing with stored data...');
      
      if (todayStats && Object.keys(todayStats.sites || {}).length > 0) {
        console.error('❌ MISMATCH: Storage has sites but getRealTimeTopSites is empty');
        console.log('🔍 This suggests an issue in getRealTimeStatsWithSession or getRealTimeTopSites');
      }
    }
  }
  
  // Test 5: Check current session
  console.log('\n🎯 Test 5: Current session check...');
  const currentState = await chrome.runtime.sendMessage({ type: 'GET_CURRENT_STATE' });
  if (currentState.success) {
    console.log('🎯 Tracking active:', currentState.data.tracking);
    console.log('📍 Current session:', currentState.data.currentSession);
  }
  
  // Final analysis
  console.log('\n🔍 ANALYSIS:');
  console.log('============');
  
  const hasStoredData = todayStats && Object.keys(todayStats.sites || {}).length > 0;
  const hasRealTimeData = realTimeMsg.success && Object.keys(realTimeMsg.data?.sites || {}).length > 0;
  const hasTopSites = topSitesMsg.success && topSitesMsg.data.length > 0;
  
  console.log('📊 Has stored data:', hasStoredData);
  console.log('🔄 Has real-time data:', hasRealTimeData);
  console.log('🏆 Has top sites:', hasTopSites);
  
  if (hasStoredData && !hasRealTimeData) {
    console.error('❌ ISSUE: getRealTimeStatsWithSession is not accessing stored data properly');
  } else if (hasRealTimeData && !hasTopSites) {
    console.error('❌ ISSUE: getRealTimeTopSites filtering is removing all sites');
  } else if (!hasStoredData) {
    console.warn('⚠️ No data stored yet - extension may not be tracking properly');
  } else {
    console.log('✅ Data flow appears to be working correctly');
  }
}

// Run the test
testDataFlow();