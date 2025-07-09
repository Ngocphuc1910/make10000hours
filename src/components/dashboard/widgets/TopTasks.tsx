import React, { useState, useEffect, useMemo } from 'react';
import Card from '../../ui/Card';
import { useDashboardStore } from '../../../store/useDashboardStore';
import { useTaskStore } from '../../../store/taskStore';
import { useUserStore } from '../../../store/userStore';
import { formatMinutesToHoursAndMinutes } from '../../../utils/timeUtils';
import { taskToDashboardTask, type DashboardTask } from '../../../utils/dashboardAdapter';

export const TopTasks: React.FC = React.memo(() => {
  const { workSessions, selectedRange } = useDashboardStore();
  const { tasks, projects } = useTaskStore();
  const { user } = useUserStore();
  const [isLoading, setIsLoading] = useState(false);
  
  // Create stable reference for tasks that only changes when task structure changes (not timeSpent)
  const stableTasksRef = useMemo(() => {
    return tasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      projectId: task.projectId,
      userId: task.userId,
      status: task.status,
      priority: task.priority,
      completed: task.completed,
      order: task.order,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      // Exclude timeSpent to prevent re-renders on timer updates
    }));
  }, [tasks.map(t => `${t.id}-${t.title}-${t.status}-${t.projectId}-${t.completed}`).join('|')]);
  
  // TopTasks render tracking (logging removed to reduce console noise)
  
  // Filter work sessions based on selected date range (same logic as other components)
  const filteredWorkSessions = useMemo(() => {
    // For 'all time' range, show all work sessions without filtering
    if (selectedRange.rangeType === 'all time') {
      return workSessions;
    }
    
    // For all other cases, use the selected range if available
    if (!selectedRange.startDate || !selectedRange.endDate) {
      return workSessions;
    }
    
    const startDate = new Date(selectedRange.startDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(selectedRange.endDate);
    endDate.setHours(23, 59, 59, 999);
    
    return workSessions.filter(session => {
      const sessionDate = new Date(session.date);
      return sessionDate >= startDate && sessionDate <= endDate;
    });
  }, [workSessions, selectedRange]);

  // Calculate task focus time from filtered work sessions
  const displayTasks = useMemo(() => {
    // Calculate task time from filtered sessions (logging removed to reduce console noise)
    
    if (!user || filteredWorkSessions.length === 0) {
      return [];
    }
    
    // Group filtered work sessions by task, excluding break sessions
    const taskTimeMap = new Map<string, number>();
    
    filteredWorkSessions
      .filter(session => session.sessionType === 'pomodoro' || session.sessionType === 'manual')
      .forEach(session => {
        const duration = session.duration || 0;
        const current = taskTimeMap.get(session.taskId) || 0;
        taskTimeMap.set(session.taskId, current + duration);
        
        // Track task session duration (logging removed to reduce console noise)
      });
    
    // Task time aggregation completed (logging removed to reduce console noise)
    
    // Convert to dashboard tasks with filtered time data
    return Array.from(taskTimeMap.entries())
      .map(([taskId, totalTime]: [string, number]) => {
        const task = stableTasksRef.find((t: any) => t.id === taskId);
        if (!task) return null;
        
        const dashboardTask = taskToDashboardTask(task);
        return {
          ...dashboardTask,
          totalFocusTime: totalTime
        };
      })
      .filter((task): task is DashboardTask => task !== null && task.totalFocusTime > 0)
      .sort((a: DashboardTask, b: DashboardTask) => b.totalFocusTime - a.totalFocusTime);
  }, [user, stableTasksRef, filteredWorkSessions]);
  
  // Show empty state if no tasks
  if (isLoading) {
    return (
      <Card 
        title="Top Tasks" 
        action={
          <button className="flex items-center text-sm text-text-secondary">
            <span>Loading...</span>
          </button>
        }
      >
        <div className="flex items-center justify-center h-[360px]">
          <div className="text-center">
            <p className="text-text-secondary text-sm">Loading tasks...</p>
          </div>
        </div>
      </Card>
    );
  }

  if (displayTasks.length === 0) {
    return (
      <Card 
        title="Top Tasks" 
        action={
          <button className="text-sm text-primary hover:text-primary-dark font-medium">
            View All
          </button>
        }
      >
        <div className="flex items-center justify-center h-[360px]">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 text-text-secondary flex items-center justify-center">
              <i className="ri-calendar-event-line ri-2x"></i>
            </div>
            <p className="text-text-secondary text-sm">No tasks with focus time found</p>
          </div>
        </div>
      </Card>
    );
  }
  
  return (
    <Card 
      title="Top Tasks" 
      action={
        <button className="text-sm text-primary hover:text-primary-dark font-medium">
          View All
        </button>
      }
    >
      <div className="space-y-2 h-[360px] overflow-y-auto pr-1 custom-scrollbar">
        <style>
          {`
          .custom-scrollbar::-webkit-scrollbar {
            width: 0 !important;
            display: none !important;
          }
          .custom-scrollbar {
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
            overflow: -moz-scrollbars-none !important;
          }
          .custom-scrollbar {
            -webkit-overflow-scrolling: touch;
          }
          `}
        </style>
        
        {displayTasks.map((task: DashboardTask, index: number) => {
          const project = projects.find((p: any) => p.id === task.projectId);
          if (!project) return null;
          
          const formattedTime = formatMinutesToHoursAndMinutes(task.totalFocusTime);
          
          return (
            <div key={task.id} className="flex items-center py-2 border-b border-border">
              <div className="flex items-center">
                <div className="w-5 h-5 flex items-center justify-center text-text-secondary mr-3">
                  {index + 1}.
                </div>
                <div>
                  <h4 className="text-sm font-medium text-text-primary">{task.name}</h4>
                  <div className="flex items-center mt-0.5">
                    <span className="text-xs text-text-secondary">{project.name} • {formattedTime}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}); 