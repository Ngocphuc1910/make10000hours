import React, { useState, useRef, useEffect } from 'react';
import { Clock, Plus, Minus } from 'lucide-react';

const TaskDialog = ({ isOpen, onClose, onAddTask }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [project, setProject] = useState('work');
  const [priority, setPriority] = useState('medium');
  const [estimatedPomodoros, setEstimatedPomodoros] = useState(1);
  const titleInputRef = useRef(null);
  
  // Focus the title input when the dialog opens
  useEffect(() => {
    if (isOpen && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    console.log('DEBUGGING: TaskDialog - Form submitted');
    
    // Basic validation
    if (!title.trim()) {
      console.log('DEBUGGING: TaskDialog - Validation failed: title is empty');
      return;
    }
    
    // Create task object
    const task = {
      title: title.trim(),
      description: description.trim(),
      estimatedPomodoros: parseInt(estimatedPomodoros, 10) || 1, // Ensure we have a valid number
      completed: false
    };
    
    console.log('DEBUGGING: TaskDialog - Submitting task:', task);
    
    // Call the onAddTask function provided by parent
    onAddTask(task);
    console.log('DEBUGGING: TaskDialog - Task submitted to parent'); 
    
    // Reset form and close dialog
    resetForm();
    onClose();
    console.log('DEBUGGING: TaskDialog - Dialog closed');
  };
  
  const resetForm = () => {
    setTitle('');
    setDescription('');
    setProject('work');
    setPriority('medium');
    setEstimatedPomodoros(1);
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-600/50 dark:bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm max-w-md w-full p-6 max-h-[90vh] overflow-y-auto text-gray-900 dark:text-white">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Add New Task</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            &times;
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium mb-1">
                Task Name*
              </label>
              <input
                id="title"
                type="text"
                ref={titleInputRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What are you working on?"
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900"
                required
              />
            </div>
            
            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-1">
                Description (Optional)
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add notes or details about this task"
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 px-3 py-2 min-h-[80px] bg-white dark:bg-gray-900"
                maxLength={500}
              />
              <div className="text-xs text-right text-gray-500">
                {description.length}/500
              </div>
            </div>
            
            <div>
              <label htmlFor="project" className="block text-sm font-medium mb-1">
                Project
              </label>
              <select
                id="project"
                value={project}
                onChange={(e) => setProject(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900"
              >
                <option value="none">No Project</option>
                <option value="work">Work</option>
                <option value="study">Study</option>
                <option value="personal">Personal</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="priority" className="block text-sm font-medium mb-1">
                Priority
              </label>
              <select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Estimated Pomodoros
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="p-2 rounded-md border border-gray-300 dark:border-gray-700"
                  onClick={() => setEstimatedPomodoros(Math.max(1, estimatedPomodoros - 1))}
                >
                  <Minus className="h-4 w-4" />
                </button>
                
                <div className="flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <span>{estimatedPomodoros}</span>
                </div>
                
                <button
                  type="button"
                  className="p-2 rounded-md border border-gray-300 dark:border-gray-700"
                  onClick={() => setEstimatedPomodoros(estimatedPomodoros + 1)}
                >
                  <Plus className="h-4 w-4" />
                </button>
                
                <span className="text-gray-500 text-sm ml-2">
                  Est. {estimatedPomodoros * 25} min
                </span>
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-gray-900 text-white"
            >
              Add Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskDialog; 