/**
 * Deep Focus Session Display Service
 * Converts sessions for display in user's timezone using existing UnifiedTimezoneService
 */

import { timezoneUtils } from '../utils/timezoneUtils';
import { format, differenceInHours, differenceInDays } from 'date-fns';
import type { DeepFocusSession } from '../types/models';

export interface SessionDisplayData extends DeepFocusSession {
  displayStartTime: string;
  displayEndTime?: string;
  displayDate: string;
  displayDuration: string;
  showTimezoneLabel: boolean;
  timezoneLabel?: string;
  isToday: boolean;
  spansDays: boolean;
  isRecent: boolean;
  isActive: boolean;
}

export class DeepFocusDisplayService {
  /**
   * Convert sessions for display in user's timezone
   * Uses existing UnifiedTimezoneService infrastructure
   */
  static convertSessionsForUser(
    sessions: DeepFocusSession[], 
    userTimezone: string
  ): SessionDisplayData[] {
    if (!sessions || !Array.isArray(sessions)) {
      return [];
    }

    return sessions
      .map(session => this.convertSingleSession(session, userTimezone))
      .filter(session => session !== null) as SessionDisplayData[];
  }
  
  /**
   * Convert single session for display in user's timezone
   */
  static convertSingleSession(
    session: DeepFocusSession, 
    userTimezone: string
  ): SessionDisplayData | null {
    try {
      if (!session || !session.startTime) {
        console.warn('Invalid session data:', session);
        return null;
      }

      // Safely convert startTime to ISO string - handles Date, Timestamp, or number
      const startTimeISO = this.toISOString(session.startTime);
      if (!startTimeISO) {
        console.warn('Could not convert session startTime to ISO string:', session.startTime);
        return null;
      }

      // Convert UTC time to user's timezone using existing service
      const userStartTime = timezoneUtils.utcToUserTime(
        startTimeISO,
        userTimezone
      );
      
      const userEndTime = session.endTime ? 
        timezoneUtils.utcToUserTime(this.toISOString(session.endTime) || '', userTimezone) : 
        null;
      
      // Check if session was created in different timezone
      const sessionTimezone = session.timezone || userTimezone;
      const showTimezoneLabel = sessionTimezone !== userTimezone;
      
      // Calculate if session spans multiple days
      const spansDays = userEndTime ? 
        differenceInDays(userEndTime, userStartTime) > 0 : false;

      return {
        ...session,
        
        // Display fields in user's current timezone
        displayStartTime: format(userStartTime, 'h:mm a'), // "2:30 PM"
        displayEndTime: userEndTime ? format(userEndTime, 'h:mm a') : undefined,
        displayDate: format(userStartTime, 'PPP'), // "August 6th, 2025"
        displayDuration: this.formatDuration(session.duration || 0),
        
        // Timezone indicators
        showTimezoneLabel,
        timezoneLabel: showTimezoneLabel ? 
          this.formatTimezoneLabel(sessionTimezone) : undefined,
        
        // Status helpers
        isToday: this.isToday(userStartTime, userTimezone),
        spansDays,
        isRecent: this.isSessionRecent(session.startTime),
        isActive: session.status === 'active'
      };
    } catch (error) {
      console.error('Error converting session for display:', error, session);
      return null;
    }
  }
  
  /**
   * Format duration in minutes to human readable string
   */
  private static formatDuration(minutes: number): string {
    if (!minutes || minutes < 1) {
      return '< 1m';
    }
    
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    
    if (mins === 0) {
      return `${hours}h`;
    }
    
    return `${hours}h ${mins}m`;
  }
  
