/**
 * Session Cleanup Utility for Extension
 * 
 * This script helps clean up corrupted sessions that might be causing
 * the "On Screen Time: 0m" bug in the popup.
 * 
 * Usage:
 * 1. Open Chrome Extension Console (right-click extension icon -> Inspect popup)
 * 2. Paste this script in the console
 * 3. Run: cleanupCorruptedSessions()
 * 
 * This will identify and fix corrupted session data.
 */

console.log('🧹 Session Cleanup Utility loaded');

/**
 * Analyze and clean corrupted sessions
 */
async function cleanupCorruptedSessions(dryRun = true) {
  console.log(`\n🧹 ${dryRun ? 'ANALYZING' : 'CLEANING'} corrupted sessions...`);
  
  try {
    // Get current storage
    const storage = await chrome.storage.local.get(['site_usage_sessions']);
    const sessions = storage.site_usage_sessions || {};
    
    let totalSessions = 0;
    let corruptedSessions = 0;
    let cleanedSessions = 0;
    const cleanupReport = [];
    
    // Analyze each date
    for (const [dateKey, dateSessions] of Object.entries(sessions)) {
      // Skip non-date keys
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        console.log(`📅 Skipping non-date key: ${dateKey}`);
        continue;
      }
      
      if (!Array.isArray(dateSessions)) {
        console.error(`❌ Date ${dateKey} has non-array data:`, typeof dateSessions);
        cleanupReport.push({
          date: dateKey,
          issue: 'NON_ARRAY_DATA',
          action: dryRun ? 'WOULD_RESET' : 'RESET_TO_EMPTY_ARRAY'
        });
        
        if (!dryRun) {
          sessions[dateKey] = [];
          cleanedSessions++;
        }
        continue;
      }
      
      console.log(`\n📅 Analyzing date ${dateKey}: ${dateSessions.length} sessions`);
      
      const validSessions = [];
      let dateCorrupted = 0;
      
      // Analyze each session
      dateSessions.forEach((session, index) => {
        totalSessions++;
        
        const issues = [];
        
        // Check session structure
        if (!session || typeof session !== 'object') {
          issues.push('INVALID_OBJECT');
        } else {
          // Check required fields
          if (!session.domain || typeof session.domain !== 'string') {
            issues.push('INVALID_DOMAIN');
          }
          
          if (typeof session.duration !== 'number' || isNaN(session.duration) || session.duration < 0) {
            issues.push(`INVALID_DURATION_${typeof session.duration}_${session.duration}`);
          }
          
          if (!session.id || typeof session.id !== 'string') {
            issues.push('INVALID_ID');
          }
          
          if (!session.status || typeof session.status !== 'string') {
            issues.push('INVALID_STATUS');
          }
        }
        
        if (issues.length > 0) {
          corruptedSessions++;
          dateCorrupted++;
          
          console.warn(`  ❌ Session ${index} corrupted:`, issues, session);
          
          cleanupReport.push({
            date: dateKey,
            index: index,
            sessionId: session?.id || 'UNKNOWN',
            issues: issues,
            session: session,
            action: dryRun ? 'WOULD_REMOVE' : 'REMOVED'
          });
        } else {
          validSessions.push(session);
        }
      });
      
      // Update the date's sessions if we have changes
      if (dateCorrupted > 0) {
        console.log(`  🧹 Date ${dateKey}: ${dateCorrupted} corrupted, ${validSessions.length} valid`);
        
        if (!dryRun) {
          sessions[dateKey] = validSessions;
          cleanedSessions++;
        }
      }
    }
    
    // Generate summary
    console.log(`\n📊 CLEANUP SUMMARY:`);
    console.log(`  Total sessions analyzed: ${totalSessions}`);
    console.log(`  Corrupted sessions found: ${corruptedSessions}`);
    console.log(`  Dates with issues: ${cleanupReport.filter(r => r.date).length}`);
    
    if (dryRun) {
      console.log(`  👁️ DRY RUN - No changes made`);
      console.log(`  📋 Run cleanupCorruptedSessions(false) to apply fixes`);
    } else {
      console.log(`  ✅ Sessions cleaned: ${cleanedSessions}`);
      
      // Save cleaned sessions
      await chrome.storage.local.set({ site_usage_sessions: sessions });
      console.log(`  💾 Updated sessions saved to storage`);
    }
    
    // Detailed report
    if (cleanupReport.length > 0) {
      console.log(`\n📋 DETAILED ISSUES FOUND:`);
      
      const groupedByIssue = {};
      cleanupReport.forEach(item => {
        if (item.issues) {
          item.issues.forEach(issue => {
            if (!groupedByIssue[issue]) groupedByIssue[issue] = [];
            groupedByIssue[issue].push(item);
          });
        }
      });
      
      Object.entries(groupedByIssue).forEach(([issue, items]) => {
        console.log(`  ${issue}: ${items.length} sessions`);
      });
    }
    
    // Store report for inspection
    window.cleanupReport = cleanupReport;
    
    return {
      totalAnalyzed: totalSessions,
      corruptedFound: corruptedSessions,
      cleanedUp: cleanedSessions,
      dryRun,
      report: cleanupReport
    };
    
  } catch (error) {
    console.error('❌ Error in session cleanup:', error);
    return null;
  }
}

