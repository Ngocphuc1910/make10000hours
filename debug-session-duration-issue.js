/**
 * Debug Script for Session Duration Tracking Issue
 * 
 * This script investigates why site usage shows 27h instead of ~2h of actual usage.
 * 
 * Copy and paste this into Chrome Extension Console:
 * Right-click extension icon -> Inspect popup -> Console tab -> paste this script
 */

console.log('🔍 Investigating session duration tracking issue...');

window.sessionDurationDebug = {
  findings: [],
  rawData: {},
  suspectedIssues: []
};

/**
 * Analyze session data structure and duration calculations
 */
async function analyzeSessionDurations() {
  console.log('\n=== SESSION DURATION ANALYSIS ===');
  
  try {
    const storage = await chrome.storage.local.get(['site_usage_sessions']);
    const sessions = storage.site_usage_sessions || {};
    
    const today = new Date().toISOString().split('T')[0];
    const todaySessions = sessions[today] || [];
    
    console.log(`📊 Analyzing ${todaySessions.length} sessions for today (${today})`);
    
    if (todaySessions.length === 0) {
      console.warn('⚠️ No sessions found for today');
      return;
    }
    
    let totalCalculatedTime = 0;
    let issuesFound = 0;
    const domainStats = {};
    
    // Analyze each session
    todaySessions.forEach((session, index) => {
      console.log(`\n🔍 Session ${index} Analysis:`, {
        id: session.id,
        domain: session.domain,
        duration: session.duration,
        durationFormatted: formatTime(session.duration * 1000),
        status: session.status,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt
      });
      
      // Check for issues
      const issues = [];
      
      // Duration validation
      if (typeof session.duration !== 'number') {
        issues.push('INVALID_DURATION_TYPE');
      } else if (session.duration < 0) {
        issues.push('NEGATIVE_DURATION');
      } else if (session.duration > 14400) { // More than 4 hours
        issues.push('EXCESSIVE_DURATION');
        console.warn(`⚠️ Session has excessive duration: ${session.duration}s (${formatTime(session.duration * 1000)})`);
      }
      
      // Status validation
      if (session.status !== 'active' && session.status !== 'completed') {
        issues.push('INVALID_STATUS');
      }
      
      // Time range validation
      if (session.startTime && session.updatedAt) {
        const startTime = new Date(session.startTime).getTime();
        const updatedTime = new Date(session.updatedAt).getTime();
        const sessionLifetime = (updatedTime - startTime) / 1000; // in seconds
        
        if (session.duration > sessionLifetime * 1.5) { // Duration significantly longer than lifetime
          issues.push('DURATION_EXCEEDS_LIFETIME');
          console.warn(`⚠️ Duration (${session.duration}s) exceeds session lifetime (${Math.round(sessionLifetime)}s)`);
        }
      }
      
      if (issues.length > 0) {
        issuesFound++;
        window.sessionDurationDebug.suspectedIssues.push({
          sessionIndex: index,
          sessionId: session.id,
          domain: session.domain,
          issues: issues
        });
      }
      
      // Add to domain stats
      if (!domainStats[session.domain]) {
        domainStats[session.domain] = {
          sessionCount: 0,
          totalDuration: 0,
          sessions: []
        };
      }
      
      domainStats[session.domain].sessionCount++;
      domainStats[session.domain].totalDuration += session.duration;
      domainStats[session.domain].sessions.push({
        id: session.id,
        duration: session.duration,
        status: session.status
      });
      
      totalCalculatedTime += session.duration;
    });
    
    console.log('\n📊 SUMMARY ANALYSIS:');
    console.log(`Total calculated time: ${totalCalculatedTime}s (${formatTime(totalCalculatedTime * 1000)})`);
    console.log(`Sessions with issues: ${issuesFound}/${todaySessions.length}`);
    
    console.log('\n📊 BY DOMAIN:');
    Object.entries(domainStats).forEach(([domain, stats]) => {
      console.log(`  ${domain}:`);
      console.log(`    Sessions: ${stats.sessionCount}`);
      console.log(`    Total Duration: ${formatTime(stats.totalDuration * 1000)}`);
      console.log(`    Average per session: ${formatTime((stats.totalDuration / stats.sessionCount) * 1000)}`);
      
      // Check for potential session multiplication issues
      if (stats.sessionCount > 10) {
        console.warn(`    ⚠️ High session count - possible duplicate sessions`);
        window.sessionDurationDebug.suspectedIssues.push({
          domain: domain,
          issue: 'HIGH_SESSION_COUNT',
          count: stats.sessionCount
        });
      }
      
      // Check for active sessions that should be completed
      const activeSessions = stats.sessions.filter(s => s.status === 'active');
      if (activeSessions.length > 1) {
        console.warn(`    ⚠️ Multiple active sessions (${activeSessions.length}) - should only be 1`);
        window.sessionDurationDebug.suspectedIssues.push({
          domain: domain,
          issue: 'MULTIPLE_ACTIVE_SESSIONS',
          activeCount: activeSessions.length
        });
      }
    });
    
    window.sessionDurationDebug.rawData = { sessions, todaySessions, domainStats };
    window.sessionDurationDebug.findings.push({
      totalTime: totalCalculatedTime,
      totalTimeFormatted: formatTime(totalCalculatedTime * 1000),
      issuesFound: issuesFound,
      domainCount: Object.keys(domainStats).length
    });
    
    return { totalCalculatedTime, domainStats, issuesFound };
    
  } catch (error) {
    console.error('❌ Error analyzing sessions:', error);
    return null;
  }
}

