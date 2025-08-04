import { Task, Project } from '../../types/models';
import { CalendarEvent, DropResult, DragItem } from './types';
import { isSameDay, addMinutes, format } from 'date-fns';
import { timezoneUtils } from '../../utils/timezoneUtils';
import { utcFeatureFlags } from '../../services/featureFlags';
import { utcMonitoring } from '../../services/monitoring';
import type { TaskUTC } from '../../types/utcModels';

/**
 * Enhanced task-to-calendar-event converter that handles both UTC and legacy tasks
 */
export const taskToCalendarEventUTC = (
  task: Task | TaskUTC, 
  project?: Project,
  userTimezone?: string
): CalendarEvent | null => {
  const timezone = userTimezone || timezoneUtils.getCurrentTimezone();
  
  try {
    // Check if this is a UTC task with UTC scheduling fields
    const utcTask = task as TaskUTC;
    const hasUTCFields = utcTask.scheduledStartTimeUTC || utcTask.scheduledEndTimeUTC;
    
    if (hasUTCFields) {
      return createCalendarEventFromUTC(utcTask, project, timezone);
    } else {
      // Fallback to legacy conversion for backward compatibility
      return createCalendarEventFromLegacy(task, project, timezone);
    }
  } catch (error) {
    console.error('Failed to convert task to calendar event:', error);
    utcMonitoring.trackOperation('calendar_task_conversion', false);
    
    // Fallback to legacy conversion
    return createCalendarEventFromLegacy(task, project, timezone);
  }
};

/**
 * Create calendar event from UTC task fields
 */
function createCalendarEventFromUTC(
  task: TaskUTC, 
  project?: Project,
  userTimezone: string = 'UTC'
): CalendarEvent | null {
  if (!task.scheduledStartTimeUTC) {
    return null;
  }

  const eventId = `task-utc-${task.id}`;
  const eventTitle = task.title;
  const eventDescription = task.description;
  const projectName = project?.name || 'No Project';
  const projectColor = project?.color || '#6B7280';
  const isCompleted = task.completed || task.status === 'completed';

  try {
    // Convert UTC times to user's local timezone for display
    const startDate = timezoneUtils.utcToUserTime(task.scheduledStartTimeUTC, userTimezone);
    
    let endDate: Date;
    if (task.scheduledEndTimeUTC) {
      endDate = timezoneUtils.utcToUserTime(task.scheduledEndTimeUTC, userTimezone);
    } else {
      // Default to 1 hour duration if no end time
      endDate = new Date(startDate.getTime() + (60 * 60 * 1000));
    }

    // Determine if this is an all-day event
    const startUTCDate = new Date(task.scheduledStartTimeUTC);
    const endUTCDate = task.scheduledEndTimeUTC ? new Date(task.scheduledEndTimeUTC) : null;
    
    // Check if this spans full day boundaries in UTC
    const isAllDay = isUTCAllDayEvent(startUTCDate, endUTCDate);

    const calendarEvent: CalendarEvent = {
      id: eventId,
      title: eventTitle,
      description: eventDescription,
      project: projectName,
      color: projectColor,
      start: startDate,
      end: endDate,
      isAllDay,
      taskId: task.id,
      isTask: true,
      isDraggable: true,
      isCompleted,
      completedAt: isCompleted ? task.updatedAt : undefined,
      // Add UTC metadata for drag operations
      utcMetadata: {
        startTimeUTC: task.scheduledStartTimeUTC,
        endTimeUTC: task.scheduledEndTimeUTC,
        timezone: userTimezone,
        hasUTCFields: true,
        timezoneContext: task.timezoneContext
      }
    };

    utcMonitoring.trackOperation('calendar_utc_task_conversion', true);
    return calendarEvent;

  } catch (error) {
    console.error('Failed to convert UTC task to calendar event:', error);
    utcMonitoring.trackOperation('calendar_utc_task_conversion', false);
    return null;
  }
}

/**
 * Create calendar event from legacy task fields (backward compatibility)
 */
