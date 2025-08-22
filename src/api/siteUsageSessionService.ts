/**
 * Site Usage Session Service - Firebase integration for session-based tracking
 * This service is for the WEB APP to:
 * 1. READ sessions from Firebase (that were synced from extension)
 * 2. Handle batch saves when extension syncs data
 * 3. Subscribe to real-time updates
 */

import { 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  updateDoc,
  query, 
  where, 
  orderBy,
  limit,
  writeBatch,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db } from './firebase';
import { SiteUsageSession } from '../utils/SessionManager';

export interface SessionQueryOptions {
  userId: string;
  startDate?: Date;
  endDate?: Date;
  domain?: string;
  status?: 'active' | 'completed' | 'suspended';
  limit?: number;
  orderBy?: 'startTime' | 'duration' | 'domain';
  orderDirection?: 'asc' | 'desc';
}

class SiteUsageSessionService {
  private readonly collectionName = 'siteUsageSessions';
  private activeSessionListeners: Map<string, Unsubscribe> = new Map();
  private userSyncMutex: Map<string, Promise<void>> = new Map();
  
  /**
   * Handle batch save from extension sync with efficient bulk operations
   * Optimized for large datasets with proper rate limiting and batch management
   * Protected against concurrent saves for the same user to prevent race conditions
   */
  async batchSaveSessions(sessions: SiteUsageSession[]): Promise<void> {
    if (!sessions || sessions.length === 0) {
      console.log('📭 No sessions to sync');
      return;
    }

    // Get the userId for this batch (all sessions should have the same userId)
    const userId = sessions[0]?.userId;
    if (!userId) {
      console.error('❌ No userId found in session batch');
      return;
    }

    // Check if there's already a sync operation in progress for this user
    const existingSync = this.userSyncMutex.get(userId);
    if (existingSync) {
      console.log(`⏳ [RACE-PROTECTION] Batch save already in progress for user ${userId}, waiting for completion...`);
      await existingSync;
      console.log(`✅ [RACE-PROTECTION] Previous batch save completed for user ${userId}, skipping duplicate`);
      return;
    }

    // Create mutex promise for this user
    const syncPromise = this.performBatchSave(sessions);
    this.userSyncMutex.set(userId, syncPromise);

    try {
      await syncPromise;
    } finally {
      // Clean up mutex when done
      this.userSyncMutex.delete(userId);
    }
  }

