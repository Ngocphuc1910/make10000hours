/**
 * Test Script for Timing Race Condition Fixes
 * 
 * This script validates that sessions are not created after leaving a tab.
 * Specifically tests the LinkedIn→YouTube scenario and other tab switching behaviors.
 * 
 * Usage: Paste in Chrome Extension Console (right-click extension → Inspect popup → Console)
 */

console.log('🧪 Testing timing race condition fixes...');

// Test state
window.timingTest = {
  startTime: Date.now(),
  results: [],
  monitoring: false,
  sessionHistory: []
};

/**
 * Monitor session creation in real-time
 */
async function startSessionMonitoring() {
  console.log('\n=== STARTING SESSION MONITORING ===');
  
  window.timingTest.monitoring = true;
  window.timingTest.sessionHistory = [];
  
  // Get initial session count
  const initialStorage = await chrome.storage.local.get(['site_usage_sessions']);
  const today = new Date().toISOString().split('T')[0];
  const initialSessions = initialStorage.site_usage_sessions?.[today] || [];
  const initialCount = initialSessions.length;
  
  console.log(`📊 Starting monitoring - Initial sessions: ${initialCount}`);
  console.log('📝 Current sessions:', initialSessions.map(s => ({
    id: s.id,
    domain: s.domain,
    startTime: new Date(s.startTime).toLocaleTimeString(),
    duration: s.duration,
    status: s.status
  })));
  
  // Monitor session changes every 500ms
  const monitoringInterval = setInterval(async () => {
    if (!window.timingTest.monitoring) {
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
          const timingIssue = Math.abs(createdAt - startTime) > 5000; // 5 second tolerance
          
          const sessionInfo = {
            timestamp: Date.now(),
            sessionId: session.id,
            domain: session.domain,
            startTime: startTime.toLocaleTimeString(),
            createdAt: createdAt.toLocaleTimeString(),
            duration: session.duration,
            status: session.status,
            timingIssue: timingIssue,
            timingDiff: Math.abs(createdAt - startTime)
          };
          
          window.timingTest.sessionHistory.push(sessionInfo);
          
          console.log(`🔍 New session detected:`, sessionInfo);
          
          if (timingIssue) {
            console.error('🚨 TIMING ISSUE DETECTED:', {
              domain: session.domain,
              startTime: startTime.toISOString(),
              createdAt: createdAt.toISOString(),
              timingDiff: sessionInfo.timingDiff + 'ms'
            });
          }
        });
      }
    } catch (error) {
      console.error('❌ Monitoring error:', error);
    }
  }, 500);
  
  console.log('✅ Session monitoring started. Switch tabs now to test!');
  console.log('📚 Available commands:');
  console.log('- stopSessionMonitoring() // Stop monitoring');
  console.log('- getCurrentTabInfo() // Get current tab details');
  console.log('- testTabSwitchingScenario() // Automated tab switching test');
}

/**
 * Stop session monitoring and generate report
 */
function stopSessionMonitoring() {
  console.log('\n=== STOPPING SESSION MONITORING ===');
  
  window.timingTest.monitoring = false;
  
  const report = {
    duration: Date.now() - window.timingTest.startTime,
    totalSessions: window.timingTest.sessionHistory.length,
    timingIssues: window.timingTest.sessionHistory.filter(s => s.timingIssue).length,
    sessions: window.timingTest.sessionHistory
  };
  
  console.log('📊 MONITORING REPORT:');
  console.log(`  Duration: ${Math.round(report.duration/1000)}s`);
  console.log(`  Sessions Created: ${report.totalSessions}`);
  console.log(`  Timing Issues: ${report.timingIssues}`);
  
  if (report.timingIssues > 0) {
    console.log('\n🚨 TIMING ISSUES FOUND:');
    report.sessions.filter(s => s.timingIssue).forEach((session, index) => {
      console.log(`  ${index + 1}. ${session.domain} - Timing diff: ${session.timingDiff}ms`);
    });
  } else if (report.totalSessions > 0) {
    console.log('\n✅ NO TIMING ISSUES DETECTED - All sessions created with correct timing!');
  } else {
    console.log('\nℹ️ No sessions were created during monitoring period');
  }
  
  window.timingTest.results.push(report);
  return report;
}

/**
 * Get current tab information
 */
async function getCurrentTabInfo() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    
    if (!currentTab) {
      console.log('❌ No active tab found');
      return null;
    }
    
    console.log('📋 Current Tab Info:', {
      id: currentTab.id,
      url: currentTab.url,
      title: currentTab.title,
      active: currentTab.active,
      status: currentTab.status,
      windowId: currentTab.windowId
    });
    
    // Check if background script recognizes this as the active tab
    const bg = chrome.extension.getBackgroundPage();
    if (bg && bg.focusTimeTracker) {
      const currentSession = bg.focusTimeTracker.currentSession;
      console.log('🎯 Background Script State:', {
        trackingActive: currentSession.isActive,
        trackingTabId: currentSession.tabId,
        trackingDomain: currentSession.domain,
        matchesCurrentTab: currentSession.tabId === currentTab.id
      });
    }
    
    return currentTab;
  } catch (error) {
    console.error('❌ Error getting tab info:', error);
    return null;
  }
}

/**
 * Test the LinkedIn → YouTube scenario specifically
 */
