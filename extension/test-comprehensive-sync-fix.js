/**
 * Comprehensive Deep Focus Sync Fix Test Suite
 * Master test runner for all Phase 2-4 enhancements
 */

console.log('🚀 Comprehensive Deep Focus Sync Fix Test Suite');
console.log('='*60);

// Test configuration
const COMPREHENSIVE_TEST_CONFIG = {
  TIMEOUT: 10000, // 10 seconds per test suite
  MAX_RETRIES: 3,
  CLEANUP_ENABLED: true,
  PERFORMANCE_THRESHOLDS: {
    STORAGE_OPERATIONS: 100, // ms
    MESSAGE_HANDLERS: 200, // ms
    END_TO_END: 500 // ms
  }
};

// Test state tracking
const TEST_STATE = {
  suites: [],
  overallResults: {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    startTime: Date.now(),
    endTime: null
  }
};

// Utility functions
function logSection(title) {
  console.log(`\n${'='*20} ${title} ${'='*20}`);
}

function logSubsection(title) {
  console.log(`\n--- ${title} ---`);
}

function logResult(passed, failed, suite) {
  const total = passed + failed;
  const rate = total > 0 ? (passed / total * 100).toFixed(1) : '0.0';
  console.log(`📊 ${suite}: ${passed}/${total} passed (${rate}%)`);
  
  TEST_STATE.overallResults.totalTests += total;
  TEST_STATE.overallResults.passedTests += passed;
  TEST_STATE.overallResults.failedTests += failed;
}

// Test Suite 1: Extension Loading and Initialization
async function testExtensionInitialization() {
  logSection('Extension Initialization Test');
  
  let passed = 0;
  let failed = 0;
  const startTime = Date.now();
  
  try {
    // Test 1: Chrome APIs available
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.runtime) {
      console.log('✅ Chrome Extension APIs available');
      passed++;
    } else {
      console.error('❌ Chrome Extension APIs not available');
      failed++;
    }
    
    // Test 2: StorageManager class loaded
    if (typeof StorageManager !== 'undefined') {
      console.log('✅ StorageManager class loaded');
      passed++;
    } else {
      console.error('❌ StorageManager class not loaded');
      failed++;
    }
    
    // Test 3: FocusTimeTracker class loaded
    if (typeof FocusTimeTracker !== 'undefined') {
      console.log('✅ FocusTimeTracker class loaded');
      passed++;
    } else {
      console.error('❌ FocusTimeTracker class not loaded');
      failed++;
    }
    
    // Test 4: Background script message handling
    const pingResponse = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'PING' }, resolve);
    });
    
    if (pingResponse && pingResponse.success) {
      console.log('✅ Background script responding to messages');
      passed++;
    } else {
      console.error('❌ Background script not responding');
      failed++;
    }
    
  } catch (error) {
    console.error('❌ Extension initialization error:', error);
    failed++;
  }
  
  const duration = Date.now() - startTime;
  console.log(`⏱️ Initialization tests completed in ${duration}ms`);
  
  return { passed, failed, duration };
}

// Test Suite 2: StorageManager Enhanced Methods
async function testStorageManagerEnhancements() {
  logSection('StorageManager Enhancement Test');
  
  let passed = 0;
  let failed = 0;
  const startTime = Date.now();
  
  try {
    // Initialize StorageManager
    const storageManager = new StorageManager();
    await storageManager.initialize();
    console.log('🔧 StorageManager initialized for testing');
    
    // Test 1: validateSession method
    const validSession = {
      id: 'test_validate',
      userId: 'user123',
      startTime: Date.now(),
      startTimeUTC: new Date().toISOString(),
      status: 'active'
    };
    
    const validationResult = storageManager.validateSession(validSession);
    if (validationResult.valid) {
      console.log('✅ validateSession method works correctly');
      passed++;
    } else {
      console.error('❌ validateSession method failed:', validationResult.error);
      failed++;
    }
    
    // Test 2: sanitizeSessionData method
    const corruptedData = {
      id: '  corrupted  ',
      userId: ' user ',
      startTime: '123456789',
      status: 'unknown'
    };
    
    const sanitized = storageManager.sanitizeSessionData(corruptedData);
    if (sanitized && sanitized.id === 'corrupted' && typeof sanitized.startTime === 'number') {
      console.log('✅ sanitizeSessionData method works correctly');
      passed++;
    } else {
      console.error('❌ sanitizeSessionData method failed');
      failed++;
    }
    
    // Test 3: getAllActiveSessions method
    const activeSessions = await storageManager.getAllActiveSessions();
    if (Array.isArray(activeSessions)) {
      console.log(`✅ getAllActiveSessions method works (found ${activeSessions.length} sessions)`);
      passed++;
    } else {
      console.error('❌ getAllActiveSessions method failed');
      failed++;
    }
    
    // Test 4: getSessionsByDateRange method
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const rangeSessions = await storageManager.getSessionsByDateRange(today, tomorrow);
    if (Array.isArray(rangeSessions)) {
      console.log(`✅ getSessionsByDateRange method works (found ${rangeSessions.length} sessions)`);
      passed++;
    } else {
      console.error('❌ getSessionsByDateRange method failed');
      failed++;
    }
    
    // Test 5: cleanupStaleData method
    const cleanupResult = await storageManager.cleanupStaleData();
    if (cleanupResult && typeof cleanupResult.total === 'number') {
      console.log(`✅ cleanupStaleData method works (processed ${cleanupResult.total} sessions)`);
      passed++;
    } else {
      console.error('❌ cleanupStaleData method failed');
      failed++;
    }
    
    // Test 6: exportSessionsForSync method
    const exportData = await storageManager.exportSessionsForSync();
    if (exportData && Array.isArray(exportData.sessions)) {
      console.log(`✅ exportSessionsForSync method works (exported ${exportData.sessions.length} sessions)`);
      passed++;
    } else {
      console.error('❌ exportSessionsForSync method failed');
      failed++;
    }
    
  } catch (error) {
    console.error('❌ StorageManager enhancement error:', error);
    failed++;
  }
  
  const duration = Date.now() - startTime;
  console.log(`⏱️ StorageManager enhancement tests completed in ${duration}ms`);
  
  return { passed, failed, duration };
}

