/**
 * Comprehensive Timezone Detection Test Suite
 * Tests all aspects of the UTC timezone functionality
 */
import { timezoneUtils, UTCTimezoneService, timezoneMonitoring } from './timezoneUtils';
import { utcFeatureFlags } from '../services/featureFlags';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
  error?: any;
}

interface TestSuite {
  suiteName: string;
  results: TestResult[];
  passed: number;
  failed: number;
}

class TimezoneDetectionTester {
  private results: TestSuite[] = [];
  
  async runAllTests(): Promise<void> {
    console.log('🧪 Starting Timezone Detection Test Suite');
    console.log('===============================================');
    
    await this.testBasicTimezoneDetection();
    await this.testTimezoneConversions();
    await this.testDateBoundariesCalculation();
    await this.testTimezoneContext();
    await this.testSessionGrouping();
    await this.testErrorHandling();
    await this.testFeatureFlags();
    
    this.printSummary();
  }
  
  private async testBasicTimezoneDetection(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Basic Timezone Detection',
      results: [],
      passed: 0,
      failed: 0
    };
    
    // Test 1: Get current timezone
    try {
      const currentTz = timezoneUtils.getCurrentTimezone();
      const isValid = timezoneUtils.isValidTimezone(currentTz);
      
      suite.results.push({
        name: 'Detect current timezone',
        passed: isValid && currentTz !== 'UTC',
        details: `Detected: ${currentTz}, Valid: ${isValid}`
      });
    } catch (error) {
      suite.results.push({
        name: 'Detect current timezone',
        passed: false,
        details: 'Failed to detect timezone',
        error
      });
    }
    
    // Test 2: Fallback handling
    try {
      // Simulate timezone detection failure
      const originalIntl = global.Intl;
      // @ts-ignore - Testing error scenario
      global.Intl = undefined;
      
      const fallbackTz = timezoneUtils.getCurrentTimezone();
      
      // Restore Intl
      global.Intl = originalIntl;
      
      suite.results.push({
        name: 'Fallback to UTC on detection failure',
        passed: fallbackTz === 'UTC',
        details: `Fallback timezone: ${fallbackTz}`
      });
    } catch (error) {
      suite.results.push({
        name: 'Fallback to UTC on detection failure',
        passed: false,
        details: 'Fallback mechanism failed',
        error
      });
    }
    
    // Test 3: Timezone validation
    const testTimezones = [
      { tz: 'America/New_York', expected: true },
      { tz: 'Europe/London', expected: true },
      { tz: 'Asia/Tokyo', expected: true },
      { tz: 'UTC', expected: true },
      { tz: 'Invalid/Timezone', expected: false },
      { tz: '', expected: false },
      { tz: 'America/NonExistent', expected: false }
    ];
    
    for (const { tz, expected } of testTimezones) {
      const isValid = timezoneUtils.isValidTimezone(tz);
      suite.results.push({
        name: `Validate timezone: ${tz}`,
        passed: isValid === expected,
        details: `Expected: ${expected}, Got: ${isValid}`
      });
    }
    