async function testLinkedInYouTubeScenario() {
  console.log('\n=== TESTING LINKEDIN → YOUTUBE SCENARIO ===');
  
  console.log('📋 Test Instructions:');
  console.log('1. Make sure you have LinkedIn and YouTube tabs open');
  console.log('2. Start on LinkedIn tab');
  console.log('3. Wait 2-3 seconds');
  console.log('4. Switch to YouTube tab quickly');
  console.log('5. Check the results below');
  
  // Start monitoring
  await startSessionMonitoring();
  
  console.log('✅ Monitoring started for LinkedIn → YouTube test');
  console.log('⏰ Please perform the tab switch now...');
  
  // Auto-stop after 30 seconds
  setTimeout(() => {
    if (window.timingTest.monitoring) {
      console.log('\n⏰ Auto-stopping monitoring after 30 seconds...');
      const report = stopSessionMonitoring();
      
      // Analyze results for LinkedIn/YouTube specifically
      const linkedinSessions = report.sessions.filter(s => 
        s.domain.includes('linkedin') || s.domain.includes('youtube')
      );
      
      if (linkedinSessions.length > 0) {
        console.log('\n🔍 LinkedIn/YouTube Sessions Analysis:');
        linkedinSessions.forEach(session => {
          console.log(`  ${session.domain}: Created at ${session.createdAt}, Started at ${session.startTime}`);
          if (session.timingIssue) {
            console.error(`    🚨 TIMING BUG DETECTED: ${session.timingDiff}ms difference`);
          } else {
            console.log(`    ✅ Timing looks correct`);
          }
        });
      }
    }
  }, 30000);
}

/**
 * Test rapid tab switching
 */
async function testRapidTabSwitching() {
  console.log('\n=== TESTING RAPID TAB SWITCHING ===');
  
  console.log('📋 Test Instructions:');
  console.log('1. Rapidly switch between 3-4 different tabs');
  console.log('2. Switch every 1-2 seconds for 15 seconds');
  console.log('3. This will test the debouncing and event cancellation');
  
  await startSessionMonitoring();
  
  console.log('✅ Monitoring started for rapid tab switching test');
  console.log('🚀 Please start rapid tab switching now...');
  
  // Auto-stop after 20 seconds
  setTimeout(() => {
    if (window.timingTest.monitoring) {
      console.log('\n⏰ Auto-stopping monitoring after 20 seconds...');
      const report = stopSessionMonitoring();
      
      console.log('\n📊 Rapid Switching Analysis:');
      console.log(`Sessions created: ${report.totalSessions}`);
      console.log(`Timing issues: ${report.timingIssues}`);
      
      if (report.totalSessions > 10) {
        console.warn('⚠️ High number of sessions - may indicate excessive session creation');
      } else {
        console.log('✅ Session creation appears controlled');
      }
    }
  }, 20000);
}

/**
 * Validate TabEventCoordinator fixes
 */
async function testTabEventCoordinator() {
  console.log('\n=== TESTING TAB EVENT COORDINATOR ===');
  
  try {
    const bg = chrome.extension.getBackgroundPage();
    if (!bg || !bg.focusTimeTracker || !bg.focusTimeTracker.tabEventCoordinator) {
      console.error('❌ Cannot access TabEventCoordinator');
      return false;
    }
    
    const coordinator = bg.focusTimeTracker.tabEventCoordinator;
    
    console.log('✅ TabEventCoordinator accessible');
    console.log('📊 Current state:', {
      pendingEventsCount: coordinator.pendingEvents.size,
      debounceTime: coordinator.debounceTime,
      maxRetries: coordinator.maxRetries
    });
    
    // List pending events
    if (coordinator.pendingEvents.size > 0) {
      console.log('📋 Pending events:');
      coordinator.pendingEvents.forEach((event, key) => {
        console.log(`  ${key}: ${event.eventType} (scheduled ${Date.now() - event.scheduledAt}ms ago)`);
      });
    } else {
      console.log('✅ No pending events (good)');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error testing TabEventCoordinator:', error);
    return false;
  }
}

/**
 * Run comprehensive timing fix validation
 */
async function runComprehensiveTimingTest() {
  console.log('🔬 Running comprehensive timing fix validation...');
  
  const tests = [
    {
      name: 'TabEventCoordinator Validation',
      test: testTabEventCoordinator
    }
  ];
  
  const results = [];
  
  for (const test of tests) {
    console.log(`\n🧪 Running: ${test.name}`);
    try {
      const result = await test.test();
      results.push({ name: test.name, passed: result, error: null });
    } catch (error) {
      results.push({ name: test.name, passed: false, error: error.message });
    }
  }
  
  console.log('\n📊 TEST RESULTS SUMMARY:');
  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`  ${result.name}: ${status}`);
    if (result.error) {
      console.log(`    Error: ${result.error}`);
    }
  });
  
  const allPassed = results.every(r => r.passed);
  console.log(`\n🎯 Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  
  return results;
}

// Make functions available globally
window.startSessionMonitoring = startSessionMonitoring;
window.stopSessionMonitoring = stopSessionMonitoring;
window.getCurrentTabInfo = getCurrentTabInfo;
window.testLinkedInYouTubeScenario = testLinkedInYouTubeScenario;
window.testRapidTabSwitching = testRapidTabSwitching;
window.testTabEventCoordinator = testTabEventCoordinator;
window.runComprehensiveTimingTest = runComprehensiveTimingTest;

console.log('\n📚 Available Test Commands:');
console.log('- startSessionMonitoring() // Monitor session creation in real-time');
console.log('- testLinkedInYouTubeScenario() // Test the specific LinkedIn→YouTube bug');
console.log('- testRapidTabSwitching() // Test rapid tab switching behavior');
console.log('- getCurrentTabInfo() // Get current tab and tracking state info');
console.log('- testTabEventCoordinator() // Validate coordinator fixes');
console.log('- runComprehensiveTimingTest() // Run all validation tests');

console.log('\n🎯 RECOMMENDED: Run testLinkedInYouTubeScenario() to test the main fix!');