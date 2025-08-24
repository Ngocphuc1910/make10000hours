import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SiteUsage, ComparisonData, TimeMetrics, DailyUsage } from '../types/deepFocus';
import ExtensionDataService from '../services/extensionDataService';
import { deepFocusSessionService } from '../api/deepFocusSessionService';
import { siteUsageSessionService } from '../api/siteUsageSessionService';
import { overrideSessionService } from '../api/overrideSessionService';
import { extensionSyncListener } from '../services/extensionSyncListener';
import { useUserStore } from './userStore';
import { useDashboardStore } from './useDashboardStore';
import { composeDeepFocusData } from '../utils/stats';
import { workSessionService } from '../api/workSessionService';
import { DailySiteUsage } from '../api/siteUsageService';
import { SiteUsageSession } from '../utils/SessionManager';
import { convertSessionsToSiteUsage, calculateOnScreenTime, SiteUsageData, processUnifiedSessionMetrics, UnifiedSessionMetrics } from '../utils/SessionConverter';
import { RobustTimezoneUtils } from '../utils/robustTimezoneUtils';

// Helper function to convert session data to daily site usage format
const convertSessionsToDailySiteUsage = (sessions: SiteUsageSession[]): DailySiteUsage[] => {
  const dailyUsageMap = new Map<string, DailySiteUsage>();
  
  sessions.forEach(session => {
    // Use UTC date for consistency
    const dateKey = session.utcDate;
    
    if (!dailyUsageMap.has(dateKey)) {
      dailyUsageMap.set(dateKey, {
        userId: session.userId,
        date: dateKey,
        totalTime: 0,
        sitesVisited: 0,
        productivityScore: 0,
        sites: {},
        syncedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    const dayUsage = dailyUsageMap.get(dateKey)!;
    
    // Add session to sites
    if (!dayUsage.sites[session.domain]) {
      dayUsage.sites[session.domain] = {
        domain: session.domain,
        timeSpent: 0,
        visits: 0,
        lastVisit: session.startTimeUTC,
        favicon: session.favicon || '',
        title: session.title || session.domain,
        category: session.category || 'uncategorized'
      };
      dayUsage.sitesVisited++;
    }
    
    // 🐛 FIX: Include sessions with any valid duration, not just 'completed' status
    // This fixes the "On Screen Time: 0m" issue while bottom site usage shows data
    if (session.duration && session.duration > 0) {
      // Key fix: Keep daily totalTime in SECONDS to prevent 14250h bug in timeMetrics
      // but keep site-specific timeSpent in milliseconds for UI compatibility
      const durationSeconds = session.duration; // Session duration is in seconds
      const durationMs = session.duration * 1000; // Convert to ms for compatibility
      
      dayUsage.totalTime += durationSeconds; // SECONDS for stats.ts calculation
      dayUsage.sites[session.domain].timeSpent += durationMs; // MS for mapArrSiteUsage compatibility
      dayUsage.sites[session.domain].visits += (session.visits || 1); // Use actual visit count from session
      
      // Update last visit time if this session is more recent
      if (new Date(session.startTimeUTC) > new Date(dayUsage.sites[session.domain].lastVisit)) {
        dayUsage.sites[session.domain].lastVisit = session.startTimeUTC;
      }
      
      console.log(`✅ Processed session: ${session.domain}, duration: ${session.duration}s, status: ${session.status}`);
    } else {
      console.log(`⚠️ Skipped session: ${session.domain}, duration: ${session.duration}, status: ${session.status}`);
    }
  });
  
  return Array.from(dailyUsageMap.values());
};;;

interface DeepFocusDashboardStore {
  timeMetrics: TimeMetrics;
  dailyUsage: DailyUsage[];
  siteUsage: SiteUsage[];
  comparisonData: ComparisonData | null;
  isLoading: boolean;
  isLoadingComparison: boolean;
  
  // New session-based data
  siteUsageData: SiteUsageData[];
  onScreenTime: number; // seconds
  
  // New unified metrics
  sessionMetrics: {
    totalSessions: number;
    uniqueDomains: number;
    averageSessionDuration: number;
    longestSession: number;
  };

  // UNIFIED: Single data loader with timezone support
  loadDashboardData: (startDate?: Date, endDate?: Date, userTimezone?: string) => Promise<void>;
  loadAllTimeData: (userTimezone?: string) => Promise<void>;
  loadSessionData: (userTimezone?: string) => Promise<void>;
  loadComparisonData: (startDate: Date, endDate: Date) => Promise<void>;
  
  // New unified loading method
  loadUnifiedDashboardData: (startDate?: Date, endDate?: Date, userTimezone?: string) => Promise<void>;
};

export const useDeepFocusDashboardStore = create<DeepFocusDashboardStore>()(
  persist(
    (set, get) => ({
      timeMetrics: {
        onScreenTime: 0,
        workingTime: 0,
        deepFocusTime: 0,
        overrideTime: 0
      },
      dailyUsage: [],
      siteUsage: [],
      comparisonData: null,
      isLoading: false,
      isLoadingComparison: false,
      
      // New session-based data
      siteUsageData: [],
      onScreenTime: 0,
      
      // New unified metrics
      sessionMetrics: {
        totalSessions: 0,
        uniqueDomains: 0,
        averageSessionDuration: 0,
        longestSession: 0
      },

      // UNIFIED dashboard data loader
      loadDashboardData: async (startDate?: Date, endDate?: Date, userTimezone?: string) => {
        const userStore = useUserStore.getState();
        if (!userStore.user?.uid) {
          console.warn('⚠️ User not authenticated');
          return;
        }

        set({ isLoading: true });

        try {
          const userId = userStore.user.uid;
          const effectiveTimezone = userTimezone || RobustTimezoneUtils.getUserTimezone();
          const queryStartDate = startDate || new Date();
          const queryEndDate = endDate || new Date();

          console.log(`🔄 Loading dashboard data using SETTING timezone: ${effectiveTimezone}`);
          console.log(`📅 Date range: ${queryStartDate.toDateString()} to ${queryEndDate.toDateString()}`);

          // Get session data using unified method with user's SETTING timezone
          const siteUsageSessions = await siteUsageSessionService.getSessionsByUserTimezone(
            userId,
            queryStartDate,
            queryEndDate,
            effectiveTimezone
          );

          console.log(`📊 Retrieved ${siteUsageSessions.length} sessions for user timezone`);

          // Process session data for dashboard
          const siteUsageData = convertSessionsToSiteUsage(siteUsageSessions);
          const onScreenTimeSeconds = calculateOnScreenTime(siteUsageSessions);
          const dailySiteUsages = convertSessionsToDailySiteUsage(siteUsageSessions);

          // Get other data types (work sessions, deep focus, overrides)
          const workSessions = await workSessionService.getWorkSessionsForRange(
            userId, queryStartDate, queryEndDate
          );
          const deepFocusSessions = await deepFocusSessionService.getUserSessions(
            userId, queryStartDate, queryEndDate
          );
          const overrideSessions = await overrideSessionService.getUserOverrides(
            userId, queryStartDate, queryEndDate
          );

          // Compose unified dashboard data
          const mappedData = composeDeepFocusData({
            workSessions,
            dailySiteUsages,
            deepFocusSessions,
            overrideSessions
          });

          set({
            timeMetrics: mappedData.timeMetrics,
            dailyUsage: mappedData.dailyUsage,
            siteUsage: mappedData.siteUsage,
            siteUsageData,
            onScreenTime: onScreenTimeSeconds,
            isLoading: false
          });

          console.log(`✅ Dashboard data loaded successfully`);

        } catch (error) {
          console.error('❌ Dashboard data loading failed:', error);
          set({ isLoading: false });
        }
      },

      // NEW: Unified dashboard data loader with single API call
      loadUnifiedDashboardData: async (startDate?: Date, endDate?: Date, userTimezone?: string) => {
        const userStore = useUserStore.getState();
        if (!userStore.user?.uid) {
          console.warn('⚠️ User not authenticated');
          return;
        }

        set({ isLoading: true });

        try {
          const userId = userStore.user.uid;
          const effectiveTimezone = userTimezone || RobustTimezoneUtils.getUserTimezone();
          const queryStartDate = startDate || new Date();
          const queryEndDate = endDate || new Date();

          console.log(`🔄 Loading UNIFIED dashboard data using timezone: ${effectiveTimezone}`);
          console.log(`📅 Date range: ${queryStartDate.toDateString()} to ${queryEndDate.toDateString()}`);

          // SINGLE API call for session data with timezone support
          const siteUsageSessions = await siteUsageSessionService.getSessionsByUserTimezone(
            userId,
            queryStartDate,
            queryEndDate,
            effectiveTimezone
          );

          console.log(`📊 Retrieved ${siteUsageSessions.length} sessions for unified processing`);

          // UNIFIED processing in one pass - eliminates duplicate processing
          const { onScreenTime, siteUsageData, dailySiteUsages, sessionStats } = 
            processUnifiedSessionMetrics(siteUsageSessions);

          // Get other session types in parallel (still separate as they're different data types)
          const [workSessions, deepFocusSessions, overrideSessions] = await Promise.all([
            workSessionService.getWorkSessionsForRange(userId, queryStartDate, queryEndDate),
            deepFocusSessionService.getUserSessions(userId, queryStartDate, queryEndDate),
            overrideSessionService.getUserOverrides(userId, queryStartDate, queryEndDate)
          ]);

          // Compose final dashboard data using processed daily site usages
          const mappedData = composeDeepFocusData({
            workSessions,
            dailySiteUsages, // Use unified processed data
            deepFocusSessions,
            overrideSessions
          });

          // SINGLE state update with all unified metrics
          set({
            timeMetrics: {
              ...mappedData.timeMetrics,
              onScreenTime: Math.round(onScreenTime / 60) // Convert seconds to minutes for UI display
            },
            dailyUsage: mappedData.dailyUsage,
            siteUsage: mappedData.siteUsage,
            siteUsageData, // Site usage data for right panel
            onScreenTime, // On-screen time in seconds for display
            sessionMetrics: sessionStats, // New session statistics
            isLoading: false
          });

          console.log(`✅ Unified dashboard data loaded successfully`);
          console.log(`📊 Metrics: ${Math.round(onScreenTime / 60)}min on-screen, ${sessionStats.totalSessions} sessions, ${sessionStats.uniqueDomains} domains`);

        } catch (error) {
          console.error('❌ Unified dashboard data loading failed:', error);
          set({ isLoading: false });
        }
      },

      // All-time data loader
      loadAllTimeData: async (userTimezone?: string) => {
        const userStore = useUserStore.getState();
        if (!userStore.user?.uid) {
          console.warn('⚠️ User not authenticated');
          return;
        }

        set({ isLoading: true });

        try {
          const userId = userStore.user.uid;
          const effectiveTimezone = userTimezone || RobustTimezoneUtils.getUserTimezone();

          console.log(`🔄 Loading all-time data using SETTING timezone: ${effectiveTimezone}`);

          // For all-time, use wide date range
          const startDate = new Date('2020-01-01');
          const endDate = new Date();

          const siteUsageSessions = await siteUsageSessionService.getSessionsByUserTimezone(
            userId,
            startDate,
            endDate,
            effectiveTimezone
          );

          // Process and set data similar to loadDashboardData
          const siteUsageData = convertSessionsToSiteUsage(siteUsageSessions);
          const onScreenTimeSeconds = calculateOnScreenTime(siteUsageSessions);
          const dailySiteUsages = convertSessionsToDailySiteUsage(siteUsageSessions);

          const workSessions = await workSessionService.getAllWorkSessions(userId);
          const deepFocusSessions = await deepFocusSessionService.getUserSessions(userId);
          const overrideSessions = await overrideSessionService.getUserOverrides(userId);

          const mappedData = composeDeepFocusData({
            workSessions,
            dailySiteUsages,
            deepFocusSessions,
            overrideSessions
          });

          set({
            timeMetrics: mappedData.timeMetrics,
            dailyUsage: mappedData.dailyUsage,
            siteUsage: mappedData.siteUsage,
            siteUsageData,
            onScreenTime: onScreenTimeSeconds,
            isLoading: false
          });

          console.log(`✅ All-time data loaded successfully`);

        } catch (error) {
          console.error('❌ All-time data loading failed:', error);
          set({ isLoading: false });
        }
      },

      loadComparisonData: async (startDate: Date, endDate: Date) => {
        return;
      },

      // Session data loader (for right panel compatibility)
      loadSessionData: async (userTimezone?: string) => {
        const userStore = useUserStore.getState();
        if (!userStore.user?.uid) {
          console.warn('⚠️ No authenticated user, cannot load session data');
          return;
        }

        set({ isLoading: true });

        try {
          const effectiveTimezone = userTimezone || RobustTimezoneUtils.getUserTimezone();

          console.log(`🔄 Loading session data using SETTING timezone: ${effectiveTimezone}`);

          const sessions = await siteUsageSessionService.getSessionsForTodayTimezone(
            userStore.user.uid,
            effectiveTimezone
          );

          console.log(`📊 Retrieved ${sessions.length} sessions for today (user timezone)`);

          if (sessions.length === 0) {
            console.log('⚠️ No sessions found for today in user timezone');
            set({
              siteUsageData: [],
              onScreenTime: 0,
              isLoading: false
            });
            return;
          }

          const siteUsageData = convertSessionsToSiteUsage(sessions);
          const onScreenTimeSeconds = calculateOnScreenTime(sessions);

          console.log(`✅ Processed ${siteUsageData.length} site usage entries`);
          console.log(`📱 Total on-screen time: ${Math.round(onScreenTimeSeconds / 60)} minutes`);

          set({
            siteUsageData,
            onScreenTime: onScreenTimeSeconds,
            isLoading: false
          });
        } catch (error) {
          console.error('❌ Failed to load session data:', error);
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'deepFocusDashboardStore',
      partialize: (state) => ({
        timeMetrics: state.timeMetrics,
        dailyUsage: state.dailyUsage,
        siteUsage: state.siteUsage,
        comparisonData: state.comparisonData,
        isLoading: state.isLoading,
        isLoadingComparison: state.isLoadingComparison,
        siteUsageData: state.siteUsageData,
        onScreenTime: state.onScreenTime,
        sessionMetrics: state.sessionMetrics,
      }),
      version: 1,
    },
  )
);