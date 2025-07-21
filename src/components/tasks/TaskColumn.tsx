import React, { useState, useRef } from 'react';
import type { Task } from '../../types/models';
import { useTaskStore } from '../../store/taskStore';
import TaskCard from './TaskCard';
import TaskForm from './TaskForm';
import { Icon } from '../ui/Icon';
import { useAuthGuard, triggerAuthenticationFlow } from '../../utils/authGuard';

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
  const reorderTasks = useTaskStore(state => state.reorderTasks);
  const moveTaskToStatusAndPosition = useTaskStore(state => state.moveTaskToStatusAndPosition);
  const authStatus = useAuthGuard();

  // Handle task card reordering within the same column
  const handleTaskReorder = (draggedTaskId: string, targetTaskId: string, insertAfter: boolean = false) => {
    const draggedTask = tasks.find(t => t.id === draggedTaskId);
    const targetTask = tasks.find(t => t.id === targetTaskId);
    
    if (!draggedTask || !targetTask || draggedTask.status !== targetTask.status) {
      return;
    }

    // Calculate new index based on where we're dropping
    const allTasks = useTaskStore.getState().tasks;
    const targetIndex = allTasks.findIndex(t => t.id === targetTaskId);
    const newIndex = insertAfter ? targetIndex + 1 : targetIndex;
    
    reorderTasks(draggedTaskId, newIndex);
  };

  // Handle cross-column moves with positioning
  const handleCrossColumnMove = async (draggedTaskId: string, targetTaskId: string, newStatus: Task['status'], insertAfter: boolean = false) => {
    // Calculate the target position in the destination column
    const allTasks = useTaskStore.getState().tasks;
    const targetIndex = allTasks.findIndex(t => t.id === targetTaskId);
    const finalIndex = insertAfter ? targetIndex + 1 : targetIndex;
    
    // Use the atomic method to move task with status and position in one operation
    // Note: This method is now optimized to only update tasks that actually changed
    moveTaskToStatusAndPosition(draggedTaskId, newStatus, finalIndex);
  };
  
  return (
    <div className="status-section flex flex-col">
      {/* Status Section Header */}
      <div className="status-section-header px-4 py-3 border-b border-border sticky top-0 bg-background-primary z-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className={`status-badge ${
              status === 'pomodoro' ? 'pomodoro-badge' :
              status === 'todo' ? 'todo-badge' :
              status === 'completed' ? 'completed-badge' : ''
            }`}></span>
            <h3 className="font-medium text-text-primary">{title}</h3>
            <span className="ml-2 text-xs font-medium text-text-secondary bg-background-primary px-2 py-0.5 rounded-full">
              {tasks.length}
            </span>
          </div>
                      <button 
            className="p-1 rounded-full hover:bg-background-container"
            onClick={() => {
              if (!authStatus.isAuthenticated && authStatus.shouldShowAuth) {
                triggerAuthenticationFlow();
                return;
              }
              setIsAddingTask(true);
            }}
          >
            <div className="w-5 h-5 flex items-center justify-center text-text-secondary">
              <Icon name="add-line" />
            </div>
          </button>
        </div>
      </div>
      
      {/* Task List Container */}
      <div 
        className="task-list-container py-3 pl-3 pr-3 space-y-2 overflow-y-auto flex-1"
      >
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
            onReorder={handleTaskReorder}
            onCrossColumnMove={handleCrossColumnMove}
            columnStatus={status}
          />
        ))}
      </div>
    </div>
  );
};

export default TaskColumn; 