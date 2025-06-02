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
  setDoc
} from 'firebase/firestore';
import { db } from './firebase';
import type { WorkSession } from '../types/models';

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
   * Create a new work session (no longer upserts - creates separate sessions)
   */
  async createWorkSession(sessionData: Omit<WorkSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      // Generate unique session ID with timestamp
      const timestamp = new Date().getTime();
      const sessionId = `${sessionData.taskId}_${sessionData.date}_${timestamp}`;
      const sessionRef = doc(this.workSessionsCollection, sessionId);

      const newSession: WorkSession = {
        ...sessionData,
        id: sessionId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await setDoc(sessionRef, newSession);
      return sessionId;
    } catch (error) {
      console.error('Error creating work session:', error);
      throw error;
    }
  }

  /**
   * Legacy upsert method - kept for backward compatibility but now creates separate sessions
   */
  async upsertWorkSession(
    sessionData: Omit<WorkSession, 'id' | 'createdAt' | 'updatedAt' | 'duration' | 'sessionType'>, 
    durationChange = 0,
    sessionType: WorkSession['sessionType'] = 'manual'
  ): Promise<string> {
    try {
      // Create a new session instead of updating existing one
      const workSession: Omit<WorkSession, 'id' | 'createdAt' | 'updatedAt'> = {
        ...sessionData,
        duration: Math.abs(durationChange), // Use absolute value for duration
        sessionType,
        notes: sessionType === 'manual' ? 
          (durationChange > 0 ? `Manual time addition: +${durationChange}m` : `Manual time reduction: ${durationChange}m`) :
          `${sessionType} session completed`
      };

      return await this.createWorkSession(workSession);
    } catch (error) {
      console.error('Error upserting work session:', error);
      throw error;
    }
  }

  /**
   * Create a timer-based work session with precise timing
   */
  async createTimerSession(
    sessionData: Omit<WorkSession, 'id' | 'createdAt' | 'updatedAt' | 'sessionType'>,
    sessionType: 'pomodoro' | 'shortBreak' | 'longBreak',
    startTime: Date,
    endTime: Date
  ): Promise<string> {
    try {
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)); // Convert to minutes

      const workSession: Omit<WorkSession, 'id' | 'createdAt' | 'updatedAt'> = {
        ...sessionData,
        duration,
        sessionType,
        startTime,
        endTime,
        notes: `${sessionType} session completed`
      };

      return await this.createWorkSession(workSession);
    } catch (error) {
      console.error('Error creating timer session:', error);
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