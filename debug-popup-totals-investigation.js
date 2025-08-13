/**
 * Comprehensive Investigation Script for Popup "On Screen Time: 0m" Bug
 * 
 * This script investigates the intermittent bug where popup shows "0m" total time
 * while site usage list shows correct data.
 * 
 * Copy and paste this into the Chrome Extension Console:
 * Right-click extension icon -> Inspect popup -> Console tab -> paste this script
 */

console.log('🔍 Starting comprehensive popup totals investigation...');

// Global investigation state
window.debugInvestigation = {
  startTime: Date.now(),
  findings: [],
  testResults: [],
  rawData: {},
  suspectedIssues: []
};

/**
 * Step 1: Analyze raw storage structure and data integrity
 */
async function analyzeStorageStructure() {
  console.log('\n=== STEP 1: STORAGE STRUCTURE ANALYSIS ===');
  
  try {
    const storage = await chrome.storage.local.get(['site_usage_sessions']);
    const sessions = storage.site_usage_sessions || {};
    
    window.debugInvestigation.rawData.sessions = sessions;
    
    console.log('📊 Raw storage structure:', sessions);
    console.log('📊 Top-level keys:', Object.keys(sessions));
    
    // Analyze date-based organization
    const dateKeys = Object.keys(sessions).filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key));
    const nonDateKeys = Object.keys(sessions).filter(key => !/^\d{4}-\d{2}-\d{2}$/.test(key));
    
    console.log(`📅 Date-based keys (${dateKeys.length}):`, dateKeys);
    console.log(`🔑 Non-date keys (${nonDateKeys.length}):`, nonDateKeys);
    
    if (nonDateKeys.length > 0) {
      window.debugInvestigation.suspectedIssues.push('MIXED_STORAGE_STRUCTURE');
      console.warn('⚠️ SUSPECTED ISSUE: Mixed storage structure detected');
      
      // Analyze non-date keys to see if they're session IDs
      nonDateKeys.forEach(key => {
        const value = sessions[key];
        console.log(`🔍 Non-date key "${key}":`, typeof value, value);
        
        // Check if it looks like a session object
        if (typeof value === 'object' && value !== null && value.domain) {
          console.warn(`⚠️ Session object stored with non-date key: ${key}`);
        }
      });
    }
    
    // Analyze each date's sessions
    const today = new Date().toISOString().split('T')[0];
    console.log('📅 Today is:', today);
    
    dateKeys.forEach(dateKey => {
      const dateSessions = sessions[dateKey];
      console.log(`\n📅 Date ${dateKey}:`);
      console.log(`  Sessions count: ${Array.isArray(dateSessions) ? dateSessions.length : 'NOT ARRAY!'}`);
      
      if (!Array.isArray(dateSessions)) {
        window.debugInvestigation.suspectedIssues.push(`INVALID_DATE_STRUCTURE_${dateKey}`);
        console.error(`❌ Date ${dateKey} contains non-array data:`, typeof dateSessions, dateSessions);
        return;
      }
      
      // Analyze session integrity
      dateSessions.forEach((session, index) => {
        if (typeof session !== 'object' || session === null) {
          console.error(`❌ Session ${index} is not an object:`, session);
          window.debugInvestigation.suspectedIssues.push(`INVALID_SESSION_${dateKey}_${index}`);
          return;
        }
        
        // Check for required fields
        const requiredFields = ['id', 'domain', 'duration', 'status'];
        const missingFields = requiredFields.filter(field => !(field in session));
        
        if (missingFields.length > 0) {
          console.warn(`⚠️ Session ${index} missing fields:`, missingFields, session);
          window.debugInvestigation.suspectedIssues.push(`MISSING_FIELDS_${dateKey}_${index}`);
        }
        
        // Check duration validity
        if ('duration' in session) {
          const duration = session.duration;
          if (typeof duration !== 'number') {
            console.error(`❌ Session ${index} duration is not a number:`, typeof duration, duration, session);
            window.debugInvestigation.suspectedIssues.push(`INVALID_DURATION_TYPE_${dateKey}_${index}`);
          } else if (isNaN(duration)) {
            console.error(`❌ Session ${index} duration is NaN:`, session);
            window.debugInvestigation.suspectedIssues.push(`NAN_DURATION_${dateKey}_${index}`);
          } else if (duration < 0) {
            console.warn(`⚠️ Session ${index} has negative duration:`, duration, session);
            window.debugInvestigation.suspectedIssues.push(`NEGATIVE_DURATION_${dateKey}_${index}`);
          }
        }
        
        // Log session summary for today
        if (dateKey === today && index < 5) {
          console.log(`  Session ${index}:`, {
            id: session.id,
            domain: session.domain,
            duration: session.duration,
            status: session.status,
            durationValid: typeof session.duration === 'number' && !isNaN(session.duration)
          });
        }
      });
    });
    
    window.debugInvestigation.findings.push({
      step: 'storage_structure',
      dateKeys: dateKeys.length,
      nonDateKeys: nonDateKeys.length,
      todayExists: dateKeys.includes(today),
      suspectedIssues: window.debugInvestigation.suspectedIssues.length
    });
    
  } catch (error) {
    console.error('❌ Error in storage structure analysis:', error);
    window.debugInvestigation.suspectedIssues.push('STORAGE_ACCESS_ERROR');
  }
}

/**
 * Step 2: Test getTodayStats logic manually
 */
async function testGetTodayStatsLogic() {
  console.log('\n=== STEP 2: TESTING getTodayStats LOGIC ===');
  
  try {
    // Replicate the exact getTodayStats logic
    const today = new Date().toISOString().split('T')[0]; // This is how DateUtils.getLocalDateString works
    console.log('📅 Using date key:', today);
    
    const storage = await chrome.storage.local.get(['site_usage_sessions']);
    const sessions = storage.site_usage_sessions?.[today] || [];
    
    console.log(`📊 Found ${sessions.length} sessions for today`);
    
    if (sessions.length === 0) {
      console.warn('⚠️ No sessions found for today - this would cause 0m display');
      window.debugInvestigation.suspectedIssues.push('NO_SESSIONS_TODAY');
      return;
    }
    
    // Replicate the aggregation logic exactly
    const stats = {
      totalTime: 0,
      sitesVisited: 0,
      productivityScore: 0,
      sites: {}
    };
    
    let validSessions = 0;
    let corruptedSessions = 0;
    
    sessions.forEach((session, index) => {
      console.log(`\n🔍 Processing session ${index}:`, session);
      
      const domain = session.domain;
      
      if (!domain) {
        console.error(`❌ Session ${index} has no domain:`, session);
        corruptedSessions++;
        return;
      }
      
      if (!stats.sites[domain]) {
        stats.sites[domain] = {
          timeSpent: 0,
          visits: 0
        };
      }
      
      // This is the critical part - duration handling
      const duration = session.duration;
      console.log(`  Duration value:`, duration, `(type: ${typeof duration})`);
      
      if (typeof duration !== 'number') {
        console.error(`❌ Duration is not a number:`, duration);
        corruptedSessions++;
        return;
      }
      
      if (isNaN(duration)) {
        console.error(`❌ Duration is NaN:`, duration);
        corruptedSessions++;
        return;
      }
      
      const durationMs = duration * 1000; // Convert seconds to ms
      console.log(`  Duration in ms:`, durationMs);
      
      stats.sites[domain].timeSpent += durationMs;
      stats.sites[domain].visits += session.visits || 1;
      stats.totalTime += durationMs;
      
      console.log(`  Running totalTime:`, stats.totalTime);
      console.log(`  Site stats for ${domain}:`, stats.sites[domain]);
      
      validSessions++;
    });
    
    stats.sitesVisited = Object.keys(stats.sites).length;
    
    console.log('\n📊 FINAL AGGREGATED STATS:');
    console.log('  Total Time (ms):', stats.totalTime);
    console.log('  Total Time (formatted):', formatTime(stats.totalTime));
    console.log('  Sites Visited:', stats.sitesVisited);
    console.log('  Valid Sessions:', validSessions);
    console.log('  Corrupted Sessions:', corruptedSessions);
    console.log('  Sites Data:', stats.sites);
    
    window.debugInvestigation.testResults.push({
      step: 'getTodayStats_logic',
      totalTime: stats.totalTime,
      sitesVisited: stats.sitesVisited,
      validSessions,
      corruptedSessions,
      sitesCount: Object.keys(stats.sites).length
    });
    
    // Critical analysis
    if (stats.totalTime === 0 && Object.keys(stats.sites).length > 0) {
      console.error('🚨 CRITICAL ISSUE FOUND: totalTime is 0 but sites have data!');
      window.debugInvestigation.suspectedIssues.push('ZERO_TOTAL_WITH_SITE_DATA');
    }
    
    if (corruptedSessions > 0) {
      console.error(`🚨 FOUND ${corruptedSessions} CORRUPTED SESSIONS causing calculation failure`);
      window.debugInvestigation.suspectedIssues.push('CORRUPTED_SESSIONS');
    }
    
  } catch (error) {
    console.error('❌ Error in getTodayStats logic test:', error);
    window.debugInvestigation.suspectedIssues.push('GET_TODAY_STATS_ERROR');
  }
}

/**
 * Step 3: Test actual popup data retrieval
 */
async function testActualPopupDataRetrieval() {
  console.log('\n=== STEP 3: TESTING ACTUAL POPUP DATA RETRIEVAL ===');
  
  try {
    console.log('📤 Sending GET_REALTIME_STATS message...');
    
    const result = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'GET_REALTIME_STATS' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
    
    console.log('📥 Received response:', result);
    
    if (result?.success && result?.data) {
      const data = result.data;
      console.log('📊 Response data breakdown:');
      console.log('  Total Time:', data.totalTime, `(${formatTime(data.totalTime)})`);
      console.log('  Sites Visited:', data.sitesVisited);
      console.log('  Sites data keys:', Object.keys(data.sites || {}));
      console.log('  Sites data:', data.sites);
      
      window.debugInvestigation.testResults.push({
        step: 'popup_data_retrieval',
        totalTime: data.totalTime,
        sitesVisited: data.sitesVisited,
        sitesCount: Object.keys(data.sites || {}).length,
        hasZeroTotalWithSites: data.totalTime === 0 && Object.keys(data.sites || {}).length > 0
      });
      
      if (data.totalTime === 0 && Object.keys(data.sites || {}).length > 0) {
        console.error('🚨 REPRODUCED THE BUG: totalTime is 0 but sites have data!');
        window.debugInvestigation.suspectedIssues.push('BUG_REPRODUCED');
      }
    } else {
      console.error('❌ Failed to get data:', result);
      window.debugInvestigation.suspectedIssues.push('API_CALL_FAILED');
    }
    
  } catch (error) {
    console.error('❌ Error in popup data retrieval test:', error);
    window.debugInvestigation.suspectedIssues.push('POPUP_API_ERROR');
  }
}

/**
 * Step 4: Compare background vs popup calculation
 */
async function compareBackgroundVsPopupCalculation() {
  console.log('\n=== STEP 4: BACKGROUND VS POPUP CALCULATION COMPARISON ===');
  
  try {
    // Test if we can access background page directly
    const bg = chrome.extension.getBackgroundPage();
    
    if (!bg || !bg.focusTimeTracker || !bg.focusTimeTracker.storageManager) {
      console.warn('⚠️ Cannot access background page or storage manager directly');
      return;
    }
    
    console.log('✅ Background page accessible');
    
    // Test direct background method call
    const bgStats = await bg.focusTimeTracker.storageManager.getTodayStats();
    console.log('📊 Direct background getTodayStats result:', bgStats);
    
    // Test background getRealTimeStatsWithSession
    const bgRealTimeStats = await bg.focusTimeTracker.storageManager.getRealTimeStatsWithSession();
    console.log('📊 Background getRealTimeStatsWithSession result:', bgRealTimeStats);
    
    // Compare focusTimeTracker reference state
    const hasTracker = !!bg.focusTimeTracker.storageManager.focusTimeTracker;
    console.log('🎯 FocusTimeTracker reference exists:', hasTracker);
    
    if (!hasTracker) {
      console.warn('⚠️ POTENTIAL ISSUE: focusTimeTracker reference is missing in StorageManager');
      window.debugInvestigation.suspectedIssues.push('MISSING_TRACKER_REFERENCE');
    }
    
    window.debugInvestigation.testResults.push({
      step: 'background_comparison',
      bgDirectTotal: bgStats?.totalTime,
      bgRealTimeTotal: bgRealTimeStats?.totalTime,
      hasTrackerRef: hasTracker
    });
    
  } catch (error) {
    console.error('❌ Error in background comparison:', error);
    window.debugInvestigation.suspectedIssues.push('BACKGROUND_ACCESS_ERROR');
  }
}

/**
 * Step 5: Date key consistency check
 */