function createCalendarEventFromLegacy(
  task: Task,
  project?: Project,
  userTimezone: string = 'UTC'
): CalendarEvent | null {
  // Only convert tasks that have a scheduled date
  if (!task.scheduledDate) {
    return null;
  }

  const eventId = `task-legacy-${task.id}`;
  const eventTitle = task.title;
  const eventDescription = task.description;
  const projectName = project?.name || 'No Project';
  const projectColor = project?.color || '#6B7280';
  const isCompleted = task.completed || task.status === 'completed';

  try {
    // Parse the scheduled date
    const scheduledDate = new Date(task.scheduledDate);
    
    // If task doesn't include specific time, make it an all-day event
    if (!task.includeTime || !task.scheduledStartTime || !task.scheduledEndTime) {
      return {
        id: eventId,
        title: eventTitle,
        description: eventDescription,
        project: projectName,
        color: projectColor,
        start: scheduledDate,
        end: scheduledDate,
        isAllDay: true,
        taskId: task.id,
        isTask: true,
        isDraggable: true,
        isCompleted,
        completedAt: isCompleted ? task.updatedAt : undefined,
        utcMetadata: {
          hasUTCFields: false,
          timezone: userTimezone,
          legacyScheduledDate: task.scheduledDate,
          legacyIncludeTime: task.includeTime
        }
      };
    }

    // Parse start and end times
    const [startHour, startMinute] = task.scheduledStartTime.split(':').map(Number);
    const [endHour, endMinute] = task.scheduledEndTime.split(':').map(Number);

    // Create start and end dates with specified times
    const startDate = new Date(scheduledDate);
    startDate.setHours(startHour, startMinute, 0, 0);

    const endDate = new Date(scheduledDate);
    endDate.setHours(endHour, endMinute, 0, 0);

    // If end time is before start time, assume it's the next day
    if (endDate < startDate) {
      endDate.setDate(endDate.getDate() + 1);
    }

    return {
      id: eventId,
      title: eventTitle,
      description: eventDescription,
      project: projectName,
      color: projectColor,
      start: startDate,
      end: endDate,
      isAllDay: false,
      taskId: task.id,
      isTask: true,
      isDraggable: true,
      isCompleted,
      completedAt: isCompleted ? task.updatedAt : undefined,
      utcMetadata: {
        hasUTCFields: false,
        timezone: userTimezone,
        legacyScheduledDate: task.scheduledDate,
        legacyScheduledStartTime: task.scheduledStartTime,
        legacyScheduledEndTime: task.scheduledEndTime,
        legacyIncludeTime: task.includeTime
      }
    };

  } catch (error) {
    console.error('Failed to convert legacy task to calendar event:', error);
    utcMonitoring.trackOperation('calendar_legacy_task_conversion', false);
    return null;
  }
}

/**
 * Check if UTC times represent an all-day event
 */
function isUTCAllDayEvent(startUTC: Date, endUTC: Date | null): boolean {
  if (!endUTC) return false;
  
  // Check if times are exactly at day boundaries (00:00:00)
  const startIsStartOfDay = startUTC.getUTCHours() === 0 && 
                           startUTC.getUTCMinutes() === 0 && 
                           startUTC.getUTCSeconds() === 0;
  
  const endIsStartOfDay = endUTC.getUTCHours() === 0 && 
                         endUTC.getUTCMinutes() === 0 && 
                         endUTC.getUTCSeconds() === 0;
  
  // Check if it spans exactly 24 hours or full days
  const durationHours = (endUTC.getTime() - startUTC.getTime()) / (1000 * 60 * 60);
  const isFullDayDuration = durationHours % 24 === 0 && durationHours >= 24;
  
  return startIsStartOfDay && endIsStartOfDay && isFullDayDuration;
}

/**
 * Convert multiple tasks to calendar events with UTC support
 */
export const tasksToCalendarEventsUTC = (
  tasks: (Task | TaskUTC)[], 
  projects: Project[],
  userTimezone?: string
): CalendarEvent[] => {
  const timezone = userTimezone || timezoneUtils.getCurrentTimezone();
  const events: CalendarEvent[] = [];
  
  // Create a map of projects for quick lookup
  const projectMap = new Map<string, Project>();
  projects.forEach(project => {
    projectMap.set(project.id, project);
  });

  // Convert each task with scheduled date to calendar event
  tasks.forEach(task => {
    const project = projectMap.get(task.projectId);
    const event = taskToCalendarEventUTC(task, project, timezone);
    if (event) {
      events.push(event);
    }
  });

  return events;
};

/**
 * Enhanced event time calculation with UTC support
 */
