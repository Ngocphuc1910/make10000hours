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
  increment,
  limit
} from 'firebase/firestore';
import { db } from './firebase';
import { DeepFocusSession, Source } from '../types/models';
import { 
  TimezoneFilteringUtils, 
  SessionQueryOptions, 
  UTC_FILTERING_ENABLED, 
  UTCTimeRange 
} from '../utils/timezoneFiltering';
import { executeUTCQuery } from '../utils/queryCircuitBreaker';

class DeepFocusSessionService {
  private readonly collectionName = 'deepFocusSessions';
  
  // Removed - web app no longer creates sessions

  // Removed - web app no longer creates sessions, only extension does

  // Removed - web app no longer creates sessions, only extension does

  // Removed - web app no longer creates or manages sessions, only extension does

  /**
   * Get all deep focus sessions for a user with enhanced UTC filtering support
   * 
   * ENHANCED: Now supports both legacy and UTC-based filtering with automatic fallback
   * - Uses UTC filtering when enabled and startDate/endDate provided
   * - Falls back to legacy createdAt filtering if UTC fails
   * - Circuit breaker protection prevents cascading failures
   */
  async getUserSessions(
    userId: string, 
    optionsOrStartDate?: SessionQueryOptions | Date, 
    legacyEndDate?: Date
  ): Promise<DeepFocusSession[]> {
    // Handle legacy method signature for backward compatibility
    let options: SessionQueryOptions;
    
    if (optionsOrStartDate instanceof Date) {
      // Legacy signature: getUserSessions(userId, startDate, endDate)
      options = {
        startDate: optionsOrStartDate,
        endDate: legacyEndDate,
        timezone: TimezoneFilteringUtils.getUserEffectiveTimezone(),
        useUTC: UTC_FILTERING_ENABLED,
        orderBy: 'desc',
        limit: 100
      };
    } else {
      // New signature: getUserSessions(userId, options)
      options = {
        timezone: TimezoneFilteringUtils.getUserEffectiveTimezone(),
        useUTC: UTC_FILTERING_ENABLED,
        orderBy: 'desc',
        limit: 100,
        ...optionsOrStartDate
      };
    }

    return this.executeSessionQuery(userId, this.resolveQueryOptions(options));
  }

  /**
   * Resolve query options with defaults
   */
  private resolveQueryOptions(options: SessionQueryOptions): Required<SessionQueryOptions> {
    // Try to get user data for timezone resolution
    let userSettings;
    try {
      if (typeof window !== 'undefined' && (window as any).useUserStore) {
        const userStore = (window as any).useUserStore;
        userSettings = userStore.getState?.()?.user?.settings;
      }
    } catch (error) {
      console.warn('⚠️ Could not access user store for timezone detection:', error);
    }

    return {
      startDate: options.startDate || new Date(),
      endDate: options.endDate || new Date(),
      timezone: options.timezone || TimezoneFilteringUtils.getUserEffectiveTimezone(userSettings),
      useUTC: options.useUTC ?? UTC_FILTERING_ENABLED,
      orderBy: options.orderBy || 'desc',
      limit: options.limit || 100
    };
  }

  /**
   * Core session query execution with UTC filtering and circuit breaker protection
   */
  private async executeSessionQuery(userId: string, options: Required<SessionQueryOptions>): Promise<DeepFocusSession[]> {
    // Use circuit breaker for query protection with automatic fallback
    return executeUTCQuery(
      () => this.queryWithUTCFiltering(userId, options),
      () => this.queryWithLegacyFiltering(userId, options),
      `getUserSessions-${userId}`
    );
  }

