import { unifiedTimezoneService } from './unifiedTimezoneService';
import { utcFeatureFlags } from './featureFlags';
import { utcMonitoring } from './monitoring';
import type { WorkSession } from '../types/models';

interface CalendarEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  description?: string;
  timezone?: string;
}

interface UTCWorkSession extends WorkSession {
  startTimeUTC: string;
  endTimeUTC?: string;
  timezoneContext: {
    userTimezone: string;
    utcOffset: number;
    isDST: boolean;
  };
}

/**
 * Calendar Compatibility Layer
 * Ensures calendar sync works with both legacy and UTC work sessions
 */
export class CalendarCompatibilityLayer {
  
  /**
   * Convert work session to calendar event (handles both legacy and UTC)
   */
  static workSessionToCalendarEvent(
    session: WorkSession | UTCWorkSession,
    userTimezone?: string
  ): CalendarEvent {
    const timezone = userTimezone || unifiedTimezoneService.getUserTimezone();
    
    // Check if this is a UTC session
    const isUTCSession = 'startTimeUTC' in session && session.startTimeUTC;
    
    let startTime: Date;
    let endTime: Date;
    
    if (isUTCSession) {
      // Convert UTC timestamps to user timezone for calendar display
      const utcSession = session as UTCWorkSession;
      const displaySession = unifiedTimezoneService.convertUTCSessionForDisplay(
        utcSession,
        timezone
      );
      
      startTime = displaySession.displayStartTime || utcSession.startTime;
      endTime = displaySession.displayEndTime || utcSession.endTime || 
        new Date(startTime.getTime() + (utcSession.duration || 25) * 60000);
    } else {
      // Legacy session - use existing timestamps
      startTime = session.startTime;
      endTime = session.endTime || 
        new Date(session.startTime.getTime() + (session.duration || 25) * 60000);
    }

    return {
      id: `work-session-${session.id}`,
      title: `Focus Session${session.taskId ? ` - Task ${session.taskId}` : ''}`,
      startTime,
      endTime,
      description: session.notes || `Work session (${session.duration || 25} minutes)`,
      timezone
    };
  }

