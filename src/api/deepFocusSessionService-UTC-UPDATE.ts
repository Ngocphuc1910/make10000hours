/**
 * Updated Deep Focus Session Service with UTC-based filtering
 * This shows the key changes needed to implement timezone-aware filtering
 */

import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { DeepFocusSession } from '../types/models';
import { TimezoneFilteringUtils, UTC_FILTERING_ENABLED } from '../utils/timezoneFiltering';

class DeepFocusSessionServiceUTC {
  private collectionName = 'deepFocusSessions';

  /**
   * UPDATED: Get user sessions with UTC-based filtering
   * 
   * @param userId - User ID
   * @param startDate - Filter start date (in user's timezone)
   * @param endDate - Filter end date (in user's timezone)  
   * @param userTimezone - User's current timezone (optional, will auto-detect)
   */
  async getUserSessions(
    userId: string, 
    startDate?: Date, 
    endDate?: Date,
    userTimezone?: string
  ): Promise<DeepFocusSession[]> {
    
    // Feature flag check - allows safe rollback
    if (UTC_FILTERING_ENABLED && startDate && endDate) {
      console.log('🌍 Using UTC-based filtering');
      return this.getUserSessionsUTC(userId, startDate, endDate, userTimezone);
    }
    
    // Fallback to legacy filtering
    console.log('📅 Using legacy createdAt filtering');
    return this.getUserSessionsLegacy(userId, startDate, endDate);
  }

  /**
   * NEW: UTC-based filtering with timezone conversion
   */
  private async getUserSessionsUTC(
    userId: string,
    startDate: Date,
    endDate: Date, 
    userTimezone?: string
  ): Promise<DeepFocusSession[]> {
    try {
      // Get effective timezone
      const effectiveTimezone = TimezoneFilteringUtils.getUserTimezone(userTimezone);
      
      // Convert user's local date range to UTC boundaries
      const { utcStart, utcEnd } = TimezoneFilteringUtils
        .convertLocalDateRangeToUTC(startDate, endDate, effectiveTimezone);
        
      console.log('🔍 UTC filtering query:', {
        userId,
        utcRange: `${utcStart} to ${utcEnd}`,
        userTimezone: effectiveTimezone
      });

      // Primary query: Use startTimeUTC field
      try {
        const utcQuery = query(
          collection(db, this.collectionName),
          where('userId', '==', userId),
          where('startTimeUTC', '>=', utcStart),
          where('startTimeUTC', '<=', utcEnd),
          where('status', '!=', 'deleted'),
          orderBy('startTimeUTC', 'desc')
        );
        
        const utcSnapshot = await getDocs(utcQuery);
        const utcSessions = utcSnapshot.docs.map(doc => this.mapFirebaseSession(doc));
        
        console.log(`✅ Found ${utcSessions.length} sessions using UTC filtering`);
        return utcSessions;
        
      } catch (utcError) {
        console.warn('⚠️ UTC filtering failed, trying hybrid approach:', utcError);
        
        // Fallback: Hybrid query for backward compatibility
        return this.getSessionsHybridApproach(userId, utcStart, utcEnd);
      }
      
    } catch (error) {
      console.error('❌ UTC filtering completely failed, falling back to legacy:', error);
      return this.getUserSessionsLegacy(userId, startDate, endDate);
    }
  }

  /**
   * NEW: Hybrid approach for backward compatibility
   * Handles sessions that might not have startTimeUTC field
   */
  private async getSessionsHybridApproach(
    userId: string, 
    utcStart: string, 
    utcEnd: string
  ): Promise<DeepFocusSession[]> {
    
    try {
      // Get all sessions in a wider range and filter client-side
      const startTimestamp = Timestamp.fromDate(new Date(utcStart));
      const endTimestamp = Timestamp.fromDate(new Date(utcEnd));
      
      const hybridQuery = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        where('createdAt', '>=', startTimestamp),
        where('createdAt', '<=', endTimestamp),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(hybridQuery);
      const allSessions = snapshot.docs.map(doc => this.mapFirebaseSession(doc));
      
      // Client-side filtering using available timestamp fields
      const filteredSessions = allSessions.filter(session => {
        const effectiveStartTime = this.getEffectiveStartTimeUTC(session);
        return effectiveStartTime >= utcStart && effectiveStartTime <= utcEnd;
      });
      
      console.log(`🔀 Hybrid filtering: ${allSessions.length} → ${filteredSessions.length} sessions`);
      return filteredSessions;
      
    } catch (error) {
      console.error('❌ Hybrid approach failed:', error);
      throw error;
    }
  }

