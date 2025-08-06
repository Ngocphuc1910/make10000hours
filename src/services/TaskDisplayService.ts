import { timezoneUtils } from '../utils/timezoneUtils';
import { format } from 'date-fns';
import { TaskNormalizationService } from './TaskNormalizationService';
import type { Task } from '../types/models';
import type { TaskNormalized, TaskDisplay } from '../types/taskEnhanced';

/**
 * Service for converting UTC task data to display format in user's timezone
 * Handles the final step of showing proper times to users
 */
export class TaskDisplayService {
  
  /**
   * Convert any task to display format in user's current timezone
   * This is the main method used by UI components
   */
  static convertForDisplay(task: Task, userTimezone?: string): TaskDisplay {
    try {
      // Validate input task
      if (!task || typeof task !== 'object' || !task.id) {
        console.warn('Invalid task provided to convertForDisplay:', task);
        return this.createFallbackDisplay(task);
      }
      
      const timezone = userTimezone || timezoneUtils.getCurrentTimezone();
      
      // Validate timezone
      if (!timezone || typeof timezone !== 'string') {
        console.warn('Invalid timezone for convertForDisplay:', timezone);
        return this.createFallbackDisplay(task);
      }
      
      // First normalize the task to ensure UTC fields
      const normalized = TaskNormalizationService.normalize(task);
      
      // Then convert to display format
      return this.convertNormalizedForDisplay(normalized, timezone);
    } catch (error) {
      console.warn('Critical error in convertForDisplay:', {
        taskId: task?.id,
        taskTitle: task?.title,
        userTimezone,
        error: error.message
      });
      
      return this.createFallbackDisplay(task);
    }
  }
  
  /**
   * Batch convert multiple tasks for display
   */
  static batchConvertForDisplay(tasks: Task[], userTimezone?: string): TaskDisplay[] {
    try {
      if (!tasks || !Array.isArray(tasks)) {
        console.warn('Invalid tasks array provided to batchConvertForDisplay:', tasks);
        return [];
      }
      
      const timezone = userTimezone || timezoneUtils.getCurrentTimezone();
      console.log(`🔄 Converting ${tasks.length} tasks to timezone: ${timezone}`);
      
      // Normalize all tasks first
      const normalized = TaskNormalizationService.batchNormalize(tasks);
      
      // Convert each task individually with error handling
      const results: TaskDisplay[] = [];
      let errorCount = 0;
      
      normalized.forEach((task, index) => {
        try {
          const displayTask = this.convertNormalizedForDisplay(task, timezone);
          results.push(displayTask);
        } catch (error) {
          errorCount++;
          console.warn(`Failed to convert task ${index + 1} (${task.title}):`, error.message);
          
          // Add fallback display
          results.push(this.createFallbackDisplay(task));
        }
      });
      
      if (errorCount > 0) {
        console.log(`⚠️ Conversion completed with ${errorCount} errors out of ${tasks.length} tasks`);
      } else {
        console.log(`✅ Successfully converted all ${tasks.length} tasks`);
      }
      
      return results;
    } catch (error) {
      console.error('Critical error in batchConvertForDisplay:', error);
      
      // Return fallback displays for all tasks
      return tasks.map(task => this.createFallbackDisplay(task));
    }
  }
  
  /**
   * Convert normalized task to display format
   */
  private static convertNormalizedForDisplay(task: TaskNormalized, userTimezone: string): TaskDisplay {
    const display: TaskDisplay = {
      ...task,
      displayTimezone: userTimezone,
      displayTimezoneOffset: this.getTimezoneOffset(userTimezone)
    };
    
    // Convert scheduling to user's timezone if present
    if (task.scheduledTimeUTC) {
      const schedulingDisplay = this.convertSchedulingForDisplay(task, userTimezone);
      Object.assign(display, schedulingDisplay);
    }
    
    return display;
  }
  
