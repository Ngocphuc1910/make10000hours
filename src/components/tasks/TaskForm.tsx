import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Task } from '../../types/models';
import { useTaskStore } from '../../store/taskStore';
import { Icon } from '../ui/Icon';
import { useUserStore } from '../../store/userStore';
import { useWorkSessionStore } from '../../store/useWorkSessionStore';
import { formatMinutesToHoursAndMinutes } from '../../utils/timeUtils';

interface TaskFormProps {
  task?: Task;
  status?: Task['status'];
  initialProjectId?: string;
  onCancel: () => void;
}

const TaskForm: React.FC<TaskFormProps> = ({ task, status, initialProjectId, onCancel }) => {
  const { tasks, addTask, updateTask, deleteTask, projects, addProject } = useTaskStore();
  const { user } = useUserStore();
  const { createWorkSession } = useWorkSessionStore();
  
  const [title, setTitle] = useState(task?.title || '');
  const [projectId, setProjectId] = useState(task?.projectId || '');
  const [timeSpent, setTimeSpent] = useState(task?.timeSpent?.toString() || '0');
  const [timeEstimated, setTimeEstimated] = useState(task?.timeEstimated?.toString() || '');
  const [description, setDescription] = useState(task?.description || '');
  const [titleError, setTitleError] = useState(false);
  const [projectError, setProjectError] = useState(false);
  const [isCreatingNewProject, setIsCreatingNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  
  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const projectSelectRef = useRef<HTMLSelectElement>(null);
  const newProjectInputRef = useRef<HTMLInputElement>(null);
  const timeEstimatedRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  
  // Check if "No Project" project exists
  const noProject = projects.find(p => p.id === 'no-project');

  // Get last used project from localStorage
  const getLastUsedProjectId = () => {
    if (task?.projectId) return task.projectId;
    if (initialProjectId) return initialProjectId;
    return localStorage.getItem('lastUsedProjectId') || 'no-project';
  };

  // Set initial project selection
  useEffect(() => {
    if (!task?.projectId) { // Only set if not editing existing task
      setProjectId(getLastUsedProjectId());
    }
  }, []); // Remove dependencies to prevent re-runs

  // Create "No Project" project if it doesn't exist - only run once
  useEffect(() => {
    if (!noProject && user && !task) { // Only for new tasks
      useTaskStore.getState().addProject({
        name: 'No Project',
        color: '#6B7280' // gray-500
      });
    }
  }, []); // Remove dependencies to prevent re-runs
  
  // Focus on title input when form opens - only run once
  useEffect(() => {
    if (titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, []);

  // Focus on new project input when creating new project
  useEffect(() => {
    if (isCreatingNewProject && newProjectInputRef.current) {
      newProjectInputRef.current.focus();
    }
  }, [isCreatingNewProject]);
  
  // Auto-open project dropdown when focused via keyboard
  const handleProjectFocus = () => {
    if (projectSelectRef.current) {
      // Use showPicker if available (modern browsers)
      if ('showPicker' in projectSelectRef.current && typeof (projectSelectRef.current as any).showPicker === 'function') {
        try {
          (projectSelectRef.current as any).showPicker();
        } catch (e) {
          console.log('showPicker not supported or failed');
        }
      }
    }
  };

  const handleProjectChange = (value: string) => {
    if (value === 'create-new') {
      setIsCreatingNewProject(true);
      setProjectId('');
      setNewProjectName('');
    } else {
      setIsCreatingNewProject(false);
      setProjectId(value);
      setNewProjectName('');
      setProjectError(false);
    }
  };

  const handleCancelNewProject = () => {
    setIsCreatingNewProject(false);
    setNewProjectName('');
    setProjectId(getLastUsedProjectId());
  };
  
  // Optimize textarea height adjustment with useCallback
  const adjustTextareaHeight = useCallback((textarea: HTMLTextAreaElement) => {
    requestAnimationFrame(() => {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    });
  }, []);
  
  // Debounced height adjustment for better performance during fast typing
  useEffect(() => {
    if (titleInputRef.current) {
      adjustTextareaHeight(titleInputRef.current);
    }
  }, [title, adjustTextareaHeight]);
  
  useEffect(() => {
    if (descriptionRef.current) {
      adjustTextareaHeight(descriptionRef.current);
    }
  }, [description, adjustTextareaHeight]);
  
  const handleSave = async () => {
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

    // Validate new project name if creating new project
    if (isCreatingNewProject && !newProjectName.trim()) {
      setProjectError(true);
      if (newProjectInputRef.current) {
        newProjectInputRef.current.focus();
      }
      return;
    }
    
    if (!user) {
      console.error('No user found');
      return;
    }

    let finalProjectId = projectId;

    // Create new project if needed
    if (isCreatingNewProject && newProjectName.trim()) {
      try {
        const newProjectId = await addProject({
          name: newProjectName.trim(),
          color: '#BB5F5A' // Use primary color from design system
        });
        finalProjectId = newProjectId;
        
        // Save as last used project
        localStorage.setItem('lastUsedProjectId', newProjectId);
      } catch (error) {
        console.error('Error creating project:', error);
        return;
      }
    } else if (finalProjectId && finalProjectId !== 'no-project') {
      // Save the selected project as last used
      localStorage.setItem('lastUsedProjectId', finalProjectId);
    }
    
    const taskData = {
      title: title.trim(),
      description: description.trim(),
      projectId: finalProjectId || 'no-project',
      userId: user.uid,
      completed: task?.completed || false,
      status: task?.status || status || 'pomodoro',
      timeSpent: parseInt(timeSpent) || 0,
      timeEstimated: parseInt(timeEstimated) || 0
    };
    
    // Check if timeSpent was manually changed (only for existing tasks)
    const originalTimeSpent = task?.timeSpent || 0;
    const newTimeSpent = parseInt(timeSpent) || 0;
    const timeSpentChanged = task && newTimeSpent !== originalTimeSpent;
    const timeDifference = newTimeSpent - originalTimeSpent;
    
    if (task) {
      // Update existing task
      updateTask(task.id, taskData);
      
      // Create WorkSession record for manual time changes (both additions and reductions)
      if (timeSpentChanged && timeDifference !== 0) {
        const now = new Date();
        try {
          await createWorkSession({
            userId: user.uid,
            taskId: task.id,
            projectId: finalProjectId || 'no-project',
            startTime: now,
            endTime: now,
            duration: timeDifference, // Can be positive (addition) or negative (reduction)
            sessionType: 'manual',
            notes: timeDifference > 0 
              ? `Manual time added: +${timeDifference}m`
              : `Manual time reduced: ${timeDifference}m`
          });
        } catch (error) {
          console.error('Failed to create work session for manual edit:', error);
        }
      }
    } else {
      // Add new task
      addTask(taskData);
    }
    
    onCancel();
  };

  const handleDelete = () => {
    if (task && window.confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      deleteTask(task.id);
      onCancel();
    }
  };

  const handleWorkLater = () => {
    if (task) {
      updateTask(task.id, {
        ...task,
        status: 'todo',
        completed: false
      });
      onCancel();
    }
  };
  
  const inputClasses = "text-sm font-medium text-gray-900 px-3 py-2 bg-gray-50 rounded-md border-none outline-none focus:outline-none focus:ring-2 focus:ring-gray-500 focus:bg-white transition-all duration-200";
  const timeInputClasses = "w-16 text-sm font-medium text-gray-600 bg-transparent border-none text-right outline-none focus:outline-none transition-all duration-200";
  const descriptionClasses = "text-sm text-gray-500 px-3 py-2 bg-gray-50 rounded-md border-none outline-none focus:outline-none focus:ring-2 focus:ring-gray-500 focus:bg-white transition-all duration-200";
  
  type InputElement = HTMLTextAreaElement | HTMLSelectElement | HTMLInputElement | null;
  
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement | HTMLSelectElement | HTMLInputElement>,
    nextRef: React.RefObject<InputElement>
  ) => {
    // Use only Enter/Return key (not Shift+Enter for new lines in textareas)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (nextRef.current) {
        nextRef.current.focus();
        // If moving focus to project field, trigger dropdown
        if (nextRef === projectSelectRef) {
          setTimeout(() => handleProjectFocus(), 0);
        }
      }
    }
  };

  const handleDescriptionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Use only Enter/Return key (not Shift+Enter for new lines)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };
  
  return (
    <div 
      key={task?.id || 'new-task'}
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
              onKeyDown={(e) => handleKeyDown(e, projectSelectRef)}
            />
            
            <div className="flex gap-3 items-stretch">
              <div className="relative flex-[6] min-w-0">
                {isCreatingNewProject ? (
                  <div className="flex items-center gap-2">
                    <input
                      ref={newProjectInputRef}
                      type="text"
                      className={`${inputClasses} flex-1 ${projectError ? 'ring-2 ring-red-200' : ''}`}
                      placeholder="Enter project name"
                      value={newProjectName}
                      onChange={(e) => {
                        setNewProjectName(e.target.value);
                        setProjectError(false);
                      }}
                      onKeyDown={(e) => handleKeyDown(e, timeEstimatedRef)}
                    />
                    <button
                      className="p-1.5 rounded-md hover:bg-gray-100 transition-colors duration-200"
                      onClick={handleCancelNewProject}
                      type="button"
                    >
                      <Icon name="close-line" className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                ) : (
                  <select
                    ref={projectSelectRef}
                    className={`${inputClasses} w-full appearance-none pr-8 h-full ${projectError ? 'ring-2 ring-red-200' : ''}`}
                    value={projectId}
                    onChange={(e) => handleProjectChange(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, timeEstimatedRef)}
                  >
                    <option value="no-project">No Project</option>
                    <option value="create-new">Create new project</option>
                    {projects
                      .filter(p => p.id !== 'no-project')
                      .map(project => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                  </select>
                )}
                
                {!isCreatingNewProject && (
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                    <Icon name="arrow-down-s-line" className="w-4 h-4 text-gray-500" />
                  </div>
                )}
              </div>
              
              <div className="flex-[5] flex items-center bg-gray-50 rounded-md px-3 py-2 focus-within:ring-2 focus-within:ring-gray-500 focus-within:bg-white transition-all duration-200">
                <div className="flex items-center gap-2">
                  <Icon name="time-line" className="text-gray-400 flex-shrink-0" />
                  {!task && (
                    <span className="text-sm font-medium text-gray-600">Est.</span>
                  )}
                </div>
                
                <div className="flex items-center ml-auto gap-1">
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
                    ref={timeEstimatedRef}
                    type="number"
                    className={timeInputClasses}
                    placeholder="0"
                    min="0"
                    value={timeEstimated}
                    onChange={(e) => setTimeEstimated(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, descriptionRef)}
                  />
                  <span className="text-sm font-medium text-gray-500 ml-1">m</span>
                </div>
              </div>
            </div>
          </div>
          
          <textarea
            ref={descriptionRef}
            className={`${descriptionClasses} min-h-[3rem] mb-3 resize-none w-full`}
            rows={1}
            placeholder="Add description (optional)"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              adjustTextareaHeight(e.target);
            }}
            onKeyDown={handleDescriptionKeyDown}
          />
          
          <div className="flex justify-between items-center">
            <div className="flex-1 flex gap-4">
              {task && (
                <>
                  <button
                    className="text-sm font-medium text-red-500 hover:text-red-600 transition-colors duration-200"
                    onClick={handleDelete}
                  >
                    Delete
                  </button>
                  <button
                    className="text-sm font-medium text-blue-500 hover:text-blue-600 transition-colors duration-200"
                    onClick={handleWorkLater}
                  >
                    Work later
                  </button>
                </>
              )}
            </div>
            
            <div className="flex space-x-2">
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
    </div>
  );
};

export default TaskForm;