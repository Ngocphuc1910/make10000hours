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
  Timestamp,
  increment
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
      
      // Get session data but trust the existing incremental duration
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
      
      // Trust the incremental duration completely – no timestamp fallback
      const finalDuration = sessionData.duration || 0;
      
      await updateDoc(sessionRef, {
        endTime: serverTimestamp(),
        duration: finalDuration, // Use existing incremental duration
        status: 'completed',
        updatedAt: serverTimestamp()
      });

      console.log('Deep Focus session ended:', sessionId, 
        'Duration:', finalDuration, 'minutes', 
        '(incremental only)');
      
      return {
        id: sessionId,
        userId: sessionData.userId,
        startTime: startTime,
        endTime: endTime,
        duration: finalDuration,
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
   * Get all deep focus sessions for a user with optional date filtering
   */
  async getUserSessions(userId: string, startDate?: Date, endDate?: Date): Promise<DeepFocusSession[]> {
    try {
      console.log('🔍 DeepFocusSessionService: getUserSessions called', { userId, startDate, endDate });
      
      // Simple query without orderBy to avoid index requirement
      let q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId)
      );

      console.log('🔍 DeepFocusSessionService: Base query created (without orderBy to avoid index)');
      
      const querySnapshot = await getDocs(q);
      console.log('🔍 DeepFocusSessionService: Query executed, found', querySnapshot.size, 'documents');
      
      let sessions = querySnapshot.docs.map(doc => {
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

      console.log('🔍 DeepFocusSessionService: Mapped sessions:', sessions.length);
      console.log('🔍 DeepFocusSessionService: Session details:', sessions.map(s => ({
        id: s.id,
        status: s.status,
        duration: s.duration,
        createdAt: s.createdAt.toISOString()
      })));

      // Apply date filtering in JavaScript if provided
      if (startDate && endDate) {
        console.log('🔍 DeepFocusSessionService: Applying date filter', { startDate, endDate });
        const originalCount = sessions.length;
        sessions = sessions.filter(session => {
          const sessionDate = session.createdAt;
          const isInRange = sessionDate >= startDate && sessionDate <= endDate;
          console.log('🔍 Session date check:', {
            sessionId: session.id,
            sessionDate: sessionDate.toISOString(),
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            isInRange
          });
          return isInRange;
        });
        console.log('🔍 DeepFocusSessionService: Date filtering:', originalCount, '→', sessions.length, 'sessions');
      }
      
      // Sort by createdAt in JavaScript (newest first)
      sessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      console.log('🔍 DeepFocusSessionService: Final sessions:', sessions.length);
      return sessions;
    } catch (error) {
      console.error('❌ Error fetching user Deep Focus sessions:', error);
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
    // Simple query without orderBy to avoid index requirement
    const q = query(
      collection(db, this.collectionName),
      where('userId', '==', userId)
    );

    return onSnapshot(q, (querySnapshot) => {
      let sessions = querySnapshot.docs.map(doc => {
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
      
      // Sort by createdAt in JavaScript (newest first)
      sessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
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

  /**
   * Update the duration of an active deep focus session
   */
  async updateSessionDuration(sessionId: string, duration: number): Promise<void> {
    try {
      const sessionRef = doc(db, this.collectionName, sessionId);
      await updateDoc(sessionRef, {
        duration: duration,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating Deep Focus session duration:', error);
    }
  }

  /**
   * Suspend an active session (for inactivity/sleep)
   */
  async suspendSession(sessionId: string): Promise<void> {
    try {
      const sessionRef = doc(db, this.collectionName, sessionId);
      await updateDoc(sessionRef, {
        status: 'suspended',
        suspendedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      console.log('Deep Focus session suspended:', sessionId);
    } catch (error) {
      console.error('Error suspending Deep Focus session:', error);
      throw error;
    }
  }

  /**
   * Resume a suspended session
   */
  async resumeSession(sessionId: string): Promise<void> {
    try {
      const sessionRef = doc(db, this.collectionName, sessionId);
      await updateDoc(sessionRef, {
        status: 'active',
        resumedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      console.log('Deep Focus session resumed:', sessionId);
    } catch (error) {
      console.error('Error resuming Deep Focus session:', error);
      throw error;
    }
  }

  /**
   * Clean up any orphaned active sessions for a user (sessions that were never properly ended)
   * This is useful for handling page reloads or unexpected app closures
   */
  async cleanupOrphanedSessions(userId: string): Promise<number> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        where('status', '==', 'active')
      );
      
      const querySnapshot = await getDocs(q);
      let cleanedCount = 0;
      
      for (const docSnapshot of querySnapshot.docs) {
        const data = docSnapshot.data();
        const startTime = data.startTime?.toDate() || new Date();
        const now = new Date();
        
        const finalDuration = data.duration || 0; // no recalculation
        
        // End the orphaned session
        await updateDoc(doc(db, this.collectionName, docSnapshot.id), {
          endTime: serverTimestamp(),
          duration: finalDuration, // Use existing incremental duration
          status: 'completed',
          updatedAt: serverTimestamp()
        });
        
        cleanedCount++;
        console.log('🧹 Cleaned up orphaned session:', docSnapshot.id, 
          'Duration:', finalDuration, 'minutes', '(incremental only)');
      }
      
      if (cleanedCount > 0) {
        console.log('✅ Cleaned up', cleanedCount, 'orphaned sessions');
      }
      
      return cleanedCount;
    } catch (error) {
      console.error('❌ Error cleaning up orphaned sessions:', error);
      return 0;
    }
  }

  /**
   * Atomically add minutes to an active deep focus session
   */
  async incrementSessionDuration(sessionId: string, minutes: number = 1): Promise<void> {
    try {
      if (minutes <= 0) return; // guard – nothing to add
      const sessionRef = doc(db, this.collectionName, sessionId);
      await updateDoc(sessionRef, {
        duration: increment(minutes),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error incrementing Deep Focus session duration:', error);
    }
  }
}

export const deepFocusSessionService = new DeepFocusSessionService(); 