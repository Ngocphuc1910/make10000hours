export interface Task {
  id: string;
  title: string;
  description?: string;
  projectId: string;
  completed: boolean;
  timeSpent: number; // in minutes
  timeEstimated: number; // in minutes
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  name: string;
  color?: string;
}

export interface User {
  id: string;
  name: string;
  initials: string;
  title?: string;
  avatar?: string;
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