import { create } from 'zustand';
import { DEFAULT_SETTINGS, Task, type TimerMode, type TimerSettings, type TimerState as TimerStateModel } from '../types/models';
import { useTaskStore } from './taskStore';
import { useUserStore } from './userStore';
import { timerService } from '../api/timerService';
import { workSessionService } from '../api/workSessionService';
import { getDateISOString } from '../utils/timeUtils';
import { trackPomodoroStarted, trackPomodoroCompleted } from '../utils/analytics';

interface TimerState {
  // Timer status
  isRunning: boolean;
  currentTime: number; // seconds remaining
  totalTime: number; // total seconds for current session
  mode: TimerMode;
  sessionsCompleted: number;
  
  // Current task
  currentTask: Task | null;
  
  // Settings
  settings: TimerSettings;
  
  // Persistence and sync
  isLoading: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  isActiveDevice: boolean;
  syncError: string | null;
  
  // Actions
  start: () => void;
  pause: () => void;
  reset: () => void;
  skip: () => void;
  tick: () => void;
  setMode: (mode: TimerMode) => void;
  setCurrentTask: (task: Task | null) => void;
  setSettings: (settings: TimerSettings) => void;
  
  // Persistence actions
  initializePersistence: (userId: string) => Promise<void>;
  saveToDatabase: () => Promise<void>;
  syncFromRemoteState: (remoteState: TimerStateModel) => void;
  cleanupPersistence: () => void;
  resetTimerState: () => void;
}

