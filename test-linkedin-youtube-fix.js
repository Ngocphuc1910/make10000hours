/**
 * Test Script for LinkedIn→YouTube Session Timestamp Fix
 * 
 * This script validates that the fix prevents LinkedIn sessions from being created
 * with YouTube timestamps during tab switches.
 * 
 * Usage: Paste in Chrome Extension Console (right-click extension → Inspect popup → Console)
 */

console.log('🧪 Testing LinkedIn→YouTube session timestamp fix...');

// Test state
window.timestampTest = {
  startTime: Date.now(),
  results: [],
  monitoring: false,
  sessionHistory: []
};

/**
 * Monitor session creation in real-time to verify fix
 */
async function startTimestampMonitoring() {
  console.log('\n=== STARTING TIMESTAMP FIX MONITORING ===');
  
  window.timestampTest.monitoring = true;
  window.timestampTest.sessionHistory = [];
  
  // Get initial session count
  const initialStorage = await chrome.storage.local.get(['site_usage_sessions']);
  const today = new Date().toISOString().split('T')[0];
  const initialSessions = initialStorage.site_usage_sessions?.[today] || [];
  const initialCount = initialSessions.length;
  
  console.log(`📊 Starting monitoring - Initial sessions: ${initialCount}`);
  
  // Monitor session changes every 500ms
  const monitoringInterval = setInterval(async () => {
    if (!window.timestampTest.monitoring) {
      clearInterval(monitoringInterval);
      return;
    }
    
    try {
      const storage = await chrome.storage.local.get(['site_usage_sessions']);
      const sessions = storage.site_usage_sessions?.[today] || [];
      
      if (sessions.length > initialCount) {
        const newSessions = sessions.slice(initialCount);
        
        newSessions.forEach(session => {
          const createdAt = new Date(session.createdAt || session.startTime);
          const startTime = new Date(session.startTime);
          const timeDiff = Math.abs(createdAt.getTime() - startTime.getTime());
          
          console.log(`\n🔍 NEW SESSION DETECTED:`);
          console.log(`   Domain: ${session.domain}`);
          console.log(`   Start Time: ${startTime.toISOString()}`);
          console.log(`   Created At: ${createdAt.toISOString()}`);
          console.log(`   Time Diff: ${timeDiff}ms`);
          console.log(`   Status: ${session.status}`);
          
          // Check for timing anomalies
          if (timeDiff > 5000) { // 5 second threshold
            console.error(`❌ POTENTIAL TIMING ISSUE: Start time and creation time differ by ${timeDiff}ms`);
            window.timestampTest.results.push({
              type: 'timing_anomaly',
              session: session,
              timeDiff: timeDiff,
              timestamp: Date.now()
            });
          } else {
            console.log(`✅ TIMING OK: Session timestamps are consistent`);
            window.timestampTest.results.push({
              type: 'timing_ok',
              session: session,
              timeDiff: timeDiff,
              timestamp: Date.now()
            });
          }
          
          window.timestampTest.sessionHistory.push(session);
        });
        
        // Update initial count for next iteration
        initialCount = sessions.length;
      }
    } catch (error) {
      console.error('❌ Error monitoring sessions:', error);
    }
  }, 500);
  
  console.log('👀 Monitoring started. Switch between LinkedIn and YouTube tabs to test...');
  console.log('🛑 Call stopTimestampMonitoring() to stop monitoring and see results');
}

/**
 * Stop monitoring and display results
 */
function stopTimestampMonitoring() {
  console.log('\n=== STOPPING TIMESTAMP MONITORING ===');
  window.timestampTest.monitoring = false;
  
  const { results, sessionHistory } = window.timestampTest;
  
  console.log(`\n📈 MONITORING RESULTS:`);
  console.log(`   Total sessions created: ${sessionHistory.length}`);
  console.log(`   Timing anomalies: ${results.filter(r => r.type === 'timing_anomaly').length}`);
  console.log(`   Timing OK: ${results.filter(r => r.type === 'timing_ok').length}`);
  
  if (results.filter(r => r.type === 'timing_anomaly').length === 0) {
    console.log('✅ SUCCESS: No timing anomalies detected - fix is working!');
  } else {
    console.log('❌ FAILURE: Timing anomalies detected - fix may need refinement');
    console.log('\n🔍 Anomaly details:');
    results.filter(r => r.type === 'timing_anomaly').forEach((result, index) => {
      console.log(`   ${index + 1}. ${result.session.domain}: ${result.timeDiff}ms difference`);
    });
  }
  
  console.log('\n📋 All sessions created during test:');
  sessionHistory.forEach((session, index) => {
    const startTime = new Date(session.startTime);
    console.log(`   ${index + 1}. ${session.domain}: ${startTime.toLocaleTimeString()} (${session.duration}ms)`);
  });
}

/**
 * Check for finalization rejection logs (should see these for invalid operations)
 */
function checkFinalizationLogs() {
  console.log('\n🔍 CHECKING FOR FINALIZATION LOGS...');
  console.log('Look for these log patterns:');
  console.log('✅ "🎯 Finalizing session: [domain]" - Proper finalization');
  console.log('❌ "❌ Finalization rejected - no valid startTime" - Invalid finalization (expected)');
  console.log('⚠️ "⚠️ Cannot finalize - invalid snapshot provided" - Snapshot issues');
  
  // Note: Console log history is not accessible via JS, so we just guide the user
  console.log('\nScroll up in the console to look for these patterns...');
}

// Export functions to global scope for easy access
window.startTimestampMonitoring = startTimestampMonitoring;
window.stopTimestampMonitoring = stopTimestampMonitoring;
window.checkFinalizationLogs = checkFinalizationLogs;

console.log('\n🚀 TEST SCRIPT LOADED');
console.log('📋 Available commands:');
console.log('   startTimestampMonitoring() - Begin monitoring session creation');
console.log('   stopTimestampMonitoring() - Stop monitoring and show results');
console.log('   checkFinalizationLogs() - Guide for checking console logs');
console.log('\n💡 Instructions:');
console.log('1. Run startTimestampMonitoring()');
console.log('2. Open LinkedIn tab, browse for 30+ seconds');
console.log('3. Switch to YouTube tab quickly');
console.log('4. Wait 5 seconds');
console.log('5. Run stopTimestampMonitoring()');
console.log('6. Check results - should show NO timing anomalies');