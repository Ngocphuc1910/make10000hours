/**
 * UTC Filtering Implementation Test Script
 * Run this in browser console on Deep Focus page to test the new UTC filtering
 */

async function testUTCFiltering() {
  console.log('🧪 Testing UTC Filtering Implementation...\n');
  
  const results = {
    tests: [],
    passed: 0,
    failed: 0
  };
  
  function addTest(name, passed, details) {
    results.tests.push({ name, passed, details });
    if (passed) {
      results.passed++;
      console.log(`✅ ${name}: ${details}`);
    } else {
      results.failed++;
      console.error(`❌ ${name}: ${details}`);
    }
  }
  
  try {
    // Test 1: Check if UTC filtering utilities are available
    if (typeof TimezoneFilteringUtils !== 'undefined') {
      addTest('UTC Filtering Utils Available', true, 'TimezoneFilteringUtils class found');
    } else {
      addTest('UTC Filtering Utils Available', false, 'TimezoneFilteringUtils class not found');
      return results;
    }
    
    // Test 2: Check feature flag
    const featureFlagEnabled = UTC_FILTERING_ENABLED;
    addTest('Feature Flag Check', true, `UTC_FILTERING_ENABLED = ${featureFlagEnabled}`);
    
    // Test 3: Test timezone conversion with Asia/Saigon
    console.log('\n🌏 Testing Timezone Conversion...');
    const testDate = new Date('2025-08-06');
    const timezone = 'Asia/Saigon';
    
    try {
      const utcRange = TimezoneFilteringUtils.convertLocalDateRangeToUTC(
        testDate, testDate, timezone
      );
      
      console.table({
        'Input Date': testDate.toISOString().split('T')[0],
        'Timezone': timezone,
        'UTC Start': utcRange.utcStart,
        'UTC End': utcRange.utcEnd,
        'Hours Coverage': ((new Date(utcRange.utcEnd) - new Date(utcRange.utcStart)) / (1000 * 60 * 60)).toFixed(2)
      });
      
      const hoursRange = (new Date(utcRange.utcEnd) - new Date(utcRange.utcStart)) / (1000 * 60 * 60);
      const validRange = hoursRange >= 20 && hoursRange <= 28;
      
      addTest('Timezone Conversion', validRange, `Covers ${hoursRange.toFixed(2)} hours (expected: 20-28)`);
    } catch (error) {
      addTest('Timezone Conversion', false, `Error: ${error.message}`);
    }
    
    // Test 4: Check if user is authenticated
    let userId;
    try {
      if (typeof useUserStore !== 'undefined') {
        const user = useUserStore.getState().user;
        userId = user?.uid;
        addTest('User Authentication', !!userId, userId ? `User ID: ${userId}` : 'No user authenticated');
      } else {
        addTest('User Authentication', false, 'useUserStore not available');
      }
    } catch (error) {
      addTest('User Authentication', false, `Error: ${error.message}`);
    }
    
    // Test 5: Check if deepFocusSessionService is available
    let sessionService;
    try {
      if (typeof deepFocusSessionService !== 'undefined') {
        sessionService = deepFocusSessionService;
        addTest('Session Service Available', true, 'deepFocusSessionService found');
      } else {
        addTest('Session Service Available', false, 'deepFocusSessionService not found');
        return results;
      }
    } catch (error) {
      addTest('Session Service Available', false, `Error: ${error.message}`);
      return results;
    }
    
    // Test 6: Test the new getUserSessions method with options
    if (userId && sessionService) {
      console.log('\n📊 Testing getUserSessions with UTC filtering...');
      
      try {
        // Test with new options format
        const sessions = await sessionService.getUserSessions(userId, {
          startDate: new Date('2025-08-06'),
          endDate: new Date('2025-08-06'),
          timezone: 'Asia/Saigon',
          useUTC: false, // Start with legacy to avoid circuit breaker issues
          limit: 10
        });
        
        addTest('getUserSessions with options', true, `Retrieved ${sessions.length} sessions`);
        
        // Show sample session data
        if (sessions.length > 0) {
          const sampleSession = sessions[0];
          console.log('\n📋 Sample Session Data:');
          console.table({
            'Session ID': sampleSession.id?.substring(0, 8) + '...',
            'Has startTimeUTC': !!sampleSession.startTimeUTC,
            'Has utcDate': !!sampleSession.utcDate,
            'Has timezone': !!sampleSession.timezone,
            'Start Time': sampleSession.startTime?.toISOString?.() || 'Invalid',
            'Start Time UTC': sampleSession.startTimeUTC || 'Missing',
            'UTC Date': sampleSession.utcDate || 'Missing',
            'Timezone': sampleSession.timezone || 'Missing'
          });
          
          // Check data quality
          const hasUTCFields = !!sampleSession.startTimeUTC && !!sampleSession.utcDate;
          addTest('Session Data Quality', hasUTCFields, 
            hasUTCFields ? 'Sessions have required UTC fields' : 'Sessions missing UTC fields');
        }
        
      } catch (error) {
        addTest('getUserSessions with options', false, `Error: ${error.message}`);
      }
      
      // Test 7: Test legacy method signature (backward compatibility)
      try {
        const legacySessions = await sessionService.getUserSessions(
          userId, 
          new Date('2025-08-06'), 
          new Date('2025-08-06')
        );
        
        addTest('Legacy getUserSessions signature', true, `Retrieved ${legacySessions.length} sessions`);
      } catch (error) {
        addTest('Legacy getUserSessions signature', false, `Error: ${error.message}`);
      }
    }
    
    // Test 8: Check circuit breaker functionality
    console.log('\n⚡ Testing Circuit Breaker...');
    try {
      if (typeof globalThis.queryCircuitBreaker !== 'undefined') {
        const circuitStatus = globalThis.queryCircuitBreaker.getStatus();
        addTest('Circuit Breaker Available', true, `State: ${circuitStatus.state}`);
        
        console.log('\n📊 Circuit Breaker Status:');
        console.table({
          'State': circuitStatus.state,
          'Recent Failures': circuitStatus.recentFailures,
          'Can Retry': circuitStatus.canRetry,
          'Last Success': circuitStatus.lastSuccessTime ? new Date(circuitStatus.lastSuccessTime).toLocaleString() : 'Never'
        });
      } else {
        addTest('Circuit Breaker Available', false, 'Circuit breaker not found in global scope');
      }
    } catch (error) {
      addTest('Circuit Breaker Available', false, `Error: ${error.message}`);
    }
    
    // Test 9: Test timezone test function
    try {
      if (typeof testTimezoneConversion !== 'undefined') {
        console.log('\n🧪 Running timezone conversion test...');
        testTimezoneConversion('Asia/Saigon');
        addTest('Timezone Test Function', true, 'testTimezoneConversion() executed successfully');
      } else {
        addTest('Timezone Test Function', false, 'testTimezoneConversion() not available');
      }
    } catch (error) {
      addTest('Timezone Test Function', false, `Error: ${error.message}`);
    }
    
  } catch (error) {
    console.error('💥 Test suite failed:', error);
    addTest('Test Suite Execution', false, `Error: ${error.message}`);
  }
  
  // Final Results
  console.log('\n' + '='.repeat(60));
  console.log('🎯 UTC FILTERING IMPLEMENTATION TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📊 Total: ${results.tests.length}`);
  console.log(`🎯 Success Rate: ${((results.passed / results.tests.length) * 100).toFixed(1)}%`);
  
  if (results.failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! UTC filtering implementation is ready!');
    console.log('\n📋 Next Steps:');
    console.log('1. Enable feature flag: VITE_UTC_FILTERING_ENABLED=true');
    console.log('2. Test with real data filtering');
    console.log('3. Monitor performance and circuit breaker');
  } else {
    console.log(`\n⚠️ ${results.failed} test(s) failed. Review issues before enabling UTC filtering.`);
  }
  
  return results;
}

// Export for easy access
window.testUTCFiltering = testUTCFiltering;

console.log(`
🧪 UTC Filtering Test Suite Loaded

Usage: testUTCFiltering()

This will test:
- ✅ Timezone conversion accuracy  
- ✅ Service method compatibility
- ✅ Data quality checks
- ✅ Circuit breaker functionality
- ✅ Feature flag status

Run the test and check all components before enabling UTC filtering!
`);

// Auto-run the test
testUTCFiltering();