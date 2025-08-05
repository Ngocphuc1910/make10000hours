import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { formatInTimeZone, zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';
import { timezoneUtils } from '../utils/timezoneUtils';
import { utcFeatureFlags } from './featureFlags';

interface TimezoneContext {
  userTimezone: string;
  utcOffset: number;
  isDST: boolean;
  detectedTimezone?: string;
  source: 'user' | 'detected' | 'fallback';
}

interface UTCDateRange {
  startUTC: string;
  endUTC: string;
  originalStart: Date;
  originalEnd: Date;
  timezone: string;
}

export class UnifiedTimezoneService {
  private static instance: UnifiedTimezoneService;
  private currentUserTimezone: string;
  private detectedTimezone: string;

  private constructor() {
    this.detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    this.currentUserTimezone = this.detectedTimezone; // Default fallback
  }

  static getInstance(): UnifiedTimezoneService {
    if (!UnifiedTimezoneService.instance) {
      UnifiedTimezoneService.instance = new UnifiedTimezoneService();
    }
    return UnifiedTimezoneService.instance;
  }

  /**
   * Set user's preferred timezone (from settings)
   */
  setUserTimezone(timezone: string): void {
    if (this.isValidTimezone(timezone)) {
      this.currentUserTimezone = timezone;
      console.log('📅 User timezone updated:', timezone);
    } else {
      console.warn('⚠️ Invalid timezone provided, using detected:', this.detectedTimezone);
      this.currentUserTimezone = this.detectedTimezone;
    }
  }

  /**
   * Get current user timezone (preference > detected > fallback)
   */
  getUserTimezone(): string {
    return this.currentUserTimezone || this.detectedTimezone || 'UTC';
  }

  /**
   * Create comprehensive timezone context
   */
  createTimezoneContext(userTimezone?: string): TimezoneContext {
    const timezone = userTimezone || this.getUserTimezone();
    const now = new Date();
    
    return {
      userTimezone: timezone,
      utcOffset: this.getTimezoneOffset(timezone, now),
      isDST: this.isDSTActive(timezone, now),
      detectedTimezone: this.detectedTimezone,
      source: userTimezone ? 'user' : 'detected'
    };
  }

  /**
   * Convert local date range to UTC for database queries
   * Handles DST transitions properly
   */
  convertDateRangeToUTC(
    startDate: Date,
    endDate: Date, 
    userTimezone?: string
  ): UTCDateRange {
    const timezone = userTimezone || this.getUserTimezone();
    
    try {
      // Get start of day in user's timezone
      const startOfUserDay = startOfDay(startDate);
      const endOfUserDay = endOfDay(endDate);
      
      // Convert to UTC using date-fns-tz (handles DST properly)
      const startUTC = zonedTimeToUtc(startOfUserDay, timezone);
      const endUTC = zonedTimeToUtc(endOfUserDay, timezone);
      
      return {
        startUTC: startUTC.toISOString(),
        endUTC: endUTC.toISOString(),
        originalStart: startDate,
        originalEnd: endDate,
        timezone
      };
    } catch (error) {
      console.error('❌ Date range conversion failed:', error);
      // Fallback to simple UTC conversion
      return {
        startUTC: startOfDay(startDate).toISOString(),
        endUTC: endOfDay(endDate).toISOString(),
        originalStart: startDate,
        originalEnd: endDate,
        timezone: 'UTC'
      };
    }
  }

  /**
   * Create work session with proper UTC timestamps
   * Used by both web app and extension
   */
  createUTCWorkSession(sessionData: any, source: 'web' | 'extension' = 'web'): any {
    const now = new Date();
    const timezone = this.getUserTimezone();
    const utcNow = now.toISOString();
    
    // Ensure consistent UTC timestamp creation
    const startTimeUTC = sessionData.startTime ? 
      new Date(sessionData.startTime).toISOString() : utcNow;
    const endTimeUTC = sessionData.endTime ? 
      new Date(sessionData.endTime).toISOString() : undefined;

    return {
      ...sessionData,
      // UTC fields (primary for querying)
      startTimeUTC,
      endTimeUTC,
      createdAtUTC: utcNow,
      updatedAtUTC: utcNow,
      
      // Timezone context
      timezoneContext: this.createTimezoneContext(timezone),
      
      // Source tracking
      createdBy: source,
      
      // Legacy compatibility - derive date from UTC time in user timezone
      date: this.formatDateInTimezone(startTimeUTC, timezone),
      
      // Ensure legacy timestamps exist
      startTime: sessionData.startTime || now,
      createdAt: sessionData.createdAt || now,
      updatedAt: now
    };
  }

  /**
   * Query sessions using UTC timestamps (solves the core problem)
   */
  createUTCQuery(
    userId: string,
    startDate: Date,
    endDate: Date,
    userTimezone?: string
  ): { 
    queryParams: any;
    timezone: string;
    dateRange: UTCDateRange;
  } {
    const timezone = userTimezone || this.getUserTimezone();
    const dateRange = this.convertDateRangeToUTC(startDate, endDate, timezone);
    
    return {
      queryParams: {
        userId,
        startTimeUTC_gte: dateRange.startUTC,
        startTimeUTC_lte: dateRange.endUTC
      },
      timezone,
      dateRange
    };
  }

  /**
   * Convert UTC session back to user's timezone for display
   */
  convertUTCSessionForDisplay(session: any, userTimezone?: string): any {
    const timezone = userTimezone || this.getUserTimezone();
    
    try {
      return {
        ...session,
        // Convert UTC times to user timezone for display
        displayStartTime: session.startTimeUTC ? 
          utcToZonedTime(parseISO(session.startTimeUTC), timezone) : session.startTime,
        displayEndTime: session.endTimeUTC ? 
          utcToZonedTime(parseISO(session.endTimeUTC), timezone) : session.endTime,
        displayDate: session.startTimeUTC ? 
          this.formatDateInTimezone(session.startTimeUTC, timezone) : session.date,
        
        // Keep original data intact
        _originalUTC: {
          startTimeUTC: session.startTimeUTC,
          endTimeUTC: session.endTimeUTC
        }
      };
    } catch (error) {
      console.error('❌ UTC to display conversion failed:', error);
      return session; // Return as-is on error
    }
  }

  /**
   * Handle DST transitions in date queries
   */
  handleDSTTransition(date: Date, timezone: string): { 
    regularTime: Date;
    dstAdjustment: number;
    isDSTBoundary: boolean;
  } {
    try {
      const utcTime = zonedTimeToUtc(date, timezone);
      const backToLocal = utcToZonedTime(utcTime, timezone);
      
      const dstAdjustment = backToLocal.getTime() - date.getTime();
      const isDSTBoundary = Math.abs(dstAdjustment) > 0;
      
      return {
        regularTime: date,
        dstAdjustment,
        isDSTBoundary
      };
    } catch (error) {
      return {
        regularTime: date,
        dstAdjustment: 0,
        isDSTBoundary: false
      };
    }
  }

  /**
   * Extension compatibility: Ensure same timezone logic
   */
  async syncWithExtension(extensionService: any): Promise<void> {
    try {
      if (extensionService && typeof extensionService.handleTimezoneChange === 'function') {
        await extensionService.handleTimezoneChange(this.getUserTimezone());
      }
    } catch (error) {
      console.error('❌ Extension timezone sync failed:', error);
    }
  }

  // ========== UTILITY METHODS ==========

  private isValidTimezone(timezone: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }

  private getTimezoneOffset(timezone: string, date: Date = new Date()): number {
    try {
      const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
      const localDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
      return (utcDate.getTime() - localDate.getTime()) / (1000 * 60 * 60);
    } catch {
      return 0;
    }
  }

  private isDSTActive(timezone: string, date: Date = new Date()): boolean {
    try {
      const jan = new Date(date.getFullYear(), 0, 1);
      const jul = new Date(date.getFullYear(), 6, 1);
      
      const janOffset = this.getTimezoneOffset(timezone, jan);
      const julOffset = this.getTimezoneOffset(timezone, jul);
      const currentOffset = this.getTimezoneOffset(timezone, date);
      
      return currentOffset !== Math.max(janOffset, julOffset);
    } catch {
      return false;
    }
  }

  private formatDateInTimezone(utcTimestamp: string, timezone: string): string {
    try {
      return formatInTimeZone(parseISO(utcTimestamp), timezone, 'yyyy-MM-dd');
    } catch {
      return format(new Date(), 'yyyy-MM-dd');
    }
  }
}

// Export singleton instance
export const unifiedTimezoneService = UnifiedTimezoneService.getInstance();