export const calculateNewEventTimeUTC = (
  originalEvent: CalendarEvent,
  dropResult: DropResult,
  userTimezone?: string
): { 
  start: Date; 
  end: Date; 
  utcStart?: string; 
  utcEnd?: string;
  updateData: any;
} => {
  const timezone = userTimezone || timezoneUtils.getCurrentTimezone();
  
  try {
    // Calculate local times (for display)
    const actualDuration = originalEvent.end.getTime() - originalEvent.start.getTime();
    
    let start: Date;
    let end: Date;
    
    if (dropResult.isAllDay) {
      // For all-day drops, move to target date as all-day
      start = new Date(dropResult.targetDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(end.getDate() + 1); // All day = full 24 hours
    } else {
      // For timed drops
      if (dropResult.targetTime) {
        start = new Date(dropResult.targetDate);
        start.setHours(dropResult.targetTime.hour, dropResult.targetTime.minute, 0, 0);
      } else {
        // Keep original time but change date
        start = new Date(dropResult.targetDate);
        start.setHours(originalEvent.start.getHours(), originalEvent.start.getMinutes(), 0, 0);
      }
      
      // Smart duration calculation
      let duration = actualDuration;
      if (originalEvent.isAllDay && actualDuration <= 24 * 60 * 60 * 1000) {
        // All-day to timed: use 1-hour default
        duration = 60 * 60 * 1000;
      } else if (actualDuration === 0) {
        // Zero-duration to timed: use 30-min default
        duration = 30 * 60 * 1000;
      }
      
      end = new Date(start.getTime() + duration);
    }

    // Convert to UTC for storage
    let utcStart: string | undefined;
    let utcEnd: string | undefined;
    let updateData: any = {};

    try {
      utcStart = timezoneUtils.userTimeToUTC(start, timezone);
      utcEnd = timezoneUtils.userTimeToUTC(end, timezone);

      // Determine what fields to update based on original event metadata
      if (originalEvent.utcMetadata?.hasUTCFields) {
        // Update UTC fields
        updateData = {
          scheduledStartTimeUTC: utcStart,
          scheduledEndTimeUTC: utcEnd,
          timezoneContext: timezoneUtils.createTimezoneContext(timezone),
          // Keep legacy fields for backward compatibility
          scheduledDate: start.toISOString().split('T')[0],
          includeTime: !dropResult.isAllDay,
          scheduledStartTime: dropResult.isAllDay ? null : start.toTimeString().substring(0, 5),
          scheduledEndTime: dropResult.isAllDay ? null : end.toTimeString().substring(0, 5)
        };
      } else {
        // Update legacy fields only
        updateData = {
          scheduledDate: start.toISOString().split('T')[0],
          includeTime: !dropResult.isAllDay,
          scheduledStartTime: dropResult.isAllDay ? null : start.toTimeString().substring(0, 5),
          scheduledEndTime: dropResult.isAllDay ? null : end.toTimeString().substring(0, 5)
        };
      }

      utcMonitoring.trackOperation('calendar_event_time_calculation', true);

    } catch (conversionError) {
      console.error('UTC conversion failed, using legacy fields only:', conversionError);
      
      // Fallback to legacy fields
      updateData = {
        scheduledDate: start.toISOString().split('T')[0],
        includeTime: !dropResult.isAllDay,
        scheduledStartTime: dropResult.isAllDay ? null : start.toTimeString().substring(0, 5),
        scheduledEndTime: dropResult.isAllDay ? null : end.toTimeString().substring(0, 5)
      };

      utcMonitoring.trackOperation('calendar_event_time_calculation', false);
    }

    return {
      start,
      end,
      utcStart,
      utcEnd,
      updateData
    };

  } catch (error) {
    console.error('Failed to calculate new event time:', error);
    utcMonitoring.trackOperation('calendar_event_time_calculation', false);
    
    // Return safe fallback
    return {
      start: originalEvent.start,
      end: originalEvent.end,
      updateData: {}
    };
  }
};

/**
 * Enhanced merge function for calendar events and tasks with UTC support
 */
export const mergeEventsAndTasksUTC = (
  calendarEvents: CalendarEvent[],
  tasks: (Task | TaskUTC)[],
  projects: Project[],
  userTimezone?: string
): CalendarEvent[] => {
  const timezone = userTimezone || timezoneUtils.getCurrentTimezone();
  const taskEvents = tasksToCalendarEventsUTC(tasks, projects, timezone);
  return [...calendarEvents, ...taskEvents];
};

/**
 * Timezone-aware validation for drop operations
 */
export const isValidDropUTC = (
  draggedEvent: CalendarEvent,
  dropResult: DropResult,
  allEvents: CalendarEvent[],
  userTimezone?: string
): boolean => {
  const timezone = userTimezone || timezoneUtils.getCurrentTimezone();
  
  try {
    // Can't drop on same position
    if (isSameDay(draggedEvent.start, dropResult.targetDate) && 
        !dropResult.targetTime && 
        draggedEvent.isAllDay === (dropResult.isAllDay || false)) {
      return false;
    }
    
    // Calculate new times
    const { start, end } = calculateNewEventTimeUTC(draggedEvent, dropResult, timezone);

    // For all-day drops, allow them (no time conflict check needed)
    if (dropResult.isAllDay) {
      return true;
    }
    
    // Check for conflicts with other events (excluding the dragged event)
    const eventsOnSameDay = allEvents.filter(event => 
      event.id !== draggedEvent.id &&
      isSameDay(event.start, start)
    );

    const conflictingEvents = eventsOnSameDay.filter(event => 
      !event.isAllDay &&
      ((start >= event.start && start < event.end) ||
       (end > event.start && end <= event.end) ||
       (start <= event.start && end >= event.end))
    );
    
    return conflictingEvents.length === 0;

  } catch (error) {
    console.error('Drop validation failed:', error);
    utcMonitoring.trackOperation('calendar_drop_validation', false);
    return false;
  }
};

/**
 * Get timezone-aware time display
 */
export const formatTimeForDisplayUTC = (
  date: Date, 
  userTimezone?: string, 
  format: string = 'HH:mm'
): string => {
  const timezone = userTimezone || timezoneUtils.getCurrentTimezone();
  
  try {
    return timezoneUtils.formatInTimezone(date.toISOString(), timezone, format);
  } catch (error) {
    console.error('Failed to format time for timezone:', error);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
    });
  }
};

// Re-export original utilities for backward compatibility
export { 
  getActualEventDurationMinutes, 
  getEventDurationMinutes 
} from './utils';