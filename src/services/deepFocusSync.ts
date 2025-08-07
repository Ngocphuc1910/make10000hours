import { collection, addDoc, updateDoc, doc, serverTimestamp, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../api/firebase';
import { DeepFocusSession } from '../types/models';
import ExtensionDataService from './extensionDataService';
import { timezoneUtils } from '../utils/timezoneUtils';

export class DeepFocusSync {
  private static isEnabled = true;
  private static retryDelay = 1000; // Start with 1 second
  private static maxRetryDelay = 60000; // Max 1 minute
  private static maxRetries = 3;
  
  // Sync lock mechanism to prevent race conditions
  private static syncLocks = new Map<string, Promise<any>>();

  /**
   * Acquire sync lock for a specific session to prevent race conditions
   */
  private static async acquireSyncLock<T>(sessionId: string, operation: () => Promise<T>): Promise<T> {
    const lockKey = sessionId;
    
    // If there's already a lock for this session, wait for it
    if (this.syncLocks.has(lockKey)) {
      console.log(`⏳ Waiting for existing sync lock for session ${sessionId}`);
      await this.syncLocks.get(lockKey);
    }
    
    // Create new lock for this operation
    const lockPromise = operation();
    this.syncLocks.set(lockKey, lockPromise);
    
    try {
      const result = await lockPromise;
      return result;
    } finally {
      // Always clean up the lock
      this.syncLocks.delete(lockKey);
    }
  }

  /**
   * Sync Deep Focus sessions from extension to Firebase
   */
  static async syncSessionsFromExtension(userId: string): Promise<{ success: boolean; synced: number; error?: string }> {
    if (!this.isEnabled) {
      return { success: false, error: 'Deep Focus sync is disabled', synced: 0 };
    }

    try {
      console.log('🔄 Starting Deep Focus session sync for user:', userId);
      
      // Get sessions from extension
      const extensionResponse = await ExtensionDataService.getAllDeepFocusSessions();
      
      if (!extensionResponse.success || !extensionResponse.data) {
        throw new Error(extensionResponse.error || 'Failed to get sessions from extension');
      }

      const extensionSessions = extensionResponse.data;
      console.log(`📖 Retrieved ${extensionSessions.length} sessions from extension`);

      let syncedCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];

      for (const session of extensionSessions) {
        try {
          const result = await this.syncSingleSession(userId, session);
          if (result === 'synced' || result === 'updated') {
            syncedCount++;
            console.log(`✅ ${result === 'synced' ? 'Synced' : 'Updated'} session ${session.id}`);
          } else {
            skippedCount++;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Session ${session.id}: ${errorMsg}`);
          console.error(`❌ Failed to sync session ${session.id}:`, error);
        }
      }

      console.log(`🔄 Sync completed: ${syncedCount}/${extensionSessions.length} sessions synced, ${skippedCount} skipped (duplicates)`);
      
      return {
        success: errors.length === 0,
        synced: syncedCount,
        error: errors.length > 0 ? errors.join('; ') : undefined
      };
    } catch (error) {
      console.error('❌ Deep Focus sync failed:', error);
      return {
        success: false,
        synced: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get existing session from Firebase if it exists (with duplicate detection)
   */
  private static async getExistingSession(userId: string, extensionSessionId: string): Promise<{ exists: boolean; docId?: string; data?: any; duplicates?: number }> {
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        const q = query(
          collection(db, 'deepFocusSessions'),
          where('userId', '==', userId),
          where('extensionSessionId', '==', extensionSessionId)
        );
        
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
          return { exists: false };
        }
        
        // Detect and handle duplicates
        if (querySnapshot.docs.length > 1) {
          console.warn(`⚠️ Found ${querySnapshot.docs.length} duplicate sessions for extensionSessionId: ${extensionSessionId}`);
          
          // Use the most recently updated document
          const sortedDocs = querySnapshot.docs.sort((a, b) => {
            const aUpdated = a.data().updatedAt?.toDate?.() || a.data().createdAt?.toDate?.() || new Date(0);
            const bUpdated = b.data().updatedAt?.toDate?.() || b.data().createdAt?.toDate?.() || new Date(0);
            return bUpdated.getTime() - aUpdated.getTime();
          });
          
          const mostRecentDoc = sortedDocs[0];
          return { 
            exists: true, 
            docId: mostRecentDoc.id, 
            data: mostRecentDoc.data(),
            duplicates: querySnapshot.docs.length - 1
          };
        }
        
        const doc = querySnapshot.docs[0];
        return { 
          exists: true, 
          docId: doc.id, 
          data: doc.data() 
        };
      } catch (error) {
        retryCount++;
        console.error(`❌ Error checking session existence (attempt ${retryCount}/${maxRetries}):`, error);
        
        if (retryCount >= maxRetries) {
          // After all retries failed, we MUST NOT create a duplicate
          // Instead, throw the error to prevent sync and avoid data corruption
          throw new Error(`Failed to check session existence after ${maxRetries} attempts: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      }
    }
    
    return { exists: false }; // This should never be reached due to throw above
  }

  /**
   * Sync a single session with forced duration update (ignores status)
   * Creates session if it doesn't exist, always updates duration
   */
  private static async syncSingleSessionWithForcedUpdate(userId: string, extensionSession: any): Promise<'synced' | 'updated'> {
    // Use sync lock to prevent race conditions
    return await this.acquireSyncLock(extensionSession.id, async () => {
      const collectionName = 'deepFocusSessions';
      
      try {
        // Check if session already exists in Firebase
        const existingSession = await this.getExistingSession(userId, extensionSession.id);
      
      if (existingSession.exists) {
        // Always update duration regardless of status
        console.log(`🔄 Session ${extensionSession.id} exists, force updating duration`);
        
        const updateData = {
          duration: extensionSession.duration || 0,
          endTime: extensionSession.endTime ? Timestamp.fromDate(new Date(extensionSession.endTime)) : null,
          status: extensionSession.status,
          updatedAt: serverTimestamp(),
          
          // ✅ PRESERVE ALL UTC FIELDS when updating existing sessions
          startTimeUTC: extensionSession.startTimeUTC || null,
          endTimeUTC: extensionSession.endTimeUTC || null,
          utcDate: extensionSession.utcDate || (extensionSession.startTimeUTC ? 
            extensionSession.startTimeUTC.split('T')[0] : null)
        };
        
        await updateDoc(doc(db, collectionName, existingSession.docId!), updateData);
        console.log(`🔄 Successfully force updated session ${extensionSession.id} with duration: ${extensionSession.duration}ms`);
        return 'updated';
      }

      // Transform extension session to Firebase format for new sessions
      const firebaseSession: Partial<DeepFocusSession> = {
        userId,
        
        // ✅ PRESERVE UTC TIMESTAMPS - Use exact UTC strings from extension
        startTime: extensionSession.startTimeUTC ? 
          new Date(extensionSession.startTimeUTC) : 
          new Date(extensionSession.startTime),
        
        endTime: extensionSession.endTimeUTC ? 
          new Date(extensionSession.endTimeUTC) : 
          (extensionSession.endTime ? new Date(extensionSession.endTime) : null),
        
        // ✅ ADD DEDICATED UTC FIELDS for consistent filtering
        startTimeUTC: extensionSession.startTimeUTC || null,
        endTimeUTC: extensionSession.endTimeUTC || null,
        
        // ✅ ADD UTC DATE FIELD from extension for easy filtering
        utcDate: extensionSession.utcDate || (extensionSession.startTimeUTC ? 
          new Date(extensionSession.startTimeUTC).toISOString().split('T')[0] : null),
        
        duration: extensionSession.duration || 0,
        status: extensionSession.status || 'completed',
        source: 'extension' as const,
        
        // Track extension session ID to prevent duplicates
        extensionSessionId: extensionSession.id,
        
        // Enhanced timezone data (prioritize extension timezone info)
        timezone: extensionSession.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        localDate: extensionSession.localDate || 
          this.calculateLocalDate(extensionSession.startTimeUTC || extensionSession.startTime, extensionSession.timezone),
        
        createdAt: extensionSession.createdAt ? new Date(extensionSession.createdAt) : 
          (extensionSession.startTimeUTC ? new Date(extensionSession.startTimeUTC) : new Date(extensionSession.startTime)),
        updatedAt: extensionSession.updatedAt ? new Date(extensionSession.updatedAt) : new Date()
      };

      // Create Firebase document with explicit field control
      const firebaseDoc = {
        // Basic session info
        userId: firebaseSession.userId,
        duration: firebaseSession.duration,
        status: firebaseSession.status,
        source: firebaseSession.source,
        extensionSessionId: firebaseSession.extensionSessionId,
        timezone: firebaseSession.timezone,
        localDate: firebaseSession.localDate,
        
        // Firebase Timestamps (for compatibility)
        startTime: Timestamp.fromDate(firebaseSession.startTime!),
        endTime: firebaseSession.endTime ? Timestamp.fromDate(firebaseSession.endTime) : null,
        createdAt: Timestamp.fromDate(firebaseSession.createdAt!),
        updatedAt: serverTimestamp(),
        
        // ✅ CRITICAL: Raw UTC strings from extension (exact preservation)
        startTimeUTC: extensionSession.startTimeUTC || null,
        endTimeUTC: extensionSession.endTimeUTC || null,
        utcDate: extensionSession.utcDate || (extensionSession.startTimeUTC ? 
          extensionSession.startTimeUTC.split('T')[0] : null)
      };

      await addDoc(collection(db, collectionName), firebaseDoc);

        console.log(`📝 Successfully synced new session ${extensionSession.id} to Firebase with UTC data: ${extensionSession.startTimeUTC}`);
        return 'synced';
      } catch (error) {
        console.error(`❌ Failed to sync session ${extensionSession.id}:`, error);
        throw error;
      }
    });
  }

  /**
   * Sync a single session from extension to Firebase
   */
  private static async syncSingleSession(userId: string, extensionSession: any): Promise<'synced' | 'updated' | 'skipped'> {
    // Use sync lock to prevent race conditions
    return await this.acquireSyncLock(extensionSession.id, async () => {
      const collectionName = 'deepFocusSessions';
      
      try {
        // Check if session already exists in Firebase
        const existingSession = await this.getExistingSession(userId, extensionSession.id);
      
      if (existingSession.exists) {
        // For active sessions, update with latest data from extension
        if (extensionSession.status === 'active') {
          console.log(`🔄 Session ${extensionSession.id} is active, updating with latest data`);
          
          const updateData = {
            duration: extensionSession.duration || 0,
            endTime: extensionSession.endTime ? Timestamp.fromDate(new Date(extensionSession.endTime)) : null,
            status: extensionSession.status,
            updatedAt: serverTimestamp()
          };
          
          await updateDoc(doc(db, collectionName, existingSession.docId!), updateData);
          console.log(`🔄 Successfully updated active session ${extensionSession.id}`);
          return 'updated';
        } else {
          // For completed sessions, skip if already exists
          console.log(`⏭️ Session ${extensionSession.id} already exists in Firebase, skipping`);
          return 'skipped';
        }
      }

      // Transform extension session to Firebase format
      const firebaseSession: Partial<DeepFocusSession> = {
        userId,
        
        // Use UTC timestamp from extension (with fallback to converted local time)
        startTime: extensionSession.startTimeUTC ? 
          new Date(extensionSession.startTimeUTC) : 
          new Date(extensionSession.startTime),
        
        endTime: extensionSession.endTimeUTC ? 
          new Date(extensionSession.endTimeUTC) : 
          (extensionSession.endTime ? new Date(extensionSession.endTime) : null),
        
        duration: extensionSession.duration || 0,
        status: extensionSession.status || 'completed',
        source: 'extension' as const,
        
        // Track extension session ID to prevent duplicates
        extensionSessionId: extensionSession.id,
        
        // Enhanced timezone data (prioritize extension timezone info)
        timezone: extensionSession.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        localDate: extensionSession.localDate || 
          this.calculateLocalDate(extensionSession.startTimeUTC || extensionSession.startTime, extensionSession.timezone),
        
        createdAt: extensionSession.createdAt ? new Date(extensionSession.createdAt) : 
          (extensionSession.startTimeUTC ? new Date(extensionSession.startTimeUTC) : new Date(extensionSession.startTime)),
        updatedAt: extensionSession.updatedAt ? new Date(extensionSession.updatedAt) : new Date()
      };

      await addDoc(collection(db, collectionName), {
        ...firebaseSession,
        // Convert dates to Firestore Timestamps
        startTime: Timestamp.fromDate(firebaseSession.startTime!),
        endTime: firebaseSession.endTime ? Timestamp.fromDate(firebaseSession.endTime) : null,
        createdAt: Timestamp.fromDate(firebaseSession.createdAt!),
        updatedAt: serverTimestamp()
      });

        console.log(`📝 Successfully synced session ${extensionSession.id} to Firebase`);
        return 'synced';
      } catch (error) {
        console.error(`❌ Failed to sync session ${extensionSession.id}:`, error);
        throw error;
      }
    });
  }

  /**
   * Sync today's sessions from extension
   */
  static async syncTodaySessionsFromExtension(userId: string): Promise<{ success: boolean; synced: number; error?: string }> {
    if (!this.isEnabled) {
      return { success: false, error: 'Deep Focus sync is disabled', synced: 0 };
    }

    try {
      console.log('🔄 Starting today\'s Deep Focus session sync for user:', userId);
      
      const extensionResponse = await ExtensionDataService.getTodayDeepFocusSessions();
      
      if (!extensionResponse.success || !extensionResponse.data) {
        throw new Error(extensionResponse.error || 'Failed to get today\'s sessions from extension');
      }

      const todaySessions = extensionResponse.data;
      console.log(`📖 Retrieved ${todaySessions.length} today's sessions from extension`);

      let syncedCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];

      for (const session of todaySessions) {
        try {
          const result = await this.syncSingleSession(userId, session);
          if (result === 'synced' || result === 'updated') {
            syncedCount++;
            console.log(`✅ ${result === 'synced' ? 'Synced' : 'Updated'} session ${session.id}`);
          } else {
            skippedCount++;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Session ${session.id}: ${errorMsg}`);
          console.error(`❌ Failed to sync session ${session.id}:`, error);
        }
      }

      console.log(`🔄 Today's sync completed: ${syncedCount}/${todaySessions.length} sessions synced, ${skippedCount} skipped (duplicates)`);
      
      return {
        success: errors.length === 0,
        synced: syncedCount,
        error: errors.length > 0 ? errors.join('; ') : undefined
      };
    } catch (error) {
      console.error('❌ Today\'s Deep Focus sync failed:', error);
      return {
        success: false,
        synced: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Sync sessions for a specific date range
   */
  static async syncDateRangeFromExtension(
    userId: string, 
    startDate: string, 
    endDate: string
  ): Promise<{ success: boolean; synced: number; error?: string }> {
    if (!this.isEnabled) {
      return { success: false, error: 'Deep Focus sync is disabled', synced: 0 };
    }

    try {
      console.log(`🔄 Starting Deep Focus session sync for date range ${startDate} to ${endDate}`);
      
      const extensionResponse = await ExtensionDataService.getDeepFocusSessionsForDateRange(startDate, endDate);
      
      if (!extensionResponse.success || !extensionResponse.data) {
        throw new Error(extensionResponse.error || 'Failed to get sessions from extension');
      }

      const rangeSessions = extensionResponse.data;
      console.log(`📖 Retrieved ${rangeSessions.length} sessions from extension for date range`);

      let syncedCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];

      for (const session of rangeSessions) {
        try {
          const result = await this.syncSingleSession(userId, session);
          if (result === 'synced' || result === 'updated') {
            syncedCount++;
          } else {
            skippedCount++;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Session ${session.id}: ${errorMsg}`);
        }
      }

      console.log(`🔄 Date range sync completed: ${syncedCount}/${rangeSessions.length} sessions synced, ${skippedCount} skipped (duplicates)`);
      
      return {
        success: errors.length === 0,
        synced: syncedCount,
        error: errors.length > 0 ? errors.join('; ') : undefined
      };
    } catch (error) {
      console.error('❌ Date range Deep Focus sync failed:', error);
      return {
        success: false,
        synced: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Enable or disable Deep Focus sync
   */
  static setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    console.log(`🔄 Deep Focus sync ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * PRIORITY: Smart sync that always prioritizes last 10 sessions first
   * This is the main sync method that should be called for optimal performance
   * Prevents duplicate processing by tracking synced sessions
   */
  static async smartSync(userId: string, rangeType: 'today' | 'yesterday' | 'last 7 days' | 'last 30 days' | 'custom' | 'all time' = 'today'): Promise<{ 
    success: boolean; 
    last10: { synced: number; updated: number; sessionIds: string[]; }; 
    additional?: { synced: number; skipped: number; }; 
    error?: string 
  }> {
    if (!this.isEnabled) {
      return { 
        success: false, 
        error: 'Deep Focus sync is disabled', 
        last10: { synced: 0, updated: 0, sessionIds: [] }
      };
    }

    try {
      console.log('🎯 SMART SYNC: Starting prioritized sync for user:', userId, 'range:', rangeType);
      
      // STEP 1: Always sync last 10 sessions first (PRIORITY)
      console.log('🚀 STEP 1: Syncing last 10 sessions (PRIORITY)...');
      
      // Try the new method, fallback to existing method if extension not updated
      let last10Result;
      try {
        last10Result = await this.syncLast10SessionsFromExtensionWithTracking(userId);
      } catch (error) {
        console.warn('⚠️ New last 10 method failed, trying fallback method:', error);
        // Fallback: Use the existing method that works
        const fallbackResult = await this.syncLast10SessionsFromExtension(userId);
        last10Result = {
          ...fallbackResult,
          sessionIds: [] // No session tracking in fallback
        };
        console.log('✅ Fallback method succeeded:', last10Result);
      }
      
      if (!last10Result.success) {
        console.error('❌ PRIORITY sync failed, aborting smart sync');
        return {
          success: false,
          last10: { synced: 0, updated: 0, sessionIds: [] },
          error: `Priority sync failed: ${last10Result.error}`
        };
      }
      
      console.log('✅ STEP 1 completed - Last 10 sessions synced:', last10Result);
      
      // STEP 2: Additional sync based on range type, but skip already processed sessions
      let additionalResult = null;
      
      if (rangeType !== 'all time' && last10Result.sessionIds) {
        console.log('🔄 STEP 2: Additional sync for range completeness (skipping already processed)...');
        
        try {
          if (rangeType === 'today') {
            // For today, sync today's sessions but skip the ones we already processed
            console.log('📅 Additional today sync for completeness (excluding already synced sessions)');
            additionalResult = await this.syncTodaySessionsExcluding(userId, last10Result.sessionIds);
          } else {
            // For other ranges, use 7-day sync but skip already processed sessions
            console.log('📅 Additional 7-day sync for historical data (excluding already synced sessions)');
            additionalResult = await this.syncRecent7DaysExcluding(userId, last10Result.sessionIds);
          }
          
          console.log('✅ STEP 2 completed - Additional sync result:', additionalResult);
        } catch (additionalError) {
          console.warn('⚠️ Additional sync failed, but priority sync succeeded:', additionalError);
          // Don't fail the entire operation if additional sync fails
        }
      }
      
      return {
        success: true,
        last10: { 
          synced: last10Result.synced, 
          updated: last10Result.updated,
          sessionIds: last10Result.sessionIds || []
        },
        additional: additionalResult ? { 
          synced: additionalResult.synced,
          skipped: additionalResult.skipped || 0
        } : undefined
      };
      
    } catch (error) {
      console.error('❌ Smart sync failed:', error);
      return {
        success: false,
        last10: { synced: 0, updated: 0, sessionIds: [] },
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Sync last 10 sessions with session ID tracking to prevent duplicates
   */
  static async syncLast10SessionsFromExtensionWithTracking(userId: string): Promise<{ success: boolean; synced: number; updated: number; sessionIds: string[]; error?: string }> {
    if (!this.isEnabled) {
      return { success: false, error: 'Deep Focus sync is disabled', synced: 0, updated: 0, sessionIds: [] };
    }

    try {
      console.log('🔄 Starting last 10 Deep Focus sessions sync with tracking for user:', userId);
      
      // Check circuit breaker status and reset if needed
      const circuitStatus = ExtensionDataService.getCircuitBreakerStatus();
      if (circuitStatus.state === 'OPEN') {
        console.log('🔧 Circuit breaker is open, attempting reset before sync...');
        ExtensionDataService.resetCircuitBreaker();
        // Wait a moment for reset to take effect
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const extensionResponse = await ExtensionDataService.getLast10DeepFocusSessions();
      
      if (!extensionResponse.success || !extensionResponse.data) {
        throw new Error(extensionResponse.error || 'Failed to get last 10 sessions from extension');
      }

      const last10Sessions = extensionResponse.data;
      console.log(`📖 Retrieved ${last10Sessions.length} last sessions from extension`);

      let syncedCount = 0;
      let updatedCount = 0;
      const syncedSessionIds: string[] = [];
      const errors: string[] = [];

      for (const session of last10Sessions) {
        try {
          const result = await this.syncSingleSessionWithForcedUpdate(userId, session);
          if (result === 'synced') {
            syncedCount++;
            console.log(`✅ Synced session ${session.id}`);
          } else if (result === 'updated') {
            updatedCount++;
            console.log(`🔄 Updated session ${session.id} with latest duration`);
          }
          
          // Track the session ID to prevent duplicate processing
          syncedSessionIds.push(session.id);
          
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Session ${session.id}: ${errorMsg}`);
          console.error(`❌ Failed to sync session ${session.id}:`, error);
        }
      }

      console.log(`🔄 Last 10 sessions sync completed: ${syncedCount} synced, ${updatedCount} updated, ${errors.length} errors`);
      console.log(`📋 Tracked session IDs:`, syncedSessionIds);
      
      return {
        success: errors.length === 0,
        synced: syncedCount,
        updated: updatedCount,
        sessionIds: syncedSessionIds,
        error: errors.length > 0 ? errors.join('; ') : undefined
      };
    } catch (error) {
      console.error('❌ Last 10 sessions sync failed:', error);
      return {
        success: false,
        synced: 0,
        updated: 0,
        sessionIds: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Sync last 10 deep focus sessions from extension with forced duration updates
   * Creates sessions if they don't exist, updates duration regardless of status
   */
  static async syncLast10SessionsFromExtension(userId: string): Promise<{ success: boolean; synced: number; updated: number; error?: string }> {
    if (!this.isEnabled) {
      return { success: false, error: 'Deep Focus sync is disabled', synced: 0, updated: 0 };
    }

    try {
      console.log('🔄 Starting last 10 Deep Focus sessions sync for user:', userId);
      
      const extensionResponse = await ExtensionDataService.getLast10DeepFocusSessions();
      
      if (!extensionResponse.success || !extensionResponse.data) {
        throw new Error(extensionResponse.error || 'Failed to get last 10 sessions from extension');
      }

      const last10Sessions = extensionResponse.data;
      console.log(`📖 Retrieved ${last10Sessions.length} last sessions from extension`);

      let syncedCount = 0;
      let updatedCount = 0;
      const errors: string[] = [];

      for (const session of last10Sessions) {
        try {
          const result = await this.syncSingleSessionWithForcedUpdate(userId, session);
          if (result === 'synced') {
            syncedCount++;
            console.log(`✅ Synced session ${session.id}`);
          } else if (result === 'updated') {
            updatedCount++;
            console.log(`🔄 Updated session ${session.id} with latest duration`);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Session ${session.id}: ${errorMsg}`);
          console.error(`❌ Failed to sync session ${session.id}:`, error);
        }
      }

      console.log(`🔄 Last 10 sessions sync completed: ${syncedCount} synced, ${updatedCount} updated, ${errors.length} errors`);
      
      return {
        success: errors.length === 0,
        synced: syncedCount,
        updated: updatedCount,
        error: errors.length > 0 ? errors.join('; ') : undefined
      };
    } catch (error) {
      console.error('❌ Last 10 sessions sync failed:', error);
      return {
        success: false,
        synced: 0,
        updated: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Sync today's sessions excluding already processed session IDs
   */
  static async syncTodaySessionsExcluding(userId: string, excludeSessionIds: string[]): Promise<{ success: boolean; synced: number; skipped: number; error?: string }> {
    if (!this.isEnabled) {
      return { success: false, error: 'Deep Focus sync is disabled', synced: 0, skipped: 0 };
    }

    try {
      console.log('🔄 Starting today\'s Deep Focus session sync (excluding already processed)');
      console.log('🚫 Excluding session IDs:', excludeSessionIds);
      
      const extensionResponse = await ExtensionDataService.getTodayDeepFocusSessions();
      
      if (!extensionResponse.success || !extensionResponse.data) {
        throw new Error(extensionResponse.error || 'Failed to get today\'s sessions from extension');
      }

      const todaySessions = extensionResponse.data;
      console.log(`📖 Retrieved ${todaySessions.length} today's sessions from extension`);
      
      // Filter out already processed sessions
      const unprocessedSessions = todaySessions.filter(session => !excludeSessionIds.includes(session.id));
      console.log(`🔍 Found ${unprocessedSessions.length} unprocessed sessions (${todaySessions.length - unprocessedSessions.length} skipped)`);

      let syncedCount = 0;
      let skippedCount = todaySessions.length - unprocessedSessions.length;
      const errors: string[] = [];

      for (const session of unprocessedSessions) {
        try {
          const result = await this.syncSingleSession(userId, session);
          if (result === 'synced' || result === 'updated') {
            syncedCount++;
            console.log(`✅ ${result === 'synced' ? 'Synced' : 'Updated'} session ${session.id}`);
          } else {
            // Session was skipped because it already exists
            skippedCount++;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Session ${session.id}: ${errorMsg}`);
          console.error(`❌ Failed to sync session ${session.id}:`, error);
        }
      }

      console.log(`🔄 Today\'s sync completed: ${syncedCount} synced, ${skippedCount} skipped`);
      
      return {
        success: errors.length === 0,
        synced: syncedCount,
        skipped: skippedCount,
        error: errors.length > 0 ? errors.join('; ') : undefined
      };
    } catch (error) {
      console.error('❌ Today\'s Deep Focus sync failed:', error);
      return {
        success: false,
        synced: 0,
        skipped: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Sync recent 7 days excluding already processed session IDs
   */
  static async syncRecent7DaysExcluding(userId: string, excludeSessionIds: string[]): Promise<{ success: boolean; synced: number; skipped: number; error?: string }> {
    if (!this.isEnabled) {
      return { success: false, error: 'Deep Focus sync is disabled', synced: 0, skipped: 0 };
    }

    try {
      console.log('🔄 Starting recent 7 days Deep Focus session sync (excluding already processed)');
      console.log('🚫 Excluding session IDs:', excludeSessionIds);
      
      const extensionResponse = await ExtensionDataService.getRecent7DaysDeepFocusSessions();
      
      if (!extensionResponse.success || !extensionResponse.data) {
        throw new Error(extensionResponse.error || 'Failed to get recent 7 days sessions from extension');
      }

      const recentSessions = extensionResponse.data;
      console.log(`📖 Retrieved ${recentSessions.length} sessions from extension for recent 7 days`);
      
      // Filter out already processed sessions
      const unprocessedSessions = recentSessions.filter(session => !excludeSessionIds.includes(session.id));
      console.log(`🔍 Found ${unprocessedSessions.length} unprocessed sessions (${recentSessions.length - unprocessedSessions.length} skipped)`);

      let syncedCount = 0;
      let skippedCount = recentSessions.length - unprocessedSessions.length;
      const errors: string[] = [];

      for (const session of unprocessedSessions) {
        try {
          const result = await this.syncSingleSession(userId, session);
          if (result === 'synced' || result === 'updated') {
            syncedCount++;
          } else {
            // Session was skipped because it already exists
            skippedCount++;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Session ${session.id}: ${errorMsg}`);
        }
      }

      console.log(`🔄 Recent 7 days sync completed: ${syncedCount} synced, ${skippedCount} skipped`);
      
      return {
        success: errors.length === 0,
        synced: syncedCount,
        skipped: skippedCount,
        error: errors.length > 0 ? errors.join('; ') : undefined
      };
    } catch (error) {
      console.error('❌ Recent 7 days Deep Focus sync failed:', error);
      return {
        success: false,
        synced: 0,
        skipped: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Sync recent 7 days of sessions from extension (includes today)
   */
  static async syncRecent7DaysFromExtension(userId: string): Promise<{ success: boolean; synced: number; error?: string }> {
    if (!this.isEnabled) {
      return { success: false, error: 'Deep Focus sync is disabled', synced: 0 };
    }

    try {
      console.log('🔄 Starting recent 7 days Deep Focus session sync for user:', userId);
      
      const extensionResponse = await ExtensionDataService.getRecent7DaysDeepFocusSessions();
      
      if (!extensionResponse.success || !extensionResponse.data) {
        throw new Error(extensionResponse.error || 'Failed to get recent 7 days sessions from extension');
      }

      const recentSessions = extensionResponse.data;
      console.log(`📖 Retrieved ${recentSessions.length} sessions from extension for recent 7 days`);

      let syncedCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];

      for (const session of recentSessions) {
        try {
          const result = await this.syncSingleSession(userId, session);
          if (result === 'synced' || result === 'updated') {
            syncedCount++;
            console.log(`✅ ${result === 'synced' ? 'Synced' : 'Updated'} session ${session.id}`);
          } else {
            skippedCount++;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`Session ${session.id}: ${errorMsg}`);
          console.error(`❌ Failed to sync session ${session.id}:`, error);
        }
      }

      console.log(`🔄 Recent 7 days sync completed: ${syncedCount}/${recentSessions.length} sessions synced, ${skippedCount} skipped (duplicates)`);
      
      return {
        success: errors.length === 0,
        synced: syncedCount,
        error: errors.length > 0 ? errors.join('; ') : undefined
      };
    } catch (error) {
      console.error('❌ Recent 7 days Deep Focus sync failed:', error);
      return {
        success: false,
        synced: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get sync status
   */
  static getStatus(): { enabled: boolean; retryDelay: number } {
    return {
      enabled: this.isEnabled,
      retryDelay: this.retryDelay
    };
  }

  /**
   * Automatically clean up duplicate sessions found during sync
   */
  private static async cleanupDuplicatesForSession(userId: string, extensionSessionId: string): Promise<number> {
    try {
      const q = query(
        collection(db, 'deepFocusSessions'),
        where('userId', '==', userId),
        where('extensionSessionId', '==', extensionSessionId)
      );
      
      const querySnapshot = await getDocs(q);
      if (querySnapshot.docs.length <= 1) {
        return 0; // No duplicates
      }
      
      console.warn(`🧹 Cleaning up ${querySnapshot.docs.length - 1} duplicate sessions for ${extensionSessionId}`);
      
      // Sort by updatedAt/createdAt, keep the most recent
      const sortedDocs = querySnapshot.docs.sort((a, b) => {
        const aUpdated = a.data().updatedAt?.toDate?.() || a.data().createdAt?.toDate?.() || new Date(0);
        const bUpdated = b.data().updatedAt?.toDate?.() || b.data().createdAt?.toDate?.() || new Date(0);
        return bUpdated.getTime() - aUpdated.getTime();
      });
      
      // Mark old duplicates as deleted (don't actually delete to preserve data)
      let removedCount = 0;
      for (let i = 1; i < sortedDocs.length; i++) {
        try {
          await updateDoc(doc(db, 'deepFocusSessions', sortedDocs[i].id), {
            status: 'deleted',
            deletedReason: 'duplicate_cleanup',
            updatedAt: serverTimestamp()
          });
          removedCount++;
        } catch (error) {
          console.error(`❌ Failed to mark duplicate as deleted:`, error);
        }
      }
      
      return removedCount;
    } catch (error) {
      console.error('❌ Failed to cleanup duplicates:', error);
      return 0;
    }
  }

  /**
   * Remove duplicate sessions from Firebase (cleanup utility)
   */
  static async removeDuplicateSessions(userId: string): Promise<{ success: boolean; removedCount: number; error?: string }> {
    try {
      console.log('🧹 Starting duplicate session cleanup for user:', userId);
      
      const q = query(
        collection(db, 'deepFocusSessions'),
        where('userId', '==', userId)
      );
      
      const querySnapshot = await getDocs(q);
      const sessions: { [key: string]: any[] } = {};
      
      // Group sessions by extensionSessionId
      querySnapshot.forEach((doc) => {
        const session = doc.data();
        const extensionId = session.extensionSessionId;
        
        if (extensionId) {
          if (!sessions[extensionId]) {
            sessions[extensionId] = [];
          }
          sessions[extensionId].push({ id: doc.id, ...session });
        }
      });
      
      let removedCount = 0;
      
      // Remove duplicates (keep the oldest one)
      for (const extensionId in sessions) {
        const sessionGroup = sessions[extensionId];
        if (sessionGroup.length > 1) {
          // Sort by createdAt, keep the first one
          sessionGroup.sort((a, b) => a.createdAt.seconds - b.createdAt.seconds);
          
          // Remove all but the first one
          for (let i = 1; i < sessionGroup.length; i++) {
            try {
              await updateDoc(doc(db, 'deepFocusSessions', sessionGroup[i].id), {
                // Mark as deleted instead of actually deleting
                status: 'deleted',
                updatedAt: serverTimestamp()
              });
              removedCount++;
              console.log(`🗑️ Marked duplicate session ${sessionGroup[i].id} as deleted`);
            } catch (error) {
              console.error(`❌ Failed to remove duplicate session ${sessionGroup[i].id}:`, error);
            }
          }
        }
      }
      
      console.log(`🧹 Cleanup completed: ${removedCount} duplicate sessions removed`);
      return { success: true, removedCount };
      
    } catch (error) {
      console.error('❌ Duplicate cleanup failed:', error);
      return { 
        success: false, 
        removedCount: 0, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * Test extension connection
   */
  static async testExtensionConnection(): Promise<boolean> {
    try {
      return await ExtensionDataService.testConnection();
    } catch (error) {
      console.error('❌ Extension connection test failed:', error);
      return false;
    }
  }

  /**
   * Calculate local date from timestamp and timezone
   */
  private static calculateLocalDate(timestamp: string | number, timezone?: string): string {
    try {
      const date = new Date(timestamp);
      const userTimezone = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      // Use existing timezone utils to convert UTC to local date
      const localTime = timezoneUtils.utcToUserTime(date.toISOString(), userTimezone);
      return timezoneUtils.formatInTimezone(localTime.toISOString(), userTimezone, 'yyyy-MM-dd');
    } catch (error) {
      console.warn('Failed to calculate local date:', error);
      // Fallback to UTC date
      return new Date(timestamp).toISOString().split('T')[0];
    }
  }
}