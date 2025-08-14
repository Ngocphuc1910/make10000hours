/**
 * Tab Detection Reliability Test Script
 * 
 * This script tests the improved tab detection system to validate:
 * 1. Consistent session creation on tab switches
 * 2. Race condition elimination 
 * 3. StateManager recovery functionality
 * 4. Event coordination and debouncing
 * 
 * Copy and paste this into Chrome Extension Console:
 * Right-click extension icon -> Inspect popup -> Console tab -> paste this script
 */

console.log('🧪 Starting tab detection reliability tests...');

window.tabDetectionTest = {
  results: [],
  startTime: Date.now(),
  testCount: 0
};

/**
 * Test 1: Monitor session creation success rate
 */
async function testSessionCreationRate() {
  console.log('\n=== TEST 1: SESSION CREATION SUCCESS RATE ===');
  
  const testDuration = 30000; // 30 seconds
  const startTime = Date.now();
  let tabSwitchCount = 0;
  let sessionCreatedCount = 0;
  let lastSessionCount = 0;
  
  // Get initial session count
  const initialSessions = await getSessionCount();
  lastSessionCount = initialSessions;
  
  console.log('📊 Starting session creation monitoring...');
  console.log('📝 Switch tabs rapidly to test - monitoring for 30 seconds');
  
  // Monitor session creation
  const monitorInterval = setInterval(async () => {
    const currentSessions = await getSessionCount();
    
    if (currentSessions > lastSessionCount) {
      sessionCreatedCount++;
      console.log(`✅ Session created! Total sessions: ${currentSessions} (+${currentSessions - lastSessionCount})`);
      lastSessionCount = currentSessions;
    }
  }, 1000); // Check every second
  
  // Stop monitoring after test duration
  setTimeout(() => {
    clearInterval(monitorInterval);
    
    const successRate = tabSwitchCount > 0 ? (sessionCreatedCount / tabSwitchCount * 100).toFixed(1) : 'N/A';
    
    console.log('\n📊 SESSION CREATION TEST RESULTS:');
    console.log(`  Test Duration: ${testDuration / 1000}s`);
    console.log(`  Sessions Created: ${sessionCreatedCount}`);
    console.log(`  Final Session Count: ${lastSessionCount}`);
    console.log(`  Success Rate: Manual observation required`);
    
    window.tabDetectionTest.results.push({
      test: 'session_creation_rate',
      sessionsCreated: sessionCreatedCount,
      finalCount: lastSessionCount,
      duration: testDuration
    });
    
  }, testDuration);
  
  return new Promise(resolve => {
    setTimeout(resolve, testDuration + 1000);
  });
}

/**
 * Test 2: Check TabEventCoordinator functionality
 */
async function testEventCoordinator() {
  console.log('\n=== TEST 2: EVENT COORDINATOR FUNCTIONALITY ===');
  
  try {
    // Test coordinator by sending rapid events
    console.log('🎯 Testing event coordinator with simulated rapid events...');
    
    // Check if coordinator exists in background
    const coordinatorTest = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ 
        type: 'TEST_COORDINATOR_STATUS' 
      }, (response) => {
        resolve(response || { status: 'unknown' });
      });
    });
    
    console.log('📊 Event Coordinator Status:', coordinatorTest);
    
    // Monitor console for coordinator messages
    console.log('👀 Monitor the background console for:');
    console.log('  - "🎯 TabEventCoordinator initialized with 200ms debounce"');
    console.log('  - "📅 Scheduled [event] with debounce"');
    console.log('  - "🔄 Cancelled pending [event] for debouncing"');
    console.log('  - "✅ Successfully processed [event]"');
    
    window.tabDetectionTest.results.push({
      test: 'event_coordinator',
      status: coordinatorTest.status || 'unknown'
    });
    
  } catch (error) {
    console.error('❌ Event coordinator test failed:', error);
  }
}

/**
 * Test 3: StateManager recovery functionality
 */
