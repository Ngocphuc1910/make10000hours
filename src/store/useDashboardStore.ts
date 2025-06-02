import { create } from 'zustand';
import { WorkSession } from '../types/models';
import { useUserStore } from './userStore';
import { workSessionService } from '../api/workSessionService';

export type RangeType = 'today' | 'last 7 days' | 'last 30 days' | 'all time' | 'custom';

export type DateRange = {
  rangeType: 'today' | 'last 7 days' | 'last 30 days' | 'all time' | 'custom';
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

export const useDashboardStore = create<DashboardState>((set, get) => ({
  selectedRange: {
    rangeType: 'today',
    startDate: new Date(),
    endDate: new Date(),
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
      console.log('DashboardStore - Work sessions:', sessions);
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
})); 

// Subscribe to user authentication changes
useUserStore.subscribe((state) => {
  const dashboardStore = useDashboardStore.getState();
  
  console.log('DashboardStore - User state changed:', {
    isAuthenticated: state.isAuthenticated,
    hasUser: !!state.user,
    userId: state.user?.uid
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
