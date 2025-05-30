import { create } from 'zustand';
import { DEFAULT_SETTINGS, type TimerMode, type TimerSettings, type TimerState as TimerStateModel } from '../types/models';
import { useTaskStore } from './taskStore';
import { useUserStore } from './userStore';
import { useWorkSessionStore } from './useWorkSessionStore';
import { timerService } from '../api/timerService';
import { calculateElapsedTime } from '../utils/timeUtils';

interface TimerState {
  // Timer status
  isRunning: boolean;
  currentTime: number; // seconds remaining
  totalTime: number; // total seconds for current session
  mode: TimerMode;
  sessionsCompleted: number;
  
  // Current task
  currentTaskId: string | null;
  
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
  setCurrentTaskId: (taskId: string | null) => void;
  setSettings: (settings: TimerSettings) => void;
  
  // Persistence actions
  initializePersistence: (userId: string) => Promise<void>;
  saveToDatabase: () => Promise<void>;
  loadFromDatabase: (userId: string) => Promise<void>;
  handleRemoteStateChange: (remoteState: TimerStateModel) => void;
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
    }, 2000); // Save after 2 seconds of inactivity
  };

  return {
    // Initial state
    isRunning: false,
    currentTime: DEFAULT_SETTINGS.timer.pomodoro * 60, // convert to seconds
    totalTime: DEFAULT_SETTINGS.timer.pomodoro * 60,
    mode: 'pomodoro',
    sessionsCompleted: 0,
    currentTaskId: null,
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
      }
      
      set({ 
        isRunning: true,
        syncError: null 
      });
      
      // Save immediately when starting
      get().saveToDatabase();
    },
    
    pause: () => {
      const currentState = get();
      const { user } = useUserStore.getState();
      const { createWorkSession } = useWorkSessionStore.getState();
      const { tasks } = useTaskStore.getState();
      
      console.log('⏸️ Timer pause called:', {
        mode: currentState.mode,
        currentTaskId: currentState.currentTaskId,
        sessionStartTime,
        user: user?.uid,
        timeSpentInSession: currentState.totalTime - currentState.currentTime
      });
      
      // Create work session if pausing during a pomodoro with a current task and meaningful time spent
      if (currentState.mode === 'pomodoro' && currentState.currentTaskId && sessionStartTime && user) {
        const timeSpentInSession = currentState.totalTime - currentState.currentTime; // in seconds
        const durationInMinutes = Math.round(timeSpentInSession / 60);
        
        console.log('📊 Pause - checking duration:', {
          timeSpentInSession,
          durationInMinutes,
          threshold: 1
        });
        
        // Only create session if meaningful time spent (at least 1 minute)
        if (durationInMinutes >= 1) {
          const task = tasks.find(t => t.id === currentState.currentTaskId);
          if (task) {
            const endTime = new Date();
            
            console.log('📊 Creating WorkSession from pause:', {
              taskId: currentState.currentTaskId,
              task: task.title,
              duration: durationInMinutes
            });
            
            createWorkSession({
              userId: user.uid,
              taskId: currentState.currentTaskId,
              projectId: task.projectId,
              startTime: sessionStartTime,
              endTime: endTime,
              duration: durationInMinutes,
              sessionType: 'pomodoro',
              notes: `Pomodoro session paused`
            }).then(() => {
              console.log('✅ WorkSession created from pause');
            }).catch(error => {
              console.error('❌ Failed to create work session from pause:', error);
            });
          }
        } else {
          console.log('⚠️ Not creating WorkSession - duration too short:', durationInMinutes, 'minutes');
        }
      } else {
        console.log('⚠️ WorkSession NOT created from pause. Conditions not met:', {
          isPomodoroMode: currentState.mode === 'pomodoro',
          hasCurrentTask: !!currentState.currentTaskId,
          hasSessionStartTime: !!sessionStartTime,
          hasUser: !!user
        });
      }
      
      sessionStartTime = null; // Clear session start time when paused
      
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
      const { mode, sessionsCompleted, settings, currentTaskId } = get();
      const { user } = useUserStore.getState();
      const { createWorkSession } = useWorkSessionStore.getState();
      const { tasks } = useTaskStore.getState();
      
      console.log('🔍 Timer skip called:', {
        mode,
        currentTaskId,
        sessionStartTime,
        user: user?.uid,
        hasCreateWorkSession: !!createWorkSession
      });
      
      // Create work session if completing a pomodoro and we have a current task
      if (mode === 'pomodoro' && currentTaskId && sessionStartTime && user) {
        const task = tasks.find(t => t.id === currentTaskId);
        console.log('📊 Creating WorkSession:', {
          taskId: currentTaskId,
          task: task?.title,
          startTime: sessionStartTime,
          duration: Math.round((new Date().getTime() - sessionStartTime.getTime()) / (1000 * 60))
        });
        
        if (task) {
          const endTime = new Date();
          const duration = Math.round((endTime.getTime() - sessionStartTime.getTime()) / (1000 * 60)); // duration in minutes
          
          // Create work session
          createWorkSession({
            userId: user.uid,
            taskId: currentTaskId,
            projectId: task.projectId,
            startTime: sessionStartTime,
            endTime: endTime,
            duration: duration,
            sessionType: 'pomodoro',
            notes: `Pomodoro session completed`
          }).then(() => {
            console.log('✅ WorkSession created successfully');
          }).catch(error => {
            console.error('❌ Failed to create work session:', error);
          });
        }
      } else {
        console.log('⚠️ WorkSession NOT created. Conditions not met:', {
          isPomodoroMode: mode === 'pomodoro',
          hasCurrentTask: !!currentTaskId,
          hasSessionStartTime: !!sessionStartTime,
          hasUser: !!user
        });
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
      }
      
      get().saveToDatabase();
    },
    
    tick: () => {
      const { currentTime, totalTime, isActiveDevice } = get();
      
      // Only tick if this is the active device
      if (!isActiveDevice) return;

      const { timeSpentIncrement } = useTaskStore.getState();

      // Continue to increment task.timeSpent for backward compatibility
      // while also creating WorkSession records for date-aware tracking
      if (currentTime !== totalTime && currentTime % 60 === 0) {
        // Increment time spent for the current task every minute
        const { currentTaskId } = get();
        if (currentTaskId) {
          timeSpentIncrement(currentTaskId, 1); // increment by 1 minute
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
    
    setCurrentTaskId: (taskId: string | null) => {
      set({ currentTaskId: taskId });
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
          get().handleRemoteStateChange(remoteState);
        } else {
          // No existing state, save current default state
          await get().saveToDatabase();
        }
        
        // Subscribe to real-time updates
        timerService.subscribeToTimerState(userId, (remoteState) => {
          if (remoteState) {
            get().handleRemoteStateChange(remoteState);
          }
        });
        
        set({ isLoading: false });
      } catch (error) {
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
        const timerData: any = {
          currentTime: state.currentTime,
          totalTime: state.totalTime,
          mode: state.mode,
          sessionsCompleted: state.sessionsCompleted,
          isRunning: state.isRunning,
          currentTaskId: state.currentTaskId,
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
        set({ 
          isSyncing: false, 
          syncError: 'Failed to save timer state' 
        });
      }
    },
    
    loadFromDatabase: async (userId: string) => {
      try {
        const remoteState = await timerService.loadTimerState(userId);
        
        if (remoteState) {
          get().handleRemoteStateChange(remoteState);
        }
      } catch (error) {
        throw error;
      }
    },
    
    handleRemoteStateChange: (remoteState: TimerStateModel) => {
      const currentState = get();
      const isFromThisDevice = timerService.isActiveDevice(remoteState);
      
      // Skip if we're getting our own state back and it's not more recent
      if (isFromThisDevice && currentState.lastSyncTime && remoteState.lastUpdated) {
        const localTime = currentState.lastSyncTime.getTime();
        const remoteTime = remoteState.lastUpdated.getTime();
        
        // Skip if our local state is more recent (within 1 second tolerance)
        if (localTime > remoteTime - 1000) {
          return;
        }
      }
      
      // Calculate the actual current time based on running state
      let adjustedCurrentTime = remoteState.currentTime;
      let shouldBeRunning = remoteState.isRunning;
      
      if (remoteState.isRunning && remoteState.sessionStartTime && remoteState.lastUpdated) {
        // Timer is running - calculate elapsed time and adjust
        const elapsedTime = calculateElapsedTime(remoteState.sessionStartTime, remoteState.lastUpdated);
        adjustedCurrentTime = Math.max(0, remoteState.currentTime - elapsedTime);
        
        // If timer has run out, it should be stopped
        if (adjustedCurrentTime <= 0) {
          shouldBeRunning = false;
        }
        
        // Restore session start time if this device is taking control of a running timer
        if (isFromThisDevice && shouldBeRunning) {
          sessionStartTime = remoteState.sessionStartTime;
        }
      } else {
        // Timer is paused or stopped - use exact saved time without adjustment
        adjustedCurrentTime = remoteState.currentTime;
        shouldBeRunning = false; // Ensure paused timers stay paused
        // Clear session start time since timer is not running
        sessionStartTime = null;
      }
      
      // Update local state with remote state
      set({
        currentTime: adjustedCurrentTime,
        totalTime: remoteState.totalTime,
        mode: remoteState.mode,
        sessionsCompleted: remoteState.sessionsCompleted,
        isRunning: shouldBeRunning, // Use calculated running state
        currentTaskId: remoteState.currentTaskId,
        isActiveDevice: isFromThisDevice,
        lastSyncTime: new Date(),
        syncError: null
      });
    },
    
    cleanupPersistence: () => {
      timerService.unsubscribeFromTimerState();
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
        currentTaskId: null,
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

// Also check if user is already authenticated on store creation
const userState = useUserStore.getState();
if (userState.isAuthenticated && userState.user && !userState.isLoading) {
  const timerStore = useTimerStore.getState();
  const user = userState.user; // Store user reference to avoid null check issues
  
  // Initialize persistence asynchronously FIRST
  timerStore.initializePersistence(user.uid)
    .then(() => {
      // THEN set settings after loading existing state
      timerStore.setSettings(user.settings.timer);
    })
    .catch((error) => {
      console.error('Failed to initialize timer persistence on store creation:', error);
    });
}
