import { create } from 'zustand';
import { DEFAULT_SETTINGS, Task, type TimerMode, type TimerSettings, type TimerState as TimerStateModel, type ActiveSession, type WorkSession } from '../types/models';
import { useTaskStore } from './taskStore';
import { useUserStore } from './userStore';
import { timerService } from '../api/timerService';
import { workSessionService } from '../api/workSessionService';
import { transitionQueryService } from '../services/transitionService';
import { getDateISOString } from '../utils/timeUtils';
import { trackPomodoroStarted, trackPomodoroCompleted } from '../utils/analytics';
import { resetUTCMonitoring } from '../utils/resetMonitoring';

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
  
  // Retry functions for non-blocking operations
  createSessionWithRetry: (attempt: number) => Promise<void>;
  completeSessionWithRetry: (sessionId: string, attempt: number) => Promise<void>;
  switchTaskWithRetry: (oldSession: any, newTask: Task, attempt: number) => Promise<void>;
  
  // Persistence actions
  initializePersistence: (userId: string) => Promise<void>;
  saveToDatabase: () => Promise<void>;
  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => void;
  syncFromRemoteState: (remoteState: TimerStateModel) => Promise<void>;
  cleanupPersistence: () => void;
  resetTimerState: () => void;
  setEnableStartPauseBtn: (enable: boolean) => void;
  
  // Utility actions
  resetMonitoring: () => void;

  // Add new fields for task persistence
  taskLoadRetryCount: number;
  isTaskLoading: boolean;
  taskLoadError: string | null;
}

