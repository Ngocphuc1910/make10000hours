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
import { DeepFocusSession, Source } from '../types/models';

class DeepFocusSessionService {
  private readonly collectionName = 'deepFocusSessions';
  
  // Session creation lock to prevent concurrent creation
  private sessionCreationLocks = new Map<string, Promise<string>>();
  private readonly lockTimeout = 10000; // 10 seconds timeout

  /**
   * Start a new deep focus session with duplicate prevention and locking
   */
  async startSession(userId: string, source: Source = 'extension'): Promise<string> {
    // Check if there's already a session creation in progress for this user
    const existingLock = this.sessionCreationLocks.get(userId);
    if (existingLock) {
      console.log('🔒 Session creation in progress for user, waiting for existing lock:', userId);
      try {
        const sessionId = await existingLock;
        console.log('✅ Using session from existing lock:', sessionId);
        return sessionId;
      } catch (error) {
        console.warn('⚠️ Existing lock failed, proceeding with new session creation:', error);
        // Remove failed lock and proceed
        this.sessionCreationLocks.delete(userId);
      }
    }

    // Create a new session creation promise and store it as a lock
    const sessionCreationPromise = this.createSessionWithLock(userId, source);
    
    // Store the promise as a lock
    this.sessionCreationLocks.set(userId, sessionCreationPromise);
    
    // Set up timeout to clean up lock
    setTimeout(() => {
      this.sessionCreationLocks.delete(userId);
    }, this.lockTimeout);

    try {
      const sessionId = await sessionCreationPromise;
      console.log('✅ Deep Focus session created with lock:', sessionId);
      return sessionId;
    } catch (error) {
      console.error('❌ Error creating Deep Focus session:', error);
      throw error;
    } finally {
      // Clean up lock on completion
      this.sessionCreationLocks.delete(userId);
    }
  }

  /**
   * Internal method to create session with proper locking
   */
  private async createSessionWithLock(userId: string, source: Source): Promise<string> {
    try {
      // Double-check if there's already an active session for this user
      const existingActiveSession = await this.getActiveSession(userId);
      if (existingActiveSession) {
        console.log('🛡️ Session creation prevented - active session already exists:', existingActiveSession.id);
        return existingActiveSession.id; // Return existing session ID instead of creating duplicate
      }

      // Clean up any orphaned sessions first
      const cleanedCount = await this.cleanupOrphanedSessions(userId);
      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} orphaned session(s) before creating new session`);
      }

      const sessionData = {
        userId,
        startTime: serverTimestamp(),
        status: 'active',
        duration: 0, // Initialize duration to 0
        source,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, this.collectionName), sessionData);
      console.log('✅ Deep Focus session started:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error starting Deep Focus session:', error);
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
      console.log('🚀 DeepFocusSessionService: Smart query with database-level filtering', { 
        userId, 
        hasDateFilter: !!(startDate && endDate),
        dateRange: startDate && endDate ? `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}` : 'all time'
      });
      
      // Build query with database-level date filtering for efficiency
      let q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId)
      );

      // Add date filtering at database level if provided
      if (startDate && endDate) {
        // Convert to Firestore Timestamp for database filtering
        const startTimestamp = Timestamp.fromDate(startDate);
        const endTimestamp = Timestamp.fromDate(endDate);
        
        q = query(
          collection(db, this.collectionName),
          where('userId', '==', userId),
          where('createdAt', '>=', startTimestamp),
          where('createdAt', '<=', endTimestamp)
        );
        
        console.log('✅ Database-level date filtering applied:', {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          benefit: 'No individual session checking needed'
        });
      }
      
      const querySnapshot = await getDocs(q);
      
      // Map documents to sessions
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

      // Sort by createdAt in JavaScript (newest first)
      sessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      console.log('✅ Smart query completed:', {
        sessionsReturned: sessions.length,
        approach: startDate && endDate ? 'database-filtered' : 'all-sessions',
        efficiency: 'No JavaScript filtering or individual session logs'
      });
      
      return sessions;
    } catch (error) {
      console.error('❌ Error fetching user Deep Focus sessions:', error);
      throw error;
    }
  }

  /**
   * Get active session for a user (if any)
   * Modified to avoid composite index requirements
   */
  async getActiveSession(userId: string): Promise<DeepFocusSession | null> {
    try {
      // Simple query without orderBy to avoid index requirement
      const q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        where('status', '==', 'active')
      );
      
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        return null;
      }
      
      // Convert to array and sort by createdAt in JavaScript (newest first)
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
      
      // Sort by createdAt (newest first) and return the first one
      sessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      return sessions[0] || null;
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
      
      // Use increment() which handles missing fields gracefully
      // If duration field doesn't exist, it will create it with the increment value
      await updateDoc(sessionRef, {
        duration: increment(minutes),
        updatedAt: serverTimestamp()
      });
      
      console.log(`⏱️ Deep Focus session ${sessionId}: +${minutes} minute(s) added`);
    } catch (error) {
      console.error('Error incrementing Deep Focus session duration:', error);
      // Don't throw - allow the session to continue even if one update fails
    }
  }
}

export const deepFocusSessionService = new DeepFocusSessionService(); 