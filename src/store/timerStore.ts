import { create } from 'zustand';
import { DEFAULT_SETTINGS, Task, type TimerMode, type TimerSettings, type TimerState as TimerStateModel, type ActiveSession, type WorkSession } from '../types/models';
import { useTaskStore } from './taskStore';
import { useUserStore } from './userStore';
import { timerService } from '../api/timerService';
import { workSessionService } from '../api/workSessionService';
import { transitionQueryService } from '../services/transitionService';
import { getDateISOString } from '../utils/timeUtils';
import { trackPomodoroStarted, trackPomodoroCompleted } from '../utils/analytics';

interface TimerState {
  // Timer status
  isRunning: boolean;
  currentTime: number; // seconds remaining
  totalTime: number; // total seconds for current session
  mode: TimerMode;
  sessionsCompleted: number;
  enableStartPauseBtn: boolean; // Whether to enable start/pause button
  
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
  switchToNextPomodoroTask: (nextTask: Task) => Promise<void>;
  cleanupOrphanedSessions: () => Promise<void>;
  
  // Persistence actions
  initializePersistence: (userId: string) => Promise<void>;
  saveToDatabase: () => Promise<void>;
  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => void;
  syncFromRemoteState: (remoteState: TimerStateModel) => Promise<void>;
  cleanupPersistence: () => void;
  resetTimerState: () => void;
  setEnableStartPauseBtn: (enable: boolean) => void;

  // Add new fields for task persistence
  taskLoadRetryCount: number;
  isTaskLoading: boolean;
  taskLoadError: string | null;
}

