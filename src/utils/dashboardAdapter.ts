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
 * Convert Task to dashboard Task format using timeSpent as single source of truth
 */
export const taskToDashboardTask = (
  task: Task, 
  workSessions?: WorkSession[] // Optional for backward compatibility
): DashboardTask => {
  // Use task.timeSpent as the single source of truth for total focus time
  const totalFocusTime = task.timeSpent || 0;

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
 * Convert Project to dashboard Project format using task timeSpent as source
 */
export const projectToDashboardProject = (
  project: Project,
  tasks: Task[]
): DashboardProject => {
  // Calculate total focus time from tasks in this project using timeSpent
  const totalFocusTime = tasks
    .filter(task => task.projectId === project.id)
    .reduce((total, task) => total + (task.timeSpent || 0), 0);

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
 * Get tasks that were worked on for a specific date using daily time tracking
 */
export const getTasksWorkedOnDate = async (
  date: Date,
  tasks: Task[],
  userId: string
): Promise<DashboardTask[]> => {
  try {
    const { dailyTimeSpentService } = await import('../api/dailyTimeSpentService');
    
    // Get all daily time spent records for this date
    const dailyRecords = await dailyTimeSpentService.getDailyTimeSpent(userId, date, date);
    
    if (dailyRecords.length === 0) {
      return [];
    }
    
    // Get unique task IDs that have time spent on this date
    const taskIdsWorkedOn = new Set(dailyRecords.map(record => record.taskId));
    
    // Convert to dashboard tasks and set time spent to the daily amount
    return tasks
      .filter(task => taskIdsWorkedOn.has(task.id))
      .map(task => {
        // Find the daily record for this task
        const dailyRecord = dailyRecords.find(record => record.taskId === task.id);
        const timeOnDate = dailyRecord?.timeSpent || 0;
        
        return {
          id: task.id,
          userId: task.userId,
          projectId: task.projectId,
          name: task.title,
          description: task.description || '',
          isCompleted: task.completed,
          totalFocusTime: timeOnDate, // Use time spent on this specific date
          createdAt: task.createdAt
        };
      })
      .sort((a, b) => b.totalFocusTime - a.totalFocusTime);
  } catch (error) {
    console.error('Error getting tasks worked on date:', error);
    return [];
  }
}; 