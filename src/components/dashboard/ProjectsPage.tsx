import React, { useState, useEffect } from 'react';
import { useDashboardStore } from '../../store/useDashboardStore';
import { formatMinutes } from '../../utils/timeUtils';
import { useTaskStore } from '../../store/taskStore';
import { TaskStatusBoard } from '../tasks';
import { Icon } from '../ui/Icon';
import { Link, useNavigate } from 'react-router-dom';
import ProjectView from './views/ProjectView';
import { Tooltip } from '../ui/Tooltip';

type ViewType = 'project' | 'status';

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  // Get initial view type from localStorage or default to 'status'
  const [viewType, setViewType] = useState<ViewType>(() => {
    const saved = localStorage.getItem('taskManagementViewType');
    return (saved as ViewType) || 'status';
  });
  const [isDragInProgress, setIsDragInProgress] = useState(false);
  
  const projects = useTaskStore(state => state.projects);
  const tasks = useTaskStore(state => state.tasks);

  // Save view type to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('taskManagementViewType', viewType);
  }, [viewType]);

  // Debug logging to track component lifecycle and viewType changes
  useEffect(() => {
    console.log('ProjectsPage mounted/updated, viewType:', viewType);
    return () => {
      console.log('ProjectsPage unmounting');
    };
  }, []);

  useEffect(() => {
    console.log('ViewType changed to:', viewType);
  }, [viewType]);

  const handleClickOutside = (e: React.MouseEvent) => {
    // Don't interfere if drag is in progress or if clicking on task elements
    if (isDragInProgress) return;
    
    const target = e.target as HTMLElement;
    if (target.closest('[data-task-id]')) {
      return;
    }
  };

  // Handle drag events at the page level to track drag state
  const handleDragStart = () => {
    setIsDragInProgress(true);
  };

  const handleDragEnd = () => {
    setIsDragInProgress(false);
  };

  return (
    <div 
      className="h-full flex flex-col bg-white" 
      onClick={handleClickOutside}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Header */}
      <div className="h-16 border-b border-gray-200 bg-white flex-shrink-0 flex items-center justify-between px-6">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-gray-900">Task Management</h1>
            
            {/* Search Box */}
            <div className="relative w-80">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Icon name="search-line" className="w-5 h-5 text-gray-400" />
              </div>
              <input 
                type="search" 
                className="block w-full pl-10 pr-3 py-2 border-none rounded-md bg-gray-100 focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none text-sm" 
                placeholder="Search tasks and projects..." 
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* View Type Switch */}
            <div className="inline-flex rounded-full bg-gray-100 p-1">
              <button 
                type="button"
                className={`inline-flex items-center px-4 py-1.5 text-sm font-medium rounded-full ${
                  viewType === 'status'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setViewType('status')}
              >
                <div className="w-4 h-4 flex items-center justify-center mr-1.5">
                  <Icon name="checkbox-multiple-line" />
                </div>
                By Status
              </button>
              <button 
                type="button"
                className={`inline-flex items-center px-4 py-1.5 text-sm font-medium rounded-full ${
                  viewType === 'project'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                onClick={() => setViewType('project')}
              >
                <div className="w-4 h-4 flex items-center justify-center mr-1.5">
                  <Icon name="layout-grid-line" />
                </div>
                By Project
              </button>
            </div>
            
            {/* Navigation Icons */}
            <Tooltip text="Pomodoro Timer">
              <button 
                className="p-2 rounded-full hover:bg-gray-100 !rounded-button whitespace-nowrap"
                onClick={() => navigate('/pomodoro')}
                aria-label="Go to Pomodoro Timer"
              >
                <span className="w-5 h-5 flex items-center justify-center">
                  <Icon name="timer-line" size={20} />
                </span>
              </button>
            </Tooltip>
            
            <Tooltip text="Task management">
              <button 
                className="p-2 rounded-full bg-gray-100 !rounded-button whitespace-nowrap"
                aria-label="Current page: Task Management"
              >
                <span className="w-5 h-5 flex items-center justify-center">
                  <Icon name="task-line" size={20} />
                </span>
              </button>
            </Tooltip>
            
            <Tooltip text="Productivity Insights">
              <button 
                className="p-2 rounded-full hover:bg-gray-100 !rounded-button whitespace-nowrap"
                onClick={() => navigate('/dashboard')}
                aria-label="Go to Dashboard"
              >
                <span className="w-5 h-5 flex items-center justify-center">
                  <Icon name="dashboard-line" size={20} />
                </span>
              </button>
            </Tooltip>
            
            <Tooltip text="Calendar">
              <button 
                className="p-2 rounded-full hover:bg-gray-100 !rounded-button whitespace-nowrap"
                onClick={() => navigate('/calendar')}
                aria-label="Go to Calendar"
              >
                <span className="w-5 h-5 flex items-center justify-center">
                  <Icon name="calendar-line" size={20} />
                </span>
              </button>
            </Tooltip>
            
            <Tooltip text="Deep Focus">
              <button 
                className="p-2 rounded-full hover:bg-gray-100 !rounded-button whitespace-nowrap"
                onClick={() => navigate('/deep-focus')}
                aria-label="Go to Deep Focus"
              >
                <span className="w-5 h-5 flex items-center justify-center">
                  <Icon name="brain-line" size={20} />
                </span>
              </button>
            </Tooltip>
          </div>
        </div>
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {viewType === 'status' ? (
          <TaskStatusBoard />
        ) : (
          <div className="py-6">
            <ProjectView />
          </div>
        )}
      </div>
    </div>
  );
}; 