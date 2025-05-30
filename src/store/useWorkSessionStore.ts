import { create } from 'zustand';
import { workSessionService } from '../api/workSessionService';
import { useUserStore } from './userStore';
import type { WorkSession } from '../types/models';

interface WorkSessionState {
  workSessions: WorkSession[];
  isLoading: boolean;
  error: string | null;
  unsubscribe: (() => void) | null;
  
  // Date range for filtering
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  
  // Actions
  initializeStore: (userId: string) => void;
  cleanupListeners: () => void;
  createWorkSession: (sessionData: Omit<WorkSession, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateWorkSession: (sessionId: string, updates: Partial<WorkSession>) => Promise<void>;
  deleteWorkSession: (sessionId: string) => Promise<void>;
  setDateRange: (startDate: Date, endDate: Date) => void;
  getWorkSessionsByTask: (taskId: string) => WorkSession[];
  getWorkSessionsByProject: (projectId: string) => WorkSession[];
  getWorkSessionsByDate: (date: Date) => WorkSession[];
  getTotalTimeSpentByTask: (taskId: string) => number;
  getTotalTimeSpentByProject: (projectId: string) => number;
  getTimeSpentByTaskOnDate: (taskId: string, date: Date) => number;
}

export const useWorkSessionStore = create<WorkSessionState>((set, get) => ({
  workSessions: [],
  isLoading: false,
  error: null,
  unsubscribe: null,
  dateRange: {
    startDate: (() => {
      const date = new Date();
      date.setDate(date.getDate() - 30);
      date.setHours(0, 0, 0, 0); // Start of day 30 days ago
      return date;
    })(),
    endDate: (() => {
      const date = new Date();
      date.setHours(23, 59, 59, 999); // End of today
      return date;
    })(),
  },

  initializeStore: (userId: string) => {
    const { dateRange } = get();
    set({ isLoading: true, error: null });
    
    // Clean up existing listener
    get().cleanupListeners();
    
    // Subscribe to work sessions in the current date range
    const unsubscribeFn = workSessionService.subscribeToWorkSessions(
      userId,
      dateRange.startDate,
      dateRange.endDate,
      (sessions) => {
        set({ 
          workSessions: sessions, 
          isLoading: false, 
          error: null 
        });
      }
    );
    
    set({ unsubscribe: unsubscribeFn });
  },

  cleanupListeners: () => {
    const { unsubscribe } = get();
    if (unsubscribe) {
      unsubscribe();
      set({ unsubscribe: null });
    }
  },

  createWorkSession: async (sessionData: Omit<WorkSession, 'id' | 'createdAt' | 'updatedAt'>) => {
    console.log('🔄 Creating new WorkSession:', sessionData);
    
    try {
      set({ error: null });
      const sessionId = await workSessionService.createWorkSession(sessionData);
      console.log('✅ WorkSession created with ID:', sessionId);
      return sessionId;
    } catch (error) {
      console.error('❌ Failed to create WorkSession:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create work session';
      set({ error: errorMessage });
      throw error;
    }
  },

  updateWorkSession: async (sessionId, updates) => {
    try {
      set({ error: null });
      await workSessionService.updateWorkSession(sessionId, updates);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update work session';
      set({ error: errorMessage });
      throw error;
    }
  },

  deleteWorkSession: async (sessionId) => {
    try {
      set({ error: null });
      await workSessionService.deleteWorkSession(sessionId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete work session';
      set({ error: errorMessage });
      throw error;
    }
  },

  setDateRange: (startDate, endDate) => {
    set({ dateRange: { startDate, endDate } });
    
    // Re-initialize with new date range if user is authenticated
    const { user, isAuthenticated } = useUserStore.getState();
    if (isAuthenticated && user) {
      get().initializeStore(user.uid);
    }
  },

  getWorkSessionsByTask: (taskId) => {
    return get().workSessions.filter(session => session.taskId === taskId);
  },

  getWorkSessionsByProject: (projectId) => {
    return get().workSessions.filter(session => session.projectId === projectId);
  },

  getWorkSessionsByDate: (date) => {
    const dateString = date.toDateString();
    return get().workSessions.filter(session => 
      session.startTime.toDateString() === dateString
    );
  },

  getTotalTimeSpentByTask: (taskId) => {
    return get().workSessions
      .filter(session => session.taskId === taskId)
      .reduce((total, session) => total + session.duration, 0);
  },

  getTotalTimeSpentByProject: (projectId) => {
    return get().workSessions
      .filter(session => session.projectId === projectId)
      .reduce((total, session) => total + session.duration, 0);
  },

  getTimeSpentByTaskOnDate: (taskId, date) => {
    const dateString = date.toDateString();
    return get().workSessions
      .filter(session => 
        session.taskId === taskId && 
        session.startTime.toDateString() === dateString
      )
      .reduce((total, session) => total + session.duration, 0);
  },
})); 