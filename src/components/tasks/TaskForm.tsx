import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Task } from '../../types/models';
import { useTaskStore } from '../../store/taskStore';
import { Icon } from '../ui/Icon';
import { useUserStore } from '../../store/userStore';
import { workSessionService } from '../../api/workSessionService';
import { formatMinutesToHoursAndMinutes } from '../../utils/timeUtils';
import { getDateISOString } from '../../utils/timeUtils';

interface TaskFormProps {
  task?: Task;
  status?: Task['status'];
  initialProjectId?: string;
  onCancel: () => void;
}

const TaskForm: React.FC<TaskFormProps> = ({ task, status, initialProjectId, onCancel }) => {
  const { tasks, addTask, updateTask, deleteTask, projects, addProject } = useTaskStore();
  const { user } = useUserStore();
  
  const [title, setTitle] = useState(task?.title || '');
  const [projectId, setProjectId] = useState(task?.projectId || '');
  const [timeSpent, setTimeSpent] = useState(task?.timeSpent?.toString() || '0');
  const [timeEstimated, setTimeEstimated] = useState(task?.timeEstimated?.toString() || '');
  const [description, setDescription] = useState(task?.description || '');
  const [titleError, setTitleError] = useState(false);
  const [projectError, setProjectError] = useState(false);
  const [isCreatingNewProject, setIsCreatingNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [calendarDate, setCalendarDate] = useState(() => {
    // For existing tasks, use their scheduled date
    if (task?.scheduledDate) {
      return task.scheduledDate;
    }
    // For new tasks, default to today
    if (!task) {
      const today = new Date();
      return today.toISOString().split('T')[0]; // YYYY-MM-DD format
    }
    return '';
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [includeTime, setIncludeTime] = useState(task?.includeTime || false);
  const [startTime, setStartTime] = useState(task?.scheduledStartTime || '09:00');
  const [endTime, setEndTime] = useState(task?.scheduledEndTime || '10:00');
  
  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const projectSelectRef = useRef<HTMLSelectElement>(null);
  const newProjectInputRef = useRef<HTMLInputElement>(null);
  const timeEstimatedRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const calendarInputRef = useRef<HTMLInputElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  
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

  // Don't auto-set calendar date - let it be truly optional

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

  // Close date picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false);
      }
    };

    if (showDatePicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDatePicker]);
  
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
    
    const taskData: any = {
      title: title.trim(),
      description: description.trim(),
      projectId: finalProjectId || 'no-project',
      userId: user.uid,
      completed: task?.completed || false,
      status: task?.status || status || 'pomodoro',
      timeSpent: parseInt(timeSpent) || 0,
      timeEstimated: parseInt(timeEstimated) || 0
    };

    // Only add calendar fields if they have values (avoid undefined in Firestore)
    if (calendarDate && calendarDate.trim()) {
      taskData.scheduledDate = calendarDate.trim();
      taskData.includeTime = includeTime;
      
      if (includeTime && startTime && endTime) {
        taskData.scheduledStartTime = startTime;
        taskData.scheduledEndTime = endTime;
      }
    }
    
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
        try {
          await workSessionService.upsertWorkSession({
            userId: user.uid,
            taskId: task.id,
            projectId: finalProjectId || 'no-project',
            date: getDateISOString(), // Use today's date in YYYY-MM-DD format
          }, timeDifference, 'manual'); // Specify this is a manual session
        } catch (error) {
          console.error('Failed to create work session for manual edit:', error);
        }
      }
    } else {
      // Add new task
      console.log('Creating new task with data:', taskData);
      try {
        await addTask(taskData);
        console.log('Task created successfully');
      } catch (error) {
        console.error('Error creating task:', error);
        return;
      }
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

  const handleCalendarClick = () => {
    // Set default date to today when opening date picker (if no date selected yet)
    if (!showDatePicker && !calendarDate) {
      const today = new Date();
      const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD format
      setCalendarDate(todayString);
    }
    setShowDatePicker(!showDatePicker);
  };

  const getCalendarButtonText = () => {
    if (!calendarDate) return 'Add to calendar';
    
    const date = new Date(calendarDate);
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    const dateStr = date.toLocaleDateString('en-US', options); // "May 28, 2025" format
    
    if (!includeTime) {
      return dateStr;
    }
    
    return `${dateStr} ${startTime} - ${endTime}`;
  };

  const handleDateSelect = (date: string) => {
    setCalendarDate(date);
  };

  const handleTimeToggle = (enabled: boolean) => {
    setIncludeTime(enabled);
  };

  const handleProjectButtonClick = () => {
    if (projectSelectRef.current) {
      // Trigger focus and attempt to open dropdown
      projectSelectRef.current.focus();
      // Use showPicker if available (modern browsers)
      if ('showPicker' in projectSelectRef.current && typeof (projectSelectRef.current as any).showPicker === 'function') {
        try {
          (projectSelectRef.current as any).showPicker();
        } catch (e) {
          console.log('showPicker not supported or failed');
        }
      }
      // For browsers that don't support showPicker, simulate click
      projectSelectRef.current.click();
    }
  };

  const getSelectedProjectName = () => {
    if (isCreatingNewProject) return 'New Project';
    const selectedProject = projects.find(p => p.id === projectId);
    return selectedProject?.name || 'Project';
  };
  
  type InputElement = HTMLTextAreaElement | HTMLSelectElement | HTMLInputElement | null;
  
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement | HTMLSelectElement | HTMLInputElement>,
    nextRef: React.RefObject<InputElement>
  ) => {
    // Use only Enter/Return key (not Shift+Enter for new lines in textareas)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      console.log('handleKeyDown called, nextRef:', nextRef === descriptionRef ? 'descriptionRef' : nextRef === projectSelectRef ? 'projectSelectRef' : 'other');
      if (nextRef.current) {
        // Use setTimeout to ensure proper focus in next tick
        setTimeout(() => {
          if (nextRef.current) {
            nextRef.current.focus();
            console.log('Focused on:', nextRef.current.tagName);
            // If moving focus to project field, trigger dropdown
            if (nextRef === projectSelectRef) {
              setTimeout(() => handleProjectFocus(), 50);
            }
          }
        }, 0);
      }
    }
  };

  const handleDescriptionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Use only Enter/Return key (not Shift+Enter for new lines)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Move to project selection and open dropdown
      if (projectSelectRef.current) {
        projectSelectRef.current.focus();
        setTimeout(() => handleProjectFocus(), 50);
      }
    }
  };

  const handleTimeEstimatedKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Since date is auto-selected by default, directly create the task
      handleSave();
    }
  };

  const handleCalendarKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Create the task
      handleSave();
    }
  };

  const handleProjectKeyDown = (e: React.KeyboardEvent<HTMLSelectElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Move to time estimation
      if (timeEstimatedRef.current) {
        timeEstimatedRef.current.focus();
      }
    }
  };
  
  return (
    <div 
      key={task?.id || 'new-task'}
      ref={formRef}
      className="task-card p-6 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 animate-fade-in"
    >
      <div className="flex-1 min-w-0">
        <textarea
          autoFocus
          ref={titleInputRef}
          className={`w-full text-lg font-medium text-gray-900 px-0 py-1 bg-transparent focus:outline-none border-none resize-none overflow-hidden ${titleError ? 'ring-2 ring-red-200' : ''}`}
          placeholder="Task name"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setTitleError(false);
            // Auto-adjust height
            const target = e.target as HTMLTextAreaElement;
            adjustTextareaHeight(target);
          }}
          onKeyDown={(e) => handleKeyDown(e, descriptionRef)}
          rows={1}
          style={{ minHeight: '1.75rem' }}
        />
        
        <textarea
          ref={descriptionRef}
          className="w-full text-sm text-gray-500 px-0 py-2 bg-transparent border-none focus:outline-none resize-none"
          placeholder="Description"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            adjustTextareaHeight(e.target);
          }}
          onKeyDown={handleDescriptionKeyDown}
          style={{ height: 'auto', minHeight: '1.5rem', marginBottom: '0.5rem' }}
          rows={1}
        />
        
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="flex flex-wrap gap-2 min-w-0">
            {/* Project Selection */}
            <div className="relative">
              {isCreatingNewProject ? (
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 hover:border-gray-300 rounded text-xs text-gray-600">
                    <div className="w-3.5 h-3.5 flex items-center justify-center">
                      <Icon name="folder-line" className="w-3.5 h-3.5" />
                    </div>
                    <input
                      ref={newProjectInputRef}
                      type="text"
                      className={`bg-transparent border-none focus:outline-none p-0 text-xs ${projectError ? 'ring-2 ring-red-200' : ''}`}
                      placeholder="Enter project name"
                      value={newProjectName}
                      onChange={(e) => {
                        setNewProjectName(e.target.value);
                        setProjectError(false);
                      }}
                      onKeyDown={(e) => handleKeyDown(e, timeEstimatedRef)}
                    />
                  </div>
                  <button
                    className="p-1 rounded hover:bg-gray-100 transition-colors duration-200"
                    onClick={handleCancelNewProject}
                    type="button"
                  >
                    <Icon name="close-line" className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                </div>
              ) : (
                <>
                  <select
                    ref={projectSelectRef}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    value={projectId}
                    onChange={(e) => handleProjectChange(e.target.value)}
                    onKeyDown={handleProjectKeyDown}
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
                  <button
                    type="button"
                    className={`flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 hover:border-gray-300 rounded text-xs text-gray-600 hover:bg-gray-50 min-w-0 ${projectError ? 'ring-2 ring-red-200' : ''}`}
                    onClick={handleProjectButtonClick}
                  >
                    <div className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0">
                      <Icon name="folder-line" className="w-3.5 h-3.5" />
                    </div>
                    <span className="truncate max-w-[8rem]">{getSelectedProjectName()}</span>
                    <div className="w-3.5 h-3.5 flex items-center justify-center text-gray-400 flex-shrink-0">
                      <Icon name="arrow-down-s-line" className="w-3.5 h-3.5" />
                    </div>
                  </button>
                </>
              )}
            </div>

            {/* Time Estimation */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 hover:border-gray-300 rounded text-xs text-gray-600 flex-shrink-0">
              <div className="w-3.5 h-3.5 flex items-center justify-center">
                <Icon name="time-line" className="w-3.5 h-3.5" />
              </div>
              {task && (
                <>
                  <input
                    type="number"
                    className="w-7 text-center bg-transparent border-none focus:outline-none p-0 text-xs"
                    placeholder="0"
                    min="0"
                    value={timeSpent}
                    onChange={(e) => setTimeSpent(e.target.value)}
                  />
                  <span className="text-gray-400">/</span>
                </>
              )}
              {!task && <span className="whitespace-nowrap">Est.</span>}
                              <input
                ref={timeEstimatedRef}
                type="number"
                className="w-7 text-center bg-transparent border-none focus:outline-none p-0 text-xs"
                placeholder="0"
                min="0"
                value={timeEstimated}
                onChange={(e) => setTimeEstimated(e.target.value)}
                onKeyDown={handleTimeEstimatedKeyDown}
              />
              <span className="text-gray-500 whitespace-nowrap">m</span>
            </div>

            {/* Calendar */}
            <div className="relative">
              <button
                type="button"
                onClick={handleCalendarClick}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 hover:border-gray-300 rounded text-xs text-gray-600 hover:bg-gray-50 flex-shrink-0"
              >
                <div className="w-3.5 h-3.5 flex items-center justify-center">
                  <Icon name="calendar-line" className="w-3.5 h-3.5" />
                </div>
                <span className="whitespace-nowrap">{getCalendarButtonText()}</span>
              </button>

              {/* Custom Date Picker */}
              {showDatePicker && (
                <div ref={datePickerRef} className="absolute top-full left-0 mt-2 p-4 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-80">
                  {/* Date Input */}
                  <div className="mb-4">
                    <input
                      ref={calendarInputRef}
                      type="date"
                      className="w-full px-3 py-2 border border-gray-200 rounded text-sm"
                      value={calendarDate}
                      onChange={(e) => handleDateSelect(e.target.value)}
                      onKeyDown={handleCalendarKeyDown}
                    />
                  </div>

                  {/* Calendar Grid */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">
                        {calendarDate ? new Date(calendarDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </span>
                      <div className="flex gap-1">
                        <button type="button" className="p-1 hover:bg-gray-100 rounded">
                          <Icon name="arrow-left-s-line" className="w-4 h-4" />
                        </button>
                        <button type="button" className="p-1 hover:bg-gray-100 rounded">
                          <Icon name="arrow-right-s-line" className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Calendar Days */}
                    <div className="grid grid-cols-7 gap-1 text-xs">
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                        <div key={day} className="text-center text-gray-500 py-2">{day}</div>
                      ))}
                      {/* Generate calendar days - simplified for now */}
                      {Array.from({ length: 35 }, (_, i) => {
                        const dayNum = i - 6; // Offset for month start
                        const isToday = dayNum === new Date().getDate();
                        const isSelected = calendarDate && dayNum === new Date(calendarDate).getDate();
                        
                        if (dayNum <= 0 || dayNum > 31) {
                          return <div key={i} className="p-2"></div>;
                        }
                        
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              const today = new Date();
                              const selectedDate = new Date(today.getFullYear(), today.getMonth(), dayNum);
                              handleDateSelect(selectedDate.toISOString().split('T')[0]);
                            }}
                            className={`p-2 text-center hover:bg-gray-100 rounded ${
                              isSelected ? 'bg-blue-500 text-white' : isToday ? 'bg-gray-200' : ''
                            }`}
                          >
                            {dayNum}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Include Time Toggle */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Include time</span>
                      <button
                        type="button"
                        onClick={() => handleTimeToggle(!includeTime)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          includeTime ? 'bg-blue-500' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            includeTime ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Time Selection */}
                  {includeTime && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="px-3 py-2 border border-gray-200 rounded text-sm"
                        />
                        <span className="text-sm text-gray-500">-</span>
                        <input
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="px-3 py-2 border border-gray-200 rounded text-sm"
                        />
                      </div>
                      
                      <div className="text-xs text-gray-500 space-y-1">
                        <div className="flex justify-between">
                          <span>Time format</span>
                          <span>24 hour</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Timezone</span>
                          <span>GMT+7</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Close button */}
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => setShowDatePicker(false)}
                      className="w-full py-2 text-sm text-blue-600 hover:text-blue-700"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            {task && (
              <>
                <button
                  className="text-[#FF4D4F] hover:text-red-600 text-sm font-medium"
                  onClick={handleDelete}
                >
                  Delete
                </button>
                <button
                  className="text-[#4096FF] hover:text-blue-600 text-sm font-medium"
                  onClick={handleWorkLater}
                >
                  Work later
                </button>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <button
              className="w-10 h-10 rounded-full bg-[#F6FFED] hover:bg-[#E6FFD4] flex items-center justify-center transition-colors duration-200"
              onClick={handleSave}
            >
              <div className="w-5 h-5 flex items-center justify-center text-[#52C41A]">
                <Icon name="check-line" className="w-5 h-5" />
              </div>
            </button>
            <button
              className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors duration-200"
              onClick={onCancel}
            >
              <div className="w-5 h-5 flex items-center justify-center text-[#909399]">
                <Icon name="close-line" className="w-5 h-5" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskForm;