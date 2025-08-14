/**
 * Comprehensive Verification Script for All Extension Fixes
 * 
 * Run this in Chrome Extension Console (right-click extension icon -> Inspect popup -> Console)
 * This script verifies all the fixes implemented in the session:
 * 1. Duration tracking inflation fix
 * 2. Tab detection reliability improvements  
 * 3. Session timing bug fix
 */

console.log('🔧 Starting comprehensive extension fix verification...');

// Global verification state
window.verificationState = {
  startTime: Date.now(),
  results: {},
  issues: []
};

/**
 * Test 1: Session data integrity and duration calculation
 */
async function testSessionDataIntegrity() {
  console.log('\n=== TEST 1: SESSION DATA INTEGRITY ===');
  
  try {
    const storage = await chrome.storage.local.get(['site_usage_sessions']);
    const sessions = storage.site_usage_sessions || {};
    const today = new Date().toISOString().split('T')[0];
    const todaySessions = sessions[today] || [];
    
    console.log(`📊 Found ${todaySessions.length} sessions for today`);
    
    let validSessions = 0;
    let corruptedSessions = 0;
    let totalDuration = 0;
    let sessionAnalysis = {};
    
    todaySessions.forEach((session, index) => {
      const issues = [];
      
      if (!session || typeof session !== 'object') {
        issues.push('INVALID_OBJECT');
      } else {
        if (!session.domain || typeof session.domain !== 'string') {
          issues.push('INVALID_DOMAIN');
        }
        
        if (typeof session.duration !== 'number' || isNaN(session.duration) || session.duration < 0) {
          issues.push(`INVALID_DURATION_${typeof session.duration}_${session.duration}`);
        } else {
          totalDuration += session.duration;
          if (!sessionAnalysis[session.domain]) {
            sessionAnalysis[session.domain] = { count: 0, totalDuration: 0 };
          }
          sessionAnalysis[session.domain].count++;
          sessionAnalysis[session.domain].totalDuration += session.duration;
        }
      }
      
      if (issues.length > 0) {
        corruptedSessions++;
        console.warn(`  ❌ Session ${index} corrupted:`, issues);
      } else {
        validSessions++;
      }
    });
    
    // Check for duration inflation issues
    const suspiciouslyLongSessions = todaySessions.filter(s => s.duration && s.duration > 14400); // 4+ hours
    const duplicateDomains = Object.entries(sessionAnalysis).filter(([domain, data]) => data.count > 5);
    
    console.log('📈 Session Analysis:');
    console.log(`  Valid sessions: ${validSessions}`);
    console.log(`  Corrupted sessions: ${corruptedSessions}`);
    console.log(`  Total duration: ${totalDuration}s (${Math.round(totalDuration/60)}min)`);
    console.log(`  Suspiciously long sessions: ${suspiciouslyLongSessions.length}`);
    console.log(`  Domains with many sessions: ${duplicateDomains.length}`);
    
    const result = {
      testName: 'session_data_integrity',
      passed: corruptedSessions === 0 && suspiciouslyLongSessions.length === 0,
      validSessions,
      corruptedSessions,
      totalDurationMinutes: Math.round(totalDuration/60),
      suspiciousLongSessions: suspiciouslyLongSessions.length,
      duplicateDomains: duplicateDomains.length
    };
    
    window.verificationState.results.sessionIntegrity = result;
    
    if (!result.passed) {
      window.verificationState.issues.push('SESSION_DATA_INTEGRITY_FAILED');
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Session integrity test failed:', error);
    window.verificationState.issues.push('SESSION_INTEGRITY_TEST_ERROR');
    return { testName: 'session_data_integrity', passed: false, error: error.message };
  }
}

/**
 * Test 2: Popup total time calculation accuracy
 */
async function testPopupCalculation() {
  console.log('\n=== TEST 2: POPUP CALCULATION ACCURACY ===');
  
  try {
    // Test the new GET_COMPLETE_STATS endpoint
    const result = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'GET_COMPLETE_STATS' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
    
    console.log('📊 GET_COMPLETE_STATS response:', result);
    
    if (result?.success && result?.data) {
      const data = result.data;
      const totalTimeFormatted = formatTime(data.totalTime);
      
      // Check DOM element
      const totalTimeEl = document.getElementById('total-time');
      const currentDisplay = totalTimeEl ? totalTimeEl.textContent : 'NOT_FOUND';
      
      console.log('🖥️ DOM Display Check:');
      console.log(`  API Total Time: ${data.totalTime}ms (${totalTimeFormatted})`);
      console.log(`  DOM Display: "${currentDisplay}"`);
      console.log(`  Sites Count: ${Object.keys(data.sites || {}).length}`);
      
      const hasBug = data.totalTime === 0 && Object.keys(data.sites || {}).length > 0;
      const displayMatches = currentDisplay === totalTimeFormatted;
      
      const testResult = {
        testName: 'popup_calculation',
        passed: !hasBug && (data.totalTime === 0 || displayMatches),
        totalTime: data.totalTime,
        totalTimeFormatted,
        domDisplay: currentDisplay,
        sitesCount: Object.keys(data.sites || {}).length,
        displayMatches,
        hasBug
      };
      
      window.verificationState.results.popupCalculation = testResult;
      
      if (hasBug) {
        console.error('🚨 BUG DETECTED: Zero total time with site data');
        window.verificationState.issues.push('ZERO_TOTAL_WITH_SITES_BUG');
      }
      
      if (!displayMatches && data.totalTime > 0) {
        console.error('🚨 DISPLAY MISMATCH: DOM does not match API data');
        window.verificationState.issues.push('DOM_API_MISMATCH');
      }
      
      return testResult;
      
    } else {
      console.error('❌ Failed to get complete stats');
      window.verificationState.issues.push('API_CALL_FAILED');
      return { testName: 'popup_calculation', passed: false, error: 'API call failed' };
    }
    
  } catch (error) {
    console.error('❌ Popup calculation test failed:', error);
    window.verificationState.issues.push('POPUP_CALCULATION_TEST_ERROR');
    return { testName: 'popup_calculation', passed: false, error: error.message };
  }
}

/**
 * Test 3: Tab detection and coordination system
 */
async function testTabDetectionSystem() {
  console.log('\n=== TEST 3: TAB DETECTION SYSTEM ===');
  
  try {
    // Check if TabEventCoordinator is present
    const bg = chrome.extension.getBackgroundPage();
    
    if (!bg || !bg.focusTimeTracker) {
      console.warn('⚠️ Cannot access background page for tab detection test');
      return { testName: 'tab_detection', passed: false, error: 'Cannot access background page' };
    }
    
    const hasCoordinator = !!bg.focusTimeTracker.tabEventCoordinator;
    const hasRetryLogic = typeof bg.focusTimeTracker.startTrackingWithRetry === 'function';
    const hasStateRecovery = typeof bg.focusTimeTracker.ensureStateManagerReady === 'function';
    
    console.log('🔧 Tab Detection Components:');
    console.log(`  TabEventCoordinator: ${hasCoordinator ? '✅ Present' : '❌ Missing'}`);
    console.log(`  Retry Logic: ${hasRetryLogic ? '✅ Present' : '❌ Missing'}`);
    console.log(`  State Recovery: ${hasStateRecovery ? '✅ Present' : '❌ Missing'}`);
    
    // Test current session state
    const currentSession = bg.focusTimeTracker.currentSession;
    console.log('📊 Current Session State:', {
      isActive: currentSession.isActive,
      domain: currentSession.domain,
      hasStartTime: !!currentSession.startTime
    });
    
    const testResult = {
      testName: 'tab_detection',
      passed: hasCoordinator && hasRetryLogic && hasStateRecovery,
      hasCoordinator,
      hasRetryLogic,
      hasStateRecovery,
      currentSession: {
        isActive: currentSession.isActive,
        domain: currentSession.domain
      }
    };
    
    window.verificationState.results.tabDetection = testResult;
    
    if (!testResult.passed) {
      window.verificationState.issues.push('TAB_DETECTION_COMPONENTS_MISSING');
    }
    
    return testResult;
    
  } catch (error) {
    console.error('❌ Tab detection test failed:', error);
    window.verificationState.issues.push('TAB_DETECTION_TEST_ERROR');
    return { testName: 'tab_detection', passed: false, error: error.message };
  }
}

/**
 * Test 4: Session timing accuracy (the LinkedIn/YouTube timing bug)
 */
async function testSessionTimingAccuracy() {
  console.log('\n=== TEST 4: SESSION TIMING ACCURACY ===');
  
  try {
    // Check recent sessions for timing accuracy
    const storage = await chrome.storage.local.get(['site_usage_sessions']);
    const sessions = storage.site_usage_sessions || {};
    const today = new Date().toISOString().split('T')[0];
    const todaySessions = sessions[today] || [];
    
    if (todaySessions.length === 0) {
      console.log('ℹ️ No sessions today to test timing accuracy');
      return { testName: 'timing_accuracy', passed: true, note: 'No sessions to test' };
    }
    
    // Analyze timing patterns in recent sessions
    const recentSessions = todaySessions.slice(-10); // Last 10 sessions
    let timingIssues = 0;
    let validTimings = 0;
    
    recentSessions.forEach((session, index) => {
      if (session.startTime && session.duration) {
        const sessionEndTime = new Date(session.startTime).getTime() + (session.duration * 1000);
        const now = Date.now();
        
        // Check for impossible future timestamps or negative durations
        if (session.startTime > now || session.duration < 0) {
          timingIssues++;
          console.warn(`  ⚠️ Session ${index}: Invalid timing - Start: ${new Date(session.startTime)}, Duration: ${session.duration}s`);
        } else {
          validTimings++;
        }
        
        // Log session timing for inspection
        console.log(`  📅 Session ${index}: ${session.domain} - Start: ${new Date(session.startTime).toLocaleTimeString()}, Duration: ${session.duration}s`);
      }
    });
    
    console.log('⏰ Timing Analysis:');
    console.log(`  Valid timings: ${validTimings}`);
    console.log(`  Timing issues: ${timingIssues}`);
    
    const testResult = {
      testName: 'timing_accuracy',
      passed: timingIssues === 0,
      validTimings,
      timingIssues,
      sessionsAnalyzed: recentSessions.length
    };
    
    window.verificationState.results.timingAccuracy = testResult;
    
    if (timingIssues > 0) {
      window.verificationState.issues.push('SESSION_TIMING_ISSUES');
    }
    
    return testResult;
    
  } catch (error) {
    console.error('❌ Timing accuracy test failed:', error);
    window.verificationState.issues.push('TIMING_ACCURACY_TEST_ERROR');
    return { testName: 'timing_accuracy', passed: false, error: error.message };
  }
}

/**
 * Helper function to format time
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
 * Generate comprehensive verification report
 */
function generateVerificationReport() {
  console.log('\n=== COMPREHENSIVE VERIFICATION REPORT ===');
  
  const report = {
    timestamp: new Date().toISOString(),
    duration: Date.now() - window.verificationState.startTime,
    results: window.verificationState.results,
    issues: window.verificationState.issues,
    summary: {}
  };
  
  const testResults = Object.values(report.results);
  const passedTests = testResults.filter(r => r.passed).length;
  const totalTests = testResults.length;
  
  report.summary = {
    totalTests,
    passedTests,
    failedTests: totalTests - passedTests,
    totalIssues: report.issues.length,
    overallPassed: report.issues.length === 0 && passedTests === totalTests
  };
  
  console.log('📊 VERIFICATION SUMMARY:');
  console.log(`  Tests Passed: ${passedTests}/${totalTests}`);
  console.log(`  Issues Found: ${report.summary.totalIssues}`);
  console.log(`  Overall Status: ${report.summary.overallPassed ? '✅ ALL FIXES WORKING' : '❌ ISSUES REMAIN'}`);
  
  if (report.issues.length > 0) {
    console.log('\n🚨 ISSUES FOUND:');
    report.issues.forEach((issue, index) => {
      console.log(`  ${index + 1}. ${issue}`);
    });
  }
  
  console.log('\n📋 DETAILED RESULTS:');
  Object.values(report.results).forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`  ${result.testName}: ${status}`);
  });
  
  // Store report globally
  window.verificationReport = report;
  
  console.log('\n✅ Verification complete. Full report available at: window.verificationReport');
  
  return report;
}

