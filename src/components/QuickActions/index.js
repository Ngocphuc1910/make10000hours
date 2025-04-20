import React, { useState } from 'react';
import { Plus, Check, Play, FolderPlus } from 'lucide-react';
import { useTask } from '../../hooks/useTask';
import { useAuth } from '../../hooks/useAuth';

const QuickActions = () => {
  const [newTask, setNewTask] = useState('');
  const { addTask, addSessionTask } = useTask();
  const { currentUser } = useAuth();

  const handleSubmit = (e) => {
    e.preventDefault();
    const taskTitle = newTask.trim();
    
    if (taskTitle) {
      console.log('QuickActions: Adding session task with title:', taskTitle);
      console.log('QuickActions: Current user is:', currentUser?.id || 'not logged in');
      
      addSessionTask({
        title: taskTitle,
        completed: false,
        pomodoros: 0,
        estimatedPomodoros: 1,
      })
      .then(createdTask => {
        console.log('QuickActions: Task created successfully:', createdTask);
      })
      .catch(error => {
        console.error('QuickActions: Error creating task:', error);
      });
      
      setNewTask('');
    } else {
      console.log('QuickActions: Cannot add task with empty title');
    }
  };

  return (
    <div className="rounded-lg p-4 bg-white dark:bg-gray-800">
      <h2 className="font-semibold text-lg mb-4 text-gray-900 dark:text-white">Quick Actions</h2>
      
      <div className="space-y-3">
        {/* Quick Start button */}
        <button 
          className="w-full flex items-center justify-center gap-2 bg-gray-900 dark:bg-[#141824] hover:bg-gray-800 dark:hover:bg-[#1c202e] text-white p-3 rounded-md transition-colors"
        >
          <Play className="w-5 h-5" />
          <span>Quick Start</span>
        </button>
        
        {/* New Task button */}
        <button 
          className="w-full flex items-center justify-center gap-2 bg-white dark:bg-[#1e2433] border border-gray-300 dark:border-[#2a3042] hover:bg-gray-50 dark:hover:bg-[#252a3a] text-gray-800 dark:text-white p-3 rounded-md transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>New Task</span>
        </button>
        
        {/* New Project button */}
        <button 
          className="w-full flex items-center justify-center gap-2 bg-white dark:bg-[#1e2433] border border-gray-300 dark:border-[#2a3042] hover:bg-gray-50 dark:hover:bg-[#252a3a] text-gray-800 dark:text-white p-3 rounded-md transition-colors"
        >
          <FolderPlus className="w-5 h-5" />
          <span>New Project</span>
        </button>
      </div>
      
      {/* Form for adding quick tasks - hidden by default */}
      <div className="hidden">
        <form onSubmit={handleSubmit} className="flex mb-4">
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Add quick task..."
            className="flex-1 py-2 px-3 rounded-l-md border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button 
            type="submit"
            className="flex items-center justify-center bg-primary hover:bg-primary-dark text-white px-3 rounded-r-md"
          >
            <Plus className="w-5 h-5" />
          </button>
        </form>
        
        <div className="space-y-2">
          <QuickTask
            title="Complete project setup"
            isCompleted={false}
          />
          <QuickTask
            title="Review documentation"
            isCompleted={true}
          />
          <QuickTask
            title="Write test cases"
            isCompleted={false}
          />
        </div>
      </div>
    </div>
  );
};

const QuickTask = ({ title, isCompleted }) => {
  const [completed, setCompleted] = useState(isCompleted);
  
  return (
    <div className="flex items-center">
      <button
        className={`w-5 h-5 border rounded-md mr-3 flex items-center justify-center ${
          completed ? 'bg-primary border-primary' : 'border-gray-300 dark:border-gray-700'
        }`}
        onClick={() => setCompleted(!completed)}
      >
        {completed && <Check className="w-3 h-3 text-white" />}
      </button>
      <span className={`text-sm ${completed ? 'line-through text-gray-500' : ''}`}>
        {title}
      </span>
    </div>
  );
};

export default QuickActions; 