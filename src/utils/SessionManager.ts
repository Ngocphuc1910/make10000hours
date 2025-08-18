/**
 * Session Manager Types and Utilities
 * Shared types between extension and web app for site usage sessions
 */

// Extension contract (exact match to extension data format)
export interface ExtensionSiteUsageSession {
  domain: string;
  duration: number; // seconds
  startTimeUTC: string;
  endTimeUTC?: string;
  status: 'completed' | 'active' | 'suspended';
  utcDate: string; // YYYY-MM-DD
  userId: string;
}

// Firebase session schema
export interface SiteUsageSession {
  id: string;
  userId: string;
  domain: string;
  startTimeUTC: string;
  endTimeUTC?: string;
  duration: number; // seconds (matching extension)
  utcDate: string; // YYYY-MM-DD format in UTC
  status: 'active' | 'completed' | 'suspended';
  createdAt: string;
  
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
   * Convert extension session to Firebase format
   */
  static convertExtensionToFirebase(ext: ExtensionSiteUsageSession): SiteUsageSession {
    return {
      id: this.generateSessionId(),
      userId: ext.userId,
      domain: ext.domain,
      startTimeUTC: ext.startTimeUTC,
      endTimeUTC: ext.endTimeUTC,
      duration: ext.duration, // keep seconds
      utcDate: ext.utcDate,
      status: ext.status,
      createdAt: new Date().toISOString()
    };
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
      startTimeUTC: startTime.toISOString(),
      endTimeUTC: undefined,
      duration: 0,
      utcDate: this.getUtcDateString(startTime),
      status: 'active',
      createdAt: new Date().toISOString()
    };
  }
  
  /**
   * Complete a session by setting end time and calculating duration
   */
  static completeSession(
    session: SiteUsageSession,
    endTime: Date = new Date()
  ): SiteUsageSession {
    const startTimeDate = new Date(session.startTimeUTC);
    const duration = Math.floor((endTime.getTime() - startTimeDate.getTime()) / 1000); // seconds
    
    return {
      ...session,
      endTimeUTC: endTime.toISOString(),
      duration,
      status: 'completed'
    };
  }
  
  /**
   * Suspend a session (pause without completing)
   */
  static suspendSession(session: SiteUsageSession): SiteUsageSession {
    return {
      ...session,
      status: 'suspended'
    };
  }
  
  /**
   * Resume a suspended session
   */
  static resumeSession(session: SiteUsageSession): SiteUsageSession {
    return {
      ...session,
      status: 'active'
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
      typeof session.startTimeUTC === 'string' &&
      typeof session.duration === 'number' &&
      typeof session.utcDate === 'string' &&
      ['active', 'completed', 'suspended'].includes(session.status) &&
      typeof session.createdAt === 'string'
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
   * Validate extension session format
   */
  static validateExtensionSession(session: any): session is ExtensionSiteUsageSession {
    return (
      session &&
      typeof session.domain === 'string' &&
      typeof session.duration === 'number' &&
      typeof session.startTimeUTC === 'string' &&
      typeof session.utcDate === 'string' &&
      typeof session.userId === 'string' &&
      ['active', 'completed', 'suspended'].includes(session.status)
    );
  }
}

export default SessionManager;