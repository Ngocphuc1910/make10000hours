/**
 * Test Setup Utilities for Timer-Task Synchronization Tests
 * 
 * This file provides common test utilities, mocks, and setup functions
 * for running the timer-task synchronization bug detection tests.
 */

import '@testing-library/jest-dom';

// Mock Firebase entirely to avoid real database connections
jest.mock('../../api/firebase', () => ({
  db: {
    collection: jest.fn(),
    doc: jest.fn(),
  },
  auth: {
    currentUser: null,
    onAuthStateChanged: jest.fn(),
  }
}));

// Mock Firestore functions
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  addDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  onSnapshot: jest.fn(),
  writeBatch: jest.fn(),
  increment: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date(), seconds: Date.now() / 1000, nanoseconds: 0 })),
    fromDate: jest.fn((date) => ({ toDate: () => date, seconds: date.getTime() / 1000, nanoseconds: 0 }))
  }
}));

// Mock date-fns
jest.mock('date-fns', () => ({
  format: jest.fn((date, formatStr) => {
    if (formatStr === 'yyyy-MM-dd') {
      return date.toISOString().split('T')[0];
    }
    return date.toISOString();
  }),
}));

// Mock analytics functions
jest.mock('../../utils/analytics', () => ({
  trackPomodoroStarted: jest.fn(),
  trackPomodoroCompleted: jest.fn(),
  trackTaskCreated: jest.fn(),
  trackProjectCreated: jest.fn(),
  trackTaskCompleted: jest.fn(),
}));

// Mock timezone utilities
jest.mock('../../utils/timezoneUtils', () => ({
  timezoneUtils: {
    getCurrentTimezone: jest.fn(() => 'America/New_York'),
    getCurrentUTC: jest.fn(() => new Date().toISOString()),
    userTimeToUTC: jest.fn((date, timezone) => new Date(date).toISOString()),
    utcToUserTime: jest.fn((utcString, timezone) => new Date(utcString)),
    createTimezoneContext: jest.fn(() => ({
      timezone: 'America/New_York',
      utcOffset: -300,
      recordedAt: new Date(),
      source: 'browser'
    }))
  }
}));

// Mock feature flags
jest.mock('../../services/featureFlags', () => ({
  utcFeatureFlags: {
    isFeatureEnabled: jest.fn(() => false),
    getTransitionMode: jest.fn(() => 'disabled'),
  }
}));

// Mock monitoring
jest.mock('../../services/monitoring', () => ({
  utcMonitoring: {
    trackOperation: jest.fn(),
  }
}));

// Test utilities for consistent test data
export const createMockUser = (overrides = {}) => ({
  uid: 'test-user-123',
  userName: 'Test User',
  email: 'test@example.com',
  settings: {
    timer: {
      pomodoro: 25,
      shortBreak: 5,
      longBreak: 15,
      longBreakInterval: 4,
      autoStartPomodoros: false,
      autoStartBreaks: false,
    },
    taskListViewMode: 'today' as const,
    timezone: 'America/New_York'
  },
  isAuthenticated: true,
  isInitialized: true,
  ...overrides
});

export const createMockTask = (overrides = {}) => ({
  id: 'task-123',
  title: 'Test Task',
  userId: 'test-user-123',
  projectId: 'project-123',
  timeSpent: 5,
  timeEstimated: 30,
  status: 'pomodoro' as const,
  completed: false,
  hideFromPomodoro: false,
  order: 0,
  createdAt: new Date('2024-01-01T10:00:00.000Z'),
  updatedAt: new Date('2024-01-01T10:00:00.000Z'),
  ...overrides
});

export const createMockProject = (overrides = {}) => ({
  id: 'project-123',
  name: 'Test Project',
  userId: 'test-user-123',
  color: '#3B82F6',
  ...overrides
});

export const createMockWorkSession = (overrides = {}) => ({
  id: 'session-123',
  userId: 'test-user-123',
  taskId: 'task-123',
  projectId: 'project-123',
  duration: 25,
  sessionType: 'pomodoro',
  status: 'completed' as const,
  notes: 'Test session',
  date: '2024-01-01',
  startTime: new Date('2024-01-01T10:00:00.000Z'),
  endTime: new Date('2024-01-01T10:25:00.000Z'),
  createdAt: new Date('2024-01-01T10:00:00.000Z'),
  updatedAt: new Date('2024-01-01T10:25:00.000Z'),
  ...overrides
});

export const createMockActiveSession = (overrides = {}) => ({
  sessionId: 'session-123',
  taskId: 'task-123',
  startTime: new Date('2024-01-01T10:00:00.000Z'),
  lastUpdateTime: new Date('2024-01-01T10:00:00.000Z'),
  status: 'active' as const,
  ...overrides
});

