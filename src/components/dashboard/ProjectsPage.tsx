import React, { useState, useEffect } from 'react';
import { useDashboardStore } from '../../store/useDashboardStore';
import { formatMinutes } from '../../utils/timeUtils';
import { useTaskStore } from '../../store/taskStore';
import { TaskStatusBoard } from '../tasks';
import { Icon } from '../ui/Icon';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import ProjectView from './views/ProjectView';
import { Tooltip } from '../ui/Tooltip';
import { useExtensionSync } from '../../hooks/useExtensionSync';
import { DeepFocusSwitch } from '../ui/DeepFocusSwitch';
import { useUIStore } from '../../store/uiStore';
import Sidebar from '../layout/Sidebar';
import { VerticalNavigation } from '../layout/VerticalNavigation';

type ViewType = 'project' | 'status';

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLeftSidebarOpen, toggleLeftSidebar } = useUIStore();
  // Get initial view type from localStorage or default to 'status'
  const [viewType, setViewType] = useState<ViewType>(() => {
    const saved = localStorage.getItem('taskManagementViewType');
    return (saved as ViewType) || 'status';
  });
  
  // Get initial group by project state from localStorage or default to false
  const [groupByProject, setGroupByProject] = useState<boolean>(() => {
    const saved = localStorage.getItem('taskManagementGroupByProject');
    return saved === 'true';
  });
  const [isDragInProgress, setIsDragInProgress] = useState(false);
  
  const projects = useTaskStore(state => state.projects);
  const tasks = useTaskStore(state => state.tasks);
  
  // Deep Focus state management handled globally in App.tsx

  // Save view type to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('taskManagementViewType', viewType);
  }, [viewType]);
  
  // Save group by project state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('taskManagementGroupByProject', groupByProject.toString());
  }, [groupByProject]);

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
    <div className="projects-page-container flex h-screen overflow-hidden bg-background-primary">
      <Sidebar />
      
      <main className="projects-main-container flex-1 flex flex-col overflow-hidden">
        <div 
          className="projects-content-container h-full flex flex-col bg-background-primary" 
          onClick={handleClickOutside}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* Header */}
          <div className={`projects-header h-16 flex items-center justify-between pl-4 pr-12 bg-background-secondary transition-all duration-500 relative`}>
        {/* Left Section - Title & Deep Focus Switch */}
        <div className="flex items-center">
          {!isLeftSidebarOpen && (
            <button
              onClick={toggleLeftSidebar}
              className="p-2 mr-2 rounded-md hover:bg-background-secondary hover:shadow-sm hover:scale-105 transition-all duration-200 group"
              aria-label="Show Sidebar"
            >
              <div className="w-5 h-5 flex items-center justify-center text-text-secondary group-hover:text-text-primary transition-colors duration-200">
                <Icon name="menu-line" size={20} />
              </div>
            </button>
          )}
          <DeepFocusSwitch 
            size="medium" 
            showLabel={false} 
            showPageTitle={true} 
            pageTitle="Task Management"
          />
        </div>
          
        {/* Right Section - View Controls & Navigation Icons */}
        <div className="flex items-center space-x-4">
          {/* Group Toggle - only show in status view */}
          {viewType === 'status' && (
            <button
              type="button"
              className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                groupByProject
                  ? 'bg-background-container text-text-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-background-container'
              }`}
              onClick={() => setGroupByProject(!groupByProject)}
            >
              <div className="w-4 h-4 flex items-center justify-center mr-1.5">
                <Icon name="group-line" />
              </div>
              Group
            </button>
          )}
          
          {/* View Type Switch */}
          <div className="inline-flex rounded-full bg-background-container p-1">
            <button 
              type="button"
              className={`inline-flex items-center px-4 py-1.5 text-sm font-medium rounded-full ${
                viewType === 'status'
                  ? 'bg-background-primary text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
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
                  ? 'bg-background-primary text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
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
      
          {/* Scrollable Content */}
          <div className={`projects-scrollable-content flex-1 overflow-y-auto scrollbar-thin pr-4 ${!isLeftSidebarOpen ? 'ml-16' : ''}`}>
            {viewType === 'status' ? (
              <TaskStatusBoard groupByProject={groupByProject} />
            ) : (
              <div className="py-6">
                <ProjectView />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Vertical Navigation */}
      <VerticalNavigation />
    </div>
  );
}; 