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

// Helper function to convert session data to daily site usage format
const convertSessionsToDailySiteUsage = (sessions: SiteUsageSession[]): DailySiteUsage[] => {
  const dailyUsageMap = new Map<string, DailySiteUsage>();
  
  sessions.forEach(session => {
    // Use UTC date for consistency
    const dateKey = session.utcDate || new Date(session.startTime).toISOString().split('T')[0];
    
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
        lastVisit: session.startTime,
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
      dayUsage.sites[session.domain].visits++;
      
      // Update last visit time if this session is more recent
      if (new Date(session.startTime) > new Date(dayUsage.sites[session.domain].lastVisit)) {
        dayUsage.sites[session.domain].lastVisit = session.startTime;
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

  loadExtensionData: (startDate: Date, endDate: Date) => Promise<void>;
  loadAllTimeExtensionData: () => Promise<void>;
  loadComparisonData: (startDate: Date, endDate: Date) => Promise<void>;
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

      loadExtensionData: async (startDate: Date, endDate: Date) => {
        try {
          if (!ExtensionDataService.isExtensionInstalled()) {
            console.warn('⚠️ Extension not installed - skipping data load');
            return;
          }
          
          // 🎯 TRIGGER: Request extension sync before loading data
          console.log('🔄 Requesting extension to sync sessions to Firebase...');
          await extensionSyncListener.triggerExtensionSync();
          
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
      }),
      version: 1,
    },
  )
);