/**
 * Timezone Filtering Utilities for UTC-based Deep Focus Session Queries
 * 
 * CRITICAL FIX: Uses proper timezone conversion method to avoid showing wrong sessions
 * Fixed based on peer review feedback - previous conversion logic was fundamentally flawed
 */

export interface UTCTimeRange {
  utcStart: string;      // "2025-08-06T17:00:00.000Z" 
  utcEnd: string;        // "2025-08-07T16:59:59.999Z"
  userTimezone: string;  // "Asia/Saigon"
  originalStart: Date;   // Original input date
  originalEnd: Date;     // Original input date
}

export interface SessionQueryOptions {
  startDate?: Date;
  endDate?: Date;
  timezone?: string;
  useUTC?: boolean;
  orderBy?: 'asc' | 'desc';
  limit?: number;
}

// Feature flag for UTC filtering - start disabled for safety
export const UTC_FILTERING_ENABLED = process.env.VITE_UTC_FILTERING_ENABLED === 'true';

/**
 * Core timezone filtering utilities
 */
export class TimezoneFilteringUtils {
  /**
   * 🔥 FIXED - Critical bug from friend's feedback
   * 
   * Converts local date range to UTC time range for Firestore queries.
   * 
   * PREVIOUS (BROKEN) METHOD:
   * const utcTime = new Date(localTime.getTime() - (offset * 60000)); // ❌ WRONG
   * 
   * NEW (CORRECT) METHOD:
   * Uses toLocaleString with sv-SE locale for proper timezone-aware conversion
   */
  static convertLocalDateRangeToUTC(
    startDate: Date, 
    endDate: Date, 
    userTimezone: string
  ): UTCTimeRange {
    try {
      console.log('🌍 Converting date range to UTC:', {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        userTimezone
      });

      // Create start/end of day in local context
      const startOfDay = new Date(startDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(endDate);  
      endOfDay.setHours(23, 59, 59, 999);
      
      console.log('📅 Local date boundaries:', {
        startOfDay: startOfDay.toString(),
        endOfDay: endOfDay.toString()
      });

      // ✅ CORRECT conversion method (friend's suggestion)
      // sv-SE locale gives YYYY-MM-DD HH:mm:ss format which Date constructor handles correctly
      const utcStart = new Date(
        startOfDay.toLocaleString("sv-SE", { timeZone: userTimezone })
      ).toISOString();
      
      const utcEnd = new Date(
        endOfDay.toLocaleString("sv-SE", { timeZone: userTimezone })
      ).toISOString();
      
      console.log('🕐 Converted to UTC:', {
        utcStart,
        utcEnd
      });

      // Validation: Ensure we cover approximately 24 hours
      const hoursDiff = (new Date(utcEnd).getTime() - new Date(utcStart).getTime()) / (1000 * 60 * 60);
      if (hoursDiff < 20 || hoursDiff > 28) {
        console.warn(`⚠️ Unexpected time range: ${hoursDiff.toFixed(2)} hours`, {
          utcStart,
          utcEnd,
          userTimezone
        });
      } else {
        console.log(`✅ Time range validation passed: ${hoursDiff.toFixed(2)} hours`);
      }
      
      const result: UTCTimeRange = {
        utcStart,
        utcEnd,
        userTimezone,
        originalStart: startDate,
        originalEnd: endDate
      };

      return result;
      
    } catch (error) {
      console.error('❌ Timezone conversion failed:', error, {
        startDate,
        endDate,
        userTimezone
      });
      
      // Safe fallback - use UTC dates directly
      const fallbackResult: UTCTimeRange = {
        utcStart: startDate.toISOString(),
        utcEnd: endDate.toISOString(), 
        userTimezone: 'UTC',
        originalStart: startDate,
        originalEnd: endDate
      };
      
      console.warn('🔄 Using fallback conversion:', fallbackResult);
      return fallbackResult;
    }
  }

  /**
   * Helper method to detect user's effective timezone
   * Simplified based on friend's feedback - removed over-engineering
   * 🔧 FIXED: Now properly uses user's saved timezone setting
   */
  static getUserEffectiveTimezone(userSettings?: any): string {
    let timezone: string;
    
    try {
      // 🎯 PRIORITY 1: Try to get from userStore (user's saved timezone setting)
      if (typeof window !== 'undefined' && (window as any).useUserStore) {
        const userStore = (window as any).useUserStore;
        const userTimezone = userStore.getState?.()?.user?.settings?.timezone?.current;
        if (userTimezone) {
          timezone = userTimezone;
          console.log('🌏 Using user\'s saved timezone setting:', timezone);
          return timezone;
        }
      }
      
      // 🎯 PRIORITY 2: Try from passed userSettings parameter
      if (userSettings?.timezone?.current) {
        timezone = userSettings.timezone.current;
        console.log('🌏 Using passed timezone setting:', timezone);
        return timezone;
      }
      
      // 🎯 PRIORITY 3: Try legacy userSettings.timezone
      if (userSettings?.timezone && typeof userSettings.timezone === 'string') {
        timezone = userSettings.timezone;
        console.log('🌏 Using legacy timezone setting:', timezone);
        return timezone;
      }
      
      // 🎯 FALLBACK: Browser detection
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      console.warn('⚠️ Using browser-detected timezone (no user setting found):', timezone);
      
    } catch (error) {
      console.error('❌ Error getting user timezone, using browser detection:', error);
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
    
    return timezone || 'UTC';
  }

  /**
   * Test conversion accuracy for a specific timezone
   * Useful for debugging timezone issues
   */
  static testTimezoneConversion(
    testDate: Date = new Date('2025-08-06'),
    timezone: string = 'Asia/Saigon'
  ): void {
    console.log('\n🧪 Testing Timezone Conversion:');
    console.log(`Input: ${testDate.toISOString().split('T')[0]} in ${timezone}`);
    
    const result = this.convertLocalDateRangeToUTC(testDate, testDate, timezone);
    
    console.table({
      'Original Date': testDate.toISOString().split('T')[0],
      'User Timezone': timezone,
      'UTC Start': result.utcStart,
      'UTC End': result.utcEnd,
      'Hours Covered': ((new Date(result.utcEnd).getTime() - new Date(result.utcStart).getTime()) / (1000 * 60 * 60)).toFixed(2)
    });

    // Test edge cases
    const testCases = [
      { date: new Date('2025-03-10'), name: 'DST Start (US)' },
      { date: new Date('2025-11-03'), name: 'DST End (US)' }, 
      { date: new Date('2024-02-29'), name: 'Leap Year' },
      { date: new Date('2025-12-31'), name: 'Year End' }
    ];

    console.log('\n🔍 Edge Case Tests:');
    testCases.forEach(testCase => {
      const edgeResult = this.convertLocalDateRangeToUTC(testCase.date, testCase.date, timezone);
      console.log(`${testCase.name}: ${edgeResult.utcStart} to ${edgeResult.utcEnd}`);
    });
  }

  /**
   * Validate that a UTC time range makes sense
   */
  static validateUTCRange(range: UTCTimeRange): boolean {
    const startTime = new Date(range.utcStart).getTime();
    const endTime = new Date(range.utcEnd).getTime();
    const hoursDiff = (endTime - startTime) / (1000 * 60 * 60);
    
    const isValid = startTime < endTime && hoursDiff >= 20 && hoursDiff <= 28;
    
    if (!isValid) {
      console.warn('⚠️ Invalid UTC range detected:', {
        range,
        hoursDiff: hoursDiff.toFixed(2),
        issues: [
          startTime >= endTime ? 'Start >= End' : null,
          hoursDiff < 20 ? 'Too short' : null,
          hoursDiff > 28 ? 'Too long' : null
        ].filter(Boolean)
      });
    }
    
    return isValid;
  }

  /**
   * Format UTC timestamp for display in user's timezone
   */
  static formatUTCInUserTimezone(
    utcTimestamp: string,
    userTimezone: string,
    options: Intl.DateTimeFormatOptions = {}
  ): string {
    try {
      const date = new Date(utcTimestamp);
      return date.toLocaleString('en-US', {
        timeZone: userTimezone,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        ...options
      });
    } catch (error) {
      console.error('❌ Failed to format UTC timestamp:', error);
      return utcTimestamp;
    }
  }
}

/**
 * Export test function for easy console debugging
 */
if (typeof window !== 'undefined') {
  (window as any).testTimezoneConversion = (timezone?: string) => {
    TimezoneFilteringUtils.testTimezoneConversion(new Date(), timezone);
  };
}

/**
 * Default session query options
 */
export const DEFAULT_SESSION_QUERY_OPTIONS: Required<SessionQueryOptions> = {
  startDate: new Date(),
  endDate: new Date(), 
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  useUTC: UTC_FILTERING_ENABLED,
  orderBy: 'desc',
  limit: 100
};