/**
 * Enhanced Activity Detection Test Script
 * Verifies sleep/inactivity tracking fixes work correctly
 */

class ActivityTestSuite {
  constructor() {
    this.results = [];
    this.isRunning = false;
    this.testStartTime = null;
  }

  /**
   * Run all critical test scenarios
   */
  async runAllTests() {
    console.log('🧪 Starting Enhanced Activity Detection Test Suite...');
    this.isRunning = true;
    this.testStartTime = Date.now();
    
    const tests = [
      this.testBasicActivityDetection,
      this.testInactivityThreshold,
      this.testVisibilityChanges,
      this.testWindowFocusBlur,
      this.testSessionPauseResume,
      this.testAutoManagementToggle,
      this.testNetTimeCalculation
    ];

    for (const test of tests) {
      try {
        await this.runTest(test.name, test.bind(this));
      } catch (error) {
        this.logResult(test.name, false, `Test failed: ${error.message}`);
      }
    }

    this.printSummary();
    this.isRunning = false;
  }

  /**
   * Run individual test with error handling
   */
  async runTest(testName, testFunction) {
    console.log(`\n🔬 Running test: ${testName}`);
    const startTime = Date.now();
    
    try {
      await testFunction();
      const duration = Date.now() - startTime;
      this.logResult(testName, true, `Completed in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logResult(testName, false, `Failed after ${duration}ms: ${error.message}`);
      throw error;
    }
  }

  /**
   * Test 1: Basic Activity Detection
   */
  async testBasicActivityDetection() {
    // Check if extension responds to activity messages
    const response = await chrome.runtime.sendMessage({
      type: 'GET_ACTIVITY_STATE'
    });

    if (!response?.success) {
      throw new Error('Extension not responding to activity state requests');
    }

    const state = response.data;
    if (!state.hasOwnProperty('isUserActive')) {
      throw new Error('Activity state missing required properties');
    }

    console.log('✅ Basic activity detection working');
  }

  /**
   * Test 2: Inactivity Threshold (5 minutes)
   */
  async testInactivityThreshold() {
    // Send activity data indicating 6 minutes of inactivity
    const sixMinutesAgo = Date.now() - (6 * 60 * 1000);
    
    const activityData = {
      isActive: false,
      lastActivity: sixMinutesAgo,
      timeSinceLastActivity: 6 * 60 * 1000,
      isVisible: true,
      isWindowFocused: true,
      eventType: 'test_inactivity'
    };

    const response = await chrome.runtime.sendMessage({
      type: 'ENHANCED_ACTIVITY_DETECTED',
      payload: activityData
    });

    if (!response?.success) {
      throw new Error('Failed to send inactivity data');
    }

    // Check if session is paused
    await this.sleep(1000); // Wait for processing
    
    const stateResponse = await chrome.runtime.sendMessage({
      type: 'GET_ACTIVITY_STATE'
    });

    if (!stateResponse.data.isSessionPaused) {
      throw new Error('Session should be paused after 6 minutes of inactivity');
    }

    console.log('✅ Inactivity threshold working (session paused)');
  }

  /**
   * Test 3: Visibility Changes
   */
  async testVisibilityChanges() {
    // Simulate page becoming hidden
    const hiddenData = {
      isActive: false,
      isVisible: false,
      isWindowFocused: true,
      eventType: 'test_visibility_hidden'
    };

    let response = await chrome.runtime.sendMessage({
      type: 'ENHANCED_ACTIVITY_DETECTED',
      payload: hiddenData
    });

    if (!response?.success) {
      throw new Error('Failed to handle visibility hidden');
    }

    // Simulate page becoming visible again
    const visibleData = {
      isActive: true,
      isVisible: true,
      isWindowFocused: true,
      eventType: 'test_visibility_visible'
    };

    response = await chrome.runtime.sendMessage({
      type: 'ENHANCED_ACTIVITY_DETECTED',
      payload: visibleData
    });

    if (!response?.success) {
      throw new Error('Failed to handle visibility visible');
    }

    console.log('✅ Visibility changes handled correctly');
  }

  /**
   * Test 4: Window Focus/Blur
   */
  async testWindowFocusBlur() {
    // Test window blur
    const blurData = {
      isActive: false,
      isVisible: true,
      isWindowFocused: false,
      eventType: 'test_window_blur'
    };

    let response = await chrome.runtime.sendMessage({
      type: 'ENHANCED_ACTIVITY_DETECTED',
      payload: blurData
    });

    if (!response?.success) {
      throw new Error('Failed to handle window blur');
    }

    // Test window focus
    const focusData = {
      isActive: true,
      isVisible: true,
      isWindowFocused: true,
      eventType: 'test_window_focus'
    };

    response = await chrome.runtime.sendMessage({
      type: 'ENHANCED_ACTIVITY_DETECTED',
      payload: focusData
    });

    if (!response?.success) {
      throw new Error('Failed to handle window focus');
    }

    console.log('✅ Window focus/blur handled correctly');
  }

  /**
   * Test 5: Session Pause/Resume
   */
  async testSessionPauseResume() {
    // First ensure session is active
    const activeData = {
      isActive: true,
      isVisible: true,
      isWindowFocused: true,
      eventType: 'test_activate'
    };

    await chrome.runtime.sendMessage({
      type: 'ENHANCED_ACTIVITY_DETECTED',
      payload: activeData
    });

    // Simulate inactivity to trigger pause
    const inactiveData = {
      isActive: false,
      timeSinceLastActivity: 6 * 60 * 1000, // 6 minutes
      isVisible: true,
      isWindowFocused: true,
      eventType: 'test_pause'
    };

    await chrome.runtime.sendMessage({
      type: 'ENHANCED_ACTIVITY_DETECTED',
      payload: inactiveData
    });

    await this.sleep(1000);

    // Check if paused
    let stateResponse = await chrome.runtime.sendMessage({
      type: 'GET_ACTIVITY_STATE'
    });

    if (!stateResponse.data.isSessionPaused) {
      throw new Error('Session should be paused');
    }

    // Simulate activity to trigger resume
    const resumeData = {
      isActive: true,
      isVisible: true,
      isWindowFocused: true,
      eventType: 'test_resume'
    };

    await chrome.runtime.sendMessage({
      type: 'ENHANCED_ACTIVITY_DETECTED',
      payload: resumeData
    });

    await this.sleep(1000);

    // Check if resumed
    stateResponse = await chrome.runtime.sendMessage({
      type: 'GET_ACTIVITY_STATE'
    });

    if (stateResponse.data.isSessionPaused) {
      throw new Error('Session should be resumed');
    }

    console.log('✅ Session pause/resume working correctly');
  }

  /**
   * Test 6: Auto-Management Toggle
   */
  async testAutoManagementToggle() {
    // Disable auto-management
    let response = await chrome.runtime.sendMessage({
      type: 'TOGGLE_AUTO_MANAGEMENT',
      payload: { enabled: false }
    });

    if (!response?.success) {
      throw new Error('Failed to disable auto-management');
    }

    // Check state
    let stateResponse = await chrome.runtime.sendMessage({
      type: 'GET_ACTIVITY_STATE'
    });

    if (stateResponse.data.autoManagementEnabled) {
      throw new Error('Auto-management should be disabled');
    }

    // Re-enable auto-management
    response = await chrome.runtime.sendMessage({
      type: 'TOGGLE_AUTO_MANAGEMENT',
      payload: { enabled: true }
    });

    if (!response?.success) {
      throw new Error('Failed to enable auto-management');
    }

    // Check state
    stateResponse = await chrome.runtime.sendMessage({
      type: 'GET_ACTIVITY_STATE'
    });

    if (!stateResponse.data.autoManagementEnabled) {
      throw new Error('Auto-management should be enabled');
    }

    console.log('✅ Auto-management toggle working correctly');
  }

  /**
   * Test 7: Net Time Calculation
   */
  async testNetTimeCalculation() {
    // This test would require actual time tracking
    // For now, just verify the state includes timing information
    const stateResponse = await chrome.runtime.sendMessage({
      type: 'GET_ACTIVITY_STATE'
    });

    const state = stateResponse.data;
    
    if (!state.hasOwnProperty('totalPausedTime')) {
      throw new Error('State should include totalPausedTime');
    }

    if (!state.hasOwnProperty('inactivityDuration')) {
      throw new Error('State should include inactivityDuration');
    }

    console.log('✅ Net time calculation data available');
  }

  /**
   * Mac Sleep Simulation Test
   */
  async testMacSleepSimulation() {
    console.log('\n🛌 Testing Mac Sleep Simulation...');
    
    // Simulate page freeze (Mac sleep)
    const freezeData = {
      isActive: false,
      isVisible: false,
      isWindowFocused: false,
      eventType: 'freeze'
    };

    await chrome.runtime.sendMessage({
      type: 'ENHANCED_ACTIVITY_DETECTED',
      payload: freezeData
    });

    // Wait a bit
    await this.sleep(2000);

    // Simulate page resume (Mac wake)
    const resumeData = {
      isActive: true,
      isVisible: true,
      isWindowFocused: true,
      eventType: 'resume'
    };

    await chrome.runtime.sendMessage({
      type: 'ENHANCED_ACTIVITY_DETECTED',
      payload: resumeData
    });

    console.log('✅ Mac sleep/wake simulation completed');
  }

  /**
   * Helper: Sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log test result
   */
  logResult(testName, passed, message) {
    this.results.push({
      testName,
      passed,
      message,
      timestamp: new Date().toISOString()
    });

    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${testName} - ${message}`);
  }

  /**
   * Print test summary
   */
  printSummary() {
    const totalTime = Date.now() - this.testStartTime;
    const passedTests = this.results.filter(r => r.passed).length;
    const totalTests = this.results.length;
    
    console.log('\n📊 TEST SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${totalTests - passedTests}`);
    console.log(`Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
    console.log(`Total Time: ${totalTime}ms`);
    
    if (passedTests === totalTests) {
      console.log('\n🎉 ALL TESTS PASSED! Enhanced activity detection is working correctly.');
    } else {
      console.log('\n⚠️ Some tests failed. Check the logs above for details.');
    }

    console.log('\n📋 Detailed Results:');
    this.results.forEach((result, index) => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${index + 1}. ${status} ${result.testName}: ${result.message}`);
    });
  }

