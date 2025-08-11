import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTaskStore } from '../../store/taskStore';
import { useTimerStore } from '../../store/timerStore';
import type { Task, Project } from '../../types/models';
import CustomCheckbox from '../ui/CustomCheckbox';

interface TaskItemProps {
  task: Task;
  project: Project;
  onEdit: (taskId: string) => void;
  className?: string;
  // Drag and drop props
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnter?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
  context?: 'task-management' | 'pomodoro' | 'default';
}

export const TaskItem: React.FC<TaskItemProps> = ({ 
  task, 
  project,
  onEdit,
  className = '',
  draggable,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  context = 'pomodoro'
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const location = useLocation();
  const { toggleTaskCompletion } = useTaskStore();
  
  // Use selectors to only subscribe to the specific values we need
  const currentTask = useTimerStore(state => state.currentTask);
  const setCurrentTask = useTimerStore(state => state.setCurrentTask);
  
  const isSelected = currentTask?.id === task.id;
  
  // Detect if we're on the Pomodoro page
  const isPomodoroPage = location.pathname === '/pomodoro' || location.pathname === '/';
  
  // Project color indicator styles
  const getStatusIndicator = () => {
    return (
      <span 
        className="inline-block w-2 h-2 rounded-full mr-1.5" 
        style={{ backgroundColor: project.color }}
      ></span>
    );
  };
  
  const handleTaskClick = (e: React.MouseEvent) => {
    // Ignore clicks on checkbox, edit button, or expand button
    if (
      e.target instanceof HTMLElement && 
      (e.target.closest('input[type="checkbox"]') || 
       e.target.closest('.edit-task-btn') ||
       e.target.closest('.expand-button'))
    ) {
      return;
    }
    
    // Don't select completed tasks
    if (task.completed) return;
    
    setCurrentTask(task);
  };
  
  const handleCheckboxChange = async () => {
    // Use Pomodoro context when on Pomodoro page for auto-switching
    const context = isPomodoroPage ? 'pomodoro' : 'default';
    console.log('TaskItem completion:', {
      taskId: task.id,
      taskTitle: task.title,
      currentPath: location.pathname,
      isPomodoroPage,
      context,
      isCurrentlyActiveTask: isSelected
    });
    
    const nextTask = await toggleTaskCompletion(task.id, context);
    
    if (context === 'pomodoro' && nextTask) {
      console.log('Next task selected:', nextTask.title);
    } else if (context === 'pomodoro' && !nextTask) {
      console.log('No next task available');
    }
  };
  
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(task.id);
  };
  
  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  // Get task card colors based on status - matches TaskCard component
  const getTaskCardClasses = () => {
    if (task.completed) {
      return context === 'task-management' 
        ? 'bg-task-completed-bg border-task-completed-border dark:border-transparent'
        : 'bg-task-completed-bg border-task-completed-border';
    }
    
    switch (task.status) {
      case 'todo':
        return context === 'task-management'
          ? 'bg-task-todo-bg border-task-todo-border dark:border-transparent'
          : 'bg-task-todo-bg border-task-todo-border';
      case 'pomodoro':
        return context === 'task-management'
          ? 'bg-task-pomodoro-bg border-task-pomodoro-border dark:border-transparent'
          : 'bg-task-pomodoro-bg border-task-pomodoro-border';
      case 'completed':
        return context === 'task-management'
          ? 'bg-task-completed-bg border-task-completed-border dark:border-transparent'
          : 'bg-task-completed-bg border-task-completed-border';
      default:
        return context === 'task-management'
          ? 'bg-background-secondary border-border dark:border-transparent'
          : 'bg-background-secondary border-border';
    }
  };
  
  return (
    <div 
      className={`task-card flex items-start ${getTaskCardClasses()}
      ${isSelected ? '!border-primary' : ''} 
      ${task.completed ? 'opacity-70 text-text-secondary' : ''}
      rounded-md hover:shadow-sm ${draggable ? 'cursor-grab' : 'cursor-pointer'} ${className}`}
      onClick={handleTaskClick}
      style={{ 
        borderWidth: isSelected ? '2px' : '1px',
        borderColor: isSelected ? '#BA4949' : undefined,
        padding: '10px'
      }}
      data-task-id={task.id}
      data-status={task.status}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="mr-3 mt-0.5">
        <CustomCheckbox
          id={`task-checkbox-${task.id}`} 
          checked={task.completed} 
          onChange={handleCheckboxChange}
        />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 mr-2">
            <h4 
              className={`text-sm font-medium text-left whitespace-pre-wrap break-words
              ${task.completed ? 'text-text-secondary line-through' : 'text-text-primary'}`}
            >
              {task.title}
            </h4>
            <div className="flex items-center mt-0.5 text-xs text-left">
              <div className="flex items-center">
                {getStatusIndicator()}
                <span className={`${task.completed ? 'text-text-secondary' : 'text-text-secondary'}`}>
                  {project.name}
                </span>
              </div>
              <span className="mx-2 text-border">•</span>
              <span className={`flex items-center ${task.completed ? 'text-text-secondary' : 'text-text-secondary'}`}>
                <i className="ri-time-line mr-1"></i>
                {task.timeSpent}/{task.timeEstimated}m
              </span>
            </div>
            {isExpanded && task.description && task.description.trim() && (
              <div className="task-description mt-2">
                <p className="text-sm text-text-secondary mb-2 whitespace-pre-wrap break-words">{task.description}</p>
              </div>
            )}
          </div>
          {task.description && task.description.trim() && (
            <button 
              className="expand-button p-1 rounded-full hover:bg-background-container flex-shrink-0"
              onClick={handleExpandClick}
            >
              <div className="w-5 h-5 flex items-center justify-center text-text-secondary">
                <i className={`ri-arrow-${isExpanded ? 'up' : 'down'}-s-line`}></i>
              </div>
            </button>
          )}
        </div>
      </div>
      <div className="task-menu ml-4 flex items-start">
        <button 
          className="edit-task-btn p-1 rounded-full hover:bg-background-container flex-shrink-0"
          onClick={handleEditClick}
        >
          <div className="w-5 h-5 flex items-center justify-center text-text-secondary">
            <i className="ri-edit-line"></i>
          </div>
        </button>
      </div>
    </div>
  );
};

export default TaskItem; 