async function checkDateKeyConsistency() {
  console.log('\n=== STEP 5: DATE KEY CONSISTENCY CHECK ===');
  
  try {
    // Test different date calculation methods
    const jsDate = new Date();
    const jsDateString = jsDate.toISOString().split('T')[0];
    
    const manualDate = (() => {
      const year = jsDate.getFullYear();
      const month = String(jsDate.getMonth() + 1).padStart(2, '0');
      const day = String(jsDate.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    })();
    
    console.log('📅 Date calculation methods:');
    console.log('  ISO split:', jsDateString);
    console.log('  Manual calc:', manualDate);
    console.log('  Match:', jsDateString === manualDate);
    
    if (jsDateString !== manualDate) {
      console.error('❌ Date calculation mismatch detected!');
      window.debugInvestigation.suspectedIssues.push('DATE_CALCULATION_MISMATCH');
    }
    
    // Check storage with both keys
    const storage = await chrome.storage.local.get(['site_usage_sessions']);
    const sessions = storage.site_usage_sessions || {};
    
    console.log(`📊 Sessions under '${jsDateString}':`, sessions[jsDateString] ? sessions[jsDateString].length : 'NONE');
    console.log(`📊 Sessions under '${manualDate}':`, sessions[manualDate] ? sessions[manualDate].length : 'NONE');
    
    // Check for timezone-related date keys
    const allDateKeys = Object.keys(sessions).filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key)).sort();
    console.log('📅 All date keys in storage:', allDateKeys);
    
    if (allDateKeys.length > 1) {
      const latestDate = allDateKeys[allDateKeys.length - 1];
      const todayCalculated = jsDateString;
      
      if (latestDate !== todayCalculated) {
        console.warn(`⚠️ Latest date in storage (${latestDate}) != today calculated (${todayCalculated})`);
        window.debugInvestigation.suspectedIssues.push('DATE_STORAGE_MISMATCH');
      }
    }
    
    window.debugInvestigation.testResults.push({
      step: 'date_consistency',
      isoDate: jsDateString,
      manualDate: manualDate,
      datesMatch: jsDateString === manualDate,
      allDateKeys: allDateKeys
    });
    
  } catch (error) {
    console.error('❌ Error in date consistency check:', error);
    window.debugInvestigation.suspectedIssues.push('DATE_CHECK_ERROR');
  }
}

/**
 * Helper function to format time (replicated from popup)
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
function generateReport() {
  console.log('\n=== COMPREHENSIVE INVESTIGATION REPORT ===');
  
  const report = {
    timestamp: new Date().toISOString(),
    duration: Date.now() - window.debugInvestigation.startTime,
    suspectedIssues: window.debugInvestigation.suspectedIssues,
    findings: window.debugInvestigation.findings,
    testResults: window.debugInvestigation.testResults,
    summary: {}
  };
  
  // Generate summary
  report.summary.totalSuspectedIssues = report.suspectedIssues.length;
  report.summary.hasCriticalIssues = report.suspectedIssues.some(issue => 
    issue.includes('ZERO_TOTAL_WITH_SITE_DATA') || 
    issue.includes('CORRUPTED_SESSIONS') ||
    issue.includes('BUG_REPRODUCED')
  );
  
  console.log('📋 INVESTIGATION SUMMARY:');
  console.log(`  Duration: ${report.duration}ms`);
  console.log(`  Suspected Issues Found: ${report.summary.totalSuspectedIssues}`);
  console.log(`  Critical Issues: ${report.summary.hasCriticalIssues ? 'YES' : 'NO'}`);
  
  if (report.suspectedIssues.length > 0) {
    console.log('\n🚨 SUSPECTED ISSUES:');
    report.suspectedIssues.forEach((issue, index) => {
      console.log(`  ${index + 1}. ${issue}`);
    });
  }
  
  console.log('\n📊 TEST RESULTS:');
  report.testResults.forEach(result => {
    console.log(`  ${result.step}:`, result);
  });
  
  // Store report globally for access
  window.debugInvestigation.finalReport = report;
  
  console.log('\n✅ Investigation complete. Full report available at: window.debugInvestigation.finalReport');
  
  return report;
}

/**
 * Main investigation function
 */
async function runComprehensiveInvestigation() {
  console.log('🕵️ Running comprehensive popup totals investigation...');
  
  try {
    await analyzeStorageStructure();
    await testGetTodayStatsLogic();
    await testActualPopupDataRetrieval();
    await compareBackgroundVsPopupCalculation();
    await checkDateKeyConsistency();
    
    const report = generateReport();
    
    // Provide specific recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    
    if (report.suspectedIssues.includes('CORRUPTED_SESSIONS')) {
      console.log('  1. Add session validation and filtering in getTodayStats()');
      console.log('  2. Implement session cleanup for corrupted entries');
    }
    
    if (report.suspectedIssues.includes('MIXED_STORAGE_STRUCTURE')) {
      console.log('  3. Migrate storage to consistent date-based structure');
    }
    
    if (report.suspectedIssues.includes('MISSING_TRACKER_REFERENCE')) {
      console.log('  4. Ensure focusTimeTracker reference is properly set during initialization');
    }
    
    if (report.suspectedIssues.includes('DATE_CALCULATION_MISMATCH')) {
      console.log('  5. Standardize date calculation across all components');
    }
    
    return report;
    
  } catch (error) {
    console.error('❌ Investigation failed:', error);
    return null;
  }
}

// Auto-run the investigation
runComprehensiveInvestigation();

// Provide helper functions
window.investigatePopupBug = runComprehensiveInvestigation;
window.formatTime = formatTime;

console.log('\n📚 Available commands:');
console.log('- investigatePopupBug() // Re-run full investigation');
console.log('- formatTime(ms) // Test time formatting');
console.log('- window.debugInvestigation // Access investigation data');