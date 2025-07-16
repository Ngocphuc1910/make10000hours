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
  
  // Removed - web app no longer creates sessions

  // Removed - web app no longer creates sessions, only extension does

  // Removed - web app no longer creates sessions, only extension does

  // Removed - web app no longer creates or manages sessions, only extension does

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
        where('userId', '==', userId),
        where('status', '!=', 'deleted') // Exclude deleted sessions
      );

      // Add date filtering at database level if provided
      if (startDate && endDate) {
        // Convert to Firestore Timestamp for database filtering
        const startTimestamp = Timestamp.fromDate(startDate);
        const endTimestamp = Timestamp.fromDate(endDate);
        
        // Note: We can't use multiple inequality filters in Firestore, so we'll filter deleted sessions in JavaScript
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
      
      // Map documents to sessions, filtering out deleted sessions if date filtering is used
      const sessions = querySnapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            userId: data.userId,
            startTime: data.startTime?.toDate() || new Date(),
            endTime: data.endTime?.toDate(),
            duration: data.duration,
            status: data.status,
            source: data.source || 'extension',
            timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            localDate: data.localDate || new Date(data.startTime?.toDate ? data.startTime.toDate() : data.startTime).toISOString().split('T')[0],
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date()
          };
        })
        .filter(session => session.status !== 'deleted'); // Filter out deleted sessions in JavaScript when date filtering is used

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
          source: data.source || 'extension',
          timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          localDate: data.localDate || new Date(data.startTime?.toDate ? data.startTime.toDate() : data.startTime).toISOString().split('T')[0],
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
          source: data.source || 'extension',
          timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          localDate: data.localDate || new Date(data.startTime?.toDate ? data.startTime.toDate() : data.startTime).toISOString().split('T')[0],
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

  // Removed - web app no longer manages sessions, only extension does

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

  // Removed - web app no longer manages sessions, only extension does
}

export const deepFocusSessionService = new DeepFocusSessionService(); 