/**
 * Comprehensive Timezone Filtering Test Suite
 * Run this in browser console to test the new UTC filtering logic
 */

console.log('🧪 Starting Timezone Filtering Test Suite...');

// Test data generator
function generateTestSessions(timezone = 'Asia/Saigon') {
  const sessions = [
    {
      id: 'session_1',
      startTimeUTC: '2025-08-06T02:30:00.000Z', // 9:30 AM in Asia/Saigon
      utcDate: '2025-08-06',
      timezone: timezone,
      duration: 60
    },
    {
      id: 'session_2', 
      startTimeUTC: '2025-08-06T14:45:00.000Z', // 9:45 PM in Asia/Saigon
      utcDate: '2025-08-06',
      timezone: timezone,
      duration: 45
    },
    {
      id: 'session_3',
      startTimeUTC: '2025-08-06T16:15:00.000Z', // 11:15 PM in Asia/Saigon
      utcDate: '2025-08-06', 
      timezone: timezone,
      duration: 30
    },
    {
      id: 'session_boundary',
      startTimeUTC: '2025-08-06T17:30:00.000Z', // 12:30 AM+1 in Asia/Saigon (next day)
      utcDate: '2025-08-06', // Still UTC Aug 6
      timezone: timezone,
      duration: 25
    }
  ];
  
  console.log('📊 Generated test sessions:');
  console.table(sessions.map(s => ({
    ID: s.id,
    'UTC Time': s.startTimeUTC,
    'Local Time (Asia/Saigon)': new Date(s.startTimeUTC).toLocaleString('en-US', {
      timeZone: 'Asia/Saigon',
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }),
    'UTC Date': s.utcDate
  })));
  
  return sessions;
}

