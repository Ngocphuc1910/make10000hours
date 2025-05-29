import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTaskStore } from '../../store/taskStore';
import TaskItem from './TaskItem';
import TaskForm from './TaskForm';
import type { Task } from '../../types/models';
import { formatMinutesToHoursAndMinutes } from '../../utils/timeUtils';

interface TaskListProps {
  className?: string;
  compactView?: boolean;
}

export const TaskList: React.FC<TaskListProps> = ({ 
  className = '',
  compactView = false
}) => {
  const navigate = useNavigate();
  const { 
    tasks, 
    projects, 
    isAddingTask, 
    editingTaskId, 
    showDetailsMenu,
    setIsAddingTask, 
    setEditingTaskId,
    setShowDetailsMenu,
    reorderTasks,
    handleMoveCompletedDown,
    handleArchiveCompleted
  } = useTaskStore();
  
  // For drag and drop
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const draggedTaskIndex = useRef<number>(-1);
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
      const formHeight = formRect.height;
      
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
  
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: string) => {
    // Store the dragged task ID
    setDraggedTaskId(taskId);
    
    // Find the task index
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    draggedTaskIndex.current = taskIndex;
    
    // Visual feedback
    e.currentTarget.classList.add('opacity-70', 'border-dashed');
  };
  
  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove('opacity-70', 'border-dashed');
    
    // Reset the dragged task ID
    setDraggedTaskId(null);
    draggedTaskIndex.current = -1;
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };
  
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.add('bg-gray-50');
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove('bg-gray-50');
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>, dropTargetId: string) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-gray-50');
    
    // If no task was dragged or dropping on itself, do nothing
    if (!draggedTaskId || draggedTaskId === dropTargetId) return;
    
    const draggedTask = tasks.find(t => t.id === draggedTaskId);
    const dropTarget = tasks.find(t => t.id === dropTargetId);
    
    if (!draggedTask || !dropTarget) return;
    
    // Just reorder the tasks, don't change completion status
    const dropIndex = tasks.findIndex(t => t.id === dropTargetId);
    reorderTasks(draggedTaskId, dropIndex);
  };
  
  const handleAddTask = () => {
    setIsAddingTask(true);
    setEditingTaskId(null);
  };
  
  const handleEditTask = (taskId: string) => {
    setEditingTaskId(taskId);
    setIsAddingTask(false);
  };
  
  const handleCancelForm = () => {
    setIsAddingTask(false);
    setEditingTaskId(null);
  };
  
  const handleTaskManagement = () => {
    navigate('/projects');
    setShowDetailsMenu(false);
  };
  
  // Sort tasks by order and filter to show only Pomodoro tasks
  // Keep completed tasks visible until manually archived
  const sortedTasks = [...tasks]
    .filter(task => {
      // Don't show archived tasks
      if (task.hideFromPomodoro) return false;
      
      // Show active pomodoro tasks
      if (task.status === 'pomodoro') return true;
      
      // Show completed tasks (regardless of current status, as long as they're marked completed)
      // These should stay visible until manually archived
      if (task.completed) return true;
      
      return false;
    })
    .sort((a, b) => a.order - b.order);

  // Calculate total time statistics for ALL visible tasks in the list
  const visibleTasks = tasks.filter(task => !task.hideFromPomodoro);
  const totalTimeSpent = visibleTasks.reduce((sum, task) => sum + (task.timeSpent || 0), 0);
  const totalTimeEstimated = visibleTasks.reduce((sum, task) => sum + (task.timeEstimated || 0), 0);
  const timeRemaining = Math.max(0, totalTimeEstimated - totalTimeSpent);
  
  return (
    <div className={`h-full flex flex-col ${className}`}>
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-gray-800 text-left">Tasks In Pomodoro</h2>
          <div className="relative details-menu">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowDetailsMenu(!showDetailsMenu);
              }}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-md"
            >
              <i className="ri-more-2-fill w-5 h-5"></i>
            </button>
            {showDetailsMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <div className="py-1">
                  <button 
                    onClick={handleMoveCompletedDown}
                    className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left flex items-center whitespace-nowrap"
                  >
                    <i className="ri-arrow-down-line w-5 h-5 mr-2 flex-shrink-0"></i>
                    Move down completed tasks
                  </button>
                  <button 
                    onClick={handleArchiveCompleted}
                    className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left flex items-center whitespace-nowrap"
                  >
                    <i className="ri-archive-line w-5 h-5 mr-2 flex-shrink-0"></i>
                    Archive completed tasks
                  </button>
                  <button 
                    onClick={handleTaskManagement}
                    className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left flex items-center whitespace-nowrap"
                  >
                    <i className="ri-task-line w-5 h-5 mr-2 flex-shrink-0"></i>
                    Task management
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Total Time Tracking Section */}
        <div className="text-sm text-gray-500">
          <span>Total time spent: </span>
          <span className="font-medium text-gray-700">
            {formatMinutesToHoursAndMinutes(totalTimeSpent)}
          </span>
          {totalTimeEstimated > 0 && (
            <span>
              {' '}({formatMinutesToHoursAndMinutes(timeRemaining)} left)
            </span>
          )}
        </div>
      </div>
      
      <div className={`flex-1 overflow-y-auto ${compactView ? 'compact-view' : ''}`} ref={scrollContainerRef}>
        <div className="p-4">
          <div className="space-y-3" id="taskList" ref={taskListRef}>
            {sortedTasks.map((task: Task) => {
              const project = projects.find(p => p.id === task.projectId);
              
              if (editingTaskId === task.id) {
                return (
                  <TaskForm 
                    key={task.id} 
                    task={task}
                    onCancel={handleCancelForm} 
                  />
                );
              }
              
              if (!project) return null;
              
              return (
                <div
                  key={task.id}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, task.id)}
                >
                  <TaskItem 
                    task={task} 
                    project={project} 
                    onEdit={handleEditTask} 
                  />
                </div>
              );
            })}
            
            {/* Task Creation Form */}
            {isAddingTask && (
              <div ref={taskFormRef}>
                <TaskForm onCancel={handleCancelForm} />
              </div>
            )}
            
            {/* Add New Task Button */}
            {!isAddingTask && !editingTaskId && (
              <button
                onClick={handleAddTask}
                className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors duration-200 text-left"
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