  /**
   * UTC-based filtering query (new method)
   */
  private async queryWithUTCFiltering(userId: string, options: Required<SessionQueryOptions>): Promise<DeepFocusSession[]> {
    const { startDate, endDate, timezone } = options;
    
    if (!startDate || !endDate) {
      throw new Error('Start and end dates required for UTC filtering');
    }

    console.log('🌍 UTC filtering query:', {
      userId,
      dateRange: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
      timezone,
      utcEnabled: UTC_FILTERING_ENABLED
    });

    // Convert local date range to UTC for database query
    const { utcStart, utcEnd } = TimezoneFilteringUtils.convertLocalDateRangeToUTC(
      startDate,
      endDate,
      timezone
    );

    // Build Firestore query with UTC filtering
    let q = query(
      collection(db, this.collectionName),
      where('userId', '==', userId),
      where('startTimeUTC', '>=', utcStart),
      where('startTimeUTC', '<=', utcEnd)
    );

    // Add status filtering (exclude deleted sessions)
    // Note: Firestore doesn't allow multiple range queries, so we filter status in JavaScript
    
    // Add ordering
    if (options.orderBy === 'desc') {
      q = query(q, orderBy('startTimeUTC', 'desc'));
    } else {
      q = query(q, orderBy('startTimeUTC', 'asc'));
    }

    // Add limit
    if (options.limit) {
      q = query(q, limit(options.limit));
    }

    const querySnapshot = await getDocs(q);
    const sessions = querySnapshot.docs
      .map(doc => this.mapFirebaseSession(doc))
      .filter(session => session.status === 'active' || session.status === 'completed' || session.status === 'suspended'); // Only include valid sessions

    console.log(`✅ UTC filtering found ${sessions.length} sessions in range ${utcStart} to ${utcEnd}`);
    return sessions;
  }

