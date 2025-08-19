import {
  collection,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  onSnapshot,
  getDoc,
  setDoc,
  increment
} from 'firebase/firestore';
import { db } from './firebase';
import type { WorkSession } from '../types/models';
import { toLocalISOString } from '../utils/timeUtils';
import { timezoneUtils, type TimezoneContext } from '../utils/timezoneUtils';
import { format } from 'date-fns';

const WORK_SESSIONS_COLLECTION = 'workSessions';

// Helper function to safely convert Firebase Timestamp to Date
const safeToDate = (timestamp: any): Date => {
  if (!timestamp) {
    return new Date(); // Return current date if undefined
  }
  
  if (timestamp instanceof Date) {
    return timestamp; // Already a Date object
  }
  
  if (timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate(); // Firebase Timestamp
  }
  
  // If it's a string or number, try to parse it
  if (typeof timestamp === 'string' || typeof timestamp === 'number') {
    const parsed = new Date(timestamp);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }
  
  return new Date(); // Fallback
};

export class WorkSessionService {
  private workSessionsCollection = collection(db, WORK_SESSIONS_COLLECTION);

  /**
   * Create a new work session with UTC timezone support (enhanced legacy system)
   */
  async createWorkSession(sessionData: Omit<WorkSession, 'id' | 'createdAt' | 'updatedAt'>, userTimezone?: string): Promise<string> {
    try {
      
      // Generate unique session ID with timestamp
      const timestamp = new Date().getTime();
      const sessionId = `${sessionData.taskId}_${sessionData.date}_${timestamp}`;
      const sessionRef = doc(this.workSessionsCollection, sessionId);

      // Get user's timezone context - use user preference instead of physical timezone
      const timezone = userTimezone || timezoneUtils.getCurrentTimezone();
      
      
      const timezoneContext = timezoneUtils.createTimezoneContext(timezone, 'browser');
      
      
      // Enhanced session with UTC timezone support
      const sessionWithUTC: WorkSession & {
        // UTC timezone fields (new)
        startTimeUTC?: string;
        endTimeUTC?: string;
        timezoneContext?: TimezoneContext;
        createdAtUTC?: string;
        updatedAtUTC?: string;
      } = {
        ...sessionData,
        id: sessionId,
        status: sessionData.status || 'completed',
        // Legacy fields (maintain compatibility)
        createdAt: new Date(),
        updatedAt: new Date(),
        // UTC timezone fields (new enhancement)
        startTimeUTC: sessionData.startTime ? timezoneUtils.userTimeToUTC(sessionData.startTime, timezone) : timezoneUtils.getCurrentUTC(),
        timezoneContext,
        createdAtUTC: timezoneUtils.getCurrentUTC(),
        updatedAtUTC: timezoneUtils.getCurrentUTC()
      };

      // Only add endTimeUTC if endTime exists (avoid undefined values in Firebase)
      if (sessionData.endTime) {
        sessionWithUTC.endTimeUTC = timezoneUtils.userTimeToUTC(sessionData.endTime, timezone);
      }

      // Filter out any undefined values to prevent Firebase errors
      const newSession = Object.fromEntries(
        Object.entries(sessionWithUTC).filter(([_, value]) => value !== undefined)
      );


      await setDoc(sessionRef, newSession);
      
      console.log('🌍 Enhanced legacy session created with UTC support:', {
        sessionId,
        timezone: userTimezone,
        startTimeUTC: newSession.startTimeUTC,
        localStartTime: newSession.startTime,
        hasTimezoneContext: !!newSession.timezoneContext
      });
      
      return sessionId;
    } catch (error) {
      console.error('Error creating enhanced work session:', error);
      throw error;
    }
  }

