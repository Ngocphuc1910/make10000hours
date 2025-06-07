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
  // Calendar/scheduling fields
  scheduledDate?: string; // YYYY-MM-DD format
  scheduledStartTime?: string; // HH:MM format
  scheduledEndTime?: string; // HH:MM format
  includeTime?: boolean; // whether time is included in the schedule
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
  userName: string;
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
  updatedAt: Date;
  sessionStartTime?: Date; // when timer was started (for calculating elapsed time)
  activeDeviceId?: string; // to track which device is running the timer
  activeSessionId?: string; // ID of the active work session
  sessionStartTimerPosition?: number | null; // timer position when session started
  lastCountedMinute?: number | null; // last minute boundary counted
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
  id: string; // unique session ID
  userId: string;
  taskId: string;
  projectId: string;
  date: string; // YYYY-MM-DD format
  duration: number; // in minutes
  sessionType: 'manual' | 'pomodoro' | 'shortBreak' | 'longBreak'; // type of session
  status: 'active' | 'paused' | 'completed' | 'switched'; // session status
  startTime?: Date; // when session started (for timer sessions)
  endTime?: Date; // when session ended (for timer sessions)
  notes?: string; // session notes
  createdAt: Date;
  updatedAt: Date;
}

// Active session tracking for timer store
export interface ActiveSession {
  sessionId: string;
  taskId: string;
  startTime: Date;
  lastUpdateTime: Date;
  status: 'active' | 'paused';
}
