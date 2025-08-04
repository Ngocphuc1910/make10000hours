import { workSessionService } from '../api/workSessionService';
import { workSessionServiceUTC } from '../api/workSessionServiceUTC';
import { timezoneUtils } from '../utils/timezoneUtils';
import { utcMonitoring } from './monitoring';
import { utcFeatureFlags } from './featureFlags';
import type { WorkSession } from '../types/models';
import type { WorkSessionUTC, UnifiedWorkSession } from '../types/utcModels';

interface TransitionConfig {
  preferUTC: boolean;
  fallbackToLegacy: boolean;
  enableDualMode: boolean;
}

export class TransitionQueryService {
  private config: TransitionConfig;
  
  constructor(config: Partial<TransitionConfig> = {}) {
    this.config = {
      preferUTC: true,
      fallbackToLegacy: true,
      enableDualMode: true,
      ...config
    };
  }
  
  /**
   * Get sessions for a date with unified interface
   */
  async getSessionsForDate(
    date: Date,
    userId: string,
    userTimezone: string
  ): Promise<UnifiedWorkSession[]> {
    const startTime = performance.now();
    const sessions: UnifiedWorkSession[] = [];
    
    try {
      // Determine which data sources to use based on feature flags
      const transitionMode = utcFeatureFlags.getTransitionMode(userId);
      
      if (transitionMode === 'disabled') {
        // Use legacy only
        const legacySessions = await this.getLegacySessionsForDate(date, userId, userTimezone);
        sessions.push(...this.convertLegacySessionsToUnified(legacySessions, userTimezone));
      } else if (transitionMode === 'utc-only') {
        // Use UTC only
        const utcSessions = await workSessionServiceUTC.getSessionsForDate(date, userId, userTimezone);
        sessions.push(...this.convertUTCSessionsToUnified(utcSessions, userTimezone));
      } else {
        // Dual mode - try UTC first, then legacy
        try {
          if (this.config.preferUTC) {
            const utcSessions = await workSessionServiceUTC.getSessionsForDate(date, userId, userTimezone);
            sessions.push(...this.convertUTCSessionsToUnified(utcSessions, userTimezone));
          }
        } catch (error) {
          console.warn('UTC query failed:', error);
          utcMonitoring.trackOperation('utc_query_fallback', false);
        }
        
        // Add legacy sessions if dual mode enabled or UTC failed
        if (this.config.enableDualMode || sessions.length === 0) {
          try {
            const legacySessions = await this.getLegacySessionsForDate(date, userId, userTimezone);
            
            // Filter out sessions that are already in UTC format (avoid duplicates)
            const filteredLegacySessions = legacySessions.filter(legacy => 
              !sessions.some(utc => 
                utc.rawData.id === legacy.id || 
                (utc.rawData as WorkSessionUTC).legacyId === legacy.id
              )
            );
            
            sessions.push(...this.convertLegacySessionsToUnified(filteredLegacySessions, userTimezone));
          } catch (error) {
            console.warn('Legacy query failed:', error);
            if (sessions.length === 0) {
              throw error;
            }
          }
        }
      }
      
      // Sort by start time (most recent first)
      const sortedSessions = sessions.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
      
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('transition_get_sessions_for_date', true, duration);
      
      return sortedSessions;
      
    } catch (error) {
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('transition_get_sessions_for_date', false, duration);
      console.error('Error in unified session query:', error);
      throw error;
    }
  }
  
  /**
   * Get today's sessions with unified interface
   */
  async getTodaysSessions(userId: string, userTimezone: string): Promise<UnifiedWorkSession[]> {
    const today = new Date();
    return this.getSessionsForDate(today, userId, userTimezone);
  }
  
