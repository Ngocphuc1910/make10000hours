/**
 * Debug Script for Periodic Save Issues
 * 
 * This script monitors whether periodic saves (every 3 seconds) are actually happening
 * while a user stays on a single tab, to identify why time might only increment on tab switch.
 * 
 * Usage: Paste in Chrome Extension Console while on a tab you want to monitor
 */

console.log('🔧 Debug: Monitoring periodic save behavior...');

// Debug state
window.periodicSaveDebug = {
  monitoring: false,
  lastDuration: 0,
  saveEvents: [],
  intervalChecks: 0,
  startTime: Date.now()
};

/**
 * Monitor if periodic saves are working while staying on one tab
 */
async function startPeriodicSaveDebugging() {
  console.log('\n=== DEBUGGING PERIODIC SAVES ===');
  console.log('📋 This will monitor if time increments while staying on the current tab');
  console.log('⚠️ Stay on this tab and do NOT switch tabs during the test');
  
  window.periodicSaveDebug.monitoring = true;
  window.periodicSaveDebug.saveEvents = [];
  window.periodicSaveDebug.intervalChecks = 0;
  window.periodicSaveDebug.startTime = Date.now();
  
  // Get initial session state
  const initialStorage = await chrome.storage.local.get(['site_usage_sessions']);
  const today = new Date().toISOString().split('T')[0];
  const initialSessions = initialStorage.site_usage_sessions?.[today] || [];
  
  // Find current domain
  const currentDomain = window.location.hostname.replace('www.', '');
  const currentSession = initialSessions.find(s => s.domain === currentDomain && s.status === 'active');
  
  if (!currentSession) {
    console.error('❌ No active session found for current domain:', currentDomain);
    console.log('💡 Try refreshing the page and run this script again');
    return;
  }
  
  window.periodicSaveDebug.lastDuration = currentSession.duration;
  
  console.log('📊 Initial State:');
  console.log(`   Domain: ${currentSession.domain}`);
  console.log(`   Session ID: ${currentSession.id}`);
  console.log(`   Current Duration: ${currentSession.duration}s`);
  console.log(`   Status: ${currentSession.status}`);
  console.log(`   Start Time: ${new Date(currentSession.startTime).toLocaleTimeString()}`);
  
  console.log('\n👀 Monitoring every 2 seconds for duration changes...');
  console.log('🎯 Expected: Duration should increase by ~3s every 3 seconds');
  
  // Check every 2 seconds (faster than the 3-second save interval)
  const debugInterval = setInterval(async () => {
    if (!window.periodicSaveDebug.monitoring) {
      clearInterval(debugInterval);
      return;
    }
    
    try {
      window.periodicSaveDebug.intervalChecks++;
      const currentTime = Date.now();
      const elapsedSeconds = Math.round((currentTime - window.periodicSaveDebug.startTime) / 1000);
      
      // Get current session state
      const storage = await chrome.storage.local.get(['site_usage_sessions']);
      const sessions = storage.site_usage_sessions?.[today] || [];
      const updatedSession = sessions.find(s => s.domain === currentDomain && s.id === currentSession.id);
      
      if (!updatedSession) {
        console.error(`❌ Session ${currentSession.id} not found - may have been deleted or completed`);
        window.periodicSaveDebug.monitoring = false;
        return;
      }
      
      // Check for duration changes
      if (updatedSession.duration !== window.periodicSaveDebug.lastDuration) {
        const durationIncrease = updatedSession.duration - window.periodicSaveDebug.lastDuration;
        const timestamp = new Date().toLocaleTimeString();
        
        console.log(`📈 [${timestamp}] Duration increased: +${durationIncrease}s (total: ${updatedSession.duration}s)`);
        
        window.periodicSaveDebug.saveEvents.push({
          timestamp: currentTime,
          elapsedSeconds: elapsedSeconds,
          oldDuration: window.periodicSaveDebug.lastDuration,
          newDuration: updatedSession.duration,
          increase: durationIncrease
        });
        
        window.periodicSaveDebug.lastDuration = updatedSession.duration;
      } else if (window.periodicSaveDebug.intervalChecks % 5 === 0) {
        // Every 10 seconds, show that we're still monitoring
        console.log(`⏰ [${elapsedSeconds}s] Still monitoring... (Duration: ${updatedSession.duration}s, Status: ${updatedSession.status})`);
      }
      
      // Check if session status changed
      if (updatedSession.status !== 'active') {
        console.warn(`⚠️ Session status changed to: ${updatedSession.status}`);
        if (updatedSession.status === 'completed') {
          console.log('✅ Session completed - this is expected when leaving the tab');
        }
      }
      
    } catch (error) {
      console.error('❌ Error during periodic save debug:', error);
    }
  }, 2000); // Check every 2 seconds
  
  console.log('🛑 Run stopPeriodicSaveDebugging() to stop monitoring');
}

