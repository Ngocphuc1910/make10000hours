import { workSessionService } from '../api/workSessionService';
import { workSessionServiceUTC } from '../api/workSessionServiceUTC';
import { timezoneUtils } from '../utils/timezoneUtils';
import { utcMonitoring } from './monitoring';
import { utcFeatureFlags } from './featureFlags';
import type { WorkSession } from '../types/models';
import type { WorkSessionUTC, UnifiedWorkSession } from '../types/utcModels';
import { format } from 'date-fns';

interface TransitionConfig {
  preferUTC: boolean;
  fallbackToLegacy: boolean;
  enableDualMode: boolean;
}

export class TransitionQueryService {
  private config: TransitionConfig;
  
  constructor(config: Partial<TransitionConfig> = {}) {
    this.config = {
      preferUTC: false, // Changed to prefer enhanced legacy system
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
   * OPTIMIZED: Get sessions for date range with database-level filtering
   * Uses smart routing to minimize database reads
   */
  async getSessionsForDateRangeOptimized(
    startDate: Date,
    endDate: Date,
    userId: string,
    userTimezone: string
  ): Promise<UnifiedWorkSession[]> {
    const startTime = performance.now();
    
    try {
      const transitionMode = utcFeatureFlags.getTransitionMode(userId);
      
      console.log('🚀 OPTIMIZED QUERY:', {
        userId: userId.substring(0, 8),
        transitionMode,
        dateRange: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
        strategy: this.getOptimizationStrategy(transitionMode)
      });
      
      let sessions: UnifiedWorkSession[] = [];
      
      switch (transitionMode) {
        case 'utc-only':
          // OPTIMAL: Single UTC query with date filtering
          sessions = await this.getUTCSessionsWithDateFilter(userId, startDate, endDate, userTimezone);
          break;
          
        case 'disabled':
          // OPTIMAL: Single legacy query with date filtering
          sessions = await this.getLegacySessionsWithDateFilter(userId, startDate, endDate);
          break;
          
        case 'dual':
        default:
          // SAFE: Dual query with date filtering for transition users
          sessions = await this.getDualModeWithDateFilter(userId, startDate, endDate, userTimezone);
          break;
      }
      
      const sortedSessions = sessions.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
      
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('transition_optimized_date_range_query', true, duration);
      
      console.log('✅ OPTIMIZED QUERY SUCCESS:', {
        sessionsReturned: sortedSessions.length,
        utcSessions: sortedSessions.filter(s => s.dataSource === 'utc').length,
        legacySessions: sortedSessions.filter(s => s.dataSource === 'legacy').length,
        queryTimeMs: duration.toFixed(2)
      });
      
      return sortedSessions;
      
    } catch (error) {
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('transition_optimized_date_range_query', false, duration);
      console.error('❌ Optimized query failed, falling back to original:', error);
      
      // SAFETY: Fallback to original wide-range query
      return this.getSessionsForDateRange(startDate, endDate, userId, userTimezone);
    }
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
    
    // 🔍 AUDIT: Track query patterns for optimization analysis
    const auditData = {
      userId: userId.substring(0, 8),
      requestedRange: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
      rangeType: this.determineRangeType(startDate, endDate),
      userTimezone,
      queryStart: startTime
    };
    
    try {
      const transitionMode = utcFeatureFlags.getTransitionMode(userId);
      auditData.transitionMode = transitionMode;
      
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
      
      // 🔍 AUDIT: Complete query analysis
      const finalAudit = {
        ...auditData,
        sessionsReturned: sortedSessions.length,
        utcSessions: sortedSessions.filter(s => s.dataSource === 'utc').length,
        legacySessions: sortedSessions.filter(s => s.dataSource === 'legacy').length,
        queryDurationMs: duration.toFixed(2),
        isOptimizable: this.isQueryOptimizable(auditData.rangeType, sortedSessions.length),
        estimatedWaste: this.calculateQueryWaste(auditData.rangeType, sortedSessions.length)
      };
      
      console.log('🔍 QUERY AUDIT:', finalAudit);
      
      // Store for analysis (development only)
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        window.queryAuditLog = window.queryAuditLog || [];
        window.queryAuditLog.push(finalAudit);
      }
      
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
   * Create new session (routes to appropriate service based on feature flags)
   */
  async createSession(sessionData: {
    userId: string;
    taskId: string;
    projectId: string;
    duration: number;
    sessionType: string;
    status: string;
    notes?: string;
  }, userTimezone?: string): Promise<string> {
    const startTime = performance.now();
    
    try {
      const transitionMode = utcFeatureFlags.getTransitionMode(sessionData.userId);
      const timezone = userTimezone || timezoneUtils.getCurrentTimezone();
      
      console.log('🔍 DEBUG createSession:', {
        userId: sessionData.userId,
        transitionMode,
        preferUTC: this.config.preferUTC,
        willUseUTC: transitionMode === 'utc-only' || (transitionMode === 'dual' && this.config.preferUTC)
      });
      
      if (transitionMode === 'utc-only' || (transitionMode === 'dual' && this.config.preferUTC)) {
        // Create UTC session with proper timezone context
        const utcSessionData = {
          ...sessionData,
          startTimeUTC: timezoneUtils.getCurrentUTC(), // Use current UTC time
          userTimezone: timezone,
          timezoneContext: {
            timezone: timezone,
            utcOffset: new Date().getTimezoneOffset(),
            recordedAt: new Date(),
            source: 'browser' as const
          }
        };
        
        console.log('🌍 Creating UTC session:', {
          userId: sessionData.userId,
          taskId: sessionData.taskId,
          transitionMode,
          timezone: timezone,
          utcStartTime: utcSessionData.startTimeUTC
        });
        
        const sessionId = await workSessionServiceUTC.createSession(utcSessionData);
        
        const duration = performance.now() - startTime;
        utcMonitoring.trackOperation('transition_create_session_utc', true, duration);
        
        return sessionId;
      } else {
        // Use enhanced legacy service with UTC timezone support
        console.log('🌍 Creating enhanced legacy session:', {
          userId: sessionData.userId,
          taskId: sessionData.taskId,
          transitionMode,
          preferUTC: this.config.preferUTC
        });
        
        const now = new Date();
        const userLocalDate = timezoneUtils.utcToUserTime(now.toISOString(), timezone);
        
        const sessionId = await workSessionService.createWorkSession({
          ...sessionData,
          date: format(userLocalDate, 'yyyy-MM-dd'), // Format date in user timezone (fixed bug)
          startTime: now, // Use Date object for legacy compatibility
          userId: sessionData.userId
        }, timezone);
        
        const duration = performance.now() - startTime;
        utcMonitoring.trackOperation('transition_create_session_enhanced_legacy', true, duration);
        
        console.log('✅ Enhanced legacy session created successfully:', {
          sessionId,
          userTimezone: timezone,
          localDate: format(userLocalDate, 'yyyy-MM-dd')
        });
        
        return sessionId;
      }
    } catch (error) {
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('transition_create_session', false, duration);
      console.error('❌ Error creating session via transition service:', error);
      throw error;
    }
  }
  
  /**
   * Increment session duration (routes to appropriate service based on session ID)
   */
  async incrementDuration(sessionId: string, minutesToAdd: number): Promise<void> {
    const startTime = performance.now();
    
    try {
      // Check if this is a UTC session (starts with 'utc_') or legacy session
      if (sessionId.startsWith('utc_')) {
        console.log('🌍 Incrementing UTC session duration:', {
          sessionId,
          minutesToAdd
        });
        
        await workSessionServiceUTC.incrementDuration(sessionId, minutesToAdd);
        
        const duration = performance.now() - startTime;
        utcMonitoring.trackOperation('transition_increment_utc_duration', true, duration);
        
      } else {
        console.log('📝 Incrementing legacy session duration:', {
          sessionId,
          minutesToAdd
        });
        
        await workSessionService.incrementDuration(sessionId, minutesToAdd);
        
        const duration = performance.now() - startTime;
        utcMonitoring.trackOperation('transition_increment_legacy_duration', true, duration);
      }
    } catch (error) {
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('transition_increment_duration', false, duration);
      console.error('❌ Error incrementing session duration via transition service:', error);
      throw error;
    }
  }
  
  /**
   * Update session (routes to appropriate service based on session ID)
   */
  async updateSession(sessionId: string, updates: any): Promise<void> {
    const startTime = performance.now();
    
    try {
      // Check if this is a UTC session (starts with 'utc_') or legacy session
      if (sessionId.startsWith('utc_')) {
        console.log('🌍 Updating UTC session:', {
          sessionId,
          updates: Object.keys(updates)
        });
        
        await workSessionServiceUTC.updateSession(sessionId, updates);
        
        const duration = performance.now() - startTime;
        utcMonitoring.trackOperation('transition_update_utc_session', true, duration);
        
      } else {
        console.log('📝 Updating legacy session:', {
          sessionId,
          updates: Object.keys(updates)
        });
        
        await workSessionService.updateSession(sessionId, updates);
        
        const duration = performance.now() - startTime;
        utcMonitoring.trackOperation('transition_update_legacy_session', true, duration);
      }
    } catch (error) {
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('transition_update_session', false, duration);
      console.error('❌ Error updating session via transition service:', error);
      throw error;
    }
  }
  
  /**
   * Generic session update (routes to appropriate service based on session ID)
   */
  async updateSessionGeneric(sessionId: string, updates: any): Promise<void> {
    const startTime = performance.now();
    
    try {
      // Check if this is a UTC session (starts with 'utc_') or legacy session
      if (sessionId.startsWith('utc_')) {
        console.log('🌍 Generic updating UTC session:', {
          sessionId,
          fields: Object.keys(updates)
        });
        
        await workSessionServiceUTC.updateSessionGeneric(sessionId, updates);
        
        const duration = performance.now() - startTime;
        utcMonitoring.trackOperation('transition_update_utc_session_generic', true, duration);
        
      } else {
        console.log('📝 Generic updating legacy session:', {
          sessionId,
          fields: Object.keys(updates)
        });
        
        // Legacy service doesn't have updateSessionGeneric, use regular updateSession
        await workSessionService.updateSession(sessionId, updates);
        
        const duration = performance.now() - startTime;
        utcMonitoring.trackOperation('transition_update_legacy_session_generic', true, duration);
      }
    } catch (error) {
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('transition_update_session_generic', false, duration);
      console.error('❌ Error generic updating session via transition service:', error);
      throw error;
    }
  }
  
  /**
   * Bulk update project ID for task sessions (routes to both UTC and legacy)
   */
  async updateWorkSessionsProjectId(userId: string, taskId: string, newProjectId: string): Promise<number> {
    const startTime = performance.now();
    
    try {
      let totalUpdated = 0;
      
      // Update UTC sessions
      const utcUpdated = await workSessionServiceUTC.updateWorkSessionsProjectId(userId, taskId, newProjectId);
      totalUpdated += utcUpdated;
      
      // Update legacy sessions
      const legacyUpdated = await workSessionService.updateWorkSessionsProjectId(userId, taskId, newProjectId);
      totalUpdated += legacyUpdated;
      
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('transition_bulk_update_project_id', true, duration);
      
      console.log(`✅ Bulk updated project ID for task ${taskId}: ${utcUpdated} UTC + ${legacyUpdated} legacy = ${totalUpdated} total sessions`);
      
      return totalUpdated;
    } catch (error) {
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('transition_bulk_update_project_id', false, duration);
      console.error('❌ Error bulk updating sessions project ID via transition service:', error);
      throw error;
    }
  }
  
  /**
   * Get work sessions by task (routes to both UTC and legacy)
   */
  async getWorkSessionsByTask(userId: string, taskId: string): Promise<any[]> {
    const startTime = performance.now();
    
    try {
      // Get both UTC and legacy sessions
      const [utcSessions, legacySessions] = await Promise.all([
        workSessionServiceUTC.getWorkSessionsByTask(userId, taskId),
        workSessionService.getWorkSessionsByTask(userId, taskId)
      ]);
      
      const totalSessions = [...utcSessions, ...legacySessions];
      
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('transition_get_sessions_by_task', true, duration);
      
      console.log(`📋 Found ${utcSessions.length} UTC + ${legacySessions.length} legacy = ${totalSessions.length} total sessions for task ${taskId}`);
      
      return totalSessions;
    } catch (error) {
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('transition_get_sessions_by_task', false, duration);
      console.error('❌ Error getting sessions by task via transition service:', error);
      throw error;
    }
  }
  
  /**
   * Delete work sessions by task (cascade delete - routes to both UTC and legacy)
   */
  async deleteWorkSessionsByTask(userId: string, taskId: string): Promise<number> {
    const startTime = performance.now();
    
    try {
      let totalDeleted = 0;
      
      // Delete UTC sessions
      const utcDeleted = await workSessionServiceUTC.deleteWorkSessionsByTask(userId, taskId);
      totalDeleted += utcDeleted;
      
      // Delete legacy sessions
      const legacySessions = await workSessionService.getWorkSessionsByTask(userId, taskId);
      if (legacySessions.length > 0) {
        const deletePromises = legacySessions.map(session => 
          workSessionService.deleteWorkSession(session.id)
        );
        await Promise.all(deletePromises);
        totalDeleted += legacySessions.length;
        console.log(`✅ Deleted ${legacySessions.length} legacy work sessions for task ${taskId}`);
      }
      
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('transition_delete_sessions_by_task', true, duration);
      
      console.log(`✅ CASCADE DELETE: Deleted ${utcDeleted} UTC + ${legacySessions.length} legacy = ${totalDeleted} total sessions for task ${taskId}`);
      
      return totalDeleted;
    } catch (error) {
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('transition_delete_sessions_by_task', false, duration);
      console.error('❌ Error deleting sessions by task via transition service:', error);
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
    const dateString = format(localDate, 'yyyy-MM-dd'); // Format in user timezone (fixed bug)
    
    // Use existing legacy service
    return workSessionService.getWorkSessionsByDate(userId, dateString);
  }
  
  /**
   * Get legacy sessions for date range - FIXED to use consistent optimized method
   */
  private async getLegacySessionsForDateRange(
    startDate: Date,
    endDate: Date,
    userId: string,
    userTimezone: string
  ): Promise<WorkSession[]> {
    // 🚀 FIX: Use the same optimized method as the primary path to ensure consistency
    // This prevents fallback query failures when Firebase indexes are missing for updatedAt field
    console.log('📝 Legacy fallback query using OPTIMIZED method (consistent with primary path)');
    return workSessionService.getWorkSessionsForRange(userId, startDate, endDate);
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
      const startTime = performance.now();
      
      try {
        // Legacy sessions store times in local timezone
        let sessionStartTime: Date;
        let sessionEndTime: Date | undefined;
        
        
        // Handle startTime with comprehensive Firebase Timestamp detection
        if (legacySession.startTime) {
          sessionStartTime = this.convertFirebaseTimestampToDate(
            legacySession.startTime, 
            `startTime for session ${legacySession.id}`
          );
        } else {
          // Reconstruct from date string (silent - this is expected for some legacy data)
          sessionStartTime = new Date(legacySession.date + 'T00:00:00');
        }
        
        // Handle endTime similarly
        if (legacySession.endTime) {
          sessionEndTime = this.convertFirebaseTimestampToDate(
            legacySession.endTime,
            `endTime for session ${legacySession.id}`
          );
        }
        
        // Ensure we have valid Date objects
        if (!sessionStartTime || isNaN(sessionStartTime.getTime())) {
          console.warn('Invalid startTime for session', legacySession.id, 'using fallback');
          sessionStartTime = new Date(legacySession.date + 'T00:00:00');
        }
        
        if (sessionEndTime && isNaN(sessionEndTime.getTime())) {
          console.warn('Invalid endTime for session', legacySession.id, 'setting to undefined');
          sessionEndTime = undefined;
        }
        
        const duration = performance.now() - startTime;
        utcMonitoring.trackOperation('convert_legacy_session', true, duration);
        
        return {
          id: legacySession.id,
          userId: legacySession.userId,
          taskId: legacySession.taskId,
          projectId: legacySession.projectId,
          duration: legacySession.duration,
          sessionType: legacySession.sessionType,
          status: legacySession.status,
          notes: legacySession.notes,
          createdAt: this.safelyConvertTimestamp(legacySession.createdAt) || new Date().toISOString(),
          updatedAt: this.safelyConvertTimestamp(legacySession.updatedAt) || new Date().toISOString(),
          startTime: sessionStartTime,
          endTime: sessionEndTime,
          dataSource: 'legacy',
          timezone: userTimezone, // Assume current user timezone
          rawData: legacySession
        };
      } catch (error) {
        const duration = performance.now() - startTime;
        utcMonitoring.trackOperation('convert_legacy_session', false, duration);
        
        console.error('❌ Error converting legacy session to unified format:', {
          sessionId: legacySession.id,
          error: error.message,
          startTime: legacySession.startTime,
          endTime: legacySession.endTime
        });
        
        // Return a safe fallback session
        return {
          id: legacySession.id,
          userId: legacySession.userId,
          taskId: legacySession.taskId,
          projectId: legacySession.projectId,
          duration: legacySession.duration,
          sessionType: legacySession.sessionType,
          status: legacySession.status,
          notes: legacySession.notes,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          startTime: new Date(legacySession.date + 'T00:00:00'), // Safe fallback
          endTime: undefined,
          dataSource: 'legacy',
          timezone: userTimezone,
          rawData: legacySession
        };
      }
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
  
  /**
   * Safely convert Firebase Timestamp to Date with comprehensive error handling
   */
  private convertFirebaseTimestampToDate(timestamp: any, context: string): Date {
    try {
      // Case 1: Already a Date object
      if (timestamp instanceof Date) {
        return timestamp;
      }
      
      // Case 2: Firebase Timestamp with toDate() method
      if (timestamp && typeof timestamp === 'object' && typeof timestamp.toDate === 'function') {
        const dateResult = timestamp.toDate();
        if (dateResult instanceof Date && !isNaN(dateResult.getTime())) {
          return dateResult;
        } else {
          throw new Error('toDate() returned invalid Date');
        }
      }
      
      // Case 3: Firebase Timestamp with seconds/nanoseconds properties
      if (timestamp && typeof timestamp === 'object' && 
          typeof timestamp.seconds === 'number') {
        const milliseconds = timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000;
        const dateResult = new Date(milliseconds);
        if (!isNaN(dateResult.getTime())) {
          return dateResult;
        } else {
          throw new Error('Invalid milliseconds calculated from seconds/nanoseconds');
        }
      }
      
      // Case 4: String timestamp
      if (typeof timestamp === 'string') {
        const dateResult = new Date(timestamp);
        if (!isNaN(dateResult.getTime())) {
          return dateResult;
        } else {
          throw new Error('Invalid string timestamp');
        }
      }
      
      // Case 5: Number timestamp (milliseconds)
      if (typeof timestamp === 'number') {
        const dateResult = new Date(timestamp);
        if (!isNaN(dateResult.getTime())) {
          return dateResult;
        } else {
          throw new Error('Invalid number timestamp');
        }
      }
      
      // Case 6: Unexpected format
      throw new Error(`Unexpected timestamp format: ${typeof timestamp}`);
      
    } catch (error) {
      console.error(`❌ ${context}: Firebase Timestamp conversion failed:`, {
        error: error.message,
        timestampType: typeof timestamp,
        timestampValue: timestamp,
        hasToDate: timestamp && typeof timestamp.toDate === 'function',
        hasSeconds: timestamp && typeof timestamp.seconds === 'number'
      });
      
      // Return current time as fallback
      return new Date();
    }
  }
  
  /**
   * Safely convert any timestamp field to ISO string
   */
  private safelyConvertTimestamp(timestamp: any): string | null {
    if (!timestamp) return null;
    
    try {
      const dateResult = this.convertFirebaseTimestampToDate(timestamp, 'metadata timestamp');
      return dateResult.toISOString();
    } catch (error) {
      console.warn('Failed to convert metadata timestamp:', error);
      return null;
    }
  }
  
  /**
   * Get UTC sessions with database-level date filtering
   */
  private async getUTCSessionsWithDateFilter(
    userId: string,
    startDate: Date,
    endDate: Date,
    userTimezone: string
  ): Promise<UnifiedWorkSession[]> {
    
    const startUTC = timezoneUtils.userTimeToUTC(startDate.toISOString(), userTimezone);
    const endUTC = timezoneUtils.userTimeToUTC(endDate.toISOString(), userTimezone);
    
    console.log('🌍 UTC Query Filter:', {
      userRange: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
      utcRange: `${startUTC.split('T')[0]} to ${endUTC.split('T')[0]}`,
      timezone: userTimezone
    });
    
    try {
      const utcSessions = await workSessionServiceUTC.getSessionsForDateRange(
        startDate, endDate, userId, userTimezone
      );
      
      const unifiedSessions = this.convertUTCSessionsToUnified(utcSessions, userTimezone);
      
      console.log(`✅ UTC OPTIMIZED query: ${unifiedSessions.length} sessions (database filtered)`);
      return unifiedSessions;
      
    } catch (error) {
      console.error('❌ UTC filtered query failed:', error);
      throw error;
    }
  }
  
  /**
   * Get legacy sessions with database-level date filtering
   */
  private async getLegacySessionsWithDateFilter(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<UnifiedWorkSession[]> {
    
    console.log('📝 Legacy Query Filter (NOW OPTIMIZED):', {
      dateRange: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
      strategy: 'database_level_filtering',
      optimizationActive: true
    });
    
    try {
      const legacySessions = await workSessionService.getWorkSessionsForRange(
        userId, startDate, endDate
      );
      
      const unifiedSessions = this.convertLegacySessionsToUnified(legacySessions, timezoneUtils.getCurrentTimezone());
      
      console.log(`✅ Legacy OPTIMIZED query: ${unifiedSessions.length} sessions (database filtered)`);
      return unifiedSessions;
      
    } catch (error) {
      console.error('❌ Legacy filtered query failed:', error);
      throw error;
    }
  }
  
  /**
   * Get sessions from both systems with date filtering (for transition users)
   */
  private async getDualModeWithDateFilter(
    userId: string,
    startDate: Date,
    endDate: Date,
    userTimezone: string
  ): Promise<UnifiedWorkSession[]> {
    
    console.log('🔄 Dual Mode Query Filter:', {
      dateRange: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
      strategy: 'parallel_filtered_queries'
    });
    
    try {
      // Run both queries in parallel with date filtering
      const [utcSessions, legacySessions] = await Promise.all([
        this.getUTCSessionsWithDateFilter(userId, startDate, endDate, userTimezone).catch(error => {
          console.warn('UTC query failed in dual mode:', error);
          return [];
        }),
        this.getLegacySessionsWithDateFilter(userId, startDate, endDate).catch(error => {
          console.warn('Legacy query failed in dual mode:', error);
          return [];
        })
      ]);
      
      // Simple deduplication: prefer UTC sessions over legacy
      const legacyIds = new Set(legacySessions.map(s => s.id));
      const filteredLegacy = legacySessions.filter(legacy => {
        // Check if this legacy session exists as UTC (basic deduplication)
        const hasUTCVersion = utcSessions.some(utc => 
          utc.id === legacy.id ||
          (Math.abs(utc.startTime.getTime() - legacy.startTime.getTime()) < 60000 && 
           utc.duration === legacy.duration)
        );
        return !hasUTCVersion;
      });
      
      const combinedSessions = [...utcSessions, ...filteredLegacy];
      
      console.log(`✅ Dual mode filtered: ${utcSessions.length} UTC + ${filteredLegacy.length} legacy = ${combinedSessions.length} total`);
      return combinedSessions;
      
    } catch (error) {
      console.error('❌ Dual mode filtered query failed:', error);
      throw error;
    }
  }
  
  /**
   * Get optimization strategy description for logging
   */
  private getOptimizationStrategy(transitionMode: string): string {
    switch (transitionMode) {
      case 'utc-only': return 'SINGLE_UTC_QUERY';
      case 'disabled': return 'SINGLE_LEGACY_QUERY';
      case 'dual': return 'DUAL_FILTERED_QUERIES';
      default: return 'FALLBACK_TO_DUAL';
    }
  }

  /**
   * Helper method to determine query range type for audit
   */
  private determineRangeType(startDate: Date, endDate: Date): string {
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 1) return 'single_day';
    if (diffDays <= 7) return 'week';
    if (diffDays <= 31) return 'month';
    if (diffDays <= 365) return 'year';
    return 'all_time';
  }
  
  /**
   * Determine if a query could benefit from date-range optimization
   */
  private isQueryOptimizable(rangeType: string, sessionsReturned: number): boolean {
    // Queries that fetch small subsets of data are highly optimizable
    if (rangeType === 'single_day' || rangeType === 'week') return true;
    if (rangeType === 'month' && sessionsReturned < 1000) return true;
    if (rangeType === 'all_time' && sessionsReturned > 100) return true;
    return false;
  }
  
  /**
   * Estimate potential query waste reduction
   */
  private calculateQueryWaste(rangeType: string, sessionsReturned: number): string {
    // Estimate based on typical user patterns
    let estimatedTotalSessions = sessionsReturned;
    
    switch (rangeType) {
      case 'single_day':
        estimatedTotalSessions = sessionsReturned * 365; // Daily vs yearly
        break;
      case 'week':
        estimatedTotalSessions = sessionsReturned * 52; // Weekly vs yearly
        break;
      case 'month':
        estimatedTotalSessions = sessionsReturned * 12; // Monthly vs yearly
        break;
      default:
        return 'minimal'; // All time queries need most data
    }
    
    const wastePercentage = ((estimatedTotalSessions - sessionsReturned) / estimatedTotalSessions * 100);
    
    if (wastePercentage > 95) return 'extreme';
    if (wastePercentage > 80) return 'high';
    if (wastePercentage > 50) return 'moderate';
    return 'low';
  }
}

// Export singleton instance
export const transitionQueryService = new TransitionQueryService();