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
      // Get time from WorkSession data
      const workSessionTime = workSessionTimeMap.get(taskId) || 0;
      
      // Get stored time from task
      const task = tasks.find(t => t.id === taskId);
      const storedTime = task?.timeSpent || 0;
      
      // Return the sum of both - this handles the hybrid scenario where:
      // - storedTime contains legacy time data
      // - workSessionTime contains new timer-tracked time
      return storedTime + workSessionTime;
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