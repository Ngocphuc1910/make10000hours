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
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { timezoneUtils } from '../utils/timezoneUtils';
import { utcMonitoring } from '../services/monitoring';
import type { WorkSessionUTC } from '../types/utcModels';

const UTC_WORK_SESSIONS_COLLECTION = 'workSessionsUTC';

export class WorkSessionServiceUTC {
  private collection = collection(db, UTC_WORK_SESSIONS_COLLECTION);
  
  /**
   * Create new UTC-based work session
   */
  async createSession(
    sessionData: Omit<WorkSessionUTC, 'id' | 'startTimeUTC' | 'createdAt' | 'updatedAt' | 'timezoneContext'>
  ): Promise<string> {
    const startTime = performance.now();
    
    try {
      const now = timezoneUtils.getCurrentUTC();
      const timezoneContext = timezoneUtils.createTimezoneContext();
      
      const sessionId = `utc_${sessionData.taskId}_${Date.now()}`;
      
      const session: WorkSessionUTC = {
        ...sessionData,
        id: sessionId,
        startTimeUTC: now,
        timezoneContext,
        createdAt: now,
        updatedAt: now
      };
      
      await setDoc(doc(this.collection, sessionId), session);
      
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('create_utc_session', true, duration);
      
      console.log('Created UTC work session:', {
        sessionId,
        startTimeUTC: session.startTimeUTC,
        timezone: timezoneContext.timezone,
        localTime: timezoneUtils.formatInTimezone(now, timezoneContext.timezone)
      });
      
      return sessionId;
    } catch (error) {
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('create_utc_session', false, duration);
      console.error('Error creating UTC work session:', error);
      throw error;
    }
  }
  
  /**
   * Update session end time and duration
   */
  async completeSession(sessionId: string, status: WorkSessionUTC['status'] = 'completed'): Promise<void> {
    const startTime = performance.now();
    
    try {
      const endTimeUTC = timezoneUtils.getCurrentUTC();
      
      // Get current session to calculate duration
      const sessionDoc = await this.getSessionById(sessionId);
      if (!sessionDoc) {
        throw new Error(`Session not found: ${sessionId}`);
      }
      
      const startTimeMs = new Date(sessionDoc.startTimeUTC).getTime();
      const endTimeMs = new Date(endTimeUTC).getTime();
      const durationMinutes = Math.round((endTimeMs - startTimeMs) / (1000 * 60));
      
      await updateDoc(doc(this.collection, sessionId), {
        endTimeUTC,
        duration: durationMinutes,
        status,
        updatedAt: endTimeUTC
      });
      
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('complete_utc_session', true, duration);
      
      console.log('Completed UTC session:', {
        sessionId,
        duration: durationMinutes,
        status
      });
    } catch (error) {
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('complete_utc_session', false, duration);
      console.error('Error completing UTC session:', error);
      throw error;
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
   * Update session
   */
  async updateSession(sessionId: string, updates: Partial<WorkSessionUTC>): Promise<void> {
    const startTime = performance.now();
    
    try {
      const updateData = {
        ...updates,
        updatedAt: timezoneUtils.getCurrentUTC()
      };
      
      await updateDoc(doc(this.collection, sessionId), updateData);
      
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('update_session', true, duration);
    } catch (error) {
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('update_session', false, duration);
      console.error('Error updating session:', error);
      throw error;
    }
  }
  
  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<void> {
    const startTime = performance.now();
    
    try {
      await deleteDoc(doc(this.collection, sessionId));
      
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('delete_session', true, duration);
    } catch (error) {
      const duration = performance.now() - startTime;
      utcMonitoring.trackOperation('delete_session', false, duration);
      console.error('Error deleting session:', error);
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