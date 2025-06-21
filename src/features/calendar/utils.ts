import { Task, Project } from '../../types/models';
import { CalendarEvent, DropResult, DragItem } from './types';
import { isSameDay, addMinutes, format } from 'date-fns';

/**
 * Convert a task with scheduled date/time to a CalendarEvent
 */
export const taskToCalendarEvent = (task: Task, project?: Project): CalendarEvent | null => {
  // Only convert tasks that have a scheduled date
  if (!task.scheduledDate) {
    return null;
  }

  const eventId = `task-${task.id}`;
  const eventTitle = task.title;
  const eventDescription = task.description;
  const projectName = project?.name || 'No Project';
  const projectColor = project?.color || '#6B7280'; // Default gray color

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
      taskId: task.id, // Add reference to original task
      isTask: true, // Flag to identify this as a task event
      isDraggable: true
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
    taskId: task.id, // Add reference to original task
    isTask: true, // Flag to identify this as a task event
    isDraggable: true
  };
};

/**
 * Convert multiple tasks to calendar events
 */
export const tasksToCalendarEvents = (tasks: Task[], projects: Project[]): CalendarEvent[] => {
  const events: CalendarEvent[] = [];
  
  // Create a map of projects for quick lookup
  const projectMap = new Map<string, Project>();
  projects.forEach(project => {
    projectMap.set(project.id, project);
  });

  // Convert each task with scheduled date to calendar event
  tasks.forEach(task => {
    const project = projectMap.get(task.projectId);
    const event = taskToCalendarEvent(task, project);
    if (event) {
      events.push(event);
    }
  });

  return events;
};

/**
 * Merge calendar events and task events
 */
export const mergeEventsAndTasks = (
  calendarEvents: CalendarEvent[],
  tasks: Task[],
  projects: Project[]
): CalendarEvent[] => {
  const taskEvents = tasksToCalendarEvents(tasks, projects);
  return [...calendarEvents, ...taskEvents];
};

// Drag & Drop Utilities

/**
 * Calculate new event times based on drop position
 */
export const calculateNewEventTime = (
  originalEvent: CalendarEvent,
  dropResult: DropResult
): { start: Date; end: Date } => {
  // Use actual duration to preserve zero-duration events
  const actualDuration = originalEvent.end.getTime() - originalEvent.start.getTime();
  
  // Only check drop target, not original event type
  if (dropResult.isAllDay) {
    // For all-day drops, move to target date as all-day
    const start = new Date(dropResult.targetDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    return { start, end };
  }
  
  // For timed drops
  let start: Date;
  if (dropResult.targetTime) {
    start = new Date(dropResult.targetDate);
    start.setHours(dropResult.targetTime.hour, dropResult.targetTime.minute, 0, 0);
  } else {
    // Keep original time but change date
    start = new Date(dropResult.targetDate);
    start.setHours(originalEvent.start.getHours(), originalEvent.start.getMinutes(), 0, 0);
  }
  
  // Smart duration calculation for converted events
  let duration = actualDuration;
  if (originalEvent.isAllDay && actualDuration === 0) {
    // All-day to timed: use 1-hour default
    duration = 60 * 60 * 1000;
  } else if (actualDuration === 0) {
    // Zero-duration to timed: use 30-min default
    duration = 30 * 60 * 1000;
  }
  
  const end = new Date(start.getTime() + duration);
  return { start, end };
};

/**
 * Check if a drop operation is valid
 */
export const isValidDrop = (
  draggedEvent: CalendarEvent,
  dropResult: DropResult,
  allEvents: CalendarEvent[]
): boolean => {
  // Can't drop on same position
  if (isSameDay(draggedEvent.start, dropResult.targetDate) && 
      !dropResult.targetTime && 
      draggedEvent.isAllDay === (dropResult.isAllDay || false)) {
    return false;
  }
  
  // Calculate new times
  const { start, end } = calculateNewEventTime(draggedEvent, dropResult);

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
};

/**
 * Format time for display
 */
export const formatTimeForDisplay = (date: Date): string => {
  return format(date, 'HH:mm');
};

/**
 * Get actual event duration in minutes (preserves original data)
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