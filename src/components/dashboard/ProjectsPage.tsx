import React, { useState } from 'react';
import { useFocusStore } from '../../store/useFocusStore';
import { formatMinutes } from '../../utils/timeUtils';
import { useTaskStore } from '../../store/taskStore';
import { TaskStatusBoard } from '../tasks';
import { Icon } from '../ui/Icon';
import { Link } from 'react-router-dom';
import ProjectView from './views/ProjectView';

type ViewType = 'project' | 'status';

export const ProjectsPage: React.FC = () => {
  const [viewType, setViewType] = useState<ViewType>('status');
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  
  const projects = useTaskStore(state => state.projects);
  const tasks = useTaskStore(state => state.tasks);
  
  const toggleViewDropdown = () => {
    setIsViewDropdownOpen(!isViewDropdownOpen);
  };
  
  const handleClickOutside = () => {
    if (isViewDropdownOpen) {
      setIsViewDropdownOpen(false);
    }
  };
  
  return (
    <div className="p-1 bg-white" onClick={handleClickOutside}>
      {/* Header */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10 mb-6">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center">
            {/* Optional back button */}
            <Link 
              to="/dashboard" 
              className="mr-4 inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
            >
              <Icon name="arrow-left-line" className="mr-1" />
              <span>Back to Original Page</span>
            </Link>
            <h1 className="text-xl font-semibold text-gray-900">Projects & Tasks</h1>
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
              placeholder="Search projects and tasks..." 
            />
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="relative">
                <button 
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 whitespace-nowrap"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleViewDropdown();
                  }}
                >
                  <div className="w-4 h-4 flex items-center justify-center mr-1.5">
                    <Icon name={viewType === 'status' ? 'checkbox-multiple-line' : 'layout-grid-line'} />
                  </div>
                  {viewType === 'status' ? 'By Status' : 'By Project'}
                </button>
                
                {isViewDropdownOpen && (
                  <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                    <div className="py-1">
                      <button 
                        className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => {
                          setViewType('project');
                          setIsViewDropdownOpen(false);
                        }}
                      >
                        <div className="w-4 h-4 flex items-center justify-center mr-2">
                          <Icon name="layout-grid-line" />
                        </div>
                        By Project
                        {viewType === 'project' && (
                          <div className="w-4 h-4 flex items-center justify-center ml-auto text-primary">
                            <Icon name="check-line" />
                          </div>
                        )}
                      </button>
                      
                      <button 
                        className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => {
                          setViewType('status');
                          setIsViewDropdownOpen(false);
                        }}
                      >
                        <div className="w-4 h-4 flex items-center justify-center mr-2">
                          <Icon name="checkbox-multiple-line" />
                        </div>
                        By Status
                        {viewType === 'status' && (
                          <div className="w-4 h-4 flex items-center justify-center ml-auto text-primary">
                            <Icon name="check-line" />
                          </div>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
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