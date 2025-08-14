/**
 * Enhanced Test Script for Session Status Management Fix
 * 
 * This script monitors session status transitions to verify that:
 * 1. Sessions are properly marked as 'completed' when leaving tabs
 * 2. No sessions remain in perpetual 'active' status
 * 3. On-screen time increments correctly while on tabs (not just when switching)
 * 
 * Usage: Paste in Chrome Extension Console (right-click extension → Inspect popup → Console)
 */

console.log('🔍 Testing session status management fix...');

// Enhanced test state
window.sessionStatusTest = {
  startTime: Date.now(),
  monitoring: false,
  sessionHistory: [],
  statusTransitions: [],
  activeSessionCounts: [],
  lastSessionCount: 0
};

/**
 * Monitor session status changes in real-time
 */
async function startSessionStatusMonitoring() {
  console.log('\n=== STARTING SESSION STATUS MONITORING ===');
  
  window.sessionStatusTest.monitoring = true;
  window.sessionStatusTest.sessionHistory = [];
  window.sessionStatusTest.statusTransitions = [];
  window.sessionStatusTest.activeSessionCounts = [];
  
  // Get initial state
  const initialStorage = await chrome.storage.local.get(['site_usage_sessions']);
  const today = new Date().toISOString().split('T')[0];
  const initialSessions = initialStorage.site_usage_sessions?.[today] || [];
  
  const activeSessions = initialSessions.filter(s => s.status === 'active');
  const completedSessions = initialSessions.filter(s => s.status === 'completed');
  
  console.log(`📊 Initial State:`);
  console.log(`   Total sessions: ${initialSessions.length}`);
  console.log(`   Active sessions: ${activeSessions.length}`);
  console.log(`   Completed sessions: ${completedSessions.length}`);
  
  if (activeSessions.length > 0) {
    console.log(`📋 Current active sessions:`);
    activeSessions.forEach(session => {
      console.log(`   - ${session.domain}: ${session.duration}s (${session.status})`);
    });
  }
  
  window.sessionStatusTest.lastSessionCount = initialSessions.length;
  
  // Monitor every 1 second for more granular tracking
  const monitoringInterval = setInterval(async () => {
    if (!window.sessionStatusTest.monitoring) {
      clearInterval(monitoringInterval);
      return;
    }
    
    try {
      const storage = await chrome.storage.local.get(['site_usage_sessions']);
      const sessions = storage.site_usage_sessions?.[today] || [];
      
      // Track session count changes
      if (sessions.length !== window.sessionStatusTest.lastSessionCount) {
        console.log(`📈 Session count changed: ${window.sessionStatusTest.lastSessionCount} → ${sessions.length}`);
        window.sessionStatusTest.lastSessionCount = sessions.length;
      }
      
      // Track active session counts
      const currentActiveSessions = sessions.filter(s => s.status === 'active');
      const currentActiveCount = currentActiveSessions.length;
      
      window.sessionStatusTest.activeSessionCounts.push({
        timestamp: Date.now(),
        activeCount: currentActiveCount,
        totalCount: sessions.length
      });
      
      // Detect status transitions
      sessions.forEach(session => {
        const existingSession = window.sessionStatusTest.sessionHistory.find(s => s.id === session.id);
        
        if (!existingSession) {
          // New session created
          console.log(`\n🆕 NEW SESSION CREATED:`);
          console.log(`   ID: ${session.id}`);
          console.log(`   Domain: ${session.domain}`);
          console.log(`   Status: ${session.status}`);
          console.log(`   Start Time: ${new Date(session.startTime).toLocaleTimeString()}`);
          
          window.sessionStatusTest.statusTransitions.push({
            sessionId: session.id,
            domain: session.domain,
            transition: 'created',
            status: session.status,
            timestamp: Date.now()
          });
          
          window.sessionStatusTest.sessionHistory.push({...session});
        } else if (existingSession.status !== session.status) {
          // Status transition detected
          console.log(`\n🔄 STATUS TRANSITION:`);
          console.log(`   Session: ${session.domain} (${session.id})`);
          console.log(`   ${existingSession.status} → ${session.status}`);
          console.log(`   Duration: ${session.duration}s`);
          
          if (session.status === 'completed') {
            console.log(`   ✅ Session properly completed!`);
          } else if (session.status === 'active' && existingSession.status === 'completed') {
            console.error(`   ❌ REACTIVATION BUG: Completed session reactivated!`);
          }
          
          window.sessionStatusTest.statusTransitions.push({
            sessionId: session.id,
            domain: session.domain,
            transition: `${existingSession.status} → ${session.status}`,
            previousStatus: existingSession.status,
            newStatus: session.status,
            timestamp: Date.now()
          });
          
          // Update stored session
          const index = window.sessionStatusTest.sessionHistory.findIndex(s => s.id === session.id);
          window.sessionStatusTest.sessionHistory[index] = {...session};
        } else if (existingSession.duration !== session.duration) {
          // Duration update (on-screen time incrementing)
          const durationIncrease = session.duration - existingSession.duration;
          if (durationIncrease > 0) {
            console.log(`📊 Duration update: ${session.domain} +${durationIncrease}s (total: ${session.duration}s)`);
          }
          
          // Update stored session
          const index = window.sessionStatusTest.sessionHistory.findIndex(s => s.id === session.id);
          window.sessionStatusTest.sessionHistory[index] = {...session};
        }
      });
      
      // Alert if too many active sessions
      if (currentActiveCount > 2) {
        console.warn(`⚠️ HIGH ACTIVE SESSION COUNT: ${currentActiveCount} active sessions detected`);
        currentActiveSessions.forEach(session => {
          console.log(`   - ${session.domain}: ${session.duration}s`);
        });
      }
      
    } catch (error) {
      console.error('❌ Error monitoring session status:', error);
    }
  }, 1000); // Check every second
  
  console.log('👀 Status monitoring started. Switch between tabs to test session lifecycle...');
  console.log('🛑 Call stopSessionStatusMonitoring() to stop and see analysis');
}

