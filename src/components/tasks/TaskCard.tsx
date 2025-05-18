import React, { useState, useRef } from 'react';
import type { Task } from '../../types/models';
import { useTaskStore } from '../../store/taskStore';
import { Icon } from '../ui/Icon';
import TaskForm from './TaskForm';

interface TaskCardProps {
  task: Task;
  onStatusChange: (taskId: string, status: Task['status']) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onStatusChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const toggleTaskCompletion = useTaskStore(state => state.toggleTaskCompletion);
  const projects = useTaskStore(state => state.projects);

  const project = projects.find(p => p.id === task.projectId);

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
      // If un-completing a task from 'completed', move to 'todo'
      onStatusChange(task.id, 'todo');
    }
  };

  if (isEditing) {
    return <TaskForm task={task} onCancel={() => setIsEditing(false)} />;
  }

  return (
    <div
      ref={cardRef}
      className="task-card flex items-center p-3 bg-white border border-gray-200 rounded-md hover:shadow-sm transition-all duration-200"
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="mr-3">
        <input
          type="checkbox"
          className="appearance-none w-[18px] h-[18px] border-2 border-gray-300 rounded-[4px] relative cursor-pointer transition-all duration-200 checked:bg-primary checked:border-primary"
          checked={task.completed}
          onChange={handleCheckboxChange}
          style={{
            backgroundImage: task.completed ? `url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M5.707 7.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4a1 1 0 0 0-1.414-1.414L7 8.586 5.707 7.293z'/%3e%3c/svg%3e")` : 'none',
            backgroundSize: '80%',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-col">
          <h4 className={`text-sm font-medium ${task.completed ? 'text-gray-500 line-through' : 'text-gray-900'} truncate`}>
            {task.title}
          </h4>
          <div className="flex items-center text-xs text-gray-500">
            <span className="truncate">{project?.name || 'Unknown project'}</span>
            <span className="mx-2">·</span>
            <span className="flex items-center whitespace-nowrap">
              <Icon name="time-line" className="mr-1" />
              {task.timeSpent}/{task.timeEstimated}m
            </span>
          </div>
        </div>

        {task.description && (
          <div className={`description-container mt-2 ${isDescriptionExpanded ? '' : 'hidden'}`}>
            <p className="text-sm text-gray-600">{task.description}</p>
          </div>
        )}
      </div>

      <div className="task-menu ml-4 flex items-center">
        <button
          className="p-1 rounded-full hover:bg-gray-100"
          onClick={() => setIsEditing(true)}
        >
          <Icon name="edit-line" className="w-5 h-5 text-gray-400" />
        </button>
        
        {task.description && (
          <button
            className="p-1 rounded-full hover:bg-gray-100"
            onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
          >
            <Icon 
              name={isDescriptionExpanded ? "arrow-up-s-line" : "arrow-down-s-line"} 
              className="w-5 h-5 text-gray-400" 
            />
          </button>
        )}
      </div>
    </div>
  );
};

export default TaskCard; 