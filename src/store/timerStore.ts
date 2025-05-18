import { create } from 'zustand';
import type { TimerMode, TimerSettings } from '../types/models';

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
  updateSettings: (settings: Partial<TimerSettings>) => void;
}

const DEFAULT_SETTINGS: TimerSettings = {
  pomodoro: 25,
  shortBreak: 5,
  longBreak: 15,
  autoStartBreaks: false,
  autoStartPomodoros: false,
  longBreakInterval: 4
};

export const useTimerStore = create<TimerState>((set, get) => ({
  // Initial state
  isRunning: false,
  currentTime: DEFAULT_SETTINGS.pomodoro * 60, // convert to seconds
  totalTime: DEFAULT_SETTINGS.pomodoro * 60,
  mode: 'pomodoro',
  sessionsCompleted: 0,
  currentTaskId: null,
  settings: DEFAULT_SETTINGS,
  
  // Actions
  start: () => set({ isRunning: true }),
  
  pause: () => set({ isRunning: false }),
  
  reset: () => {
    const { mode, settings } = get();
    const totalSeconds = settings[mode] * 60;
    set({ 
      currentTime: totalSeconds,
      totalTime: totalSeconds,
      isRunning: false
    });
  },
  
  skip: () => {
    const { mode, settings, sessionsCompleted } = get();
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
      sessionsCompleted: nextSessionsCompleted
    });
  },
  
  tick: () => {
    const { currentTime, isRunning } = get();
    if (isRunning && currentTime > 0) {
      set({ currentTime: currentTime - 1 });
    } else if (isRunning && currentTime === 0) {
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
      isRunning: false
    });
  },
  
  setCurrentTaskId: (taskId: string | null) => set({ currentTaskId: taskId }),
  
  updateSettings: (newSettings: Partial<TimerSettings>) => {
    const settings = { ...get().settings, ...newSettings };
    set({ settings });
    
    // If current mode settings were updated, reset the timer
    const { mode } = get();
    if (newSettings[mode] !== undefined) {
      const totalSeconds = settings[mode] * 60;
      set({
        currentTime: totalSeconds,
        totalTime: totalSeconds
      });
    }
  }
})); 