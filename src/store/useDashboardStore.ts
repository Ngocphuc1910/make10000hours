import { create } from 'zustand';
import { WorkSession } from '../types/models';
import { useUserStore } from './userStore';
import { workSessionService } from '../api/workSessionService';
import { transitionQueryService } from '../services/transitionService';

export type RangeType = 'today' | 'yesterday' | 'last 7 days' | 'last 30 days' | 'all time' | 'custom';

export type DateRange = {
  rangeType: RangeType;
  startDate: Date | null;
  endDate: Date | null;
};

interface DashboardState {
  selectedRange: DateRange;
  workSessions: WorkSession[];
  focusTimeView: 'daily' | 'weekly' | 'monthly';
  unsubscribe: (() => void) | null;
  isLoading: boolean;
  useEventDrivenLoading: boolean; // Feature flag for safe rollback
  
  // Actions
  setSelectedRange(range: DateRange): void;
  setWorkSessions(sessions: WorkSession[]): void;
  setFocusTimeView(view: 'daily' | 'weekly' | 'monthly'): void;
  subscribeWorkSessions(userId: string): void;
  loadWorkSessionsForRange(userId: string, range: DateRange): Promise<void>;
  cleanupListeners(): void;
}

export const useDashboardStore = create<DashboardState>((set, get) => {
  return {
    selectedRange: {
      rangeType: 'all time',
      startDate: null,
      endDate: null,
    },
    workSessions: [],
    focusTimeView: 'daily',
    unsubscribe: null,
    isLoading: false,
    useEventDrivenLoading: true, // Feature flag - set to false to revert to subscription

    setSelectedRange: async (range) => {
      set({ selectedRange: range });
      
      // If event-driven loading is enabled, load data for new range
      const { useEventDrivenLoading } = get();
      if (useEventDrivenLoading) {
        const userId = useUserStore.getState().user?.uid;
        if (userId) {
          await get().loadWorkSessionsForRange(userId, range);
        }
      }
    },
    setWorkSessions: (sessions) => set({ workSessions: sessions }),
    setFocusTimeView: (view) => set({ focusTimeView: view }),
    subscribeWorkSessions: (userId) => {
      console.log('DashboardStore - Subscribing to work sessions for user:', userId);
      const { unsubscribe } = get();
      
      // Clean up existing listener
      if (unsubscribe) {
        unsubscribe();
      }
      
      // Subscribe to work sessions for the user
      const newUnsubscribe = workSessionService.subscribeToWorkSessions(userId, (sessions) => {
        console.log('DashboardStore - Received work sessions:', sessions.length);
        console.log('DashboardStore - Sample work sessions:', sessions.slice(0, 3));
        console.log('DashboardStore - Today\'s sessions:', sessions.filter(s => {
          const sessionDate = new Date(s.date);
          const today = new Date();
          return sessionDate.toDateString() === today.toDateString();
        }).length);
        set({ workSessions: sessions });
      });
      
      set({ unsubscribe: newUnsubscribe });
    },
    loadWorkSessionsForRange: async (userId: string, range: DateRange) => {
      const { startDate, endDate, rangeType } = range;
      const userTimezone = useUserStore.getState().getTimezone();
      
      console.log('DashboardStore - Loading work sessions for range (UTC-based):', {
        userId,
        userTimezone,
        rangeType,
        startDate: startDate?.toISOString().split('T')[0] || 'null',
        endDate: endDate?.toISOString().split('T')[0] || 'null'
      });
      
      set({ isLoading: true });
      
      try {
        let unifiedSessions;
        
        if (rangeType === 'all time' || !startDate || !endDate) {
          // For "All time", get ALL sessions from both UTC and legacy systems
          console.log('DashboardStore - Loading all sessions for "all time" via transition service');
          // Use a very wide date range to get all data
          const veryOldDate = new Date('2020-01-01');
          const today = new Date();
          unifiedSessions = await transitionQueryService.getSessionsForDateRange(
            veryOldDate,
            today,
            userId,
            userTimezone
          );
        } else {
          // For specific date ranges, use UTC-aware transition service
          console.log('DashboardStore - Loading sessions for date range via transition service');
          unifiedSessions = await transitionQueryService.getSessionsForDateRange(
            startDate,
            endDate,
            userId,
            userTimezone
          );
        }
        
        // Convert unified sessions back to legacy format for compatibility
        const sessions: WorkSession[] = unifiedSessions.map(unified => {
          if (unified.dataSource === 'legacy') {
            return unified.rawData as WorkSession;
          } else {
            // Convert UTC session to legacy format
            return {
              id: unified.id,
              userId: unified.userId,
              taskId: unified.taskId,
              projectId: unified.projectId,
              duration: unified.duration,
              sessionType: unified.sessionType,
              status: unified.status,
              notes: unified.notes,
              date: unified.startTime.toISOString().split('T')[0], // Convert to date string
              startTime: unified.startTime,
              endTime: unified.endTime,
              createdAt: new Date(unified.createdAt),
              updatedAt: new Date(unified.updatedAt)
            };
          }
        });
        
        console.log('DashboardStore - Successfully loaded sessions via transition service:', {
          totalSessions: sessions.length,
          utcSessions: unifiedSessions.filter(s => s.dataSource === 'utc').length,
          legacySessions: unifiedSessions.filter(s => s.dataSource === 'legacy').length
        });
        
        set({ workSessions: sessions });
      } catch (error) {
        console.error('DashboardStore - Error loading work sessions via transition service:', error);
        // Fallback to legacy system on error
        try {
          console.log('DashboardStore - Falling back to legacy system');
          let sessions;
          if (rangeType === 'all time' || !startDate || !endDate) {
            sessions = await workSessionService.getAllWorkSessions(userId);
          } else {
            sessions = await workSessionService.getWorkSessionsForRange(userId, startDate, endDate);
          }
          set({ workSessions: sessions });
        } catch (fallbackError) {
          console.error('DashboardStore - Legacy fallback also failed:', fallbackError);
        }
      } finally {
        set({ isLoading: false });
      }
    },
    cleanupListeners: () => {
      const { unsubscribe } = get();
      if (unsubscribe) {
        unsubscribe();
        set({ unsubscribe: null, workSessions: [] });
      }
    }
  };
});

