import { WorkSession, Task, Project } from '../types/models';
import { unifiedTimezoneService } from '../services/unifiedTimezoneService';
import { utcFeatureFlags } from '../services/featureFlags';

interface UTCWorkSession extends WorkSession {
  startTimeUTC: string;
  endTimeUTC?: string;
  createdAtUTC: string;
  updatedAtUTC: string;
  timezoneContext: {
    userTimezone: string;
    utcOffset: number;
    isDST: boolean;
    source: 'user' | 'detected' | 'fallback';
  };
}

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
 * UTC-aware session conversion with timezone handling
 */
export const utcWorkSessionToFocusSession = (
  workSession: UTCWorkSession,
  userTimezone?: string
): FocusSession => {
  const timezone = userTimezone || unifiedTimezoneService.getUserTimezone();
  
  // Convert UTC timestamps to user timezone for display
  const displaySession = unifiedTimezoneService.convertUTCSessionForDisplay(
    workSession,
    timezone
  );

  const startTime = displaySession.displayStartTime || displaySession.startTime;
  const endTime = displaySession.displayEndTime || displaySession.endTime || 
    new Date(startTime.getTime() + (workSession.duration || 0) * 60000);

  return {
    id: workSession.id,
    taskId: workSession.taskId,
    projectId: workSession.projectId,
    startTime,
    endTime,
    duration: workSession.duration || 0,
    notes: workSession.notes || `Work session on ${displaySession.displayDate || workSession.date}`
  };
};

/**
 * Group sessions by date using proper timezone conversion
 */
export const groupSessionsByDate = (
  sessions: UTCWorkSession[],
  userTimezone?: string
): Map<string, UTCWorkSession[]> => {
  const timezone = userTimezone || unifiedTimezoneService.getUserTimezone();
  const groupedSessions = new Map<string, UTCWorkSession[]>();

  sessions.forEach(session => {
    // Use UTC timestamp with proper timezone conversion for grouping
    let dateKey: string;
    
    if (session.startTimeUTC) {
      // Convert UTC timestamp to user timezone date
      dateKey = unifiedTimezoneService.convertUTCSessionForDisplay(session, timezone).displayDate;
    } else {
      // Fallback to legacy date field
      dateKey = session.date;
    }

    if (!groupedSessions.has(dateKey)) {
      groupedSessions.set(dateKey, []);
    }
    groupedSessions.get(dateKey)!.push(session);
  });

  return groupedSessions;
};

/**
 * Calculate focus streak with UTC timezone awareness
 */
export const calculateUTCFocusStreak = (
  workSessions: UTCWorkSession[],
  userTimezone?: string
): FocusStreak => {
  if (workSessions.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalFocusDays: 0,
      streakDates: []
    };
  }

  const timezone = userTimezone || unifiedTimezoneService.getUserTimezone();
  
  // Group sessions by date using UTC conversion
  const sessionsByDate = groupSessionsByDate(workSessions, timezone);
  
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

  // Calculate current streak
  let currentStreak = 0;
  let longestStreak = 0;
  
  // Get today in user's timezone
  const today = new Date();
  const todayInUserTz = unifiedTimezoneService.convertUTCSessionForDisplay({
    startTimeUTC: today.toISOString()
  } as UTCWorkSession, timezone).displayDate;
  
  const todayDate = new Date(todayInUserTz);
  
  // Check if we worked today or yesterday (to maintain streak)
  const latestWorkDate = workDates[workDates.length - 1];
  const daysDiff = Math.floor((todayDate.getTime() - latestWorkDate.getTime()) / (1000 * 60 * 60 * 24));
  
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
  const streakDates = workDates.map(date => ({
    date: date,
    hasFocused: true
  }));

  return {
    currentStreak,
    longestStreak,
    totalFocusDays: workDates.length,
    streakDates
  };
};

/**
 * Get tasks worked on specific date with UTC timezone handling
 */
export const getTasksWorkedOnDateUTC = async (
  date: Date,
  tasks: Task[],
  userId: string,
  workSessions?: UTCWorkSession[],
  userTimezone?: string
): Promise<DashboardTask[]> => {
  try {
    const timezone = userTimezone || unifiedTimezoneService.getUserTimezone();
    
    // If work sessions not provided, fetch them with UTC service
    let sessions = workSessions;
    
    if (!sessions) {
      const { workSessionServiceUTC } = await import('../services/workSessionServiceUTC');
      
      // Use UTC service for timezone-aware querying
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      sessions = await workSessionServiceUTC.getSessionsByDateRange(
        userId,
        startOfDay,
        endOfDay,
        timezone
      );
    }
    
    if (!sessions || sessions.length === 0) {
      return [];
    }
    
    // Group sessions by date using UTC conversion
    const sessionsByDate = groupSessionsByDate(sessions, timezone);
    const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD format
    const sessionsForDate = sessionsByDate.get(dateString) || [];
    
    if (sessionsForDate.length === 0) {
      return [];
    }
    
    // Aggregate time by task for this date
    const taskTimeMap = new Map<string, number>();
    sessionsForDate.forEach(session => {
      const current = taskTimeMap.get(session.taskId) || 0;
      taskTimeMap.set(session.taskId, current + (session.duration || 0));
    });
    
    // Convert to dashboard tasks
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
          totalFocusTime: timeOnDate, // Time spent on this specific date
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
    console.error('❌ Error getting tasks worked on date (UTC):', error);
    return [];
  }
};

/**
 * Feature flag adapter: Choose UTC or legacy dashboard logic
 */
export const adaptiveDashboardAdapter = {
  async getTasksWorkedOnDate(
    date: Date,
    tasks: Task[],
    userId: string,
    workSessions?: WorkSession[] | UTCWorkSession[],
    userTimezone?: string
  ): Promise<DashboardTask[]> {
    const utcEnabled = utcFeatureFlags.isFeatureEnabled('utcDashboard', userId);
    
    if (utcEnabled) {
      console.log('📊 Using UTC dashboard adapter');
      return getTasksWorkedOnDateUTC(
        date,
        tasks,
        userId,
        workSessions as UTCWorkSession[],
        userTimezone
      );
    } else {
      console.log('📊 Using legacy dashboard adapter');
      // Import and use original dashboard adapter
      const { getTasksWorkedOnDate } = await import('./dashboardAdapter');
      return getTasksWorkedOnDate(date, tasks, userId, workSessions as WorkSession[]);
    }
  },

  calculateFocusStreak(
    workSessions: WorkSession[] | UTCWorkSession[],
    userId: string,
    userTimezone?: string
  ): FocusStreak {
    const utcEnabled = utcFeatureFlags.isFeatureEnabled('utcDashboard', userId);
    
    if (utcEnabled) {
      console.log('📊 Using UTC focus streak calculation');
      return calculateUTCFocusStreak(workSessions as UTCWorkSession[], userTimezone);
    } else {
      console.log('📊 Using legacy focus streak calculation');
      // Import and use original dashboard adapter
      const { calculateFocusStreak } = require('./dashboardAdapter');
      return calculateFocusStreak(workSessions as WorkSession[]);
    }
  }
};

// Export all functions
export {
  utcWorkSessionToFocusSession as workSessionToFocusSession,
  calculateUTCFocusStreak as calculateFocusStreak,
  getTasksWorkedOnDateUTC as getTasksWorkedOnDate
};