  /**
   * Convert UTC scheduling to user's timezone for display
   */
  private static convertSchedulingForDisplay(task: TaskNormalized, userTimezone: string): {
    displayScheduledDate?: string;
    displayScheduledTime?: string;
    displayScheduledEndTime?: string;
    displayScheduledDateFormatted?: string;
    displayScheduledTimeFormatted?: string;
    displayScheduledEndTimeFormatted?: string;
    displayDuration?: string;
  } {
    if (!task.scheduledTimeUTC) {
      return {};
    }
    
    try {
      // Validate inputs first
      if (!task.scheduledTimeUTC || typeof task.scheduledTimeUTC !== 'string') {
        console.warn('Invalid scheduledTimeUTC:', task.scheduledTimeUTC);
        return this.fallbackSchedulingDisplay(task);
      }
      
      if (!userTimezone || typeof userTimezone !== 'string') {
        console.warn('Invalid userTimezone:', userTimezone);
        return this.fallbackSchedulingDisplay(task);
      }
      
      // Validate UTC time format (should be ISO string)
      const utcDate = new Date(task.scheduledTimeUTC);
      if (isNaN(utcDate.getTime())) {
        console.warn('Invalid UTC date string:', task.scheduledTimeUTC);
        return this.fallbackSchedulingDisplay(task);
      }
      
      // For all-day events (tasks without includeTime), preserve the original date without timezone conversion
      // All-day events should show on the same calendar date regardless of timezone
      if (task.includeTime === false) {
        // Extract date directly from UTC string without timezone conversion
        const utcDateOnly = task.scheduledTimeUTC.split('T')[0]; // "2025-08-11T00:00:00.000Z" → "2025-08-11"
        const dateOnlyFormatted = format(new Date(utcDateOnly + 'T12:00:00'), 'PPP'); // Use noon to avoid timezone issues
        
        const result = {
          displayScheduledDate: utcDateOnly,
          displayScheduledTime: 'All day',
          displayScheduledDateFormatted: dateOnlyFormatted,
          displayScheduledTimeFormatted: 'All day'
        };
        
        return result;
      }
      
      // For timed events, convert UTC to user's timezone
      const localDateTime = timezoneUtils.utcToUserTime(task.scheduledTimeUTC, userTimezone);
      
      // Validate conversion result
      if (isNaN(localDateTime.getTime())) {
        console.warn('UTC to local conversion failed for:', task.scheduledTimeUTC, 'timezone:', userTimezone);
        return this.fallbackSchedulingDisplay(task);
      }
      
      const result = {
        displayScheduledDate: format(localDateTime, 'yyyy-MM-dd'),
        displayScheduledTime: format(localDateTime, 'HH:mm'),
        displayScheduledDateFormatted: format(localDateTime, 'PPP'), // "January 15th, 2024"
        displayScheduledTimeFormatted: format(localDateTime, 'p'),   // "2:00 PM"
      };
      
      // Convert UTC end time to user's timezone if available
      if (task.scheduledEndTimeUTC) {
        // Validate end time format
        const utcEndDate = new Date(task.scheduledEndTimeUTC);
        if (isNaN(utcEndDate.getTime())) {
          console.warn('Invalid UTC end date string:', task.scheduledEndTimeUTC);
          // Skip end time conversion but continue with start time
        } else {
          const localEndDateTime = timezoneUtils.utcToUserTime(task.scheduledEndTimeUTC, userTimezone);
          
          if (!isNaN(localEndDateTime.getTime())) {
            result.displayScheduledEndTime = format(localEndDateTime, 'HH:mm');
            result.displayScheduledEndTimeFormatted = format(localEndDateTime, 'p'); // "4:00 PM"
            
            // Calculate duration from converted start/end times
            const durationMs = localEndDateTime.getTime() - localDateTime.getTime();
            const durationMinutes = Math.round(durationMs / (1000 * 60));
            if (durationMinutes > 0) {
              result.displayDuration = this.formatDuration(durationMinutes);
            }
          } else {
            console.warn('UTC end time to local conversion failed for:', task.scheduledEndTimeUTC);
          }
        }
      } else if (task.scheduledDuration && typeof task.scheduledDuration === 'number') {
        // Use stored duration if no end time
        result.displayDuration = this.formatDuration(task.scheduledDuration);
      }
      
      return result;
    } catch (error) {
      console.warn('Failed to convert scheduling for display:', {
        error: error.message,
        taskId: task.id,
        scheduledTimeUTC: task.scheduledTimeUTC,
        scheduledEndTimeUTC: task.scheduledEndTimeUTC,
        userTimezone: userTimezone
      });
      
      // Fallback to legacy display if conversion fails
      return this.fallbackSchedulingDisplay(task);
    }
  }
  