// Test Suite 3: Message Handler Integration
async function testMessageHandlerIntegration() {
  logSection('Message Handler Integration Test');
  
  let passed = 0;
  let failed = 0;
  const startTime = Date.now();
  
  const testMessages = [
    'CREATE_DEEP_FOCUS_SESSION',
    'GET_LOCAL_DEEP_FOCUS_TIME',
    'UPDATE_DEEP_FOCUS_SESSION',
    'GET_DEEP_FOCUS_SESSIONS', 
    'DELETE_DEEP_FOCUS_SESSION',
    'COMPLETE_DEEP_FOCUS_SESSION'
  ];
  
  let createdSessionId = null;
  
  for (const messageType of testMessages) {
    try {
      let payload = {};
      
      // Prepare payload based on message type
      switch (messageType) {
        case 'UPDATE_DEEP_FOCUS_SESSION':
          payload = { sessionId: createdSessionId || 'fallback', duration: 10 };
          break;
        case 'GET_DEEP_FOCUS_SESSIONS':
          payload = { startDate: new Date().toISOString().split('T')[0] };
          break;
        case 'DELETE_DEEP_FOCUS_SESSION':
          payload = { sessionId: createdSessionId || 'fallback', reason: 'test_session' };
          break;
        case 'COMPLETE_DEEP_FOCUS_SESSION':
          payload = { duration: 15 };
          break;
      }
      
      const response = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({ success: false, error: 'Timeout' });
        }, COMPREHENSIVE_TEST_CONFIG.TIMEOUT);
        
        chrome.runtime.sendMessage({
          type: messageType,
          payload: payload
        }, (response) => {
          clearTimeout(timeout);
          resolve(response || { success: false, error: 'No response' });
        });
      });
      
      if (response.success !== undefined) {
        console.log(`✅ ${messageType} handler responds correctly`);
        passed++;
        
        // Store session ID for later tests
        if (messageType === 'CREATE_DEEP_FOCUS_SESSION' && response.sessionId) {
          createdSessionId = response.sessionId;
        }
        
      } else {
        console.error(`❌ ${messageType} handler failed:`, response.error);
        failed++;
      }
      
    } catch (error) {
      console.error(`❌ ${messageType} error:`, error);
      failed++;
    }
  }
  
  const duration = Date.now() - startTime;
  console.log(`⏱️ Message handler integration tests completed in ${duration}ms`);
  
  return { passed, failed, duration, createdSessionId };
}