  /**
   * Convert calendar event to work session (creates UTC-compatible session)
   */
  static calendarEventToWorkSession(
    event: CalendarEvent,
    userId: string,
    taskId?: string,
    projectId?: string
  ): WorkSession | UTCWorkSession {
    const timezone = event.timezone || unifiedTimezoneService.getUserTimezone();
    const duration = Math.round((event.endTime.getTime() - event.startTime.getTime()) / 60000);
    
    // Check if UTC features are enabled
    const utcEnabled = utcFeatureFlags.isFeatureEnabled('utcCalendarSync', userId);
    
    const baseSession = {
      id: `cal-${event.id}-${Date.now()}`,
      userId,
      taskId: taskId || '',
      projectId: projectId || '',
      duration,
      sessionType: 'focus' as const,
      status: 'completed' as const,
      notes: event.description,
      date: event.startTime.toISOString().split('T')[0],
      startTime: event.startTime,
      endTime: event.endTime,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (utcEnabled) {
      // Create UTC-compatible session
      const utcSession: UTCWorkSession = {
        ...baseSession,
        startTimeUTC: event.startTime.toISOString(),
        endTimeUTC: event.endTime.toISOString(),
        createdAtUTC: new Date().toISOString(),
        updatedAtUTC: new Date().toISOString(),
        timezoneContext: unifiedTimezoneService.createTimezoneContext(timezone)
      };
      
      return utcSession;
    } else {
      // Return legacy session
      return baseSession;
    }
  }

  /**
   * Sync work sessions to calendar with timezone awareness
   */
  static async syncSessionsToCalendar(
    sessions: (WorkSession | UTCWorkSession)[],
    calendarService: any, // Google Calendar API service
    userTimezone?: string
  ): Promise<{ 
    synced: number; 
    failed: number; 
    errors: string[]; 
  }> {
    const timezone = userTimezone || unifiedTimezoneService.getUserTimezone();
    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    console.log('📅 Starting calendar sync:', {
      sessionsCount: sessions.length,
      timezone,
      utcSessionsCount: sessions.filter(s => 'startTimeUTC' in s).length,
      legacySessionsCount: sessions.filter(s => !('startTimeUTC' in s)).length
    });

    for (const session of sessions) {
      try {
        const calendarEvent = this.workSessionToCalendarEvent(session, timezone);
        
        // Sync to calendar (implementation depends on calendar service)
        await calendarService.createEvent(calendarEvent);
        
        synced++;
        
        utcMonitoring.trackOperation('calendar_sync_session', true);
        
      } catch (error) {
        failed++;
        const errorMsg = `Session ${session.id}: ${error.message}`;
        errors.push(errorMsg);
        
        console.error('❌ Calendar sync failed for session:', session.id, error);
        utcMonitoring.trackOperation('calendar_sync_session', false);
      }
    }

    console.log('📅 Calendar sync completed:', {
      synced,
      failed,
      errorCount: errors.length
    });

    return { synced, failed, errors };
  }

  /**
   * Import calendar events as work sessions with UTC support
   */
  static async importCalendarEvents(
    events: CalendarEvent[],
    userId: string,
    workSessionService: any,
    userTimezone?: string
  ): Promise<{
    imported: number;
    failed: number;
    errors: string[];
  }> {
    const timezone = userTimezone || unifiedTimezoneService.getUserTimezone();
    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    console.log('📅 Starting calendar import:', {
      eventsCount: events.length,
      timezone
    });

    for (const event of events) {
      try {
        // Convert calendar event to work session
        const workSession = this.calendarEventToWorkSession(
          event,
          userId,
          undefined, // taskId - can be parsed from event title if needed
          undefined  // projectId - can be parsed from event description if needed
        );

        // Create work session using appropriate service
        const utcEnabled = utcFeatureFlags.isFeatureEnabled('utcCalendarSync', userId);
        
        if (utcEnabled) {
          const { workSessionServiceUTC } = await import('./workSessionServiceUTC');
          await workSessionServiceUTC.createWorkSession(workSession, userId, 'web');
        } else {
          const { workSessionService: legacyService } = await import('../api/workSessionService');
          await legacyService.createWorkSession(workSession as WorkSession);
        }

        imported++;
        
        utcMonitoring.trackOperation('calendar_import_event', true);
        
      } catch (error) {
        failed++;
        const errorMsg = `Event ${event.id}: ${error.message}`;
        errors.push(errorMsg);
        
        console.error('❌ Calendar import failed for event:', event.id, error);
        utcMonitoring.trackOperation('calendar_import_event', false);
      }
    }

    console.log('📅 Calendar import completed:', {
      imported,
      failed,
      errorCount: errors.length
    });

    return { imported, failed, errors };
  }

  /**
   * Handle timezone changes in calendar sync
   */
  static async handleCalendarTimezoneChange(
    oldTimezone: string,
    newTimezone: string,
    userId: string,
    calendarService: any
  ): Promise<void> {
    try {
      console.log('📅 Handling calendar timezone change:', {
        from: oldTimezone,
        to: newTimezone,
        userId
      });

      // Update calendar timezone preference
      if (calendarService.updateTimezone) {
        await calendarService.updateTimezone(newTimezone);
      }

      // Re-sync recent sessions with new timezone
      const { workSessionServiceUTC } = await import('./workSessionServiceUTC');
      const recentSessions = await workSessionServiceUTC.getSessionsByDateRange(
        userId,
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        new Date(),
        newTimezone
      );

      if (recentSessions.length > 0) {
        await this.syncSessionsToCalendar(recentSessions, calendarService, newTimezone);
      }

      utcMonitoring.trackOperation('calendar_timezone_change', true);
      
    } catch (error) {
      console.error('❌ Calendar timezone change handling failed:', error);
      utcMonitoring.trackOperation('calendar_timezone_change', false);
      throw error;
    }
  }

  /**
   * Validate calendar sync compatibility
   */
  static validateCalendarCompatibility(): {
    isCompatible: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check timezone service availability
    try {
      const timezone = unifiedTimezoneService.getUserTimezone();
      if (!timezone || timezone === 'UTC') {
        issues.push('User timezone not properly configured');
        recommendations.push('Set user timezone in settings');
      }
    } catch (error) {
      issues.push('Timezone service not available');
      recommendations.push('Initialize unified timezone service');
    }

    // Check feature flag service
    try {
      const testFlag = utcFeatureFlags.isFeatureEnabled('utcCalendarSync', 'test');
      // If this doesn't throw, feature flags are working
    } catch (error) {
      issues.push('Feature flag service not available');
      recommendations.push('Initialize UTC feature flags');
    }

    return {
      isCompatible: issues.length === 0,
      issues,
      recommendations
    };
  }

  /**
   * Emergency fallback: Convert UTC session to legacy format for calendar
   */
  static utcToLegacyForCalendar(utcSession: UTCWorkSession): WorkSession {
    return {
      id: utcSession.id,
      userId: utcSession.userId,
      taskId: utcSession.taskId,
      projectId: utcSession.projectId,
      duration: utcSession.duration,
      sessionType: utcSession.sessionType,
      status: utcSession.status,
      notes: utcSession.notes,
      date: utcSession.date,
      startTime: utcSession.startTime,
      endTime: utcSession.endTime,
      createdAt: utcSession.createdAt,
      updatedAt: utcSession.updatedAt
    };
  }
}

// Export singleton pattern for consistency
export const calendarCompatibilityLayer = CalendarCompatibilityLayer;