/**
 * Test utility for Override Session LocalStorage functionality
 * Run this in browser console to test the implementation
 */

class OverrideSessionTester {
  constructor() {
    this.testResults = [];
    this.testCount = 0;
  }

  async runAllTests() {
    console.log('🧪 Starting Override Session LocalStorage Tests...');
    console.log('============================================');
    
    try {
      // Test 1: Basic override session recording
      await this.testBasicOverrideRecording();
      
      // Test 2: Local storage retrieval
      await this.testLocalStorageRetrieval();
      
      // Test 3: Override time calculation
      await this.testOverrideTimeCalculation();
      
      // Test 4: Cross-page functionality
      await this.testCrossPageFunctionality();
      
      // Test 5: Data persistence
      await this.testDataPersistence();
      
      // Test 6: Cleanup functionality
      await this.testCleanupFunctionality();
      
      // Test 7: Debug information
      await this.testDebugInfo();
      
      // Show test results
      this.showTestResults();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
    }
  }

  async testBasicOverrideRecording() {
    console.log('\n🧪 Test 1: Basic Override Session Recording');
    
    try {
      // Simulate override session recording
      const response = await chrome.runtime.sendMessage({
        type: 'RECORD_OVERRIDE_SESSION',
        payload: {
          domain: 'test-domain.com',
          url: 'https://test-domain.com/page',
          duration: 5, // 5 minutes
          reason: 'testing'
        }
      });
      
      this.assertEqual(response.success, true, 'Override session should be recorded successfully');
      this.assertExists(response.localStorage, 'localStorage result should exist');
      this.assertEqual(response.localStorage.success, true, 'localStorage save should be successful');
      
      console.log('✅ Test 1 passed: Basic override recording works');
    } catch (error) {
      console.error('❌ Test 1 failed:', error);
      this.testResults.push({ name: 'Basic Override Recording', passed: false, error: error.message });
    }
  }

  async testLocalStorageRetrieval() {
    console.log('\n🧪 Test 2: Local Storage Retrieval');
    
    try {
      // Test getting override time
      const timeResponse = await chrome.runtime.sendMessage({
        type: 'GET_LOCAL_OVERRIDE_TIME'
      });
      
      this.assertEqual(timeResponse.success, true, 'Should get override time successfully');
      this.assertExists(timeResponse.data, 'Override time data should exist');
      this.assertGreaterThanOrEqual(timeResponse.data.overrideTime, 0, 'Override time should be non-negative');
      
      // Test getting override sessions
      const sessionsResponse = await chrome.runtime.sendMessage({
        type: 'GET_LOCAL_OVERRIDE_SESSIONS'
      });
      
      this.assertEqual(sessionsResponse.success, true, 'Should get override sessions successfully');
      this.assertExists(sessionsResponse.data, 'Override sessions data should exist');
      this.assertArray(sessionsResponse.data.sessions, 'Sessions should be an array');
      
      console.log('✅ Test 2 passed: Local storage retrieval works');
    } catch (error) {
      console.error('❌ Test 2 failed:', error);
      this.testResults.push({ name: 'Local Storage Retrieval', passed: false, error: error.message });
    }
  }

  async testOverrideTimeCalculation() {
    console.log('\n🧪 Test 3: Override Time Calculation');
    
    try {
      // Add a few more override sessions
      const domains = ['test1.com', 'test2.com', 'test3.com'];
      const durations = [3, 7, 2]; // minutes
      
      for (let i = 0; i < domains.length; i++) {
        await chrome.runtime.sendMessage({
          type: 'RECORD_OVERRIDE_SESSION',
          payload: {
            domain: domains[i],
            duration: durations[i],
            reason: 'testing'
          }
        });
      }
      
      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Get total override time
      const timeResponse = await chrome.runtime.sendMessage({
        type: 'GET_LOCAL_OVERRIDE_TIME'
      });
      
      this.assertEqual(timeResponse.success, true, 'Should calculate override time successfully');
      const totalExpected = 5 + 3 + 7 + 2; // Including the first test
      this.assertGreaterThanOrEqual(timeResponse.data.overrideTime, totalExpected, 
        `Override time should be at least ${totalExpected} minutes`);
      
      console.log('✅ Test 3 passed: Override time calculation works');
    } catch (error) {
      console.error('❌ Test 3 failed:', error);
      this.testResults.push({ name: 'Override Time Calculation', passed: false, error: error.message });
    }
  }

