export interface Task {
  id: string;
  title: string;
  description?: string;
  projectId: string;
  userId: string;
  completed: boolean;
  status: 'pomodoro' | 'todo' | 'completed';
  timeSpent: number; // in minutes
  timeEstimated: number; // in minutes
  order: number;
  hideFromPomodoro?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  name: string;
  userId: string;
  color?: string;
}

// separate collection for user data
export interface UserData {
  uid: string;
  settings: AppSettings;
}

export type TimerMode = 'pomodoro' | 'shortBreak' | 'longBreak';

export interface TimerSettings {
  pomodoro: number; // in minutes
  shortBreak: number; // in minutes
  longBreak: number; // in minutes
  autoStartBreaks: boolean;
  autoStartPomodoros: boolean;
  longBreakInterval: number;
}

// Timer state for persistence across sessions and devices
export interface TimerState {
  userId: string;
  currentTime: number; // seconds remaining
  totalTime: number; // total seconds for current session
  mode: TimerMode; // 'pomodoro' | 'shortBreak' | 'longBreak'
  sessionsCompleted: number;
  isRunning: boolean;
  currentTaskId: string | null;
  lastUpdated: Date; // for conflict resolution and sync
  sessionStartTime?: Date; // when timer was started (for calculating elapsed time)
  deviceId?: string; // to track which device is running the timer
}

export interface AppSettings {
  timer: TimerSettings;
  darkMode: boolean;
  compactTaskView: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  timer: {
    pomodoro: 25,
    shortBreak: 5,
    longBreak: 15,
    autoStartBreaks: false,
    autoStartPomodoros: false,
    longBreakInterval: 4
  },
  darkMode: false,
  compactTaskView: false,
};

// Work session tracking for dashboard analytics
export interface WorkSession {
  id: string;
  userId: string;
  taskId: string;
  projectId: string;
  startTime: Date;
  endTime: Date;
  duration: number; // in minutes
  sessionType: 'pomodoro' | 'manual' | 'continuous'; // how the session was created
  notes?: string;
  createdAt: Date;
}