// Timer state utilities
export const createMockTimerState = (overrides = {}) => ({
  isRunning: false,
  currentTime: 25 * 60, // 25 minutes in seconds
  totalTime: 25 * 60,
  mode: 'pomodoro' as const,
  sessionsCompleted: 0,
  currentTask: null,
  activeSession: null,
  sessionStartTimerPosition: null,
  lastCountedMinute: null,
  settings: {
    pomodoro: 25,
    shortBreak: 5,
    longBreak: 15,
    longBreakInterval: 4,
    autoStartPomodoros: false,
    autoStartBreaks: false,
  },
  enableStartPauseBtn: true,
  isLoading: false,
  isSyncing: false,
  lastSyncTime: null,
  isActiveDevice: true,
  syncError: null,
  taskLoadRetryCount: 0,
  isTaskLoading: false,
  taskLoadError: null,
  ...overrides
});

// Bug detection utilities
export const detectTimerTaskSyncBug = (
  timerState: any,
  taskState: any,
  sessionCalls: any[]
) => {
  const bugs: string[] = [];

  // Timer running without active session
  if (timerState.isRunning && !timerState.activeSession) {
    bugs.push('CRITICAL: Timer running without active session');
  }

  // Active session without running timer
  if (!timerState.isRunning && timerState.activeSession) {
    bugs.push('Session exists but timer not running');
  }

  // No session creation calls for running timer
  if (timerState.isRunning && timerState.currentTask && sessionCalls.length === 0) {
    bugs.push('CRITICAL: Timer running with task but no session creation attempted');
  }

  // Multiple session creation calls
  if (sessionCalls.length > 1) {
    bugs.push(`Duplicate session creation: ${sessionCalls.length} calls`);
  }

  return bugs;
};

export const simulateTimerMinuteBoundary = (
  currentMinute: number,
  targetMinute: number,
  timerStore: any
) => {
  return {
    currentTime: targetMinute * 60,
    lastCountedMinute: currentMinute,
    minutesCrossed: currentMinute - targetMinute
  };
};

export const simulateNetworkFailure = (
  mockService: any,
  method: string,
  failureRate: number = 1.0
) => {
  const originalMethod = mockService[method];
  
  mockService[method] = jest.fn().mockImplementation((...args) => {
    if (Math.random() < failureRate) {
      return Promise.reject(new Error(`Network failure in ${method}`));
    }
    return originalMethod?.(...args) || Promise.resolve();
  });

  return () => {
    mockService[method] = originalMethod;
  };
};

// Console error capture for bug detection
export const captureConsoleErrors = () => {
  const errors: string[] = [];
  const originalError = console.error;
  
  console.error = (...args) => {
    const errorMessage = args.join(' ');
    errors.push(errorMessage);
    originalError(...args);
  };

  return {
    getErrors: () => [...errors],
    getErrorsContaining: (text: string) => errors.filter(err => err.includes(text)),
    restore: () => {
      console.error = originalError;
    },
    hasErrors: () => errors.length > 0,
    clear: () => {
      errors.length = 0;
    }
  };
};

// Async test utilities
export const waitForAsyncUpdates = () => {
  return new Promise(resolve => setTimeout(resolve, 0));
};

export const waitForTimerTick = () => {
  return new Promise(resolve => setTimeout(resolve, 10));
};

export const waitForDatabaseOperation = () => {
  return new Promise(resolve => setTimeout(resolve, 50));
};

// Global test environment setup
beforeEach(() => {
  // Clear all timers
  jest.clearAllTimers();
  
  // Reset Date mocks
  jest.setSystemTime(new Date('2024-01-01T10:00:00.000Z'));
});

afterEach(() => {
  // Clean up any remaining timers
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

// Mock implementations for common services
export const setupDefaultMocks = () => {
  return {
    transitionService: {
      createSession: jest.fn().mockResolvedValue('session-123'),
      updateSession: jest.fn().mockResolvedValue(undefined),
      incrementDuration: jest.fn().mockResolvedValue(undefined),
      deleteWorkSessionsByTask: jest.fn().mockResolvedValue(0),
      updateWorkSessionsProjectId: jest.fn().mockResolvedValue(0),
    },
    workSessionService: {
      createWorkSession: jest.fn().mockResolvedValue('legacy-session-456'),
      updateSession: jest.fn().mockResolvedValue(undefined),
      deleteWorkSession: jest.fn().mockResolvedValue(undefined),
      getActiveSessions: jest.fn().mockResolvedValue([]),
      cleanupOrphanedSessions: jest.fn().mockResolvedValue(0),
    },
    timerService: {
      saveTimerState: jest.fn().mockResolvedValue(undefined),
      loadTimerState: jest.fn().mockResolvedValue(null),
    }
  };
};