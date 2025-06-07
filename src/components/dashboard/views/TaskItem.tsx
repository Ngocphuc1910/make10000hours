import React, { useState, useRef } from 'react';
import type { Task } from '../../../types/models';
import { useTaskStore } from '../../../store/taskStore';
import { Icon } from '../../ui/Icon';
import CustomCheckbox from '../../ui/CustomCheckbox';
import TaskForm from '../../tasks/TaskForm';
import { useUserStore } from '../../../store/userStore';

interface TaskItemProps {
  task?: Task;
  projectId?: string;
  projectColor?: string;
  isNewTask?: boolean;
  onCancel?: () => void;
  onReorder?: (draggedTaskId: string, targetTaskId: string, insertAfter?: boolean) => void;
  onCrossProjectMove?: (draggedTaskId: string, targetTaskId: string, newProjectId: string, insertAfter?: boolean) => void;
}

const TaskItem: React.FC<TaskItemProps> = ({
  task,
  projectId,
  projectColor = '#4f46e5',
  isNewTask = false,
  onCancel,
  onReorder,
  onCrossProjectMove
}) => {
  const updateTask = useTaskStore(state => state.updateTask);
  const toggleTaskCompletion = useTaskStore(state => state.toggleTaskCompletion);
  const projects = useTaskStore(state => state.projects);
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(isNewTask);
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragPosition, setDragPosition] = useState<'top' | 'bottom' | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Get project info
  const project = task ? projects.find(p => p.id === task.projectId) : null;

  // Status indicator styles
  const getStatusIndicator = () => {
    if (!task) return null;
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
  
  // Handle checkbox change
  const handleCheckboxChange = () => {
    if (!task) return;
    toggleTaskCompletion(task.id);
  };
  
  // Handle entering edit mode
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  // Handle expand click
  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  // Handle form cancel
  const handleFormCancel = () => {
    setIsEditing(false);
    if (isNewTask && onCancel) {
      onCancel();
    }
  };
  
  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent) => {
    if (!task) return;
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.setData('application/x-task-project', task.projectId);
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
  
  const handleDragOver = (e: React.DragEvent) => {
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
  
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
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
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setDragPosition(null);
    
    const draggedTaskId = e.dataTransfer.getData('text/plain');
    const draggedTaskProjectId = e.dataTransfer.getData('application/x-task-project');
    
    if (draggedTaskId && draggedTaskId !== task?.id && task) {
      if (draggedTaskProjectId === task.projectId && onReorder) {
        // Same project reordering
        onReorder(draggedTaskId, task.id, dragPosition === 'bottom');
      } else if (draggedTaskProjectId !== task.projectId && onCrossProjectMove) {
        // Cross project move with positioning
        onCrossProjectMove(draggedTaskId, task.id, task.projectId, dragPosition === 'bottom');
      }
    }
  };

  // If we're in edit mode or creating a new task, show the TaskForm
  if (isEditing || isNewTask) {
    return (
      <TaskForm 
        task={task}
        status={task?.status || 'todo'}
        initialProjectId={isNewTask ? projectId : undefined}
        onCancel={handleFormCancel}
      />
    );
  }

  // If no task, don't render anything
  if (!task) return null;

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
        className={`task-card flex items-start p-3 bg-white border border-gray-200 
        ${task.completed ? 'opacity-70 text-gray-500' : ''}
        ${isDragOver ? 'drag-over' : ''}
        rounded-md hover:shadow-sm cursor-pointer transition-all duration-200`}
        draggable={true}
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
              ${task.completed ? 'text-gray-500 line-through' : 'text-gray-900'}`}
            >
              {task.title}
            </h4>
            <div className="flex items-center mt-0.5 text-xs text-left">
              <div className="flex items-center">
                {getStatusIndicator()}
                <span className={`${task.completed ? 'text-gray-500' : 'text-gray-600'}`}>
                  {project?.name || 'Unknown project'}
                </span>
              </div>
              <span className="mx-2 text-gray-300">•</span>
              <span className={`flex items-center ${task.completed ? 'text-gray-500' : 'text-gray-600'}`}>
                <i className="ri-time-line mr-1"></i>
                {task.timeSpent}/{task.timeEstimated}m
              </span>
            </div>
            {isExpanded && task.description && task.description.trim() && (
              <div className="task-description mt-2">
                <p className="text-sm text-gray-600 mb-2 whitespace-pre-wrap break-words">{task.description}</p>
              </div>
            )}
          </div>
          {task.description && task.description.trim() && (
            <button 
              className="expand-button p-1 rounded-full hover:bg-gray-100 flex-shrink-0"
              onClick={handleExpandClick}
            >
              <div className="w-5 h-5 flex items-center justify-center text-gray-400">
                <i className={`ri-arrow-${isExpanded ? 'up' : 'down'}-s-line`}></i>
              </div>
            </button>
          )}
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
    </div>
  );
};

export default TaskItem; 