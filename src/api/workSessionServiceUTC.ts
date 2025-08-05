import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  deleteDoc,
  onSnapshot,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  writeBatch,
  increment
} from 'firebase/firestore';
import { db } from './firebase';
import { timezoneUtils } from '../utils/timezoneUtils';
import { utcMonitoring } from '../services/monitoring';
import type { WorkSessionUTC } from '../types/utcModels';

const UTC_WORK_SESSIONS_COLLECTION = 'workSessionsUTC';

export class WorkSessionServiceUTC {
  private collection = collection(db, UTC_WORK_SESSIONS_COLLECTION);
  
  /**
   * Create new UTC-based work session (enhanced with session lifecycle support)
   */
  async createSession(
    sessionData: Omit<WorkSessionUTC, 'id' | 'startTimeUTC' | 'createdAt' | 'updatedAt' | 'timezoneContext'> & {
      startTimeUTC?: string;
      userTimezone?: string;
    }
  ): Promise<string> {
    const startTime = performance.now();
    
    try {
      const now = sessionData.startTimeUTC || timezoneUtils.getCurrentUTC();
      const userTimezone = sessionData.userTimezone || timezoneUtils.getCurrentTimezone();
      const timezoneContext = timezoneUtils.createTimezoneContext(userTimezone);
      
      const sessionId = `utc_${sessionData.taskId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const session: WorkSessionUTC = {
        ...sessionData,
        id: sessionId,
        startTimeUTC: now,
        timezoneContext,
        createdAt: now,
        updatedAt: now,
        status: sessionData.status || 'completed' // Default to completed if not specified
      };
      
      // Remove the userTimezone field if it exists since it's not part of WorkSessionUTC
      const { userTimezone: _, ...cleanSession } = session as any;
      
      await setDoc(doc(this.collection, sessionId), cleanSession);
      
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('create_utc_session', true, duration);
      
      console.log('🌍 Created UTC work session:', {
        sessionId,
        startTimeUTC: session.startTimeUTC,
        timezone: timezoneContext.timezone,
        localTime: timezoneUtils.formatInTimezone(now, timezoneContext.timezone),
        status: session.status,
        sessionType: session.sessionType
      });
      
      return sessionId;
    } catch (error) {
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('create_utc_session', false, duration);
      console.error('❌ Error creating UTC work session:', error);
      throw error;
    }
  }
  
  /**
   * Create an active work session for timer (mimics legacy behavior)
   */
  async createActiveSession(
    taskId: string,
    projectId: string,
    userId: string,
    sessionType: 'pomodoro' | 'shortBreak' | 'longBreak',
    userTimezone?: string
  ): Promise<string> {
    const startTime = performance.now();
    
    try {
      const now = timezoneUtils.getCurrentUTC();
      const timezone = userTimezone || timezoneUtils.getCurrentTimezone();
      
      console.log('🎯 Creating active UTC session:', {
        taskId,
        projectId,
        userId,
        sessionType,
        timezone,
        startTimeUTC: now
      });
      
      const sessionData: Omit<WorkSessionUTC, 'id' | 'startTimeUTC' | 'createdAt' | 'updatedAt' | 'timezoneContext'> = {
        userId,
        taskId,
        projectId,
        duration: 0, // Start with 0 duration
        sessionType,
        status: 'active',
        notes: `${sessionType} session started`
      };
      
      const sessionId = await this.createSession({
        ...sessionData,
        startTimeUTC: now,
        userTimezone: timezone
      });
      
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('create_active_utc_session', true, duration);
      
      return sessionId;
    } catch (error) {
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('create_active_utc_session', false, duration);
      console.error('❌ Error creating active UTC session:', error);
      throw error;
    }
  }
  
  /**
   * Update session status and duration (mimics legacy behavior)
   */
  async updateSession(
    sessionId: string,
    updates: Partial<Pick<WorkSessionUTC, 'duration' | 'status' | 'endTimeUTC' | 'notes'>>
  ): Promise<void> {
    const startTime = performance.now();
    
    try {
      const updateData: any = {
        ...updates,
        updatedAt: timezoneUtils.getCurrentUTC()
      };
      
      await updateDoc(doc(this.collection, sessionId), updateData);
      
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('update_utc_session', true, duration);
      
      console.log('🔄 Updated UTC session:', {
        sessionId,
        updates
      });
    } catch (error) {
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('update_utc_session', false, duration);
      console.error('❌ Error updating UTC session:', error);
      throw error;
    }
  }
  
  /**
   * Increment session duration by specified minutes (mimics legacy behavior)
   */
  async incrementDuration(
    sessionId: string,
    minutesToAdd: number
  ): Promise<void> {
    const startTime = performance.now();
    
    try {
      const updateData = {
        duration: increment(minutesToAdd),
        updatedAt: timezoneUtils.getCurrentUTC()
      };
      
      await updateDoc(doc(this.collection, sessionId), updateData);
      
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('increment_utc_session_duration', true, duration);
      
      console.log('➕ Incremented UTC session duration:', {
        sessionId,
        minutesToAdd
      });
    } catch (error) {
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('increment_utc_session_duration', false, duration);
      console.error('❌ Error incrementing UTC session duration:', error);
      throw error;
    }
  }
  
  /**
   * Complete a session with final duration and status (enhanced version)
   */
  async completeSession(
    sessionId: string,
    durationMinutes?: number,
    status: WorkSessionUTC['status'] = 'completed',
    notes?: string
  ): Promise<void> {
    const startTime = performance.now();
    
    try {
      const endTimeUTC = timezoneUtils.getCurrentUTC();
      
      let finalDuration = durationMinutes;
      
      // Calculate duration if not provided
      if (finalDuration === undefined) {
        const sessionDoc = await this.getSessionById(sessionId);
        if (!sessionDoc) {
          throw new Error(`Session not found: ${sessionId}`);
        }
        
        const startTimeMs = new Date(sessionDoc.startTimeUTC).getTime();
        const endTimeMs = new Date(endTimeUTC).getTime();
        finalDuration = Math.round((endTimeMs - startTimeMs) / (1000 * 60));
      }
      
      const updateData: Partial<WorkSessionUTC> = {
        endTimeUTC,
        duration: finalDuration,
        status,
        updatedAt: endTimeUTC
      };
      
      if (notes) {
        updateData.notes = notes;
      } else if (!notes) {
        updateData.notes = `Session ${status}: ${finalDuration}m`;
      }
      
      await updateDoc(doc(this.collection, sessionId), updateData);
      
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('complete_utc_session', true, duration);
      
      console.log('✅ Completed UTC session:', {
        sessionId,
        duration: finalDuration,
        status,
        notes: updateData.notes
      });
    } catch (error) {
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('complete_utc_session', false, duration);
      console.error('❌ Error completing UTC session:', error);
      throw error;
    }
  }
  
  /**
   * Get active sessions for cleanup (mimics legacy behavior)
   */
  async getActiveSessions(userId: string): Promise<WorkSessionUTC[]> {
    const startTime = performance.now();
    
    try {
      const q = query(
        this.collection,
        where('userId', '==', userId),
        where('status', '==', 'active'),
        orderBy('updatedAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const sessions = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }) as WorkSessionUTC);
      
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('get_active_utc_sessions', true, duration);
      
      console.log('🔍 Found active UTC sessions:', sessions.length);
      return sessions;
    } catch (error) {
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('get_active_utc_sessions', false, duration);
      console.error('❌ Error fetching active UTC sessions:', error);
      return [];
    }
  }
  
  /**
   * Cleanup orphaned sessions on app restart (mimics legacy behavior)
   */
  async cleanupOrphanedSessions(userId: string, cutoffMinutes: number = 60): Promise<number> {
    const startTime = performance.now();
    
    try {
      const activeSessions = await this.getActiveSessions(userId);
      const cutoffTime = new Date(Date.now() - cutoffMinutes * 60 * 1000).toISOString();
      let cleanedCount = 0;
      
      for (const session of activeSessions) {
        const sessionAge = new Date(session.updatedAt);
        
        if (sessionAge < new Date(cutoffTime)) {
          if (session.duration > 0) {
            // Meaningful work - complete with existing duration
            await this.completeSession(
              session.id,
              session.duration,
              'completed',
              `Session completed: ${session.duration}m (app restart cleanup)`
            );
            console.log(`✅ Completed meaningful UTC session: ${session.id} (${session.duration}m)`);
          } else {
            // No meaningful work - delete the orphaned session
            await this.deleteSession(session.id);
            console.log(`🗑️ Deleted empty orphaned UTC session: ${session.id}`);
          }
          
          cleanedCount++;
        }
      }
      
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('cleanup_orphaned_utc_sessions', true, duration);
      
      return cleanedCount;
    } catch (error) {
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('cleanup_orphaned_utc_sessions', false, duration);
      console.error('❌ Error cleaning up orphaned UTC sessions:', error);
      return 0;
    }
  }
  
  /**
   * Get sessions for a specific date in user's timezone
   */
  async getSessionsForDate(date: Date, userId: string, userTimezone: string): Promise<WorkSessionUTC[]> {
    const startTime = performance.now();
    
    try {
      // Convert user's date to UTC boundaries
      const { startUTC, endUTC } = timezoneUtils.getUserDateBoundariesUTC(date, userTimezone);
      
      const q = query(
        this.collection,
        where('userId', '==', userId),
        where('startTimeUTC', '>=', startUTC),
        where('startTimeUTC', '<=', endUTC),
        orderBy('startTimeUTC', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const sessions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }) as WorkSessionUTC);
      
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('get_sessions_for_date', true, duration);
      
      console.log(`Found ${sessions.length} UTC sessions for date:`, {
        date: date.toISOString().split('T')[0],
        userTimezone,
        utcBoundaries: { startUTC, endUTC },
        sessionsFound: sessions.length
      });
      
      return sessions;
    } catch (error) {
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('get_sessions_for_date', false, duration);
      console.error('Error getting sessions for date:', error);
      throw error;
    }
  }
  
  /**
   * Get today's sessions in user's timezone
   */
  async getTodaysSessions(userId: string, userTimezone: string): Promise<WorkSessionUTC[]> {
    const startTime = performance.now();
    
    try {
      const { startUTC, endUTC } = timezoneUtils.getTodayBoundariesUTC(userTimezone);
      
      const q = query(
        this.collection,
        where('userId', '==', userId),
        where('startTimeUTC', '>=', startUTC),
        where('startTimeUTC', '<=', endUTC),
        orderBy('startTimeUTC', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const sessions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }) as WorkSessionUTC);
      
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('get_todays_sessions', true, duration);
      
      return sessions;
    } catch (error) {
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('get_todays_sessions', false, duration);
      console.error('Error getting today\'s sessions:', error);
      throw error;
    }
  }
  
  /**
   * Get sessions for date range
   */
  async getSessionsForDateRange(
    startDate: Date,
    endDate: Date,
    userId: string,
    userTimezone: string
  ): Promise<WorkSessionUTC[]> {
    const perfStart = performance.now();
    
    try {
      // Convert start date to UTC
      const { startUTC } = timezoneUtils.getUserDateBoundariesUTC(startDate, userTimezone);
      
      // Convert end date to UTC
      const { endUTC } = timezoneUtils.getUserDateBoundariesUTC(endDate, userTimezone);
      
      const q = query(
        this.collection,
        where('userId', '==', userId),
        where('startTimeUTC', '>=', startUTC),
        where('startTimeUTC', '<=', endUTC),
        orderBy('startTimeUTC', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const sessions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }) as WorkSessionUTC);
      
      const duration = performance.now() - perfStart;
      utcMonitoring.trackOperation('get_sessions_for_date_range', true, duration);
      
      return sessions;
    } catch (error) {
      const duration = performance.now() - perfStart;
      utcMonitoring.trackOperation('get_sessions_for_date_range', false, duration);
      console.error('Error getting sessions for date range:', error);
      throw error;
    }
  }
  
  /**
   * Get this week's sessions
   */
  async getThisWeeksSessions(userId: string, userTimezone: string): Promise<WorkSessionUTC[]> {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
    
    return this.getSessionsForDateRange(startOfWeek, endOfWeek, userId, userTimezone);
  }
  
  /**
   * Get all sessions for analytics (with pagination)
   */
  async getAllSessions(
    userId: string,
    limitCount: number = 1000,
    lastSessionDoc?: QueryDocumentSnapshot<DocumentData>
  ): Promise<WorkSessionUTC[]> {
    const startTime = performance.now();
    
    try {
      let q = query(
        this.collection,
        where('userId', '==', userId),
        orderBy('startTimeUTC', 'desc'),
        limit(limitCount)
      );
      
      if (lastSessionDoc) {
        q = query(
          this.collection,
          where('userId', '==', userId),
          orderBy('startTimeUTC', 'desc'),
          startAfter(lastSessionDoc),
          limit(limitCount)
        );
      }
      
      const snapshot = await getDocs(q);
      const sessions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }) as WorkSessionUTC);
      
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('get_all_sessions', true, duration);
      
      return sessions;
    } catch (error) {
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('get_all_sessions', false, duration);
      console.error('Error getting all sessions:', error);
      throw error;
    }
  }
  
  /**
   * Group sessions by date in user's timezone
   */
  async getSessionsGroupedByDate(
    startDate: Date,
    endDate: Date,
    userId: string,
    userTimezone: string
  ): Promise<Record<string, WorkSessionUTC[]>> {
    try {
      const sessions = await this.getSessionsForDateRange(startDate, endDate, userId, userTimezone);
      return timezoneUtils.groupSessionsByLocalDate(sessions, userTimezone);
    } catch (error) {
      console.error('Error grouping sessions by date:', error);
      throw error;
    }
  }
  
  /**
   * Get session by ID
   */
  async getSessionById(sessionId: string): Promise<WorkSessionUTC | null> {
    const startTime = performance.now();
    
    try {
      const docRef = doc(this.collection, sessionId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const duration = performance.now() - startTime;
        utcMonitoring.trackOperation('get_session_by_id', true, duration);
        
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as WorkSessionUTC;
      }
      
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('get_session_by_id', true, duration);
      
      return null;
    } catch (error) {
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('get_session_by_id', false, duration);
      console.error('Error getting session by ID:', error);
      throw error;
    }
  }
  
  /**
   * Generic update session method (enhanced)
   */
  async updateSessionGeneric(sessionId: string, updates: Partial<WorkSessionUTC>): Promise<void> {
    const startTime = performance.now();
    
    try {
      const updateData = {
        ...updates,
        updatedAt: timezoneUtils.getCurrentUTC()
      };
      
      await updateDoc(doc(this.collection, sessionId), updateData);
      
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('update_session_generic', true, duration);
      
      console.log('🔄 Updated UTC session (generic):', {
        sessionId,
        updates: Object.keys(updates)
      });
    } catch (error) {
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('update_session_generic', false, duration);
      console.error('❌ Error updating UTC session (generic):', error);
      throw error;
    }
  }
  
  /**
   * Delete session (enhanced with logging)
   */
  async deleteSession(sessionId: string): Promise<void> {
    const startTime = performance.now();
    
    try {
      await deleteDoc(doc(this.collection, sessionId));
      
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('delete_utc_session', true, duration);
      
      console.log('🗑️ Deleted UTC session:', sessionId);
    } catch (error) {
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('delete_utc_session', false, duration);
      console.error('❌ Error deleting UTC session:', error);
      throw error;
    }
  }
  
  /**
   * Listen to real-time session updates for today
   */
  subscribeToTodaysSessions(
    userId: string,
    userTimezone: string,
    callback: (sessions: WorkSessionUTC[]) => void
  ): () => void {
    try {
      const { startUTC, endUTC } = timezoneUtils.getTodayBoundariesUTC(userTimezone);
      
      const q = query(
        this.collection,
        where('userId', '==', userId),
        where('startTimeUTC', '>=', startUTC),
        where('startTimeUTC', '<=', endUTC),
        orderBy('startTimeUTC', 'desc')
      );
      
      return onSnapshot(q, (snapshot) => {
        const sessions = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }) as WorkSessionUTC);
        
        callback(sessions);
        utcMonitoring.trackOperation('realtime_sessions_update', true);
      }, (error) => {
        console.error('Error in real-time sessions subscription:', error);
        utcMonitoring.trackOperation('realtime_sessions_update', false);
      });
    } catch (error) {
      console.error('Error subscribing to today\'s sessions:', error);
      utcMonitoring.trackOperation('realtime_sessions_subscription', false);
      return () => {}; // Return empty unsubscribe function
    }
  }
  
  /**
   * Get work sessions for a specific task (mimics legacy behavior)
   */
  async getWorkSessionsByTask(userId: string, taskId: string): Promise<WorkSessionUTC[]> {
    const startTime = performance.now();
    
    try {
      const q = query(
        this.collection,
        where('userId', '==', userId),
        where('taskId', '==', taskId),
        orderBy('startTimeUTC', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const sessions = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }) as WorkSessionUTC);
      
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('get_sessions_by_task', true, duration);
      
      console.log(`📋 Found ${sessions.length} UTC sessions for task ${taskId}`);
      return sessions;
    } catch (error) {
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('get_sessions_by_task', false, duration);
      console.error('❌ Error getting UTC sessions by task:', error);
      throw error;
    }
  }
  
  /**
   * Delete work sessions for a specific task (cascade delete support)
   */
  async deleteWorkSessionsByTask(userId: string, taskId: string): Promise<number> {
    const startTime = performance.now();
    
    try {
      // Get all sessions for this task
      const sessions = await this.getWorkSessionsByTask(userId, taskId);
      
      if (sessions.length === 0) {
        console.log(`ℹ️ No UTC sessions found for task ${taskId}`);
        return 0;
      }
      
      // Delete all sessions using batch operation
      const batch = writeBatch(db);
      sessions.forEach(session => {
        const sessionRef = doc(this.collection, session.id);
        batch.delete(sessionRef);
      });
      
      await batch.commit();
      
      const deletedCount = sessions.length;
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('delete_sessions_by_task', true, duration);
      
      console.log(`✅ Deleted ${deletedCount} UTC work sessions for task ${taskId}`);
      return deletedCount;
    } catch (error) {
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('delete_sessions_by_task', false, duration);
      console.error('❌ Error deleting UTC sessions by task:', error);
      throw error;
    }
  }
  
  /**
   * Update project ID for all sessions of a specific task (mimics legacy behavior)
   */
  async updateWorkSessionsProjectId(userId: string, taskId: string, newProjectId: string): Promise<number> {
    const startTime = performance.now();
    
    try {
      // Get all UTC sessions for this task
      const q = query(
        this.collection,
        where('userId', '==', userId),
        where('taskId', '==', taskId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.log('📝 No UTC sessions found for task:', taskId);
        return 0;
      }
      
      // Update each session with the new projectId
      const batch = writeBatch(db);
      querySnapshot.docs.forEach(docSnapshot => {
        const sessionRef = doc(this.collection, docSnapshot.id);
        batch.update(sessionRef, {
          projectId: newProjectId,
          updatedAt: timezoneUtils.getCurrentUTC()
        });
      });
      
      await batch.commit();
      
      const updatedCount = querySnapshot.docs.length;
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('bulk_update_project_id', true, duration);
      
      console.log(`✅ Updated ${updatedCount} UTC work sessions for task ${taskId} to project ${newProjectId}`);
      return updatedCount;
    } catch (error) {
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('bulk_update_project_id', false, duration);
      console.error('❌ Error updating UTC sessions project ID:', error);
      throw error;
    }
  }
  
  /**
   * Batch operations for migration
   */
  async batchCreateSessions(sessions: WorkSessionUTC[]): Promise<void> {
    const startTime = performance.now();
    
    try {
      const batch = writeBatch(db);
      
      sessions.forEach(session => {
        const docRef = doc(this.collection, session.id);
        batch.set(docRef, session);
      });
      
      await batch.commit();
      
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('batch_create_sessions', true, duration);
      
      console.log(`Batch created ${sessions.length} UTC sessions`);
    } catch (error) {
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('batch_create_sessions', false, duration);
      console.error('Error batch creating sessions:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const workSessionServiceUTC = new WorkSessionServiceUTC();