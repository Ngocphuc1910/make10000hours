import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SiteUsage, ComparisonData, TimeMetrics, DailyUsage } from '../types/deepFocus';
import ExtensionDataService from '../services/extensionDataService';
import { deepFocusSessionService } from '../api/deepFocusSessionService';
import { siteUsageService } from '../api/siteUsageService';
import { overrideSessionService } from '../api/overrideSessionService';
import { useUserStore } from './userStore';
import { useDashboardStore } from './useDashboardStore';
import { composeDeepFocusData } from '../utils/stats';
import { workSessionService } from '../api/workSessionService';

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
          const user = useUserStore.getState().user;
          if (!user?.uid) {
            console.warn('⚠️ User not authenticated - skipping extension data load');
            return;
          }

          set({ isLoading: true });
          const userId = user.uid;
          const workSessions = await workSessionService.getWorkSessionsForRange(userId, startDate, endDate);
          const dailySiteUsages = await siteUsageService.getDailyUsage(userId, startDate, endDate);
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
          const userId = user.uid;
          const workSessions = await workSessionService.getAllWorkSessions(userId);
          const dailySiteUsages = await siteUsageService.getAllTimeDailyUsage(userId);
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