  /**
   * Manual test instructions
   */
  printManualTestInstructions() {
    console.log('\n📖 MANUAL TESTING INSTRUCTIONS');
    console.log('='.repeat(50));
    console.log('1. MAC SLEEP TEST:');
    console.log('   - Start tracking on a website');
    console.log('   - Close laptop lid for 30+ minutes');
    console.log('   - Open laptop and check time tracking');
    console.log('   - Should exclude sleep time');
    console.log('');
    console.log('2. EXTENDED INACTIVITY TEST:');
    console.log('   - Start tracking');
    console.log('   - Leave computer idle for 10+ minutes');
    console.log('   - Move mouse to resume');
    console.log('   - Check that 5+ minutes were excluded');
    console.log('');
    console.log('3. BROWSER MINIMIZE TEST:');
    console.log('   - Start tracking');
    console.log('   - Minimize browser for 20+ minutes');
    console.log('   - Restore browser');
    console.log('   - Verify pause/resume behavior');
  }
}

// Run tests when script loads
const testSuite = new ActivityTestSuite();

// Auto-run tests if in test environment
if (window.location.search.includes('run_tests=true')) {
  testSuite.runAllTests();
}

// Make test suite available globally for manual testing
window.activityTestSuite = testSuite;

console.log('🧪 Enhanced Activity Detection Test Suite loaded');
console.log('Run tests with: activityTestSuite.runAllTests()');
console.log('Run Mac sleep simulation: activityTestSuite.testMacSleepSimulation()');
console.log('View manual instructions: activityTestSuite.printManualTestInstructions()'); 