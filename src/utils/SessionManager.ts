/**
 * Session Manager Types and Utilities
 * Shared types between extension and web app for site usage sessions
 */

export interface SiteUsageSession {
  id: string;
  userId: string;
  domain: string;
  startTime: Date | string;
  endTime?: Date | string | null;
  duration: number; // in milliseconds
  utcDate: string; // YYYY-MM-DD format in UTC
  status: 'active' | 'completed' | 'suspended';
  isActive: boolean;
  createdAt: Date | string;
  updatedAt?: Date | string;
  
  // Optional metadata
  title?: string;
  favicon?: string;
  url?: string;
  category?: string;
  visits?: number;
}

/**
 * Session Manager Utility Class
 * Used by both extension and web app for consistent session handling
 */
export class SessionManager {
  /**
   * Create a new session ID
   */
  static generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get UTC date string for a given date
   */
  static getUtcDateString(date: Date = new Date()): string {
    return date.toISOString().split('T')[0];
  }
  
  /**
   * Create a new session object
   */
  static createSession(
    userId: string,
    domain: string,
    startTime: Date = new Date()
  ): SiteUsageSession {
    return {
      id: this.generateSessionId(),
      userId,
      domain,
      startTime,
      endTime: null,
      duration: 0,
      utcDate: this.getUtcDateString(startTime),
      status: 'active',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
  
  /**
   * Complete a session by setting end time and calculating duration
   */
  static completeSession(
    session: SiteUsageSession,
    endTime: Date = new Date()
  ): SiteUsageSession {
    const startTimeDate = session.startTime instanceof Date 
      ? session.startTime 
      : new Date(session.startTime);
    
    const duration = endTime.getTime() - startTimeDate.getTime();
    
    return {
      ...session,
      endTime,
      duration,
      status: 'completed',
      isActive: false,
      updatedAt: new Date()
    };
  }
  
  /**
   * Suspend a session (pause without completing)
   */
  static suspendSession(session: SiteUsageSession): SiteUsageSession {
    return {
      ...session,
      status: 'suspended',
      isActive: false,
      updatedAt: new Date()
    };
  }
  
  /**
   * Resume a suspended session
   */
  static resumeSession(session: SiteUsageSession): SiteUsageSession {
    return {
      ...session,
      status: 'active',
      isActive: true,
      updatedAt: new Date()
    };
  }
  
  /**
   * Validate a session object
   */
  static validateSession(session: any): session is SiteUsageSession {
    return (
      session &&
      typeof session.id === 'string' &&
      typeof session.userId === 'string' &&
      typeof session.domain === 'string' &&
      (session.startTime instanceof Date || typeof session.startTime === 'string') &&
      typeof session.duration === 'number' &&
      typeof session.utcDate === 'string' &&
      ['active', 'completed', 'suspended'].includes(session.status) &&
      typeof session.isActive === 'boolean'
    );
  }
  
  /**
   * Calculate total duration for multiple sessions
   */
  static calculateTotalDuration(sessions: SiteUsageSession[]): number {
    return sessions
      .filter(session => session.status === 'completed')
      .reduce((total, session) => total + session.duration, 0);
  }
  
  /**
   * Group sessions by domain
   */
  static groupByDomain(sessions: SiteUsageSession[]): Record<string, SiteUsageSession[]> {
    return sessions.reduce((groups, session) => {
      const domain = session.domain;
      if (!groups[domain]) {
        groups[domain] = [];
      }
      groups[domain].push(session);
      return groups;
    }, {} as Record<string, SiteUsageSession[]>);
  }
  
  /**
   * Group sessions by date
   */
  static groupByDate(sessions: SiteUsageSession[]): Record<string, SiteUsageSession[]> {
    return sessions.reduce((groups, session) => {
      const date = session.utcDate;
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(session);
      return groups;
    }, {} as Record<string, SiteUsageSession[]>);
  }
  
  /**
   * Filter sessions by date range
   */
  static filterByDateRange(
    sessions: SiteUsageSession[],
    startDate: Date,
    endDate: Date
  ): SiteUsageSession[] {
    const startUtc = this.getUtcDateString(startDate);
    const endUtc = this.getUtcDateString(endDate);
    
    return sessions.filter(session => 
      session.utcDate >= startUtc && session.utcDate <= endUtc
    );
  }
  
  /**
   * Convert session times to consistent Date objects
   */
  static normalizeDates(session: SiteUsageSession): SiteUsageSession {
    return {
      ...session,
      startTime: session.startTime instanceof Date 
        ? session.startTime 
        : new Date(session.startTime),
      endTime: session.endTime 
        ? (session.endTime instanceof Date 
          ? session.endTime 
          : new Date(session.endTime))
        : null,
      createdAt: session.createdAt instanceof Date 
        ? session.createdAt 
        : new Date(session.createdAt),
      updatedAt: session.updatedAt 
        ? (session.updatedAt instanceof Date 
          ? session.updatedAt 
          : new Date(session.updatedAt))
        : new Date()
    };
  }
}

export default SessionManager;