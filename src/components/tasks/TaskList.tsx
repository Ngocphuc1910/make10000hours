import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTaskStore } from '../../store/taskStore';
import TaskItem from './TaskItem';
import TaskForm from './TaskForm';
import type { Task, Project } from '../../types/models';
import { formatMinutesToHoursAndMinutes } from '../../utils/timeUtils';
import TaskListSorted from './TaskListSorted';
import TimeSpent from './TimeSpent';
import { useAuthGuard, triggerAuthenticationFlow } from '../../utils/authGuard';
import { useUIStore } from '../../store/uiStore';
import { Icon } from '../ui/Icon';
import { Tooltip } from '../ui/Tooltip';

interface TaskListProps {
  className?: string;
  compactView?: boolean;
}

export const TaskList: React.FC<TaskListProps> = ({ 
  className = '',
  compactView = false
}) => {
  const navigate = useNavigate();
  const isAddingTask = useTaskStore(state => state.isAddingTask);
  const editingTaskId = useTaskStore(state => state.editingTaskId);
  const showDetailsMenu = useTaskStore(state => state.showDetailsMenu);
  const taskListViewMode = useTaskStore(state => state.taskListViewMode);
  const setIsAddingTask = useTaskStore(state => state.setIsAddingTask);
  const setEditingTaskId = useTaskStore(state => state.setEditingTaskId);
  const setShowDetailsMenu = useTaskStore(state => state.setShowDetailsMenu);
  const setTaskListViewMode = useTaskStore(state => state.setTaskListViewMode);
  const handleMoveCompletedDown = useTaskStore(state => state.handleMoveCompletedDown);
  const handleArchiveCompleted = useTaskStore(state => state.handleArchiveCompleted);
  const authStatus = useAuthGuard();
  
  // For drag and drop
  const taskListRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const taskFormRef = useRef<HTMLDivElement>(null);
  
  // Close details menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.details-menu') && showDetailsMenu) {
        setShowDetailsMenu(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showDetailsMenu, setShowDetailsMenu]);
  
  // Effect to handle scrolling when task form appears
  useEffect(() => {
    if (isAddingTask && taskFormRef.current && scrollContainerRef.current) {
      const scrollContainer = scrollContainerRef.current;
      const taskForm = taskFormRef.current;
      
      // Get the form's position relative to the scroll container
      const formRect = taskForm.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();
      
      // Calculate how much of the form is visible
      const formBottom = formRect.bottom;
      const containerBottom = containerRect.bottom;
      
      // If the form bottom is below the container's visible area
      if (formBottom > containerBottom) {
        // Calculate how much we need to scroll to show the entire form
        const additionalScroll = formBottom - containerBottom + 20; // 20px padding
        
        scrollContainer.scrollBy({
          top: additionalScroll,
          behavior: 'smooth'
        });
      }
    }
  }, [isAddingTask]);
  
  const handleAddTask = () => {
    if (!authStatus.isAuthenticated && authStatus.shouldShowAuth) {
      triggerAuthenticationFlow();
      return;
    }
    setIsAddingTask(true);
    setEditingTaskId(null);
  };
  
  const handleCancelForm = () => {
    setIsAddingTask(false);
    setEditingTaskId(null);
  };
  
  const handleTaskManagement = () => {
    navigate('/projects');
    setShowDetailsMenu(false);
  };
  
  return (
    <div className={`h-full flex flex-col ${className}`}>
      <div className="px-4 py-3">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-text-primary text-left">
            {taskListViewMode === 'pomodoro' ? 'Tasks In Pomodoro' : 'Task list today'}
          </h2>
          <div className="flex items-center gap-1">
            <Tooltip text="Hide task list (Cmd + \)" placement="bottom">
              <button 
                onClick={() => useUIStore.getState().toggleRightSidebar()}
                className="p-2 text-text-secondary hover:bg-background-primary rounded-md hover:text-text-primary transition-colors"
                aria-label="Hide task list"
              >
                <Icon name="arrow-right-double-line" size={16} />
              </button>
            </Tooltip>
            <div className="relative details-menu">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDetailsMenu(!showDetailsMenu);
                }}
                className="p-2 text-text-secondary hover:bg-background-primary rounded-md"
              >
                <i className="ri-more-2-fill w-5 h-5"></i>
              </button>
              {showDetailsMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-background-secondary border border-border rounded-lg shadow-lg z-10">
                <div className="py-1">
                  <button 
                    onClick={async () => {
                      await setTaskListViewMode(taskListViewMode === 'pomodoro' ? 'today' : 'pomodoro');
                      setShowDetailsMenu(false);
                    }}
                    className="w-full px-4 py-2 text-sm text-text-primary hover:bg-background-primary text-left flex items-center whitespace-nowrap"
                  >
                    <i className={`${taskListViewMode === 'pomodoro' ? 'ri-calendar-line' : 'ri-timer-line'} w-5 h-5 mr-2 flex-shrink-0`}></i>
                    {taskListViewMode === 'pomodoro' ? 'Show tasks list today' : 'Show tasks list In Pomodoro'}
                  </button>
                  <button 
                    onClick={handleMoveCompletedDown}
                    className="w-full px-4 py-2 text-sm text-text-primary hover:bg-background-primary text-left flex items-center whitespace-nowrap"
                  >
                    <i className="ri-arrow-down-line w-5 h-5 mr-2 flex-shrink-0"></i>
                    Move down completed tasks
                  </button>
                  <button 
                    onClick={handleArchiveCompleted}
                    className="w-full px-4 py-2 text-sm text-text-primary hover:bg-background-primary text-left flex items-center whitespace-nowrap"
                  >
                    <i className="ri-archive-line w-5 h-5 mr-2 flex-shrink-0"></i>
                    Archive completed tasks
                  </button>
                  <button 
                    onClick={handleTaskManagement}
                    className="w-full px-4 py-2 text-sm text-text-primary hover:bg-background-primary text-left flex items-center whitespace-nowrap"
                  >
                    <i className="ri-task-line w-5 h-5 mr-2 flex-shrink-0"></i>
                    Task management
                  </button>
                </div>
              </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Total Time Tracking Section */}
        <TimeSpent />
      </div>
      
      <div 
        className={`flex-1 overflow-y-auto scrollbar-thin ${compactView ? 'compact-view' : ''}`} 
        ref={scrollContainerRef}
      >
        <div className="p-4">
          <div className="space-y-2.5" id="taskList" ref={taskListRef}>
            <TaskListSorted />
            
            {/* Task Creation Form */}
            {isAddingTask && (
              <div ref={taskFormRef}>
                <TaskForm 
                  onCancel={handleCancelForm} 
                  status="pomodoro"
                />
              </div>
            )}
            
            {/* Add New Task Button */}
            {!isAddingTask && !editingTaskId && (
              <button
                onClick={handleAddTask}
                className="w-full p-4 border-2 border-dashed border-border rounded-lg text-text-secondary hover:border-text-secondary hover:text-text-primary transition-colors duration-200 text-left"
              >
                + Add new task
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskList;