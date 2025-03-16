import React, { useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { useTask } from '../../hooks/useTask';

const QuickActions = () => {
  const [newTask, setNewTask] = useState('');
  const { addTask } = useTask();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newTask.trim()) {
      addTask({
        title: newTask,
        completed: false,
        pomodoros: 0,
        estimatedPomodoros: 1,
      });
      setNewTask('');
    }
  };

  return (
    <div className="border rounded-lg p-4 shadow-sm dark:border-gray-800 bg-white dark:bg-gray-900">
      <h2 className="font-semibold text-lg mb-4">Quick Actions</h2>
      
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