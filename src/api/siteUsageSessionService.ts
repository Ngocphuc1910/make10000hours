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
      const batch = writeBatch(db);
      
      sessions.forEach(session => {
        const docRef = doc(db, this.collectionName, session.id);
        const firestoreSession = {
          ...session,
          startTime: session.startTime instanceof Date 
            ? Timestamp.fromDate(session.startTime)
            : Timestamp.fromDate(new Date(session.startTime)),
          endTime: session.endTime 
            ? (session.endTime instanceof Date 
              ? Timestamp.fromDate(session.endTime)
              : Timestamp.fromDate(new Date(session.endTime)))
            : null,
          createdAt: session.createdAt instanceof Date
            ? Timestamp.fromDate(session.createdAt)
            : Timestamp.fromDate(new Date(session.createdAt)),
          updatedAt: serverTimestamp()
        };
        batch.set(docRef, firestoreSession, { merge: true });
      });
      
      await batch.commit();
      console.log(`✅ Synced ${sessions.length} sessions from extension to Firebase`);
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
        orderBy('startTime', 'desc')
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
   * Get active sessions (currently tracking)
   */
  async getActiveSessions(userId: string): Promise<SiteUsageSession[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        where('isActive', '==', true),
        orderBy('startTime', 'desc')
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
      orderBy('startTime', 'desc')
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
        orderBy('startTime', 'desc')
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
      startTime: data.startTime?.toDate ? data.startTime.toDate() : new Date(data.startTime),
      endTime: data.endTime?.toDate ? data.endTime?.toDate() : (data.endTime ? new Date(data.endTime) : null),
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt)
    };
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