// Subscribe to user authentication changes
useUserStore.subscribe((state) => {
  const dashboardStore = useDashboardStore.getState();
  
  // CRITICAL: Only react to auth changes after user store is initialized
  // This prevents cleanup during Firebase auth restoration on page reload
  if (!state.isInitialized) {
    console.log('DashboardStore - User store not initialized yet, waiting...');
    return;
  }
  
  console.log('DashboardStore - User state changed:', {
    isAuthenticated: state.isAuthenticated,
    hasUser: !!state.user,
    userId: state.user?.uid,
    isInitialized: state.isInitialized
  });
  
  if (state.isAuthenticated && state.user) {
    // User logged in - choose loading strategy based on feature flag
    const { useEventDrivenLoading, selectedRange } = dashboardStore;
    
    if (useEventDrivenLoading) {
      // Use event-driven loading for Productivity Insight page
      console.log('DashboardStore - User logged in, using event-driven loading');
      dashboardStore.cleanupListeners(); // Clean up any existing subscriptions
      
      // Always load data for current date range (handles page reload)
      console.log('DashboardStore - Loading data for current range:', selectedRange);
      dashboardStore.loadWorkSessionsForRange(state.user.uid, selectedRange);
    } else {
      // Use subscription-based loading (original behavior)
      console.log('DashboardStore - User logged in, using subscription-based loading');
      dashboardStore.subscribeWorkSessions(state.user.uid);
    }
  } else {
    // User logged out, cleanup and reset
    console.log('DashboardStore - User logged out, cleaning up');
    dashboardStore.setWorkSessions([]);
    dashboardStore.cleanupListeners();
  }
});
