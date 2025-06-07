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
  if (endDate <= startDate) {
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
  return [...calendarEvents.map(e => ({ ...e, isDraggable: true })), ...taskEvents];
};

// Drag & Drop Utilities

/**
 * Calculate new event times based on drop position
 */
export const calculateNewEventTime = (
  originalEvent: CalendarEvent,
  dropResult: DropResult
): { start: Date; end: Date } => {
  const duration = originalEvent.end.getTime() - originalEvent.start.getTime();
  
  if (dropResult.isAllDay || originalEvent.isAllDay) {
    // For all-day events, just move to the target date
    const start = new Date(dropResult.targetDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    return { start, end };
  }
  
  // For timed events
  let start: Date;
  if (dropResult.targetTime) {
    start = new Date(dropResult.targetDate);
    start.setHours(dropResult.targetTime.hour, dropResult.targetTime.minute, 0, 0);
  } else {
    // Keep original time but change date
    start = new Date(dropResult.targetDate);
    start.setHours(originalEvent.start.getHours(), originalEvent.start.getMinutes(), 0, 0);
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
  console.log('🔍 Validating drop:', {
    eventTitle: draggedEvent.title,
    targetDate: dropResult.targetDate.toISOString().split('T')[0],
    targetTime: dropResult.targetTime,
    isAllDay: dropResult.isAllDay,
    totalEvents: allEvents.length
  });

  // Can't drop on same position
  if (isSameDay(draggedEvent.start, dropResult.targetDate) && 
      !dropResult.targetTime && 
      draggedEvent.isAllDay === (dropResult.isAllDay || false)) {
    console.log('❌ Drop blocked: Same position');
    return false;
  }
  
  // Calculate new times
  const { start, end } = calculateNewEventTime(draggedEvent, dropResult);
  
  console.log('📅 Calculated new times:', {
    start: start.toISOString(),
    end: end.toISOString(),
    startLocal: `${start.getHours()}:${start.getMinutes().toString().padStart(2, '0')}`,
    endLocal: `${end.getHours()}:${end.getMinutes().toString().padStart(2, '0')}`
  });

  // For all-day drops, allow them (no time conflict check needed)
  if (dropResult.isAllDay) {
    console.log('✅ All-day drop allowed');
    return true;
  }
  
  // Check for conflicts with other events (excluding the dragged event)
  const eventsOnSameDay = allEvents.filter(event => 
    event.id !== draggedEvent.id &&
    isSameDay(event.start, start)
  );
  
  console.log('📊 Events on same day:', eventsOnSameDay.map(e => ({
    title: e.title,
    isAllDay: e.isAllDay,
    time: e.isAllDay ? 'All day' : `${e.start.getHours()}:${e.start.getMinutes().toString().padStart(2, '0')}-${e.end.getHours()}:${e.end.getMinutes().toString().padStart(2, '0')}`
  })));

  const conflictingEvents = eventsOnSameDay.filter(event => 
    !event.isAllDay &&
    ((start >= event.start && start < event.end) ||
     (end > event.start && end <= event.end) ||
     (start <= event.start && end >= event.end))
  );
  
  if (conflictingEvents.length > 0) {
    console.log('❌ Drop blocked - Conflicts detected:', {
      targetDate: start.toISOString().split('T')[0],
      targetTime: `${start.getHours()}:${start.getMinutes().toString().padStart(2, '0')}-${end.getHours()}:${end.getMinutes().toString().padStart(2, '0')}`,
      conflicts: conflictingEvents.map(e => ({
        title: e.title,
        time: `${e.start.getHours()}:${e.start.getMinutes().toString().padStart(2, '0')}-${e.end.getHours()}:${e.end.getMinutes().toString().padStart(2, '0')}`
      }))
    });
  } else {
    console.log('✅ Drop allowed - No conflicts found');
  }
  
  return conflictingEvents.length === 0;
};

/**
 * Format time for display
 */
export const formatTimeForDisplay = (date: Date): string => {
  return format(date, 'HH:mm');
};

/**
 * Get event duration in minutes
 */
export const getEventDurationMinutes = (event: CalendarEvent): number => {
  return Math.round((event.end.getTime() - event.start.getTime()) / (1000 * 60));
}; 