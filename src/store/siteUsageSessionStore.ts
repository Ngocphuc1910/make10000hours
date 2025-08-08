import { create } from 'zustand';
import { siteUsageSessionService } from '../api/siteUsageSessionService';
import { useUserStore } from './userStore';
import { SiteUsageSession } from '../utils/SessionManager';

interface SiteUsageSessionStore {
  sessions: SiteUsageSession[];
  todaySessions: SiteUsageSession[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchTodaySessions: () => Promise<void>;
  fetchSessionsForDateRange: (startDate: Date, endDate: Date) => Promise<void>;
  refreshSessions: () => Promise<void>;
  clearSessions: () => void;
  setError: (error: string | null) => void;
}

export const useSiteUsageSessionStore = create<SiteUsageSessionStore>((set, get) => ({
  sessions: [],
  todaySessions: [],
  isLoading: false,
  error: null,

  fetchTodaySessions: async () => {
    const userStore = useUserStore.getState();
    if (!userStore.user?.uid) {
      set({ error: 'User not authenticated' });
      return;
    }

    set({ isLoading: true, error: null });
    
    try {
      const sessions = await siteUsageSessionService.getTodaySessions(userStore.user.uid);
      set({ 
        todaySessions: sessions,
        sessions: sessions,
        isLoading: false 
      });
    } catch (error) {
      console.error('Failed to fetch today\'s sessions:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch sessions',
        isLoading: false 
      });
    }
  },

  fetchSessionsForDateRange: async (startDate: Date, endDate: Date) => {
    const userStore = useUserStore.getState();
    if (!userStore.user?.uid) {
      set({ error: 'User not authenticated' });
      return;
    }

    set({ isLoading: true, error: null });
    
    try {
      const sessions = await siteUsageSessionService.getSessionsForDateRange(
        userStore.user.uid,
        startDate,
        endDate
      );
      set({ 
        sessions,
        isLoading: false 
      });
    } catch (error) {
      console.error('Failed to fetch sessions for date range:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch sessions',
        isLoading: false 
      });
    }
  },

  refreshSessions: async () => {
    await get().fetchTodaySessions();
  },

  clearSessions: () => {
    set({ sessions: [], todaySessions: [], error: null });
  },

  setError: (error: string | null) => {
    set({ error });
  }
}));