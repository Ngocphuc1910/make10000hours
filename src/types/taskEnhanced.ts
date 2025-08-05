import type { Task, TimezoneContext } from './models';

/**
 * Enhanced Task interface for UTC detection system
 * Extends base Task with UTC fields and detection metadata
 */
export interface TaskEnhanced extends Task {
  // NEW: UTC fields (present in new tasks, computed for legacy tasks)
  scheduledTimeUTC?: string;        // "2024-01-15T07:00:00.000Z" - True UTC
  scheduledEndTimeUTC?: string;     // "2024-01-15T09:30:00.000Z" - True UTC  
  scheduledTimezone?: string;       // "Asia/Ho_Chi_Minh" - User's timezone when scheduled
  scheduledDuration?: number;       // Duration in minutes
  
  // NEW: Enhanced timestamps
  createdAtUTC?: string;           // True UTC ISO string
  updatedAtUTC?: string;           // True UTC ISO string
  
  // NEW: Timezone context for accurate conversions
  timezoneContext?: TimezoneContext;
  
  // NEW: Data format indicators
  migrationVersion?: number;        // 1 = new format, undefined = legacy
  dataFormat?: 'legacy' | 'utc';   // Runtime detection result
}

/**
 * Normalized task - always has UTC fields (computed if needed)
 */
export interface TaskNormalized extends TaskEnhanced {
  // Guaranteed UTC fields (either original or converted)
  scheduledTimeUTC?: string;
  scheduledEndTimeUTC?: string;
  createdAtUTC: string;
  updatedAtUTC: string;
  dataFormat: 'legacy' | 'utc';    // How this data was obtained
}

/**
 * Task prepared for display in user's timezone
 */
export interface TaskDisplay extends TaskNormalized {
  // Display fields in user's current timezone
  displayScheduledDate?: string;        // "2024-01-15" 
  displayScheduledTime?: string;        // "14:00"
  displayScheduledEndTime?: string;     // "16:00"
  displayScheduledDateFormatted?: string; // "January 15, 2024"
  displayScheduledTimeFormatted?: string; // "2:00 PM"
  displayScheduledEndTimeFormatted?: string; // "4:00 PM"
  displayTimezone?: string;             // "Asia/Ho_Chi_Minh"
  displayTimezoneOffset?: string;       // "UTC+7"
  displayDuration?: string;             // "2h 30m"
}

/**
 * Result of data format detection
 */
export interface DetectionResult {
  isLegacy: boolean;
  confidence: 'high' | 'medium' | 'low';
  indicators: {
    hasUTCFields: boolean;
    hasMigrationVersion: boolean;
    hasLegacyFields: boolean;
    createdAtType: 'timestamp' | 'date' | 'string' | 'unknown';
  };
  assumedTimezone: string; // What timezone we assume for legacy data
  reason: string; // Why this detection was made
}