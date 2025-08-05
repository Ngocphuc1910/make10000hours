import { timezoneUtils } from '../utils/timezoneUtils';
import { TaskNormalizationService } from './TaskNormalizationService';
import type { Task } from '../types/models';
import type { TaskNormalized } from '../types/taskEnhanced';

/**
 * Service for filtering tasks with timezone awareness
 * Handles today's task filtering using normalized UTC data
 */
export class TaskFilteringService {
  
  /**
   * Get tasks scheduled for today in user's timezone
   * This is the main method that replaces all existing getTodayDate filtering
   */
  static getTodaysTasks(tasks: Task[], userTimezone?: string): Task[] {
    const timezone = userTimezone || timezoneUtils.getCurrentTimezone();
    const todayRange = this.getTodayRange(timezone);
    
    // Normalize all tasks first
    const normalizedTasks = TaskNormalizationService.batchNormalize(tasks);
    
    // Filter tasks for today
    return this.filterTasksForDateRange(normalizedTasks, todayRange);
  }
  
  /**
   * Filter tasks by view mode with timezone awareness
   */
  static filterTasksByViewMode(
    tasks: Task[], 
    viewMode: 'pomodoro' | 'today',
    userTimezone?: string
  ): Task[] {
    if (viewMode === 'pomodoro') {
      return this.getPomodoroTasks(tasks);
    } else {
      return this.getTodaysTasks(tasks, userTimezone);
    }
  }
  
  /**
   * Get tasks in pomodoro status (no timezone filtering needed)
   */
  static getPomodoroTasks(tasks: Task[]): Task[] {
    return tasks.filter(task => {
      // Show tasks in pomodoro
      if (task.status === 'pomodoro') return true;
      
      // Show completed tasks that are still visible
      if (task.status === 'completed' && task.completed) return true;
      
      return false;
    });
  }
  
  /**
   * Get today's date range in user's timezone
   */
  private static getTodayRange(userTimezone: string): {
    startUTC: string;
    endUTC: string;
    localDate: string;
  } {
    const now = new Date();
    
    // Get today's date in user's timezone
    const localDateString = timezoneUtils.formatDateInTimezone(now, userTimezone, 'yyyy-MM-dd');
    
    // Get start of day in user's timezone, then convert to UTC
    const startOfDayLocal = timezoneUtils.createDateInTimezone(
      `${localDateString}T00:00:00`,
      userTimezone
    );
    
    // Get end of day in user's timezone, then convert to UTC
    const endOfDayLocal = timezoneUtils.createDateInTimezone(
      `${localDateString}T23:59:59`,
      userTimezone
    );
    
    return {
      startUTC: startOfDayLocal.toISOString(),
      endUTC: endOfDayLocal.toISOString(),
      localDate: localDateString
    };
  }
  
  /**
   * Filter normalized tasks for a specific UTC date range
   */
  private static filterTasksForDateRange(
    normalizedTasks: TaskNormalized[],
    dateRange: { startUTC: string; endUTC: string; localDate: string }
  ): Task[] {
    return normalizedTasks.filter(task => {
      // Check if task is scheduled for today
      if (this.isTaskScheduledInRange(task, dateRange)) {
        return true;
      }
      
      // For completed tasks, check both scheduling and completion
      if (task.status === 'completed' && task.completed) {
        // If scheduled for today, include it
        if (this.isTaskScheduledInRange(task, dateRange)) {
          return true;
        }
        
        // If no scheduling but completed, use legacy logic
        if (!task.scheduledTimeUTC && !task.scheduledDate) {
          return true;
        }
      }
      
      return false;
    });
  }
  