  async testCrossPageFunctionality() {
    console.log('\n🧪 Test 4: Cross-page Functionality');
    
    try {
      // This test verifies that override sessions are stored regardless of which page initiated them
      const response = await chrome.runtime.sendMessage({
        type: 'RECORD_OVERRIDE_SESSION',
        payload: {
          domain: 'cross-page-test.com',
          duration: 10,
          reason: 'cross_page_test'
        }
      });
      
      this.assertEqual(response.success, true, 'Cross-page override should be recorded');
      
      // Verify it's stored in localStorage
      const sessionsResponse = await chrome.runtime.sendMessage({
        type: 'GET_LOCAL_OVERRIDE_SESSIONS'
      });
      
      const testSession = sessionsResponse.data.sessions.find(s => s.domain === 'cross-page-test.com');
      this.assertExists(testSession, 'Cross-page test session should exist in localStorage');
      
      console.log('✅ Test 4 passed: Cross-page functionality works');
    } catch (error) {
      console.error('❌ Test 4 failed:', error);
      this.testResults.push({ name: 'Cross-page Functionality', passed: false, error: error.message });
    }
  }

  async testDataPersistence() {
    console.log('\n🧪 Test 5: Data Persistence');
    
    try {
      // Get current session count
      const beforeResponse = await chrome.runtime.sendMessage({
        type: 'GET_LOCAL_OVERRIDE_SESSIONS'
      });
      
      const beforeCount = beforeResponse.data.sessions.length;
      
      // Add new session
      await chrome.runtime.sendMessage({
        type: 'RECORD_OVERRIDE_SESSION',
        payload: {
          domain: 'persistence-test.com',
          duration: 1,
          reason: 'persistence_test'
        }
      });
      
      // Verify count increased
      const afterResponse = await chrome.runtime.sendMessage({
        type: 'GET_LOCAL_OVERRIDE_SESSIONS'
      });
      
      const afterCount = afterResponse.data.sessions.length;
      this.assertEqual(afterCount, beforeCount + 1, 'Session count should increase by 1');
      
      console.log('✅ Test 5 passed: Data persistence works');
    } catch (error) {
      console.error('❌ Test 5 failed:', error);
      this.testResults.push({ name: 'Data Persistence', passed: false, error: error.message });
    }
  }

  async testCleanupFunctionality() {
    console.log('\n🧪 Test 6: Cleanup Functionality');
    
    try {
      // Test cleanup (should not delete recent sessions)
      const cleanupResponse = await chrome.runtime.sendMessage({
        type: 'CLEANUP_OLD_OVERRIDE_SESSIONS',
        payload: { daysToKeep: 30 }
      });
      
      this.assertEqual(cleanupResponse.success, true, 'Cleanup should execute successfully');
      
      // Verify recent sessions are still there
      const sessionsResponse = await chrome.runtime.sendMessage({
        type: 'GET_LOCAL_OVERRIDE_SESSIONS'
      });
      
      this.assertGreaterThan(sessionsResponse.data.sessions.length, 0, 'Recent sessions should remain after cleanup');
      
      console.log('✅ Test 6 passed: Cleanup functionality works');
    } catch (error) {
      console.error('❌ Test 6 failed:', error);
      this.testResults.push({ name: 'Cleanup Functionality', passed: false, error: error.message });
    }
  }

