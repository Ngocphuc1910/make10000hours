import { create } from 'zustand';
import { WorkSession } from '../types/models';
import { useUserStore } from './userStore';
import { workSessionService } from '../api/workSessionService';

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
  
  // Actions
  setSelectedRange(range: DateRange): void;
  setWorkSessions(sessions: WorkSession[]): void;
  setFocusTimeView(view: 'daily' | 'weekly' | 'monthly'): void;
  subscribeWorkSessions(userId: string): void;
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

    setSelectedRange: (range) => set({ selectedRange: range }),
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
    // User logged in, subscribe to work sessions
    console.log('DashboardStore - User logged in, subscribing to work sessions');
    dashboardStore.subscribeWorkSessions(state.user.uid);
  } else {
    // User logged out, cleanup and reset
    console.log('DashboardStore - User logged out, cleaning up');
    dashboardStore.setWorkSessions([]);
    dashboardStore.cleanupListeners();
  }
});
