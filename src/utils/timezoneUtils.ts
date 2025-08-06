import { fromZonedTime, toZonedTime, formatInTimeZone } from 'date-fns-tz';
import { startOfDay, endOfDay, parseISO, format } from 'date-fns';

interface TimezoneContext {
  timezone: string;
  utcOffset: number;
  isDST: boolean;
  recordedAt: Date;
  source: 'browser' | 'manual' | 'extension' | 'migrated' | 'fallback';
}

export class UTCTimezoneService {
  private static instance: UTCTimezoneService;
  private timezoneCache = new Map<string, TimezoneContext>();
  
  static getInstance(): UTCTimezoneService {
    if (!UTCTimezoneService.instance) {
      UTCTimezoneService.instance = new UTCTimezoneService();
    }
    return UTCTimezoneService.instance;
  }
  
  /**
   * Get current time in UTC (for storage)
   */
  getCurrentUTC(): string {
    return new Date().toISOString();
  }
  
  /**
   * Safe timezone detection with fallbacks
   */
  getCurrentTimezone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (error) {
      console.warn('Timezone detection failed, falling back to UTC:', error);
      return 'UTC';
    }
  }
  
  /**
   * Convert user's local time to UTC for storage
   */
  userTimeToUTC(userTime: string | Date, timezone: string): string {
    try {
      const date = typeof userTime === 'string' ? new Date(userTime) : userTime;
      return fromZonedTime(date, timezone).toISOString();
    } catch (error) {
      console.warn('Timezone conversion failed, using UTC:', error);
      return new Date(userTime).toISOString();
    }
  }
  
  /**
   * Convert UTC time to user's timezone for display
   */
  utcToUserTime(utcTime: string, timezone: string): Date {
    try {
      // Validate inputs
      if (!utcTime || typeof utcTime !== 'string') {
        throw new Error(`Invalid utcTime parameter: ${utcTime}`);
      }
      
      if (!timezone || typeof timezone !== 'string') {
        throw new Error(`Invalid timezone parameter: ${timezone}`);
      }
      
      // Validate UTC time format
      const utcDate = new Date(utcTime);
      if (isNaN(utcDate.getTime())) {
        throw new Error(`Invalid UTC time string: ${utcTime}`);
      }
      
      // Attempt conversion
      const result = toZonedTime(utcTime, timezone);
      
      // Validate result
      if (isNaN(result.getTime())) {
        throw new Error(`Conversion resulted in invalid date: ${utcTime} to ${timezone}`);
      }
      
      return result;
    } catch (error) {
      console.warn('UTC conversion failed:', {
        utcTime,
        timezone,
        error: error.message
      });
      
      // Fallback to parsing as local time
      const fallbackDate = new Date(utcTime);
      if (isNaN(fallbackDate.getTime())) {
        // Last resort - return current time
        console.error('Critical timezone conversion failure, returning current time');
        return new Date();
      }
      
      return fallbackDate;
    }
  }
  
  /**
   * Smart formatting with fallbacks
   */
  formatInTimezone(utcTime: string, timezone: string, formatStr: string = 'PPp'): string {
    try {
      const localTime = this.utcToUserTime(utcTime, timezone);
      return format(localTime, formatStr);
    } catch (error) {
      console.warn('Timezone formatting failed, using basic format:', error);
      return new Date(utcTime).toLocaleString();
    }
  }
  
  /**
   * Get UTC boundaries for a user's local date
   */
  getUserDateBoundariesUTC(localDate: Date, timezone: string): {
    startUTC: string;
    endUTC: string;
  } {
    try {
      const startOfDayLocal = startOfDay(localDate);
      const startUTC = this.userTimeToUTC(startOfDayLocal, timezone);
      
      const endOfDayLocal = endOfDay(localDate);
      const endUTC = this.userTimeToUTC(endOfDayLocal, timezone);
      
      return { startUTC, endUTC };
    } catch (error) {
      console.warn('Failed to calculate date boundaries:', error);
      return {
        startUTC: startOfDay(localDate).toISOString(),
        endUTC: endOfDay(localDate).toISOString()
      };
    }
  }
  
  /**
   * Get "today" boundaries for user's timezone
   */
  getTodayBoundariesUTC(timezone: string): { startUTC: string; endUTC: string } {
    const now = new Date();
    const userToday = this.utcToUserTime(now.toISOString(), timezone);
    return this.getUserDateBoundariesUTC(userToday, timezone);
  }
  
  /**
   * Format date in specific timezone
   */
  formatDateInTimezone(date: Date, timezone: string, formatStr: string): string {
    try {
      const userTime = this.utcToUserTime(date.toISOString(), timezone);
      return format(userTime, formatStr);
    } catch (error) {
      console.warn('Date formatting failed:', error);
      return format(date, formatStr);
    }
  }

  /**
   * Create date in specific timezone
   */
  createDateInTimezone(dateTimeString: string, timezone: string): Date {
    try {
      // Validate inputs
      if (!dateTimeString || typeof dateTimeString !== 'string') {
        throw new Error(`Invalid dateTimeString parameter: ${dateTimeString}`);
      }
      
      if (!timezone || typeof timezone !== 'string') {
        throw new Error(`Invalid timezone parameter: ${timezone}`);
      }
      
      // Parse the local date string and treat it as being in the specified timezone
      const localDate = new Date(dateTimeString);
      
      // Validate the parsed date
      if (isNaN(localDate.getTime())) {
        throw new Error(`Invalid date string: ${dateTimeString}`);
      }
      
      const result = fromZonedTime(localDate, timezone);
      
      // Validate the result
      if (isNaN(result.getTime())) {
        throw new Error(`Timezone conversion resulted in invalid date: ${dateTimeString} in ${timezone}`);
      }
      
      return result;
    } catch (error) {
      console.warn('Date creation failed:', { dateTimeString, timezone, error: error.message });
      
      // Fallback: try parsing as ISO string directly
      const fallbackDate = new Date(dateTimeString);
      if (!isNaN(fallbackDate.getTime())) {
        return fallbackDate;
      }
      
      // Last resort: return current date
      console.error('Critical date creation failure, returning current date');
      return new Date();
    }
  }

  /**
   * Create timezone context for current moment
   */
  createTimezoneContext(timezone?: string, source: TimezoneContext['source'] = 'browser'): TimezoneContext {
    const tz = timezone || this.getCurrentTimezone();
    const now = new Date();
    
    const cacheKey = `${tz}-${now.getTime()}`;
    if (this.timezoneCache.has(cacheKey)) {
      return this.timezoneCache.get(cacheKey)!;
    }
    
    try {
      const context: TimezoneContext = {
        timezone: tz,
        utcOffset: now.getTimezoneOffset(),
        isDST: this.isDSTActive(tz, now),
        recordedAt: now,
        source
      };
      
      // Cache for 1 hour
      this.timezoneCache.set(cacheKey, context);
      setTimeout(() => this.timezoneCache.delete(cacheKey), 3600000);
      
      return context;
    } catch (error) {
      console.warn('Failed to create timezone context:', error);
      return {
        timezone: 'UTC',
        utcOffset: 0,
        isDST: false,
        recordedAt: now,
        source: 'fallback'
      };
    }
  }
  
  /**
   * Group UTC sessions by local date in user's timezone
   */
  groupSessionsByLocalDate<T extends { startTimeUTC: string }>(
    sessions: T[], 
    timezone: string
  ): Record<string, T[]> {
    const grouped: Record<string, T[]> = {};
    
    sessions.forEach(session => {
      try {
        const localTime = this.utcToUserTime(session.startTimeUTC, timezone);
        const localDateKey = format(localTime, 'yyyy-MM-dd');
        
        if (!grouped[localDateKey]) {
          grouped[localDateKey] = [];
        }
        grouped[localDateKey].push(session);
      } catch (error) {
        console.warn('Failed to group session by local date:', error);
        const fallbackDate = format(new Date(session.startTimeUTC), 'yyyy-MM-dd');
        if (!grouped[fallbackDate]) {
          grouped[fallbackDate] = [];
        }
        grouped[fallbackDate].push(session);
      }
    });
    
    return grouped;
  }
  
  /**
   * Validate timezone identifier
   */
  isValidTimezone(timezone: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Check if DST is active (simplified)
   */
  private isDSTActive(timezone: string, date: Date): boolean {
    try {
      const january = new Date(date.getFullYear(), 0, 1);
      const july = new Date(date.getFullYear(), 6, 1);
      
      const janOffset = january.getTimezoneOffset();
      const julyOffset = july.getTimezoneOffset();
      const currentOffset = date.getTimezoneOffset();
      
      return currentOffset !== Math.max(janOffset, julyOffset);
    } catch {
      return false;
    }
  }
}

// Monitoring and error tracking
export const timezoneMonitoring = {
  trackConversionError: (error: any, context: string) => {
    console.error(`Timezone conversion error in ${context}:`, error);
    // Integration point for analytics/error tracking
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'timezone_error', { context, error: error.message });
    }
  },

  trackFeatureUsage: (feature: string, success: boolean) => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'timezone_feature_usage', { feature, success });
    }
  },

  validateTimezoneData: (data: any) => {
    const issues = [];
    try {
      if (data.timezone) {
        Intl.DateTimeFormat(undefined, { timeZone: data.timezone });
      }
    } catch {
      if (data.timezone) {
        issues.push(`Invalid timezone: ${data.timezone}`);
      }
    }
    if (data.startTimeUTC && isNaN(new Date(data.startTimeUTC).getTime())) {
      issues.push(`Invalid UTC timestamp: ${data.startTimeUTC}`);
    }
    return issues;
  }
};

export const timezoneUtils = UTCTimezoneService.getInstance();
export type { TimezoneContext };