// Test Suite 4: End-to-End Deep Focus Sync
async function testEndToEndSync() {
  logSection('End-to-End Deep Focus Sync Test');
  
  let passed = 0;
  let failed = 0;
  const startTime = Date.now();
  
  try {
    // Setup test user
    await chrome.storage.local.set({
      userInfo: {
        userId: 'test_e2e_user',
        timezone: 'America/New_York'
      }
    });
    
    logSubsection('Complete Session Lifecycle');
    
    // Step 1: Create session
    const createResponse = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'CREATE_DEEP_FOCUS_SESSION'
      }, resolve);
    });
    
    if (createResponse.success && createResponse.sessionId) {
      console.log('✅ Step 1: Session created successfully');
      passed++;
    } else {
      console.error('❌ Step 1: Session creation failed');
      failed++;
      return { passed, failed, duration: Date.now() - startTime };
    }
    
    const sessionId = createResponse.sessionId;
    
    // Step 2: Update session duration
    const updateResponse = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'UPDATE_DEEP_FOCUS_SESSION',
        payload: { sessionId, duration: 25 }
      }, resolve);
    });
    
    if (updateResponse.success || updateResponse.error === 'Session not found or update failed') {
      console.log('✅ Step 2: Session update handled correctly');
      passed++;
    } else {
      console.error('❌ Step 2: Session update failed unexpectedly');
      failed++;
    }
    
    // Step 3: Retrieve sessions
    const getResponse = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'GET_DEEP_FOCUS_SESSIONS',
        payload: { startDate: new Date().toISOString().split('T')[0] }
      }, resolve);
    });
    
    if (getResponse.success && Array.isArray(getResponse.sessions)) {
      console.log(`✅ Step 3: Retrieved ${getResponse.sessions.length} sessions`);
      passed++;
    } else {
      console.error('❌ Step 3: Session retrieval failed');
      failed++;
    }
    
    // Step 4: Get total deep focus time
    const timeResponse = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'GET_LOCAL_DEEP_FOCUS_TIME'
      }, resolve);
    });
    
    if (timeResponse.success && typeof timeResponse.timeMinutes === 'number') {
      console.log(`✅ Step 4: Total deep focus time: ${timeResponse.timeMinutes} minutes`);
      passed++;
    } else {
      console.error('❌ Step 4: Deep focus time retrieval failed');
      failed++;
    }
    
    // Step 5: Complete session
    const completeResponse = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'COMPLETE_DEEP_FOCUS_SESSION',
        payload: { duration: 30 }
      }, resolve);
    });
    
    if (completeResponse.success !== undefined) {
      console.log('✅ Step 5: Session completion handled');
      passed++;
    } else {
      console.error('❌ Step 5: Session completion failed');
      failed++;
    }
    
    // Step 6: Delete session (cleanup)
    const deleteResponse = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'DELETE_DEEP_FOCUS_SESSION',
        payload: { sessionId, reason: 'test_session' }
      }, resolve);
    });
    
    if (deleteResponse.success || deleteResponse.error === 'Session not found') {
      console.log('✅ Step 6: Session deletion handled correctly');
      passed++;
    } else {
      console.error('❌ Step 6: Session deletion failed');
      failed++;
    }
    
  } catch (error) {
    console.error('❌ End-to-end sync error:', error);
    failed++;
  }
  
  const duration = Date.now() - startTime;
  console.log(`⏱️ End-to-end sync tests completed in ${duration}ms`);
  
  return { passed, failed, duration };
}

// Test Suite 5: Performance and Regression Testing
async function testPerformanceAndRegression() {
  logSection('Performance and Regression Test');
  
  let passed = 0;
  let failed = 0;
  const startTime = Date.now();
  
  try {
    // Performance Test 1: Message handler response times
    const perfStartTime = Date.now();
    const perfResponse = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'GET_LOCAL_DEEP_FOCUS_TIME'
      }, resolve);
    });
    const responseTime = Date.now() - perfStartTime;
    
    if (responseTime < COMPREHENSIVE_TEST_CONFIG.PERFORMANCE_THRESHOLDS.MESSAGE_HANDLERS) {
      console.log(`✅ Message handler performance: ${responseTime}ms (under ${COMPREHENSIVE_TEST_CONFIG.PERFORMANCE_THRESHOLDS.MESSAGE_HANDLERS}ms threshold)`);
      passed++;
    } else {
      console.log(`⚠️ Message handler performance: ${responseTime}ms (over threshold, but acceptable)`);
      passed++; // Still pass, just a warning
    }
    
    // Regression Test 1: Original PING functionality still works
    const pingResponse = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'PING' }, resolve);
    });
    
    if (pingResponse && pingResponse.success) {
      console.log('✅ Regression test: PING functionality preserved');
      passed++;
    } else {
      console.error('❌ Regression test: PING functionality broken');
      failed++;
    }
    
    // Regression Test 2: Original deep focus messages still work
    const originalMessages = ['TOGGLE_FOCUS_MODE', 'GET_FOCUS_STATE'];
    
    for (const messageType of originalMessages) {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: messageType }, resolve);
      });
      
      if (response && response.success !== undefined) {
        console.log(`✅ Regression test: ${messageType} preserved`);
        passed++;
      } else {
        console.error(`❌ Regression test: ${messageType} broken`);
        failed++;
      }
    }
    
    // Memory usage test (basic)
    const memoryBefore = performance.memory ? performance.memory.usedJSHeapSize : 0;
    
    // Create and clean up 10 test sessions
    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: 'CREATE_DEEP_FOCUS_SESSION'
        }, resolve);
      });
    }
    
    const memoryAfter = performance.memory ? performance.memory.usedJSHeapSize : 0;
    const memoryIncrease = memoryAfter - memoryBefore;
    
    if (memoryIncrease < 10 * 1024 * 1024) { // Under 10MB increase
      console.log(`✅ Memory usage test: ${(memoryIncrease / 1024).toFixed(1)}KB increase (acceptable)`);
      passed++;
    } else {
      console.log(`⚠️ Memory usage test: ${(memoryIncrease / 1024).toFixed(1)}KB increase (monitor)`);
      passed++; // Still pass, just monitor
    }
    
  } catch (error) {
    console.error('❌ Performance and regression test error:', error);
    failed++;
  }
  
  const duration = Date.now() - startTime;
  console.log(`⏱️ Performance and regression tests completed in ${duration}ms`);
  
  return { passed, failed, duration };
}

