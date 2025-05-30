import React, { useState, useEffect } from 'react';
import Card from '../../ui/Card';
import { useWorkSessionStore } from '../../../store/useWorkSessionStore';
import { useTaskStore } from '../../../store/taskStore';
import { useDashboardStore } from '../../../store/useDashboardStore';
import { formatMinutesToHoursAndMinutes } from '../../../utils/timeUtils';
import { getTasksWorkedOnDate, taskToDashboardTask } from '../../../utils/dashboardAdapter';
import type { Task as DashboardTask } from '../../../types';

export const TopTasks: React.FC = () => {
  const { workSessions, dateRange, setDateRange } = useWorkSessionStore();
  const { tasks, projects } = useTaskStore();
  const [displayTasks, setDisplayTasks] = useState<DashboardTask[]>([]);
  const [showingToday, setShowingToday] = useState(false);
  
  // Format the selected date
  const formattedDate = showingToday 
    ? new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      })
    : 'Last 30 days';
  
  // Update tasks when selected date changes
  useEffect(() => {
    if (showingToday) {
      // Get tasks for today only
      const today = new Date();
      const tasksForDate = getTasksWorkedOnDate(today, workSessions, tasks);
      setDisplayTasks(tasksForDate);
    } else {
      // Show all tasks by total focus time from work sessions in the current date range
      const sortedTasks = tasks
        .map(task => taskToDashboardTask(task, workSessions))
        .filter(task => task.totalFocusTime > 0) // Only show tasks with time spent
        .sort((a, b) => b.totalFocusTime - a.totalFocusTime);
      setDisplayTasks(sortedTasks);
    }
  }, [showingToday, tasks, workSessions]);
  
  // Show empty state if no tasks
  if (displayTasks.length === 0) {
    return (
      <Card 
        title="Top Tasks" 
        action={
          <button 
            className="flex items-center text-sm text-gray-600 hover:text-gray-800"
            onClick={() => {
              const today = new Date();
              const currentSelected = dateRange.startDate?.toDateString();
              const todayString = today.toDateString();
              
              // Toggle between today and all time (30 days ago to today)
              if (currentSelected === todayString) {
                // Reset to default range (30 days)
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                thirtyDaysAgo.setHours(0, 0, 0, 0);
                const endOfToday = new Date();
                endOfToday.setHours(23, 59, 59, 999);
                setDateRange(thirtyDaysAgo, endOfToday);
                setShowingToday(false);
              } else {
                // Set to today only
                const startOfToday = new Date();
                startOfToday.setHours(0, 0, 0, 0);
                const endOfToday = new Date();
                endOfToday.setHours(23, 59, 59, 999);
                setDateRange(startOfToday, endOfToday);
                setShowingToday(true);
              }
            }}
          >
            <span>{showingToday ? formattedDate : 'Last 30 days'}</span>
            <div className="w-4 h-4 flex items-center justify-center ml-1">
              <i className="ri-calendar-line"></i>
            </div>
          </button>
        }
      >
        <div className="flex items-center justify-center h-[360px]">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 text-gray-400 flex items-center justify-center">
              <i className="ri-calendar-event-line ri-2x"></i>
            </div>
            <p className="text-gray-500 text-sm">
              {showingToday ? 'No work sessions found for today' : 'No tasks with focus time found'}
            </p>
          </div>
        </div>
      </Card>
    );
  }
  
  return (
    <Card 
      title="Top Tasks" 
      action={
        <button 
          className="flex items-center text-sm text-gray-600 hover:text-gray-800"
          onClick={() => {
            const today = new Date();
            const currentSelected = dateRange.startDate?.toDateString();
            const todayString = today.toDateString();
            
            // Toggle between today and all time (30 days ago to today)
            if (currentSelected === todayString) {
              // Reset to default range (30 days)
              const thirtyDaysAgo = new Date();
              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
              thirtyDaysAgo.setHours(0, 0, 0, 0);
              const endOfToday = new Date();
              endOfToday.setHours(23, 59, 59, 999);
              setDateRange(thirtyDaysAgo, endOfToday);
              setShowingToday(false);
            } else {
              // Set to today only
              const startOfToday = new Date();
              startOfToday.setHours(0, 0, 0, 0);
              const endOfToday = new Date();
              endOfToday.setHours(23, 59, 59, 999);
              setDateRange(startOfToday, endOfToday);
              setShowingToday(true);
            }
          }}
        >
          <span>{showingToday ? formattedDate : 'Last 30 days'}</span>
          <div className="w-4 h-4 flex items-center justify-center ml-1">
            <i className="ri-calendar-line"></i>
          </div>
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
        
        {displayTasks.map((task, index) => {
          const project = projects.find(p => p.id === task.projectId);
          if (!project) return null;
          
          const formattedTime = formatMinutesToHoursAndMinutes(task.totalFocusTime);
          
          return (
            <div key={task.id} className="flex items-center justify-between py-2 border-b border-gray-100">
              <div className="flex items-center">
                <div className="w-5 h-5 flex items-center justify-center text-gray-500 mr-3">
                  {index + 1}.
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-800">{task.name}</h4>
                  <div className="flex items-center mt-0.5">
                    <span className="text-xs text-gray-500">{project.name} • {formattedTime}</span>
                  </div>
                </div>
              </div>
              <div className={`flex items-center text-xs font-medium ${task.isCompleted ? 'text-green-600' : 'text-yellow-600'}`}>
                <div className={`w-2 h-2 rounded-full ${task.isCompleted ? 'bg-green-500' : 'bg-yellow-500'} mr-1`}></div>
                <span>{task.isCompleted ? 'Completed' : 'To do'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}; 