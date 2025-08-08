import type { Task, TaskDisplay, Project } from '../../types/models';
import type { CalendarEvent } from './types';
import { format, addMinutes, subMinutes, parse, differenceInMinutes, isAfter, isBefore, startOfDay, endOfDay, isSameDay } from 'date-fns';
import { timezoneUtils } from '../../utils/timezoneUtils';

export interface EventDrop {
  eventId: string;
  start: Date;
  end: Date;
  isAllDay?: boolean;
}

export const taskToCalendarEvent = (task: Task | TaskDisplay, project?: Project): CalendarEvent | null => {
  const taskAsTask = task as Task;
  
  if (!taskAsTask.scheduledDate) return null;
  
  // Parse the scheduled date as local date (not UTC)
  const baseDate = new Date(taskAsTask.scheduledDate + 'T00:00:00');
  
  let start: Date;
  let end: Date;
  let isAllDay = false;
  
  if (taskAsTask.includeTime && taskAsTask.scheduledStartTime && taskAsTask.scheduledEndTime) {
    // Parse times and combine with date
    const startTime = parse(taskAsTask.scheduledStartTime, 'HH:mm', baseDate);
    const endTime = parse(taskAsTask.scheduledEndTime, 'HH:mm', baseDate);
    
    start = startTime;
    end = endTime;
    
    // If end time is before start time, assume it's the next day
    if (isBefore(end, start)) {
      end = addMinutes(end, 24 * 60);
    }
  } else {
    // All-day event
    start = startOfDay(baseDate);
    end = endOfDay(baseDate);
    isAllDay = true;
  }

  // Determine the color
  let color = '#EF4444'; // Default red
  if (project) {
    color = project.color;
  } else {
    // Try to find project by ID if not provided
    // This would require access to projects array, so keeping default for now
  }

  // Create the base calendar event
  const calendarEvent: CalendarEvent = {
    id: taskAsTask.id,
    title: taskAsTask.title,
    start,
    end,
    color,
    isAllDay,
    isTask: true,
    isCompleted: taskAsTask.completed,
    taskId: taskAsTask.id,
    description: taskAsTask.description
  };

  // Handle multi-day tasks
  if (taskAsTask.scheduledEndDate && taskAsTask.scheduledEndDate !== taskAsTask.scheduledDate) {
    const endDate = new Date(taskAsTask.scheduledEndDate + 'T23:59:59');
    calendarEvent.end = endDate;
    calendarEvent.isMultiDay = true;
    
    // Calculate day span for multi-day events
    const startDate = new Date(taskAsTask.scheduledDate + 'T00:00:00');
    const daySpan = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    calendarEvent.daySpan = daySpan;
    
    // Set display dates for rendering
    calendarEvent.displayStart = startDate;
    calendarEvent.displayEnd = endDate;
  }

  return calendarEvent;
};

export const tasksToCalendarEvents = (tasks: Task[], projects: Project[]): CalendarEvent[] => {
  return tasks
    .filter(task => task.scheduledDate) // Only include tasks with scheduled dates
    .map(task => {
      const project = projects.find(p => p.id === task.projectId);
      return taskToCalendarEvent(task, project);
    })
    .filter((event): event is CalendarEvent => event !== null);
};


/**
 * Merge calendar events and tasks with proper scheduling and conflict resolution
 */
export const mergeEventsAndTasks = (
  tasks: Task[], 
  projects: Project[], 
  calendarEvents: CalendarEvent[] = []
): CalendarEvent[] => {
  const taskEvents = tasksToCalendarEvents(tasks, projects);
  return [...taskEvents, ...calendarEvents];
};

/**
 * Calculate new event time based on drag position
 */
export const calculateNewEventTime = (
  event: CalendarEvent,
  dragStartY: number,
  dragCurrentY: number,
  timeSlotHeight: number,
  roundToMinutes: number = 15
): { start: Date; end: Date } => {
  const pixelsMoved = dragCurrentY - dragStartY;
  const minutesMoved = (pixelsMoved / timeSlotHeight) * 60;
  
  // Round to nearest increment
  const roundedMinutes = Math.round(minutesMoved / roundToMinutes) * roundToMinutes;
  
  const originalDuration = event.end.getTime() - event.start.getTime();
  const newStart = addMinutes(event.start, roundedMinutes);
  const newEnd = new Date(newStart.getTime() + originalDuration);
  
  return { start: newStart, end: newEnd };
};

/**
 * Validate if an event can be dropped at a specific time/date
 */
export const isValidDrop = (
  event: CalendarEvent,
  newStart: Date,
  newEnd: Date,
  allEvents: CalendarEvent[],
  allowOverlap: boolean = false
): boolean => {
  if (!allowOverlap) {
    // Check for conflicts with other events (excluding the event being moved)
    const otherEvents = allEvents.filter(e => e.id !== event.id);
    
    for (const otherEvent of otherEvents) {
      // Check if the new time conflicts with existing event
      if (
        (newStart < otherEvent.end && newEnd > otherEvent.start) ||
        (newEnd > otherEvent.start && newStart < otherEvent.end)
      ) {
        return false;
      }
    }
  }
  
  // Ensure the event doesn't end before it starts
  if (newEnd <= newStart) {
    return false;
  }
  
  return true;
};

/**
 * Format time for display (e.g., "2:30 PM")
 */
export const formatTimeForDisplay = (date: Date): string => {
  return format(date, 'h:mm a');
};

