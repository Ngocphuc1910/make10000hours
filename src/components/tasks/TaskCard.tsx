import React, { useState, useRef } from 'react';
import type { Task } from '../../types/models';
import { useTaskStore } from '../../store/taskStore';
import { Icon } from '../ui/Icon';
import CustomCheckbox from '../ui/CustomCheckbox';
import TaskForm from './TaskForm';

interface TaskCardProps {
  task: Task;
  onStatusChange: (taskId: string, status: Task['status']) => void;
  onReorder?: (draggedTaskId: string, targetTaskId: string, insertAfter?: boolean) => void;
  onCrossColumnMove?: (draggedTaskId: string, targetTaskId: string, newStatus: Task['status'], insertAfter?: boolean) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onStatusChange, onReorder, onCrossColumnMove }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragPosition, setDragPosition] = useState<'top' | 'bottom' | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const toggleTaskCompletion = useTaskStore(state => state.toggleTaskCompletion);
  const projects = useTaskStore(state => state.projects);

  const project = projects.find(p => p.id === task.projectId);

  // Project color indicator styles
  const getStatusIndicator = () => {
    if (!project) return null;
    return (
      <span 
        className="inline-block w-2 h-2 rounded-full mr-1.5" 
        style={{ backgroundColor: project.color }}
      ></span>
    );
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.setData('application/x-task-status', task.status);
    if (cardRef.current) {
      cardRef.current.classList.add('dragging');
    }
  };

  const handleDragEnd = () => {
    if (cardRef.current) {
      cardRef.current.classList.remove('dragging');
    }
    setIsDragOver(false);
    setDragPosition(null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) {
      const y = e.clientY - rect.top;
      const height = rect.height;
      const isTopHalf = y < height / 2;
      setDragPosition(isTopHalf ? 'top' : 'bottom');
      setIsDragOver(true);
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only hide indicators if actually leaving the card
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX;
      const y = e.clientY;
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        setIsDragOver(false);
        setDragPosition(null);
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setDragPosition(null);
    
    const draggedTaskId = e.dataTransfer.getData('text/plain');
    const draggedTaskStatus = e.dataTransfer.getData('application/x-task-status');
    
    if (draggedTaskId && draggedTaskId !== task.id) {
      if (draggedTaskStatus === task.status && onReorder) {
        // Same column reordering
        onReorder(draggedTaskId, task.id, dragPosition === 'bottom');
      } else if (draggedTaskStatus !== task.status && onCrossColumnMove) {
        // Cross column move with positioning
        onCrossColumnMove(draggedTaskId, task.id, task.status, dragPosition === 'bottom');
      }
    }
  };

  const handleCheckboxChange = () => {
    toggleTaskCompletion(task.id);
    // Status changes and timer handling are now managed automatically in the store
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  // Get task card colors based on status
  const getTaskCardClasses = () => {
    if (task.completed) {
      return 'bg-task-completed-bg border-task-completed-border';
    }
    
    switch (task.status) {
      case 'todo':
        return 'bg-task-todo-bg border-task-todo-border';
      case 'pomodoro':
        return 'bg-task-pomodoro-bg border-task-pomodoro-border';
      case 'completed':
        return 'bg-task-completed-bg border-task-completed-border';
      default:
        return 'bg-background-secondary border-border';
    }
  };

  if (isEditing) {
    return <TaskForm task={task} onCancel={() => setIsEditing(false)} />;
  }

  return (
    <div className="relative">
      {/* Drop indicator lines */}
      {isDragOver && dragPosition === 'top' && (
        <div className="absolute -top-1 left-0 right-0 h-0.5 border-t-2 border-dashed border-red-500 z-10"></div>
      )}
      {isDragOver && dragPosition === 'bottom' && (
        <div className="absolute -bottom-1 left-0 right-0 h-0.5 border-b-2 border-dashed border-red-500 z-10"></div>
      )}
      
      <div
        ref={cardRef}
        className={`task-card flex items-start p-3 ${getTaskCardClasses()}
        ${task.completed ? 'opacity-70 text-text-secondary' : ''}
        ${isDragOver ? 'drag-over' : ''}
        rounded-md hover:shadow-sm cursor-pointer transition-all duration-200`}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
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
                  {project?.name || 'Unknown project'}
                </span>
              </div>
              <span className="mx-2 text-border">•</span>
              <span className={`flex items-center ${task.completed ? 'text-text-secondary' : 'text-text-secondary'}`}>
                <i className="ri-time-line mr-1"></i>
                {task.timeSpent}/{task.timeEstimated}m
              </span>
            </div>
            {isExpanded && task.description && (
              <div className="task-description mt-2">
                <p className="text-sm text-text-secondary mb-2 whitespace-pre-wrap break-words">{task.description}</p>
              </div>
            )}
          </div>
          {task.description && (
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
          className="edit-task-btn p-1 rounded-full hover:bg-background-primary flex-shrink-0"
          onClick={handleEditClick}
        >
          <div className="w-5 h-5 flex items-center justify-center text-text-secondary">
            <i className="ri-edit-line"></i>
          </div>
        </button>
      </div>
      </div>
    </div>
  );
};

export default TaskCard; 