/**
 * Validate current session integrity
 */
async function validateCurrentSessions() {
  console.log('\n🔍 Validating current session integrity...');
  
  try {
    // Test the getTodayStats logic with current data
    const today = new Date().toISOString().split('T')[0];
    console.log('📅 Today:', today);
    
    const storage = await chrome.storage.local.get(['site_usage_sessions']);
    const sessions = storage.site_usage_sessions?.[today] || [];
    
    console.log(`📊 Today's sessions: ${sessions.length}`);
    
    if (sessions.length === 0) {
      console.log('ℹ️ No sessions for today');
      return { valid: true, totalTime: 0, sitesCount: 0 };
    }
    
    // Run through validation logic
    let totalTime = 0;
    let validSessions = 0;
    let corruptedSessions = 0;
    const sites = {};
    
    sessions.forEach((session, index) => {
      // Apply the same validation as the fixed getTodayStats
      if (!session || typeof session !== 'object') {
        console.warn(`  ❌ Session ${index}: invalid object`);
        corruptedSessions++;
        return;
      }
      
      if (!session.domain || typeof session.domain !== 'string') {
        console.warn(`  ❌ Session ${index}: invalid domain`);
        corruptedSessions++;
        return;
      }
      
      if (typeof session.duration !== 'number' || isNaN(session.duration) || session.duration < 0) {
        console.warn(`  ❌ Session ${index}: invalid duration:`, session.duration);
        corruptedSessions++;
        return;
      }
      
      // Valid session
      const domain = session.domain;
      if (!sites[domain]) sites[domain] = { timeSpent: 0, visits: 0 };
      
      const durationMs = session.duration * 1000;
      sites[domain].timeSpent += durationMs;
      sites[domain].visits += 1;
      totalTime += durationMs;
      validSessions++;
      
      console.log(`  ✅ Session ${index}: ${domain}, ${session.duration}s`);
    });
    
    const result = {
      valid: corruptedSessions === 0,
      totalTime,
      totalTimeFormatted: formatTime(totalTime),
      sitesCount: Object.keys(sites).length,
      validSessions,
      corruptedSessions,
      sites
    };
    
    console.log('📊 Validation result:', result);
    
    // Critical check - if we have sites but zero total time, something is still wrong
    if (totalTime === 0 && Object.keys(sites).length > 0) {
      console.error('🚨 CRITICAL: Still have zero total time with site data!');
      result.criticalIssue = true;
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Error validating sessions:', error);
    return null;
  }
}

/**
 * Test the fixed popup data retrieval
 */
async function testFixedPopupRetrieval() {
  console.log('\n🧪 Testing fixed popup data retrieval...');
  
  try {
    console.log('📤 Sending GET_REALTIME_STATS...');
    
    const result = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'GET_REALTIME_STATS' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
    
    console.log('📥 Response:', result);
    
    if (result?.success && result?.data) {
      const data = result.data;
      console.log('✅ Success! Data received:');
      console.log(`  Total Time: ${data.totalTime}ms (${formatTime(data.totalTime)})`);
      console.log(`  Sites Visited: ${data.sitesVisited}`);
      console.log(`  Sites Count: ${Object.keys(data.sites || {}).length}`);
      
      // Check if the bug is fixed
      const hasBug = data.totalTime === 0 && Object.keys(data.sites || {}).length > 0;
      console.log(hasBug ? '❌ BUG STILL EXISTS' : '✅ BUG APPEARS FIXED');
      
      return { success: true, data, hasBug };
    } else {
      console.error('❌ Failed to get data');
      return { success: false, error: result };
    }
    
  } catch (error) {
    console.error('❌ Error testing popup retrieval:', error);
    return { success: false, error };
  }
}

/**
 * Helper to format time
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
 * Comprehensive fix verification
 */
async function verifyFix() {
  console.log('\n🔧 Running comprehensive fix verification...');
  
  const validation = await validateCurrentSessions();
  const popupTest = await testFixedPopupRetrieval();
  
  const isFixed = validation?.valid && !validation?.criticalIssue && !popupTest?.hasBug;
  
  console.log(`\n${isFixed ? '✅ FIX VERIFIED' : '❌ ISSUES REMAIN'}`);
  
  return {
    isFixed,
    validation,
    popupTest
  };
}

// Make functions available globally
window.cleanupCorruptedSessions = cleanupCorruptedSessions;
window.validateCurrentSessions = validateCurrentSessions;
window.testFixedPopupRetrieval = testFixedPopupRetrieval;
window.verifyFix = verifyFix;

console.log('\n📚 Available commands:');
console.log('- cleanupCorruptedSessions() // Analyze corrupted sessions (dry run)');
console.log('- cleanupCorruptedSessions(false) // Actually clean corrupted sessions');
console.log('- validateCurrentSessions() // Check current session integrity');
console.log('- testFixedPopupRetrieval() // Test if popup fix works');
console.log('- verifyFix() // Comprehensive fix verification');
console.log('- window.cleanupReport // View detailed cleanup report');