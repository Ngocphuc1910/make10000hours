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
  columnStatus?: Task['status'];
  context?: 'task-management' | 'pomodoro' | 'default';
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onStatusChange, onReorder, onCrossColumnMove, columnStatus, context = 'default' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragPosition, setDragPosition] = useState<'top' | 'bottom' | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const toggleTaskCompletion = useTaskStore(state => state.toggleTaskCompletion);
  const projects = useTaskStore(state => state.projects);
  const editingTaskId = useTaskStore(state => state.editingTaskId);
  const setEditingTaskId = useTaskStore(state => state.setEditingTaskId);
  
  const isEditing = editingTaskId === task.id;

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
      // Enhanced visual feedback - opacity and scale
      cardRef.current.classList.add('opacity-50');
      cardRef.current.style.transform = 'scale(1.02)';
      cardRef.current.style.transition = 'all 0.2s ease';
    }
  };

  const handleDragEnd = () => {
    if (cardRef.current) {
      cardRef.current.classList.remove('dragging', 'opacity-50');
      cardRef.current.style.transform = '';
      cardRef.current.style.transition = '';
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
    // Pass context information to know which column the task was completed from
    const context = columnStatus === 'todo' ? 'todo' : 'default';
    toggleTaskCompletion(task.id, context);
    // Status changes and timer handling are now managed automatically in the store
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // If another task is being edited, set this task as the new editing task
    // The TaskForm component will handle auto-saving the previous task
    setEditingTaskId(task.id);
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleTaskClick = (e: React.MouseEvent) => {
    // Only enable direct click editing in task management context
    if (context === 'task-management') {
      // Don't trigger if clicking on interactive elements
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('input') || target.closest('[role="checkbox"]')) {
        return;
      }
      
      e.stopPropagation();
      setEditingTaskId(task.id);
    }
  };

  // Get task card colors based on status
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

  if (isEditing) {
    return <TaskForm task={task} onCancel={() => setEditingTaskId(null)} />;
  }

  return (
    <div className="relative">
      {/* Seamless Drop indicator lines */}
      {isDragOver && dragPosition === 'top' && (
        <div className="absolute -top-1 left-0 right-0 h-0.5 bg-blue-500 rounded-full shadow-lg z-10 animate-pulse"></div>
      )}
      {isDragOver && dragPosition === 'bottom' && (
        <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-blue-500 rounded-full shadow-lg z-10 animate-pulse"></div>
      )}
      
      <div
        ref={cardRef}
        className={`task-card flex items-start p-3 border ${getTaskCardClasses()}
        ${task.completed ? 'opacity-70 text-text-secondary' : ''}
        ${isDragOver ? 'drag-over' : ''}
        rounded-md hover:shadow-sm cursor-pointer transition-all duration-200 ease-in-out`}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleTaskClick}
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

      {context !== 'task-management' && (
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
      )}
      </div>
    </div>
  );
};

export default TaskCard; 