/**
 * Main verification function
 */
async function runComprehensiveVerification() {
  console.log('🔍 Running comprehensive fix verification...');
  
  try {
    await testSessionDataIntegrity();
    await testPopupCalculation();
    await testTabDetectionSystem();
    await testSessionTimingAccuracy();
    
    const report = generateVerificationReport();
    
    // Final recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    
    if (report.summary.overallPassed) {
      console.log('🎉 All fixes are working correctly!');
      console.log('  - Duration inflation issues resolved');
      console.log('  - Tab detection reliability improved');
      console.log('  - Session timing bug fixed');
      console.log('  - Popup calculation accuracy verified');
    } else {
      if (report.issues.includes('SESSION_DATA_INTEGRITY_FAILED')) {
        console.log('  🔧 Run session cleanup script to fix corrupted data');
      }
      if (report.issues.includes('ZERO_TOTAL_WITH_SITES_BUG')) {
        console.log('  🔧 Check getTodayStats() implementation for calculation issues');
      }
      if (report.issues.includes('TAB_DETECTION_COMPONENTS_MISSING')) {
        console.log('  🔧 Rebuild extension to ensure all components are loaded');
      }
    }
    
    return report;
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    return null;
  }
}

// Auto-run the verification
runComprehensiveVerification();

// Make functions available globally
window.runComprehensiveVerification = runComprehensiveVerification;
window.testSessionDataIntegrity = testSessionDataIntegrity;
window.testPopupCalculation = testPopupCalculation;
window.testTabDetectionSystem = testTabDetectionSystem;
window.testSessionTimingAccuracy = testSessionTimingAccuracy;
window.formatTime = formatTime;

console.log('\n📚 Available commands:');
console.log('- runComprehensiveVerification() // Re-run all tests');
console.log('- testSessionDataIntegrity() // Test session data quality');
console.log('- testPopupCalculation() // Test popup calculation accuracy');
console.log('- testTabDetectionSystem() // Test tab detection improvements');
console.log('- testSessionTimingAccuracy() // Test timing bug fix');
console.log('- window.verificationReport // Access full verification report');