  /**
   * Get sessions for date range with unified interface
   */
  async getSessionsForDateRange(
    startDate: Date,
    endDate: Date,
    userId: string,
    userTimezone: string
  ): Promise<UnifiedWorkSession[]> {
    const startTime = performance.now();
    const allSessions: UnifiedWorkSession[] = [];
    
    try {
      const transitionMode = utcFeatureFlags.getTransitionMode(userId);
      
      if (transitionMode === 'disabled') {
        // Legacy only
        const legacySessions = await this.getLegacySessionsForDateRange(startDate, endDate, userId, userTimezone);
        allSessions.push(...this.convertLegacySessionsToUnified(legacySessions, userTimezone));
      } else if (transitionMode === 'utc-only') {
        // UTC only
        const utcSessions = await workSessionServiceUTC.getSessionsForDateRange(startDate, endDate, userId, userTimezone);
        allSessions.push(...this.convertUTCSessionsToUnified(utcSessions, userTimezone));
      } else {
        // Dual mode
        try {
          if (this.config.preferUTC) {
            const utcSessions = await workSessionServiceUTC.getSessionsForDateRange(
              startDate, endDate, userId, userTimezone
            );
            allSessions.push(...this.convertUTCSessionsToUnified(utcSessions, userTimezone));
          }
        } catch (error) {
          console.warn('UTC range query failed:', error);
        }
        
        // Add legacy sessions
        if (this.config.enableDualMode || allSessions.length === 0) {
          try {
            const legacySessions = await this.getLegacySessionsForDateRange(
              startDate, endDate, userId, userTimezone
            );
            
            // Filter duplicates
            const filteredLegacySessions = legacySessions.filter(legacy => 
              !allSessions.some(utc => 
                utc.rawData.id === legacy.id || 
                (utc.rawData as WorkSessionUTC).legacyId === legacy.id
              )
            );
            
            allSessions.push(...this.convertLegacySessionsToUnified(filteredLegacySessions, userTimezone));
          } catch (error) {
            console.warn('Legacy range query failed:', error);
          }
        }
      }
      
      const sortedSessions = allSessions.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
      
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('transition_get_sessions_for_date_range', true, duration);
      
      return sortedSessions;
      
    } catch (error) {
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('transition_get_sessions_for_date_range', false, duration);
      console.error('Error in unified range query:', error);
      throw error;
    }
  }
  
  /**
   * Create new session (routes to appropriate service)
   */
  async createSession(sessionData: {
    userId: string;
    taskId: string;
    projectId: string;
    duration: number;
    sessionType: 'manual' | 'pomodoro' | 'shortBreak' | 'longBreak';
    status: 'active' | 'paused' | 'completed' | 'switched';
    notes?: string;
  }): Promise<string> {
    const startTime = performance.now();
    
    try {
      const transitionMode = utcFeatureFlags.getTransitionMode(sessionData.userId);
      
      if (transitionMode === 'utc-only' || (transitionMode === 'dual' && this.config.preferUTC)) {
        // Create UTC session
        const sessionId = await workSessionServiceUTC.createSession(sessionData);
        
        const duration = performance.now() - startTime;
        utcMonitoring.trackOperation('transition_create_utc_session', true, duration);
        
        return sessionId;
      } else {
        // Create legacy session
        const legacySessionData = {
          ...sessionData,
          date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
          startTime: new Date()
        };
        
        const sessionId = await workSessionService.createWorkSession(legacySessionData as any);
        
        const duration = performance.now() - startTime;
        utcMonitoring.trackOperation('transition_create_legacy_session', true, duration);
        
        return sessionId;
      }
    } catch (error) {
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('transition_create_session', false, duration);
      console.error('Error creating session:', error);
      throw error;
    }
  }
  
  /**
   * Get legacy sessions for a specific date
   */
  private async getLegacySessionsForDate(
    date: Date,
    userId: string,
    userTimezone: string
  ): Promise<WorkSession[]> {
    // Convert date to local date string
    const localDate = timezoneUtils.utcToUserTime(date.toISOString(), userTimezone);
    const dateString = localDate.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Use existing legacy service
    return workSessionService.getWorkSessionsByDate(userId, dateString);
  }
  
