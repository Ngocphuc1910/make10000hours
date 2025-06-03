import { create } from 'zustand';
import { DEFAULT_SETTINGS, Task, type TimerMode, type TimerSettings, type TimerState as TimerStateModel, type ActiveSession, type WorkSession } from '../types/models';
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
  
  // Active session tracking
  activeSession: ActiveSession | null;
  sessionStartTimerPosition: number | null; // Timer position when session started
  
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
  
  // Session management actions
  createActiveSession: () => Promise<void>;
  updateActiveSession: () => Promise<void>;
  completeActiveSession: (status: 'completed' | 'paused' | 'switched') => Promise<void>;
  switchActiveSession: () => Promise<void>;
  cleanupOrphanedSessions: () => Promise<void>;
  
  // Persistence actions
  initializePersistence: (userId: string) => Promise<void>;
  saveToDatabase: () => Promise<void>;
  syncFromRemoteState: (remoteState: TimerStateModel) => void;
  cleanupPersistence: () => void;
  resetTimerState: () => void;
}

export const useTimerStore = create<TimerState>((set, get) => {
  let saveTimeoutId: NodeJS.Timeout | null = null;
  
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
    activeSession: null,
    sessionStartTimerPosition: null,
    settings: DEFAULT_SETTINGS.timer,
    
    // Persistence state
    isLoading: false,
    isSyncing: false,
    lastSyncTime: null,
    isActiveDevice: true,
    syncError: null,
    
    // Actions
    start: async () => {
      const state = get();
      if (!state.isActiveDevice) {
        // If not active device, take control
        set({ isActiveDevice: true });
      }
      
      // Create active session if starting timer and we have a task
      if (!state.isRunning && state.currentTask) {
        await get().createActiveSession();
      }
      
      set({ 
        isRunning: true,
        syncError: null 
      });
      
      // Track Pomodoro start in Analytics
      if (state.mode === 'pomodoro' && state.currentTask) {
        trackPomodoroStarted(state.currentTask.id, state.currentTask.timeEstimated || 0);
      }
      
      // Save immediately when starting
      get().saveToDatabase();
    },
    
    pause: async () => {
      const state = get();
      
      // Complete active session when pausing
      if (state.activeSession) {
        await get().completeActiveSession('paused');
      }
      
      set({ isRunning: false });
      
      // Save immediately when pausing to capture exact time
      get().saveToDatabase();
    },
    
    reset: () => {
      const { mode, settings } = get();
      const totalSeconds = settings[mode] * 60;
      
      set({ 
        currentTime: totalSeconds,
        totalTime: totalSeconds,
        isRunning: false,
        activeSession: null,
        sessionStartTimerPosition: null,
        settings
      });
      get().saveToDatabase();
    },
    
    skip: async () => {
      const { mode, sessionsCompleted, settings, currentTask, activeSession } = get();
      
      // Complete current active session
      if (activeSession) {
        await get().completeActiveSession('completed');
      }
      
      // Track Pomodoro completion in Analytics if completing a pomodoro session
      if (mode === 'pomodoro' && currentTask) {
        const actualTime = (settings.pomodoro * 60 - get().currentTime) / 60; // convert to minutes
        trackPomodoroCompleted(currentTask.id, actualTime);
      }
      
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
        activeSession: null,
        sessionStartTimerPosition: null,
        settings
      });
      
      // If auto-starting next session, create new active session
      if ((autoStartPomodoro || autoStartBreak) && currentTask) {
        await get().createActiveSession();
        
        // Track new Pomodoro start if auto-starting
        if (autoStartPomodoro) {
          trackPomodoroStarted(currentTask.id, currentTask.timeEstimated || 0);
        }
      }
      
      get().saveToDatabase();
    },
    
    tick: () => {
      const { currentTime, totalTime, isActiveDevice, isRunning, sessionStartTimerPosition, activeSession } = get();
      
      // Only tick if this is the active device and timer is running
      if (!isActiveDevice || !isRunning) return;

      const { timeSpentIncrement } = useTaskStore.getState();

      // Check if we hit a timer minute boundary and have an active session
      if (currentTime !== totalTime && currentTime % 60 === 0 && activeSession && sessionStartTimerPosition !== null) {
        const { currentTask } = get();
        
        // Calculate how many timer minute boundaries we've crossed since session start
        const sessionStartMinute = Math.floor(sessionStartTimerPosition / 60);
        const currentMinute = Math.floor(currentTime / 60);
        const minutesCrossed = sessionStartMinute - currentMinute;
        
        console.log('Timer minute boundary hit:', {
          sessionStartTimerPosition,
          sessionStartMinute,
          currentTime,
          currentMinute,
          minutesCrossed,
          currentTask: currentTask?.title,
          timer_display: `${Math.floor(currentTime / 60)}:${String(currentTime % 60).padStart(2, '0')}`
        });
        
        if (currentTask && minutesCrossed > 0) {
          timeSpentIncrement(currentTask.id, 1); // increment by 1 minute
          
          // Update active session duration with the number of minutes crossed
          get().updateActiveSession();
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
        activeSession: null,
        sessionStartTimerPosition: null,
        settings
      });
      get().saveToDatabase();
    },
    
    setCurrentTask: async (task: Task | null) => {
      const state = get();
      
      // If we're switching tasks while timer is running
      if (state.isRunning && state.activeSession && state.currentTask && task && state.currentTask.id !== task.id) {
        // Switch current session (only update status, don't recalculate duration)
        await get().switchActiveSession();
        
        // Set new task and clear session tracking for fresh start
        set({ 
          currentTask: task,
          sessionStartTimerPosition: null // Will be set when new session is created
        });
        
        // Create new active session for new task
        await get().createActiveSession();
      } else {
        set({ currentTask: task });
      }
      
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
    
    // Session management actions
    createActiveSession: async () => {
      const { currentTask, mode, currentTime } = get();
      const { user } = useUserStore.getState();
      
      if (!currentTask || !user) return;
      
      try {
        const sessionId = await workSessionService.createActiveSession(
          currentTask.id,
          currentTask.projectId,
          user.uid,
          mode === 'pomodoro' ? 'pomodoro' : mode
        );
        
        const activeSession: ActiveSession = {
          sessionId,
          taskId: currentTask.id,
          startTime: new Date(),
          lastUpdateTime: new Date(),
          status: 'active'
        };
        
        // Track the timer position when this session started
        set({ 
          activeSession,
          sessionStartTimerPosition: currentTime
        });
        
        console.log('Created new session:', {
          sessionId,
          taskId: currentTask.id,
          startTimerPosition: currentTime,
          timer_display: `${Math.floor(currentTime / 60)}:${String(currentTime % 60).padStart(2, '0')}`
        });
      } catch (error) {
        console.error('Failed to create active session:', error);
      }
    },
    
    updateActiveSession: async () => {
      const { activeSession, sessionStartTimerPosition, currentTime } = get();
      
      if (!activeSession || sessionStartTimerPosition === null) return;
      
      try {
        // Calculate timer minute boundaries crossed since session started
        const sessionStartMinute = Math.floor(sessionStartTimerPosition / 60);
        const currentMinute = Math.floor(currentTime / 60);
        const minutesCrossed = sessionStartMinute - currentMinute;
        
        // Debug logging to see what's happening
        console.log('Session update debug:', {
          sessionStartTimerPosition,
          sessionStartMinute,
          currentTime,
          currentMinute,
          minutesCrossed,
          timer_display: `${Math.floor(currentTime / 60)}:${String(currentTime % 60).padStart(2, '0')}`
        });
        
        // Only update if we have crossed timer minute boundaries
        if (minutesCrossed > 0) {
          await workSessionService.updateSession(activeSession.sessionId, {
            duration: minutesCrossed
          });
          
          // Update last update time locally
          set({
            activeSession: {
              ...activeSession,
              lastUpdateTime: new Date()
            }
          });
        }
      } catch (error) {
        console.error('Failed to update active session:', error);
      }
    },
    
    // New method: Switch session - only update status, don't recalculate duration
    switchActiveSession: async () => {
      const { activeSession } = get();
      
      if (!activeSession) return;
      
      try {
        // Only update status to 'switched', keep existing duration
        const updates: Partial<Pick<WorkSession, 'status' | 'endTime' | 'notes'>> = {
          status: 'switched',
          endTime: new Date(),
          notes: 'Task switched'
        };
        
        await workSessionService.updateSession(activeSession.sessionId, updates);
        
        set({ activeSession: null });
      } catch (error) {
        console.error('Failed to switch active session:', error);
      }
    },
    
    completeActiveSession: async (status: 'completed' | 'paused' | 'switched') => {
      const { activeSession, sessionStartTimerPosition, currentTime } = get();
      
      if (!activeSession) return;
      
      try {
        // Calculate final duration based on timer minute boundaries crossed
        let minutesCrossed = 0;
        if (sessionStartTimerPosition !== null) {
          const sessionStartMinute = Math.floor(sessionStartTimerPosition / 60);
          const currentMinute = Math.floor(currentTime / 60);
          minutesCrossed = Math.max(0, sessionStartMinute - currentMinute);
        }
        
        const updates: Partial<Pick<WorkSession, 'duration' | 'status' | 'endTime' | 'notes'>> = {
          status,
          endTime: new Date(),
          notes: `Session ${status}: ${minutesCrossed}m`,
          duration: minutesCrossed
        };
        
        await workSessionService.updateSession(activeSession.sessionId, updates);
        
        set({ 
          activeSession: null,
          sessionStartTimerPosition: null
        });
      } catch (error) {
        console.error('Failed to complete active session:', error);
      }
    },
    
    cleanupOrphanedSessions: async () => {
      const { user } = useUserStore.getState();
      
      if (!user) return;
      
      try {
        const cleanedCount = await workSessionService.cleanupOrphanedSessions(user.uid);
        console.log(`Cleaned up ${cleanedCount} orphaned sessions`);
      } catch (error) {
        console.error('Failed to cleanup orphaned sessions:', error);
      }
    },
    
    // Persistence methods
    initializePersistence: async (userId: string) => {
      try {
        set({ isLoading: true, syncError: null });
        
        // Cleanup orphaned sessions first
        await get().cleanupOrphanedSessions();
        
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
        
        // Build timer data object
        const timerData: Partial<TimerStateModel> = {
          currentTime: state.currentTime,
          totalTime: state.totalTime,
          mode: state.mode,
          sessionsCompleted: state.sessionsCompleted,
          isRunning: state.isRunning,
          currentTaskId: state.currentTask ? state.currentTask.id : null,
        };
        
        // Include session start time if there's an active session
        if (state.activeSession) {
          timerData.sessionStartTime = state.activeSession.startTime;
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
        syncError: null,
        activeSession: null,
        sessionStartTimerPosition: null
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
        activeSession: null,
        sessionStartTimerPosition: null,
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