/**
 * Stop monitoring and provide detailed analysis
 */
function stopSessionStatusMonitoring() {
  console.log('\n=== STOPPING SESSION STATUS MONITORING ===');
  window.sessionStatusTest.monitoring = false;
  
  const { statusTransitions, activeSessionCounts } = window.sessionStatusTest;
  
  // Analysis
  console.log(`\n📈 MONITORING ANALYSIS:`);
  console.log(`   Total status transitions: ${statusTransitions.length}`);
  
  const reactivations = statusTransitions.filter(t => 
    t.previousStatus === 'completed' && t.newStatus === 'active'
  );
  const completions = statusTransitions.filter(t => t.newStatus === 'completed');
  const creations = statusTransitions.filter(t => t.transition === 'created');
  
  console.log(`   Sessions created: ${creations.length}`);
  console.log(`   Sessions completed: ${completions.length}`);
  console.log(`   Problematic reactivations: ${reactivations.length}`);
  
  if (reactivations.length === 0) {
    console.log('✅ SUCCESS: No session reactivation bugs detected!');
  } else {
    console.log('❌ ISSUE: Session reactivation detected:');
    reactivations.forEach(r => {
      console.log(`   - ${r.domain} (${r.sessionId}) reactivated at ${new Date(r.timestamp).toLocaleTimeString()}`);
    });
  }
  
  // Active session count analysis
  const maxActiveSessions = Math.max(...activeSessionCounts.map(c => c.activeCount));
  const avgActiveSessions = activeSessionCounts.reduce((sum, c) => sum + c.activeCount, 0) / activeSessionCounts.length;
  
  console.log(`\n📊 ACTIVE SESSION METRICS:`);
  console.log(`   Max concurrent active sessions: ${maxActiveSessions}`);
  console.log(`   Average active sessions: ${avgActiveSessions.toFixed(1)}`);
  
  if (maxActiveSessions <= 1) {
    console.log('✅ GOOD: Active session count stayed reasonable');
  } else if (maxActiveSessions <= 2) {
    console.log('⚠️ MODERATE: Some periods with multiple active sessions');
  } else {
    console.log('❌ ISSUE: Too many concurrent active sessions detected');
  }
  
  console.log(`\n📋 TRANSITION HISTORY:`);
  statusTransitions.forEach((t, index) => {
    const time = new Date(t.timestamp).toLocaleTimeString();
    console.log(`   ${index + 1}. [${time}] ${t.domain}: ${t.transition}`);
  });
}

/**
 * Quick status check of current sessions
 */
async function checkCurrentSessionStatus() {
  console.log('\n🔍 CURRENT SESSION STATUS CHECK:');
  
  const storage = await chrome.storage.local.get(['site_usage_sessions']);
  const today = new Date().toISOString().split('T')[0];
  const sessions = storage.site_usage_sessions?.[today] || [];
  
  const activeSessions = sessions.filter(s => s.status === 'active');
  const completedSessions = sessions.filter(s => s.status === 'completed');
  
  console.log(`📊 Current Status:`);
  console.log(`   Total sessions: ${sessions.length}`);
  console.log(`   Active: ${activeSessions.length}`);
  console.log(`   Completed: ${completedSessions.length}`);
  
  if (activeSessions.length > 0) {
    console.log(`\n📋 Active Sessions:`);
    activeSessions.forEach((session, index) => {
      const duration = Math.round(session.duration);
      const startTime = new Date(session.startTime).toLocaleTimeString();
      console.log(`   ${index + 1}. ${session.domain}: ${duration}s (started ${startTime})`);
    });
  }
  
  if (activeSessions.length > 1) {
    console.warn('⚠️ Multiple active sessions detected - this may indicate an issue');
  } else if (activeSessions.length === 0) {
    console.log('✅ No active sessions - all properly completed');
  } else {
    console.log('✅ Single active session - normal behavior');
  }
}

// Export functions to global scope
window.startSessionStatusMonitoring = startSessionStatusMonitoring;
window.stopSessionStatusMonitoring = stopSessionStatusMonitoring;
window.checkCurrentSessionStatus = checkCurrentSessionStatus;

console.log('\n🚀 SESSION STATUS TEST SCRIPT LOADED');
console.log('📋 Available commands:');
console.log('   startSessionStatusMonitoring() - Begin detailed monitoring');
console.log('   stopSessionStatusMonitoring() - Stop and analyze results');
console.log('   checkCurrentSessionStatus() - Quick status check');
console.log('\n💡 Test Instructions:');
console.log('1. Run checkCurrentSessionStatus() to see starting state');
console.log('2. Run startSessionStatusMonitoring()');
console.log('3. Use tabs normally (LinkedIn, YouTube, etc.)');
console.log('4. Watch for status transitions in real-time');
console.log('5. Run stopSessionStatusMonitoring() for analysis');
console.log('6. Look for: ✅ No reactivations, ✅ Proper completions');