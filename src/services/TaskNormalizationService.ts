import { timezoneUtils } from '../utils/timezoneUtils';
import { TaskDetectionService } from './TaskDetectionService';
import type { Task } from '../types/models';
import type { TaskNormalized } from '../types/taskEnhanced';

/**
 * Service for normalizing tasks to consistent UTC format in memory
 * Converts legacy UTC+7 data to proper UTC without touching the database
 */
export class TaskNormalizationService {
  private static readonly UTC_OFFSET_VIETNAM = 7 * 60 * 60 * 1000; // UTC+7 in milliseconds
  private static readonly LEGACY_TIMEZONE = 'Asia/Ho_Chi_Minh';
  
  /**
   * Normalize any task to consistent UTC format
   * This is the main method that handles both legacy and new tasks
   */
  static normalize(task: Task): TaskNormalized {
    const detection = TaskDetectionService.detectDataFormat(task);
    
    if (detection.isLegacy) {
      return this.convertLegacyToUTC(task);
    } else {
      return this.ensureUTCFields(task);
    }
  }
  
  /**
   * Batch normalize multiple tasks efficiently
   */
  static batchNormalize(tasks: Task[]): TaskNormalized[] {
    return tasks.map(task => this.normalize(task));
  }
  
  /**
   * Convert legacy UTC+7 task to proper UTC format
   */
  private static convertLegacyToUTC(task: Task): TaskNormalized {
    const normalized: TaskNormalized = {
      ...task,
      dataFormat: 'legacy',
      createdAtUTC: this.convertTimestampToUTC(task.createdAt),
      updatedAtUTC: this.convertTimestampToUTC(task.updatedAt)
    };
    
    // Convert scheduling if present
    if (task.scheduledDate) {
      const schedulingConversion = this.convertLegacySchedulingToUTC(task);
      Object.assign(normalized, schedulingConversion);
    }
    
    // Add timezone context for legacy data
    normalized.timezoneContext = timezoneUtils.createTimezoneContext(
      this.LEGACY_TIMEZONE, 
      'migrated'
    );
    
    return normalized;
  }
  
  /**
   * Ensure UTC fields exist for new format tasks
   */
  private static ensureUTCFields(task: Task): TaskNormalized {
    const normalized: TaskNormalized = {
      ...task,
      dataFormat: 'utc',
      createdAtUTC: task.createdAtUTC || this.convertTimestampToUTC(task.createdAt),
      updatedAtUTC: task.updatedAtUTC || this.convertTimestampToUTC(task.updatedAt)
    };
    
    // Ensure timezone context exists
    if (!normalized.timezoneContext && normalized.scheduledTimezone) {
      normalized.timezoneContext = timezoneUtils.createTimezoneContext(
        normalized.scheduledTimezone,
        'migrated'
      );
    }
    
    return normalized;
  }
  
  /**
   * Convert legacy scheduling fields to UTC
   */
  private static convertLegacySchedulingToUTC(task: Task): {
    scheduledTimeUTC?: string;
    scheduledEndTimeUTC?: string;
    scheduledTimezone: string;
    scheduledDuration?: number;
  } {
    if (!task.scheduledDate) {
      return { scheduledTimezone: this.LEGACY_TIMEZONE };
    }
    
    let scheduledTimeUTC: string | undefined;
    let scheduledEndTimeUTC: string | undefined;
    let scheduledDuration: number | undefined;
    
    if (task.scheduledStartTime) {
      // Timed task - convert both start and end times
      const startCombined = `${task.scheduledDate}T${task.scheduledStartTime}:00`;
      const startLocalDateTime = new Date(startCombined);
      scheduledTimeUTC = this.convertUTCPlus7ToUTC(startLocalDateTime);
      
      if (task.scheduledEndTime) {
        const endCombined = `${task.scheduledDate}T${task.scheduledEndTime}:00`;
        const endLocalDateTime = new Date(endCombined);
        scheduledEndTimeUTC = this.convertUTCPlus7ToUTC(endLocalDateTime);
        
        // Calculate duration in minutes
        scheduledDuration = Math.round(
          (endLocalDateTime.getTime() - startLocalDateTime.getTime()) / (1000 * 60)
        );
      }
    } else {
      // All-day task - use start of day
      const dayStart = new Date(`${task.scheduledDate}T00:00:00`);
      scheduledTimeUTC = this.convertUTCPlus7ToUTC(dayStart);
    }
    
    return {
      scheduledTimeUTC,
      scheduledEndTimeUTC,
      scheduledTimezone: this.LEGACY_TIMEZONE,
      scheduledDuration
    };
  }
  