export const useTimerStore = create<TimerState>((set, get) => {
  let saveTimeoutId: NodeJS.Timeout | null = null;
  let sessionStartTime: Date | null = null; // Track when the current session started
  
  // Debounced save function to avoid too frequent database writes
  const debouncedSave = () => {
    if (saveTimeoutId) {
      clearTimeout(saveTimeoutId);
    }
    
    saveTimeoutId = setTimeout(async () => {
      const { saveToDatabase } = get();
      await saveToDatabase();
    }, 10000); // Save after 10 seconds of inactivity
  };

  return {
    // Initial state
    isRunning: false,
    currentTime: DEFAULT_SETTINGS.timer.pomodoro * 60, // convert to seconds
    totalTime: DEFAULT_SETTINGS.timer.pomodoro * 60,
    mode: 'pomodoro',
    sessionsCompleted: 0,
    currentTask: null,
    settings: DEFAULT_SETTINGS.timer,
    
    // Persistence state
    isLoading: false,
    isSyncing: false,
    lastSyncTime: null,
    isActiveDevice: true,
    syncError: null,
    
    // Actions
    start: () => {
      const state = get();
      if (!state.isActiveDevice) {
        // If not active device, take control
        set({ isActiveDevice: true });
      }
      
      // Set session start time if not already running
      if (!state.isRunning) {
        sessionStartTime = new Date();
        
        // Track Pomodoro start in Analytics
        if (state.mode === 'pomodoro' && state.currentTask) {
          trackPomodoroStarted(state.currentTask.id, state.currentTask.timeEstimated || 0);
        }
      }
      
      set({ 
        isRunning: true,
        syncError: null 
      });
      
      // Save immediately when starting
      get().saveToDatabase();
    },
    
    pause: () => {
      // Clear session start time when paused - no need to create WorkSession
      // since timeSpent increments during countdown provide the time tracking
      sessionStartTime = null;
      
      set({ isRunning: false });
      
      // Save immediately when pausing to capture exact time
      const updatedState = get();
      updatedState.saveToDatabase();
    },
    
    reset: () => {
      const { mode, settings } = get();
      const totalSeconds = settings[mode] * 60;
      sessionStartTime = null; // Clear session start time when reset
      set({ 
        currentTime: totalSeconds,
        totalTime: totalSeconds,
        isRunning: false,
        settings
      });
      get().saveToDatabase();
    },
    
    skip: () => {
      const { mode, sessionsCompleted, settings, currentTask } = get();
      
      // Track Pomodoro completion in Analytics if completing a pomodoro session
      if (mode === 'pomodoro' && currentTask) {
        const actualTime = (settings.pomodoro * 60 - get().currentTime) / 60; // convert to minutes
        trackPomodoroCompleted(currentTask.id, actualTime);
      }
      
      // No need to create WorkSession - timeSpent increments during countdown provide the time tracking
      
      let nextMode: TimerMode = mode;
      let nextSessionsCompleted = sessionsCompleted;
      
      // Logic to determine next timer mode
      if (mode === 'pomodoro') {
        nextSessionsCompleted = sessionsCompleted + 1;
        if (nextSessionsCompleted % settings.longBreakInterval === 0) {
          nextMode = 'longBreak';
        } else {
          nextMode = 'shortBreak';
        }
      } else {
        nextMode = 'pomodoro';
      }
      
      // Reset session start time when switching modes
      sessionStartTime = null;
      
      // Set the new mode and reset timer
      const totalSeconds = settings[nextMode] * 60;
      const autoStartPomodoro = settings.autoStartPomodoros && nextMode === 'pomodoro';
      const autoStartBreak = settings.autoStartBreaks && (nextMode === 'shortBreak' || nextMode === 'longBreak');
      
      set({
        mode: nextMode,
        currentTime: totalSeconds,
        totalTime: totalSeconds,
        isRunning: autoStartPomodoro || autoStartBreak,
        sessionsCompleted: nextSessionsCompleted,
        settings
      });
      
      // If auto-starting next session, set new session start time
      if (autoStartPomodoro || autoStartBreak) {
        sessionStartTime = new Date();
        
        // Track new Pomodoro start if auto-starting
        if (autoStartPomodoro && currentTask) {
          trackPomodoroStarted(currentTask.id, currentTask.timeEstimated || 0);
        }
      }
      
      get().saveToDatabase();
    },
    
    tick: () => {
      const { currentTime, totalTime, isActiveDevice, isRunning } = get();
      
      // Only tick if this is the active device and timer is running
      if (!isActiveDevice || !isRunning) return;

      const { timeSpentIncrement } = useTaskStore.getState();

      // Increment time spent for the current task every minute while timer is actively running
      if (currentTime !== totalTime && currentTime % 60 === 0) {
        const { currentTask } = get();
        if (currentTask) {
          timeSpentIncrement(currentTask.id, 1); // increment by 1 minute
          workSessionService.upsertWorkSession({
            userId: useUserStore.getState().user?.uid || '',
            taskId: currentTask.id,
            projectId: currentTask.projectId,
            date: getDateISOString(), // use today's date
          }, 1);
        }
      }

      if (currentTime > 0) {
        set({ currentTime: currentTime - 1 });
        debouncedSave(); // Debounced save while ticking
      } else if (currentTime === 0) {
        // Timer finished, move to next mode
        get().skip();
      }
    },
    
    setMode: (mode: TimerMode) => {
      const { settings } = get();
      const totalSeconds = settings[mode] * 60;
      set({
        mode,
        currentTime: totalSeconds,
        totalTime: totalSeconds,
        isRunning: false,
        settings
      });
      get().saveToDatabase();
    },
    
    setCurrentTask: (task: Task | null) => {
      set({ currentTask: task });
      debouncedSave();
    },

    setSettings: (settings: TimerSettings) => {
      const currentState = get();
      
      // Only reset timer if it's at default state (not actively used)
      const isAtDefaultState = currentState.currentTime === currentState.totalTime && 
                               !currentState.isRunning && 
                               currentState.sessionsCompleted === 0;
      
      if (isAtDefaultState) {
        // Reset timer with new settings only if at default state
        const { mode } = currentState;
        const totalSeconds = settings[mode] * 60;
        set({
          settings: settings,
          currentTime: totalSeconds,
          totalTime: totalSeconds,
          isRunning: false
        });
        get().saveToDatabase();
      } else {
        // Just update settings without resetting timer state
        set({ settings: settings });
      }
    },
    
    // Persistence methods
    initializePersistence: async (userId: string) => {
      try {
        set({ isLoading: true, syncError: null });
        
        // Load initial state from database
        const remoteState = await timerService.loadTimerState(userId);
        
        if (remoteState) {
          get().syncFromRemoteState(remoteState);
        } else {
          // No existing state, save current default state
          await get().saveToDatabase();
        }
        
        set({ isLoading: false });
      } catch (error) {
        console.error('Failed to initialize timer persistence:', error);
        set({ 
          isLoading: false, 
          syncError: 'Failed to sync timer state' 
        });
      }
    },
    
    saveToDatabase: async () => {
      const userStore = useUserStore.getState();
      if (!userStore.user || !userStore.isAuthenticated) {
        return;
      }
      
      const state = get();
      if (!state.isActiveDevice) {
        return; // Only active device should save
      }
      
      try {
        set({ isSyncing: true, syncError: null });
        
        // Build timer data object, only including sessionStartTime if it exists
        const timerData: Partial<TimerStateModel> = {
          currentTime: state.currentTime,
          totalTime: state.totalTime,
          mode: state.mode,
          sessionsCompleted: state.sessionsCompleted,
          isRunning: state.isRunning,
          currentTaskId: state.currentTask ? state.currentTask.id : null,
        };
        
        // Only add sessionStartTime if timer is running and sessionStartTime exists
        if (state.isRunning && sessionStartTime) {
          timerData.sessionStartTime = sessionStartTime;
        }
        
        await timerService.saveTimerState(userStore.user.uid, timerData);
        
        set({ 
          isSyncing: false, 
          lastSyncTime: new Date() 
        });
      } catch (error) {
        console.error('Failed to save timer state:', error);
        set({ 
          isSyncing: false, 
          syncError: 'Failed to save timer state' 
        });
      }
    },
    
    syncFromRemoteState: (remoteState: TimerStateModel) => {
      const currentTaskId = remoteState.currentTaskId || null;
      const currentTask = currentTaskId
        ? useTaskStore.getState().tasks.find(task => task.id === currentTaskId) || null
        : null;
      set({
        ...remoteState,
        currentTask: currentTask,
      });
    },
    
    cleanupPersistence: () => {
      if (saveTimeoutId) {
        clearTimeout(saveTimeoutId);
        saveTimeoutId = null;
      }
      set({
        isLoading: false,
        isSyncing: false,
        lastSyncTime: null,
        isActiveDevice: true,
        syncError: null
      });
    },
    
    resetTimerState: () => {
      const { settings } = get();
      set({
        isRunning: false,
        currentTime: settings.pomodoro * 60,
        totalTime: settings.pomodoro * 60,
        mode: 'pomodoro',
        sessionsCompleted: 0,
        currentTask: null,
        isActiveDevice: true,
        syncError: null
      });
    }
  };
});

// Subscribe to user authentication changes
useUserStore.subscribe(async (state) => {
  const timerStore = useTimerStore.getState();
  
  if (state.isAuthenticated && state.user && !state.isLoading) {
    // User logged in, initialize timer store with persistence
    try {
      // Initialize persistence FIRST to load existing timer state
      await timerStore.initializePersistence(state.user.uid);
      
      // THEN set settings after loading existing state
      timerStore.setSettings(state.user.settings.timer);
    } catch (error) {
      console.error('Failed to initialize timer persistence:', error);
    }
  } else {
    // User logged out, cleanup and reset
    timerStore.cleanupPersistence();
    timerStore.resetTimerState();
  }
});
