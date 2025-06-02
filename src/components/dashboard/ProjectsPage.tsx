import React, { useState, useEffect } from 'react';
import { useDashboardStore } from '../../store/useDashboardStore';
import { formatMinutes } from '../../utils/timeUtils';
import { useTaskStore } from '../../store/taskStore';
import { TaskStatusBoard } from '../tasks';
import { Icon } from '../ui/Icon';
import { Link } from 'react-router-dom';
import ProjectView from './views/ProjectView';

type ViewType = 'project' | 'status';

export const ProjectsPage: React.FC = () => {
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
      className="p-1 bg-white" 
      onClick={handleClickOutside}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Header */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10 mb-6">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-gray-900">Task Management</h1>
            <span className="ml-4 text-sm text-gray-500">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </div>
          
          <div className="flex items-center space-x-3">
            <button className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 whitespace-nowrap">
              <div className="w-4 h-4 flex items-center justify-center mr-1.5">
                <Icon name="add-line" />
              </div>
              New Project
            </button>
          </div>
        </div>
        
        <div className="px-6 py-3 flex items-center justify-between border-t border-gray-100">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Icon name="search-line" className="w-5 h-5 text-gray-400" />
            </div>
            <input 
              type="search" 
              className="block w-full pl-10 pr-3 py-2 border-none rounded-md bg-gray-100 focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none text-sm" 
              placeholder="Search tasks and projects..." 
            />
          </div>
          
          <div className="flex items-center space-x-3">
            {/* View Type Switch */}
            <div className="inline-flex items-center bg-gray-100 rounded-lg p-1 min-w-fit">
              <button 
                className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 whitespace-nowrap min-w-[140px] justify-center focus:outline-none focus:ring-0 ${
                  viewType === 'status'
                    ? 'bg-white text-gray-900 shadow-sm border border-red-500'
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
                className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 whitespace-nowrap min-w-[140px] justify-center focus:outline-none focus:ring-0 ${
                  viewType === 'project'
                    ? 'bg-white text-gray-900 shadow-sm border border-red-500'
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
          </div>
        </div>
      </div>
      
      {/* Content based on view type */}
      {viewType === 'status' ? (
        <div className="px-6">
          <TaskStatusBoard />
        </div>
      ) : (
        <ProjectView />
      )}
    </div>
  );
}; 