    this.calculateSuiteStats(suite);
    this.results.push(suite);
  }
  
  private async testTimezoneConversions(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Timezone Conversions',
      results: [],
      passed: 0,
      failed: 0
    };
    
    // Test user time to UTC conversion
    try {
      const userTime = new Date('2024-01-15T14:30:00');
      const timezone = 'America/New_York';
      const utcTime = timezoneUtils.userTimeToUTC(userTime, timezone);
      const utcDate = new Date(utcTime);
      const passed = utcDate.getUTCHours() === 19 && utcDate.getUTCMinutes() === 30; // EST is UTC-5
      
      suite.results.push({
        name: 'Convert user time to UTC',
        passed,
        details: `Input: ${userTime}, Timezone: ${timezone}, UTC: ${utcTime}`
      });
    } catch (error) {
      suite.results.push({
        name: 'Convert user time to UTC',
        passed: false,
        details: 'User time to UTC conversion failed',
        error
      });
    }
    
    // Test UTC to user time conversion
    try {
      const utcTimeStr = '2024-07-15T19:30:00.000Z';
      const timezone = 'America/Los_Angeles';
      const localTime = timezoneUtils.utcToUserTime(utcTimeStr, timezone);
      const passed = localTime.getHours() === 12 && localTime.getMinutes() === 30; // PDT is UTC-7
      
      suite.results.push({
        name: 'Convert UTC to user time',
        passed,
        details: `UTC: ${utcTimeStr}, Timezone: ${timezone}, Local: ${localTime}`
      });
    } catch (error) {
      suite.results.push({
        name: 'Convert UTC to user time',
        passed: false,
        details: 'UTC to user time conversion failed',
        error
      });
    }
    
    this.calculateSuiteStats(suite);
    this.results.push(suite);
  }
  
  private async testDateBoundariesCalculation(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Date Boundaries Calculation',
      results: [],
      passed: 0,
      failed: 0
    };
    
    try {
      const testDate = new Date('2024-01-15T10:30:00');
      const timezone = 'America/New_York';
      
      const boundaries = timezoneUtils.getUserDateBoundariesUTC(testDate, timezone);
      
      // Verify start is before end
      const startTime = new Date(boundaries.startUTC);
      const endTime = new Date(boundaries.endUTC);
      
      suite.results.push({
        name: 'Calculate date boundaries',
        passed: startTime < endTime,
        details: `Start: ${boundaries.startUTC}, End: ${boundaries.endUTC}`
      });
      
      // Test today boundaries
      const todayBoundaries = timezoneUtils.getTodayBoundariesUTC(timezone);
      const todayStart = new Date(todayBoundaries.startUTC);
      const todayEnd = new Date(todayBoundaries.endUTC);
      
      suite.results.push({
        name: 'Calculate today boundaries',
        passed: todayStart < todayEnd,
        details: `Today Start: ${todayBoundaries.startUTC}, Today End: ${todayBoundaries.endUTC}`
      });
      
    } catch (error) {
      suite.results.push({
        name: 'Calculate date boundaries',
        passed: false,
        details: 'Boundary calculation failed',
        error
      });
    }
    
    this.calculateSuiteStats(suite);
    this.results.push(suite);
  }
  
  private async testTimezoneContext(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Timezone Context Creation',
      results: [],
      passed: 0,
      failed: 0
    };
    
    try {
      // Test default context
      const defaultContext = timezoneUtils.createTimezoneContext();
      
      suite.results.push({
        name: 'Create default timezone context',
        passed: defaultContext.timezone !== '' && defaultContext.recordedAt instanceof Date,
        details: `Timezone: ${defaultContext.timezone}, Source: ${defaultContext.source}`
      });
      
      // Test manual context
      const manualContext = timezoneUtils.createTimezoneContext('Europe/Paris', 'manual');
      
      suite.results.push({
        name: 'Create manual timezone context',
        passed: manualContext.timezone === 'Europe/Paris' && manualContext.source === 'manual',
        details: `Timezone: ${manualContext.timezone}, Source: ${manualContext.source}`
      });
      
    } catch (error) {
      suite.results.push({
        name: 'Create timezone context',
        passed: false,
        details: 'Context creation failed',
        error
      });
    }
    
    this.calculateSuiteStats(suite);
    this.results.push(suite);
  }
  
  private async testSessionGrouping(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Session Grouping by Local Date',
      results: [],
      passed: 0,
      failed: 0
    };
    
    try {
      const testSessions = [
        { id: '1', startTimeUTC: '2024-01-15T05:00:00.000Z' }, // Midnight EST
        { id: '2', startTimeUTC: '2024-01-15T15:00:00.000Z' }, // 10 AM EST
        { id: '3', startTimeUTC: '2024-01-16T04:59:59.000Z' }, // 11:59 PM EST (same day)
        { id: '4', startTimeUTC: '2024-01-16T05:00:00.000Z' }, // Midnight EST (next day)
      ];
      
      const grouped = timezoneUtils.groupSessionsByLocalDate(testSessions, 'America/New_York');
      const dates = Object.keys(grouped);
      
      suite.results.push({
        name: 'Group sessions by local date',
        passed: dates.length === 2 && grouped['2024-01-15'].length === 3 && grouped['2024-01-16'].length === 1,
        details: `Grouped into ${dates.length} dates: ${dates.join(', ')}`
      });
      
    } catch (error) {
      suite.results.push({
        name: 'Group sessions by local date',
        passed: false,
        details: 'Session grouping failed',
        error
      });
    }
    
    this.calculateSuiteStats(suite);
    this.results.push(suite);
  }
  
  private async testErrorHandling(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Error Handling and Recovery',
      results: [],
      passed: 0,
      failed: 0
    };
    
    // Test invalid timezone handling
    try {
      const utcTime = timezoneUtils.userTimeToUTC(new Date(), 'Invalid/Timezone');
      suite.results.push({
        name: 'Handle invalid timezone in conversion',
        passed: utcTime !== null && utcTime !== undefined,
        details: `Converted to: ${utcTime} (should fallback gracefully)`
      });
    } catch (error) {
      suite.results.push({
        name: 'Handle invalid timezone in conversion',
        passed: false,
        details: 'Error handling failed',
        error
      });
    }
    
    // Test invalid date handling
    try {
      const utcTime = timezoneUtils.userTimeToUTC('invalid-date', 'America/New_York');
      suite.results.push({
        name: 'Handle invalid date in conversion',
        passed: utcTime !== null && utcTime !== undefined,
        details: `Converted invalid date to: ${utcTime}`
      });
    } catch (error) {
      suite.results.push({
        name: 'Handle invalid date in conversion',
        passed: false,
        details: 'Invalid date handling failed',
        error
      });
    }
    
    this.calculateSuiteStats(suite);
    this.results.push(suite);
  }
  
  private async testFeatureFlags(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Feature Flag Integration',
      results: [],
      passed: 0,
      failed: 0
    };
    
    try {
      // Test feature flag availability
      const hasFeatureFlags = typeof utcFeatureFlags.isFeatureEnabled === 'function';
      
      suite.results.push({
        name: 'Feature flags service available',
        passed: hasFeatureFlags,
        details: `Feature flags service: ${hasFeatureFlags ? 'Available' : 'Missing'}`
      });
      
      // Test feature flag for test user
      if (hasFeatureFlags) {
        const testUserId = 'test-user-123';
        const isEnabled = utcFeatureFlags.isFeatureEnabled('utcDataStorage', testUserId);
        
        suite.results.push({
          name: 'Check UTC timezone detection feature flag',
          passed: typeof isEnabled === 'boolean',
          details: `Feature enabled for test user: ${isEnabled}`
        });
      }
      
    } catch (error) {
      suite.results.push({
        name: 'Feature flag integration',
        passed: false,
        details: 'Feature flag test failed',
        error
      });
    }
    
    this.calculateSuiteStats(suite);
    this.results.push(suite);
  }
  
  private calculateSuiteStats(suite: TestSuite): void {
    suite.passed = suite.results.filter(r => r.passed).length;
    suite.failed = suite.results.filter(r => !r.passed).length;
  }
  
  private printSummary(): void {
    console.log('\n📊 Test Results Summary');
    console.log('=======================');
    
    let totalPassed = 0;
    let totalFailed = 0;
    
    this.results.forEach(suite => {
      const passRate = suite.results.length > 0 ? Math.round((suite.passed / suite.results.length) * 100) : 0;
      const status = suite.failed === 0 ? '✅' : suite.passed > suite.failed ? '⚠️' : '❌';
      
      console.log(`${status} ${suite.suiteName}: ${suite.passed}/${suite.results.length} passed (${passRate}%)`);
      
      // Show failed tests
      if (suite.failed > 0) {
        suite.results
          .filter(r => !r.passed)
          .forEach(result => {
            console.log(`   ❌ ${result.name}: ${result.details}`);
            if (result.error) {
              console.log(`      Error: ${result.error.message || result.error}`);
            }
          });
      }
      
      totalPassed += suite.passed;
      totalFailed += suite.failed;
    });
    
    const overallPassRate = totalPassed + totalFailed > 0 ? Math.round((totalPassed / (totalPassed + totalFailed)) * 100) : 0;
    
    console.log('\n📈 Overall Results');
    console.log(`Total Tests: ${totalPassed + totalFailed}`);
    console.log(`Passed: ${totalPassed}`);
    console.log(`Failed: ${totalFailed}`);
    console.log(`Pass Rate: ${overallPassRate}%`);
    
    if (totalFailed === 0) {
      console.log('\n🎉 All timezone detection tests passed!');
    } else if (totalPassed > totalFailed) {
      console.log('\n⚠️  Most tests passed, but some failures need attention.');
    } else {
      console.log('\n🚨 Multiple test failures detected. Timezone system needs fixes.');
    }
  }
}

