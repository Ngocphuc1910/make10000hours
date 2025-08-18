/**
 * Temporary Migration Utility
 * Convert existing dailySiteUsage data to session-based format
 * and store in new siteUsageSessions collection
 */

import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../api/firebase';
import { siteUsageSessionService } from '../api/siteUsageSessionService';
import { SiteUsageSession } from '../utils/SessionManager';

declare global {
  interface Window {
    migrateToSessionData: (userId: string) => Promise<void>;
    createTestSessionData: (userId: string) => Promise<void>;
    populateNewCollection: () => Promise<void>;
  }
}

// Convert old dailySiteUsage to session format
const convertDailySiteUsageToSessions = (dailyData: any): SiteUsageSession[] => {
  const sessions: SiteUsageSession[] = [];
  
  if (dailyData.sites) {
    Object.entries(dailyData.sites).forEach(([domain, siteData]: [string, any]) => {
      // Create multiple sessions from the aggregated data
      const sessionCount = Math.max(1, siteData.visits || 1);
      const avgSessionDuration = Math.floor((siteData.timeSpent || 0) / sessionCount / 1000); // Convert ms to seconds
      
      for (let i = 0; i < sessionCount; i++) {
        const sessionStartTime = new Date(siteData.lastVisit || dailyData.date + 'T10:00:00.000Z');
        sessionStartTime.setMinutes(sessionStartTime.getMinutes() + (i * 30)); // Space sessions 30min apart
        
        const sessionEndTime = new Date(sessionStartTime);
        sessionEndTime.setSeconds(sessionEndTime.getSeconds() + avgSessionDuration);
        
        const session: SiteUsageSession = {
          id: `migrated_${dailyData.date}_${domain}_${i}`,
          userId: dailyData.userId,
          domain: domain,
          startTimeUTC: sessionStartTime.toISOString(),
          endTimeUTC: sessionEndTime.toISOString(),
          duration: avgSessionDuration, // in seconds
          utcDate: dailyData.date,
          status: 'completed' as const,
          createdAt: new Date().toISOString(),
          title: siteData.title || domain,
          favicon: siteData.favicon || '',
          category: siteData.category || 'uncategorized'
        };
        
        sessions.push(session);
      }
    });
  }
  
  return sessions;
};

// Create realistic test session data for today
window.createTestSessionData = async (userId: string) => {
  console.log('📊 Creating test session data...');
  
  const today = new Date().toISOString().split('T')[0];
  const testSessions: SiteUsageSession[] = [];
  
  // Create realistic sessions for common sites
  const testSites = [
    { domain: 'github.com', duration: 1800, title: 'GitHub' }, // 30 minutes
    { domain: 'stackoverflow.com', duration: 900, title: 'Stack Overflow' }, // 15 minutes
    { domain: 'google.com', duration: 300, title: 'Google Search' }, // 5 minutes
    { domain: 'youtube.com', duration: 2400, title: 'YouTube' }, // 40 minutes
    { domain: 'docs.google.com', duration: 1200, title: 'Google Docs' }, // 20 minutes
  ];
  
  testSites.forEach((site, index) => {
    const startTime = new Date();
    startTime.setHours(9 + index, 0, 0, 0); // Start at 9am, 10am, etc.
    
    const endTime = new Date(startTime);
    endTime.setSeconds(endTime.getSeconds() + site.duration);
    
    const session: SiteUsageSession = {
      id: `test_${today}_${site.domain}_${index}`,
      userId: userId,
      domain: site.domain,
      startTimeUTC: startTime.toISOString(),
      endTimeUTC: endTime.toISOString(),
      duration: site.duration,
      utcDate: today,
      status: 'completed' as const,
      createdAt: new Date().toISOString(),
      title: site.title,
      favicon: `https://${site.domain}/favicon.ico`,
      category: 'productivity'
    };
    
    testSessions.push(session);
  });
  
  console.log(`📊 Created ${testSessions.length} test sessions`);
  
  // Save to Firebase
  await siteUsageSessionService.batchSaveSessions(testSessions);
  console.log('✅ Test session data saved to Firebase');
  
  return testSessions;
};

// Migrate existing data from dailySiteUsage to siteUsageSessions
window.migrateToSessionData = async (userId: string) => {
  console.log('🔄 Starting migration from dailySiteUsage to siteUsageSessions...');
  
  try {
    // Get recent dailySiteUsage data
    const dailyUsageQuery = query(
      collection(db, 'dailySiteUsage'),
      where('userId', '==', userId),
      orderBy('date', 'desc'),
      limit(7) // Last 7 days
    );
    
    const snapshot = await getDocs(dailyUsageQuery);
    console.log(`📊 Found ${snapshot.docs.length} daily usage records`);
    
    const allSessions: SiteUsageSession[] = [];
    
    snapshot.docs.forEach(doc => {
      const dailyData = { id: doc.id, ...doc.data() };
      console.log(`📅 Processing ${dailyData.date}:`, Object.keys(dailyData.sites || {}).length, 'sites');
      
      const sessions = convertDailySiteUsageToSessions(dailyData);
      allSessions.push(...sessions);
    });
    
    console.log(`📊 Generated ${allSessions.length} sessions from daily usage data`);
    
    if (allSessions.length > 0) {
      // Save to new collection in batches
      const batchSize = 20;
      for (let i = 0; i < allSessions.length; i += batchSize) {
        const batch = allSessions.slice(i, i + batchSize);
        await siteUsageSessionService.batchSaveSessions(batch);
        console.log(`✅ Saved batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(allSessions.length/batchSize)}`);
      }
    }
    
    console.log('✅ Migration completed successfully');
    return allSessions;
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

// Main function to populate new collection
window.populateNewCollection = async () => {
  console.log('🚀 ============================');
  console.log('🚀 POPULATE NEW COLLECTION');
  console.log('🚀 ============================');
  
  try {
    // Get current user
    const { useUserStore } = await import('../store/userStore');
    const user = useUserStore.getState().user;
    
    if (!user?.uid) {
      console.error('❌ No authenticated user');
      return;
    }
    
    console.log('👤 User:', user.uid);
    
    // Option 1: Migrate existing data
    console.log('🔄 Option 1: Migrating existing dailySiteUsage data...');
    try {
      await window.migrateToSessionData(user.uid);
    } catch (error) {
      console.log('⚠️ Migration failed, creating test data instead');
    }
    
    // Option 2: Create test data
    console.log('🧪 Option 2: Creating test session data for today...');
    await window.createTestSessionData(user.uid);
    
    // Refresh dashboard
    console.log('🔄 Refreshing dashboard with new session data...');
    const { useDeepFocusDashboardStore } = await import('../store/deepFocusDashboardStore');
    await useDeepFocusDashboardStore.getState().loadSessionData();
    
    console.log('✅ New collection populated and dashboard refreshed!');
    
  } catch (error) {
    console.error('❌ Failed to populate new collection:', error);
  }
};

export {};