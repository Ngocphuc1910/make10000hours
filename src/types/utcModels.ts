import { TimezoneContext } from '../utils/timezoneUtils';

// NEW: UTC-based WorkSession
export interface WorkSessionUTC {
  id: string;
  userId: string;
  taskId: string;
  projectId: string;
  
  // UTC timestamps (source of truth)
  startTimeUTC: string;        // ISO string in UTC
  endTimeUTC?: string;         // ISO string in UTC
  duration: number;            // Minutes
  
  // User timezone context when created
  timezoneContext: TimezoneContext;
  
  // Session metadata
  sessionType: 'manual' | 'pomodoro' | 'shortBreak' | 'longBreak';
  status: 'active' | 'paused' | 'completed' | 'switched';
  notes?: string;
  
  // System fields
  createdAt: string;           // UTC ISO string
  updatedAt: string;           // UTC ISO string
  
  // Migration tracking
  migrationSource?: 'legacy' | 'new' | 'imported';
  legacyId?: string;           // Original session ID if migrated
}

// NEW: UTC-based DeepFocusSession
export interface DeepFocusSessionUTC {
  id: string;
  userId: string;
  
  // UTC timestamps
  startTimeUTC: string;
  endTimeUTC?: string;
  duration: number;
  
  // Timezone context
  timezoneContext: TimezoneContext;
  
  // Status and metadata
  status: 'active' | 'completed' | 'suspended';
  source: 'extension' | 'web';
  extensionSessionId?: string;
  blockedSites?: string[];
  
  // System fields
  createdAt: string;
  updatedAt: string;
  
  // Migration tracking
  migrationSource?: 'legacy' | 'new';
  legacyId?: string;
}

// NEW: UTC-based Task scheduling
export interface TaskUTC {
  // All existing Task fields...
  id: string;
  title: string;
  description?: string;
  projectId: string;
  
  // UTC-based scheduling
  scheduledTimeUTC?: string;      // When task is scheduled (UTC ISO string)
  scheduledTimezone?: string;     // User's timezone when scheduled
  scheduledDuration?: number;     // Expected duration in minutes
  
  // Legacy compatibility during transition (will be removed later)
  scheduledDate?: string;         // "2024-01-15" - deprecated
  scheduledStartTime?: string;    // "09:00" - deprecated
  scheduledEndTime?: string;      // "10:30" - deprecated
  includeTime?: boolean;          // deprecated
  
  // Other fields remain the same...
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  tags: string[];
  timeEstimated?: number;
  timeSpent: number;
  order: number;
  createdAt: string;
  updatedAt: string;
}

// Enhanced User model with timezone settings
export interface UserUTC {
  uid: string;
  userName: string;
  email: string;
  
  // Enhanced timezone settings
  timezoneSettings?: {
    current: string;              // Current IANA timezone
    confirmed: boolean;           // User has explicitly confirmed their timezone
    autoDetected: string;         // What we auto-detected
    lastUpdated: string;          // When timezone was last updated (UTC ISO)
    migrationConsent: boolean;    // User agreed to migrate their data
    source: 'auto' | 'manual' | 'imported';
  };
  
  // Enhanced settings with UTC awareness
  settings?: {
    timer: {
      pomodoro: number;
      shortBreak: number;
      longBreak: number;
      autoStartBreaks: boolean;
      autoStartPomodoros: boolean;
      longBreakInterval: number;
    };
    darkMode: boolean;
    taskListViewMode: 'pomodoro' | 'simple' | 'project';
    
    // NEW: UTC feature preferences
    utcFeatures?: {
      enabled: boolean;
      preferredTimezoneDisplay: 'local' | 'utc' | 'both';
      showTimezoneIndicators: boolean;
    };
  };
  
  createdAt: string;
  updatedAt: string;
}

// Transition interface - supports both legacy and UTC data
export interface WorkSessionTransition extends Omit<WorkSessionUTC, 'startTimeUTC' | 'endTimeUTC' | 'timezoneContext'> {
  // Legacy fields (keep during transition)
  date?: string;
  startTime?: Date;
  endTime?: Date;
  
  // UTC fields (new)
  startTimeUTC?: string;
  endTimeUTC?: string;
  timezoneContext?: TimezoneContext;
  
  // Migration status
  migrationStatus: 'legacy' | 'dual' | 'utc-only';
  hasEnhancedTimezone?: boolean;
}

// Unified session interface for dual-mode queries
export interface UnifiedWorkSession {
  id: string;
  userId: string;
  taskId: string;
  projectId: string;
  duration: number;
  sessionType: 'manual' | 'pomodoro' | 'shortBreak' | 'longBreak';
  status: 'active' | 'paused' | 'completed' | 'switched';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  
  // Unified time fields (always in user's local timezone for display)
  startTime: Date;
  endTime?: Date;
  
  // Metadata
  dataSource: 'legacy' | 'utc';
  timezone?: string;
  
  // Raw data (for debugging/migration)
  rawData: any; // Could be WorkSession | WorkSessionUTC
}

// Migration result interfaces
export interface MigrationResult {
  success: boolean;
  migratedCount?: number;
  migrationId?: string;
  message: string;
  error?: string;
  validationResult?: ValidationResult;
}

export interface ValidationResult {
  valid: boolean;
  issues: string[];
  warnings?: string[];
  sessionsChecked?: number;
  dataIntegrityScore?: number;
}

// Enhanced migration progress tracking
export interface MigrationProgress {
  totalSessions: number;
  migratedSessions: number;
  failedSessions: number;
  validatedSessions: number;
  currentBatch: number;
  estimatedTimeRemaining: number;
  startTime: string;
  lastError?: string;
  validationErrors: string[];
  dataIntegrityIssues: string[];
}

// Timer session with UTC support
export interface ActiveSessionUTC {
  sessionId: string;
  taskId: string;
  
  // UTC timestamps
  startTimeUTC: string;
  lastUpdateTimeUTC: string;
  
  // Timezone context
  timezoneContext: TimezoneContext;
  
  // Timer state
  sessionStartTimerPosition: number;
  status: 'active' | 'paused';
  
  // Legacy compatibility (will be removed)
  startTime?: Date;
  lastUpdateTime?: Date;
}

export default {
  WorkSessionUTC,
  DeepFocusSessionUTC,
  TaskUTC,
  UserUTC,
  WorkSessionTransition,
  UnifiedWorkSession,
  MigrationResult,
  ValidationResult,
  MigrationProgress,
  ActiveSessionUTC
};