/**
 * Check for timing/interval issues
 */
async function checkTrackingIntervals() {
  console.log('\n=== TRACKING INTERVAL ANALYSIS ===');
  
  try {
    // Test current tracking state
    console.log('📊 Testing GET_COMPLETE_STATS to see current totals...');
    
    const result = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'GET_COMPLETE_STATS' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
    
    if (result?.success && result?.data) {
      const data = result.data;
      console.log('📊 Current API totals:');
      console.log(`  Total Time: ${data.totalTime}ms (${formatTime(data.totalTime)})`);
      console.log(`  Sites Count: ${Object.keys(data.sites || {}).length}`);
      console.log(`  Individual site times:`, Object.entries(data.sites || {}).map(([domain, site]) => ({
        domain,
        time: formatTime(site.timeSpent)
      })));
      
      // Compare with raw session data
      const sessionAnalysis = await analyzeSessionDurations();
      if (sessionAnalysis) {
        const apiTotalSeconds = Math.round(data.totalTime / 1000);
        const sessionTotalSeconds = sessionAnalysis.totalCalculatedTime;
        
        console.log('\n🔍 API vs Session Data Comparison:');
        console.log(`  API Total: ${apiTotalSeconds}s (${formatTime(data.totalTime)})`);
        console.log(`  Session Total: ${sessionTotalSeconds}s (${formatTime(sessionTotalSeconds * 1000)})`);
        console.log(`  Difference: ${Math.abs(apiTotalSeconds - sessionTotalSeconds)}s`);
        
        if (Math.abs(apiTotalSeconds - sessionTotalSeconds) > 60) {
          console.warn('⚠️ Significant difference between API and session calculations!');
          window.sessionDurationDebug.suspectedIssues.push({
            issue: 'API_SESSION_MISMATCH',
            apiTotal: apiTotalSeconds,
            sessionTotal: sessionTotalSeconds,
            difference: Math.abs(apiTotalSeconds - sessionTotalSeconds)
          });
        }
      }
      
    } else {
      console.error('❌ Failed to get current stats:', result);
    }
    
  } catch (error) {
    console.error('❌ Error checking tracking intervals:', error);
  }
}

/**
 * Identify potential causes of duration inflation
 */
