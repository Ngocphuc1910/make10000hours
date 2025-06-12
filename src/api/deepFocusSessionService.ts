import { 
  collection, 
  addDoc, 
  updateDoc,
  doc,
  query, 
  where, 
  orderBy,
  onSnapshot, 
  getDocs,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { DeepFocusSession } from '../types/models';

class DeepFocusSessionService {
  private readonly collectionName = 'deepFocusSessions';

  /**
   * Start a new deep focus session
   */
  async startSession(userId: string): Promise<string> {
    try {
      const sessionData = {
        userId,
        startTime: serverTimestamp(),
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, this.collectionName), sessionData);
      console.log('Deep Focus session started:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error starting Deep Focus session:', error);
      throw error;
    }
  }

  /**
   * End an active deep focus session
   */
  async endSession(sessionId: string): Promise<DeepFocusSession | null> {
    try {
      const sessionRef = doc(db, this.collectionName, sessionId);
      const endTime = new Date();
      
      // Get session to calculate duration
      const sessionDoc = await getDocs(query(
        collection(db, this.collectionName),
        where('__name__', '==', sessionId)
      ));
      
      if (sessionDoc.empty) {
        console.error('Session not found:', sessionId);
        return null;
      }
      
      const sessionData = sessionDoc.docs[0].data();
      const startTime = sessionData.startTime?.toDate() || new Date();
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)); // minutes
      
      await updateDoc(sessionRef, {
        endTime: serverTimestamp(),
        duration: duration,
        status: 'completed',
        updatedAt: serverTimestamp()
      });

      console.log('Deep Focus session ended:', sessionId, 'Duration:', duration, 'minutes');
      
      return {
        id: sessionId,
        userId: sessionData.userId,
        startTime: startTime,
        endTime: endTime,
        duration: duration,
        status: 'completed',
        createdAt: sessionData.createdAt?.toDate() || new Date(),
        updatedAt: new Date()
      };
    } catch (error) {
      console.error('Error ending Deep Focus session:', error);
      throw error;
    }
  }

  /**
   * Get all deep focus sessions for a user
   */
  async getUserSessions(userId: string): Promise<DeepFocusSession[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          startTime: data.startTime?.toDate() || new Date(),
          endTime: data.endTime?.toDate(),
          duration: data.duration,
          status: data.status,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        };
      });
    } catch (error) {
      console.error('Error fetching user Deep Focus sessions:', error);
      throw error;
    }
  }

  /**
   * Get active session for a user (if any)
   */
  async getActiveSession(userId: string): Promise<DeepFocusSession | null> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        return null;
      }
      
      const doc = querySnapshot.docs[0];
      const data = doc.data();
      
      return {
        id: doc.id,
        userId: data.userId,
        startTime: data.startTime?.toDate() || new Date(),
        endTime: data.endTime?.toDate(),
        duration: data.duration,
        status: data.status,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      };
    } catch (error) {
      console.error('Error fetching active Deep Focus session:', error);
      throw error;
    }
  }

  /**
   * Subscribe to user's deep focus sessions
   */
  subscribeToUserSessions(userId: string, callback: (sessions: DeepFocusSession[]) => void): () => void {
    const q = query(
      collection(db, this.collectionName),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (querySnapshot) => {
      const sessions = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          startTime: data.startTime?.toDate() || new Date(),
          endTime: data.endTime?.toDate(),
          duration: data.duration,
          status: data.status,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        };
      });
      callback(sessions);
    });
  }

  /**
   * Get completed sessions count for a user
   */
  async getCompletedSessionsCount(userId: string): Promise<number> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        where('status', '==', 'completed')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.size;
    } catch (error) {
      console.error('Error getting completed sessions count:', error);
      return 0;
    }
  }

  /**
   * Get total deep focus time for a user (sum of all completed sessions)
   */
  async getTotalFocusTime(userId: string): Promise<number> {
    try {
      const sessions = await this.getUserSessions(userId);
      return sessions
        .filter(session => session.status === 'completed' && session.duration)
        .reduce((total, session) => total + (session.duration || 0), 0);
    } catch (error) {
      console.error('Error calculating total focus time:', error);
      return 0;
    }
  }
}

export const deepFocusSessionService = new DeepFocusSessionService(); 