  /**
   * Convert UTC+7 date to true UTC
   */
  private static convertUTCPlus7ToUTC(utcPlus7Date: Date): string {
    const utcTimestamp = utcPlus7Date.getTime() - this.UTC_OFFSET_VIETNAM;
    return new Date(utcTimestamp).toISOString();
  }
  
  /**
   * Convert any timestamp format to UTC ISO string
   */
  private static convertTimestampToUTC(timestamp: any): string {
    if (!timestamp) {
      return new Date().toISOString();
    }
    
    // Already a UTC ISO string
    if (typeof timestamp === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(timestamp)) {
      return timestamp;
    }
    
    // Firestore Timestamp (legacy)
    if (typeof timestamp === 'object' && 'toDate' in timestamp) {
      const date = timestamp.toDate();
      return this.convertUTCPlus7ToUTC(date);
    }
    
    // JavaScript Date object (legacy, assumed UTC+7)
    if (timestamp instanceof Date) {
      return this.convertUTCPlus7ToUTC(timestamp);
    }
    
    // Fallback: try to parse as date
    try {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return this.convertUTCPlus7ToUTC(date);
      }
    } catch (error) {
      console.warn('Failed to convert timestamp to UTC:', timestamp, error);
    }
    
    // Last resort: current time
    return new Date().toISOString();
  }
  
  /**
   * Validate normalized task has all required UTC fields
   */
  static validateNormalized(task: TaskNormalized): {
    isValid: boolean;
    missingFields: string[];
    warnings: string[];
  } {
    const missingFields: string[] = [];
    const warnings: string[] = [];
    
    // Required UTC fields
    if (!task.createdAtUTC) missingFields.push('createdAtUTC');
    if (!task.updatedAtUTC) missingFields.push('updatedAtUTC');
    if (!task.dataFormat) missingFields.push('dataFormat');
    
    // Scheduled task validation
    if (task.scheduledDate || task.scheduledStartTime) {
      if (!task.scheduledTimeUTC) {
        warnings.push('Task has scheduling but no scheduledTimeUTC');
      }
      if (!task.scheduledTimezone) {
        warnings.push('Task has scheduling but no scheduledTimezone');
      }
    }
    
    // Timezone consistency
    if (task.scheduledTimeUTC && !task.timezoneContext) {
      warnings.push('Task has UTC scheduling but no timezone context');
    }
    
    return {
      isValid: missingFields.length === 0,
      missingFields,
      warnings
    };
  }
  
  /**
   * Get normalization statistics for debugging
   */
  static getNormalizationStats(tasks: Task[]): {
    total: number;
    legacy: number;
    utc: number;
    withScheduling: number;
    validationIssues: number;
    performanceMs: number;
  } {
    const startTime = performance.now();
    
    const normalized = this.batchNormalize(tasks);
    let validationIssues = 0;
    
    const stats = {
      total: tasks.length,
      legacy: normalized.filter(t => t.dataFormat === 'legacy').length,
      utc: normalized.filter(t => t.dataFormat === 'utc').length,
      withScheduling: normalized.filter(t => !!t.scheduledTimeUTC).length,
      validationIssues: 0,
      performanceMs: 0
    };
    
    // Count validation issues
    normalized.forEach(task => {
      const validation = this.validateNormalized(task);
      if (!validation.isValid || validation.warnings.length > 0) {
        validationIssues++;
      }
    });
    
    stats.validationIssues = validationIssues;
    stats.performanceMs = Math.round(performance.now() - startTime);
    
    return stats;
  }
  
  /**
   * Debug helper: compare original vs normalized task
   */
  static debugNormalization(task: Task): {
    original: Task;
    normalized: TaskNormalized;
    detection: ReturnType<typeof TaskDetectionService.detectDataFormat>;
    validation: ReturnType<typeof TaskNormalizationService.validateNormalized>;
    changes: string[];
  } {
    const normalized = this.normalize(task);
    const detection = TaskDetectionService.detectDataFormat(task);
    const validation = this.validateNormalized(normalized);
    
    const changes: string[] = [];
    
    // Track what changed
    if (!task.scheduledTimeUTC && normalized.scheduledTimeUTC) {
      changes.push(`+ scheduledTimeUTC: ${normalized.scheduledTimeUTC}`);
    }
    if (!task.createdAtUTC && normalized.createdAtUTC) {
      changes.push(`+ createdAtUTC: ${normalized.createdAtUTC}`);
    }
    if (!task.dataFormat && normalized.dataFormat) {
      changes.push(`+ dataFormat: ${normalized.dataFormat}`);
    }
    
    return {
      original: task,
      normalized,
      detection,
      validation,
      changes
    };
  }
}