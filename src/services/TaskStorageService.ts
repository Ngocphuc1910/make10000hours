import { timezoneUtils } from '../utils/timezoneUtils';
import { TaskDetectionService } from './TaskDetectionService';
import { doc, setDoc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '../api/firebase';
import type { Task } from '../types/models';
import type { TaskEnhanced } from '../types/taskEnhanced';

/**
 * Service for storing tasks with proper UTC format
 * Handles the dual-write approach for new tasks
 */
export class TaskStorageService {
  private static readonly tasksCollection = collection(db, 'tasks');
  
  /**
   * Create a new task with proper UTC format
   * This is the main method for creating tasks going forward
   */
  static async createTask(
    taskData: Omit<Task, 'id' | 'order' | 'createdAt' | 'updatedAt'>,
    userTimezone?: string
  ): Promise<string> {
    const timezone = userTimezone || timezoneUtils.getCurrentTimezone();
    const now = new Date();
    
    // Create enhanced task with UTC fields
    const enhancedTask = this.enhanceTaskForStorage(taskData, timezone, now);
    
    // Store in Firestore
    const docRef = await addDoc(this.tasksCollection, enhancedTask);
    
    return docRef.id;
  }
  
  /**
   * Update existing task with proper UTC format
   * Maintains compatibility with both legacy and new formats
   */
  static async updateTask(
    taskId: string,
    updates: Partial<Task>,
    userTimezone?: string
  ): Promise<void> {
    const timezone = userTimezone || timezoneUtils.getCurrentTimezone();
    const now = new Date();
    
    // Enhance updates with UTC fields
    const enhancedUpdates = this.enhanceUpdatesForStorage(updates, timezone, now);
    
    // Update in Firestore
    const taskDoc = doc(db, 'tasks', taskId);
    
    // Debug: About to write to Firestore
    
    try {
      await updateDoc(taskDoc, enhancedUpdates);
      
      // Only log success if scheduledTimeUTC is involved (for debugging drag & drop)
      if ('scheduledTimeUTC' in updates) {
        console.log('✅ TaskStorageService: Successfully wrote scheduledTimeUTC to Firestore');
      }
    } catch (error) {
      console.error('❌ TaskStorageService Firestore write failed:', {
        taskId,
        error: (error as any).message,
        enhancedUpdates: JSON.stringify(enhancedUpdates, null, 2)
      });
      throw error;
    }
  }
  
  /**
   * Create a complete task document with proper UTC fields
   * Used for migrations and bulk operations
   */
  static async setTask(
    taskId: string,
    taskData: Task,
    userTimezone?: string
  ): Promise<void> {
    const timezone = userTimezone || timezoneUtils.getCurrentTimezone();
    const now = new Date();
    
    // Enhance full task data
    const enhancedTask = this.enhanceTaskForStorage(taskData, timezone, now);
    
    // Set in Firestore
    const taskDoc = doc(db, 'tasks', taskId);
    await setDoc(taskDoc, enhancedTask);
  }
  
  /**
   * Enhance task data with UTC fields for storage
   */
  private static enhanceTaskForStorage(
    taskData: Partial<Task>,
    userTimezone: string,
    timestamp: Date
  ): TaskEnhanced {
    const enhanced: TaskEnhanced = {
      ...taskData,
      // UTC timestamps
      createdAtUTC: taskData.createdAtUTC || timestamp.toISOString(),
      updatedAtUTC: timestamp.toISOString(),
      
      // Legacy timestamps (for compatibility)
      createdAt: taskData.createdAt || timestamp,
      updatedAt: timestamp,
      
      // Timezone context
      timezoneContext: timezoneUtils.createTimezoneContext(userTimezone, 'user_created')
    };
    
    // Handle scheduling if present
    if (this.hasSchedulingData(taskData)) {
      const schedulingEnhancement = this.enhanceSchedulingForStorage(
        taskData,
        userTimezone,
        timestamp
      );
      Object.assign(enhanced, schedulingEnhancement);
    }
    
    return enhanced;
  }
  
  /**
   * Enhance partial updates with UTC fields
   */
  private static enhanceUpdatesForStorage(
    updates: Partial<Task>,
    userTimezone: string,
    timestamp: Date
  ): Partial<TaskEnhanced> {
    const enhanced: Partial<TaskEnhanced> = {
      ...updates,
      // Always update the updatedAt timestamps
      updatedAtUTC: timestamp.toISOString(),
      updatedAt: timestamp
    };
    
    // Check if user is removing scheduling information
    const isRemovingScheduling = this.isRemovingScheduling(updates);
    const hasSchedulingData = this.hasSchedulingData(updates);
    
    if (isRemovingScheduling) {
      console.log('🗑 Removing scheduling - clearing UTC fields');
      // Clear all scheduling-related UTC fields when scheduling is removed
      // Use null (not undefined) for Firestore compatibility
      enhanced.scheduledTimeUTC = null;
      enhanced.scheduledEndTimeUTC = null;
      enhanced.scheduledTimezone = null;
      enhanced.scheduledDuration = null;
      enhanced.timezoneContext = null;
    } else if (hasSchedulingData) {
      // Update timezone context if scheduling changed
      enhanced.timezoneContext = timezoneUtils.createTimezoneContext(
        userTimezone, 
        'user_updated'
      );
      
      const schedulingEnhancement = this.enhanceSchedulingForStorage(
        updates,
        userTimezone,
        timestamp
      );
      
      Object.assign(enhanced, schedulingEnhancement);
    }
    
    // Filter out undefined values to prevent Firestore errors
    const cleanedEnhanced: Partial<TaskEnhanced> = {};
    Object.keys(enhanced).forEach(key => {
      const value = (enhanced as any)[key];
      if (value !== undefined) {
        (cleanedEnhanced as any)[key] = value;
      }
    });
    
    // Log only if we're processing scheduledTimeUTC for debugging
    if ('scheduledTimeUTC' in updates) {
      console.log('✅ TaskStorageService: Enhanced updates ready for Firestore:', {
        hasScheduledTimeUTC: 'scheduledTimeUTC' in cleanedEnhanced,
        filteredOutUndefined: Object.keys(enhanced).filter(key => (enhanced as any)[key] === undefined)
      });
    }
    
    return cleanedEnhanced;
  }
  
  /**
   * Enhance scheduling data with UTC fields
   */
  private static enhanceSchedulingForStorage(
    taskData: Partial<Task>,
    userTimezone: string,
    timestamp: Date
  ): {
    scheduledTimeUTC?: string;
    scheduledEndTimeUTC?: string;
    scheduledTimezone: string;
    scheduledDuration?: number;
  } {
    const result = {
      scheduledTimezone: userTimezone
    };
    
    // Handle different scheduling formats
    if (taskData.scheduledTimeUTC) {
      // Already in UTC format - this takes priority (from drag & drop)
      const utcResult: any = {
        scheduledTimeUTC: taskData.scheduledTimeUTC,
        scheduledTimezone: userTimezone
      };
      
      // Only include optional fields if they have valid values
      if (taskData.scheduledEndTimeUTC) {
        utcResult.scheduledEndTimeUTC = taskData.scheduledEndTimeUTC;
      }
      if (taskData.scheduledDuration) {
        utcResult.scheduledDuration = taskData.scheduledDuration;
      }
      
      return utcResult;
    } else if (taskData.scheduledDate && taskData.scheduledStartTime) {
      // Timed task - convert legacy format
      return this.convertTimedSchedulingToUTC(taskData, userTimezone);
    } else if (taskData.scheduledDate) {
      // All-day task - convert legacy format
      return this.convertAllDaySchedulingToUTC(taskData, userTimezone);
    }
    return result;
  }
  
  /**
   * Convert timed scheduling to UTC
   */
  private static convertTimedSchedulingToUTC(
    taskData: Partial<Task>,
    userTimezone: string
  ): {
    scheduledTimeUTC: string;
    scheduledEndTimeUTC?: string;
    scheduledTimezone: string;
    scheduledDuration?: number;
  } {
    const startDateTime = `${taskData.scheduledDate}T${taskData.scheduledStartTime}:00`;
    const startUTC = timezoneUtils.userTimeToUTC(startDateTime, userTimezone);
    
    const result = {
      scheduledTimeUTC: startUTC,
      scheduledTimezone: userTimezone
    };
    
    // Handle end time if present
    if (taskData.scheduledEndTime) {
      const endDateTime = `${taskData.scheduledDate}T${taskData.scheduledEndTime}:00`;
      const endUTC = timezoneUtils.userTimeToUTC(endDateTime, userTimezone);
      
      // Calculate duration in minutes
      const startMs = new Date(startUTC).getTime();
      const endMs = new Date(endUTC).getTime();
      const durationMinutes = Math.round((endMs - startMs) / (1000 * 60));
      
      return {
        ...result,
        scheduledEndTimeUTC: endUTC,
        scheduledDuration: durationMinutes
      };
    }
    
    return result;
  }
  
  /**
   * Convert all-day scheduling to UTC
   */
  private static convertAllDaySchedulingToUTC(
    taskData: Partial<Task>,
    userTimezone: string
  ): {
    scheduledTimeUTC: string;
    scheduledEndTimeUTC: string;
    scheduledTimezone: string;
  } {
    // For all-day events, store the date directly without timezone conversion
    // to avoid T-1 date offset issues. All-day events should preserve the calendar date exactly.
    try {
      // Validate the scheduled date format
      if (!taskData.scheduledDate || !/^\d{4}-\d{2}-\d{2}$/.test(taskData.scheduledDate)) {
        throw new Error(`Invalid scheduledDate format: ${taskData.scheduledDate}`);
      }

      // For all-day events, we store the date as midnight UTC to preserve the date
      // This avoids timezone conversion issues that cause T-1 date problems
      const allDayStartUTC = `${taskData.scheduledDate}T00:00:00.000Z`;
      const allDayEndUTC = `${taskData.scheduledDate}T23:59:59.999Z`; // End of the same day
      
      // Validate the resulting UTC strings
      const testStartDate = new Date(allDayStartUTC);
      const testEndDate = new Date(allDayEndUTC);
      if (isNaN(testStartDate.getTime()) || isNaN(testEndDate.getTime())) {
        throw new Error(`Invalid date created: ${allDayStartUTC} or ${allDayEndUTC}`);
      }
      
      return {
        scheduledTimeUTC: allDayStartUTC,
        scheduledEndTimeUTC: allDayEndUTC,
        scheduledTimezone: userTimezone
      };
    } catch (error) {
      console.error('❌ Failed to convert all-day scheduling to UTC:', error);
      console.error('Task data:', { scheduledDate: taskData.scheduledDate, userTimezone });
      
      // Fallback: create a valid UTC date string for today
      const fallbackDate = new Date().toISOString().split('T')[0];
      const fallbackStartUTC = `${fallbackDate}T00:00:00.000Z`;
      const fallbackEndUTC = `${fallbackDate}T23:59:59.999Z`;
      
      return {
        scheduledTimeUTC: fallbackStartUTC,
        scheduledEndTimeUTC: fallbackEndUTC,
        scheduledTimezone: userTimezone
      };
    }
  }
  
  /**
   * Check if task data has scheduling information
   */
  private static hasSchedulingData(taskData: Partial<Task>): boolean {
    return !!(
      taskData.scheduledDate || 
      taskData.scheduledStartTime || 
      taskData.scheduledEndTime || 
      taskData.scheduledTimeUTC
    );
  }
  
  /**
   * Check if the update is explicitly removing scheduling information
   * This detects when user clears the scheduled date fields
   */
  private static isRemovingScheduling(updates: Partial<Task>): boolean {
    // If scheduledTimeUTC is being explicitly set (from drag & drop), this is NOT removing scheduling
    if ('scheduledTimeUTC' in updates && updates.scheduledTimeUTC) {
      console.log('🔧 scheduledTimeUTC is being set, this is NOT removing scheduling');
      return false;
    }
    
    // Check if key scheduling fields are being explicitly set to null/undefined/empty
    const hasExplicitNullScheduling = (
      'scheduledDate' in updates && (!updates.scheduledDate || updates.scheduledDate === '') ||
      'scheduledStartTime' in updates && (!updates.scheduledStartTime || updates.scheduledStartTime === '') ||
      'scheduledEndTime' in updates && (!updates.scheduledEndTime || updates.scheduledEndTime === '') ||
      'scheduledTimeUTC' in updates && (!updates.scheduledTimeUTC || updates.scheduledTimeUTC === '')
    );
    
    // Also check if all scheduling fields are absent/empty in the update
    const hasNoSchedulingData = !this.hasSchedulingData(updates);
    
    return hasExplicitNullScheduling || (
      // If the update contains scheduling-related fields but they're all empty
      ('scheduledDate' in updates || 'scheduledStartTime' in updates || 'scheduledEndTime' in updates || 'scheduledTimeUTC' in updates) &&
      hasNoSchedulingData
    );
  }
  
  /**
   * Validate task data before storage
   */
  static validateTaskForStorage(taskData: Partial<Task>): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Required fields validation
    if (!taskData.title?.trim()) {
      errors.push('Task title is required');
    }
    
    if (!taskData.userId) {
      errors.push('User ID is required');
    }
    
    // Scheduling validation
    if (taskData.scheduledStartTime && !taskData.scheduledDate) {
      errors.push('Scheduled start time requires scheduled date');
    }
    
    if (taskData.scheduledEndTime && !taskData.scheduledStartTime) {
      errors.push('Scheduled end time requires scheduled start time');
    }
    
    // Time validation
    if (taskData.scheduledStartTime && taskData.scheduledEndTime) {
      const startTime = taskData.scheduledStartTime;
      const endTime = taskData.scheduledEndTime;
      
      if (startTime >= endTime) {
        errors.push('Scheduled end time must be after start time');
      }
    }
    
    // Duration validation
    if (taskData.timeEstimated && taskData.timeEstimated < 0) {
      warnings.push('Time estimated should not be negative');
    }
    
    if (taskData.timeSpent && taskData.timeSpent < 0) {
      warnings.push('Time spent should not be negative');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Get storage statistics for monitoring
   */
  static getStorageStats(tasksCreated: number, tasksUpdated: number): {
    created: number;
    updated: number;
    totalOperations: number;
    averageEnhancementTimeMs: number;
    utcFieldsAdded: number;
    legacyFieldsPreserved: number;
  } {
    // This would be populated by actual usage metrics
    return {
      created: tasksCreated,
      updated: tasksUpdated,
      totalOperations: tasksCreated + tasksUpdated,
      averageEnhancementTimeMs: 0.5, // Estimated enhancement overhead
      utcFieldsAdded: (tasksCreated + tasksUpdated) * 3, // createdAtUTC, updatedAtUTC, scheduledTimeUTC
      legacyFieldsPreserved: (tasksCreated + tasksUpdated) * 5 // legacy timestamp fields
    };
  }
  
  /**
   * Debug helper: analyze task enhancement
   */
  static debugTaskEnhancement(
    taskData: Partial<Task>,
    userTimezone?: string
  ): {
    original: Partial<Task>;
    enhanced: TaskEnhanced;
    fieldsAdded: string[];
    schedulingConversion?: {
      from: { date?: string; startTime?: string; endTime?: string };
      to: { utcStart?: string; utcEnd?: string; duration?: number };
    };
  } {
    const timezone = userTimezone || timezoneUtils.getCurrentTimezone();
    const now = new Date();
    
    const enhanced = this.enhanceTaskForStorage(taskData, timezone, now);
    
    const fieldsAdded: string[] = [];
    
    // Track which fields were added
    if (!taskData.createdAtUTC && enhanced.createdAtUTC) {
      fieldsAdded.push('createdAtUTC');
    }
    if (!taskData.updatedAtUTC && enhanced.updatedAtUTC) {
      fieldsAdded.push('updatedAtUTC');
    }
    if (!taskData.scheduledTimeUTC && enhanced.scheduledTimeUTC) {
      fieldsAdded.push('scheduledTimeUTC');
    }
    if (!taskData.timezoneContext && enhanced.timezoneContext) {
      fieldsAdded.push('timezoneContext');
    }
    
    // Track scheduling conversion
    let schedulingConversion;
    if (this.hasSchedulingData(taskData) && enhanced.scheduledTimeUTC) {
      schedulingConversion = {
        from: {
          date: taskData.scheduledDate,
          startTime: taskData.scheduledStartTime,
          endTime: taskData.scheduledEndTime
        },
        to: {
          utcStart: enhanced.scheduledTimeUTC,
          utcEnd: enhanced.scheduledEndTimeUTC,
          duration: enhanced.scheduledDuration
        }
      };
    }
    
    return {
      original: taskData,
      enhanced,
      fieldsAdded,
      schedulingConversion
    };
  }
}