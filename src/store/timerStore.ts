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
  lastCountedMinute: number | null; // Last minute boundary where time was incremented
  
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
    lastCountedMinute: null,
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
        lastCountedMinute: null,
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
        lastCountedMinute: null,
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
      const { currentTime, totalTime, isActiveDevice, isRunning, activeSession, lastCountedMinute, mode } = get();
      
      // Only tick if this is the active device and timer is running
      if (!isActiveDevice || !isRunning) return;

      const { timeSpentIncrement } = useTaskStore.getState();

      // Check if we have an active session and we've crossed a new minute boundary
      if (activeSession && currentTime !== totalTime) {
        const { currentTask } = get();
        const currentMinute = Math.floor(currentTime / 60);
        
        // Initialize lastCountedMinute if this is the first tick of the session
        if (lastCountedMinute === null) {
          // Set initial lastCountedMinute based on currentTime
          // We want to count the first minute boundary we cross, not the current minute
          set({ lastCountedMinute: currentMinute });
        } else if (currentMinute < lastCountedMinute) {
          // We've crossed a minute boundary! (timer counts down, so currentMinute decreases)
          const minutesBoundariesCrossed = lastCountedMinute - currentMinute;
          
          console.log('Timer minute boundary crossed:', {
            lastCountedMinute,
            currentMinute,
            minutesBoundariesCrossed,
            currentTime,
            currentTask: currentTask?.title,
            mode,
            timer_display: `${Math.floor(currentTime / 60)}:${String(currentTime % 60).padStart(2, '0')}`
          });
          
          // Always update session duration for any session type
          if (minutesBoundariesCrossed > 0) {
            // Update active session duration
            get().updateActiveSession();
            
            // Update the last counted minute to the current minute
            set({ lastCountedMinute: currentMinute });
            
            // Only increment task time spent for pomodoro sessions
            if (mode === 'pomodoro' && currentTask) {
              timeSpentIncrement(currentTask.id, minutesBoundariesCrossed);
            }
          }
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
        lastCountedMinute: null,
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
          sessionStartTimerPosition: null, // Will be set when new session is created
          lastCountedMinute: null // Reset minute tracking for new task
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
          mode // Pass the mode directly as the session type
        );
        
        const activeSession: ActiveSession = {
          sessionId,
          taskId: currentTask.id,
          startTime: new Date(),
          lastUpdateTime: new Date(),
          status: 'active'
        };
        
        // Track the timer position when this session started and initialize minute tracking
        const currentMinute = Math.floor(currentTime / 60);
        set({ 
          activeSession,
          sessionStartTimerPosition: currentTime,
          lastCountedMinute: null // Will be set on first tick
        });
        
        console.log('Created new session:', {
          sessionId,
          taskId: currentTask.id,
          startTimerPosition: currentTime,
          startMinute: currentMinute,
          timer_display: `${Math.floor(currentTime / 60)}:${String(currentTime % 60).padStart(2, '0')}`,
          sessionType: mode
        });
      } catch (error) {
        console.error('Failed to create active session:', error);
      }
    },
    
    updateActiveSession: async () => {
      const { activeSession } = get();
      
      if (!activeSession) return;
      
      try {
        // With the new approach, we increment duration by 1 for each minute boundary crossed
        // This function is called when a minute boundary is detected in the tick function
        await workSessionService.updateSession(activeSession.sessionId, {
          duration: 1 // Always increment by 1 minute when called
        });
        
        // Update last update time locally
        set({
          activeSession: {
            ...activeSession,
            lastUpdateTime: new Date()
          }
        });
        
        console.log('Session updated: +1 minute', {
          sessionId: activeSession.sessionId,
          lastUpdateTime: new Date()
        });
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
        
        set({ 
          activeSession: null,
          lastCountedMinute: null // Reset minute tracking when switching
        });
      } catch (error) {
        console.error('Failed to switch active session:', error);
      }
    },
    
    completeActiveSession: async (status: 'completed' | 'paused' | 'switched') => {
      const { activeSession, lastCountedMinute, currentTime, mode } = get();
      
      if (!activeSession) return;
      
      try {
        // Calculate any remaining partial minute if we're in the middle of a minute
        let remainingMinutes = 0;
        if (lastCountedMinute !== null) {
          const currentMinute = Math.floor(currentTime / 60);
          if (currentMinute < lastCountedMinute) {
            // We have some partial minute that hasn't been counted yet
            remainingMinutes = lastCountedMinute - currentMinute;
          }
        }
        
        const updates: Partial<Pick<WorkSession, 'duration' | 'status' | 'endTime' | 'notes'>> = {
          status,
          endTime: new Date(),
          notes: `${mode} session ${status}${remainingMinutes > 0 ? `: +${remainingMinutes}m remaining` : ''}`
        };
        
        // Add remaining duration for any session type
        if (remainingMinutes > 0) {
          updates.duration = remainingMinutes;
        }
        
        await workSessionService.updateSession(activeSession.sessionId, updates);
        
        // Only update task time spent for pomodoro sessions
        if (mode === 'pomodoro' && remainingMinutes > 0) {
          const { currentTask } = get();
          if (currentTask) {
            const { timeSpentIncrement } = useTaskStore.getState();
            timeSpentIncrement(currentTask.id, remainingMinutes);
          }
        }
        
        set({ 
          activeSession: null,
          sessionStartTimerPosition: null,
          lastCountedMinute: null
        });
        
        console.log(`${mode} session completed:`, {
          sessionId: activeSession.sessionId,
          status,
          remainingMinutes,
          mode
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
        sessionStartTimerPosition: null,
        lastCountedMinute: null
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
        lastCountedMinute: null,
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
