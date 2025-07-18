import { collection, addDoc, updateDoc, doc, serverTimestamp, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../api/firebase';
import { DeepFocusSession } from '../types/models';
import ExtensionDataService from './extensionDataService';

export class DeepFocusSync {
  private static isEnabled = true;
  private static retryDelay = 1000; // Start with 1 second
  private static maxRetryDelay = 60000; // Max 1 minute
  private static maxRetries = 3;

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
   * Get existing session from Firebase if it exists
   */
  private static async getExistingSession(userId: string, extensionSessionId: string): Promise<{ exists: boolean; docId?: string; data?: any }> {
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
      
      const doc = querySnapshot.docs[0];
      return { 
        exists: true, 
        docId: doc.id, 
        data: doc.data() 
      };
    } catch (error) {
      console.error('❌ Error checking session existence:', error);
      return { exists: false }; // If check fails, assume session doesn't exist to avoid blocking sync
    }
  }

  /**
   * Sync a single session from extension to Firebase
   */
  private static async syncSingleSession(userId: string, extensionSession: any): Promise<'synced' | 'updated' | 'skipped'> {
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
        startTime: new Date(extensionSession.startTime), // Convert from ISO string or timestamp
        endTime: extensionSession.endTime ? new Date(extensionSession.endTime) : null,
        duration: extensionSession.duration || 0,
        status: extensionSession.status || 'completed',
        source: 'extension' as const,
        
        // Track extension session ID to prevent duplicates
        extensionSessionId: extensionSession.id,
        
        // Add timezone support fields
        timezone: extensionSession.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        localDate: extensionSession.localDate || new Date(extensionSession.startTime).toISOString().split('T')[0],
        
        createdAt: extensionSession.createdAt ? new Date(extensionSession.createdAt) : new Date(extensionSession.startTime),
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
   * Get sync status
   */
  static getStatus(): { enabled: boolean; retryDelay: number } {
    return {
      enabled: this.isEnabled,
      retryDelay: this.retryDelay
    };
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
}