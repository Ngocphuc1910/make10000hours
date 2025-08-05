import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit as firestoreLimit,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  Timestamp,
  QuerySnapshot,
  DocumentSnapshot
} from 'firebase/firestore';
import { firestore } from '../firebase/firebaseConfig';
import { unifiedTimezoneService } from './unifiedTimezoneService';
import { utcFeatureFlags } from './featureFlags';
import { utcMonitoring } from './monitoring';
import type { WorkSession } from '../types/models';

interface UTCWorkSession extends WorkSession {
  startTimeUTC: string;
  endTimeUTC?: string;
  createdAtUTC: string;
  updatedAtUTC: string;
  timezoneContext: {
    userTimezone: string;
    utcOffset: number;
    isDST: boolean;
    source: 'user' | 'detected' | 'fallback';
  };
}

export class WorkSessionServiceUTC {
  private collectionName = 'workSessions';

  /**
   * Create work session with proper UTC timezone handling
   */
  async createWorkSession(
    sessionData: Partial<WorkSession>,
    userId: string,
    source: 'web' | 'extension' = 'web'
  ): Promise<string> {
    try {
      // Check if UTC features are enabled
      const utcEnabled = utcFeatureFlags.isFeatureEnabled('utcWorkSessions', userId);
      
      if (!utcEnabled) {
        // Fallback to legacy work session service
        const { workSessionService } = await import('../api/workSessionService');
        return await workSessionService.createWorkSession(sessionData as WorkSession);
      }

      const sessionId = `utc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Use unified timezone service for consistent UTC handling
      const utcSessionData = unifiedTimezoneService.createUTCWorkSession({
        ...sessionData,
        id: sessionId,
        userId
      }, source);

      const docRef = doc(firestore, this.collectionName, sessionId);
      await setDoc(docRef, utcSessionData);

      utcMonitoring.trackOperation('utc_work_session_create', true);
      
      console.log('✅ UTC work session created:', {
        sessionId,
        source,
        timezone: utcSessionData.timezoneContext.userTimezone,
        startTimeUTC: utcSessionData.startTimeUTC
      });

      return sessionId;
    } catch (error) {
      console.error('❌ Failed to create UTC work session:', error);
      utcMonitoring.trackOperation('utc_work_session_create', false);
      throw error;
    }
  }

  /**
   * Query sessions by date range using UTC timestamps (SOLVES CORE PROBLEM)
   */
  async getSessionsByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
    userTimezone?: string
  ): Promise<UTCWorkSession[]> {
    try {
      // Create UTC query parameters
      const { queryParams, timezone, dateRange } = unifiedTimezoneService.createUTCQuery(
        userId,
        startDate,
        endDate,
        userTimezone
      );

      console.log('🔍 UTC Query Details:', {
        userId,
        originalDateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        utcQueryRange: {
          start: dateRange.startUTC,
          end: dateRange.endUTC
        },
        timezone
      });

      // Firebase query using startTimeUTC (avoids compound query issues)
      const q = query(
        collection(firestore, this.collectionName),
        where('userId', '==', userId),
        where('startTimeUTC', '>=', dateRange.startUTC),
        where('startTimeUTC', '<=', dateRange.endUTC),
        orderBy('startTimeUTC', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const sessions: UTCWorkSession[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        sessions.push({
          id: doc.id,
          ...data,
          // Convert Firestore timestamps to Dates for compatibility
          startTime: data.startTime?.toDate?.() || new Date(data.startTime),
          endTime: data.endTime?.toDate?.() || new Date(data.endTime),
          createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt)
        } as UTCWorkSession);
      });

      utcMonitoring.trackOperation('utc_work_session_query', true);

      console.log('✅ UTC Query Results:', {
        sessionsFound: sessions.length,
        dateRange: `${startDate.toDateString()} to ${endDate.toDateString()}`,
        timezone,
        firstSession: sessions[0] ? {
          id: sessions[0].id,
          startTimeUTC: sessions[0].startTimeUTC,
          date: sessions[0].date
        } : null
      });

      return sessions;
    } catch (error) {
      console.error('❌ UTC session query failed:', error);
      utcMonitoring.trackOperation('utc_work_session_query', false);
      throw error;
    }
  }

  /**
   * Get today's sessions using user's timezone
   */
  async getTodaySessions(userId: string, userTimezone?: string): Promise<UTCWorkSession[]> {
    const timezone = userTimezone || unifiedTimezoneService.getUserTimezone();
    const today = new Date();
    
    console.log('📅 Getting today\'s sessions:', {
      userId,
      timezone,
      todayLocal: today.toLocaleDateString(),
      todayUTC: today.toISOString()
    });

    return this.getSessionsByDateRange(userId, today, today, timezone);
  }

  /**
   * Update session with UTC timestamp tracking
   */
  async updateSession(
    sessionId: string,
    updates: Partial<WorkSession>
  ): Promise<void> {
    try {
      const docRef = doc(firestore, this.collectionName, sessionId);
      
      // Add UTC update timestamp
      const utcUpdates = {
        ...updates,
        updatedAt: new Date(),
        updatedAtUTC: new Date().toISOString()
      };

      // If updating end time, add UTC end time
      if (updates.endTime) {
        utcUpdates.endTimeUTC = new Date(updates.endTime).toISOString();
      }

      await updateDoc(docRef, utcUpdates);
      
      utcMonitoring.trackOperation('utc_work_session_update', true);
      
      console.log('✅ UTC work session updated:', {
        sessionId,
        updatedAtUTC: utcUpdates.updatedAtUTC
      });
    } catch (error) {
      console.error('❌ Failed to update UTC work session:', error);
      utcMonitoring.trackOperation('utc_work_session_update', false);
      throw error;
    }
  }

  /**
   * Get session for display (converts UTC to user timezone)
   */
  async getSessionForDisplay(
    sessionId: string,
    userTimezone?: string
  ): Promise<UTCWorkSession | null> {
    try {
      const docRef = doc(firestore, this.collectionName, sessionId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const sessionData = {
        id: docSnap.id,
        ...docSnap.data(),
        // Convert Firestore timestamps
        startTime: docSnap.data().startTime?.toDate?.() || new Date(docSnap.data().startTime),
        endTime: docSnap.data().endTime?.toDate?.() || new Date(docSnap.data().endTime),
        createdAt: docSnap.data().createdAt?.toDate?.() || new Date(docSnap.data().createdAt),
        updatedAt: docSnap.data().updatedAt?.toDate?.() || new Date(docSnap.data().updatedAt)
      } as UTCWorkSession;

      // Convert UTC timestamps to user timezone for display
      return unifiedTimezoneService.convertUTCSessionForDisplay(sessionData, userTimezone);
    } catch (error) {
      console.error('❌ Failed to get session for display:', error);
      return null;
    }
  }

  /**
   * Real-time subscription with UTC timezone awareness
   */
  subscribeToUserSessions(
    userId: string,
    callback: (sessions: UTCWorkSession[]) => void,
    userTimezone?: string
  ): () => void {
    try {
      const q = query(
        collection(firestore, this.collectionName),
        where('userId', '==', userId),
        orderBy('startTimeUTC', 'desc'),
        firestoreLimit(100) // Reasonable limit for real-time
      );

      return onSnapshot(q, (snapshot) => {
        const sessions: UTCWorkSession[] = [];
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          const session = {
            id: doc.id,
            ...data,
            startTime: data.startTime?.toDate?.() || new Date(data.startTime),
            endTime: data.endTime?.toDate?.() || new Date(data.endTime),
            createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
            updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt)
          } as UTCWorkSession;

          // Convert for display if timezone provided
          const displaySession = userTimezone ? 
            unifiedTimezoneService.convertUTCSessionForDisplay(session, userTimezone) : 
            session;

          sessions.push(displaySession);
        });

        callback(sessions);
      });
    } catch (error) {
      console.error('❌ Failed to subscribe to UTC sessions:', error);
      return () => {}; // Return no-op cleanup function
    }
  }

  /**
   * Migration helper: Add UTC fields to existing sessions
   */
  async backfillUTCFields(
    sessionId: string,
    legacySession: WorkSession
  ): Promise<void> {
    try {
      const docRef = doc(firestore, this.collectionName, sessionId);
      
      // Generate UTC fields from legacy data
      const utcFields = {
        startTimeUTC: legacySession.startTime ? 
          new Date(legacySession.startTime).toISOString() : 
          new Date().toISOString(),
        endTimeUTC: legacySession.endTime ? 
          new Date(legacySession.endTime).toISOString() : 
          undefined,
        createdAtUTC: legacySession.createdAt ? 
          new Date(legacySession.createdAt).toISOString() : 
          new Date().toISOString(),
        updatedAtUTC: new Date().toISOString(),
        timezoneContext: unifiedTimezoneService.createTimezoneContext(),
        migratedToUTC: true,
        migrationTimestamp: new Date().toISOString()
      };

      await updateDoc(docRef, utcFields);
      
      console.log('✅ Session backfilled with UTC fields:', sessionId);
    } catch (error) {
      console.error('❌ Failed to backfill UTC fields:', error);
      throw error;
    }
  }

  /**
   * Health check: Validate UTC data consistency
   */
  async validateUTCConsistency(sessionId: string): Promise<{
    isConsistent: boolean;
    issues: string[];
  }> {
    try {
      const session = await this.getSessionForDisplay(sessionId);
      
      if (!session) {
        return { isConsistent: false, issues: ['Session not found'] };
      }

      const issues: string[] = [];

      // Check UTC fields exist
      if (!session.startTimeUTC) issues.push('Missing startTimeUTC');
      if (!session.createdAtUTC) issues.push('Missing createdAtUTC');
      if (!session.timezoneContext) issues.push('Missing timezoneContext');

      // Check timezone context validity
      if (session.timezoneContext) {
        const { userTimezone } = session.timezoneContext;
        try {
          Intl.DateTimeFormat(undefined, { timeZone: userTimezone });
        } catch {
          issues.push(`Invalid timezone: ${userTimezone}`);
        }
      }

      return {
        isConsistent: issues.length === 0,
        issues
      };
    } catch (error) {
      return {
        isConsistent: false,
        issues: [`Validation error: ${error.message}`]
      };
    }
  }
}

// Export singleton instance
export const workSessionServiceUTC = new WorkSessionServiceUTC();