  /**
   * LEGACY: Original createdAt-based filtering (kept for fallback)
   */
  private async getUserSessionsLegacy(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<DeepFocusSession[]> {
    
    try {
      let q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        where('status', '!=', 'deleted'),
        orderBy('createdAt', 'desc')
      );

      // Add date filtering if provided
      if (startDate && endDate) {
        const startTimestamp = Timestamp.fromDate(startDate);
        const endTimestamp = Timestamp.fromDate(endDate);
        
        q = query(
          collection(db, this.collectionName),
          where('userId', '==', userId),
          where('createdAt', '>=', startTimestamp),
          where('createdAt', '<=', endTimestamp),
          orderBy('createdAt', 'desc')
        );
      }

      const snapshot = await getDocs(q);
      const sessions = snapshot.docs.map(doc => this.mapFirebaseSession(doc));
      
      console.log(`📅 Legacy filtering: Found ${sessions.length} sessions`);
      return sessions.filter(session => session.status !== 'deleted');
      
    } catch (error) {
      console.error('❌ Legacy filtering failed:', error);
      return [];
    }
  }

  /**
   * HELPER: Get effective start time UTC for backward compatibility
   */
  private getEffectiveStartTimeUTC(session: DeepFocusSession): string {
    // Priority: startTimeUTC > startTime > createdAt
    if (session.startTimeUTC) {
      return session.startTimeUTC;
    }
    
    if (session.startTime) {
      return session.startTime instanceof Date 
        ? session.startTime.toISOString() 
        : new Date(session.startTime).toISOString();
    }
    
    if (session.createdAt) {
      return session.createdAt instanceof Date 
        ? session.createdAt.toISOString() 
        : new Date(session.createdAt).toISOString();
    }
    
    // Fallback to current time (shouldn't happen)
    return new Date().toISOString();
  }

  /**
   * HELPER: Map Firestore document to DeepFocusSession
   */
  private mapFirebaseSession(doc: any): DeepFocusSession {
    const data = doc.data();
    
    return {
      id: doc.id,
      userId: data.userId,
      startTime: data.startTime?.toDate() || new Date(),
      endTime: data.endTime?.toDate() || null,
      duration: data.duration || 0,
      status: data.status || 'completed',
      source: data.source || 'extension',
      
      // ✅ NEW UTC fields
      startTimeUTC: data.startTimeUTC || null,
      endTimeUTC: data.endTimeUTC || null,
      utcDate: data.utcDate || null,
      
      extensionSessionId: data.extensionSessionId,
      timezone: data.timezone || 'UTC',
      localDate: data.localDate || '',
      
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as DeepFocusSession;
  }

  /**
   * NEW: Analyze session data readiness for UTC filtering
   */
  async analyzeUTCReadiness(userId: string): Promise<{
    totalSessions: number;
    sessionsWithUTC: number;
    percentage: number;
    recommendation: 'ready' | 'partial' | 'not_ready';
  }> {
    try {
      const recentQuery = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      
      const snapshot = await getDocs(recentQuery);
      const sessions = snapshot.docs.map(doc => doc.data());
      
      const totalSessions = sessions.length;
      const sessionsWithUTC = sessions.filter(s => s.startTimeUTC && s.utcDate).length;
      const percentage = totalSessions > 0 ? (sessionsWithUTC / totalSessions) * 100 : 0;
      
      let recommendation: 'ready' | 'partial' | 'not_ready' = 'not_ready';
      if (percentage >= 90) recommendation = 'ready';
      else if (percentage >= 50) recommendation = 'partial';
      
      console.log('📊 UTC readiness analysis:', {
        totalSessions,
        sessionsWithUTC,
        percentage: `${percentage.toFixed(1)}%`,
        recommendation
      });
      
      return {
        totalSessions,
        sessionsWithUTC,
        percentage,
        recommendation
      };
      
    } catch (error) {
      console.error('❌ UTC readiness analysis failed:', error);
      return {
        totalSessions: 0,
        sessionsWithUTC: 0,
        percentage: 0,
        recommendation: 'not_ready'
      };
    }
  }

  // ... other existing methods remain unchanged
}

export const deepFocusSessionServiceUTC = new DeepFocusSessionServiceUTC();

// Export for testing
export { DeepFocusSessionServiceUTC };