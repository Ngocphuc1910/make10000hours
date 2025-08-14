/**
 * Test Script for Periodic Save Fix
 * 
 * This script verifies that the periodic save fix is working correctly:
 * - Time accumulates every 3 seconds during active usage
 * - Tab switch cooldown only blocks finalization saves
 * - Incremental saves continue working during cooldown
 * 
 * Usage: Paste in Chrome Extension Console
 */

console.log('🧪 Testing periodic save fix...');

window.periodicSaveFixTest = {
  monitoring: false,
  results: [],
  startTime: Date.now(),
  initialDuration: 0,
  sessionId: null
};

/**
 * Start monitoring periodic saves with the new fix
 */
async function testPeriodicSaveFix() {
  console.log('\n=== TESTING PERIODIC SAVE FIX ===');
  console.log('📋 This test verifies that time accumulates every 3 seconds while staying on the current tab');
  console.log('⚠️ DO NOT switch tabs during this test!');
  
  window.periodicSaveFixTest.monitoring = true;
  window.periodicSaveFixTest.results = [];
  window.periodicSaveFixTest.startTime = Date.now();
  
  // Get current session
  const currentDomain = window.location.hostname.replace('www.', '');
  const storage = await chrome.storage.local.get(['site_usage_sessions']);
  const today = new Date().toISOString().split('T')[0];
  const sessions = storage.site_usage_sessions?.[today] || [];
  
  const activeSession = sessions.find(s => s.domain === currentDomain && s.status === 'active');
  
  if (!activeSession) {
    console.error('❌ No active session found for current domain:', currentDomain);
    console.log('💡 Try refreshing the page and run this test again');
    return;
  }
  
  window.periodicSaveFixTest.initialDuration = activeSession.duration;
  window.periodicSaveFixTest.sessionId = activeSession.id;
  
  console.log('📊 Test Starting State:');
  console.log(`   Domain: ${activeSession.domain}`);
  console.log(`   Session ID: ${activeSession.id}`);
  console.log(`   Initial Duration: ${activeSession.duration}s`);
  console.log(`   Status: ${activeSession.status}`);
  
  console.log('\n👀 Monitoring for 30 seconds...');
  console.log('🎯 Expected: Duration should increase by ~3s every 3 seconds');
  console.log('✅ Fix Success Criteria: Multiple duration increases detected');
  
  let lastDuration = activeSession.duration;
  let updateCount = 0;
  
  // Monitor every 2 seconds (faster than save interval to catch all updates)
  const monitorInterval = setInterval(async () => {
    if (!window.periodicSaveFixTest.monitoring) {
      clearInterval(monitorInterval);
      return;
    }
    
    try {
      const currentStorage = await chrome.storage.local.get(['site_usage_sessions']);
      const currentSessions = currentStorage.site_usage_sessions?.[today] || [];
      const updatedSession = currentSessions.find(s => s.id === activeSession.id);
      
      if (!updatedSession) {
        console.error('❌ Session not found - may have been completed');
        stopPeriodicSaveFixTest();
        return;
      }
      
      // Check for duration increase
      if (updatedSession.duration > lastDuration) {
        updateCount++;
        const increase = updatedSession.duration - lastDuration;
        const timestamp = new Date().toLocaleTimeString();
        
        console.log(`📈 [${timestamp}] Duration increased: +${increase}s (total: ${updatedSession.duration}s)`);
        
        window.periodicSaveFixTest.results.push({
          timestamp: Date.now(),
          elapsedTime: Math.round((Date.now() - window.periodicSaveFixTest.startTime) / 1000),
          oldDuration: lastDuration,
          newDuration: updatedSession.duration,
          increase: increase
        });
        
        lastDuration = updatedSession.duration;
      }
      
      // Check session status
      if (updatedSession.status !== 'active') {
        console.warn(`⚠️ Session status changed to: ${updatedSession.status}`);
        if (updatedSession.status === 'completed') {
          console.log('ℹ️ Session completed - stopping test');
          stopPeriodicSaveFixTest();
        }
      }
      
    } catch (error) {
      console.error('❌ Error monitoring session:', error);
    }
  }, 2000);
  
  // Auto-stop test after 30 seconds
  setTimeout(() => {
    if (window.periodicSaveFixTest.monitoring) {
      stopPeriodicSaveFixTest();
    }
  }, 30000);
  
  console.log('🛑 Run stopPeriodicSaveFixTest() to stop early and see results');
}

/**
 * Stop the test and analyze results
 */
