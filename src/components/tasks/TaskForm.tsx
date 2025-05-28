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
  
  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  
  // Focus on title input when form opens
  useEffect(() => {
    if (titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, []);
  
  // Adjust textarea heights
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const adjustTextareaHeight = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };
  
  useEffect(() => {
    if (titleInputRef.current) {
      adjustTextareaHeight(titleInputRef.current);
    }
  }, [title]);
  
  useEffect(() => {
    if (textareaRef.current) {
      adjustTextareaHeight(textareaRef.current);
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
  
  const inputClasses = "text-sm font-medium text-gray-900 px-3 py-2 bg-gray-50 rounded-md border-none outline-none focus:outline-none focus:ring-2 focus:ring-gray-500 focus:bg-white transition-all duration-200";
  const timeInputClasses = "w-14 text-sm font-medium text-gray-600 bg-transparent border-none text-right outline-none focus:outline-none focus:ring-2 focus:ring-gray-500 transition-all duration-200";
  const descriptionClasses = "text-sm text-gray-500 px-3 py-2 bg-gray-50 rounded-md border-none outline-none focus:outline-none focus:ring-2 focus:ring-gray-500 focus:bg-white transition-all duration-200";
  
  return (
    <div 
      ref={formRef}
      className="task-card p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 animate-fade-in"
    >
      <div className="flex-1 min-w-0">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <textarea
              autoFocus
              ref={titleInputRef}
              className={`${inputClasses} w-full resize-none overflow-hidden min-h-[2.5rem] ${titleError ? 'ring-2 ring-red-200' : ''}`}
              placeholder="What needs to be done?"
              value={title}
              rows={1}
              onChange={(e) => {
                setTitle(e.target.value);
                setTitleError(false);
                adjustTextareaHeight(e.target);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSave();
                }
              }}
            />
            
            <div className="flex gap-3 items-stretch">
              <div className="relative flex-[6] min-w-0">
                <select
                  className={`${inputClasses} w-full appearance-none pr-8 h-full ${projectError ? 'ring-2 ring-red-200' : ''}`}
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
              
              <div className="flex-[4] flex items-center bg-gray-50 rounded-md px-2 py-1.5">
                <div className="flex items-center gap-1">
                  <Icon name="time-line" className="text-gray-400 flex-shrink-0" />
                  {!task && (
                    <span className="text-sm font-medium text-gray-600">Est.</span>
                  )}
                </div>
                
                <div className="flex items-center ml-auto">
                  {task && (
                    <>
                      <input
                        type="number"
                        className={timeInputClasses}
                        placeholder="0"
                        min="0"
                        value={timeSpent}
                        onChange={(e) => setTimeSpent(e.target.value)}
                      />
                      <span className="text-sm font-medium text-gray-400 mx-1">/</span>
                    </>
                  )}
                  <input
                    type="number"
                    className={timeInputClasses}
                    placeholder="0"
                    min="0"
                    value={timeEstimated}
                    onChange={(e) => setTimeEstimated(e.target.value)}
                  />
                  <span className="text-sm font-medium text-gray-500 ml-1">m</span>
                </div>
              </div>
            </div>
          </div>
          
          <textarea
            ref={textareaRef}
            className={`${descriptionClasses} min-h-[3rem] mb-3 resize-none w-full`}
            rows={1}
            placeholder="Add description (optional)"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              adjustTextareaHeight(e.target);
            }}
          />
          
          <div className="flex justify-end space-x-2">
            <button
              className="p-1.5 rounded-md bg-green-500/10 hover:bg-green-500/20 transition-colors duration-200 cursor-pointer"
              onClick={handleSave}
            >
              <Icon name="check-line" className="w-5 h-5 text-green-500" />
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