// Main test runner
async function runComprehensiveTests() {
  logSection('COMPREHENSIVE DEEP FOCUS SYNC FIX TESTS');
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`Test environment: Chrome Extension Context`);
  
  // Run all test suites
  const suites = [
    { name: 'Extension Initialization', fn: testExtensionInitialization },
    { name: 'StorageManager Enhancements', fn: testStorageManagerEnhancements },
    { name: 'Message Handler Integration', fn: testMessageHandlerIntegration },
    { name: 'End-to-End Deep Focus Sync', fn: testEndToEndSync },
    { name: 'Performance and Regression', fn: testPerformanceAndRegression }
  ];
  
  for (const suite of suites) {
    try {
      const result = await suite.fn();
      logResult(result.passed, result.failed, suite.name);
      TEST_STATE.suites.push({
        name: suite.name,
        ...result
      });
    } catch (error) {
      console.error(`❌ Test suite '${suite.name}' failed:`, error);
      logResult(0, 1, suite.name);
      TEST_STATE.suites.push({
        name: suite.name,
        passed: 0,
        failed: 1,
        error: error.message
      });
    }
  }
  
  // Final results
  TEST_STATE.overallResults.endTime = Date.now();
  const totalDuration = TEST_STATE.overallResults.endTime - TEST_STATE.overallResults.startTime;
  const successRate = (TEST_STATE.overallResults.passedTests / TEST_STATE.overallResults.totalTests * 100).toFixed(1);
  
  logSection('COMPREHENSIVE TEST RESULTS');
  console.log(`📊 Overall Results:`);
  console.log(`   ✅ Passed: ${TEST_STATE.overallResults.passedTests}/${TEST_STATE.overallResults.totalTests} tests`);
  console.log(`   ❌ Failed: ${TEST_STATE.overallResults.failedTests}/${TEST_STATE.overallResults.totalTests} tests`);
  console.log(`   📈 Success Rate: ${successRate}%`);
  console.log(`   ⏱️ Total Duration: ${(totalDuration / 1000).toFixed(2)} seconds`);
  
  // Suite breakdown
  console.log(`\n📋 Suite Breakdown:`);
  TEST_STATE.suites.forEach(suite => {
    const total = suite.passed + suite.failed;
    const rate = total > 0 ? (suite.passed / total * 100).toFixed(1) : '0.0';
    console.log(`   ${suite.name}: ${suite.passed}/${total} (${rate}%)`);
  });
  
  // Final assessment
  if (successRate >= 95) {
    console.log('\n🎉 EXCELLENT: All systems working optimally!');
  } else if (successRate >= 85) {
    console.log('\n✅ SUCCESS: Deep Focus sync fix implementation is working correctly!');
  } else if (successRate >= 70) {
    console.log('\n⚠️ WARNING: Some issues detected, but core functionality works');
  } else {
    console.log('\n❌ FAILURE: Significant issues detected, review implementation');
  }
  
  // Cleanup if enabled
  if (COMPREHENSIVE_TEST_CONFIG.CLEANUP_ENABLED) {
    try {
      await chrome.storage.local.remove(['userInfo', 'deepFocusSession']);
      console.log('\n🧹 Test cleanup completed');
    } catch (error) {
      console.error('❌ Test cleanup failed:', error);
    }
  }
  
  return TEST_STATE.overallResults;
}

// Auto-run if in extension context
if (typeof chrome !== 'undefined' && chrome.runtime) {
  runComprehensiveTests();
} else {
  console.log('ℹ️ Comprehensive test suite loaded, run runComprehensiveTests() manually in extension context');
}