  /**
   * Format timezone label for display
   */
  private static formatTimezoneLabel(timezone: string): string {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en', {
        timeZone: timezone,
        timeZoneName: 'short'
      });
      
      const parts = formatter.formatToParts(now);
      const timeZoneName = parts.find(part => part.type === 'timeZoneName')?.value;
      
      if (timeZoneName) {
        return timeZoneName;
      }
      
      // Fallback to manual formatting
      const offset = this.getTimezoneOffset(timezone);
      const name = timezone.split('/').pop()?.replace('_', ' ') || timezone;
      return `${name} (UTC${offset})`;
    } catch (error) {
      console.warn('Failed to format timezone label:', error);
      return timezone.split('/').pop()?.replace('_', ' ') || timezone;
    }
  }
  
  /**
   * Get timezone offset string (e.g., "-08:00", "+05:30")
   */
  private static getTimezoneOffset(timezone: string): string {
    try {
      const now = new Date();
      const utc = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
      const target = new Date(utc.toLocaleString('en-US', { timeZone: timezone }));
      const offsetMs = target.getTime() - utc.getTime();
      const offsetMinutes = offsetMs / (1000 * 60);
      
      const hours = Math.floor(Math.abs(offsetMinutes) / 60);
      const minutes = Math.abs(offsetMinutes) % 60;
      const sign = offsetMinutes >= 0 ? '+' : '-';
      
      return `${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    } catch (error) {
      return '+00:00';
    }
  }
  
  /**
   * Check if session date is today in user's timezone
   */
  private static isToday(date: Date, userTimezone: string): boolean {
    try {
      const today = timezoneUtils.formatInTimezone(new Date().toISOString(), userTimezone, 'yyyy-MM-dd');
      const sessionDate = timezoneUtils.formatInTimezone(date.toISOString(), userTimezone, 'yyyy-MM-dd');
      return today === sessionDate;
    } catch (error) {
      // Fallback to simple date comparison
      const today = new Date();
      return date.toDateString() === today.toDateString();
    }
  }
  
  /**
   * Check if session is recent (within last 24 hours)
   */
  private static isSessionRecent(startTime: Date): boolean {
    const now = new Date();
    const hoursSinceSession = differenceInHours(now, startTime);
    return hoursSinceSession <= 24;
  }
  
  /**
   * Get summary statistics for display sessions
   */
  static getSessionSummary(sessions: SessionDisplayData[]): {
    totalSessions: number;
    totalDuration: number;
    activeSessions: number;
    todaySessions: number;
    averageDuration: number;
  } {
    if (!sessions || sessions.length === 0) {
      return {
        totalSessions: 0,
        totalDuration: 0,
        activeSessions: 0,
        todaySessions: 0,
        averageDuration: 0
      };
    }
    
    const totalSessions = sessions.length;
    const totalDuration = sessions.reduce((sum, session) => sum + (session.duration || 0), 0);
    const activeSessions = sessions.filter(session => session.isActive).length;
    const todaySessions = sessions.filter(session => session.isToday).length;
    const averageDuration = totalSessions > 0 ? totalDuration / totalSessions : 0;
    
    return {
      totalSessions,
      totalDuration,
      activeSessions,
      todaySessions,
      averageDuration
    };
  }
  
  /**
   * Group sessions by date for display
   */
  static groupSessionsByDate(sessions: SessionDisplayData[]): Record<string, SessionDisplayData[]> {
    const grouped: Record<string, SessionDisplayData[]> = {};
    
    sessions.forEach(session => {
      // Use display date as the key for grouping
      const startTimeISO = this.toISOString(session.startTime);
      if (!startTimeISO) return;
      
      const dateKey = format(new Date(startTimeISO), 'yyyy-MM-dd');
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(session);
    });
    
    // Sort sessions within each date group by start time (newest first)
    Object.keys(grouped).forEach(dateKey => {
      grouped[dateKey].sort((a, b) => {
        const aTime = this.toISOString(a.startTime);
        const bTime = this.toISOString(b.startTime);
        if (!aTime || !bTime) return 0;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });
    });
    
    return grouped;
  }
  
  /**
   * Safely convert various timestamp formats to ISO string
   * Handles: Date objects, Firebase Timestamps, epoch milliseconds, ISO strings
   */
  private static toISOString(timestamp: any): string | null {
    if (!timestamp) return null;
    
    try {
      // If it's already a string (ISO format), return as-is
      if (typeof timestamp === 'string') {
        return timestamp;
      }
      
      // If it's a Date object, use toISOString()
      if (timestamp instanceof Date) {
        return timestamp.toISOString();
      }
      
      // If it's a Firebase Timestamp object
      if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toISOString();
      }
      
      // If it's a number (epoch milliseconds), convert to Date
      if (typeof timestamp === 'number') {
        return new Date(timestamp).toISOString();
      }
      
      // If it has seconds and nanoseconds (Firestore Timestamp-like object)
      if (timestamp && typeof timestamp.seconds === 'number') {
        const milliseconds = timestamp.seconds * 1000 + Math.floor((timestamp.nanoseconds || 0) / 1000000);
        return new Date(milliseconds).toISOString();
      }
      
      console.warn('Unknown timestamp format:', timestamp, typeof timestamp);
      return null;
      
    } catch (error) {
      console.error('Error converting timestamp to ISO string:', error, timestamp);
      return null;
    }
  }
}