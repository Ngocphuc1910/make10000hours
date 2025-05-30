import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import type { WorkSession } from '../types/models';

const WORK_SESSIONS_COLLECTION = 'workSessions';

export class WorkSessionService {
  private workSessionsCollection = collection(db, WORK_SESSIONS_COLLECTION);

  /**
   * Create a new work session
   */
  async createWorkSession(sessionData: Omit<WorkSession, 'id' | 'createdAt'>): Promise<string> {
    try {
      const docData = {
        ...sessionData,
        startTime: Timestamp.fromDate(sessionData.startTime),
        endTime: Timestamp.fromDate(sessionData.endTime),
        createdAt: Timestamp.fromDate(new Date())
      };

      const docRef = await addDoc(this.workSessionsCollection, docData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating work session:', error);
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
        where('startTime', '>=', Timestamp.fromDate(startDate)),
        where('startTime', '<=', Timestamp.fromDate(endDate)),
        orderBy('startTime', 'desc')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startTime: doc.data().startTime.toDate(),
        endTime: doc.data().endTime.toDate(),
        createdAt: doc.data().createdAt.toDate()
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
        orderBy('startTime', 'desc')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startTime: doc.data().startTime.toDate(),
        endTime: doc.data().endTime.toDate(),
        createdAt: doc.data().createdAt.toDate()
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
        orderBy('startTime', 'desc')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startTime: doc.data().startTime.toDate(),
        endTime: doc.data().endTime.toDate(),
        createdAt: doc.data().createdAt.toDate()
      })) as WorkSession[];
    } catch (error) {
      console.error('Error fetching project work sessions:', error);
      throw error;
    }
  }

  /**
   * Update a work session
   */
  async updateWorkSession(sessionId: string, updates: Partial<WorkSession>): Promise<void> {
    try {
      const sessionRef = doc(this.workSessionsCollection, sessionId);
      const updateData: any = { ...updates };

      // Convert dates to Timestamps
      if (updates.startTime) {
        updateData.startTime = Timestamp.fromDate(updates.startTime);
      }
      if (updates.endTime) {
        updateData.endTime = Timestamp.fromDate(updates.endTime);
      }

      await updateDoc(sessionRef, updateData);
    } catch (error) {
      console.error('Error updating work session:', error);
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
    startDate: Date, 
    endDate: Date,
    callback: (sessions: WorkSession[]) => void
  ): () => void {
    // Simplified query - only filter by userId to avoid index requirements
    // We'll filter by date range in memory
    const q = query(
      this.workSessionsCollection,
      where('userId', '==', userId)
    );

    return onSnapshot(q, (querySnapshot) => {
      const allSessions = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startTime: doc.data().startTime.toDate(),
        endTime: doc.data().endTime.toDate(),
        createdAt: doc.data().createdAt.toDate()
      })) as WorkSession[];

      // Filter by date range in memory and sort
      const filteredSessions = allSessions
        .filter(session => 
          session.startTime >= startDate && 
          session.startTime <= endDate
        )
        .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

      callback(filteredSessions);
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
        orderBy('startTime', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startTime: doc.data().startTime.toDate(),
        endTime: doc.data().endTime.toDate(),
        createdAt: doc.data().createdAt.toDate()
      })) as WorkSession[];
    } catch (error) {
      console.error('Error fetching recent work sessions:', error);
      throw error;
    }
  }
}

export const workSessionService = new WorkSessionService(); 