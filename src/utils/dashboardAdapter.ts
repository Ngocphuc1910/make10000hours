import type { Task, Project, WorkSession } from '../types/models';

// Dashboard specific types
export interface DashboardTask extends Omit<Task, 'title'> {
  name: string;
  totalFocusTime: number;
}

export interface DashboardProject extends Omit<Project, 'name'> {
  name: string;
  totalFocusTime: number;
  createdAt: Date;
  isActive: boolean;
}

export interface FocusSession {
  id: string;
  taskId: string;
  projectId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  notes?: string;
}

export interface FocusStreak {
  currentStreak: number;
  longestStreak: number;
  totalFocusDays: number;
  streakDates: { date: Date; hasFocused: boolean }[];
}

/**
 * Convert WorkSession to FocusSession format for backward compatibility
 */
export const workSessionToFocusSession = (workSession: WorkSession): FocusSession => {
  // Create synthetic start/end times since WorkSession doesn't have them
  const sessionDate = new Date(workSession.date);
  const startTime = new Date(sessionDate);
  startTime.setHours(9, 0, 0, 0); // Default to 9 AM
  
  const endTime = new Date(startTime);
  endTime.setMinutes(startTime.getMinutes() + workSession.duration);

  return {
    id: workSession.id,
    taskId: workSession.taskId,
    projectId: workSession.projectId,
    startTime: startTime,
    endTime: endTime,
    duration: workSession.duration,
    notes: `Work session on ${workSession.date}`
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
    completed: task.completed,
    totalFocusTime: totalFocusTime,
    createdAt: task.createdAt,
    status: task.status,
    timeSpent: task.timeSpent,
    timeEstimated: task.timeEstimated,
    order: task.order,
    hideFromPomodoro: task.hideFromPomodoro,
    updatedAt: task.updatedAt
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
    const dateKey = session.date; // Already in YYYY-MM-DD format
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
 * Get tasks that were worked on for a specific date using work sessions
 */
export const getTasksWorkedOnDate = async (
  date: Date,
  tasks: Task[],
  userId: string,
  workSessions?: WorkSession[]
): Promise<DashboardTask[]> => {
  try {
    // If work sessions are provided, use them. Otherwise, fetch from service.
    let sessions = workSessions;
    
    if (!sessions) {
      // Import and fetch work sessions for the date if not provided
      const { workSessionService } = await import('../api/workSessionService');
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      sessions = await workSessionService.getWorkSessionsByDateRange(userId, startOfDay, endOfDay);
    }
    
    if (!sessions || sessions.length === 0) {
      return [];
    }
    
    // Filter sessions for the specific date
    const { formatLocalDate } = await import('../utils/timeUtils');
    const dateString = formatLocalDate(date); // YYYY-MM-DD format, timezone-safe
    const sessionsForDate = sessions.filter(session => session.date === dateString);
    
    if (sessionsForDate.length === 0) {
      return [];
    }
    
    // Aggregate time by task for this date
    const taskTimeMap = new Map<string, number>();
    sessionsForDate.forEach(session => {
      const current = taskTimeMap.get(session.taskId) || 0;
      taskTimeMap.set(session.taskId, current + (session.duration || 0));
    });
    
    // Convert to dashboard tasks and set time spent to the daily amount
    return Array.from(taskTimeMap.entries())
      .map(([taskId, timeOnDate]) => {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return null;
        
        const dashboardTask: DashboardTask = {
          id: task.id,
          userId: task.userId,
          projectId: task.projectId,
          name: task.title,
          description: task.description || '',
          completed: task.completed,
          totalFocusTime: timeOnDate, // Use time spent on this specific date
          createdAt: task.createdAt,
          status: task.status,
          timeSpent: task.timeSpent,
          timeEstimated: task.timeEstimated,
          order: task.order,
          hideFromPomodoro: task.hideFromPomodoro,
          updatedAt: task.updatedAt
        };
        
        return dashboardTask;
      })
      .filter((task): task is DashboardTask => task !== null)
      .sort((a, b) => b.totalFocusTime - a.totalFocusTime);
  } catch (error) {
    console.error('Error getting tasks worked on date:', error);
    return [];
  }
}; 