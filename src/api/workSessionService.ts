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

export class WorkSessionService {
  private workSessionsCollection = collection(db, WORK_SESSIONS_COLLECTION);

  /**
   * Upsert work session
   */
  async upsertWorkSession(sessionData: Omit<WorkSession, 'id' | 'createdAt' | 'updatedAt' | 'duration'>, durationChange = 0): Promise<string> {
    try {
      const sessionId = `${sessionData.taskId}_${sessionData.date}`;
      const sessionRef = doc(this.workSessionsCollection, sessionId);

      // Check if the session already exists
      const sessionDoc = await getDoc(sessionRef);
      if (sessionDoc.exists()) {
        // Update existing session
        const updateData: Partial<WorkSession> = { 
          ...sessionData, 
          duration: (sessionDoc.data()?.duration || 0) + durationChange,
          updatedAt: new Date() ,
        };

        await updateDoc(sessionRef, updateData);
      } else {
        // Create new session
        const newSession: WorkSession = {
          ...sessionData,
          id: sessionId,
          duration: durationChange, // Initialize with the change
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await setDoc(sessionRef, newSession);
      }
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
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate(),
      })) as WorkSession[];
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
      const q = query(
        this.workSessionsCollection,
        where('userId', '==', userId),
        where('taskId', '==', taskId),
        orderBy('updatedAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate(),
      })) as WorkSession[];
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
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate(),
      })) as WorkSession[];
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
      const sessions = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate(),
      })) as WorkSession[];

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
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate(),
      })) as WorkSession[];
    } catch (error) {
      console.error('Error fetching recent work sessions:', error);
      throw error;
    }
  }
}

export const workSessionService = new WorkSessionService(); 