async function testStateManagerRecovery() {
  console.log('\n=== TEST 3: STATEMANAGER RECOVERY ===');
  
  try {
    // Check for recovery messages in storage
    const recoveryData = await chrome.storage.local.get(['statemanager-recovery-failed']);
    
    if (recoveryData['statemanager-recovery-failed']) {
      console.warn('⚠️ StateManager recovery failure detected:');
      console.warn('  Timestamp:', new Date(recoveryData['statemanager-recovery-failed'].timestamp));
      console.warn('  Error:', recoveryData['statemanager-recovery-failed'].error);
      console.warn('  Attempts:', recoveryData['statemanager-recovery-failed'].attempts);
    } else {
      console.log('✅ No StateManager recovery failures detected');
    }
    
    // Check for coordinator heartbeat
    const heartbeatData = await chrome.storage.local.get(['tab-coordinator-heartbeat']);
    const heartbeatAge = heartbeatData['tab-coordinator-heartbeat'] ? 
      Date.now() - heartbeatData['tab-coordinator-heartbeat'] : null;
    
    if (heartbeatAge !== null) {
      console.log(`💗 Coordinator heartbeat: ${Math.round(heartbeatAge / 1000)}s ago`);
      if (heartbeatAge < 30000) {
        console.log('✅ Coordinator is active (heartbeat < 30s)');
      } else {
        console.warn('⚠️ Coordinator may be inactive (heartbeat > 30s)');
      }
    } else {
      console.log('⚠️ No coordinator heartbeat found');
    }
    
    window.tabDetectionTest.results.push({
      test: 'statemanager_recovery',
      recoveryFailures: !!recoveryData['statemanager-recovery-failed'],
      heartbeatAge: heartbeatAge
    });
    
  } catch (error) {
    console.error('❌ StateManager recovery test failed:', error);
  }
}

/**
 * Test 4: Rapid tab switching simulation
 */
async function testRapidTabSwitching() {
  console.log('\n=== TEST 4: RAPID TAB SWITCHING ===');
  
  console.log('🏎️ This test requires manual rapid tab switching');
  console.log('📝 Instructions:');
  console.log('  1. Rapidly switch between 3-4 different websites');
  console.log('  2. Switch back and forth quickly (< 1 second intervals)');
  console.log('  3. Do this for about 10 seconds');
  console.log('  4. Then check session creation consistency');
  
  const beforeSessions = await getSessionCount();
  console.log(`📊 Sessions before rapid switching: ${beforeSessions}`);
  
  // Wait for user to perform rapid switching
  await new Promise(resolve => {
    console.log('⏰ You have 15 seconds to perform rapid tab switching...');
    setTimeout(resolve, 15000);
  });
  
  const afterSessions = await getSessionCount();
  const sessionsCreated = afterSessions - beforeSessions;
  
  console.log(`📊 Sessions after rapid switching: ${afterSessions}`);
  console.log(`➕ Sessions created during test: ${sessionsCreated}`);
  
  if (sessionsCreated > 0) {
    console.log('✅ Rapid tab switching created sessions successfully');
  } else {
    console.warn('⚠️ No sessions created during rapid switching - may indicate issues');
  }
  
  window.tabDetectionTest.results.push({
    test: 'rapid_tab_switching',
    sessionsBefore: beforeSessions,
    sessionsAfter: afterSessions,
    sessionsCreated: sessionsCreated
  });
}

/**
 * Test 5: Check for race condition indicators
 */
async function testRaceConditionPrevention() {
  console.log('\n=== TEST 5: RACE CONDITION PREVENTION ===');
  
  try {
    // Check background console for race condition indicators
    console.log('🔍 Checking for race condition prevention indicators...');
    console.log('👀 Look for these messages in background console:');
    console.log('  - "🔄 Cancelled pending [event] for debouncing"');
    console.log('  - "📅 Scheduled [event] with [time]ms debounce"');
    console.log('  - "⚠️ Error processing [event]" followed by retry attempts');
    
    // Check recent session data for duplicate indicators
    const sessions = await chrome.storage.local.get(['site_usage_sessions']);
    const today = new Date().toISOString().split('T')[0];
    const todaySessions = sessions.site_usage_sessions?.[today] || [];
    
    // Look for signs of improved session management
    const domainGroups = {};
    todaySessions.forEach(session => {
      if (!domainGroups[session.domain]) {
        domainGroups[session.domain] = [];
      }
      domainGroups[session.domain].push(session);
    });
    
    let highSessionDomains = 0;
    Object.entries(domainGroups).forEach(([domain, domainSessions]) => {
      if (domainSessions.length > 5) {
        console.log(`⚠️ ${domain}: ${domainSessions.length} sessions (may indicate race conditions)`);
        highSessionDomains++;
      } else {
        console.log(`✅ ${domain}: ${domainSessions.length} sessions (reasonable)`);
      }
    });
    
    if (highSessionDomains === 0) {
      console.log('✅ No domains with excessive session counts detected');
    } else {
      console.warn(`⚠️ ${highSessionDomains} domains with high session counts (>5)`);
    }
    
    window.tabDetectionTest.results.push({
      test: 'race_condition_prevention',
      totalSessions: todaySessions.length,
      domainsWithHighSessions: highSessionDomains,
      uniqueDomains: Object.keys(domainGroups).length
    });
    
  } catch (error) {
    console.error('❌ Race condition test failed:', error);
  }
}