// Manual timezone change simulation for testing
export const simulateTimezoneChange = {
  /**
   * Simulate a user moving from one timezone to another
   */
  async testTimezoneChangeFlow(
    fromTimezone: string, 
    toTimezone: string, 
    mockUserId: string = 'test-user'
  ) {
    console.log(`🌍 Simulating timezone change: ${fromTimezone} → ${toTimezone}`);
    
    // Create mock user data
    const mockUser = {
      uid: mockUserId,
      timezone: fromTimezone
    };
    
    // Simulate timezone detection change
    const originalGetTimezone = timezoneUtils.getCurrentTimezone;
    timezoneUtils.getCurrentTimezone = () => toTimezone;
    
    try {
      // Test timezone change detection logic
      const currentDetected = timezoneUtils.getCurrentTimezone();
      const userTimezone = mockUser.timezone;
      
      const changeDetected = currentDetected !== userTimezone;
      
      console.log('🔍 Change Detection Results:');
      console.log(`  User's saved timezone: ${userTimezone}`);
      console.log(`  Browser detected timezone: ${currentDetected}`);
      console.log(`  Change detected: ${changeDetected}`);
      
      if (changeDetected) {
        console.log('✅ Timezone change would trigger notification');
        
        // Test conversion between timezones
        const testTime = new Date();
        const utcTime = timezoneUtils.userTimeToUTC(testTime, fromTimezone);
        const newLocalTime = timezoneUtils.utcToUserTime(utcTime, toTimezone);
        
        console.log('🔄 Time Conversion Test:');
        console.log(`  Original time (${fromTimezone}): ${testTime}`);
        console.log(`  UTC time: ${utcTime}`);
        console.log(`  New local time (${toTimezone}): ${newLocalTime}`);
      } else {
        console.log('ℹ️  No timezone change detected');
      }
      
    } finally {
      // Restore original function
      timezoneUtils.getCurrentTimezone = originalGetTimezone;
    }
  },
  
  /**
   * Test timezone change notification hook behavior
   */
  async testNotificationHook(mockUserId: string = 'test-user') {
    console.log('🔔 Testing timezone change notification hook...');
    
    // Note: This would require actual React component testing environment
    // For now, we'll test the core logic
    
    const currentTz = timezoneUtils.getCurrentTimezone();
    const differentTz = currentTz === 'America/New_York' ? 'Europe/London' : 'America/New_York';
    
    console.log(`Current: ${currentTz}, Different: ${differentTz}`);
    
    // Test the hook's core detection logic
    const changeDetected = differentTz !== currentTz;
    const timeSinceLastCheck = Date.now() - (Date.now() - 10 * 60 * 1000); // 10 minutes ago
    const shouldNotify = changeDetected && timeSinceLastCheck > 5 * 60 * 1000;
    
    console.log('🧪 Notification Logic Test:');
    console.log(`  Change detected: ${changeDetected}`);
    console.log(`  Time since last check: ${Math.round(timeSinceLastCheck / 60000)} minutes`);
    console.log(`  Should notify: ${shouldNotify}`);
  }
};

// Export the tester
export const runTimezoneTests = async () => {
  const tester = new TimezoneDetectionTester();
  await tester.runAllTests();
};

// Quick test function for development
export const quickTimezoneTest = () => {
  console.log('🚀 Quick Timezone Test');
  console.log('======================');
  
  const currentTz = timezoneUtils.getCurrentTimezone();
  const isValid = timezoneUtils.isValidTimezone(currentTz);
  const currentUTC = timezoneUtils.getCurrentUTC();
  
  console.log(`Current Timezone: ${currentTz}`);
  console.log(`Is Valid: ${isValid}`);
  console.log(`Current UTC: ${currentUTC}`);
  
  // Test conversion
  const now = new Date();
  const utcTime = timezoneUtils.userTimeToUTC(now, currentTz);
  const backToLocal = timezoneUtils.utcToUserTime(utcTime, currentTz);
  
  console.log(`Local Time: ${now}`);
  console.log(`UTC Time: ${utcTime}`);
  console.log(`Back to Local: ${backToLocal}`);
  console.log(`Round-trip Success: ${Math.abs(now.getTime() - backToLocal.getTime()) < 1000}`);
};