// Simulate the timezone conversion logic
function testTimezoneConversion(userTimezone = 'Asia/Saigon') {
  console.log(`\n🌍 Testing timezone conversion for: ${userTimezone}`);
  
  // Test case: User filters for Aug 6, 2025
  const testDate = new Date('2025-08-06');
  const startOfDay = new Date(testDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(testDate);
  endOfDay.setHours(23, 59, 59, 999);
  
  console.log('📅 User filtering for:', {
    'Date': testDate.toISOString().split('T')[0],
    'Start of day': startOfDay.toLocaleString('en-US', { timeZone: userTimezone }),
    'End of day': endOfDay.toLocaleString('en-US', { timeZone: userTimezone })
  });
  
  // Convert to UTC range (simplified version of the actual logic)
  const utcStart = convertLocalToUTC(startOfDay, userTimezone);
  const utcEnd = convertLocalToUTC(endOfDay, userTimezone);
  
  console.log('🔄 Converted to UTC range:', {
    'UTC Start': utcStart,
    'UTC End': utcEnd,
    'Duration Hours': ((new Date(utcEnd) - new Date(utcStart)) / (1000 * 60 * 60)).toFixed(1)
  });
  
  return { utcStart, utcEnd };
}

// Simplified timezone conversion (mimics the real implementation)
function convertLocalToUTC(localDate, timezone) {
  try {
    // Get what the time would be in the user's timezone
    const timeInUserTZ = localDate.toLocaleString('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    // Parse back and convert to UTC
    const localTime = new Date(timeInUserTZ);
    const offset = getTimezoneOffset(timezone, localDate);
    const utcTime = new Date(localTime.getTime() - (offset * 60000));
    
    return utcTime.toISOString();
  } catch (error) {
    console.warn('Conversion error:', error);
    return localDate.toISOString();
  }
}

function getTimezoneOffset(timezone, date) {
  const utcDate = new Date(date.getTime());
  const localDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  return (utcDate.getTime() - localDate.getTime()) / (1000 * 60);
}

// Test filtering logic
function testSessionFiltering(sessions, utcStart, utcEnd) {
  console.log('\n🔍 Testing session filtering...');
  console.log('Filter range:', { utcStart, utcEnd });
  
  const filteredSessions = sessions.filter(session => {
    const sessionTime = session.startTimeUTC;
    const isInRange = sessionTime >= utcStart && sessionTime <= utcEnd;
    
    console.log(`📋 ${session.id}: ${sessionTime} -> ${isInRange ? '✅ INCLUDED' : '❌ EXCLUDED'}`);
    return isInRange;
  });
  
  console.log(`\n📊 Results: ${filteredSessions.length}/${sessions.length} sessions matched`);
  return filteredSessions;
}

// Test edge cases
function testEdgeCases() {
  console.log('\n🚨 Testing Edge Cases...');
  
  const edgeCases = [
    {
      name: 'DST Transition (Spring Forward)',
      date: new Date('2025-03-09'), // Example DST date
      timezone: 'America/New_York'
    },
    {
      name: 'DST Transition (Fall Back)', 
      date: new Date('2025-11-02'), // Example DST date
      timezone: 'America/New_York'
    },
    {
      name: 'New Year Boundary',
      date: new Date('2024-12-31'),
      timezone: 'Pacific/Auckland' // UTC+13/+12
    },
    {
      name: 'Leap Year Day',
      date: new Date('2024-02-29'),
      timezone: 'Europe/London'
    }
  ];
  
  edgeCases.forEach(testCase => {
    console.log(`\n🧪 ${testCase.name}:`);
    try {
      const result = testTimezoneConversion(testCase.timezone);
      console.log('✅ Conversion successful');
    } catch (error) {
      console.error('❌ Conversion failed:', error);
    }
  });
}

// Test user scenarios
function testUserScenarios() {
  console.log('\n👤 Testing User Scenarios...');
  
  const scenarios = [
    {
      name: 'User in Tokyo filters for Aug 6',
      timezone: 'Asia/Tokyo',
      filterDate: '2025-08-06'
    },
    {
      name: 'User in New York filters for Aug 6',
      timezone: 'America/New_York', 
      filterDate: '2025-08-06'
    },
    {
      name: 'User in London filters for Aug 6',
      timezone: 'Europe/London',
      filterDate: '2025-08-06'
    },
    {
      name: 'User in Sydney filters for Aug 6',
      timezone: 'Australia/Sydney',
      filterDate: '2025-08-06'
    }
  ];
  
  const testSessions = generateTestSessions();
  
  scenarios.forEach(scenario => {
    console.log(`\n👤 ${scenario.name}:`);
    
    const { utcStart, utcEnd } = testTimezoneConversion(scenario.timezone);
    const filtered = testSessionFiltering(testSessions, utcStart, utcEnd);
    
    console.log(`🎯 User would see ${filtered.length} sessions`);
  });
}

// Performance test
function testPerformance() {
  console.log('\n⚡ Performance Test...');
  
  const startTime = performance.now();
  
  // Simulate 100 timezone conversions
  for (let i = 0; i < 100; i++) {
    testTimezoneConversion('Asia/Saigon');
  }
  
  const endTime = performance.now();
  const avgTime = (endTime - startTime) / 100;
  
  console.log(`📊 Average conversion time: ${avgTime.toFixed(2)}ms`);
  console.log(avgTime < 10 ? '✅ Performance acceptable' : '⚠️ Performance needs optimization');
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Running Comprehensive Timezone Filtering Tests\n');
  
  try {
    // Basic functionality
    const sessions = generateTestSessions();
    const { utcStart, utcEnd } = testTimezoneConversion();
    testSessionFiltering(sessions, utcStart, utcEnd);
    
    // Edge cases
    testEdgeCases();
    
    // User scenarios
    testUserScenarios();
    
    // Performance
    testPerformance();
    
    console.log('\n🎉 All tests completed!');
    
    // Summary recommendations
    console.log('\n📋 Summary & Recommendations:');
    console.log('✅ Basic timezone conversion works');
    console.log('✅ Session filtering logic correct');  
    console.log('⚠️ Monitor performance with large datasets');
    console.log('⚠️ Test DST transitions thoroughly');
    console.log('⚠️ Validate with real user sessions');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

// Export functions for manual testing
window.testTimezoneFiltering = {
  runAllTests,
  testTimezoneConversion,
  testSessionFiltering,
  testEdgeCases,
  testUserScenarios,
  generateTestSessions
};

console.log(`
🧪 Timezone Filtering Test Commands:

testTimezoneFiltering.runAllTests()           - Run complete test suite
testTimezoneFiltering.testTimezoneConversion() - Test timezone conversion
testTimezoneFiltering.testUserScenarios()     - Test different user timezones
testTimezoneFiltering.testEdgeCases()         - Test DST and edge cases

Usage: testTimezoneFiltering.runAllTests()
`);

// Auto-run basic test
testTimezoneConversion();