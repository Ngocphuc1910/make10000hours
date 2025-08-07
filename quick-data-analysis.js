/**
 * Quick Data Analysis - Run directly in browser console
 * This version works without needing app stores
 */

async function quickDataAnalysis() {
  console.log('🔍 Quick UTC Data Analysis...');
  
  try {
    // Try to get Firebase directly from window
    let db;
    if (window.firebase && window.firebase.firestore) {
      db = window.firebase.firestore();
    } else if (window.getFirestore) {
      db = window.getFirestore();
    } else {
      throw new Error('Firebase not available');
    }

    // Get current user ID from auth
    let userId;
    if (window.firebase && window.firebase.auth && window.firebase.auth().currentUser) {
      userId = window.firebase.auth().currentUser.uid;
    } else if (window.getAuth) {
      const auth = window.getAuth();
      userId = auth.currentUser?.uid;
    } else {
      // Fallback - check localStorage or prompt
      const stored = localStorage.getItem('firebase:authUser:' + Object.keys(localStorage).find(k => k.startsWith('firebase:authUser:')));
      if (stored) {
        userId = JSON.parse(stored).uid;
      } else {
        userId = prompt('Enter your user ID to analyze data:');
      }
    }

    if (!userId) {
      console.error('❌ Could not get user ID');
      return;
    }

    console.log(`👤 Analyzing data for user: ${userId}`);

    // Query recent sessions
    const sessionsRef = db.collection('deepFocusSessions');
    const query = sessionsRef
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(50);

    const snapshot = await query.get();
    const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    console.log(`📋 Found ${sessions.length} total sessions`);

    if (sessions.length === 0) {
      console.warn('⚠️ No sessions found. Create some deep focus sessions first.');
      return { needsSessions: true };
    }

    // Analyze UTC field availability
    let sessionsWithStartTimeUTC = 0;
    let sessionsWithUtcDate = 0;
    let sessionsWithBothUTCFields = 0;
    let sessionsWithTimezone = 0;

    const sampleSessions = sessions.slice(0, 5);

    console.log('\n📋 Sample Session Analysis:');
    console.table(sampleSessions.map(s => ({
      'Session ID': s.id?.substring(0, 8) + '...',
      'Has startTimeUTC': !!s.startTimeUTC,
      'Has utcDate': !!s.utcDate,
      'Has timezone': !!s.timezone,
      'StartTime': s.startTime ? new Date(s.startTime).toISOString().substring(0, 16) : 'Missing',
      'StartTimeUTC': s.startTimeUTC || 'Missing',
      'utcDate': s.utcDate || 'Missing',
      'timezone': s.timezone || 'Missing'
    })));

    // Count sessions with UTC fields
    sessions.forEach(session => {
      if (session.startTimeUTC) sessionsWithStartTimeUTC++;
      if (session.utcDate) sessionsWithUtcDate++;
      if (session.timezone) sessionsWithTimezone++;
      if (session.startTimeUTC && session.utcDate) sessionsWithBothUTCFields++;
    });

    const startTimeUTCPercentage = (sessionsWithStartTimeUTC / sessions.length) * 100;
    const utcDatePercentage = (sessionsWithUtcDate / sessions.length) * 100;
    const timezonePercentage = (sessionsWithTimezone / sessions.length) * 100;
    const bothFieldsPercentage = (sessionsWithBothUTCFields / sessions.length) * 100;

    console.log('\n📊 UTC Readiness Analysis Results:');
    console.table({
      'Total Sessions': sessions.length,
      'Sessions with startTimeUTC': `${sessionsWithStartTimeUTC} (${startTimeUTCPercentage.toFixed(1)}%)`,
      'Sessions with utcDate': `${sessionsWithUtcDate} (${utcDatePercentage.toFixed(1)}%)`,
      'Sessions with timezone': `${sessionsWithTimezone} (${timezonePercentage.toFixed(1)}%)`,
      'Sessions with both UTC fields': `${sessionsWithBothUTCFields} (${bothFieldsPercentage.toFixed(1)}%)`,
    });

    // Recommendation
    let recommendation;
    let readyStatus;
    if (bothFieldsPercentage >= 90) {
      recommendation = '✅ READY - Can proceed with UTC filtering implementation';
      readyStatus = 'READY';
    } else if (bothFieldsPercentage >= 50) {
      recommendation = '🟡 PARTIAL - Should run data migration first';
      readyStatus = 'PARTIAL';
    } else {
      recommendation = '🔴 NOT READY - Must run data migration before UTC filtering';
      readyStatus = 'NOT_READY';
    }

    console.log(`\n🎯 Recommendation: ${recommendation}`);

    // Check recent sessions (last 7 days)
    const recentSessionsLast7Days = sessions.filter(s => {
      const sessionDate = new Date(s.createdAt?.toDate?.() || s.createdAt || s.startTime);
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

    // Next steps
    console.log('\n🎯 Next Steps Based on Analysis:');
    if (readyStatus === 'READY') {
      console.log('1. ✅ Data is ready for UTC filtering implementation');
      console.log('2. 🚀 Proceed to Phase 1 - Core Implementation');
      console.log('3. 📋 All indexes are created and enabled');
    } else if (readyStatus === 'PARTIAL') {
      console.log('1. 🔧 Run data migration script for existing sessions');
      console.log('2. 🔍 Verify extension UTC field population');  
      console.log('3. ✅ Re-run analysis to confirm readiness');
    } else {
      console.log('1. 🚨 CRITICAL: Must run data migration first');
      console.log('2. 🔧 Fix extension UTC field population');
      console.log('3. ✅ Re-run analysis after fixes');
    }

    return {
      totalSessions: sessions.length,
      sessionsWithUTC: sessionsWithBothUTCFields,
      percentage: bothFieldsPercentage,
      recentPercentage: recentUTCPercentage,
      recommendation: recommendation,
      readyStatus: readyStatus,
      needsMigration: bothFieldsPercentage < 90
    };

  } catch (error) {
    console.error('❌ Analysis failed:', error);
    console.log('\n🔧 Fallback: Manual Check Instructions');
    console.log('1. Go to Firebase Console → Firestore → Data');
    console.log('2. Browse to deepFocusSessions collection');
    console.log('3. Check recent documents for these fields:');
    console.log('   - startTimeUTC (should be ISO string)');
    console.log('   - utcDate (should be YYYY-MM-DD)');
    console.log('   - timezone (should be like "Asia/Saigon")');
    
    return { error: error.message };
  }
}

// Export for easy access
window.quickDataAnalysis = quickDataAnalysis;

console.log(`
📊 Quick Data Analysis Tool Loaded

Usage: quickDataAnalysis()

Run this command to check if your data is ready for UTC filtering.
`);

// Auto-run analysis
quickDataAnalysis().then(result => {
  if (result && !result.error) {
    console.log('\n🏁 Analysis Complete! Check results above.');
  }
}).catch(error => {
  console.error('💥 Auto-analysis failed:', error);
});