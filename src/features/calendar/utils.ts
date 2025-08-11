import type { Task, TaskDisplay, Project } from '../../types/models';
import type { CalendarEvent, DropResult } from './types';
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
    const diffInDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const daySpan = diffInDays + 1;
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
export function calculateNewEventTime(
  event: CalendarEvent,
  dragStartY: number,
  dragCurrentY: number,
  timeSlotHeight: number,
  roundToMinutes?: number
): { start: Date; end: Date };

/**
 * Calculate new event time based on drop result (overloaded version)
 */
export function calculateNewEventTime(
  event: CalendarEvent,
  dropResult: DropResult,
  userTimezone?: string
): { start: Date; end: Date };

export function calculateNewEventTime(
  event: CalendarEvent,
  dragStartYOrDropResult: number | DropResult,
  dragCurrentYOrUserTimezone?: number | string,
  timeSlotHeight?: number,
  roundToMinutes: number = 15
): { start: Date; end: Date } {
  // Check if this is the DropResult overload
  if (typeof dragStartYOrDropResult === 'object') {
    const dropResult = dragStartYOrDropResult as DropResult;
    const actualDuration = event.end.getTime() - event.start.getTime();
    
    let start: Date;
    let end: Date;
    
    // Special handling for multi-day events
    if (event.isMultiDay && event.displayStart && event.displayEnd) {
      // Use pre-calculated daySpan if available, otherwise calculate it correctly
      const daySpan = event.daySpan || Math.floor((event.displayEnd.getTime() - startOfDay(event.displayStart).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      // Set new start date to the drop target
      start = new Date(dropResult.targetDate);
      start.setHours(0, 0, 0, 0);
      
      // Calculate new end date by adding the correct number of days
      end = new Date(start);
      end.setDate(end.getDate() + daySpan - 1);  // Subtract 1 for inclusive range
      end.setHours(23, 59, 59, 999);
      
      return { start, end };
    }
    
    if (dropResult.isAllDay) {
      // For all-day drops, move to target date as all-day
      start = new Date(dropResult.targetDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setHours(23, 59, 59, 999); // End of day
    } else {
      // For timed drops
      if (dropResult.targetTime) {
        start = new Date(dropResult.targetDate);
        start.setHours(dropResult.targetTime.hour, dropResult.targetTime.minute, 0, 0);
      } else {
        // Keep original time but change date
        start = new Date(dropResult.targetDate);
        start.setHours(event.start.getHours(), event.start.getMinutes(), 0, 0);
      }
      
      // Smart duration calculation
      let duration = actualDuration;
      if (event.isAllDay && actualDuration <= 24 * 60 * 60 * 1000) {
        // All-day to timed: use 1-hour default
        duration = 60 * 60 * 1000;
      } else if (actualDuration === 0) {
        // Zero-duration to timed: use 30-min default
        duration = 30 * 60 * 1000;
      }
      
      end = new Date(start.getTime() + duration);
    }
    
    return { start, end };
  }
  
  // Original drag position implementation
  const dragStartY = dragStartYOrDropResult as number;
  const dragCurrentY = dragCurrentYOrUserTimezone as number;
  
  const pixelsMoved = dragCurrentY - dragStartY;
  const minutesMoved = (pixelsMoved / timeSlotHeight!) * 60;
  
  // Round to nearest increment
  const roundedMinutes = Math.round(minutesMoved / roundToMinutes) * roundToMinutes;
  
  const originalDuration = event.end.getTime() - event.start.getTime();
  const newStart = addMinutes(event.start, roundedMinutes);
  const newEnd = new Date(newStart.getTime() + originalDuration);
  
  return { start: newStart, end: newEnd };
}

/**
 * Validate if an event can be dropped at a specific time/date
 */
export function isValidDrop(
  event: CalendarEvent,
  newStart: Date,
  newEnd: Date,
  allEvents: CalendarEvent[],
  allowOverlap?: boolean
): boolean;

/**
 * Validate if an event can be dropped (overloaded version for DropResult)
 */
export function isValidDrop(
  event: CalendarEvent,
  dropResult: DropResult,
  allEvents: CalendarEvent[],
  userTimezone?: string
): boolean;

export function isValidDrop(
  event: CalendarEvent,
  newStartOrDropResult: Date | DropResult,
  newEndOrAllEvents: Date | CalendarEvent[],
  allEventsOrUserTimezone?: CalendarEvent[] | string,
  allowOverlap: boolean = false
): boolean {
  // Check if this is the DropResult overload
  if (typeof newStartOrDropResult === 'object' && 'targetDate' in newStartOrDropResult) {
    const dropResult = newStartOrDropResult as DropResult;
    const allEvents = newEndOrAllEvents as CalendarEvent[];
    
    // Check if dropping on the same position
    if (isSameDay(event.start, dropResult.targetDate) && 
        !dropResult.targetTime && 
        event.isAllDay === (dropResult.isAllDay || false)) {
      return false;
    }
    
    // Calculate new times for conflict checking
    const { start: newStart, end: newEnd } = calculateNewEventTime(event, dropResult, allEventsOrUserTimezone as string);
    
    // For all-day drops, allow them (no time conflict check needed)
    if (dropResult.isAllDay) {
      return true;
    }
    
    // Check for conflicts with other events (excluding the dragged event)
    const otherEvents = allEvents.filter(e => e.id !== event.id);
    
    for (const otherEvent of otherEvents) {
      // Skip all-day events when checking timed event conflicts
      if (otherEvent.isAllDay) continue;
      
      // Check if the new time conflicts with existing event on same day
      if (isSameDay(otherEvent.start, newStart) &&
          newStart < otherEvent.end && newEnd > otherEvent.start) {
        return false;
      }
    }
    
    return true;
  }
  
  // Original date-based implementation
  const newStart = newStartOrDropResult as Date;
  const newEnd = newEndOrAllEvents as Date;
  const allEvents = allEventsOrUserTimezone as CalendarEvent[];
  
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
}

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
  const diffInDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  return diffInDays + 1;
};

/**
 * Get all events for a specific day, including multi-day events
 */
export const getEventsForDay = (events: CalendarEvent[], day: Date, allDayOnly: boolean = false): CalendarEvent[] => {
  const dayStart = startOfDay(day);
  
  return events.filter(event => {
    if (allDayOnly && !event.isAllDay) return false;
    
    // For multi-day events, check if the day falls within the event's date range
    if (event.isMultiDay && event.displayStart && event.displayEnd) {
      const eventStart = startOfDay(event.displayStart);
      const eventEnd = endOfDay(event.displayEnd);
      return dayStart >= eventStart && dayStart <= eventEnd;
    }
    
    // For single-day events, check if they occur on this day
    return isSameDay(event.start, day);
  });
};

/**
 * Row occupation map for efficient space management
 */
export interface RowOccupationMap {
  [rowIndex: number]: {
    occupiedDays: Set<number>; // day indices that are occupied by multi-day events
    availableDays: Set<number>; // day indices that are free for single-day events
    multiDayEvents: CalendarEvent[];
    singleDayEvents: { [dayIndex: number]: CalendarEvent[] };
  };
}

/**
 * Optimized event layout result
 */
export interface OptimizedEventLayout {
  multiDayEvents: { event: CalendarEvent; position: { row: number; left: number; width: number } }[];
  singleDayEvents: { event: CalendarEvent; position: { row: number; dayIndex: number } }[];
  totalRows: number;
  occupationMap: RowOccupationMap;
}

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
  
  if (multiDayEvents.length === 0) {
    return { events: [], maxRow: -1 };
  }
  
  // Sort by start date first, then by duration (longer events first)
  const sortedEvents = multiDayEvents.sort((a, b) => {
    const startComparison = a.start.getTime() - b.start.getTime();
    if (startComparison !== 0) {
      return startComparison; // Earlier start first
    }
    const aDuration = a.daySpan || 1;
    const bDuration = b.daySpan || 1;
    return bDuration - aDuration; // Longer duration first for same start date
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
        
        // Check for any overlap
        return !(eventEnd < existingStart || eventStart > existingEnd);
      });
      
      if (!hasConflict) {
        rows[row].push(event);
        
        // Calculate position within the visible range
        const weekStartDay = startOfDay(weekStart);
        const eventStart = startOfDay(event.displayStart!);
        const eventEnd = endOfDay(event.displayEnd!);
        
        // Clamp to visible boundaries
        const displayStart = eventStart < weekStartDay ? weekStartDay : eventStart;
        const displayEnd = eventEnd > endOfDay(weekEnd) ? endOfDay(weekEnd) : eventEnd;
        
        // Calculate day offset from the start of the visible range
        const startDayOffset = Math.max(0, Math.floor((displayStart.getTime() - weekStartDay.getTime()) / (1000 * 60 * 60 * 24)));
        
        // Calculate width in days using proper date arithmetic
        const diffInDays = Math.floor((displayEnd.getTime() - displayStart.getTime()) / (1000 * 60 * 60 * 24));
        const totalDays = Math.max(1, diffInDays + 1);
        
        positionedEvents.push({
          event,
          position: {
            row,
            left: startDayOffset,
            width: totalDays
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
    maxRow: rows.length > 0 ? rows.length - 1 : -1
  };
};

/**
 * Create occupation map from multi-day event positions
 */
const createOccupationMap = (
  multiDayLayout: { events: { event: CalendarEvent; position: { row: number; left: number; width: number } }[]; maxRow: number },
  weekStart: Date,
  weekEnd: Date
): RowOccupationMap => {
  const totalDays = Math.floor((weekEnd.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const occupationMap: RowOccupationMap = {};

  // Initialize rows with multi-day events
  for (const { event, position } of multiDayLayout.events) {
    const { row, left, width } = position;
    
    if (!occupationMap[row]) {
      occupationMap[row] = {
        occupiedDays: new Set(),
        availableDays: new Set(),
        multiDayEvents: [],
        singleDayEvents: {}
      };
      
      // Initialize all days as available
      for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
        occupationMap[row].availableDays.add(dayIndex);
      }
    }
    
    // Mark days as occupied by this multi-day event
    for (let dayIndex = left; dayIndex < left + width; dayIndex++) {
      if (dayIndex < totalDays) {
        occupationMap[row].occupiedDays.add(dayIndex);
        occupationMap[row].availableDays.delete(dayIndex);
      }
    }
    
    occupationMap[row].multiDayEvents.push(event);
  }
  
  return occupationMap;
};

/**
 * Fit single-day events into available spaces in existing rows
 */
const fitSingleDayEvents = (
  singleDayEvents: CalendarEvent[],
  occupationMap: RowOccupationMap,
  weekStart: Date,
  weekEnd: Date
): { event: CalendarEvent; position: { row: number; dayIndex: number } }[] => {
  const totalDays = Math.floor((weekEnd.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const positionedEvents: { event: CalendarEvent; position: { row: number; dayIndex: number } }[] = [];
  
  // Group single-day events by day
  const eventsByDay: { [dayIndex: number]: CalendarEvent[] } = {};
  
  for (const event of singleDayEvents) {
    const eventStart = startOfDay(event.start);
    const weekStartDay = startOfDay(weekStart);
    const dayIndex = Math.floor((eventStart.getTime() - weekStartDay.getTime()) / (1000 * 60 * 60 * 24));
    
    if (dayIndex >= 0 && dayIndex < totalDays) {
      if (!eventsByDay[dayIndex]) {
        eventsByDay[dayIndex] = [];
      }
      eventsByDay[dayIndex].push(event);
    }
  }
  
  // For each day, try to place events in available row spaces
  Object.entries(eventsByDay).forEach(([dayIndexStr, events]) => {
    const dayIndex = parseInt(dayIndexStr);
    
    events.forEach(event => {
      let placed = false;
      
      // Try to place in existing rows first (sorted by row number)
      const sortedRows = Object.keys(occupationMap).map(Number).sort((a, b) => a - b);
      
      for (const rowIndex of sortedRows) {
        if (occupationMap[rowIndex].availableDays.has(dayIndex)) {
          // Found available space in existing row
          occupationMap[rowIndex].availableDays.delete(dayIndex);
          if (!occupationMap[rowIndex].singleDayEvents[dayIndex]) {
            occupationMap[rowIndex].singleDayEvents[dayIndex] = [];
          }
          occupationMap[rowIndex].singleDayEvents[dayIndex].push(event);
          
          positionedEvents.push({
            event,
            position: { row: rowIndex, dayIndex }
          });
          
          placed = true;
          break;
        }
      }
      
      // If not placed in existing rows, create a new row
      if (!placed) {
        const existingRowIndices = Object.keys(occupationMap).map(Number);
        const newRowIndex = existingRowIndices.length > 0 ? Math.max(...existingRowIndices) + 1 : 0;
        
        occupationMap[newRowIndex] = {
          occupiedDays: new Set(),
          availableDays: new Set(),
          multiDayEvents: [],
          singleDayEvents: { [dayIndex]: [event] }
        };
        
        // Initialize available days for new row (all except this one)
        for (let i = 0; i < totalDays; i++) {
          if (i !== dayIndex) {
            occupationMap[newRowIndex].availableDays.add(i);
          }
        }
        
        positionedEvents.push({
          event,
          position: { row: newRowIndex, dayIndex }
        });
      }
    });
  });
  
  return positionedEvents;
};

/**
 * Calculate optimized event layout with efficient space usage
 * This is the main function that replaces separate multi-day and single-day positioning
 */
export const calculateOptimizedEventLayout = (
  allEvents: CalendarEvent[],
  weekStart: Date,
  weekEnd: Date
): OptimizedEventLayout => {
  // Separate multi-day and single-day all-day events
  const multiDayEvents = allEvents.filter(event => 
    event.isAllDay && event.isMultiDay && event.displayStart && event.displayEnd &&
    event.displayStart <= weekEnd && event.displayEnd >= weekStart
  );
  
  const singleDayEvents = allEvents.filter(event => 
    event.isAllDay && !event.isMultiDay
  );
  
  // Step 1: Position multi-day events and create occupation map
  const multiDayLayout = calculateMultiDayEventPositions(multiDayEvents, weekStart, weekEnd);
  const occupationMap = createOccupationMap(multiDayLayout, weekStart, weekEnd);
  
  // Step 2: Fit single-day events into available spaces
  const singleDayLayout = fitSingleDayEvents(singleDayEvents, occupationMap, weekStart, weekEnd);
  
  // Step 3: Calculate total rows needed
  const existingRowIndices = Object.keys(occupationMap).map(Number);
  const totalRows = existingRowIndices.length > 0 ? Math.max(...existingRowIndices) + 1 : 1;
  
  return {
    multiDayEvents: multiDayLayout.events,
    singleDayEvents: singleDayLayout,
    totalRows,
    occupationMap
  };
};

/**
 * Month-specific cell layout for optimized positioning
 * NOTE: Only handles single-day events - multi-day events are rendered in overlay
 */
export interface MonthCellLayout {
  singleDayEvents: { event: CalendarEvent; row: number }[];
  totalRows: number;
}

/**
 * Global month layout tracking for optimal space usage
 */
export interface MonthGlobalLayout {
  multiDayLayout: { [eventId: string]: number };
  dayOccupationMap: { [dayKey: string]: Set<number> }; // tracks which rows are occupied for each day
  maxRow: number;
}

/**
 * Calculate optimal layout for entire month view with proper gap-filling
 */
export const calculateMonthViewLayout = (
  days: Date[],
  events: CalendarEvent[]
): MonthGlobalLayout => {
  const multiDayLayout: { [eventId: string]: number } = {};
  const dayOccupationMap: { [dayKey: string]: Set<number> } = {};
  
  // Initialize occupation map for all days
  days.forEach(day => {
    const dayKey = format(day, 'yyyy-MM-dd');
    dayOccupationMap[dayKey] = new Set<number>();
  });
  
  // Step 1: Position multi-day events
  const multiDayEvents = events.filter(event => 
    event.isMultiDay && event.displayStart && event.displayEnd && event.isAllDay
  );
  
  multiDayEvents.forEach(event => {
    if (!event.displayStart || !event.displayEnd) return;
    
    // Find which days this event spans
    const spannedDays = days.filter(day => {
      const dayStart = startOfDay(day);
      const eventStart = startOfDay(event.displayStart!);
      const eventEnd = endOfDay(event.displayEnd!);
      return dayStart >= eventStart && dayStart <= eventEnd;
    });
    
    if (spannedDays.length === 0) return;
    
    // Find the first row that's available for all spanned days
    let row = 0;
    let foundAvailableRow = false;
    
    while (!foundAvailableRow) {
      foundAvailableRow = true;
      
      for (const day of spannedDays) {
        const dayKey = format(day, 'yyyy-MM-dd');
        if (dayOccupationMap[dayKey].has(row)) {
          foundAvailableRow = false;
          break;
        }
      }
      
      if (!foundAvailableRow) {
        row++;
      }
    }
    
    // Assign this row to the event and mark days as occupied
    multiDayLayout[event.id] = row;
    spannedDays.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      dayOccupationMap[dayKey].add(row);
    });
  });
  
  // Calculate max row
  let maxRow = -1;
  Object.values(dayOccupationMap).forEach(occupiedRows => {
    if (occupiedRows.size > 0) {
      const dayMax = Math.max(...occupiedRows);
      if (dayMax > maxRow) maxRow = dayMax;
    }
  });
  
  return {
    multiDayLayout,
    dayOccupationMap,
    maxRow
  };
};

/**
 * Calculate optimal layout for a single month calendar cell
 * IMPORTANT: Only handles single-day events - multi-day events are rendered in overlay
 */
export const calculateMonthCellLayout = (
  day: Date,
  allEvents: CalendarEvent[],
  occupiedRows: Set<number> = new Set() // NEW: Accept pre-occupied rows
): MonthCellLayout => {
  // Find ONLY single-day events for this day (both all-day and timed)
  const singleDayEventsForDay = allEvents.filter(event => 
    !event.isMultiDay && isSameDay(event.start, day)
  );
  
  // Sort single-day events: all-day events first, then timed events by start time
  const sortedSingleDayEvents = [...singleDayEventsForDay].sort((a, b) => {
    if (a.isAllDay && !b.isAllDay) return -1;
    if (!a.isAllDay && b.isAllDay) return 1;
    if (!a.isAllDay && !b.isAllDay) {
      return a.start.getTime() - b.start.getTime();
    }
    return 0;
  });
  
  // Position single-day events efficiently, skipping occupied rows
  const positionedSingleDayEvents: { event: CalendarEvent; row: number }[] = [];
  
  sortedSingleDayEvents.forEach((event) => {
    // Find first available row that's not occupied by multi-day events
    let row = 0;
    while (occupiedRows.has(row)) {
      row++;
    }
    
    // Mark this row as used (for next events in same cell)
    occupiedRows.add(row);
    positionedSingleDayEvents.push({ event, row });
  });
  
  const totalRows = positionedSingleDayEvents.length + occupiedRows.size;
  
  return {
    singleDayEvents: positionedSingleDayEvents,
    totalRows
  };
};