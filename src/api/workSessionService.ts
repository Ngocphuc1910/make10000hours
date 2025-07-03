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
        status: sessionData.status || 'completed', // Default to completed if not specified
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
   * Create an active work session for timer
   */
  async createActiveSession(
    taskId: string,
    projectId: string,
    userId: string,
    sessionType: 'pomodoro' | 'shortBreak' | 'longBreak'
  ): Promise<string> {
    try {
      const now = new Date();
      const sessionData: Omit<WorkSession, 'id' | 'createdAt' | 'updatedAt'> = {
        userId,
        taskId,
        projectId,
        date: now.toISOString().split('T')[0], // YYYY-MM-DD format
        duration: 0, // Start with 0 duration
        sessionType, // Use the session type as provided
        status: 'active',
        startTime: now,
        notes: `${sessionType} session started`
      };

      return await this.createWorkSession(sessionData);
    } catch (error) {
      console.error('Error creating active session:', error);
      throw error;
    }
  }

  /**
   * Update session status and duration
   */
  async updateSession(
    sessionId: string,
    updates: Partial<Pick<WorkSession, 'duration' | 'status' | 'endTime' | 'notes'>>
  ): Promise<void> {
    try {
      const sessionRef = doc(this.workSessionsCollection, sessionId);
      const updateData = {
        ...updates,
        updatedAt: new Date()
      };

      await updateDoc(sessionRef, updateData);
    } catch (error) {
      console.error('Error updating session:', error);
      throw error;
    }
  }

  /**
   * Increment session duration by specified minutes
   */
  async incrementDuration(
    sessionId: string,
    minutesToAdd: number
  ): Promise<void> {
    try {
      const sessionRef = doc(this.workSessionsCollection, sessionId);
      const updateData = {
        duration: increment(minutesToAdd),
        updatedAt: new Date()
      };

      await updateDoc(sessionRef, updateData);
    } catch (error) {
      console.error('Error incrementing session duration:', error);
      throw error;
    }
  }

  /**
   * Complete a session with final duration and status
   */
  async completeSession(
    sessionId: string,
    duration: number,
    status: 'completed' | 'paused' | 'switched',
    notes?: string
  ): Promise<void> {
    try {
      await this.updateSession(sessionId, {
        duration,
        status,
        endTime: new Date(),
        notes: notes || `Session ${status}: ${duration}m`
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
   * Legacy upsert method - kept for backward compatibility but now creates separate sessions
   */
  async upsertWorkSession(
    sessionData: Omit<WorkSession, 'id' | 'createdAt' | 'updatedAt' | 'duration' | 'sessionType' | 'status'>, 
    durationChange = 0,
    sessionType: WorkSession['sessionType'] = 'manual'
  ): Promise<string> {
    try {
      // Create a new session instead of updating existing one
      const workSession: Omit<WorkSession, 'id' | 'createdAt' | 'updatedAt'> = {
        ...sessionData,
        duration: durationChange, // Preserve the sign: positive for additions, negative for reductions
        sessionType,
        status: 'completed', // Manual sessions are always completed
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