/**
 * Helper function to get current session count
 */
async function getSessionCount() {
  try {
    const sessions = await chrome.storage.local.get(['site_usage_sessions']);
    const today = new Date().toISOString().split('T')[0];
    const todaySessions = sessions.site_usage_sessions?.[today] || [];
    return todaySessions.length;
  } catch (error) {
    console.error('Error getting session count:', error);
    return 0;
  }
}

/**
 * Generate comprehensive test report
 */
function generateTestReport() {
  console.log('\n=== COMPREHENSIVE TEST REPORT ===');
  
  const report = {
    timestamp: new Date().toISOString(),
    testDuration: Date.now() - window.tabDetectionTest.startTime,
    results: window.tabDetectionTest.results,
    summary: {}
  };
  
  console.log('📋 TEST SUMMARY:');
  console.log(`  Test Duration: ${Math.round(report.testDuration / 1000)}s`);
  console.log(`  Tests Completed: ${report.results.length}`);
  
  // Analyze results
  report.results.forEach((result, index) => {
    console.log(`\n📊 Test ${index + 1}: ${result.test}`);
    Object.entries(result).forEach(([key, value]) => {
      if (key !== 'test') {
        console.log(`  ${key}: ${value}`);
      }
    });
  });
  
  console.log('\n💡 RECOMMENDATIONS:');
  
  // Check for issues and provide recommendations
  const raceConditionResult = report.results.find(r => r.test === 'race_condition_prevention');
  if (raceConditionResult && raceConditionResult.domainsWithHighSessions > 0) {
    console.log('  - High session counts detected - monitor for race conditions');
  }
  
  const stateManagerResult = report.results.find(r => r.test === 'statemanager_recovery');
  if (stateManagerResult && stateManagerResult.recoveryFailures) {
    console.log('  - StateManager recovery failures detected - investigate initialization issues');
  }
  
  if (stateManagerResult && (!stateManagerResult.heartbeatAge || stateManagerResult.heartbeatAge > 30000)) {
    console.log('  - Coordinator heartbeat issues - extension may be inactive');
  }
  
  // Store report globally
  window.tabDetectionTest.finalReport = report;
  
  console.log('\n✅ Test complete! Full report available at: window.tabDetectionTest.finalReport');
  
  return report;
}

/**
 * Main test runner
 */
async function runTabDetectionTests() {
  console.log('🚀 Running comprehensive tab detection reliability tests...');
  
  try {
    await testSessionCreationRate();
    await testEventCoordinator();
    await testStateManagerRecovery();
    await testRapidTabSwitching();
    await testRaceConditionPrevention();
    
    const report = generateTestReport();
    
    console.log('\n🎉 All tests completed successfully!');
    return report;
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    return null;
  }
}

// Auto-run the tests
runTabDetectionTests();

// Make functions available globally
window.runTabDetectionTests = runTabDetectionTests;
window.testSessionCreationRate = testSessionCreationRate;
window.generateTestReport = generateTestReport;

console.log('\n📚 Available commands:');
console.log('- runTabDetectionTests() // Run all tests');
console.log('- testSessionCreationRate() // Test session creation only');
console.log('- generateTestReport() // Generate final report');
console.log('- window.tabDetectionTest // Access all test data');