  /**
   * Fallback scheduling display for when UTC conversion fails
   */
  private static fallbackSchedulingDisplay(task: TaskNormalized): {
    displayScheduledDate?: string;
    displayScheduledTime?: string;
    displayScheduledEndTime?: string;
    displayScheduledDateFormatted?: string;
    displayScheduledTimeFormatted?: string;
    displayScheduledEndTimeFormatted?: string;
  } {
    // Use legacy fields if available
    if (task.scheduledDate) {
      const result = {
        displayScheduledDate: task.scheduledDate,
        displayScheduledTime: task.scheduledStartTime || undefined,
        displayScheduledEndTime: task.scheduledEndTime || undefined,
        displayScheduledDateFormatted: task.scheduledDate ? 
          format(new Date(`${task.scheduledDate}T00:00:00`), 'PPP') : undefined,
        displayScheduledTimeFormatted: task.scheduledStartTime || undefined,
        displayScheduledEndTimeFormatted: task.scheduledEndTime || undefined
      };
      
      return result;
    }
    
    return {};
  }
  
  /**
   * Format duration in human-readable format
   */
  private static formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (remainingMinutes === 0) {
      return `${hours}h`;
    }
    
    return `${hours}h ${remainingMinutes}m`;
  }
  
  /**
   * Get timezone offset string (e.g., "UTC+7", "UTC-5")
   */
  private static getTimezoneOffset(timezone: string): string {
    try {
      // Validate timezone parameter
      if (!timezone || typeof timezone !== 'string') {
        console.warn('Invalid timezone parameter:', timezone);
        return 'UTC+0';
      }
      
      const now = new Date();
      
      // Validate timezone by trying to create a formatter
      let formatter: Intl.DateTimeFormat;
      try {
        formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
      } catch (timezoneError) {
        console.warn('Invalid timezone specified:', timezone, timezoneError);
        return 'UTC+0';
      }
      
      const parts = formatter.formatToParts(now);
      const yearPart = parts.find(p => p.type === 'year')?.value;
      const monthPart = parts.find(p => p.type === 'month')?.value;
      const dayPart = parts.find(p => p.type === 'day')?.value;
      const hourPart = parts.find(p => p.type === 'hour')?.value;
      const minutePart = parts.find(p => p.type === 'minute')?.value;
      const secondPart = parts.find(p => p.type === 'second')?.value;
      
      // Validate all parts are present
      if (!yearPart || !monthPart || !dayPart || !hourPart || !minutePart || !secondPart) {
        console.warn('Failed to parse timezone parts for:', timezone);
        return 'UTC+0';
      }
      
      const localTimeString = `${yearPart}-${monthPart}-${dayPart}T${hourPart}:${minutePart}:${secondPart}`;
      const localTime = new Date(localTimeString);
      
      // Validate the constructed date
      if (isNaN(localTime.getTime())) {
        console.warn('Invalid constructed local time string:', localTimeString);
        return 'UTC+0';
      }
      
      const offsetMs = localTime.getTime() - now.getTime();
      const offsetHours = Math.round(offsetMs / (1000 * 60 * 60));
      
      if (offsetHours >= 0) {
        return `UTC+${offsetHours}`;
      } else {
        return `UTC${offsetHours}`;
      }
    } catch (error) {
      console.warn('Failed to get timezone offset for timezone:', timezone, 'Error:', error);
      return 'UTC+0';
    }
  }
  
  /**
   * Get current time in user's timezone for display
   */
  static getCurrentTimeInTimezone(userTimezone?: string): {
    date: string;           // "2024-01-15"
    time: string;           // "14:30"
    formatted: string;      // "January 15, 2024 at 2:30 PM"
    timezone: string;       // "Asia/Ho_Chi_Minh"
    offset: string;         // "UTC+7"
  } {
    const timezone = userTimezone || timezoneUtils.getCurrentTimezone();
    const now = new Date();
    
    try {
      // Format current time in user's timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      
      const parts = formatter.formatToParts(now);
      const date = `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}`;
      const time = `${parts.find(p => p.type === 'hour')?.value}:${parts.find(p => p.type === 'minute')?.value}`;
      
      // Human-readable format
      const readableFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        dateStyle: 'long',
        timeStyle: 'short'
      });
      
      return {
        date,
        time,
        formatted: readableFormatter.format(now),
        timezone,
        offset: this.getTimezoneOffset(timezone)
      };
    } catch (error) {
      console.warn('Failed to get current time in timezone:', error);
      
      // Fallback to local time
      return {
        date: format(now, 'yyyy-MM-dd'),
        time: format(now, 'HH:mm'),
        formatted: format(now, 'PPP p'),
        timezone: 'Local',
        offset: 'Unknown'
      };
    }
  }
  
  /**
   * Compare task scheduling across different timezones (for debugging)
   */
  static compareTaskAcrossTimezones(task: Task, timezones: string[]): {
    timezone: string;
    display: TaskDisplay;
  }[] {
    return timezones.map(timezone => ({
      timezone,
      display: this.convertForDisplay(task, timezone)
    }));
  }
  
  /**
   * Get display statistics for debugging
   */
  static getDisplayStats(tasks: Task[], userTimezone?: string): {
    total: number;
    withScheduling: number;
    displayConversions: number;
    errors: number;
    averageConversionTimeMs: number;
  } {
    const startTime = performance.now();
    let errors = 0;
    
    const displayTasks = tasks.map(task => {
      try {
        return this.convertForDisplay(task, userTimezone);
      } catch (error) {
        errors++;
        return null;
      }
    }).filter(Boolean) as TaskDisplay[];
    
    const endTime = performance.now();
    
    return {
      total: tasks.length,
      withScheduling: displayTasks.filter(t => !!t.displayScheduledDate).length,
      displayConversions: displayTasks.length,
      errors,
      averageConversionTimeMs: tasks.length > 0 ? 
        Math.round((endTime - startTime) / tasks.length * 1000) / 1000 : 0
    };
  }
  
  /**
   * Create a fallback display when conversion fails
   */
  private static createFallbackDisplay(task: Task): TaskDisplay {
    const fallback: TaskDisplay = {
      ...task,
      dataFormat: 'legacy',
      createdAtUTC: task.createdAt || new Date().toISOString(),
      updatedAtUTC: task.updatedAt || new Date().toISOString(),
      displayTimezone: 'Local',
      displayTimezoneOffset: 'Unknown'
    };
    
    // Add basic scheduling display if available
    if (task.scheduledDate) {
      fallback.displayScheduledDate = task.scheduledDate;
      fallback.displayScheduledTime = task.scheduledStartTime || undefined;
      fallback.displayScheduledEndTime = task.scheduledEndTime || undefined;
    }
    
    return fallback;
  }
  
  /**
   * Validate display conversion results
   */
  static validateDisplayConversion(original: Task, display: TaskDisplay): {
    isValid: boolean;
    issues: string[];
    warnings: string[];
  } {
    const issues: string[] = [];
    const warnings: string[] = [];
    
    // Check that essential fields are preserved
    if (original.id !== display.id) issues.push('Task ID mismatch');
    if (original.title !== display.title) issues.push('Task title mismatch');
    
    // Check scheduling conversion consistency
    if (original.scheduledDate && !display.displayScheduledDate) {
      warnings.push('Original had scheduledDate but display has no displayScheduledDate');
    }
    
    if (display.scheduledTimeUTC && !display.displayScheduledDate) {
      issues.push('Has UTC scheduling but no display scheduling');
    }
    
    // Check timezone consistency
    if (display.displayTimezone && !display.displayTimezoneOffset) {
      warnings.push('Has display timezone but no offset');
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      warnings
    };
  }
}