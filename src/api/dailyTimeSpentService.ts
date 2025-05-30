import { collection, doc, getDoc, setDoc, updateDoc, increment, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from './firebase';

export interface DailyTimeSpent {
  id: string; // format: `${taskId}_${dateString}`
  taskId: string;
  projectId: string;
  userId: string;
  date: string; // YYYY-MM-DD format
  timeSpent: number; // minutes
  createdAt: Date;
  updatedAt: Date;
}

class DailyTimeSpentService {
  private collection = collection(db, 'dailyTimeSpent');

  /**
   * Get the date string in YYYY-MM-DD format
   */
  private getDateString(date: Date = new Date()): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Get the document ID for a task on a specific date
   */
  private getDocId(taskId: string, date: Date = new Date()): string {
    return `${taskId}_${this.getDateString(date)}`;
  }

  /**
   * Increment time spent for a task on a specific date
   */
  async incrementTimeSpent(
    userId: string, 
    taskId: string, 
    projectId: string, 
    minutes: number, 
    date: Date = new Date()
  ): Promise<void> {
    const docId = this.getDocId(taskId, date);
    const docRef = doc(this.collection, docId);
    
    try {
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        // Document exists, increment the time
        await updateDoc(docRef, {
          timeSpent: increment(minutes),
          updatedAt: new Date()
        });
      } else {
        // Document doesn't exist, create it
        const dailyRecord: DailyTimeSpent = {
          id: docId,
          taskId,
          projectId,
          userId,
          date: this.getDateString(date),
          timeSpent: minutes,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await setDoc(docRef, dailyRecord);
      }
    } catch (error) {
      console.error('Error incrementing daily time spent:', error);
      throw error;
    }
  }

  /**
   * Get daily time spent records for a user within a date range
   */
  async getDailyTimeSpent(
    userId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<DailyTimeSpent[]> {
    try {
      const startDateString = this.getDateString(startDate);
      const endDateString = this.getDateString(endDate);
      
      const q = query(
        this.collection,
        where('userId', '==', userId),
        where('date', '>=', startDateString),
        where('date', '<=', endDateString),
        orderBy('date', 'desc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as DailyTimeSpent[];
    } catch (error) {
      console.error('Error getting daily time spent:', error);
      throw error;
    }
  }

  /**
   * Get daily time spent records for a specific task
   */
  async getDailyTimeSpentByTask(
    userId: string, 
    taskId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<DailyTimeSpent[]> {
    try {
      const startDateString = this.getDateString(startDate);
      const endDateString = this.getDateString(endDate);
      
      const q = query(
        this.collection,
        where('userId', '==', userId),
        where('taskId', '==', taskId),
        where('date', '>=', startDateString),
        where('date', '<=', endDateString),
        orderBy('date', 'desc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      })) as DailyTimeSpent[];
    } catch (error) {
      console.error('Error getting daily time spent by task:', error);
      throw error;
    }
  }

  /**
   * Get time spent for a specific task on a specific date
   */
  async getTimeSpentByTaskOnDate(
    userId: string, 
    taskId: string, 
    date: Date = new Date()
  ): Promise<number> {
    try {
      const docId = this.getDocId(taskId, date);
      const docRef = doc(this.collection, docId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data().timeSpent || 0;
      }
      
      return 0;
    } catch (error) {
      console.error('Error getting time spent by task on date:', error);
      return 0;
    }
  }
}

export const dailyTimeSpentService = new DailyTimeSpentService(); 