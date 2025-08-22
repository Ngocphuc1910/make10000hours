import { fromZonedTime as zonedTimeToUtc, toZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';
import { useUserStore } from '../store/userStore';
import { timezoneUtils } from './timezoneUtils';

/**
 * Robust timezone utilities with comprehensive error handling
 */
export class RobustTimezoneUtils {

  /**
   * Safely get user's setting timezone with fallbacks
   */
  static getUserTimezone(): string {
    try {
      const userStore = useUserStore.getState();
      const userTimezone = userStore.getTimezone();

      // Validate timezone
      if (userTimezone && this.isValidTimezone(userTimezone)) {
        return userTimezone;
      }

      console.warn('Invalid user timezone, falling back to browser detection');
      return this.getBrowserTimezone();

    } catch (error) {
      console.error('Failed to get user timezone:', error);
      return this.getBrowserTimezone();
    }
  }

  /**
   * Safely get browser timezone
   */
  static getBrowserTimezone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (error) {
      console.error('Browser timezone detection failed:', error);
      return 'UTC'; // Ultimate fallback
    }
  }

  /**
   * Validate timezone string
   */
  static isValidTimezone(timezone: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Convert user's date selection to UTC boundaries using their SETTING timezone
   * Handles DST and edge cases safely
   */
  static convertUserDateToUTCBoundaries(
    date: Date,
    userTimezone: string,
    boundary: 'start' | 'end'
  ): string {
    try {
      // Validate inputs
      if (!date || isNaN(date.getTime())) {
        throw new Error('Invalid date provided');
      }

      if (!this.isValidTimezone(userTimezone)) {
        throw new Error(`Invalid timezone: ${userTimezone}`);
      }

      // Create date at boundary in user's timezone
      const year = date.getFullYear();
      const month = date.getMonth();
      const day = date.getDate();

      const boundaryDate = boundary === 'start'
        ? new Date(year, month, day, 0, 0, 0, 0)   // Start of day
        : new Date(year, month, day, 23, 59, 59, 999); // End of day

      // Convert to UTC using date-fns-tz (handles DST correctly)
      const utcDate = zonedTimeToUtc(boundaryDate, userTimezone);

      // Validate result
      if (isNaN(utcDate.getTime())) {
        throw new Error('Timezone conversion resulted in invalid date');
      }

      return utcDate.toISOString();

    } catch (error) {
      console.error(`Failed to convert date to UTC boundary:`, error);
      console.error(`Input: date=${date}, timezone=${userTimezone}, boundary=${boundary}`);

      // Fallback: use UTC boundaries
      const fallbackDate = boundary === 'start'
        ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
        : new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

      return fallbackDate.toISOString();
    }
  }

  /**
   * Get today's date string in user's setting timezone
   */
  static getTodayInUserTimezone(userTimezone?: string): string {
    try {
      const timezone = userTimezone || this.getUserTimezone();
      const now = new Date();
      const todayInUserTz = toZonedTime(now, timezone);
      return format(todayInUserTz, 'yyyy-MM-dd');
    } catch (error) {
      console.error('Failed to get today in user timezone:', error);
      // Fallback to UTC today
      return new Date().toISOString().split('T')[0];
    }
  }
}