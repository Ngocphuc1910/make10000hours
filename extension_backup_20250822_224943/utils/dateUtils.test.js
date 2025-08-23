/**
 * Test script for timezone-safe date utilities
 * Run this in browser console to verify the fix works correctly
 */

import { 
  getLocalDateString, 
  getLocalDateStringFromDate, 
  checkDateMigrationNeeded,
  getTimezoneDebugInfo 
} from './dateUtils.js';

/**
 * Test function to verify timezone-safe dates work correctly
 */
function testTimezoneFix() {
  console.log('🧪 Testing Timezone Fix...');
  console.log('========================');
  
  // Get debug information
  const debugInfo = getTimezoneDebugInfo();
  console.log('📊 Timezone Debug Info:', debugInfo);
  
  // Test local date string
  const localDate = getLocalDateString();
  const utcDate = new Date().toISOString().split('T')[0];
  
  console.log('📅 Local Date:', localDate);
  console.log('🌍 UTC Date:', utcDate);
  console.log('🔍 Dates Match:', localDate === utcDate ? '✅ Same' : '❌ Different');
  
  // Test migration check
  const migrationCheck = checkDateMigrationNeeded();
  console.log('🔄 Migration Check:', migrationCheck);
  
  // Test with different dates
  console.log('\n🧪 Testing Date Functions...');
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  
  console.log('Today (local):', getLocalDateStringFromDate(today));
  console.log('Yesterday (local):', getLocalDateStringFromDate(yesterday));
  
  // Simulate different timezones
  console.log('\n🌍 Timezone Simulation...');
  
  // Test edge case: near midnight
  const nearMidnight = new Date();
  nearMidnight.setHours(23, 59, 0, 0);
  console.log('Near midnight (local):', getLocalDateStringFromDate(nearMidnight));
  
  const justAfterMidnight = new Date();
  justAfterMidnight.setHours(0, 1, 0, 0);
  console.log('Just after midnight (local):', getLocalDateStringFromDate(justAfterMidnight));
  
  console.log('\n✅ Timezone fix test completed!');
}

/**
 * Simulate extension data storage with old UTC dates vs new local dates
 */
async function testDataMigration() {
  console.log('\n🔄 Testing Data Migration...');
  console.log('============================');
  
  const utcDate = new Date().toISOString().split('T')[0];
  const localDate = getLocalDateString();
  
  // Simulate old data structure (UTC-based)
  const oldData = {
    stats: {
      [utcDate]: {
        totalTime: 7500000, // 2h 5m in milliseconds
        sitesVisited: 5,
        sites: {
          'example.com': { timeSpent: 3600000, visits: 2 }
        }
      }
    }
  };
  
  console.log('📊 Old UTC-based data:', oldData);
  
  // Simulate new data structure (local-based)
  const newData = {
    stats: {
      [localDate]: {
        totalTime: 0, // Should start fresh for new local date
        sitesVisited: 0,
        sites: {}
      }
    }
  };
  
  console.log('📊 New local-based data:', newData);
  
  // Check if migration is needed
  if (utcDate !== localDate) {
    console.log('🔄 Migration needed! UTC date differs from local date');
    console.log(`   UTC: ${utcDate} → Local: ${localDate}`);
    console.log('   In real extension, this would trigger data migration');
  } else {
    console.log('✅ No migration needed - UTC and local dates match');
  }
}

/**
 * Test the fix in different timezone scenarios
 */
function testTimezoneScenarios() {
  console.log('\n🌍 Testing Timezone Scenarios...');
  console.log('=================================');
  
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset(); // in minutes
  
  console.log(`⏰ Current time: ${now.toLocaleString()}`);
  console.log(`🌍 Timezone offset: ${timezoneOffset} minutes (${timezoneOffset / 60} hours)`);
  
  // Scenarios where UTC != Local date
  const scenarios = [
    { name: 'Tokyo (UTC+9)', offset: -540 },
    { name: 'New York (UTC-5)', offset: 300 },
    { name: 'London (UTC+0)', offset: 0 },
    { name: 'Los Angeles (UTC-8)', offset: 480 },
    { name: 'Sydney (UTC+11)', offset: -660 }
  ];
  
  scenarios.forEach(scenario => {
    // Simulate what UTC date would be for this timezone
    const simulatedUtc = new Date(now.getTime() + (scenario.offset * 60 * 1000));
    const utcDateString = simulatedUtc.toISOString().split('T')[0];
    const localDateString = getLocalDateString(); // Always uses actual local time
    
    console.log(`${scenario.name}:`);
    console.log(`  Simulated UTC date: ${utcDateString}`);
    console.log(`  Actual local date: ${localDateString}`);
    console.log(`  Would need migration: ${utcDateString !== localDateString ? '✅' : '❌'}`);
  });
}

// Export test functions for console use
if (typeof window !== 'undefined') {
  window.testTimezoneFix = testTimezoneFix;
  window.testDataMigration = testDataMigration;
  window.testTimezoneScenarios = testTimezoneScenarios;
  
  console.log('🧪 Timezone test functions loaded!');
  console.log('📋 Available commands:');
  console.log('   - testTimezoneFix()');
  console.log('   - testDataMigration()');
  console.log('   - testTimezoneScenarios()');
}

export { testTimezoneFix, testDataMigration, testTimezoneScenarios };