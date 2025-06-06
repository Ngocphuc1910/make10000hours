import { Task, Project } from '../../types/models';
import { CalendarEvent } from './types';

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
      isTask: true // Flag to identify this as a task event
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
    isTask: true // Flag to identify this as a task event
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