/**
 * Stop monitoring and analyze the results
 */
function stopPeriodicSaveDebugging() {
  console.log('\n=== STOPPING PERIODIC SAVE DEBUG ===');
  window.periodicSaveDebug.monitoring = false;
  
  const { saveEvents, intervalChecks, startTime } = window.periodicSaveDebug;
  const totalElapsed = Math.round((Date.now() - startTime) / 1000);
  
  console.log(`\n📊 DEBUG RESULTS (${totalElapsed}s monitored):`);
  console.log(`   Total checks performed: ${intervalChecks}`);
  console.log(`   Duration increase events: ${saveEvents.length}`);
  
  if (saveEvents.length === 0) {
    console.error('❌ ISSUE FOUND: No duration increases detected during monitoring!');
    console.log('💡 This suggests periodic saves are NOT working while staying on the tab');
    console.log('🔍 Possible causes:');
    console.log('   - Tab switch cooldown blocking saves');
    console.log('   - Tab validation failing');
    console.log('   - Incremental duration validation rejecting saves');
    console.log('   - isSaving flag stuck');
  } else {
    const avgInterval = totalElapsed / saveEvents.length;
    const totalIncrease = saveEvents.reduce((sum, event) => sum + event.increase, 0);
    
    console.log(`   Total duration increase: ${totalIncrease}s`);
    console.log(`   Average save interval: ${avgInterval.toFixed(1)}s`);
    
    if (avgInterval >= 2 && avgInterval <= 4) {
      console.log('✅ GOOD: Periodic saves happening at expected ~3s intervals');
    } else if (avgInterval > 4) {
      console.warn('⚠️ SLOW: Periodic saves happening slower than expected');
    } else if (saveEvents.length === 1 && totalElapsed > 10) {
      console.error('❌ ISSUE: Only one save detected - periodic saves not working');
    }
    
    console.log('\n📋 Save Event Timeline:');
    saveEvents.forEach((event, index) => {
      const time = new Date(event.timestamp).toLocaleTimeString();
      console.log(`   ${index + 1}. [${time}] +${event.increase}s (at ${event.elapsedSeconds}s elapsed)`);
    });
  }
  
  if (saveEvents.length > 0) {
    const expectedSaves = Math.floor(totalElapsed / 3); // Expected saves every 3 seconds
    const actualSaves = saveEvents.length;
    
    console.log(`\n🎯 Expected vs Actual:`);
    console.log(`   Expected saves (~every 3s): ${expectedSaves}`);
    console.log(`   Actual saves detected: ${actualSaves}`);
    
    if (actualSaves >= expectedSaves * 0.8) {
      console.log('✅ Save frequency is acceptable');
    } else {
      console.warn(`⚠️ Missing saves detected (${Math.round((1 - actualSaves/expectedSaves) * 100)}% missing)`);
    }
  }
}

/**
 * Quick check of current session status
 */
async function checkCurrentSessionStatus() {
  const currentDomain = window.location.hostname.replace('www.', '');
  const storage = await chrome.storage.local.get(['site_usage_sessions']);
  const today = new Date().toISOString().split('T')[0];
  const sessions = storage.site_usage_sessions?.[today] || [];
  
  console.log(`\n🔍 Current Session Status for ${currentDomain}:`);
  
  const domainSessions = sessions.filter(s => s.domain === currentDomain);
  if (domainSessions.length === 0) {
    console.log('❌ No sessions found for current domain');
    return;
  }
  
  domainSessions.forEach((session, index) => {
    const startTime = new Date(session.startTime).toLocaleTimeString();
    const updatedTime = new Date(session.updatedAt).toLocaleTimeString();
    console.log(`   ${index + 1}. ID: ${session.id}`);
    console.log(`      Status: ${session.status}`);
    console.log(`      Duration: ${session.duration}s`);
    console.log(`      Started: ${startTime}`);
    console.log(`      Last Updated: ${updatedTime}`);
    console.log(`      Active: ${session.isActive}`);
  });
}

// Export functions
window.startPeriodicSaveDebugging = startPeriodicSaveDebugging;
window.stopPeriodicSaveDebugging = stopPeriodicSaveDebugging;
window.checkCurrentSessionStatus = checkCurrentSessionStatus;

console.log('\n🚀 PERIODIC SAVE DEBUG SCRIPT LOADED');
console.log('📋 Available commands:');
console.log('   checkCurrentSessionStatus() - Check current session');
console.log('   startPeriodicSaveDebugging() - Start monitoring periodic saves');
console.log('   stopPeriodicSaveDebugging() - Stop and analyze results');
console.log('\n💡 Instructions:');
console.log('1. Stay on the current tab (do NOT switch tabs)');
console.log('2. Run startPeriodicSaveDebugging()');
console.log('3. Wait 30+ seconds');
console.log('4. Run stopPeriodicSaveDebugging()');
console.log('5. Check if duration increased every ~3 seconds');