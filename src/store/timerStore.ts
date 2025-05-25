import { create } from 'zustand';
import { DEFAULT_SETTINGS, type TimerMode, type TimerSettings } from '../types/models';
import { useTaskStore } from './taskStore';
import { useUserStore } from './userStore';

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
  
  // Actions
  start: () => void;
  pause: () => void;
  reset: () => void;
  skip: () => void;
  tick: () => void;
  setMode: (mode: TimerMode) => void;
  setCurrentTaskId: (taskId: string | null) => void;
  setSettings: (settings: TimerSettings) => void;
}

export const useTimerStore = create<TimerState>((set, get) => {
  return {
    // Initial state
    isRunning: false,
    currentTime: DEFAULT_SETTINGS.timer.pomodoro * 60, // convert to seconds
    totalTime: DEFAULT_SETTINGS.timer.pomodoro * 60,
    mode: 'pomodoro',
    sessionsCompleted: 0,
    currentTaskId: null,
    settings: DEFAULT_SETTINGS.timer,
    
    // Actions
    start: () => set({ isRunning: true }),
    
    pause: () => set({ isRunning: false }),
    
    reset: () => {
      const { mode, settings } = get();
      const totalSeconds = settings[mode] * 60;
      set({ 
        currentTime: totalSeconds,
        totalTime: totalSeconds,
        isRunning: false,
        settings
      });
    },
    
    skip: () => {
      const { mode, sessionsCompleted, settings } = get();
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
        settings
      });
    },
    
    tick: () => {
      const { currentTime, totalTime } = get();
      const { timeSpentIncrement } = useTaskStore.getState();

      if (currentTime !== totalTime && currentTime % 60 === 0) {
        // Increment time spent for the current task every minute
        const { currentTaskId } = get();
        if (currentTaskId) {
          timeSpentIncrement(currentTaskId, 1); // increment by 1 minute
        }
      }

      if (currentTime > 0) {
        set({ currentTime: currentTime - 1 });
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
    },
    
    setCurrentTaskId: (taskId: string | null) => set({ currentTaskId: taskId }),

    setSettings: (settings: TimerSettings) => {
      const { mode } = get();
      // Reset timer with new settings
      const totalSeconds = settings[mode] * 60;
      set({
        settings: settings,
        currentTime: totalSeconds,
        totalTime: totalSeconds,
        isRunning: false
      });
    },
  };
});

// Subscribe to user authentication changes
useUserStore.subscribe((state) => {
  console.log('User authentication state changed for timerStore:', state);
  const timerStore = useTimerStore.getState();
  
  if (state.isAuthenticated && state.user) {
    // User logged in, initialize timer store
    timerStore.setSettings(state.user.settings.timer);
  }
});
