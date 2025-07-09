import { 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  query, 
  where, 
  orderBy,
  limit,
  writeBatch,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';

export interface SiteUsageEntry {
  domain: string;
  timeSpent: number; // milliseconds
  visits: number;
  category?: string;
  lastVisit: Date;
}

export interface DailySiteUsage {
  id?: string;
  userId: string;
  date: string; // YYYY-MM-DD format
  totalTime: number; // milliseconds
  sitesVisited: number;
  productivityScore: number;
  sites: Record<string, SiteUsageEntry>;
  syncedAt: Date;
  extensionVersion?: string;
  createdAt: Date;
  updatedAt: Date;
}

class SiteUsageService {
  private readonly collectionName = 'dailySiteUsage';

  /**
   * Backup daily site usage data to Firebase
   */
  async backupDayData(userId: string, date: string, extensionData: any): Promise<void> {
    try {
      const docId = `${userId}_${date}`;
      const docRef = doc(db, this.collectionName, docId);
      
      // Check if data already exists
      const existingDoc = await getDoc(docRef);
      const now = new Date();
      
      const dailyUsage: DailySiteUsage = {
        userId,
        date,
        totalTime: extensionData.totalTime || 0,
        sitesVisited: extensionData.sitesVisited || 0,
        productivityScore: extensionData.productivityScore || 0,
        sites: this.processSiteData(extensionData.sites || {}),
        syncedAt: now,
        extensionVersion: extensionData.version || '1.0.0',
        createdAt: existingDoc.exists() ? existingDoc.data()?.createdAt || now : now,
        updatedAt: now
      };

      await setDoc(docRef, dailyUsage, { merge: true });
      console.log(`✅ Backed up site usage data for ${date}`);
    } catch (error) {
      console.error(`❌ Failed to backup site usage for ${date}:`, error);
      throw error;
    }
  }

  /**
   * Batch backup multiple days of data
   */
  async batchBackupData(userId: string, extensionDataMap: Record<string, any>): Promise<void> {
    try {
      const batch = writeBatch(db);
      const now = new Date();
      
      Object.entries(extensionDataMap).forEach(([date, data]) => {
        const docId = `${userId}_${date}`;
        const docRef = doc(db, this.collectionName, docId);
        
        const dailyUsage: DailySiteUsage = {
          userId,
          date,
          totalTime: data.totalTime || 0,
          sitesVisited: data.sitesVisited || 0,
          productivityScore: data.productivityScore || 0,
          sites: this.processSiteData(data.sites || {}),
          syncedAt: now,
          extensionVersion: data.version || '1.0.0',
          createdAt: now,
          updatedAt: now
        };
        
        batch.set(docRef, dailyUsage, { merge: true });
      });
      
      await batch.commit();
      console.log(`✅ Batch backed up ${Object.keys(extensionDataMap).length} days of data`);
    } catch (error) {
      console.error('❌ Failed to batch backup data:', error);
      throw error;
    }
  }

  /**
   * Retrieve user's site usage data for date range
   */
  async getUserData(userId: string, startDate: string, endDate: string): Promise<DailySiteUsage[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'desc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Convert Firestore Timestamps to Dates
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        syncedAt: doc.data().syncedAt?.toDate() || new Date()
      })) as DailySiteUsage[];
    } catch (error) {
      console.error('❌ Failed to retrieve user site usage data:', error);
      throw error;
    }
  }

  /**
   * Get latest sync status for user
   */
  async getLastSyncInfo(userId: string): Promise<{ lastSyncDate: string | null; totalDays: number }> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        orderBy('date', 'desc'),
        limit(1)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return { lastSyncDate: null, totalDays: 0 };
      }
      
      const latestDoc = snapshot.docs[0];
      const totalQuery = query(
        collection(db, this.collectionName),
        where('userId', '==', userId)
      );
      const totalSnapshot = await getDocs(totalQuery);
      
      return {
        lastSyncDate: latestDoc.data().date,
        totalDays: totalSnapshot.size
      };
    } catch (error) {
      console.error('❌ Failed to get sync info:', error);
      return { lastSyncDate: null, totalDays: 0 };
    }
  }

  /**
   * Restore data to extension (for data recovery)
   */
  async restoreToExtension(userId: string, targetDate: string): Promise<any> {
    try {
      const docId = `${userId}_${targetDate}`;
      const docRef = doc(db, this.collectionName, docId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        throw new Error(`No data found for ${targetDate}`);
      }
      
      const data = docSnap.data() as DailySiteUsage;
      
      // Convert back to extension format
      return {
        totalTime: data.totalTime,
        sitesVisited: data.sitesVisited,
        productivityScore: data.productivityScore,
        sites: Object.fromEntries(
          Object.entries(data.sites).map(([domain, site]) => [
            domain,
            {
              timeSpent: site.timeSpent,
              visits: site.visits,
              category: site.category,
              lastVisit: site.lastVisit
            }
          ])
        )
      };
    } catch (error) {
      console.error(`❌ Failed to restore data for ${targetDate}:`, error);
      throw error;
    }
  }

  /**
   * Clean up old data (keep last N days)
   */
  async cleanupOldData(userId: string, keepDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - keepDays);
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
      
      const q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        where('date', '<', cutoffDateStr)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return 0;
      }
      
      const batch = writeBatch(db);
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log(`🧹 Cleaned up ${snapshot.size} old site usage records`);
      return snapshot.size;
    } catch (error) {
      console.error('❌ Failed to cleanup old data:', error);
      throw error;
    }
  }

  /**
   * Process and validate site data
   */
  private processSiteData(sites: Record<string, any>): Record<string, SiteUsageEntry> {
    const processed: Record<string, SiteUsageEntry> = {};
    
    Object.entries(sites).forEach(([domain, data]) => {
      if (domain && data && typeof data.timeSpent === 'number') {
        processed[domain] = {
          domain,
          timeSpent: Math.max(0, data.timeSpent), // Ensure non-negative
          visits: Math.max(0, data.visits || 0),
          category: data.category || 'uncategorized',
          lastVisit: data.lastVisit ? new Date(data.lastVisit) : new Date()
        };
      }
    });
    
    return processed;
  }

  /**
   * Get backup data for multiple dates
   */
  async getBatchBackupData(userId: string, dates: string[]): Promise<Record<string, DailySiteUsage>> {
    try {
      const result: Record<string, DailySiteUsage> = {};
      
      // Fetch each date individually (Firestore doesn't support efficient batch gets with different field values)
      const promises = dates.map(async (date) => {
        const data = await this.getBackupData(userId, date);
        if (data) {
          result[date] = data;
        }
      });

      await Promise.all(promises);
      return result;
    } catch (error) {
      console.error('❌ Error getting batch backup data:', error);
      throw error;
    }
  }

  /**
   * Get backup data for a specific date
   */
  async getBackupData(userId: string, date: string): Promise<DailySiteUsage | null> {
    try {
      const docId = `${userId}_${date}`;
      const docRef = doc(db, this.collectionName, docId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data() as Omit<DailySiteUsage, 'id'>;
      
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt),
        syncedAt: data.syncedAt instanceof Timestamp ? data.syncedAt.toDate() : new Date(data.syncedAt)
      };
    } catch (error) {
      console.error('❌ Error getting backup data:', error);
      throw error;
    }
  }

  /**
   * Get aggregated statistics for a user
   */
  async getAggregatedStats(userId: string, days: number = 30): Promise<{
    totalTime: number;
    avgDailyTime: number;
    topSites: Array<{ domain: string; totalTime: number; avgDaily: number }>;
    productivityTrend: number;
  }> {
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split('T')[0];
      
      const data = await this.getUserData(userId, startDateStr, endDate);
      
      if (data.length === 0) {
        return {
          totalTime: 0,
          avgDailyTime: 0,
          topSites: [],
          productivityTrend: 0
        };
      }
      
      const totalTime = data.reduce((sum, day) => sum + day.totalTime, 0);
      const avgDailyTime = totalTime / data.length;
      
      // Aggregate site data
      const siteAggregates: Record<string, { totalTime: number; count: number }> = {};
      
      data.forEach(day => {
        Object.values(day.sites).forEach(site => {
          if (!siteAggregates[site.domain]) {
            siteAggregates[site.domain] = { totalTime: 0, count: 0 };
          }
          siteAggregates[site.domain].totalTime += site.timeSpent;
          siteAggregates[site.domain].count++;
        });
      });
      
      const topSites = Object.entries(siteAggregates)
        .map(([domain, stats]) => ({
          domain,
          totalTime: stats.totalTime,
          avgDaily: stats.totalTime / stats.count
        }))
        .sort((a, b) => b.totalTime - a.totalTime)
        .slice(0, 10);
      
      // Calculate productivity trend (compare first half vs second half)
      const halfPoint = Math.floor(data.length / 2);
      const firstHalf = data.slice(0, halfPoint);
      const secondHalf = data.slice(halfPoint);
      
      const firstHalfAvg = firstHalf.length > 0 
        ? firstHalf.reduce((sum, day) => sum + day.productivityScore, 0) / firstHalf.length 
        : 0;
      const secondHalfAvg = secondHalf.length > 0 
        ? secondHalf.reduce((sum, day) => sum + day.productivityScore, 0) / secondHalf.length 
        : 0;
      
      const productivityTrend = firstHalfAvg > 0 
        ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 
        : 0;
      
      return {
        totalTime,
        avgDailyTime,
        topSites,
        productivityTrend
      };
    } catch (error) {
      console.error('❌ Failed to get aggregated stats:', error);
      throw error;
    }
  }

  async getDailyUsage(userId: string, startDate: Date, endDate: Date): Promise<DailySiteUsage[]> {
    try {
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      const q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        where('date', '>=', startDateStr),
        where('date', '<=', endDateStr),
        orderBy('date', 'desc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        syncedAt: doc.data().syncedAt?.toDate() || new Date()
      })) as DailySiteUsage[];
    } catch (error) {
      console.error('❌ Failed to get daily usage:', error);
      throw error;
    }
  }

  async getAllTimeDailyUsage(userId: string): Promise<DailySiteUsage[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        orderBy('date', 'desc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        syncedAt: doc.data().syncedAt?.toDate() || new Date()
      })) as DailySiteUsage[];
    } catch (error) {
      console.error('❌ Failed to get all time daily usage:', error);
      throw error;
    }
  }
}

export const siteUsageService = new SiteUsageService(); 