  /**
   * Get legacy sessions for date range
   */
  private async getLegacySessionsForDateRange(
    startDate: Date,
    endDate: Date,
    userId: string,
    userTimezone: string
  ): Promise<WorkSession[]> {
    // Use existing legacy service
    return workSessionService.getWorkSessionsByDateRange(userId, startDate, endDate);
  }
  
  /**
   * Convert UTC sessions to unified format
   */
  private convertUTCSessionsToUnified(
    utcSessions: WorkSessionUTC[],
    userTimezone: string
  ): UnifiedWorkSession[] {
    return utcSessions.map(utcSession => {
      // Convert UTC times to user's local timezone
      const localStartTime = timezoneUtils.utcToUserTime(utcSession.startTimeUTC, userTimezone);
      const localEndTime = utcSession.endTimeUTC ? 
        timezoneUtils.utcToUserTime(utcSession.endTimeUTC, userTimezone) : 
        undefined;
      
      return {
        id: utcSession.id,
        userId: utcSession.userId,
        taskId: utcSession.taskId,
        projectId: utcSession.projectId,
        duration: utcSession.duration,
        sessionType: utcSession.sessionType,
        status: utcSession.status,
        notes: utcSession.notes,
        createdAt: utcSession.createdAt,
        updatedAt: utcSession.updatedAt,
        startTime: localStartTime,
        endTime: localEndTime,
        dataSource: 'utc',
        timezone: utcSession.timezoneContext.timezone,
        rawData: utcSession
      };
    });
  }
  
  /**
   * Convert legacy sessions to unified format
   */
  private convertLegacySessionsToUnified(
    legacySessions: WorkSession[],
    userTimezone: string
  ): UnifiedWorkSession[] {
    return legacySessions.map(legacySession => {
      // Legacy sessions store times in local timezone
      let startTime: Date;
      
      if (legacySession.startTime) {
        startTime = legacySession.startTime;
      } else {
        // Reconstruct from date string
        startTime = new Date(legacySession.date + 'T00:00:00');
      }
      
      return {
        id: legacySession.id,
        userId: legacySession.userId,
        taskId: legacySession.taskId,
        projectId: legacySession.projectId,
        duration: legacySession.duration,
        sessionType: legacySession.sessionType,
        status: legacySession.status,
        notes: legacySession.notes,
        createdAt: legacySession.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: legacySession.updatedAt?.toISOString() || new Date().toISOString(),
        startTime,
        endTime: legacySession.endTime,
        dataSource: 'legacy',
        timezone: userTimezone, // Assume current user timezone
        rawData: legacySession
      };
    });
  }
  
  /**
   * Get session statistics across both data sources
   */
  async getSessionStatistics(userId: string, userTimezone: string): Promise<{
    totalSessions: number;
    utcSessions: number;
    legacySessions: number;
    migrationProgress: number; // percentage
  }> {
    const startTime = performance.now();
    
    try {
      // Count UTC sessions
      const utcSessions = await workSessionServiceUTC.getAllSessions(userId, 1000);
      
      // Count legacy sessions (unmigrated)
      const legacySessions = await workSessionService.getAllWorkSessions(userId);
      const unmigrated = legacySessions.filter(s => !s.migrated);
      
      const totalSessions = utcSessions.length + unmigrated.length;
      const migrationProgress = totalSessions > 0 ? (utcSessions.length / totalSessions) * 100 : 0;
      
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('get_session_statistics', true, duration);
      
      return {
        totalSessions,
        utcSessions: utcSessions.length,
        legacySessions: unmigrated.length,
        migrationProgress
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('get_session_statistics', false, duration);
      console.error('Error getting session statistics:', error);
      return {
        totalSessions: 0,
        utcSessions: 0,
        legacySessions: 0,
        migrationProgress: 0
      };
    }
  }
  
  /**
   * Update transition configuration
   */
  updateConfig(newConfig: Partial<TransitionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
  
  /**
   * Get current configuration
   */
  getConfig(): TransitionConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const transitionQueryService = new TransitionQueryService();