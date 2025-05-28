import React, { useState, useEffect, useRef } from 'react';
import type { Task } from '../../types/models';
import { useTaskStore } from '../../store/taskStore';
import { Icon } from '../ui/Icon';

interface TaskFormProps {
  task?: Task;
  status?: Task['status'];
  onCancel: () => void;
}

const TaskForm: React.FC<TaskFormProps> = ({ task, status, onCancel }) => {
  const addTask = useTaskStore(state => state.addTask);
  const updateTask = useTaskStore(state => state.updateTask);
  const projects = useTaskStore(state => state.projects);
  
  const [title, setTitle] = useState(task?.title || '');
  const [projectId, setProjectId] = useState(task?.projectId || '');
  const [timeSpent, setTimeSpent] = useState(task?.timeSpent?.toString() || '0');
  const [timeEstimated, setTimeEstimated] = useState(task?.timeEstimated?.toString() || '0');
  const [description, setDescription] = useState(task?.description || '');
  const [titleError, setTitleError] = useState(false);
  const [projectError, setProjectError] = useState(false);
  
  const titleInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  
  // Focus on title input when form opens
  useEffect(() => {
    if (titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, []);
  
  // Adjust textarea height
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [description]);
  
  const handleSave = () => {
    // Reset errors
    setTitleError(false);
    setProjectError(false);
    
    // Validate required fields
    if (!title.trim()) {
      setTitleError(true);
      if (titleInputRef.current) {
        titleInputRef.current.focus();
      }
      return;
    }
    
    if (!projectId) {
      setProjectError(true);
      return;
    }
    
    const taskData = {
      title: title.trim(),
      description: description.trim(),
      projectId,
      completed: task?.completed || false,
      status: task?.status || status || 'todo',
      timeSpent: parseInt(timeSpent) || 0,
      timeEstimated: parseInt(timeEstimated) || 0
    };
    
    if (task) {
      // Update existing task
      updateTask(task.id, taskData);
    } else {
      // Add new task
      addTask(taskData);
    }
    
    onCancel();
  };
  
  const inputClasses = "w-full text-sm font-medium text-gray-900 px-3 py-2 bg-gray-50 rounded-md border-none outline-none focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all duration-200";
  const timeInputClasses = "w-10 text-sm font-medium text-gray-600 bg-transparent border-none text-right outline-none focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200";
  
  return (
    <div 
      ref={formRef}
      className="task-card p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 animate-fade-in"
    >
      <div className="flex-1 min-w-0">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <input
              autoFocus
              ref={titleInputRef}
              type="text"
              className={`${inputClasses} ${titleError ? 'ring-2 ring-primary' : ''}`}
              placeholder="What needs to be done?"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setTitleError(false);
              }}
            />
            
            <div className="flex gap-3 items-center">
              <div className="relative flex-1">
                <select
                  className={`${inputClasses} appearance-none pr-8 ${projectError ? 'ring-2 ring-primary' : ''}`}
                  value={projectId}
                  onChange={(e) => {
                    setProjectId(e.target.value);
                    setProjectError(false);
                  }}
                >
                  <option value="" disabled>Select a project</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                  <Icon name="arrow-down-s-line" className="w-4 h-4 text-gray-500" />
                </div>
              </div>
              
              <div className="flex items-center bg-gray-50 rounded-md px-2 py-1.5 whitespace-nowrap">
                <Icon name="time-line" className="text-gray-400 mr-1.5" />
                <input
                  type="number"
                  className={timeInputClasses}
                  placeholder="0"
                  min="0"
                  value={timeSpent}
                  onChange={(e) => setTimeSpent(e.target.value)}
                />
                <span className="text-sm font-medium text-gray-400">/</span>
                <input
                  type="number"
                  className={timeInputClasses}
                  placeholder="0"
                  min="0"
                  value={timeEstimated}
                  onChange={(e) => setTimeEstimated(e.target.value)}
                />
                <span className="text-sm font-medium text-gray-500 ml-0.5">m</span>
              </div>
            </div>
          </div>
          
          <textarea
            ref={textareaRef}
            className={`${inputClasses} min-h-[3rem] mb-3`}
            rows={1}
            placeholder="Add description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ height: 'auto', resize: 'none' }}
          />
          
          <div className="flex justify-end space-x-2">
            <button
              className="p-1.5 rounded-md bg-primary/10 hover:bg-primary/20 transition-colors duration-200 cursor-pointer"
              onClick={handleSave}
            >
              <Icon name="check-line" className="w-5 h-5 text-primary" />
            </button>
            <button
              className="p-1.5 rounded-md hover:bg-gray-100 transition-colors duration-200"
              onClick={onCancel}
            >
              <Icon name="close-line" className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskForm; 