export const useTimerStore = create<TimerState>((set, get) => {
  // Helper function to find task by ID with retry
  const findTaskWithRetry = async (taskId: string, maxRetries = 3): Promise<Task | null> => {
    const taskStore = useTaskStore.getState();
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      const task = taskStore.tasks.find(t => t.id === taskId);
      if (task) return task;
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      retryCount++;
    }
    
    return null;
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
    enableStartPauseBtn: true,
    
    // Persistence state
    isLoading: false,
    isSyncing: false,
    lastSyncTime: null,
    isActiveDevice: true,
    syncError: null,
    
    // Add new fields for task persistence
    taskLoadRetryCount: 0,
    isTaskLoading: false,
    taskLoadError: null,
    
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
      get().saveToLocalStorage();
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
      get().saveToLocalStorage();
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
      get().saveToLocalStorage();
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

      // Handle minute boundary crossing for task time tracking
      if (activeSession && mode === 'pomodoro') {
        const currentMinute = Math.floor(currentTime / 60);
        
        if (lastCountedMinute !== null && lastCountedMinute !== currentMinute && currentMinute < lastCountedMinute) {
          // We've crossed a minute boundary (time decreased from one minute to the next)
          console.log('Minute boundary crossed:', {
            from: lastCountedMinute,
            to: currentMinute,
            sessionId: activeSession.sessionId,
            taskId: activeSession.taskId
          });
          
          // Update active session duration in database
          get().updateActiveSession();
          
          // Increment task time spent locally
          if (activeSession.taskId) {
            timeSpentIncrement(activeSession.taskId, 1);
          }
        }
        
        // Update the last counted minute
        if (lastCountedMinute === null || lastCountedMinute !== currentMinute) {
          set({ lastCountedMinute: currentMinute });
        }
      }

      if (currentTime > 0) {
        set({ currentTime: currentTime - 1 });
        // 🔥 COST OPTIMIZATION: Save to localStorage every second, cloud every 1 minute
        get().saveToLocalStorage();
        
        // Only save to database every 60 seconds (1 minute) to reduce costs by 98.3%
        if (currentTime % 60 === 0) {
          get().saveToDatabase();
        }
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
      get().saveToLocalStorage();
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
      
      get().saveToDatabase();
      get().saveToLocalStorage();
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
        // Use transition service to create session (routes to UTC or legacy based on feature flags)
        const sessionId = await transitionQueryService.createSession({
          userId: user.uid,
          taskId: currentTask.id,
          projectId: currentTask.projectId,
          duration: 0, // Start with 0 duration
          sessionType: mode, // 'pomodoro', 'shortBreak', 'longBreak'
          status: 'active',
          notes: `${mode} session started`
        });
        
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
        
        console.log('Created new session via transition service:', {
          sessionId,
          taskId: currentTask.id,
          startTimerPosition: currentTime,
          startMinute: currentMinute,
          timer_display: `${Math.floor(currentTime / 60)}:${String(currentTime % 60).padStart(2, '0')}`,
          sessionType: mode,
          service: 'TransitionQueryService' // ✅ Now using UTC-aware service
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
        await workSessionService.incrementDuration(activeSession.sessionId, 1);
        
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
      const { activeSession, lastCountedMinute, currentTime } = get();
      
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
        
        // First, increment any remaining uncounted minutes
        if (remainingMinutes > 0) {
          await workSessionService.incrementDuration(activeSession.sessionId, remainingMinutes);
        }
        
        // Then update status and end time
        const updates: Partial<Pick<WorkSession, 'status' | 'endTime' | 'notes'>> = {
          status,
          endTime: new Date(),
          notes: `Session ${status}${remainingMinutes > 0 ? `: +${remainingMinutes}m remaining` : ''}`,
        };
        
        await workSessionService.updateSession(activeSession.sessionId, updates);
        
        set({ 
          activeSession: null,
          sessionStartTimerPosition: null,
          lastCountedMinute: null
        });
        
        console.log('Session completed:', {
          sessionId: activeSession.sessionId,
          status,
          remainingMinutes
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
        
        // Load from localStorage immediately
        await get().loadFromLocalStorage();
        
        // Initialize task store in background
        const taskStore = useTaskStore.getState();
        if (taskStore.tasks.length === 0) {
          taskStore.initializeStore().catch(error => {
            console.warn('Background task store initialization failed:', error);
          });
        }
        
        // Cleanup orphaned sessions in background
        get().cleanupOrphanedSessions().catch(error => {
          console.warn('Background cleanup failed:', error);
        });
        
        // Only sync from remote every 5 minutes or on app start
        const lastRemoteSync = localStorage.getItem('lastRemoteSync');
        const shouldSyncFromRemote = !lastRemoteSync || 
          (Date.now() - parseInt(lastRemoteSync)) > 5 * 60 * 1000; // 5 minutes
        
        if (shouldSyncFromRemote) {
          // Sync in background
          timerService.loadTimerState(userId).then(remoteState => {
            if (remoteState) {
              get().syncFromRemoteState(remoteState);
            }
            localStorage.setItem('lastRemoteSync', Date.now().toString());
          }).catch(error => {
            console.warn('Background remote sync failed:', error);
            set({ syncError: 'Failed to sync timer state' });
          });
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
        
        // Include session data for calculating work time during reload
        if (state.activeSession) {
          timerData.sessionStartTime = state.activeSession.startTime;
          timerData.activeSessionId = state.activeSession.sessionId;
          timerData.sessionStartTimerPosition = state.sessionStartTimerPosition;
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
    
    saveToLocalStorage: () => {
      const state = get();
      const timerData = {
        currentTime: state.currentTime,
        totalTime: state.totalTime,
        mode: state.mode,
        sessionsCompleted: state.sessionsCompleted,
        isRunning: state.isRunning,
        currentTaskId: state.currentTask?.id || null,
        lastSaveTime: new Date().toISOString(),
        activeSession: state.activeSession,
        sessionStartTimerPosition: state.sessionStartTimerPosition,
        // Add task details for better recovery
        currentTaskDetails: state.currentTask ? {
          id: state.currentTask.id,
          title: state.currentTask.title,
          projectId: state.currentTask.projectId,
          timeSpent: state.currentTask.timeSpent,
          timeEstimated: state.currentTask.timeEstimated,
        } : null,
      };
      
      try {
        localStorage.setItem('timerState', JSON.stringify(timerData));
      } catch (error) {
        console.error('Failed to save to localStorage:', error);
      }
    },
    
    loadFromLocalStorage: async () => {
      const state = get();
      const timerData = localStorage.getItem('timerState');
      
      if (timerData) {
        try {
          set({ isTaskLoading: true, taskLoadError: null });
          const parsedData = JSON.parse(timerData);
          
          // First set the basic timer state
          set({
            currentTime: parsedData.currentTime,
            totalTime: parsedData.totalTime,
            mode: parsedData.mode,
            sessionsCompleted: parsedData.sessionsCompleted,
            isRunning: parsedData.isRunning,
            activeSession: parsedData.activeSession,
            sessionStartTimerPosition: parsedData.sessionStartTimerPosition,
          });
          
          // Immediately set task from cached details for instant loading
          if (parsedData.currentTaskDetails) {
            set({ 
              currentTask: {
                ...parsedData.currentTaskDetails,
                completed: false,
                status: 'pomodoro',
                userId: useUserStore.getState().user?.uid || '',
                createdAt: new Date(),
                updatedAt: new Date(),
                order: 0,
              } as Task,
              isTaskLoading: false
            });
            
            // Then verify task in background
            if (parsedData.currentTaskId) {
              findTaskWithRetry(parsedData.currentTaskId, 1).then(task => {
                if (task) {
                  set({ currentTask: task });
                }
              }).catch(error => {
                console.warn('Background task verification failed:', error);
              });
            }
          } else {
            set({ isTaskLoading: false });
          }
        } catch (error) {
          console.error('Failed to parse timer state from localStorage:', error);
          set({ 
            isTaskLoading: false,
            taskLoadError: 'Failed to load saved timer state' 
          });
        }
      }
    },
    
    syncFromRemoteState: async (remoteState: TimerStateModel) => {
      const currentTaskId = remoteState.currentTaskId || null;
      const currentTask = currentTaskId
        ? useTaskStore.getState().tasks.find(task => task.id === currentTaskId) || null
        : null;
      
      // First, set the basic timer state
      set({
        ...remoteState,
        currentTask: currentTask,
        activeSession: null, // Will be created fresh if needed
        sessionStartTimerPosition: null,
        lastCountedMinute: null,
      });
      
      // If timer is running and we have a task, resume the existing session or create a new one
      if (remoteState.isRunning && currentTask && remoteState.mode === 'pomodoro') {
        try {
          // Check for existing active session
          if (remoteState.activeSessionId) {
            const { user } = useUserStore.getState();
            if (user) {
              const activeSessions = await workSessionService.getActiveSessions(user.uid);
              const existingSession = activeSessions.find(session => 
                session.id === remoteState.activeSessionId && 
                session.status === 'active'
              );
              
              if (existingSession) {
                // Resume existing session without recalculation
                console.log('Resuming existing session:', {
                  sessionId: existingSession.id,
                  duration: existingSession.duration,
                  reason: 'page reload'
                });
                return; // Keep using existing session
              }
            }
          }
          
          // Only create new session if no active one exists
          await get().createActiveSession();
          
          console.log('Created new session:', {
            taskId: currentTask.id,
            reason: 'no active session found'
          });
          
        } catch (error) {
          console.error('Failed to handle session during page reload:', error);
        }
      }
    },
    
    cleanupPersistence: () => {
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
    },

    setEnableStartPauseBtn: (enable: boolean) => {
      set({ enableStartPauseBtn: enable });
    },

    switchToNextPomodoroTask: async (nextTask: Task) => {
      const { mode, sessionsCompleted, settings, currentTask, activeSession } = get();
      
      console.log('switchToNextPomodoroTask called:', {
        nextTaskId: nextTask.id,
        nextTaskTitle: nextTask.title,
        currentTaskId: currentTask?.id,
        currentTaskTitle: currentTask?.title,
        mode,
        hasActiveSession: !!activeSession
      });
      
      if (mode === 'pomodoro' && currentTask && nextTask.id !== currentTask.id) {
        // Complete current active session
        if (activeSession) {
          console.log('Completing current session:', activeSession.sessionId);
          await get().completeActiveSession('completed');
        }
        
        // Set new task and clear session tracking for fresh start
        console.log('Setting new current task:', nextTask.title);
        set({ 
          currentTask: nextTask,
          sessionStartTimerPosition: null, // Will be set when new session is created
          lastCountedMinute: null // Reset minute tracking for new task
        });
        
        // Create new active session for new task
        console.log('Creating new session for task:', nextTask.title);
        await get().createActiveSession();
      } else {
        console.log('Skipping task switch - conditions not met');
      }
      
      get().saveToDatabase();
    },
  };
});

// Subscribe to user authentication changes
useUserStore.subscribe(async (state) => {
  const timerStore = useTimerStore.getState();
  
  // CRITICAL: Only react to auth changes after user store is initialized
  // This prevents cleanup during Firebase auth restoration on page reload
  if (!state.isInitialized) {
    console.log('TimerStore - User store not initialized yet, waiting...');
    return;
  }
  
  console.log('TimerStore - User state changed:', {
    isAuthenticated: state.isAuthenticated,
    hasUser: !!state.user,
    isLoading: state.isLoading,
    isInitialized: state.isInitialized
  });
  
  if (state.isAuthenticated && state.user && !state.isLoading) {
    // User logged in, initialize timer store with persistence
    console.log('TimerStore - User authenticated, initializing persistence...');
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
    console.log('TimerStore - User not authenticated, cleaning up...');
    timerStore.cleanupPersistence();
    timerStore.resetTimerState();
  }
});
