/**
 * UTC Data Readiness Analysis Script
 * Run this in browser console on Deep Focus page to check data readiness
 */

async function analyzeUTCReadiness() {
  console.log('📊 Starting UTC Data Readiness Analysis...');
  
  try {
    // Check if we're on the right page
    if (typeof useUserStore === 'undefined' || typeof deepFocusSessionService === 'undefined') {
      console.error('❌ Please run this on the Deep Focus page where stores are available');
      return;
    }
    
    const user = useUserStore.getState().user;
    if (!user?.uid) {
      console.error('❌ User not authenticated');
      return;
    }
    
    console.log('🔍 Analyzing sessions for user:', user.uid);
    
    // Get recent sessions to analyze
    const recentSessions = await deepFocusSessionService.getUserSessions(user.uid, {
      // Get all sessions without date filter to see full picture
      useUTC: false // Use legacy method to get all sessions
    });
    
    console.log(`📋 Found ${recentSessions.length} total sessions`);
    
    if (recentSessions.length === 0) {
      console.warn('⚠️ No sessions found. Create some deep focus sessions first.');
      return { needsSessions: true };
    }
    
    // Analyze UTC field availability
    let sessionsWithStartTimeUTC = 0;
    let sessionsWithUtcDate = 0;
    let sessionsWithBothUTCFields = 0;
    
    const sampleSessions = recentSessions.slice(0, 5);
    
    console.log('📋 Analyzing session structure...');
    console.table(sampleSessions.map(s => ({
      'Session ID': s.id?.substring(0, 8) + '...',
      'Has startTimeUTC': !!s.startTimeUTC,
      'Has utcDate': !!s.utcDate,
      'Has timezone': !!s.timezone,
      'StartTime': s.startTime ? new Date(s.startTime).toISOString().substring(0, 16) : 'Missing',
      'StartTimeUTC': s.startTimeUTC || 'Missing',
      'utcDate': s.utcDate || 'Missing'
    })));
    
    recentSessions.forEach(session => {
      if (session.startTimeUTC) sessionsWithStartTimeUTC++;
      if (session.utcDate) sessionsWithUtcDate++;
      if (session.startTimeUTC && session.utcDate) sessionsWithBothUTCFields++;
    });
    
    const startTimeUTCPercentage = (sessionsWithStartTimeUTC / recentSessions.length) * 100;
    const utcDatePercentage = (sessionsWithUtcDate / recentSessions.length) * 100;
    const bothFieldsPercentage = (sessionsWithBothUTCFields / recentSessions.length) * 100;
    
    console.log('\n📊 UTC Readiness Analysis Results:');
    console.table({
      'Total Sessions': recentSessions.length,
      'Sessions with startTimeUTC': `${sessionsWithStartTimeUTC} (${startTimeUTCPercentage.toFixed(1)}%)`,
      'Sessions with utcDate': `${sessionsWithUtcDate} (${utcDatePercentage.toFixed(1)}%)`,
      'Sessions with both UTC fields': `${sessionsWithBothUTCFields} (${bothFieldsPercentage.toFixed(1)}%)`,
    });
    
    // Recommendation
    let recommendation;
    if (bothFieldsPercentage >= 90) {
      recommendation = '✅ READY - Can proceed with UTC filtering implementation';
    } else if (bothFieldsPercentage >= 50) {
      recommendation = '🟡 PARTIAL - Should run data migration first';
    } else {
      recommendation = '🔴 NOT READY - Must run data migration before UTC filtering';
    }
    
    console.log(`\n🎯 Recommendation: ${recommendation}`);
    
    // Check recent sessions to see if extension is populating UTC fields
    const recentSessionsLast7Days = recentSessions
      .filter(s => {
        const sessionDate = new Date(s.createdAt || s.startTime);
        const daysDiff = (Date.now() - sessionDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff <= 7;
      });
    
    const recentUTCPercentage = recentSessionsLast7Days.length > 0 
      ? (recentSessionsLast7Days.filter(s => s.startTimeUTC && s.utcDate).length / recentSessionsLast7Days.length) * 100
      : 0;
    
    console.log(`\n📈 Recent Sessions (Last 7 days): ${recentSessionsLast7Days.length} sessions`);
    console.log(`🔧 Recent UTC Field Population: ${recentUTCPercentage.toFixed(1)}%`);
    
    if (recentSessionsLast7Days.length > 0 && recentUTCPercentage < 90) {
      console.warn('⚠️ Extension may not be consistently populating UTC fields');
      console.log('🔧 Need to check extension session creation logic');
    }
    
    return {
      totalSessions: recentSessions.length,
      sessionsWithUTC: sessionsWithBothUTCFields,
      percentage: bothFieldsPercentage,
      recentPercentage: recentUTCPercentage,
      recommendation: recommendation,
      needsMigration: bothFieldsPercentage < 90
    };
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    return { error: error.message };
  }
}

// Export for easy access
window.analyzeUTCReadiness = analyzeUTCReadiness;

console.log(`
📊 UTC Readiness Analysis Tool Loaded

Usage: analyzeUTCReadiness()

Run this command to check if your data is ready for UTC filtering.
`);

// Auto-run analysis
analyzeUTCReadiness().then(result => {
  if (result && !result.error) {
    console.log('\n🎯 Next Steps Based on Analysis:');
    if (result.needsMigration) {
      console.log('1. 🔧 Run data migration script for existing sessions');
      console.log('2. 🔍 Verify extension UTC field population');
      console.log('3. ✅ Re-run analysis to confirm readiness');
    } else {
      console.log('1. ✅ Data is ready for UTC filtering implementation');
      console.log('2. 🚀 Proceed to Phase 1 - Core Implementation');
    }
  }
}).catch(error => {
  console.error('💥 Auto-analysis failed:', error);
});