function stopPeriodicSaveFixTest() {
  console.log('\n=== PERIODIC SAVE FIX TEST RESULTS ===');
  
  window.periodicSaveFixTest.monitoring = false;
  const { results, startTime, initialDuration } = window.periodicSaveFixTest;
  const testDuration = Math.round((Date.now() - startTime) / 1000);
  
  console.log(`📊 Test Summary (${testDuration}s):`);
  console.log(`   Initial Duration: ${initialDuration}s`);
  console.log(`   Duration Updates Detected: ${results.length}`);
  
  if (results.length === 0) {
    console.error('❌ FIX FAILED: No duration increases detected!');
    console.log('💡 This indicates periodic saves are still blocked');
    console.log('🔍 Possible causes:');
    console.log('   - Tab switch cooldown still affecting incremental saves');
    console.log('   - Other safeguards blocking periodic saves');
    console.log('   - Extension not running properly');
  } else {
    const totalIncrease = results.reduce((sum, r) => sum + r.increase, 0);
    const avgInterval = testDuration / results.length;
    
    console.log(`   Total Duration Increase: ${totalIncrease}s`);
    console.log(`   Average Update Interval: ${avgInterval.toFixed(1)}s`);
    
    if (results.length >= 3 && avgInterval >= 2 && avgInterval <= 5) {
      console.log('✅ FIX SUCCESSFUL: Periodic saves working correctly!');
      console.log('🎉 Time now accumulates during active usage');
    } else if (results.length === 1) {
      console.warn('⚠️ PARTIAL FIX: Only one update detected');
      console.log('💡 May need longer test or check for remaining blockers');
    } else if (avgInterval > 5) {
      console.warn('⚠️ SLOW UPDATES: Updates happening slower than expected');
      console.log('💡 Check for remaining validation blockers');
    } else {
      console.log('✅ FIX WORKING: Multiple updates detected');
    }
    
    console.log('\n📋 Update Timeline:');
    results.forEach((result, index) => {
      const time = new Date(result.timestamp).toLocaleTimeString();
      console.log(`   ${index + 1}. [${time}] +${result.increase}s (at ${result.elapsedTime}s elapsed)`);
    });
  }
  
  // Expected vs actual analysis
  const expectedUpdates = Math.floor(testDuration / 3); // Every 3 seconds
  const actualUpdates = results.length;
  
  console.log(`\n🎯 Expected vs Actual:`);
  console.log(`   Expected updates (~every 3s): ${expectedUpdates}`);
  console.log(`   Actual updates detected: ${actualUpdates}`);
  
  if (actualUpdates >= expectedUpdates * 0.7) {
    console.log('✅ Update frequency is good (≥70% of expected)');
  } else {
    console.warn(`⚠️ Missing updates detected (${Math.round((1 - actualUpdates/expectedUpdates) * 100)}% missing)`);
  }
  
  return {
    testDuration,
    updatesDetected: results.length,
    totalIncrease: results.reduce((sum, r) => sum + r.increase, 0),
    avgInterval: testDuration / results.length,
    success: results.length >= 3 && (testDuration / results.length) <= 5
  };
}

/**
 * Quick test to verify session is tracking
 */
async function quickSessionCheck() {
  const currentDomain = window.location.hostname.replace('www.', '');
  const storage = await chrome.storage.local.get(['site_usage_sessions']);
  const today = new Date().toISOString().split('T')[0];
  const sessions = storage.site_usage_sessions?.[today] || [];
  
  console.log(`🔍 Quick Session Check for ${currentDomain}:`);
  
  const domainSessions = sessions.filter(s => s.domain === currentDomain);
  if (domainSessions.length === 0) {
    console.log('❌ No sessions found for current domain');
    return false;
  }
  
  const activeSession = domainSessions.find(s => s.status === 'active');
  if (activeSession) {
    console.log('✅ Active session found:');
    console.log(`   Duration: ${activeSession.duration}s`);
    console.log(`   Started: ${new Date(activeSession.startTime).toLocaleTimeString()}`);
    console.log(`   Status: ${activeSession.status}`);
    return true;
  } else {
    console.log('⚠️ No active session - all sessions completed');
    domainSessions.forEach((session, index) => {
      console.log(`   ${index + 1}. Duration: ${session.duration}s, Status: ${session.status}`);
    });
    return false;
  }
}

// Export functions
window.testPeriodicSaveFix = testPeriodicSaveFix;
window.stopPeriodicSaveFixTest = stopPeriodicSaveFixTest;
window.quickSessionCheck = quickSessionCheck;

console.log('\n🚀 PERIODIC SAVE FIX TEST LOADED');
console.log('📋 Available commands:');
console.log('   quickSessionCheck() - Check if session is active');
console.log('   testPeriodicSaveFix() - Start 30-second monitoring test');
console.log('   stopPeriodicSaveFixTest() - Stop test early and see results');
console.log('\n💡 Instructions:');
console.log('1. Stay on this tab (do NOT switch tabs)');
console.log('2. Run testPeriodicSaveFix()');
console.log('3. Wait for results (auto-stops after 30s)');
console.log('4. Look for ✅ FIX SUCCESSFUL message');