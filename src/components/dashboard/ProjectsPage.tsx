import React, { useState, useEffect } from 'react';
import { useDashboardStore } from '../../store/useDashboardStore';
import { formatMinutes } from '../../utils/timeUtils';
import { useTaskStore } from '../../store/taskStore';
import { TaskStatusBoard } from '../tasks';
import { Icon } from '../ui/Icon';
import { Link, useNavigate } from 'react-router-dom';
import ProjectView from './views/ProjectView';
import { Tooltip } from '../ui/Tooltip';
import { useDeepFocusStore } from '../../store/deepFocusStore';
import { useDeepFocusSync } from '../../hooks/useDeepFocusSync';

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
  
  // Deep Focus state management
  const { 
    isDeepFocusActive, 
    enableDeepFocus, 
    disableDeepFocus 
  } = useDeepFocusStore();
  useDeepFocusSync(); // Sync Deep Focus state across pages

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
      <div className={`h-16 border-b border-gray-200 flex items-center justify-between px-6 bg-white transition-all duration-500 relative`}>
        {/* Left Section - Title & Deep Focus Switch */}
        <div className="flex items-center">
          <div className={`text-lg font-semibold transition-all duration-500 ${
            isDeepFocusActive 
              ? 'bg-gradient-to-r from-[rgb(187,95,90)] via-[rgb(236,72,153)] to-[rgb(251,146,60)] bg-clip-text text-transparent font-bold' 
              : 'text-gray-800'
          }`}>
            Task Management
          </div>
          <div className="ml-4 flex items-center">
            <label className="relative inline-flex items-center cursor-pointer group">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={isDeepFocusActive}
                onChange={(e) => {
                  if (e.target.checked) {
                    enableDeepFocus();
                  } else {
                    disableDeepFocus();
                  }
                }}
              />
              <div className={`w-[120px] h-[33px] flex items-center rounded-full transition-all duration-500 relative ${
                isDeepFocusActive 
                  ? 'bg-gradient-to-r from-[rgba(187,95,90,0.9)] via-[rgba(236,72,153,0.9)] to-[rgba(251,146,60,0.9)] shadow-[0_0_15px_rgba(236,72,153,0.3)] border border-white/20 justify-start pl-[10.5px]' 
                  : 'bg-gray-100/80 backdrop-blur-sm justify-end pr-[10.5px]'
              }`}>
                <span className={`text-sm font-medium transition-colors duration-500 relative z-10 whitespace-nowrap ${
                  isDeepFocusActive 
                    ? 'text-white font-semibold [text-shadow:0_0_12px_rgba(255,255,255,0.5)]' 
                    : 'text-gray-500'
                }`}>
                  {isDeepFocusActive ? 'Deep Focus' : 'Focus Off'}
                </span>
              </div>
              <div className={`absolute w-6 h-6 bg-white rounded-full shadow-lg transition-all duration-500 ${
                isDeepFocusActive 
                  ? 'left-[calc(100%-27px)] shadow-[0_6px_20px_rgba(187,95,90,0.2)]' 
                  : 'left-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.1)]'
              }`}></div>
            </label>
          </div>
        </div>
          
        {/* Right Section - View Controls & Navigation Icons */}
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
                <Icon 
                  name="timer-line" 
                  size={20} 
                  className={isDeepFocusActive ? 'text-[rgb(187,95,90)]' : ''}
                />
              </span>
            </button>
          </Tooltip>
          
          <Tooltip text="Task management">
            <button 
              className="p-2 rounded-full bg-gray-100 !rounded-button whitespace-nowrap"
              aria-label="Current page: Task Management"
            >
              <span className="w-5 h-5 flex items-center justify-center">
                <Icon 
                  name="task-line" 
                  size={20} 
                  className={isDeepFocusActive ? 'text-[rgb(187,95,90)]' : ''}
                />
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
                <Icon 
                  name="dashboard-line" 
                  size={20} 
                  className={isDeepFocusActive ? 'text-[rgb(187,95,90)]' : ''}
                />
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
                <Icon 
                  name="calendar-line" 
                  size={20} 
                  className={isDeepFocusActive ? 'text-[rgb(187,95,90)]' : ''}
                />
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
                <Icon 
                  name="brain-line" 
                  size={20} 
                  className={isDeepFocusActive ? 'text-[rgb(187,95,90)]' : ''}
                />
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