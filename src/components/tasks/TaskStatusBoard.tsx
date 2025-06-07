import React, { useState } from 'react';
import { useTaskStore } from '../../store/taskStore';
import type { Task } from '../../types/models';
import { TaskColumn } from './';
import { ToastNotification } from './';

interface TaskStatusBoardProps {
  className?: string;
}

type ToastMessage = {
  id: string;
  message: string;
  taskId?: string;
  undoAction?: () => void;
};

const TaskStatusBoard: React.FC<TaskStatusBoardProps> = ({ className = '' }) => {
  const tasks = useTaskStore(state => state.tasks);
  const updateTaskStatus = useTaskStore(state => state.updateTaskStatus);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Filter tasks by status
  const pomodoroTasks = tasks.filter(task => task.status === 'pomodoro');
  const todoTasks = tasks.filter(task => task.status === 'todo');
  const completedTasks = tasks.filter(task => task.status === 'completed');

  // Handle task status change
  const handleTaskStatusChange = (taskId: string, newStatus: Task['status']) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const oldStatus = task.status;
    updateTaskStatus(taskId, newStatus);

    // Create toast message
    let message = '';
    if (newStatus === 'completed') {
      message = 'Task moved to Completed';
    } else if (newStatus === 'todo') {
      message = oldStatus === 'completed' ? 'Task moved to To Do List' : 'Task marked as incomplete';
    } else if (newStatus === 'pomodoro') {
      message = 'Task moved to In Pomodoro';
    }

    // Add toast with undo action
    addToast(message, taskId, () => {
      updateTaskStatus(taskId, oldStatus);
    });
  };

  // Add toast notification
  const addToast = (message: string, taskId?: string, undoAction?: () => void) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, taskId, undoAction }]);

    // Auto-remove toast after 3 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 3000);
  };

  // Remove toast notification
  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  return (
    <div className={`grid grid-cols-3 h-full ${className}`}>
      {/* To Do List Column */}
      <TaskColumn
        title="To Do List"
        tasks={todoTasks}
        status="todo"
        badgeColor="bg-blue-500"
        onStatusChange={handleTaskStatusChange}
      />

      {/* In Pomodoro Column */}
      <TaskColumn
        title="In Pomodoro"
        tasks={pomodoroTasks}
        status="pomodoro"
        badgeColor="bg-red-500"
        onStatusChange={handleTaskStatusChange}
      />

      {/* Completed Column */}
      <TaskColumn
        title="Completed"
        tasks={completedTasks}
        status="completed"
        badgeColor="bg-green-500"
        onStatusChange={handleTaskStatusChange}
      />
      
      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50">
        {toasts.map(toast => (
          <ToastNotification 
            key={toast.id}
            message={toast.message}
            onClose={() => removeToast(toast.id)}
            onUndo={toast.undoAction}
          />
        ))}
      </div>
    </div>
  );
};

export default TaskStatusBoard; 