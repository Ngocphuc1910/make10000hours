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
  
  /**
   * Handle batch save from extension sync
   * Extension sends sessions → This saves to Firebase
   */
  async batchSaveSessions(sessions: SiteUsageSession[]): Promise<void> {
    try {
      console.log(`💾 Saving ${sessions.length} sessions to Firebase collection: ${this.collectionName}`);
      console.log('📋 Session data sample:', sessions.slice(0, 2));
      
      const batch = writeBatch(db);
      
      sessions.forEach(session => {
        const docRef = doc(collection(db, this.collectionName));
        const firestoreSession = {
          ...session,
          // Keep string timestamps as-is for the new schema
          createdAt: typeof session.createdAt === 'string' 
            ? session.createdAt 
            : new Date().toISOString()
        };
        batch.set(docRef, firestoreSession);
        console.log(`📄 Adding session to batch: ${session.domain} (${session.duration}s)`);
      });
      
      await batch.commit();
      console.log(`✅ Successfully synced ${sessions.length} sessions to Firebase collection: ${this.collectionName}`);
    } catch (error) {
      console.error('❌ Failed to sync sessions to Firebase:', error);
      throw error;
    }
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
   * Convert Firestore document to SiteUsageSession
   */
  private convertFirestoreToSession(data: any): SiteUsageSession {
    return {
      ...data,
      // Keep timestamps as strings in new schema
      startTimeUTC: data.startTimeUTC,
      endTimeUTC: data.endTimeUTC || undefined,
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