import React, { useState, useEffect } from 'react';
import { useTaskStore } from '../../store/taskStore';
import { useUIStore } from '../../store/uiStore';

interface TaskFormProps {
  editingTaskId?: string | null;
  onCancel: () => void;
  className?: string;
}

export const TaskForm: React.FC<TaskFormProps> = ({ 
  editingTaskId = null, 
  onCancel,
  className = ''
}) => {
  const { tasks, projects, addTask, updateTask } = useTaskStore();
  const { showToast } = useUIStore();
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [timeSpent, setTimeSpent] = useState(0);
  const [timeEstimated, setTimeEstimated] = useState(0);
  
  // If editing, load task data
  useEffect(() => {
    if (editingTaskId) {
      const taskToEdit = tasks.find(task => task.id === editingTaskId);
      if (taskToEdit) {
        setTitle(taskToEdit.title);
        setDescription(taskToEdit.description || '');
        setProjectId(taskToEdit.projectId);
        setTimeSpent(taskToEdit.timeSpent);
        setTimeEstimated(taskToEdit.timeEstimated);
      }
    }
  }, [editingTaskId, tasks]);
  
  // Validation state
  const [titleError, setTitleError] = useState(false);
  const [projectError, setProjectError] = useState(false);
  
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    if (e.target.value.trim()) setTitleError(false);
  };
  
  const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setProjectId(e.target.value);
    if (e.target.value) setProjectError(false);
  };
  
  const handleSubmit = () => {
    // Validate form
    let isValid = true;
    
    if (!title.trim()) {
      setTitleError(true);
      isValid = false;
    }
    
    if (!projectId) {
      setProjectError(true);
      isValid = false;
    }
    
    if (!isValid) return;
    
    // Create task data object
    const taskData = {
      title: title.trim(),
      description: description.trim() || undefined,
      projectId,
      timeSpent,
      timeEstimated,
      completed: false
    };
    
    if (editingTaskId) {
      // Update existing task
      updateTask(editingTaskId, taskData);
      showToast('Task updated successfully');
    } else {
      // Add new task
      addTask(taskData);
      showToast('Task added successfully');
    }
    
    onCancel();
  };
  
  return (
    <div className={`task-card p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 animate-fade-in ${className}`}>
      <div className="flex flex-col gap-3 mb-3">
        <input 
          type="text" 
          value={title}
          onChange={handleTitleChange}
          className={`flex-1 text-sm font-medium text-gray-900 px-3 py-2 bg-gray-50 rounded-md border-none focus:ring-[1.5px] focus:ring-primary focus:bg-white transition-all duration-200 text-left ${titleError ? 'ring-2 ring-red-500 focus:ring-red-500' : ''}`}
          placeholder="What needs to be done?"
        />
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <select 
              value={projectId}
              onChange={handleProjectChange}
              className={`w-full text-sm font-medium text-gray-900 px-3 py-2 bg-gray-50 rounded-md border-none focus:ring-[1.5px] focus:ring-primary focus:bg-white transition-all duration-200 appearance-none pr-8 text-left ${projectError ? 'ring-2 ring-red-500 focus:ring-red-500' : ''}`}
            >
              <option value="" disabled>Select a project</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
              <div className="w-4 h-4 flex items-center justify-center text-gray-500">
                <i className="ri-arrow-down-s-line"></i>
              </div>
            </div>
          </div>
          <div className="flex items-center bg-gray-50 rounded-md px-3 py-2 whitespace-nowrap">
            <i className="ri-time-line text-gray-400 mr-2"></i>
            <input 
              type="number" 
              value={timeSpent}
              onChange={(e) => setTimeSpent(parseInt(e.target.value) || 0)}
              className="w-12 text-sm font-medium text-gray-600 bg-transparent border-none text-right focus:ring-[1.5px] focus:ring-primary" 
              placeholder="0" 
              min="0" 
            />
            <span className="text-sm font-medium text-gray-400 mx-1">/</span>
            <input 
              type="number" 
              value={timeEstimated}
              onChange={(e) => setTimeEstimated(parseInt(e.target.value) || 0)}
              className="w-12 text-sm font-medium text-gray-600 bg-transparent border-none text-right focus:ring-[1.5px] focus:ring-primary" 
              placeholder="0" 
              min="0" 
            />
            <span className="text-sm font-medium text-gray-500 ml-1">min</span>
          </div>
        </div>
      </div>
      
      <textarea 
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full text-sm text-gray-600 px-3 py-2 bg-gray-50 rounded-md border-none focus:ring-[1.5px] focus:ring-primary focus:bg-white transition-all duration-200 min-h-[3rem] mb-3 text-left" 
        rows={4} 
        placeholder="Add description (optional)" 
        style={{ resize: 'none', textAlign: 'left' }}
      />
      
      <div className="flex justify-end space-x-2">
        <button 
          onClick={handleSubmit}
          className="p-1.5 rounded-md bg-primary/10 hover:bg-primary/20 transition-colors duration-200 cursor-pointer"
        >
          <div className="w-5 h-5 flex items-center justify-center text-primary">
            <i className="ri-check-line"></i>
          </div>
        </button>
        <button 
          onClick={onCancel}
          className="p-1.5 rounded-md hover:bg-gray-100 transition-colors duration-200"
        >
          <div className="w-5 h-5 flex items-center justify-center text-gray-400">
            <i className="ri-close-line"></i>
          </div>
        </button>
      </div>
    </div>
  );
};

export default TaskForm; 