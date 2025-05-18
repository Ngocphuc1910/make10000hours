import React, { useState, useRef } from 'react';
import type { Task } from '../../types/models';
import { useTaskStore } from '../../store/taskStore';
import TaskCard from './TaskCard';
import TaskForm from './TaskForm';
import { Icon } from '../ui/Icon';

interface TaskColumnProps {
  title: string;
  tasks: Task[];
  status: Task['status'];
  badgeColor: string;
  onStatusChange: (taskId: string, status: Task['status']) => void;
}

const TaskColumn: React.FC<TaskColumnProps> = ({
  title,
  tasks,
  status,
  badgeColor,
  onStatusChange
}) => {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const columnRef = useRef<HTMLDivElement>(null);
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (columnRef.current) {
      columnRef.current.classList.add('bg-primary/5', 'border-dashed', 'border-primary');
    }
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (columnRef.current) {
      columnRef.current.classList.remove('bg-primary/5', 'border-dashed', 'border-primary');
    }
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (columnRef.current) {
      columnRef.current.classList.remove('bg-primary/5', 'border-dashed', 'border-primary');
    }
    
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      onStatusChange(taskId, status);
    }
  };
  
  return (
    <div 
      className="status-section bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      ref={columnRef}
    >
      <div className="status-section-header px-4 py-3 bg-gray-50 rounded-t-lg border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className={`w-2 h-2 rounded-full mr-2 ${badgeColor}`}></span>
            <h3 className="font-medium text-gray-900">{title}</h3>
            <span className="ml-2 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {tasks.length}
            </span>
          </div>
          <button 
            className="p-1 rounded-full hover:bg-gray-200 text-gray-500"
            onClick={() => setIsAddingTask(true)}
          >
            <Icon name="add-line" className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      <div className="task-list-container p-3 space-y-2 flex-1 overflow-y-auto">
        {isAddingTask && (
          <TaskForm 
            status={status} 
            onCancel={() => setIsAddingTask(false)} 
          />
        )}
        
        {tasks.map(task => (
          <TaskCard 
            key={task.id} 
            task={task}
            onStatusChange={onStatusChange}
          />
        ))}
      </div>
    </div>
  );
};

export default TaskColumn; 