  /**
   * Check if normalized task is scheduled within the given UTC range
   */
  private static isTaskScheduledInRange(
    task: TaskNormalized,
    dateRange: { startUTC: string; endUTC: string; localDate: string }
  ): boolean {
    // Check UTC scheduling first (new format)
    if (task.scheduledTimeUTC) {
      const scheduledTime = new Date(task.scheduledTimeUTC);
      const rangeStart = new Date(dateRange.startUTC);
      const rangeEnd = new Date(dateRange.endUTC);
      
      return scheduledTime >= rangeStart && scheduledTime <= rangeEnd;
    }
    
    // Fallback to legacy date-only scheduling
    if (task.scheduledDate) {
      return task.scheduledDate === dateRange.localDate;
    }
    
    return false;
  }
  
  /**
   * Get tasks scheduled for a specific date
   */
  static getTasksForDate(
    tasks: Task[], 
    targetDate: string, // YYYY-MM-DD format
    userTimezone?: string
  ): Task[] {
    const timezone = userTimezone || timezoneUtils.getCurrentTimezone();
    
    // Create date range for the target date
    const startOfDayLocal = timezoneUtils.createDateInTimezone(
      `${targetDate}T00:00:00`,
      timezone
    );
    
    const endOfDayLocal = timezoneUtils.createDateInTimezone(
      `${targetDate}T23:59:59`,
      timezone
    );
    
    const dateRange = {
      startUTC: startOfDayLocal.toISOString(),
      endUTC: endOfDayLocal.toISOString(),
      localDate: targetDate
    };
    
    // Normalize and filter tasks
    const normalizedTasks = TaskNormalizationService.batchNormalize(tasks);
    return this.filterTasksForDateRange(normalizedTasks, dateRange);
  }
  
  /**
   * Get tasks scheduled within a date range
   */
  static getTasksInDateRange(
    tasks: Task[],
    startDate: string, // YYYY-MM-DD format
    endDate: string,   // YYYY-MM-DD format
    userTimezone?: string
  ): Task[] {
    const timezone = userTimezone || timezoneUtils.getCurrentTimezone();
    
    // Create UTC range from local dates
    const rangeStartLocal = timezoneUtils.createDateInTimezone(
      `${startDate}T00:00:00`,
      timezone
    );
    
    const rangeEndLocal = timezoneUtils.createDateInTimezone(
      `${endDate}T23:59:59`,
      timezone
    );
    
    // Normalize tasks first
    const normalizedTasks = TaskNormalizationService.batchNormalize(tasks);
    
    return normalizedTasks.filter(task => {
      // Check UTC scheduling
      if (task.scheduledTimeUTC) {
        const scheduledTime = new Date(task.scheduledTimeUTC);
        return scheduledTime >= rangeStartLocal && scheduledTime <= rangeEndLocal;
      }
      
      // Fallback to legacy date comparison
      if (task.scheduledDate) {
        return task.scheduledDate >= startDate && task.scheduledDate <= endDate;
      }
      
      return false;
    });
  }
  
  /**
   * Get overdue tasks (scheduled before today but not completed)
   */
  static getOverdueTasks(tasks: Task[], userTimezone?: string): Task[] {
    const timezone = userTimezone || timezoneUtils.getCurrentTimezone();
    const todayRange = this.getTodayRange(timezone);
    
    // Normalize tasks first
    const normalizedTasks = TaskNormalizationService.batchNormalize(tasks);
    
    return normalizedTasks.filter(task => {
      // Skip completed tasks
      if (task.status === 'completed' && task.completed) {
        return false;
      }
      
      // Check if scheduled before today
      if (task.scheduledTimeUTC) {
        const scheduledTime = new Date(task.scheduledTimeUTC);
        const todayStart = new Date(todayRange.startUTC);
        return scheduledTime < todayStart;
      }
      
      // Legacy date comparison
      if (task.scheduledDate) {
        return task.scheduledDate < todayRange.localDate;
      }
      
      return false;
    });
  }
  
