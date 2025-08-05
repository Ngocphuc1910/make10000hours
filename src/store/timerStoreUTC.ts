import { create } from 'zustand';
import { workSessionServiceUTC } from '../api/workSessionServiceUTC';
import { timezoneUtils } from '../utils/timezoneUtils';
import { utcMonitoring } from '../services/monitoring';
import { utcFeatureFlags } from '../services/featureFlags';
import { useUserStore } from './userStore';
import { useTaskStore } from './taskStore';
import type { Task, TimerMode, TimerSettings } from '../types/models';
import type { WorkSessionUTC, ActiveSessionUTC } from '../types/utcModels';

interface UTCTimerState {
  // Timer status
  isRunning: boolean;
  currentTime: number; // seconds remaining
  totalTime: number; // total seconds for current session
  mode: TimerMode;
  sessionsCompleted: number;
  
  // Current task and session
  currentTask: Task | null;
  activeSession: ActiveSessionUTC | null;
  sessionStartTimerPosition: number | null;
  
  // Settings and sync
  settings: TimerSettings;
  isLoading: boolean;
  syncError: string | null;
  
  // UTC-specific state
  userTimezone: string;
  
  // Actions
  start: () => Promise<void>;
  pause: () => Promise<void>;
  reset: () => void;
  skip: () => Promise<void>;
  tick: () => void;
  setMode: (mode: TimerMode) => void;
  setCurrentTask: (task: Task | null) => void;
  
  // Session management
  createActiveSession: () => Promise<void>;
  completeActiveSession: (status: WorkSessionUTC['status']) => Promise<void>;
  
  // UTC-specific methods
  updateUserTimezone: (timezone: string) => void;
  handleTimezoneChange: () => Promise<void>;
}

