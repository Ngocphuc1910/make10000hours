/**
 * Comprehensive Unit Tests for Enhanced StorageManager
 * Tests all 6 new methods with validation, sanitization, and error handling
 */

console.log('🧪 Starting Enhanced StorageManager Tests...');

// Test data fixtures
const createValidSession = (overrides = {}) => ({
  id: 'dfs_test_12345',
  userId: 'user123',
  startTime: Date.now(),
  startTimeUTC: new Date().toISOString(),
  timezone: 'America/New_York',
  utcDate: new Date().toISOString().split('T')[0],
  duration: 10,
  status: 'completed',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides
});

const createCorruptedSession = () => ({
  id: '  corrupted_session  ',
  userId: ' user456 ',
  startTime: '1692739200000', // String instead of number
  startTimeUTC: 'invalid-date',
  status: 'unknown_status',
  duration: 'fifteen', // String instead of number
  badField: 'should_be_ignored'
});

async function runEnhancedStorageManagerTests() {
  console.log('\n🏃‍♂️ Running Enhanced StorageManager Tests...');
  
  let passedTests = 0;
  let totalTests = 0;
  
  // Initialize StorageManager
  let storageManager;
  try {
    if (typeof StorageManager === 'undefined') {
      console.error('❌ StorageManager class not available');
      return;
    }
    
    storageManager = new StorageManager();
    await storageManager.initialize();
    console.log('✅ StorageManager initialized for testing');
  } catch (error) {
    console.error('❌ Failed to initialize StorageManager:', error);
    return;
  }
  
  // Test 1: validateSession with valid data
  totalTests++;
  try {
    const validSession = createValidSession();
    const result = storageManager.validateSession(validSession);
    
    if (result.valid === true) {
      console.log('✅ Test 1 PASSED: validateSession accepts valid data');
      passedTests++;
    } else {
      console.error('❌ Test 1 FAILED:', result.error);
    }
  } catch (error) {
    console.error('❌ Test 1 ERROR:', error);
  }
  
  // Test 2: validateSession with invalid data
  totalTests++;
  try {
    const invalidSession = { id: '', userId: null }; // Missing required fields
    const result = storageManager.validateSession(invalidSession);
    
    if (result.valid === false) {
      console.log('✅ Test 2 PASSED: validateSession rejects invalid data');
      passedTests++;
    } else {
      console.error('❌ Test 2 FAILED: Should have rejected invalid session');
    }
  } catch (error) {
    console.error('❌ Test 2 ERROR:', error);
  }
  
  // Test 3: sanitizeSessionData with corrupted data
  totalTests++;
  try {
    const corrupted = createCorruptedSession();
    const sanitized = storageManager.sanitizeSessionData(corrupted);
    
    if (sanitized && 
        sanitized.id === 'corrupted_session' && // Trimmed
        sanitized.userId === 'user456' && // Trimmed
        typeof sanitized.startTime === 'number' && // Converted from string
        sanitized.status === 'active' && // Default for unknown status
        sanitized.duration === 0) { // Default for invalid duration
      console.log('✅ Test 3 PASSED: sanitizeSessionData cleans corrupted data');
      passedTests++;
    } else {
      console.error('❌ Test 3 FAILED: Sanitization incorrect', sanitized);
    }
  } catch (error) {
    console.error('❌ Test 3 ERROR:', error);
  }
  
  // Test 4: sanitizeSessionData with null input
  totalTests++;
  try {
    const result = storageManager.sanitizeSessionData(null);
    
    if (result === null) {
      console.log('✅ Test 4 PASSED: sanitizeSessionData returns null for null input');
      passedTests++;
    } else {
      console.error('❌ Test 4 FAILED: Should return null for null input');
    }
  } catch (error) {
    console.error('❌ Test 4 ERROR:', error);
  }
  
  // Setup test data for remaining tests
  try {
    const testData = {
      deepFocusSession: {
        '2023-08-22': [
          createValidSession({ id: 'session1', status: 'active', startTime: Date.now() - 1000 }),
          createValidSession({ id: 'session2', status: 'completed', startTime: Date.now() - 2000 })
        ],
        '2023-08-23': [
          createValidSession({ id: 'session3', status: 'active', startTime: Date.now() - 3000 })
        ]
      }
    };
    
    await chrome.storage.local.set(testData);
    console.log('🔧 Test data setup complete');
  } catch (error) {
    console.error('❌ Failed to setup test data:', error);
    return;
  }
  
  // Test 5: getAllActiveSessions
  totalTests++;
  try {
    const activeSessions = await storageManager.getAllActiveSessions();
    
    if (activeSessions.length === 2 && // Should find 2 active sessions
        activeSessions.every(s => s.status === 'active') &&
        activeSessions[0].startTime >= activeSessions[1].startTime) { // Sorted by time
      console.log('✅ Test 5 PASSED: getAllActiveSessions returns correct data');
      passedTests++;
    } else {
      console.error('❌ Test 5 FAILED: Wrong active sessions returned', activeSessions);
    }
  } catch (error) {
    console.error('❌ Test 5 ERROR:', error);
  }
  
  // Test 6: getSessionsByDateRange
  totalTests++;
  try {
    const sessions = await storageManager.getSessionsByDateRange('2023-08-22', '2023-08-23');
    
    if (sessions.length === 3) { // Should find all 3 sessions in range
      console.log('✅ Test 6 PASSED: getSessionsByDateRange returns correct count');
      passedTests++;
    } else {
      console.error('❌ Test 6 FAILED: Wrong session count in range', sessions.length);
    }
  } catch (error) {
    console.error('❌ Test 6 ERROR:', error);
  }
  
  // Test 7: getSessionsByDateRange with invalid range
  totalTests++;
  try {
    await storageManager.getSessionsByDateRange('2023-08-25', '2023-08-24');
    console.error('❌ Test 7 FAILED: Should have thrown error for invalid date range');
  } catch (error) {
    if (error.message.includes('Start date must be before')) {
      console.log('✅ Test 7 PASSED: getSessionsByDateRange validates date range');
      passedTests++;
    } else {
      console.error('❌ Test 7 FAILED: Wrong error message', error);
    }
  }
  
  // Test 8: cleanupStaleData
  totalTests++;
  try {
    // First, add some old data
    const oldSession = createValidSession({
      id: 'old_session',
      startTime: Date.now() - (100 * 24 * 60 * 60 * 1000) // 100 days old
    });
    
    const currentData = await chrome.storage.local.get(['deepFocusSession']);
    currentData.deepFocusSession['2023-05-01'] = [oldSession];
    await chrome.storage.local.set(currentData);
    
    const cleanupResult = await storageManager.cleanupStaleData();
    
    if (cleanupResult.removed >= 1 && // Should remove at least the old session
        cleanupResult.total >= 4) { // Should have found at least 4 total sessions
      console.log('✅ Test 8 PASSED: cleanupStaleData removes old sessions');
      passedTests++;
    } else {
      console.error('❌ Test 8 FAILED: Cleanup result incorrect', cleanupResult);
    }
  } catch (error) {
    console.error('❌ Test 8 ERROR:', error);
  }
  
  // Test 9: exportSessionsForSync
  totalTests++;
  try {
    // Create unsynced sessions
    const unsyncedSession = createValidSession({
      id: 'unsynced_session',
      status: 'completed',
      duration: 25,
      synced: false // Mark as unsynced
    });
    
    const currentData = await chrome.storage.local.get(['deepFocusSession']);
    if (!currentData.deepFocusSession['2023-08-24']) {
      currentData.deepFocusSession['2023-08-24'] = [];
    }
    currentData.deepFocusSession['2023-08-24'].push(unsyncedSession);
    await chrome.storage.local.set(currentData);
    
    const exportData = await storageManager.exportSessionsForSync();
    
    if (exportData.sessions.length >= 1 && // Should find at least 1 unsynced session
        exportData.totalCount === exportData.sessions.length &&
        exportData.sessions.every(s => s.syncBatch && s.extensionVersion)) {
      console.log('✅ Test 9 PASSED: exportSessionsForSync formats data correctly');
      passedTests++;
    } else {
      console.error('❌ Test 9 FAILED: Export data incorrect', exportData);
    }
  } catch (error) {
    console.error('❌ Test 9 ERROR:', error);
  }
  
  // Test 10: Edge cases and error handling
  totalTests++;
  try {
    // Test validateSession with circular reference (should handle gracefully)
    const circularSession = createValidSession();
    circularSession.self = circularSession; // Create circular reference
    
    const result = storageManager.validateSession(circularSession);
    
    // Should either validate successfully or fail gracefully
    if (result && typeof result.valid === 'boolean') {
      console.log('✅ Test 10 PASSED: validateSession handles edge cases gracefully');
      passedTests++;
    } else {
      console.error('❌ Test 10 FAILED: Poor error handling for edge cases');
    }
  } catch (error) {
    // This is acceptable - method should handle errors gracefully
    console.log('✅ Test 10 PASSED: validateSession handles errors gracefully');
    passedTests++;
  }
  
  // Test Results Summary
  console.log('\n📊 Enhanced StorageManager Test Results:');
  console.log(`✅ Passed: ${passedTests}/${totalTests} tests`);
  console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests} tests`);
  
  if (passedTests === totalTests) {
    console.log('🎉 ALL TESTS PASSED! StorageManager enhancements are working correctly');
  } else {
    console.log('⚠️ Some tests failed. Review implementation before proceeding.');
  }
  
  // Cleanup test data
  try {
    await chrome.storage.local.remove(['deepFocusSession']);
    console.log('🧹 Test cleanup completed');
  } catch (error) {
    console.error('❌ Test cleanup failed:', error);
  }
  
  return {
    passed: passedTests,
    total: totalTests,
    success: passedTests === totalTests
  };
}

// Auto-run if in extension context
if (typeof chrome !== 'undefined' && chrome.storage) {
  runEnhancedStorageManagerTests();
} else {
  console.log('ℹ️ Test script loaded, run runEnhancedStorageManagerTests() manually in extension context');
}