/**
 * Get actual event duration in minutes
 */
export const getActualEventDurationMinutes = (event: CalendarEvent): number => {
  const durationMs = event.end.getTime() - event.start.getTime();
  return Math.round(durationMs / (1000 * 60));
};

/**
 * Get event duration in minutes (for UI display purposes)
 */
export const getEventDurationMinutes = (event: CalendarEvent): number => {
  const actualDurationMs = event.end.getTime() - event.start.getTime();
  const actualDurationMinutes = actualDurationMs / (1000 * 60);
  
  // For zero-duration events (same start/end time), return 30 minutes
  if (actualDurationMinutes === 0) {
    return 30;
  }
  
  // For other events, return actual duration but with 30-minute minimum
  return Math.max(actualDurationMinutes, 30);
};

// Multi-day task utility functions

/**
 * Check if a task/event is multi-day
 */
export const isMultiDayTask = (task: Task): boolean => {
  return !!(task.scheduledDate && task.scheduledEndDate && task.scheduledEndDate !== task.scheduledDate);
};

/**
 * Get the day span of a multi-day task
 */
export const getTaskDaySpan = (task: Task): number => {
  if (!isMultiDayTask(task)) return 1;
  
  const startDate = new Date(task.scheduledDate! + 'T00:00:00');
  const endDate = new Date(task.scheduledEndDate! + 'T00:00:00');
  return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
};

/**
 * Get all events for a specific day, including multi-day events
 */
export const getEventsForDay = (events: CalendarEvent[], day: Date, allDayOnly: boolean = false): CalendarEvent[] => {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  
  return events.filter(event => {
    if (allDayOnly && !event.isAllDay) return false;
    
    // For multi-day events, check if the day falls within the event's date range
    if (event.isMultiDay && event.displayStart && event.displayEnd) {
      const eventStart = startOfDay(event.displayStart);
      const eventEnd = endOfDay(event.displayEnd);
      return day >= eventStart && day <= eventEnd;
    }
    
    // For single-day events, check if they occur on this day
    const eventStart = startOfDay(event.start);
    const eventEnd = endOfDay(event.end);
    return (event.start >= dayStart && event.start <= dayEnd) ||
           (event.end >= dayStart && event.end <= dayEnd) ||
           (event.start <= dayStart && event.end >= dayEnd);
  });
};

/**
 * Calculate positions for multi-day events to avoid overlaps
 */
export const calculateMultiDayEventPositions = (
  events: CalendarEvent[], 
  weekStart: Date, 
  weekEnd: Date
): { events: { event: CalendarEvent; position: { row: number; left: number; width: number } }[]; maxRow: number } => {
  // Filter to only multi-day events that intersect with this week
  const multiDayEvents = events.filter(event => {
    if (!event.isMultiDay || !event.displayStart || !event.displayEnd) return false;
    
    const eventStart = startOfDay(event.displayStart);
    const eventEnd = endOfDay(event.displayEnd);
    const weekStartDay = startOfDay(weekStart);
    const weekEndDay = endOfDay(weekEnd);
    
    return eventStart <= weekEndDay && eventEnd >= weekStartDay;
  });
  
  // Sort by duration (longer events first) then by start date
  const sortedEvents = multiDayEvents.sort((a, b) => {
    const aDuration = a.daySpan || 1;
    const bDuration = b.daySpan || 1;
    if (aDuration !== bDuration) {
      return bDuration - aDuration; // Longer duration first
    }
    return a.start.getTime() - b.start.getTime(); // Earlier start first
  });
  
  const positionedEvents: { event: CalendarEvent; position: { row: number; left: number; width: number } }[] = [];
  const rows: CalendarEvent[][] = [];
  
  for (const event of sortedEvents) {
    // Find the first row where this event can fit
    let row = 0;
    let placed = false;
    
    while (!placed) {
      if (!rows[row]) {
        rows[row] = [];
      }
      
      // Check if this event conflicts with any event in this row
      const hasConflict = rows[row].some(existingEvent => {
        if (!existingEvent.displayStart || !existingEvent.displayEnd || !event.displayStart || !event.displayEnd) {
          return false;
        }
        
        const existingStart = startOfDay(existingEvent.displayStart);
        const existingEnd = endOfDay(existingEvent.displayEnd);
        const eventStart = startOfDay(event.displayStart);
        const eventEnd = endOfDay(event.displayEnd);
        
        return eventStart <= existingEnd && eventEnd >= existingStart;
      });
      
      if (!hasConflict) {
        rows[row].push(event);
        
        // Calculate position within the week
        const weekStartDay = startOfDay(weekStart);
        const eventStart = startOfDay(event.displayStart!);
        const eventEnd = endOfDay(event.displayEnd!);
        
        // Clamp to week boundaries
        const displayStart = eventStart < weekStartDay ? weekStartDay : eventStart;
        const displayEnd = eventEnd > endOfDay(weekEnd) ? endOfDay(weekEnd) : eventEnd;
        
        const startDayOffset = Math.floor((displayStart.getTime() - weekStartDay.getTime()) / (1000 * 60 * 60 * 24));
        const daysInWeek = Math.ceil((displayEnd.getTime() - displayStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        
        positionedEvents.push({
          event,
          position: {
            row,
            left: startDayOffset,
            width: daysInWeek
          }
        });
        
        placed = true;
      } else {
        row++;
      }
    }
  }
  
  return {
    events: positionedEvents,
    maxRow: rows.length - 1
  };
};