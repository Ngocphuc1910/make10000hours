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