  /**
   * Legacy createdAt-based filtering query (fallback method)
   */
  private async queryWithLegacyFiltering(userId: string, options: Required<SessionQueryOptions>): Promise<DeepFocusSession[]> {
    console.log('🔄 Legacy filtering query:', {
      userId,
      hasDateFilter: !!(options.startDate && options.endDate),
      dateRange: options.startDate && options.endDate ? 
        `${options.startDate.toISOString().split('T')[0]} to ${options.endDate.toISOString().split('T')[0]}` : 'all time'
    });
      
    // Build query with database-level date filtering for efficiency  
    let q = query(
      collection(db, this.collectionName),
      where('userId', '==', userId)
      // Note: status filtering done in JavaScript since 'deleted' is not a valid status
    );

    // Add date filtering at database level if provided
    if (options.startDate && options.endDate) {
      const { startDate, endDate } = options;
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
    
    // Add ordering and limit
    if (options.orderBy === 'desc') {
      q = query(q, orderBy('createdAt', 'desc'));
    } else {
      q = query(q, orderBy('createdAt', 'asc'));
    }
    
    if (options.limit) {
      q = query(q, limit(options.limit));
    }
    
    const querySnapshot = await getDocs(q);
    const sessions = querySnapshot.docs
      .map(doc => this.mapFirebaseSession(doc))
      .filter(session => session.status === 'active' || session.status === 'completed' || session.status === 'suspended');
    
    console.log('✅ Legacy query completed:', {
      sessionsReturned: sessions.length,
      approach: options.startDate && options.endDate ? 'database-filtered' : 'all-sessions'
    });
    
    return sessions;
  }

  /**
   * Helper method to map Firestore document to DeepFocusSession
   */
  private mapFirebaseSession(doc: any): DeepFocusSession {
    const data = doc.data();
    
    // Helper function to safely convert timestamps
    const safeToDate = (timestamp: any): Date | null => {
      if (!timestamp) return null;
      if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        return timestamp.toDate();
      }
      if (timestamp instanceof Date) {
        return timestamp;
      }
      if (typeof timestamp === 'string') {
        return new Date(timestamp);
      }
      if (typeof timestamp === 'number') {
        return new Date(timestamp);
      }
      return null;
    };
    
    // Convert timestamps with fallback handling
    const startTime = safeToDate(data.startTime);
    const endTime = safeToDate(data.endTime);
    const createdAt = safeToDate(data.createdAt) || new Date();
    const updatedAt = safeToDate(data.updatedAt) || new Date();
    
    // Calculate localDate safely
    let localDate = data.localDate;
    if (!localDate && startTime) {
      localDate = startTime.toISOString().split('T')[0];
    }
    
    return {
      id: doc.id,
      userId: data.userId,
      startTime: startTime || new Date(),
      endTime: endTime,
      duration: data.duration,
      status: data.status,
      source: data.source || 'extension',
      timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      localDate: localDate || new Date().toISOString().split('T')[0],
      createdAt: createdAt,
      updatedAt: updatedAt,
      // Include UTC fields if present
      startTimeUTC: data.startTimeUTC,
      endTimeUTC: data.endTimeUTC,
      utcDate: data.utcDate
    };
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
        
        // Helper function to safely convert timestamps
        const safeToDate = (timestamp: any): Date | null => {
          if (!timestamp) return null;
          if (timestamp.toDate && typeof timestamp.toDate === 'function') {
            return timestamp.toDate();
          }
          if (timestamp instanceof Date) {
            return timestamp;
          }
          if (typeof timestamp === 'string') {
            return new Date(timestamp);
          }
          if (typeof timestamp === 'number') {
            return new Date(timestamp);
          }
          return null;
        };
        
        // Convert timestamps with fallback handling
        const startTime = safeToDate(data.startTime);
        const endTime = safeToDate(data.endTime);
        const createdAt = safeToDate(data.createdAt) || new Date();
        const updatedAt = safeToDate(data.updatedAt) || new Date();
        
        // Calculate localDate safely
        let localDate = data.localDate;
        if (!localDate && startTime) {
          localDate = startTime.toISOString().split('T')[0];
        }
        
        return {
          id: doc.id,
          userId: data.userId,
          startTime: startTime || new Date(),
          endTime: endTime,
          duration: data.duration,
          status: data.status,
          source: data.source || 'extension',
          timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          localDate: localDate || new Date().toISOString().split('T')[0],
          createdAt: createdAt,
          updatedAt: updatedAt
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
   * Subscribe to user's deep focus sessions with UTC filtering support
   * CRITICAL FIX: Apply same filtering logic to real-time subscriptions (friend's feedback)
   */
  subscribeToUserSessions(
    userId: string, 
    callback: (sessions: DeepFocusSession[]) => void,
    options?: SessionQueryOptions
  ): () => void {
    const resolvedOptions = this.resolveQueryOptions(options || {});

    let q = query(
      collection(db, this.collectionName),
      where('userId', '==', userId)
    );

    // 🔧 CRITICAL: Apply same filtering logic to real-time subscriptions (friend's feedback)
    if (resolvedOptions.useUTC && resolvedOptions.startDate && resolvedOptions.endDate) {
      const { utcStart, utcEnd } = TimezoneFilteringUtils.convertLocalDateRangeToUTC(
        resolvedOptions.startDate, 
        resolvedOptions.endDate, 
        resolvedOptions.timezone
      );
      
      console.log('🌍 Real-time subscription with UTC filtering:', {
        userId,
        utcRange: `${utcStart} to ${utcEnd}`,
        timezone: resolvedOptions.timezone
      });
      
      q = query(q,
        where('startTimeUTC', '>=', utcStart),
        where('startTimeUTC', '<=', utcEnd)
      );
      
      // Add ordering
      if (resolvedOptions.orderBy === 'desc') {
        q = query(q, orderBy('startTimeUTC', 'desc'));
      } else {
        q = query(q, orderBy('startTimeUTC', 'asc'));
      }
    } else {
      console.log('🔄 Real-time subscription with legacy filtering:', { userId });
      
      // Legacy ordering by createdAt
      if (resolvedOptions.orderBy === 'desc') {
        q = query(q, orderBy('createdAt', 'desc'));
      } else {
        q = query(q, orderBy('createdAt', 'asc'));
      }
    }

    return onSnapshot(q, (querySnapshot) => {
      let sessions = querySnapshot.docs
        .map(doc => this.mapFirebaseSession(doc))
        .filter(session => session.status === 'active' || session.status === 'completed' || session.status === 'suspended'); // Only include valid sessions
      
      // Apply limit in JavaScript if specified
      if (resolvedOptions.limit) {
        sessions = sessions.slice(0, resolvedOptions.limit);
      }
      
      console.log(`📡 Real-time update: ${sessions.length} sessions received`);
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