  /**
   * Safe session creation with simple deduplication
   */
  async createActiveSessionSafe(
    taskId: string,
    projectId: string,
    userId: string,
    sessionType: 'pomodoro' | 'shortBreak' | 'longBreak',
    userTimezone?: string
  ): Promise<string> {
    try {
      // Check for existing active session for this task/type combination
      const activeSessions = await this.getActiveSessions(userId);
      const existingSession = activeSessions.find(session => 
        session.taskId === taskId && 
        session.sessionType === sessionType &&
        session.status === 'active'
      );
      
      if (existingSession) {
        console.log('🔍 Reusing existing active session:', existingSession.id);
        return existingSession.id;
      }
      
      // Create new session only if no duplicate exists
      console.log('✅ Creating new active session');
      return await this.createActiveSession(taskId, projectId, userId, sessionType, userTimezone);
      
    } catch (error) {
      console.error('Error in safe session creation:', error);
      throw error;
    }
  }

  /**
   * Create an active work session for timer with UTC timezone support
   */
  async createActiveSession(
    taskId: string,
    projectId: string,
    userId: string,
    sessionType: 'pomodoro' | 'shortBreak' | 'longBreak',
    userTimezone?: string
  ): Promise<string> {
    try {
      const now = new Date();
      const timezone = userTimezone || timezoneUtils.getCurrentTimezone();
      const userNow = timezoneUtils.utcToUserTime(now.toISOString(), timezone);
      
      const sessionData: Omit<WorkSession, 'id' | 'createdAt' | 'updatedAt'> = {
        userId,
        taskId,
        projectId,
        // Legacy compatibility: store local date string for existing queries
        // Format date in user's timezone (not UTC) to avoid timezone conversion bugs
        date: format(userNow, 'yyyy-MM-dd'),
        duration: 0,
        sessionType,
        status: 'active',
        startTime: now, // Legacy field (local time)
        notes: `${sessionType} session started`
      };

      const sessionId = await this.createWorkSession(sessionData, timezone);
      
      console.log('🎯 Enhanced active session created:', {
        sessionId,
        sessionType,
        timezone,
        localDate: sessionData.date,
        startTime: now.toISOString()
      });
      
      return sessionId;
    } catch (error) {
      console.error('Error creating enhanced active session:', error);
      throw error;
    }
  }

  /**
   * Update session status and duration with UTC timezone support
   */
  async updateSession(
    sessionId: string,
    updates: Partial<Pick<WorkSession, 'duration' | 'status' | 'endTime' | 'notes'>>
  ): Promise<void> {
    try {
      const sessionRef = doc(this.workSessionsCollection, sessionId);
      const userTimezone = timezoneUtils.getCurrentTimezone();
      
      // Enhanced update data with UTC timezone support
      const updateData: any = {
        ...updates,
        // Legacy fields (maintain compatibility)
        updatedAt: new Date(),
        // UTC timezone fields (new enhancement)
        updatedAtUTC: timezoneUtils.getCurrentUTC()
      };

      // If endTime is being updated, also set endTimeUTC
      if (updates.endTime) {
        updateData.endTimeUTC = timezoneUtils.userTimeToUTC(updates.endTime, userTimezone);
      }

      // Filter out any undefined values to prevent Firebase errors
      const cleanUpdateData = Object.fromEntries(
        Object.entries(updateData).filter(([_, value]) => value !== undefined)
      );

      await updateDoc(sessionRef, cleanUpdateData);
      
      console.log('🌍 Enhanced legacy session updated with UTC support:', {
        sessionId,
        timezone: userTimezone,
        hasEndTime: !!updates.endTime,
        endTimeUTC: updateData.endTimeUTC
      });
    } catch (error) {
      console.error('Error updating session:', error);
      throw error;
    }
  }

  /**
   * Increment session duration by specified minutes with UTC timezone support
   */
  async incrementDuration(
    sessionId: string,
    minutesToAdd: number
  ): Promise<void> {
    try {
      const sessionRef = doc(this.workSessionsCollection, sessionId);
      
      // Enhanced update data with UTC timezone support
      const updateData = {
        duration: increment(minutesToAdd),
        // Legacy fields (maintain compatibility)
        updatedAt: new Date(),
        // UTC timezone fields (new enhancement)
        updatedAtUTC: timezoneUtils.getCurrentUTC()
      };

      await updateDoc(sessionRef, updateData);
      
      console.log('🌍 Enhanced legacy session duration incremented with UTC support:', {
        sessionId,
        minutesToAdd,
        updatedAtUTC: updateData.updatedAtUTC
      });
    } catch (error) {
      console.error('Error incrementing session duration:', error);
      throw error;
    }
  }