  async testDebugInfo() {
    console.log('\n🧪 Test 7: Debug Information');
    
    try {
      const debugResponse = await chrome.runtime.sendMessage({
        type: 'GET_OVERRIDE_DEBUG_INFO'
      });
      
      this.assertEqual(debugResponse.success, true, 'Debug info should be retrieved successfully');
      this.assertExists(debugResponse.data, 'Debug data should exist');
      this.assertExists(debugResponse.data.totalSessions, 'Total sessions count should exist');
      this.assertExists(debugResponse.data.totalDates, 'Total dates count should exist');
      
      console.log('📊 Debug Info:', debugResponse.data);
      console.log('✅ Test 7 passed: Debug information works');
    } catch (error) {
      console.error('❌ Test 7 failed:', error);
      this.testResults.push({ name: 'Debug Information', passed: false, error: error.message });
    }
  }

  // Helper assertion methods
  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message}: expected ${expected}, got ${actual}`);
    }
  }

  assertExists(value, message) {
    if (value === null || value === undefined) {
      throw new Error(`${message}: value should exist`);
    }
  }

  assertArray(value, message) {
    if (!Array.isArray(value)) {
      throw new Error(`${message}: value should be an array`);
    }
  }

  assertGreaterThan(actual, expected, message) {
    if (actual <= expected) {
      throw new Error(`${message}: ${actual} should be greater than ${expected}`);
    }
  }

  assertGreaterThanOrEqual(actual, expected, message) {
    if (actual < expected) {
      throw new Error(`${message}: ${actual} should be greater than or equal to ${expected}`);
    }
  }

  showTestResults() {
    console.log('\n🎯 Test Results Summary');
    console.log('======================');
    
    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.filter(r => !r.passed).length;
    const total = 7; // Total number of tests
    
    console.log(`✅ Tests passed: ${total - failed}/${total}`);
    console.log(`❌ Tests failed: ${failed}/${total}`);
    
    if (failed > 0) {
      console.log('\nFailed tests:');
      this.testResults.filter(r => !r.passed).forEach(test => {
        console.log(`  ❌ ${test.name}: ${test.error}`);
      });
    }
    
    if (failed === 0) {
      console.log('\n🎉 All tests passed! Override session localStorage is working correctly.');
    }
  }

  // Quick test method for manual verification
  async quickTest() {
    console.log('🧪 Quick Test: Override Session LocalStorage');
    
    try {
      // Record a test override
      const recordResponse = await chrome.runtime.sendMessage({
        type: 'RECORD_OVERRIDE_SESSION',
        payload: {
          domain: 'quick-test.com',
          duration: 5,
          reason: 'quick_test'
        }
      });
      
      console.log('📝 Record response:', recordResponse);
      
      // Get override time
      const timeResponse = await chrome.runtime.sendMessage({
        type: 'GET_LOCAL_OVERRIDE_TIME'
      });
      
      console.log('⏱️ Override time:', timeResponse.data.overrideTime + ' minutes');
      
      // Get sessions
      const sessionsResponse = await chrome.runtime.sendMessage({
        type: 'GET_LOCAL_OVERRIDE_SESSIONS'
      });
      
      console.log('📋 Today\'s sessions:', sessionsResponse.data.sessions.length);
      
      console.log('✅ Quick test completed successfully!');
    } catch (error) {
      console.error('❌ Quick test failed:', error);
    }
  }
}

// Export for use in console
if (typeof window !== 'undefined') {
  window.OverrideSessionTester = OverrideSessionTester;
  
  // Provide easy access methods
  window.testOverrideSessions = async () => {
    const tester = new OverrideSessionTester();
    await tester.runAllTests();
  };
  
  window.quickTestOverride = async () => {
    const tester = new OverrideSessionTester();
    await tester.quickTest();
  };
  
  console.log('🧪 Override Session Tester loaded!');
  console.log('Run testOverrideSessions() to run all tests');
  console.log('Run quickTestOverride() for a quick test');
} 