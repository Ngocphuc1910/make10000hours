import React, { useState, useEffect } from 'react';
import Card from '../../ui/Card';
import { useDashboardStore } from '../../../store/useDashboardStore';
import { useTaskStore } from '../../../store/taskStore';
import { useUserStore } from '../../../store/userStore';
import { formatMinutesToHoursAndMinutes } from '../../../utils/timeUtils';
import { taskToDashboardTask, type DashboardTask } from '../../../utils/dashboardAdapter';

export const TopTasks: React.FC = () => {
  const { workSessions, selectedRange } = useDashboardStore();
  const { tasks, projects } = useTaskStore();
  const { user } = useUserStore();
  const [displayTasks, setDisplayTasks] = useState<DashboardTask[]>([]);
  const [showingToday, setShowingToday] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
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
    const updateTasks = async () => {
      if (!user) return;
      
      setIsLoading(true);
      try {
        if (showingToday) {
          // Get tasks for today only using work sessions
          const today = new Date();
          const todayString = today.toISOString().split('T')[0];
          
          // Filter work sessions for today and aggregate by task
          const todayWorkSessions = workSessions.filter(session => session.date === todayString);
          const taskTimeMap = new Map<string, number>();
          
          todayWorkSessions.forEach(session => {
            const current = taskTimeMap.get(session.taskId) || 0;
            taskTimeMap.set(session.taskId, current + (session.duration || 0));
          });
          
          // Convert to dashboard tasks with work session time
          const tasksForDate = Array.from(taskTimeMap.entries())
            .map(([taskId, totalTime]) => {
              const task = tasks.find(t => t.id === taskId);
              if (!task) return null;
              
              const dashboardTask = taskToDashboardTask(task);
              return {
                ...dashboardTask,
                totalFocusTime: totalTime
              };
            })
            .filter((task): task is DashboardTask => task !== null && task.totalFocusTime > 0)
            .sort((a, b) => b.totalFocusTime - a.totalFocusTime);
            
          setDisplayTasks(tasksForDate);
        } else {
          // Show all tasks by total focus time from timeSpent field
          const sortedTasks = tasks
            .map(task => taskToDashboardTask(task))
            .filter(task => task.totalFocusTime > 0) // Only show tasks with time spent
            .sort((a, b) => b.totalFocusTime - a.totalFocusTime);
          setDisplayTasks(sortedTasks);
        }
      } catch (error) {
        console.error('Error updating tasks:', error);
        setDisplayTasks([]);
      } finally {
        setIsLoading(false);
      }
    };

    updateTasks();
  }, [showingToday, tasks, workSessions, user]);
  
  // Show empty state if no tasks
  if (isLoading) {
    return (
      <Card 
        title="Top Tasks" 
        action={
          <button className="flex items-center text-sm text-gray-600">
            <span>Loading...</span>
          </button>
        }
      >
        <div className="flex items-center justify-center h-[360px]">
          <div className="text-center">
            <p className="text-gray-500 text-sm">Loading tasks...</p>
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
          <button 
            className="flex items-center text-sm text-gray-600 hover:text-gray-800"
            onClick={() => {
              setShowingToday(!showingToday);
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
            setShowingToday(!showingToday);
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
              <div className={`flex items-center text-xs font-medium ${task.completed ? 'text-green-600' : 'text-yellow-600'}`}>
                <div className={`w-2 h-2 rounded-full ${task.completed ? 'bg-green-500' : 'bg-yellow-500'} mr-1`}></div>
                <span>{task.completed ? 'Completed' : 'To do'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}; 