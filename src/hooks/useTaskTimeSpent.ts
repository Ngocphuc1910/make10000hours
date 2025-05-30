import { useMemo } from 'react';
import { useWorkSessionStore } from '../store/useWorkSessionStore';
import { useTaskStore } from '../store/taskStore';

/**
 * Hook to get calculated time spent for tasks from WorkSession data
 * Falls back to stored task.timeSpent if no WorkSession records exist
 * This ensures compatibility with existing data while enabling date-aware tracking
 */
export const useTaskTimeSpent = () => {
  const { workSessions } = useWorkSessionStore();
  const { tasks } = useTaskStore();

  const getTimeSpentForTask = useMemo(() => {
    // Create a map of taskId -> total time spent from WorkSessions
    const workSessionTimeMap = new Map<string, number>();
    
    workSessions.forEach(session => {
      const currentTime = workSessionTimeMap.get(session.taskId) || 0;
      workSessionTimeMap.set(session.taskId, currentTime + session.duration);
    });

    return (taskId: string): number => {
      // First try to get time from WorkSession data
      const workSessionTime = workSessionTimeMap.get(taskId) || 0;
      
      // If no WorkSession data exists, fall back to stored task.timeSpent
      if (workSessionTime === 0) {
        const task = tasks.find(t => t.id === taskId);
        return task?.timeSpent || 0;
      }
      
      return workSessionTime;
    };
  }, [workSessions, tasks]);

  const getTimeSpentOnDate = useMemo(() => {
    return (taskId: string, date: Date): number => {
      const dateString = date.toDateString();
      return workSessions
        .filter(session => 
          session.taskId === taskId && 
          session.startTime.toDateString() === dateString
        )
        .reduce((total, session) => total + session.duration, 0);
    };
  }, [workSessions]);

  const getTimeSpentInDateRange = useMemo(() => {
    return (taskId: string, startDate: Date, endDate: Date): number => {
      return workSessions
        .filter(session => 
          session.taskId === taskId && 
          session.startTime >= startDate && 
          session.startTime <= endDate
        )
        .reduce((total, session) => total + session.duration, 0);
    };
  }, [workSessions]);

  // Helper to check if a task has WorkSession data (for dashboard vs legacy compatibility)
  const hasWorkSessionData = useMemo(() => {
    const tasksWithWorkSessions = new Set(workSessions.map(session => session.taskId));
    
    return (taskId: string): boolean => {
      return tasksWithWorkSessions.has(taskId);
    };
  }, [workSessions]);

  return {
    getTimeSpentForTask,
    getTimeSpentOnDate,
    getTimeSpentInDateRange,
    hasWorkSessionData
  };
}; 