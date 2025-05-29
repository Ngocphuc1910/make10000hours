import React, { useState, useRef } from 'react';
import type { Task } from '../../types/models';
import { useTaskStore } from '../../store/taskStore';
import { Icon } from '../ui/Icon';
import CustomCheckbox from '../ui/CustomCheckbox';
import TaskForm from './TaskForm';

interface TaskCardProps {
  task: Task;
  onStatusChange: (taskId: string, status: Task['status']) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onStatusChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const toggleTaskCompletion = useTaskStore(state => state.toggleTaskCompletion);
  const projects = useTaskStore(state => state.projects);

  const project = projects.find(p => p.id === task.projectId);

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

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('text/plain', task.id);
    if (cardRef.current) {
      cardRef.current.classList.add('opacity-50', 'scale-95');
    }
  };

  const handleDragEnd = () => {
    if (cardRef.current) {
      cardRef.current.classList.remove('opacity-50', 'scale-95');
    }
  };

  const handleCheckboxChange = () => {
    toggleTaskCompletion(task.id);
    
    // If completing a task, update its status too
    if (!task.completed) {
      onStatusChange(task.id, 'completed');
    } else {
      // If un-completing a task from 'completed', move to 'pomodoro'
      onStatusChange(task.id, 'pomodoro');
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  if (isEditing) {
    return <TaskForm task={task} onCancel={() => setIsEditing(false)} />;
  }

  return (
    <div
      ref={cardRef}
      className={`task-card flex items-start p-3 bg-white border border-gray-200 
      ${task.completed ? 'opacity-70 text-gray-500' : ''}
      rounded-md hover:shadow-sm cursor-pointer transition-all duration-200`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
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
            {isExpanded && task.description && (
              <div className="task-description mt-2">
                <p className="text-sm text-gray-600 mb-2 whitespace-pre-wrap break-words">{task.description}</p>
              </div>
            )}
          </div>
          {task.description && (
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
  );
};

export default TaskCard; 