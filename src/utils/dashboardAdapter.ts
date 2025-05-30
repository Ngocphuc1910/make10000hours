import type { WorkSession, Task, Project } from '../types/models';
import type { FocusSession, Task as DashboardTask, Project as DashboardProject, FocusStreak } from '../types';

/**
 * Convert WorkSession to FocusSession format for dashboard widgets
 */
export const workSessionToFocusSession = (workSession: WorkSession): FocusSession => {
  return {
    id: workSession.id,
    userId: workSession.userId,
    projectId: workSession.projectId,
    taskId: workSession.taskId,
    startTime: workSession.startTime,
    endTime: workSession.endTime,
    duration: workSession.duration,
    notes: workSession.notes
  };
};

/**
 * Convert Task to dashboard Task format with hybrid time calculation
 */
export const taskToDashboardTask = (
  task: Task, 
  workSessions: WorkSession[]
): DashboardTask => {
  // Calculate total focus time from work sessions for this task
  const workSessionTime = workSessions
    .filter(session => session.taskId === task.id)
    .reduce((total, session) => total + session.duration, 0);
  
  // Use WorkSession time if available, otherwise fall back to stored timeSpent
  const totalFocusTime = workSessionTime > 0 ? workSessionTime : (task.timeSpent || 0);

  return {
    id: task.id,
    userId: task.userId,
    projectId: task.projectId,
    name: task.title, // Map title to name
    description: task.description || '',
    isCompleted: task.completed,
    totalFocusTime: totalFocusTime,
    createdAt: task.createdAt
  };
};

/**
 * Convert Project to dashboard Project format
 */
export const projectToDashboardProject = (
  project: Project,
  workSessions: WorkSession[]
): DashboardProject => {
  // Calculate total focus time from work sessions for this project
  const totalFocusTime = workSessions
    .filter(session => session.projectId === project.id)
    .reduce((total, session) => total + session.duration, 0);

  return {
    id: project.id,
    userId: project.userId,
    name: project.name,
    color: project.color || '#3B82F6', // Default blue color
    totalFocusTime: totalFocusTime,
    createdAt: new Date(), // Projects don't have createdAt in current model
    isActive: true
  };
};

/**
 * Calculate focus streak from work sessions
 */
export const calculateFocusStreak = (workSessions: WorkSession[]): FocusStreak => {
  if (workSessions.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalFocusDays: 0,
      streakDates: []
    };
  }

  // Group sessions by date
  const sessionsByDate = new Map<string, WorkSession[]>();
  
  workSessions.forEach(session => {
    const dateKey = session.startTime.toDateString();
    if (!sessionsByDate.has(dateKey)) {
      sessionsByDate.set(dateKey, []);
    }
    sessionsByDate.get(dateKey)!.push(session);
  });

  // Get unique dates and sort them
  const workDates = Array.from(sessionsByDate.keys())
    .map(dateStr => new Date(dateStr))
    .sort((a, b) => a.getTime() - b.getTime());

  if (workDates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalFocusDays: 0,
      streakDates: []
    };
  }

  // Calculate streaks
  let currentStreak = 0;
  let longestStreak = 0;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Check if we worked today or yesterday (to maintain streak)
  const latestWorkDate = workDates[workDates.length - 1];
  latestWorkDate.setHours(0, 0, 0, 0);
  
  const daysDiff = Math.floor((today.getTime() - latestWorkDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysDiff <= 1) {
    // We have an active streak
    currentStreak = 1;
    
    // Count consecutive days backwards
    for (let i = workDates.length - 2; i >= 0; i--) {
      const currentDate = workDates[i + 1];
      const prevDate = workDates[i];
      
      const dateDiff = Math.floor((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (dateDiff === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Calculate longest streak
  let tempStreak = 1;
  for (let i = 1; i < workDates.length; i++) {
    const currentDate = workDates[i];
    const prevDate = workDates[i - 1];
    
    const dateDiff = Math.floor((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (dateDiff === 1) {
      tempStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak);

  // Create streak dates for visualization
  const streakDates = workDates.map(date => {
    return {
      date: date,
      hasFocused: true
    };
  });

  return {
    currentStreak: currentStreak,
    longestStreak: longestStreak,
    totalFocusDays: workDates.length,
    streakDates: streakDates
  };
};

/**
 * Get tasks that were worked on for a specific date from work sessions
 */
export const getTasksWorkedOnDate = (
  date: Date,
  workSessions: WorkSession[],
  tasks: Task[]
): DashboardTask[] => {
  const dateString = date.toDateString();
  
  // Find sessions on this date
  const sessionsOnDate = workSessions.filter(
    session => session.startTime.toDateString() === dateString
  );
  
  // Get unique task IDs from sessions
  const taskIdsWorkedOn = new Set(
    sessionsOnDate
      .filter(session => session.taskId)
      .map(session => session.taskId)
  );
  
  // Convert to dashboard tasks and sort by time spent on this date
  return tasks
    .filter(task => taskIdsWorkedOn.has(task.id))
    .map(task => {
      // Calculate time spent on this specific date
      const timeOnDate = sessionsOnDate
        .filter(session => session.taskId === task.id)
        .reduce((total, session) => total + session.duration, 0);
      
      return {
        id: task.id,
        userId: task.userId,
        projectId: task.projectId,
        name: task.title, // Map title to name
        description: task.description || '',
        isCompleted: task.completed,
        totalFocusTime: timeOnDate, // Use time spent on this date specifically
        createdAt: task.createdAt
      };
    })
    .sort((a, b) => b.totalFocusTime - a.totalFocusTime);
}; 