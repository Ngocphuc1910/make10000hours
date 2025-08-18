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
import { convertSessionsToSiteUsage, calculateOnScreenTime, SiteUsageData } from '../utils/SessionConverter';

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
      // Convert seconds to milliseconds since composeDeepFocusData expects totalTime in milliseconds
      const durationMs = session.duration * 1000;
      dayUsage.totalTime += durationMs;
      dayUsage.sites[session.domain].timeSpent += durationMs;
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

  loadExtensionData: (startDate: Date, endDate: Date) => Promise<void>;
  loadAllTimeExtensionData: () => Promise<void>;
  loadComparisonData: (startDate: Date, endDate: Date) => Promise<void>;
  
  // New session-based loader
  loadSessionData: () => Promise<void>;
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

      loadExtensionData: async (startDate: Date, endDate: Date) => {
        try {
          if (!ExtensionDataService.isExtensionInstalled()) {
            console.warn('⚠️ Extension not installed - skipping data load');
            return;
          }
          
          // Note: Extension sync is now handled at page level to prevent race conditions
          console.log('🔄 Loading data (extension sync handled by page-level sync)...');
          
          const user = useUserStore.getState().user;
          if (!user?.uid) {
            console.warn('⚠️ User not authenticated - skipping extension data load');
            return;
          }

          set({ isLoading: true });
          console.log('🔄 Loading data for deep focus dashboard using SESSION-BASED approach');
          console.log('📅 Date range:', startDate.toISOString(), 'to', endDate.toISOString());
          
          const userId = user.uid;
          const workSessions = await workSessionService.getWorkSessionsForRange(userId, startDate, endDate);
          
          // 🎯 NEW: Use session-based data for On Screen Time
          const siteUsageSessions = await siteUsageSessionService.getSessionsForDateRange(
            userId,
            startDate,
            endDate
          );
          console.log('📊 Retrieved', siteUsageSessions.length, 'site usage sessions');
          
          // Convert sessions to daily usage format for existing stats composition
          const dailySiteUsages = convertSessionsToDailySiteUsage(siteUsageSessions);
          console.log('📈 Converted to', dailySiteUsages.length, 'daily usage records');
          
          const deepFocusSessions = await deepFocusSessionService.getUserSessions(userId, startDate, endDate);
          const overrideSessions = await overrideSessionService.getUserOverrides(userId, startDate, endDate);

          const mappedData = composeDeepFocusData({ workSessions, dailySiteUsages, deepFocusSessions, overrideSessions });
          set({
            timeMetrics: mappedData.timeMetrics,
            dailyUsage: mappedData.dailyUsage,
            siteUsage: mappedData.siteUsage,
          });
        } catch (error) {
          console.error('Extension data loading failed:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      loadAllTimeExtensionData: async () => {
        try {
          if (!ExtensionDataService.isExtensionInstalled()) {
            console.warn('⚠️ Extension not installed - skipping all time data load');
            return;
          }
          const user = useUserStore.getState().user;
          if (!user?.uid) {
            console.warn('⚠️ User not authenticated - skipping all time extension data load');
            return;
          }

          set({ isLoading: true });
          console.log('🔄 Loading ALL TIME data for deep focus dashboard using SESSION-BASED approach');
          
          const userId = user.uid;
          const workSessions = await workSessionService.getAllWorkSessions(userId);
          
          // 🎯 NEW: Use session-based data for On Screen Time (all time)
          // For all time, use a very wide date range
          const startDate = new Date('2020-01-01');
          const endDate = new Date();
          const siteUsageSessions = await siteUsageSessionService.getSessionsForDateRange(
            userId,
            startDate,
            endDate
          );
          console.log('📊 Retrieved', siteUsageSessions.length, 'site usage sessions (all time)');
          
          // Convert sessions to daily usage format for existing stats composition
          const dailySiteUsages = convertSessionsToDailySiteUsage(siteUsageSessions);
          console.log('📈 Converted to', dailySiteUsages.length, 'daily usage records (all time)');
          
          const deepFocusSessions = await deepFocusSessionService.getUserSessions(userId);
          const overrideSessions = await overrideSessionService.getUserOverrides(userId);
          const mappedData = composeDeepFocusData({ workSessions, dailySiteUsages, deepFocusSessions, overrideSessions });
          
          set({
            timeMetrics: mappedData.timeMetrics,
            siteUsage: mappedData.siteUsage,
            dailyUsage: mappedData.dailyUsage,
          });
        } catch (error) {
          console.error('Extension data all time loading failed:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      loadComparisonData: async (startDate: Date, endDate: Date) => {
        return;
      },

      // New session-based data loader
      loadSessionData: async () => {
        const userStore = useUserStore.getState();
        if (!userStore.user?.uid) {
          console.warn('⚠️ No authenticated user, cannot load session data');
          return;
        }

        set({ isLoading: true });

        try {
          console.log('🔄 Loading session-based data for dashboard...');
          
          const sessions = await siteUsageSessionService.getSessionsForToday(userStore.user.uid);
          console.log(`📊 Retrieved ${sessions.length} sessions for today`);
          
          // If no sessions found, suggest data population
          if (sessions.length === 0) {
            console.log('⚠️ No sessions found in siteUsageSessions collection');
            console.log('💡 Run: populateNewCollection() to migrate/create session data');
            
            set({ 
              siteUsageData: [],
              onScreenTime: 0,
              isLoading: false 
            });
            return;
          }
          
          const siteUsageData = convertSessionsToSiteUsage(sessions);
          const onScreenTimeSeconds = calculateOnScreenTime(sessions);
          
          console.log(`✅ Converted to ${siteUsageData.length} site usage entries`);
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
      }),
      version: 1,
    },
  )
);