async function identifyDurationInflationCauses() {
  console.log('\n=== DURATION INFLATION ANALYSIS ===');
  
  const analysis = window.sessionDurationDebug;
  
  console.log('🔍 Checking for common causes of duration inflation...');
  
  // Check 1: Multiple active sessions per domain
  if (analysis.suspectedIssues.some(issue => issue.issue === 'MULTIPLE_ACTIVE_SESSIONS')) {
    console.warn('⚠️ CAUSE 1: Multiple active sessions per domain found');
    console.log('   This could cause parallel time accumulation');
  }
  
  // Check 2: High session counts
  const highCountDomains = analysis.suspectedIssues.filter(issue => issue.issue === 'HIGH_SESSION_COUNT');
  if (highCountDomains.length > 0) {
    console.warn('⚠️ CAUSE 2: High session counts found');
    highCountDomains.forEach(domain => {
      console.log(`   ${domain.domain}: ${domain.count} sessions`);
    });
    console.log('   This suggests sessions are being created repeatedly instead of updated');
  }
  
  // Check 3: Excessive individual session durations
  if (analysis.suspectedIssues.some(issue => issue.issues?.includes('EXCESSIVE_DURATION'))) {
    console.warn('⚠️ CAUSE 3: Individual sessions with excessive durations found');
    console.log('   This suggests duration calculation errors or missed sleep detection');
  }
  
  // Check 4: Duration exceeds session lifetime
  if (analysis.suspectedIssues.some(issue => issue.issues?.includes('DURATION_EXCEEDS_LIFETIME'))) {
    console.warn('⚠️ CAUSE 4: Session durations exceed their actual lifetime');
    console.log('   This indicates timing calculation bugs');
  }
  
  console.log('\n💡 RECOMMENDED FIXES:');
  console.log('1. Ensure only one active session per domain at a time');
  console.log('2. Fix session creation to update existing sessions instead of creating new ones');
  console.log('3. Add better sleep detection and duration caps');
  console.log('4. Fix incremental time calculation logic');
}

/**
 * Helper to format time consistently
 */
function formatTime(milliseconds) {
  if (!milliseconds || milliseconds === 0) return '0m';
  
  const totalMinutes = Math.floor(milliseconds / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

/**
 * Generate comprehensive report
 */
function generateDurationReport() {
  console.log('\n=== COMPREHENSIVE DURATION REPORT ===');
  
  const report = {
    timestamp: new Date().toISOString(),
    findings: window.sessionDurationDebug.findings,
    suspectedIssues: window.sessionDurationDebug.suspectedIssues,
    recommendations: []
  };
  
  // Generate recommendations based on issues found
  const issues = report.suspectedIssues;
  
  if (issues.some(i => i.issue === 'MULTIPLE_ACTIVE_SESSIONS')) {
    report.recommendations.push('Fix multiple active sessions: Ensure only one active session per domain');
  }
  
  if (issues.some(i => i.issue === 'HIGH_SESSION_COUNT')) {
    report.recommendations.push('Fix session creation: Update existing sessions instead of creating duplicates');
  }
  
  if (issues.some(i => i.issues?.includes('EXCESSIVE_DURATION'))) {
    report.recommendations.push('Add duration caps: Limit individual session durations to reasonable maximums');
  }
  
  if (issues.some(i => i.issue === 'API_SESSION_MISMATCH')) {
    report.recommendations.push('Fix calculation discrepancy: Align API calculation with session data');
  }
  
  console.log('📋 REPORT SUMMARY:');
  console.log(`  Issues Found: ${report.suspectedIssues.length}`);
  console.log(`  Recommendations: ${report.recommendations.length}`);
  
  if (report.recommendations.length > 0) {
    console.log('\n💡 PRIORITY FIXES:');
    report.recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });
  }
  
  // Store report globally
  window.sessionDurationDebug.finalReport = report;
  
  return report;
}

/**
 * Main investigation function
 */
async function investigateSessionDurationIssue() {
  console.log('🕵️ Starting comprehensive session duration investigation...');
  
  try {
    await analyzeSessionDurations();
    await checkTrackingIntervals();
    await identifyDurationInflationCauses();
    
    const report = generateDurationReport();
    
    console.log('\n✅ Investigation complete!');
    console.log('📊 Full results available at: window.sessionDurationDebug');
    console.log('📋 Final report at: window.sessionDurationDebug.finalReport');
    
    return report;
    
  } catch (error) {
    console.error('❌ Investigation failed:', error);
    return null;
  }
}

// Auto-run the investigation
investigateSessionDurationIssue();

// Make functions available globally
window.investigateSessionDurationIssue = investigateSessionDurationIssue;
window.analyzeSessionDurations = analyzeSessionDurations;
window.formatTime = formatTime;

console.log('\n📚 Available commands:');
console.log('- investigateSessionDurationIssue() // Re-run full investigation');
console.log('- analyzeSessionDurations() // Analyze raw session data');
console.log('- formatTime(ms) // Format time consistently');
console.log('- window.sessionDurationDebug // Access all investigation data');