  /**
   * Complete a session with final duration and status (UTC timezone support)
   */
  async completeSession(
    sessionId: string,
    duration: number,
    status: 'completed' | 'paused' | 'switched',
    notes?: string
  ): Promise<void> {
    try {
      const endTime = new Date();
      
      await this.updateSession(sessionId, {
        duration,
        status,
        endTime,
        notes: notes || `Session ${status}: ${duration}m`
      });
      
      console.log('🌍 Enhanced legacy session completed with UTC support:', {
        sessionId,
        duration,
        status,
        endTime: endTime.toISOString()
      });
    } catch (error) {
      console.error('Error completing session:', error);
      throw error;
    }
  }

  /**
   * Get active sessions for cleanup
   */
  async getActiveSessions(userId: string): Promise<WorkSession[]> {
    try {
      const q = query(
        this.workSessionsCollection,
        where('userId', '==', userId),
        where('status', '==', 'active'),
        orderBy('updatedAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: safeToDate(data.createdAt),
          updatedAt: safeToDate(data.updatedAt),
          startTime: data.startTime ? safeToDate(data.startTime) : undefined,
          endTime: data.endTime ? safeToDate(data.endTime) : undefined,
        };
      }) as WorkSession[];
    } catch (error) {
      console.error('Error fetching active sessions:', error);
      return [];
    }
  }

  /**
   * Cleanup orphaned sessions on app restart
   */
  async cleanupOrphanedSessions(userId: string, cutoffMinutes: number = 60): Promise<number> {
    try {
      const activeSessions = await this.getActiveSessions(userId);
      const cutoffTime = new Date(Date.now() - cutoffMinutes * 60 * 1000);
      let cleanedCount = 0;

      for (const session of activeSessions) {
        const sessionAge = new Date(session.updatedAt);
        
        if (sessionAge < cutoffTime) {
        if (session.duration > 0) {
          // Meaningful work - complete with existing duration only
          await this.completeSession(
            session.id,
            session.duration,
            'completed',
            `Session completed: ${session.duration}m (app restart cleanup)`
          );
          console.log(`✅ Completed meaningful session: ${session.id} (${session.duration}m)`);
        } else {
          // No meaningful work - delete the orphaned session
          await this.deleteWorkSession(session.id);
          console.log(`🗑️ Deleted empty orphaned session: ${session.id}`);
        }
          
          cleanedCount++;
        }
      }

      return cleanedCount;
    } catch (error) {
      console.error('Error cleaning up orphaned sessions:', error);
      return 0;
    }
  }

  /**
   * Legacy upsert method - enhanced with UTC timezone support for manual time tracking
   */
  async upsertWorkSession(
    sessionData: Omit<WorkSession, 'id' | 'createdAt' | 'updatedAt' | 'duration' | 'sessionType' | 'status'>, 
    durationChange = 0,
    sessionType: WorkSession['sessionType'] = 'manual',
    userTimezone?: string
  ): Promise<string> {
    try {
      const timezone = userTimezone || timezoneUtils.getCurrentTimezone();
      const now = new Date();
      
      // Create a new session instead of updating existing one
      const workSession: Omit<WorkSession, 'id' | 'createdAt' | 'updatedAt'> = {
        ...sessionData,
        duration: durationChange, // Preserve the sign: positive for additions, negative for reductions
        sessionType,
        status: 'completed', // Manual sessions are always completed
        startTime: now, // Set current time as start time
        endTime: now, // Set current time as end time for manual entries
        notes: sessionType === 'manual' ? 
          (durationChange > 0 ? `Manual time addition: +${durationChange}m` : `Manual time reduction: ${durationChange}m`) :
          `${sessionType} session completed`
      };

      const sessionId = await this.createWorkSession(workSession, timezone);
      
      console.log('🌍 Enhanced legacy manual session created with UTC support:', {
        sessionId,
        sessionType,
        durationChange,
        timezone: timezone,
        isManualEntry: sessionType === 'manual'
      });

      return sessionId;
    } catch (error) {
      console.error('Error upserting work session:', error);
      throw error;
    }
  }

  /**
   * Get work sessions for a user within a date range
   */
  async getWorkSessionsByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<WorkSession[]> {
    try {
      const q = query(
        this.workSessionsCollection,
        where('userId', '==', userId),
        where('updatedAt', '>=', Timestamp.fromDate(startDate)),
        where('updatedAt', '<=', Timestamp.fromDate(endDate)),
        orderBy('updatedAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: safeToDate(data.createdAt),
          updatedAt: safeToDate(data.updatedAt),
        };
      }) as WorkSession[];
    } catch (error) {
      console.error('Error fetching work sessions:', error);
      throw error;
    }
  }

  /**
   * Get work sessions for a specific task
   */
  async getWorkSessionsByTask(userId: string, taskId: string): Promise<WorkSession[]> {
    try {
      // Remove orderBy to avoid index requirements - we don't need sorting for deletion
      const q = query(
        this.workSessionsCollection,
        where('userId', '==', userId),
        where('taskId', '==', taskId)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: safeToDate(data.createdAt),
          updatedAt: safeToDate(data.updatedAt),
        };
      }) as WorkSession[];
    } catch (error) {
      console.error('Error fetching task work sessions:', error);
      throw error;
    }
  }

  /**
   * Get work sessions for a specific project
   */
  async getWorkSessionsByProject(userId: string, projectId: string): Promise<WorkSession[]> {
    try {
      const q = query(
        this.workSessionsCollection,
        where('userId', '==', userId),
        where('projectId', '==', projectId),
        orderBy('updatedAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: safeToDate(data.createdAt),
          updatedAt: safeToDate(data.updatedAt),
        };
      }) as WorkSession[];
    } catch (error) {
      console.error('Error fetching project work sessions:', error);
      throw error;
    }
  }

  /**
   * Update the projectId for all work sessions of a specific task
   * Used when a task is moved to a different project
   */
  async updateWorkSessionsProjectId(userId: string, taskId: string, newProjectId: string): Promise<number> {
    try {
      // Get all work sessions for this task
      const workSessions = await this.getWorkSessionsByTask(userId, taskId);
      
      if (workSessions.length === 0) {
        return 0; // No sessions to update
      }

      // Update each session with the new projectId
      const updatePromises = workSessions.map(async (session) => {
        const sessionRef = doc(this.workSessionsCollection, session.id);
        return updateDoc(sessionRef, {
          projectId: newProjectId,
          updatedAt: new Date()
        });
      });

      await Promise.all(updatePromises);
      
      console.log(`✅ Updated ${workSessions.length} work sessions for task ${taskId} to project ${newProjectId}`);
      return workSessions.length;
    } catch (error) {
      console.error('Error updating work sessions project ID:', error);
      throw error;
    }
  }

  /**
   * Delete a work session
   */
  async deleteWorkSession(sessionId: string): Promise<void> {
    try {
      const sessionRef = doc(this.workSessionsCollection, sessionId);
      await deleteDoc(sessionRef);
    } catch (error) {
      console.error('Error deleting work session:', error);
      throw error;
    }
  }

  /**
   * Listen to work sessions for real-time updates
   */
  subscribeToWorkSessions(
    userId: string,
    callback: (sessions: WorkSession[]) => void
  ): () => void {
    // Simplified query - only filter by userId to avoid index requirements
    // We'll filter by date range in memory
    const q = query(
      this.workSessionsCollection,
      where('userId', '==', userId),
    );

    return onSnapshot(q, (querySnapshot) => {
      const sessions = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: safeToDate(data.createdAt),
          updatedAt: safeToDate(data.updatedAt),
        };
      }) as WorkSession[];

      callback(sessions);
    });
  }

  /**
   * Get work sessions for a specific date range with timezone-aware filtering
   * Used by Productivity Insight page for efficient data loading
   */
  async getWorkSessionsForRange(
    userId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<WorkSession[]> {
    try {
      const userTimezone = timezoneUtils.getCurrentTimezone();
      
      // Convert user's date range to UTC for proper comparison
      const startDateUTC = timezoneUtils.userTimeToUTC(startDate.toISOString(), userTimezone);
      const endDateUTC = timezoneUtils.userTimeToUTC(endDate.toISOString(), userTimezone);
      
      console.log('WorkSessionService - Loading sessions with timezone-aware filtering:', {
        userId,
        userTimezone,
        userStartDate: format(startDate, 'yyyy-MM-dd'),
        userEndDate: format(endDate, 'yyyy-MM-dd'),
        utcStartDate: startDateUTC.split('T')[0],
        utcEndDate: endDateUTC.split('T')[0]
      });
      
      // 🚀 OPTIMIZED: Use database-level date filtering instead of memory filtering
      console.log('WorkSessionService - Using DATABASE-LEVEL date filtering (OPTIMIZED)');
      
      // Try UTC field first (for enhanced sessions), fallback to date field (legacy sessions)
      let q;
      let queryStrategy = '';
      
      try {
        // Strategy 1: Query by startTimeUTC field (enhanced sessions)
        q = query(
          this.workSessionsCollection,
          where('userId', '==', userId),
          where('startTimeUTC', '>=', startDateUTC),
          where('startTimeUTC', '<=', endDateUTC),
          orderBy('startTimeUTC', 'desc')
        );
        queryStrategy = 'UTC_FIELD_FILTERING';
        
        console.log('Trying UTC field query strategy:', {
          startTimeUTC_gte: startDateUTC,
          startTimeUTC_lte: endDateUTC
        });
        
      } catch (error) {
        console.warn('UTC field query failed, falling back to date field:', error);
        
        // Strategy 2: Query by date field (legacy sessions)
        const startDateStr = format(startDate, 'yyyy-MM-dd');
        const endDateStr = format(endDate, 'yyyy-MM-dd');
        
        q = query(
          this.workSessionsCollection,
          where('userId', '==', userId),
          where('date', '>=', startDateStr),
          where('date', '<=', endDateStr),
          orderBy('date', 'desc')
        );
        queryStrategy = 'DATE_FIELD_FILTERING';
        
        console.log('Using date field query strategy:', {
          date_gte: startDateStr,
          date_lte: endDateStr
        });
      }
      
      const querySnapshot = await getDocs(q);
      const sessions = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: safeToDate(data.createdAt),
          updatedAt: safeToDate(data.updatedAt),
        };
      }) as WorkSession[];
      
      // 🎯 OPTIMIZATION COMPLETE: Sessions are already filtered by database!
      // No more memory filtering needed - database did the work
      
      console.log('WorkSessionService - DATABASE OPTIMIZATION RESULTS:', {
        queryStrategy,
        sessionsFromDatabase: sessions.length,
        noMemoryFilteringNeeded: true,
        optimizationActive: true
      });
      
      // Database already sorted by orderBy clause, but ensure consistency
      sessions.sort((a, b) => {
        if (a.startTimeUTC && b.startTimeUTC) {
          // Both have UTC times
          return b.startTimeUTC.localeCompare(a.startTimeUTC);
        } else {
          // Fall back to date field comparison
          return b.date.localeCompare(a.date);
        }
      });
      
      console.log('WorkSessionService - OPTIMIZATION SUCCESS:', {
        queryStrategy,
        sessionsReturned: sessions.length,
        enhancedSessions: sessions.filter(s => s.startTimeUTC).length,
        legacySessions: sessions.filter(s => !s.startTimeUTC).length,
        databaseFiltered: true,
        memoryFiltered: false
      });
      
      return sessions;
    } catch (error) {
      console.error('Error getting work sessions for range:', error);
      throw error;
    }
  }

  /**
   * Get ALL work sessions for a user (no limits)
   * Used for "All time" filter in dashboard
   */
  async getAllWorkSessions(userId: string): Promise<WorkSession[]> {
    try {
      console.log('WorkSessionService - Loading ALL sessions for user:', userId);
      
      // 🚀 OPTIMIZED: Add ordering to database query (better than memory sorting)
      const q = query(
        this.workSessionsCollection,
        where('userId', '==', userId),
        orderBy('date', 'desc') // Use database ordering instead of memory sorting
      );
      
      const querySnapshot = await getDocs(q);
      const sessions = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: safeToDate(data.createdAt),
          updatedAt: safeToDate(data.updatedAt),
        };
      }) as WorkSession[];
      
      // 🎯 OPTIMIZATION: No memory sorting needed - database handles ordering
      
      console.log('WorkSessionService - Loaded ALL sessions:', sessions.length);
      return sessions;
    } catch (error) {
      console.error('Error getting all work sessions:', error);
      throw error;
    }
  }

  /**
   * Get work sessions for a specific date in user's timezone (timezone-aware)
   */
  async getWorkSessionsByDate(userId: string, dateString: string): Promise<WorkSession[]> {
    try {
      const userTimezone = timezoneUtils.getCurrentTimezone();
      
      // Convert user's date to UTC range for proper comparison
      const startOfDay = new Date(dateString + 'T00:00:00');
      const endOfDay = new Date(dateString + 'T23:59:59');
      const startOfDayUTC = timezoneUtils.userTimeToUTC(startOfDay.toISOString(), userTimezone);
      const endOfDayUTC = timezoneUtils.userTimeToUTC(endOfDay.toISOString(), userTimezone);
      
      console.log('WorkSessionService - Loading sessions for date with timezone awareness:', {
        userId,
        userDate: dateString,
        userTimezone,
        utcRange: `${startOfDayUTC.split('T')[0]} to ${endOfDayUTC.split('T')[0]}`
      });
      
      // Get all sessions for the user (we'll filter by timezone in memory)
      const q = query(
        this.workSessionsCollection,
        where('userId', '==', userId)
      );
      
      const querySnapshot = await getDocs(q);
      const allSessions = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: safeToDate(data.createdAt),
          updatedAt: safeToDate(data.updatedAt),
        };
      }) as WorkSession[];
      
      // Filter sessions based on timezone-aware date comparison
      const filteredSessions = allSessions.filter(session => {
        // Use UTC fields if available (enhanced sessions), otherwise fall back to legacy logic
        if (session.startTimeUTC) {
          // Enhanced session: compare UTC times directly
          const sessionStartUTC = session.startTimeUTC;
          return sessionStartUTC >= startOfDayUTC && sessionStartUTC <= endOfDayUTC;
        } else {
          // Legacy session: use date field
          return session.date === dateString;
        }
      });
      
      console.log('WorkSessionService - Date filtering result:', {
        totalSessions: allSessions.length,
        filteredSessions: filteredSessions.length,
        enhancedSessions: filteredSessions.filter(s => s.startTimeUTC).length,
        legacySessions: filteredSessions.filter(s => !s.startTimeUTC).length
      });
      
      return filteredSessions;
    } catch (error) {
      console.error('Error getting work sessions for date:', error);
      throw error;
    }
  }

  /**
   * Get recent work sessions (last N sessions)
   */
  async getRecentWorkSessions(userId: string, limitCount: number = 50): Promise<WorkSession[]> {
    try {
      const q = query(
        this.workSessionsCollection,
        where('userId', '==', userId),
        orderBy('updatedAt', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: safeToDate(data.createdAt),
          updatedAt: safeToDate(data.updatedAt),
        };
      }) as WorkSession[];
    } catch (error) {
      console.error('Error fetching recent work sessions:', error);
      throw error;
    }
  }
}

export const workSessionService = new WorkSessionService(); 