export const useUTCTimerStore = create<UTCTimerState>((set, get) => {
  return {
    // Initial state
    isRunning: false,
    currentTime: 25 * 60, // 25 minutes in seconds
    totalTime: 25 * 60,
    mode: 'pomodoro',
    sessionsCompleted: 0,
    currentTask: null,
    activeSession: null,
    sessionStartTimerPosition: null,
    settings: {
      pomodoro: 25,
      shortBreak: 5,
      longBreak: 15,
      autoStartBreaks: false,
      autoStartPomodoros: false,
      longBreakInterval: 4
    },
    isLoading: false,
    syncError: null,
    userTimezone: timezoneUtils.getCurrentTimezone(),
    
    // Start timer
    start: async () => {
      const state = get();
      
      try {
        set({ isLoading: true, syncError: null });
        
        // Check if UTC features are enabled for this user
        const user = useUserStore.getState().user;
        if (!user || !utcFeatureFlags.isFeatureEnabled('utcTimerIntegration', user.uid)) {
          throw new Error('UTC timer integration not enabled for user');
        }
        
        // Create active session if starting timer and we have a task
        if (!state.isRunning && state.currentTask && !state.activeSession) {
          await get().createActiveSession();
        }
        
        set({ 
          isRunning: true,
          isLoading: false
        });
        
        utcMonitoring.trackOperation('utc_timer_start', true);
        
        console.log('UTC Timer started:', {
          mode: state.mode,
          task: state.currentTask?.title,
          sessionStartTimeUTC: state.activeSession?.startTimeUTC,
          timezone: state.userTimezone
        });
      } catch (error) {
        console.error('Error starting UTC timer:', error);
        set({ 
          syncError: error instanceof Error ? error.message : 'Failed to start timer',
          isLoading: false
        });
        utcMonitoring.trackOperation('utc_timer_start', false);
      }
    },
    
    // Pause timer
    pause: async () => {
      const state = get();
      
      try {
        set({ isLoading: true });
        
        // Complete active session when pausing
        if (state.activeSession) {
          await get().completeActiveSession('paused');
        }
        
        set({ 
          isRunning: false,
          isLoading: false
        });
        
        utcMonitoring.trackOperation('utc_timer_pause', true);
      } catch (error) {
        console.error('Error pausing UTC timer:', error);
        set({ 
          syncError: error instanceof Error ? error.message : 'Failed to pause timer',
          isLoading: false
        });
        utcMonitoring.trackOperation('utc_timer_pause', false);
      }
    },
    
    // Reset timer
    reset: () => {
      const { mode, settings } = get();
      const totalSeconds = settings[mode] * 60;
      
      set({
        currentTime: totalSeconds,
        totalTime: totalSeconds,
        isRunning: false,
        activeSession: null,
        sessionStartTimerPosition: null,
        syncError: null
      });
      
      utcMonitoring.trackOperation('utc_timer_reset', true);
    },
    
    // Skip to next timer mode
    skip: async () => {
      const { mode, sessionsCompleted, settings, activeSession } = get();
      
      try {
        set({ isLoading: true });
        
        // Complete current session
        if (activeSession) {
          await get().completeActiveSession('completed');
        }
        
        // Determine next mode
        let nextMode: TimerMode = mode;
        let nextSessionsCompleted = sessionsCompleted;
        
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
        
        // Set new mode and reset timer
        const totalSeconds = settings[nextMode] * 60;
        const shouldAutoStart = (
          (nextMode === 'pomodoro' && settings.autoStartPomodoros) ||
          (nextMode !== 'pomodoro' && settings.autoStartBreaks)
        );
        
        set({
          mode: nextMode,
          currentTime: totalSeconds,
          totalTime: totalSeconds,
          isRunning: shouldAutoStart,
          sessionsCompleted: nextSessionsCompleted,
          activeSession: null,
          sessionStartTimerPosition: null,
          isLoading: false
        });
        
        // Auto-start next session if enabled
        if (shouldAutoStart && get().currentTask) {
          await get().createActiveSession();
        }
        
        utcMonitoring.trackOperation('utc_timer_skip', true);
      } catch (error) {
        console.error('Error skipping UTC timer:', error);
        set({ 
          syncError: error instanceof Error ? error.message : 'Failed to skip timer',
          isLoading: false
        });
        utcMonitoring.trackOperation('utc_timer_skip', false);
      }
    },
    
    // Timer tick
    tick: () => {
      const state = get();
      if (!state.isRunning || state.currentTime <= 0) return;
      
      set({
        currentTime: state.currentTime - 1
      });
      
      // Auto-complete when timer reaches zero
      if (state.currentTime - 1 <= 0) {
        get().skip();
      }
    },
    
    // Set timer mode
    setMode: (mode: TimerMode) => {
      const { settings } = get();
      const totalSeconds = settings[mode] * 60;
      
      set({
        mode,
        currentTime: totalSeconds,
        totalTime: totalSeconds,
        isRunning: false,
        activeSession: null,
        sessionStartTimerPosition: null
      });
    },
    
    // Set current task
    setCurrentTask: (task: Task | null) => {
      set({ currentTask: task });
    },
    
    // Create new active session with UTC timestamps
    createActiveSession: async () => {
      const { currentTask, mode, currentTime, userTimezone } = get();
      const { user } = useUserStore.getState();
      
      if (!currentTask || !user) {
        throw new Error('Cannot create session: missing task or user');
      }
      
      try {
        const sessionId = await workSessionServiceUTC.createSession({
          userId: user.uid,
          taskId: currentTask.id,
          projectId: currentTask.projectId,
          duration: 0, // Will be calculated on completion
          sessionType: mode,
          status: 'active',
          userTimezone: userTimezone
        });
        
        const sessionStartTimeUTC = timezoneUtils.getCurrentUTC();
        const timezoneContext = timezoneUtils.createTimezoneContext(userTimezone);
        
        const activeSession: ActiveSessionUTC = {
          sessionId,
          taskId: currentTask.id,
          startTimeUTC: sessionStartTimeUTC,
          lastUpdateTimeUTC: sessionStartTimeUTC,
          timezoneContext,
          sessionStartTimerPosition: currentTime,
          status: 'active'
        };
        
        set({
          activeSession,
          sessionStartTimerPosition: currentTime
        });
        
        utcMonitoring.trackOperation('create_utc_active_session', true);
        
        console.log('Created UTC active session:', {
          sessionId,
          startTimeUTC: sessionStartTimeUTC,
          timezone: userTimezone,
          localTime: timezoneUtils.formatInTimezone(sessionStartTimeUTC, userTimezone),
          task: currentTask.title
        });
      } catch (error) {
        console.error('Error creating UTC active session:', error);
        utcMonitoring.trackOperation('create_utc_active_session', false);
        throw error;
      }
    },
    
    // Complete active session
    completeActiveSession: async (status: WorkSessionUTC['status'] = 'completed') => {
      const { activeSession } = get();
      
      if (!activeSession) {
        console.warn('No active session to complete');
        return;
      }
      
      try {
        await workSessionServiceUTC.completeSession(activeSession.sessionId, status);
        
        set({
          activeSession: null,
          sessionStartTimerPosition: null
        });
        
        utcMonitoring.trackOperation('complete_utc_active_session', true);
        
        console.log('Completed UTC session:', {
          sessionId: activeSession.sessionId,
          status
        });
      } catch (error) {
        console.error('Error completing UTC session:', error);
        utcMonitoring.trackOperation('complete_utc_active_session', false);
        throw error;
      }
    },
    
    // Update user timezone
    updateUserTimezone: (timezone: string) => {
      set({ userTimezone: timezone });
    },
    
    // Handle timezone changes during active session
    handleTimezoneChange: async () => {
      try {
        const newTimezone = timezoneUtils.getCurrentTimezone();
        const currentTimezone = get().userTimezone;
        const { activeSession } = get();
        
        if (newTimezone !== currentTimezone) {
          console.log('Timezone change detected during session:', {
            old: currentTimezone,
            new: newTimezone,
            hasActiveSession: !!activeSession
          });
          
          // Update timezone in store
          set({ userTimezone: newTimezone });
          
          // Update active session if one exists
          if (activeSession) {
            const updatedTimezoneContext = timezoneUtils.createTimezoneContext(newTimezone);
            const updatedSession: ActiveSessionUTC = {
              ...activeSession,
              timezoneContext: updatedTimezoneContext,
              lastUpdateTimeUTC: timezoneUtils.getCurrentUTC()
            };
            
            set({ activeSession: updatedSession });
            
            // Update the session in the database
            await workSessionServiceUTC.updateSession(activeSession.sessionId, {
              timezoneContext: updatedTimezoneContext,
              updatedAt: timezoneUtils.getCurrentUTC()
            });
          }
          
          // Update user settings
          await useUserStore.getState().updateTimezone(newTimezone);
          
          utcMonitoring.trackOperation('handle_timezone_change', true);
        }
      } catch (error) {
        console.error('Failed to handle timezone change:', error);
        utcMonitoring.trackOperation('handle_timezone_change', false);
      }
    }
  };
});

// Utility hook to monitor timezone changes
export const useTimezoneChangeMonitor = () => {
  const { handleTimezoneChange } = useUTCTimerStore();
  
  React.useEffect(() => {
    const interval = setInterval(() => {
      handleTimezoneChange();
    }, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [handleTimezoneChange]);
};