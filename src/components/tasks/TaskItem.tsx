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
  const { currentTaskId, setCurrentTaskId } = useTimerStore();
  
  const isSelected = currentTaskId === task.id;
  
  // Status indicator styles
  const getStatusIndicator = () => {
    switch (task.status) {
      case 'pomodoro':
        return <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-1.5"></span>;
      case 'todo':
        return <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-1.5"></span>;
      case 'completed':
        return <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1.5"></span>;
      default:
        return null;
    }
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
    
    setCurrentTaskId(task.id);
  };
  
  const handleCheckboxChange = () => {
    toggleTaskCompletion(task.id);
    
    // If this was the current task, deselect it when marked complete
    if (isSelected && !task.completed) {
      setCurrentTaskId(null);
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
  
  return (
    <div 
      className={`task-card flex items-start p-3 bg-white border 
      ${isSelected ? 'border-primary' : 'border-gray-200'} 
      ${task.completed ? 'opacity-70 text-gray-500' : ''}
      rounded-md hover:shadow-sm cursor-pointer ${className}`}
      onClick={handleTaskClick}
      style={{ borderWidth: isSelected ? '2px' : '1px' }}
      data-task-id={task.id}
      data-status={task.status}
    >
      <div className="mr-3 mt-0.5">
        <CustomCheckbox 
          checked={task.completed} 
          onChange={handleCheckboxChange}
        />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 mr-2">
            <h4 
              className={`text-sm font-medium truncate text-left
              ${task.completed ? 'text-gray-500 line-through' : 'text-gray-900'}`}
            >
              {task.title}
            </h4>
            <div className="flex items-center mt-0.5 text-xs text-left">
              <div className="flex items-center">
                {getStatusIndicator()}
                <span className={`${task.completed ? 'text-gray-500' : 'text-gray-600'}`}>
                  {project.name}
                </span>
              </div>
              <span className="mx-2 text-gray-300">•</span>
              <span className={`flex items-center ${task.completed ? 'text-gray-500' : 'text-gray-600'}`}>
                <i className="ri-time-line mr-1"></i>
                {task.timeSpent}/{task.timeEstimated}m
              </span>
            </div>
            {isExpanded && task.description && (
              <div className="task-description mt-2">
                <p className="text-sm text-gray-600 mb-2">{task.description}</p>
              </div>
            )}
          </div>
          <button 
            className="expand-button p-1 rounded-full hover:bg-gray-100 flex-shrink-0"
            onClick={handleExpandClick}
          >
            <div className="w-5 h-5 flex items-center justify-center text-gray-400">
              <i className={`ri-arrow-${isExpanded ? 'up' : 'down'}-s-line`}></i>
            </div>
          </button>
        </div>
      </div>
      <div className="task-menu ml-4 flex items-start">
        <button 
          className="edit-task-btn p-1 rounded-full hover:bg-gray-100 flex-shrink-0"
          onClick={handleEditClick}
        >
          <div className="w-5 h-5 flex items-center justify-center text-gray-400">
            <i className="ri-edit-line"></i>
          </div>
        </button>
      </div>
    </div>
  );
};

export default TaskItem; 