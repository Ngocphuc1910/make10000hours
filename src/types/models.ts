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
  // Google Calendar sync fields
  googleCalendarEventId?: string; // Google Calendar event ID
  lastSyncedAt?: Date; // Last successful sync timestamp
  syncStatus?: 'pending' | 'synced' | 'error' | 'disabled'; // Sync status
  syncError?: string; // Error message if sync failed
  googleCalendarModified?: boolean; // Flag if modified in Google Calendar
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  name: string;
  userId: string;
  color?: string;
}

export interface UserGoogleToken {
  userId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  grantedAt: Date;
  lastUsed: Date;
  revokedAt?: Date;
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

// Deep Focus session tracking
export interface DeepFocusSession {
  id: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // in minutes, calculated when session ends
  status: 'active' | 'completed' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}

export type Source = 'web' | 'extension';

// Google Calendar sync state tracking
export interface SyncState {
  userId: string;
  calendarId: string;
  nextSyncToken?: string;
  lastFullSync: Date;
  lastIncrementalSync: Date;
  isEnabled: boolean;
  webhookChannelId?: string;
  webhookResourceId?: string;
  webhookExpirationTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Sync operation logs for debugging and monitoring
export interface SyncLog {
  id: string;
  userId: string;
  operation: 'create' | 'update' | 'delete';
  direction: 'to_google' | 'from_google';
  taskId?: string;
  googleEventId?: string;
  status: 'success' | 'error' | 'conflict';
  error?: string;
  conflictResolution?: 'user_chose_local' | 'user_chose_google' | 'last_modified_wins';
  timestamp: Date;
  metadata?: {
    [key: string]: any;
  };
}

// Google Calendar event representation
export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  status?: 'confirmed' | 'tentative' | 'cancelled';
  updated?: string;
  created?: string;
  creator?: {
    email?: string;
    displayName?: string;
  };
  organizer?: {
    email?: string;
    displayName?: string;
  };
  extendedProperties?: {
    private?: {
      [key: string]: string;
    };
    shared?: {
      [key: string]: string;
    };
  };
}
