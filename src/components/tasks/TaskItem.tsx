import React, { useState } from 'react';
import { useTaskStore } from '../../store/taskStore';
import { useTimerStore } from '../../store/timerStore';
import type { Task, Project } from '../../types/models';
import CustomCheckbox from '../ui/CustomCheckbox';

interface TaskItemProps {
  task: Task;
  project: Project;
  onEdit: (taskId: string) => void;
  className?: string;
}

export const TaskItem: React.FC<TaskItemProps> = ({ 
  task, 
  project,
  onEdit,
  className = '' 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { toggleTaskCompletion } = useTaskStore();
  
  // Use selectors to only subscribe to the specific values we need
  const currentTask = useTimerStore(state => state.currentTask);
  const setCurrentTask = useTimerStore(state => state.setCurrentTask);
  
  const isSelected = currentTask?.id === task.id;
  
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
  
  const handleCheckboxChange = () => {
    toggleTaskCompletion(task.id);
    // Timer pausing and task deselection is now handled automatically in the store
  };
  
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(task.id);
  };
  
  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };
  
  return (
    <div 
      className={`task-card flex items-start p-3 bg-task-todo-bg border 
      ${isSelected ? 'border-primary' : 'border-task-todo-border'} 
      ${task.completed ? 'opacity-70 text-text-secondary' : ''}
      rounded-md hover:shadow-sm cursor-pointer ${className}`}
      onClick={handleTaskClick}
      style={{ borderWidth: isSelected ? '2px' : '1px' }}
      data-task-id={task.id}
      data-status={task.status}
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