// Add recovery flag to prevent race conditions
let isRecoveringSession = false;

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
    start: () => {
      const state = get();
      if (!state.isActiveDevice) {
        // If not active device, take control
        set({ isActiveDevice: true });
      }
      
      // ✅ INSTANT UI UPDATE - No more blocking!
      set({ 
        isRunning: true,
        syncError: null 
      });
      
      // Track Pomodoro start in Analytics
      if (state.mode === 'pomodoro' && state.currentTask) {
        trackPomodoroStarted(state.currentTask.id, state.currentTask.timeEstimated || 0);
      }
      
      // Create active session in background with retry
      if (!state.isRunning && state.currentTask) {
        get().createSessionWithRetry(1)
          .then(() => {
            console.log('✅ Session created successfully');
          })
          .catch(error => {
            console.error('❌ All retries failed, stopping timer:', error);
            set({ 
              isRunning: false, 
              syncError: 'Session creation failed - timer stopped'
            });
          });
      }
      
      // Save immediately when starting
      get().saveToDatabase();
      get().saveToLocalStorage();
    },
    
    pause: () => {
      const state = get();
      console.log('🛑 PAUSE FUNCTION CALLED - state before:', {
        isRunning: state.isRunning,
        timestamp: new Date().toISOString()
      });
      
      // ✅ INSTANT UI UPDATE - No more blocking!
      set({ isRunning: false });
      
      // Verify state change immediately
      const newState = get();
      console.log('🛑 PAUSE FUNCTION - state after set:', {
        isRunning: newState.isRunning,
        timestamp: new Date().toISOString()
      });
      
      // Complete active session in background with retry
      if (state.activeSession) {
        get().completeSessionWithRetry(state.activeSession.sessionId, 1)
          .then(() => {
            console.log('✅ Session completed successfully');
          })
          .catch(error => {
            console.error('❌ Session completion failed after retries (non-critical):', error);
            // Don't restart timer - just log the failure
          });
      }
      
      // Save immediately when pausing to capture exact time
      // IMPORTANT: Save functions should NOT modify isRunning state
      get().saveToDatabase().catch(error => {
        console.error('Save to database failed:', error);
      });
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
      const { currentTime, totalTime, isActiveDevice, isRunning, activeSession, lastCountedMinute, mode, currentTask } = get();
      
      // Only tick if this is the active device and timer is running
      if (!isActiveDevice || !isRunning) return;

      // 🛡️ IMPROVED SAFETY NET (Agent 2's race condition fixed)
      if (isRunning && mode === 'pomodoro' && currentTask && !activeSession && !isRecoveringSession) {
        console.error('⚠️ Active session lost - starting recovery (once)');
        isRecoveringSession = true; // Prevent multiple attempts
        
        get().createActiveSession().then(() => {
          const currentMinute = Math.floor(get().currentTime / 60);
          // Don't override lastCountedMinute - let boundary detection work naturally
          console.log('✅ Session recovered, resuming at minute:', currentMinute);
          isRecoveringSession = false;
        }).catch(error => {
          console.error('❌ Session recovery failed:', error);
          isRecoveringSession = false;
          // Could add retry logic here if needed
        });
        return; // Skip this tick
      }

      // If we're still recovering, skip this tick
      if (isRecoveringSession) return;

      const { timeSpentIncrement } = useTaskStore.getState();

      // Handle minute boundary crossing for task time tracking
      if (activeSession && mode === 'pomodoro') {
        const currentMinute = Math.floor(currentTime / 60);
        
        if (lastCountedMinute !== null && currentMinute < lastCountedMinute) {
          // We've crossed a minute boundary (time decreased from one minute to the next)
          console.log('🔄 Minute boundary:', {
            from: lastCountedMinute,
            to: currentMinute,
            sessionId: activeSession.sessionId,
            deviceId: timerService.getDeviceId()
          });
          
          // Update active session duration in database
          get().updateActiveSession().catch(error => {
            console.error('❌ updateActiveSession FAILED:', error);
          });
          
          // Increment task time spent locally
          if (activeSession.taskId) {
            timeSpentIncrement(activeSession.taskId, 1).catch(error => {
              console.error('❌ timeSpentIncrement FAILED:', error);
            });
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
    
    setCurrentTask: (task: Task | null) => {
      const state = get();
      
      // ✅ INSTANT UI UPDATE - No more blocking!
      set({ currentTask: task });
      
      // If we're switching tasks while timer is running
      if (state.isRunning && state.activeSession && state.currentTask && task && state.currentTask.id !== task.id) {
        // Handle task switching in background with retry
        get().switchTaskWithRetry(state.activeSession, task, 1)
          .then(() => {
            console.log('✅ Task switch completed successfully');
          })
          .catch(error => {
            console.error('❌ Task switch failed after retries, stopping timer:', error);
            set({ 
              isRunning: false,
              syncError: 'Task switch failed - timer stopped'
            });
          });
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
        const userTimezone = useUserStore.getState().getTimezone();
        console.log('🔍 TimerStore creating session with timezone:', userTimezone);
        const sessionId = await transitionQueryService.createSession({
          userId: user.uid,
          taskId: currentTask.id,
          projectId: currentTask.projectId,
          duration: 0, // Start with 0 duration
          sessionType: mode, // 'pomodoro', 'shortBreak', 'longBreak'
          status: 'active',
          notes: `${mode} session started`
        }, userTimezone);
        
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
        
        // Reset monitoring metrics if we're hitting too many errors
        const isDevelopment = process.env.NODE_ENV === 'development';
        if (isDevelopment) {
          setTimeout(() => {
            console.log('🔄 Resetting UTC monitoring due to session creation error...');
            get().resetMonitoring();
          }, 1000);
        }
      }
    },
    
    updateActiveSession: async () => {
      const { activeSession } = get();
      
      if (!activeSession) return;
      
      try {
        // With the new approach, we increment duration by 1 for each minute boundary crossed
        // This function is called when a minute boundary is detected in the tick function
        // Route through transition service to use UTC or legacy based on session type
        await transitionQueryService.incrementDuration(activeSession.sessionId, 1);
        
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
        
        await transitionQueryService.updateSession(activeSession.sessionId, updates);
        
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
          await transitionQueryService.incrementDuration(activeSession.sessionId, remainingMinutes);
        }
        
        // Then update status and end time
        const updates: Partial<Pick<WorkSession, 'status' | 'endTime' | 'notes'>> = {
          status,
          endTime: new Date(),
          notes: `Session ${status}${remainingMinutes > 0 ? `: +${remainingMinutes}m remaining` : ''}`,
        };
        
        await transitionQueryService.updateSession(activeSession.sessionId, updates);
        
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
          console.log('📡 Background sync starting (5-min interval)');
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
      
      // 🔧 CAPTURE CURRENT STATE BEFORE SYNC
      const currentState = get();
      
      // 🏠 DEVICE OWNERSHIP CHECK (Agent 1's valid point)
      const currentDeviceId = timerService.getDeviceId();
      const shouldYieldToRemoteDevice = remoteState.activeDeviceId && 
                                       remoteState.activeDeviceId !== currentDeviceId && 
                                       remoteState.isRunning;
      
      // 🛡️ PRESERVATION LOGIC (Enhanced)
      const shouldPreserveSession = currentState.isRunning && 
                                    currentState.activeSession && 
                                    currentState.mode === 'pomodoro' &&
                                    !shouldYieldToRemoteDevice; // Don't preserve if another device should own
      
      // 📊 DEBUG LOG
      if (shouldPreserveSession) {
        console.log('🔄 Sync preserving active session (this device owns it)');
      } else if (shouldYieldToRemoteDevice) {
        console.log('🔄 Sync yielding to remote device:', remoteState.activeDeviceId);
      }
      
      // ✅ ENHANCED STATE PRESERVATION (Agent 3's concern addressed)
      set({
        ...remoteState,
        currentTask: currentTask,
        // Preserve ALL session state when appropriate
        activeSession: shouldPreserveSession ? currentState.activeSession : null,
        sessionStartTimerPosition: shouldPreserveSession ? currentState.sessionStartTimerPosition : null,
        lastCountedMinute: shouldPreserveSession ? currentState.lastCountedMinute : null,
        // Handle device ownership
        isActiveDevice: shouldYieldToRemoteDevice ? false : currentState.isActiveDevice,
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
    
    // Reset UTC monitoring metrics (useful for development)
    resetMonitoring: () => {
      try {
        resetUTCMonitoring();
        console.log('✅ UTC monitoring reset from timer store');
      } catch (error) {
        console.error('❌ Failed to reset UTC monitoring:', error);
      }
    },

    // Retry functions for non-blocking operations
    createSessionWithRetry: async (attempt: number): Promise<void> => {
      // Check if timer still running before retry
      if (!get().isRunning) return;
      
      try {
        await get().createActiveSession();
        console.log(`✅ Session created on attempt ${attempt}`);
      } catch (error) {
        console.warn(`⚠️ Session creation attempt ${attempt} failed:`, error);
        
        if (attempt < 3 && get().isRunning) {
          // Wait 5 seconds then retry
          await new Promise(resolve => setTimeout(resolve, 5000));
          return get().createSessionWithRetry(attempt + 1);
        } else {
          throw error; // Final failure after 3 attempts
        }
      }
    },
    
    completeSessionWithRetry: async (sessionId: string, attempt: number): Promise<void> => {
      try {
        await get().completeActiveSession('paused');
        console.log(`✅ Session completed on attempt ${attempt}`);
      } catch (error) {
        console.warn(`⚠️ Session completion attempt ${attempt} failed:`, error);
        
        if (attempt < 3) {
          // Wait 5 seconds then retry
          await new Promise(resolve => setTimeout(resolve, 5000));
          return get().completeSessionWithRetry(sessionId, attempt + 1);
        } else {
          throw error; // Final failure after 3 attempts
        }
      }
    },
    
    switchTaskWithRetry: async (oldSession: any, newTask: Task, attempt: number): Promise<void> => {
      // Check if timer still running before retry
      if (!get().isRunning) return;
      
      try {
        // Switch current session (only update status, don't recalculate duration)
        await get().switchActiveSession();
        
        // Set new task and clear session tracking for fresh start
        set({ 
          sessionStartTimerPosition: null, // Will be set when new session is created
          lastCountedMinute: null // Reset minute tracking for new task
        });
        
        // Create new active session for new task
        await get().createActiveSession();
        
        console.log(`✅ Task switch completed on attempt ${attempt}`);
      } catch (error) {
        console.warn(`⚠️ Task switch attempt ${attempt} failed:`, error);
        
        if (attempt < 3 && get().isRunning) {
          // Wait 5 seconds then retry
          await new Promise(resolve => setTimeout(resolve, 5000));
          return get().switchTaskWithRetry(oldSession, newTask, attempt + 1);
        } else {
          throw error; // Final failure after 3 attempts
        }
      }
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