  /**
   * Get upcoming tasks (scheduled after today)
   */
  static getUpcomingTasks(tasks: Task[], userTimezone?: string): Task[] {
    const timezone = userTimezone || timezoneUtils.getCurrentTimezone();
    const todayRange = this.getTodayRange(timezone);
    
    // Normalize tasks first
    const normalizedTasks = TaskNormalizationService.batchNormalize(tasks);
    
    return normalizedTasks.filter(task => {
      // Check if scheduled after today
      if (task.scheduledTimeUTC) {
        const scheduledTime = new Date(task.scheduledTimeUTC);
        const todayEnd = new Date(todayRange.endUTC);
        return scheduledTime > todayEnd;
      }
      
      // Legacy date comparison
      if (task.scheduledDate) {
        return task.scheduledDate > todayRange.localDate;
      }
      
      return false;
    });
  }
  
  /**
   * Get unscheduled tasks (no scheduling information)
   */
  static getUnscheduledTasks(tasks: Task[]): Task[] {
    const normalizedTasks = TaskNormalizationService.batchNormalize(tasks);
    
    return normalizedTasks.filter(task => {
      return !task.scheduledTimeUTC && !task.scheduledDate;
    });
  }
  
  /**
   * Get filtering statistics for debugging
   */
  static getFilteringStats(
    tasks: Task[], 
    userTimezone?: string
  ): {
    total: number;
    todaysTasks: number;
    overdueTasks: number;
    upcomingTasks: number;
    unscheduledTasks: number;
    pomodoroTasks: number;
    completedTasks: number;
    performanceMs: number;
  } {
    const startTime = performance.now();
    
    const stats = {
      total: tasks.length,
      todaysTasks: this.getTodaysTasks(tasks, userTimezone).length,
      overdueTasks: this.getOverdueTasks(tasks, userTimezone).length,
      upcomingTasks: this.getUpcomingTasks(tasks, userTimezone).length,
      unscheduledTasks: this.getUnscheduledTasks(tasks).length,
      pomodoroTasks: this.getPomodoroTasks(tasks).length,
      completedTasks: tasks.filter(t => t.status === 'completed' && t.completed).length,
      performanceMs: 0
    };
    
    stats.performanceMs = Math.round(performance.now() - startTime);
    return stats;
  }
  
  /**
   * Debug helper: analyze task filtering for a specific task
   */
  static debugTaskFiltering(
    task: Task,
    userTimezone?: string
  ): {
    task: Task;
    normalized: TaskNormalized;
    timezone: string;
    todayRange: ReturnType<typeof TaskFilteringService.getTodayRange>;
    isToday: boolean;
    isOverdue: boolean;
    isUpcoming: boolean;
    isUnscheduled: boolean;
    reasoning: string[];
  } {
    const timezone = userTimezone || timezoneUtils.getCurrentTimezone();
    const todayRange = this.getTodayRange(timezone);
    const normalized = TaskNormalizationService.normalize(task);
    
    const reasoning: string[] = [];
    
    const isToday = this.isTaskScheduledInRange(normalized, todayRange);
    if (isToday) reasoning.push('Task is scheduled for today');
    
    const isOverdue = normalized.scheduledTimeUTC ? 
      new Date(normalized.scheduledTimeUTC) < new Date(todayRange.startUTC) :
      (normalized.scheduledDate || '') < todayRange.localDate;
    if (isOverdue) reasoning.push('Task is overdue');
    
    const isUpcoming = normalized.scheduledTimeUTC ?
      new Date(normalized.scheduledTimeUTC) > new Date(todayRange.endUTC) :
      (normalized.scheduledDate || '') > todayRange.localDate;
    if (isUpcoming) reasoning.push('Task is upcoming');
    
    const isUnscheduled = !normalized.scheduledTimeUTC && !normalized.scheduledDate;
    if (isUnscheduled) reasoning.push('Task is unscheduled');
    
    return {
      task,
      normalized,
      timezone,
      todayRange,
      isToday,
      isOverdue,
      isUpcoming,
      isUnscheduled,
      reasoning
    };
  }
}