  /**
   * Internal method to perform the actual batch save operation
   */
  private async performBatchSave(sessions: SiteUsageSession[]): Promise<void> {
    try {
      console.log(`🔄 [RACE-PROTECTION] Starting protected bulk sync for ${sessions.length} sessions`);
      
      // CRITICAL FIX: Sanitize sessions BEFORE validation to prevent data loss
      const sanitizedSessions = sessions.map(session => this.sanitizeSessionData(session));
      
      // Validate sessions and filter out invalid ones (after sanitization)
      const validSessions = sanitizedSessions.filter(session => {
        if (!session.extensionSessionId || !session.userId) {
          console.warn('⚠️ Session missing required fields after sanitization, skipping:', {
            extensionSessionId: session.extensionSessionId,
            userId: session.userId,
            domain: session.domain
          });
          return false;
        }
        return true;
      });

      if (validSessions.length === 0) {
        console.log('❌ No valid sessions to process after validation');
        return;
      }

      console.log(`✅ ${validSessions.length} valid sessions after filtering`);

      // Step 1: Bulk fetch existing sessions to avoid O(n) queries  
      const existingSessionsMap = await this.bulkFetchExistingSessions(
        validSessions[0].userId, 
        validSessions.map(s => s.extensionSessionId)
      );

      console.log(`📊 Found ${existingSessionsMap.size} existing sessions in Firebase`);

      // Step 2: Process sessions in batches (Firebase limit: 500 operations per batch)
      const BATCH_SIZE = 400; // Leave some buffer for safety
      let totalCreated = 0;
      let totalUpdated = 0; 
      let totalSkipped = 0;

      for (let i = 0; i < validSessions.length; i += BATCH_SIZE) {
        const batchSessions = validSessions.slice(i, i + BATCH_SIZE);
        console.log(`🔄 Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(validSessions.length/BATCH_SIZE)} (${batchSessions.length} sessions)`);
        
        const batchResult = await this.processBatch(batchSessions, existingSessionsMap);
        totalCreated += batchResult.created;
        totalUpdated += batchResult.updated;
        totalSkipped += batchResult.skipped;

        // Add small delay between batches to avoid rate limits
        if (i + BATCH_SIZE < validSessions.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`✅ Bulk sync completed successfully!`);
      console.log(`📊 Final stats: ${totalCreated} created, ${totalUpdated} updated, ${totalSkipped} skipped`);
      console.log(`🎯 Total processed: ${totalCreated + totalUpdated + totalSkipped}/${sessions.length} sessions`);

    } catch (error) {
      console.error('❌ Bulk sync failed:', error);
      throw error;
    }
  }

  /**
   * Bulk fetch existing sessions to avoid O(n) individual queries
   */
  private async bulkFetchExistingSessions(
    userId: string, 
    extensionSessionIds: string[]
  ): Promise<Map<string, any>> {
    const existingMap = new Map<string, any>();
    
    // Firebase 'in' queries are limited to 10 items, so we need to batch them
    const QUERY_BATCH_SIZE = 10;
    
    for (let i = 0; i < extensionSessionIds.length; i += QUERY_BATCH_SIZE) {
      const idBatch = extensionSessionIds.slice(i, i + QUERY_BATCH_SIZE);
      
      try {
        const q = query(
          collection(db, this.collectionName),
          where('userId', '==', userId),
          where('extensionSessionId', 'in', idBatch)
        );
        
        const snapshot = await getDocs(q);
        
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          existingMap.set(data.extensionSessionId, {
            ...data,
            docId: doc.id
          });
        });

      } catch (error) {
        console.error('❌ Error in bulk fetch batch:', error);
        // Continue with other batches even if one fails
      }
      
      // Small delay between query batches to avoid rate limits
      if (i + QUERY_BATCH_SIZE < extensionSessionIds.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    return existingMap;
  }

  /**
   * Process a batch of sessions with efficient write operations
   */
  private async processBatch(
    sessions: SiteUsageSession[],
    existingSessionsMap: Map<string, any>
  ): Promise<{ created: number; updated: number; skipped: number }> {
    const batch = writeBatch(db);
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const session of sessions) {
      // Session is already sanitized at this point
      const existingSession = existingSessionsMap.get(session.extensionSessionId);
      
      if (existingSession) {
        // Check if update is needed
        const hasChanges = (
          existingSession.duration !== session.duration ||
          existingSession.status !== session.status ||
          existingSession.startTimeUTC !== session.startTimeUTC
        );
        
        if (hasChanges) {
          // UPDATE existing session
          batch.update(doc(db, this.collectionName, existingSession.docId), {
            ...session,
            id: existingSession.docId,
            syncTime: existingSession.syncTime, // Preserve original sync time
            lastUpdated: new Date().toISOString()
          });
          updated++;
        } else {
          skipped++;
        }
      } else {
        // CREATE new session
        const docRef = doc(collection(db, this.collectionName));
        const newSession = {
          ...session,
          id: docRef.id,
          syncTime: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        };
        
        batch.set(docRef, newSession);
        created++;
      }
    }

    // Execute the batch
    if (created + updated > 0) {
      await batch.commit();
      console.log(`✅ Batch committed: ${created} created, ${updated} updated, ${skipped} skipped`);
    } else {
      console.log(`⏭️ Batch skipped: all ${skipped} sessions unchanged`);
    }

    return { created, updated, skipped };
  }

  
  /**
   * Get sessions for a specific date range (for web app display)
   */
  async getSessionsForDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<SiteUsageSession[]> {
    try {
      // Convert to UTC date strings for querying
      const startUtc = startDate.toISOString().split('T')[0];
      const endUtc = endDate.toISOString().split('T')[0];
      
      const q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        where('utcDate', '>=', startUtc),
        where('utcDate', '<=', endUtc),
        orderBy('utcDate', 'desc'),
        orderBy('startTimeUTC', 'desc')
      );
      
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => this.convertFirestoreToSession(doc.data()));
    } catch (error) {
      console.error('❌ Failed to get sessions for date range:', error);
      throw error;
    }
  }
  
  /**
   * Get today's sessions for dashboard
   */
  async getTodaySessions(userId: string): Promise<SiteUsageSession[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return this.getSessionsForDateRange(userId, today, tomorrow);
  }

  /**
   * Get sessions for today only (specific method for dashboard)
   */
  async getSessionsForToday(userId: string): Promise<SiteUsageSession[]> {
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        where('utcDate', '==', today),
        where('status', '==', 'completed'),
        orderBy('startTimeUTC', 'desc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as SiteUsageSession));
    } catch (error) {
      console.error('❌ Failed to get today\'s sessions:', error);
      return [];
    }
  }
  
  /**
   * Get active sessions (currently tracking)
   */
  async getActiveSessions(userId: string): Promise<SiteUsageSession[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        where('status', '==', 'active'),
        orderBy('startTimeUTC', 'desc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => this.convertFirestoreToSession(doc.data()));
    } catch (error) {
      console.error('❌ Failed to get active sessions:', error);
      return []; // Return empty array on error
    }
  }
  
  /**
   * Subscribe to real-time session updates
   */
  subscribeToSessions(
    userId: string,
    callback: (sessions: SiteUsageSession[]) => void
  ): Unsubscribe {
    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayUtc = today.toISOString().split('T')[0];
    
    const q = query(
      collection(db, this.collectionName),
      where('userId', '==', userId),
      where('utcDate', '==', todayUtc),
      orderBy('startTimeUTC', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessions = snapshot.docs.map(doc => this.convertFirestoreToSession(doc.data()));
      callback(sessions);
    }, (error) => {
      console.error('❌ Error in sessions subscription:', error);
    });
    
    return unsubscribe;
  }
  
  /**
   * Get sessions by domain
   */
  async getSessionsByDomain(
    userId: string,
    domain: string,
    days: number = 7
  ): Promise<SiteUsageSession[]> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const startUtc = startDate.toISOString().split('T')[0];
      const endUtc = endDate.toISOString().split('T')[0];
      
      const q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        where('domain', '==', domain),
        where('utcDate', '>=', startUtc),
        where('utcDate', '<=', endUtc),
        orderBy('utcDate', 'desc'),
        orderBy('startTimeUTC', 'desc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => this.convertFirestoreToSession(doc.data()));
    } catch (error) {
      console.error(`❌ Failed to get sessions for domain ${domain}:`, error);
      return [];
    }
  }
  
  /**
   * Get aggregated statistics for dashboard
   */
  async getSessionStats(
    userId: string,
    days: number = 7
  ): Promise<{
    totalTime: number;
    totalSessions: number;
    uniqueDomains: number;
    avgSessionDuration: number;
    topDomains: Array<{ domain: string; totalTime: number; count: number }>;
  }> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const sessions = await this.getSessionsForDateRange(userId, startDate, endDate);
      
      const stats = {
        totalTime: 0,
        totalSessions: sessions.length,
        uniqueDomains: new Set<string>(),
        domainMap: new Map<string, { totalTime: number; count: number }>()
      };
      
      sessions.forEach(session => {
        if (session.status === 'completed') {
          stats.totalTime += session.duration;
          stats.uniqueDomains.add(session.domain);
          
          const domainStats = stats.domainMap.get(session.domain) || { totalTime: 0, count: 0 };
          domainStats.totalTime += session.duration;
          domainStats.count += 1;
          stats.domainMap.set(session.domain, domainStats);
        }
      });
      
      const topDomains = Array.from(stats.domainMap.entries())
        .map(([domain, data]) => ({ domain, ...data }))
        .sort((a, b) => b.totalTime - a.totalTime)
        .slice(0, 10);
      
      return {
        totalTime: stats.totalTime,
        totalSessions: stats.totalSessions,
        uniqueDomains: stats.uniqueDomains.size,
        avgSessionDuration: stats.totalSessions > 0 ? Math.round(stats.totalTime / stats.totalSessions) : 0,
        topDomains
      };
    } catch (error) {
      console.error('❌ Failed to get session stats:', error);
      return {
        totalTime: 0,
        totalSessions: 0,
        uniqueDomains: 0,
        avgSessionDuration: 0,
        topDomains: []
      };
    }
  }
  
  /**
   * Sanitize session data for Firebase compatibility
   * Removes undefined fields and ensures required field mappings
   */
  private sanitizeSessionData(session: any): any {
    // Create a copy to avoid modifying original
    const sanitized = { ...session };
    
    // Remove ALL undefined fields to prevent Firebase write errors
    Object.keys(sanitized).forEach(key => {
      if (sanitized[key] === undefined) {
        delete sanitized[key];
      }
    });
    
    // Ensure extensionSessionId exists (required by Firebase service)
    if (!sanitized.extensionSessionId && sanitized.id) {
      sanitized.extensionSessionId = sanitized.id;
    }
    
    return sanitized;
  }

  /**
   * Convert Firestore document to SiteUsageSession
   */
  private convertFirestoreToSession(data: any): SiteUsageSession {
    return {
      ...data,
      // Keep timestamps as strings in new schema
      startTimeUTC: data.startTimeUTC,
      createdAt: data.createdAt
    } as SiteUsageSession;
  }
  
  /**
   * Check if migration is needed from old format
   */
  async checkMigrationNeeded(userId: string): Promise<boolean> {
    try {
      // Check if we have any sessions in the new format
      const q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        limit(1)
      );
      
      const snapshot = await getDocs(q);
      
      // If no sessions exist, migration might be needed
      return snapshot.empty;
    } catch (error) {
      console.error('❌ Failed to check migration status:', error);
      return false;
    }
  }
  
  /**
   * Cleanup listeners on unmount
   */
  cleanup(): void {
    this.activeSessionListeners.forEach(unsubscribe => unsubscribe());
    this.activeSessionListeners.clear();
  }
}

export const siteUsageSessionService = new SiteUsageSessionService();