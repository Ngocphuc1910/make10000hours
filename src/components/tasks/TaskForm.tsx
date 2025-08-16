import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Task } from '../../types/models';
import { useTaskStore } from '../../store/taskStore';
import { useTaskStoreWithSync } from '../../store/syncStore';
import { useFormEditStore } from '../../store/formEditStore';
import { Icon } from '../ui/Icon';
import { useUserStore } from '../../store/userStore';
import { workSessionService } from '../../api/workSessionService';
import { formatMinutesToHoursAndMinutes, calculateDurationInMinutes } from '../../utils/timeUtils';
import { getDateISOString } from '../../utils/timeUtils';
import { timezoneUtils } from '../../utils/timezoneUtils';
import { DatePicker, DateTimeProvider, useDateTimeContext } from '../common/DatePicker';
import { format, isSameDay } from 'date-fns';
import { getRandomPresetColor } from '../../utils/colorUtils';
import { isMultiDayEnabled } from '../../utils/featureFlags';

interface TaskFormProps {
  task?: Task;
  status?: Task['status'];
  initialProjectId?: string;
  initialStartTime?: Date;
  initialEndTime?: Date;
  isAllDay?: boolean;
  onCancel: () => void;
  onSave?: () => void;
  isCalendarContext?: boolean;
  creationContext?: 'task-management' | 'pomodoro' | 'drag-create';
}

const TaskForm: React.FC<TaskFormProps> = ({ task, status, initialProjectId, initialStartTime, initialEndTime, isAllDay, onCancel, onSave, isCalendarContext = false, creationContext }) => {
  const taskStoreWithSync = useTaskStoreWithSync();
  const { addTask, updateTask, deleteTask } = taskStoreWithSync;
  
  // Get projects directly without problematic subscription
  const projects = useTaskStore(state => state.projects);
  const addProject = useTaskStore(state => state.addProject);
  const { user } = useUserStore();
  
  // Form protection - register this form as active
  const { setFormActive, setFormInactive } = useFormEditStore();
  const formId = task?.id || 'new-task';
  
  const [title, setTitle] = useState(task?.title || '');
  const [projectId, setProjectId] = useState(() => {
    if (task?.projectId) return task.projectId;
    if (initialProjectId) return initialProjectId;
    return localStorage.getItem('lastUsedProjectId') || 'no-project';
  });
  const [timeSpent, setTimeSpent] = useState(task?.timeSpent?.toString() || '0');
  const [timeEstimated, setTimeEstimated] = useState(() => {
    if (task?.timeEstimated) return task.timeEstimated.toString();
    if (initialStartTime && initialEndTime) {
      return calculateDurationInMinutes(initialStartTime, initialEndTime).toString();
    }
    return '';
  });
  const [description, setDescription] = useState(task?.description || '');
  const [titleError, setTitleError] = useState(false);
  const [projectError, setProjectError] = useState(false);
  const [timeSpentError, setTimeSpentError] = useState(false);
  const [timeEstimatedError, setTimeEstimatedError] = useState(false);
  const [isCreatingNewProject, setIsCreatingNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [calendarDate, setCalendarDate] = useState(() => {
    // For existing tasks, use their scheduled date
    if (task?.scheduledDate) {
      return task.scheduledDate;
    }
    // For drag-create, use the initial start time date (preserve existing logic)
    if (initialStartTime) {
      const year = initialStartTime.getFullYear();
      const month = String(initialStartTime.getMonth() + 1).padStart(2, '0');
      const day = String(initialStartTime.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    // For new tasks - check context and user setting (TIMEZONE-AWARE VERSION)
    if (!task) {
      const userTimezone = useUserStore.getState().getTimezone();
      
      // Pomodoro context always uses today (per requirement)
      if (creationContext === 'pomodoro') {
        return timezoneUtils.getTodayInUserTimezone(userTimezone);
      }
      
      // Task management context respects user setting
      if (creationContext === 'task-management') {
        const useDefaultDate = user?.settings?.defaultTaskDate !== false;
        if (useDefaultDate) {
          return timezoneUtils.getTodayInUserTimezone(userTimezone);
        }
        return ''; // Empty when setting is disabled
      }
      
      // Default behavior for undefined context (backward compatibility)
      return timezoneUtils.getTodayInUserTimezone(userTimezone);
    }
    return '';
  });
  const [calendarEndDate, setCalendarEndDate] = useState(() => {
    // For existing tasks with multi-day support, use their scheduled end date
    if (task?.scheduledEndDate) {
      return task.scheduledEndDate;
    }
    // For new multi-day tasks, default to empty (will be single day)
    return '';
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isHoveringDate, setIsHoveringDate] = useState(false);
  const [isHoveringProject, setIsHoveringProject] = useState(false);
  const [isHoveringTime, setIsHoveringTime] = useState(false);
  const [preventDropdown, setPreventDropdown] = useState(false);
  const [includeTime, setIncludeTime] = useState(() => {
    // DEBUG: Log TaskForm initialization
    console.log('🔧 TaskForm includeTime initialization:', {
      isAllDay,
      taskIncludeTime: task?.includeTime,
      hasInitialStartTime: !!initialStartTime,
      hasInitialEndTime: !!initialEndTime,
      initialStartTime,
      initialEndTime
    });
    
    // Always force false for all-day events, regardless of existing task data
    if (isAllDay === true) {
      console.log('💡 Setting includeTime = false (all-day event)');
      return false;
    }
    if (task?.includeTime !== undefined) {
      console.log('💡 Setting includeTime =', task.includeTime, '(existing task)');
      return task.includeTime;
    }
    if (initialStartTime && initialEndTime) {
      console.log('💡 Setting includeTime = true (has initial times)');
      return true;
    }
    console.log('💡 Setting includeTime = false (default)');
    return false;
  });
  const [startTime, setStartTime] = useState(() => {
    if (task?.scheduledStartTime) return task.scheduledStartTime;
    if (initialStartTime) {
      const hours = String(initialStartTime.getHours()).padStart(2, '0');
      const minutes = String(initialStartTime.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    }
    return '09:00';
  });
  const [endTime, setEndTime] = useState(() => {
    if (task?.scheduledEndTime) return task.scheduledEndTime;
    if (initialEndTime) {
      const hours = String(initialEndTime.getHours()).padStart(2, '0');
      const minutes = String(initialEndTime.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    }
    return '10:00';
  });
  
  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const projectSelectRef = useRef<HTMLSelectElement>(null);
  const newProjectInputRef = useRef<HTMLInputElement>(null);
  const timeEstimatedRef = useRef<HTMLInputElement>(null);
  const timeSpentRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const calendarInputRef = useRef<HTMLButtonElement>(null);

  
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
    if (!noProject && user && !task) { // Only for new tasks
      useTaskStore.getState().addProject({
        name: 'No Project',
        color: '#6B7280' // gray-500
      });
    }

    if (titleInputRef.current) {
      titleInputRef.current.focus();
      // Position cursor at the end of the text
      const textLength = titleInputRef.current.value.length;
      titleInputRef.current.setSelectionRange(textLength, textLength);
    }
  }, []); // Remove dependencies to prevent re-runs

  // Don't auto-set calendar date - let it be truly optional

  // Focus on new project input when creating new project
  useEffect(() => {
    if (isCreatingNewProject && newProjectInputRef.current) {
      newProjectInputRef.current.focus();
    }
  }, [isCreatingNewProject]);

  // ESC key handler to cancel editing
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [onCancel]);
  
  // Register form as active on mount, unregister on unmount
  useEffect(() => {
    setFormActive(formId);
    return () => {
      setFormInactive(formId);
    };
  }, []); // No dependencies to prevent rerun loops

  // Close date picker when clicking outside - handled by DatePicker component itself

  // DatePicker handles its own positioning with useSmartPosition hook
  
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

  const handleProjectChange = async (value: string) => {
    if (value === 'create-new') {
      // Check authentication before allowing project creation
      const { checkAuthenticationStatus, triggerAuthenticationFlow } = await import('../../utils/authGuard');
      const authStatus = checkAuthenticationStatus();
      
      if (!authStatus.isAuthenticated && authStatus.shouldShowAuth) {
        triggerAuthenticationFlow();
        // Reset the select back to the previous value
        setProjectId(getLastUsedProjectId());
        return;
      }
      
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

  // Auto-adjust title textarea height on mount and when title changes
  useEffect(() => {
    if (titleInputRef.current) {
      adjustTextareaHeight(titleInputRef.current);
    }
  }, [title, adjustTextareaHeight]);
  
  // Debounced height adjustment for better performance during fast typing
  useEffect(() => {
    if (descriptionRef.current) {
      adjustTextareaHeight(descriptionRef.current);
    }
  }, [description, adjustTextareaHeight]);
  
  const handleSave = async () => {
    // Check authentication status before proceeding
    const { checkAuthenticationStatus, triggerAuthenticationFlow } = await import('../../utils/authGuard');
    const authStatus = checkAuthenticationStatus();
    
    if (!authStatus.isAuthenticated && authStatus.shouldShowAuth) {
      triggerAuthenticationFlow();
      return;
    }
    
    // Reset errors
    setTitleError(false);
    setProjectError(false);
    setTimeSpentError(false);
    setTimeEstimatedError(false);
    
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

    // Validate time values are not negative
    const timeSpentValue = parseInt(timeSpent) || 0;
    const timeEstimatedValue = parseInt(timeEstimated) || 0;
    
    if (timeSpentValue < 0) {
      setTimeSpentError(true);
      if (timeSpentRef.current) {
        timeSpentRef.current.focus();
      }
      return;
    }

    if (timeEstimatedValue < 0) {
      setTimeEstimatedError(true);
      if (timeEstimatedRef.current) {
        timeEstimatedRef.current.focus();
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
          color: getRandomPresetColor()
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

    // Handle calendar fields - add them if they have values, or explicitly clear them if empty
    if (calendarDate && calendarDate.trim()) {
      taskData.scheduledDate = calendarDate.trim();
      
      // Handle multi-day end date if feature is enabled
      if (isMultiDayEnabled() && calendarEndDate && calendarEndDate.trim()) {
        taskData.scheduledEndDate = calendarEndDate.trim();
      } else {
        taskData.scheduledEndDate = null;
      }
      
      taskData.includeTime = includeTime;
      
      if (includeTime && startTime && endTime) {
        taskData.scheduledStartTime = startTime;
        taskData.scheduledEndTime = endTime;
      } else {
        // Clear time fields if includeTime is false
        taskData.scheduledStartTime = null;
        taskData.scheduledEndTime = null;
      }

      // Auto-change status: "To do list" → "In Pomodoro" when scheduled for today
      const userTimezone = useUserStore.getState().getTimezone();
      const today = timezoneUtils.getTodayInUserTimezone(userTimezone);
      const isScheduledForToday = calendarDate.trim() === today;
      if (isScheduledForToday && task?.status === 'todo') {
        taskData.status = 'pomodoro';
      }
    } else {
      // Explicitly clear all calendar fields when date is cleared
      taskData.scheduledDate = null;
      taskData.scheduledEndDate = null;
      taskData.includeTime = false;
      taskData.scheduledStartTime = null;
      taskData.scheduledEndTime = null;
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
          const userTimezone = useUserStore.getState().getTimezone();
          
          // Calculate date in user's timezone, not browser timezone
          const now = new Date();
          const userTime = userTimezone 
            ? (await import('../../utils/timezoneUtils')).timezoneUtils.utcToUserTime(now.toISOString(), userTimezone)
            : now;
          const userDate = (await import('date-fns')).format(userTime, 'yyyy-MM-dd');
          
          await workSessionService.upsertWorkSession({
            userId: user.uid,
            taskId: task.id,
            projectId: finalProjectId || 'no-project',
            date: userDate, // Use user's timezone date
          }, timeDifference, 'manual', userTimezone); // Pass user's selected timezone
        } catch (error) {
          console.error('Failed to create work session for manual edit:', error);
        }
      }
    } else {
      // Add new task
      console.log('🚀 Creating new task with data:', taskData);
      console.log('🔍 Key fields check:', {
        includeTime: taskData.includeTime,
        scheduledStartTime: taskData.scheduledStartTime,
        scheduledEndTime: taskData.scheduledEndTime,
        scheduledDate: taskData.scheduledDate
      });
      try {
        console.log('About to call addTask...');
        const taskId = await addTask(taskData);
        console.log('Task created successfully with ID:', taskId);
      } catch (error) {
        console.error('Error creating task:', error);
        // Don't return here - still close the form and let user try again
      }
    }
    
    // Call onSave if provided, otherwise fall back to onCancel
    console.log('About to call callback - onSave available:', !!onSave);
    if (onSave) {
      console.log('Calling onSave callback');
      onSave();
    } else {
      console.log('Calling onCancel callback');
      onCancel();
    }
  };

  const handleDelete = () => {
    if (task && window.confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      deleteTask(task.id);
      onCancel();
    }
  };

  const handleToggleStatus = () => {
    if (task) {
      const newStatus = task.status === 'pomodoro' ? 'todo' : 'pomodoro';
      updateTask(task.id, {
        ...task,
        status: newStatus,
        completed: false,
        hideFromPomodoro: newStatus === 'pomodoro' ? false : task.hideFromPomodoro
      });
      onCancel();
    }
  };

  const handleComplete = () => {
    if (task) {
      const userTimezone = useUserStore.getState().getTimezone();
      const today = timezoneUtils.getTodayInUserTimezone(userTimezone);
      const isScheduledForToday = task.scheduledDate === today;
      
      updateTask(task.id, {
        ...task,
        status: 'completed',
        completed: true,
        // Hide from pomodoro timer if not scheduled for today
        hideFromPomodoro: !isScheduledForToday
      });
      onCancel();
    }
  };

  const handleCalendarClick = useCallback(() => {
    const newValue = !showDatePicker;
    setShowDatePicker(newValue);
  }, [showDatePicker]);

  const handleClearDate = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the calendar click
    setCalendarDate('');
    setCalendarEndDate('');
    setStartTime('09:00');
    setEndTime('10:00');
    setIncludeTime(false);
    setIsHoveringDate(false);
  }, []);

  const handleClearProject = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the project dropdown
    setProjectId('no-project');
    setIsCreatingNewProject(false);
    setNewProjectName('');
    setIsHoveringProject(false);
    setPreventDropdown(true);
    // Reset prevent flag after a short delay
    setTimeout(() => setPreventDropdown(false), 100);
  }, []);

  const handleClearTime = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent any other interactions
    setTimeSpent('0');
    setTimeEstimated('0');
    setIsHoveringTime(false);
  }, []);

  const handleDateTimeSelect = useCallback((date: Date) => {
    // Use local date formatting to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    setCalendarDate(`${year}-${month}-${day}`);
    // Don't close the date picker here - let user click Confirm
  }, []);

  const handleEndDateSelect = useCallback((date: Date) => {
    // Use local date formatting to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    setCalendarEndDate(`${year}-${month}-${day}`);
  }, []);

  const handleTimeSelect = useCallback((time: string) => {
    const [start, end] = time.split(' - ');
    setStartTime(start);
    setEndTime(end);
  }, []);

  const handleTimeToggle = useCallback((enabled: boolean) => {
    setIncludeTime(enabled);
    // DatePicker will automatically reposition itself when content changes
  }, []);

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
      
      // If editing an existing task, save immediately
      if (task) {
        handleSave();
        return;
      }
      
      // For new task creation, move to next field
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
      
      // If editing an existing task, save immediately
      if (task) {
        handleSave();
        return;
      }
      
      // For new task creation, move to project selection and open dropdown
      if (projectSelectRef.current) {
        projectSelectRef.current.focus();
        setTimeout(() => handleProjectFocus(), 50);
      }
    }
  };

  const handleTimeSpentKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Always save the task (both creation and editing end here)
      handleSave();
    }
  };

  const handleTimeEstimatedKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Always save the task (both creation and editing end here)
      handleSave();
    }
  };

  const handleCalendarKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Always save the task (both creation and editing end here)
      handleSave();
    }
  };

  const handleProjectKeyDown = (e: React.KeyboardEvent<HTMLSelectElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      // If editing an existing task, save immediately
      if (task) {
        handleSave();
        return;
      }
      
      // For new task creation, move to time estimation
      if (timeEstimatedRef.current) {
        timeEstimatedRef.current.focus();
      }
    }
  };
  
  return (
    <DateTimeProvider>
      <div 
        key={task?.id || 'new-task'}
        ref={formRef}
        className="task-card p-4 bg-background-secondary border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 animate-fade-in relative"
        style={{ zIndex: showDatePicker ? 1000 : 'auto' }}
      >
        <div className="flex-1 min-w-0">
          <textarea
            autoFocus
            ref={titleInputRef}
            id="task-title"
            name="title"
            className={`w-full text-base font-medium text-text-primary px-0 py-0.5 bg-transparent focus:outline-none border-none resize-none overflow-hidden ${titleError ? 'ring-2 ring-red-200' : ''}`}
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
            id="task-description"
            name="description"
            className="w-full text-sm text-text-secondary px-0 py-1 bg-transparent border-none focus:outline-none resize-none"
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
          
          <div className="flex flex-wrap gap-3 mb-2">
            <div className="flex flex-wrap gap-2 min-w-0">
              {/* Project Selection */}
              <div className="relative">
                {isCreatingNewProject ? (
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-background-secondary border border-border hover:border-text-secondary rounded text-xs text-text-secondary">
                      <div className="w-3.5 h-3.5 flex items-center justify-center">
                        <Icon name="folder-line" className="w-3.5 h-3.5" />
                      </div>
                      <input
                        ref={newProjectInputRef}
                        type="text"
                        id="new-project-name"
                        name="newProjectName"
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
                      className="p-1 rounded hover:bg-background-primary transition-colors duration-200"
                      onClick={handleCancelNewProject}
                      type="button"
                    >
                      <Icon name="close-line" className="w-3.5 h-3.5 text-text-secondary" />
                    </button>
                  </div>
                ) : (
                  <>
                    <select
                      ref={projectSelectRef}
                      id="task-project"
                      name="projectId"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      value={projectId}
                      onChange={(e) => handleProjectChange(e.target.value)}
                      onKeyDown={handleProjectKeyDown}
                      onMouseEnter={() => {
                        console.log('Project hover enter - projectId:', projectId, 'getSelectedProjectName:', getSelectedProjectName());
                        setIsHoveringProject(true);
                      }}
                      onMouseLeave={() => setIsHoveringProject(false)}
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
                      className={`flex items-center gap-1.5 px-2.5 py-1 bg-background-secondary border border-border hover:border-text-secondary rounded text-xs text-text-secondary hover:bg-background-primary min-w-0 ${projectError ? 'ring-2 ring-red-200' : ''}`}
                      onClick={handleProjectFocus}
                    >
                      <div 
                        className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0 cursor-pointer relative z-10"
                        onMouseDown={(e) => {
                          if (projectId && projectId !== 'no-project' && isHoveringProject) {
                            e.preventDefault();
                            e.stopPropagation();
                            handleClearProject(e);
                          }
                        }}
                        onMouseEnter={() => setIsHoveringProject(true)}
                        onMouseLeave={() => setIsHoveringProject(false)}
                      >
                        {projectId && projectId !== 'no-project' && isHoveringProject ? (
                          <Icon name="close-line" className="w-3.5 h-3.5" />
                        ) : (
                          <Icon name="folder-line" className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <span className="truncate max-w-[8rem]">{getSelectedProjectName()}</span>
                      <div className="w-3.5 h-3.5 flex items-center justify-center text-text-secondary flex-shrink-0">
                        <Icon name="arrow-down-s-line" className="w-3.5 h-3.5" />
                      </div>
                    </button>
                  </>
                )}
              </div>

              {/* Time Estimation */}
              <div className="flex flex-col">
                <div 
                  className={`flex items-center gap-1.5 px-2.5 py-1 bg-background-secondary border border-border hover:border-text-secondary rounded text-xs text-text-secondary flex-shrink-0 ${timeSpentError || timeEstimatedError ? 'border-red-500' : ''}`}
                  onMouseEnter={() => setIsHoveringTime(true)}
                  onMouseLeave={() => setIsHoveringTime(false)}
                >
                  <div 
                    className="w-3.5 h-3.5 flex items-center justify-center cursor-pointer"
                    onClick={isHoveringTime ? handleClearTime : undefined}
                  >
                    {isHoveringTime ? (
                      <Icon name="close-line" className="w-3.5 h-3.5" />
                    ) : (
                      <Icon name="time-line" className="w-3.5 h-3.5" />
                    )}
                  </div>
                  {task && (
                    <>
                      <input
                        ref={timeSpentRef}
                        type="number"
                        id="time-spent"
                        name="timeSpent"
                        className="w-7 text-center bg-transparent border-none focus:outline-none p-0 text-xs"
                        placeholder="0"
                        min="0"
                        value={timeSpent}
                        onChange={(e) => {
                          setTimeSpent(e.target.value);
                          setTimeSpentError(false);
                        }}
                        onKeyDown={handleTimeSpentKeyDown}
                      />
                      <span className="text-text-secondary">/</span>
                    </>
                  )}
                  {!task && <span className="whitespace-nowrap">Est.</span>}
                  <input
                    ref={timeEstimatedRef}
                    type="number"
                    id="time-estimated"
                    name="timeEstimated"
                    className="w-7 text-center bg-transparent border-none focus:outline-none p-0 text-xs"
                    placeholder="0"
                    min="0"
                    value={timeEstimated}
                    onChange={(e) => {
                      setTimeEstimated(e.target.value);
                      setTimeEstimatedError(false);
                    }}
                    onKeyDown={handleTimeEstimatedKeyDown}
                  />
                  <span className="text-text-secondary whitespace-nowrap">m</span>
                </div>
                {(timeSpentError || timeEstimatedError) && (
                  <div className="text-xs text-red-500 mt-1 px-2.5">
                    Time must be positive!
                  </div>
                )}
              </div>

              {/* Calendar */}
              <div className="relative">
                <button
                  ref={calendarInputRef}
                  id="datePickerBtn"
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-background-secondary border border-border hover:border-text-secondary rounded text-xs text-text-secondary hover:bg-background-primary min-w-0 flex-shrink-0 focus:outline-none"
                  onClick={handleCalendarClick}
                  onMouseEnter={() => setIsHoveringDate(true)}
                  onMouseLeave={() => setIsHoveringDate(false)}
                >
                  <div 
                    className="w-4 h-4 flex items-center justify-center flex-shrink-0 cursor-pointer"
                    onClick={(e) => {
                      if (calendarDate && isHoveringDate) {
                        e.stopPropagation();
                        handleClearDate(e);
                      }
                    }}
                  >
                    {calendarDate && isHoveringDate ? (
                      <Icon name="close-line" className="w-4 h-4" />
                    ) : (
                      <i className="ri-calendar-line"></i>
                    )}
                  </div>
                  <span className="whitespace-nowrap">
                    {calendarDate ? (
                      isMultiDayEnabled() && calendarEndDate && !isSameDay(new Date(calendarDate), new Date(calendarEndDate)) ? 
                        `${format(new Date(calendarDate), 'MMM dd')} - ${format(new Date(calendarEndDate), 'MMM dd, yyyy')}${includeTime ? `, ${startTime} - ${endTime}` : ''}` :
                        `${format(new Date(calendarDate), 'MMM dd, yyyy')}${includeTime ? `, ${startTime} - ${endTime}` : ''}`
                    ) : 'Add to calendar'}
                  </span>
                </button>
                
                {showDatePicker && createPortal(
                  <DatePicker
                    selectedDate={calendarDate ? new Date(calendarDate) : undefined}
                    onDateSelect={handleDateTimeSelect}
                    onTimeSelect={handleTimeSelect}
                    onTimeToggle={handleTimeToggle}
                    onConfirm={() => setShowDatePicker(false)}
                    onClose={() => setShowDatePicker(false)}
                    onClear={() => {
                      setCalendarDate('');
                      setCalendarEndDate('');
                      setStartTime('09:00');
                      setEndTime('10:00');
                      setIncludeTime(false);
                    }}
                    includeTime={includeTime}
                    showTimezone={true}
                    initialStartTime={startTime}
                    initialEndTime={endTime}
                    triggerRef={calendarInputRef}
                    isOpen={showDatePicker}
                    // Multi-day props (when feature is enabled)
                    isMultiDayEnabled={isMultiDayEnabled()}
                    selectedEndDate={calendarEndDate ? new Date(calendarEndDate) : undefined}
                    onEndDateSelect={handleEndDateSelect}
                  />,
                  document.body
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
                    onClick={handleToggleStatus}
                  >
                    {task.status === 'pomodoro' ? 'Work later' : 'Add to Pomodoro'}
                  </button>
                  {isCalendarContext && !task.completed && (
                    <button
                      className="text-[#22C55E] hover:text-green-600 text-sm font-medium"
                      onClick={handleComplete}
                    >
                      Complete
                    </button>
                  )}
                </>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <button
                className="w-10 h-10 rounded-full hover:bg-background-primary flex items-center justify-center transition-colors duration-200"
                onClick={onCancel}
              >
                <div className="w-5 h-5 flex items-center justify-center text-text-secondary">
                  <Icon name="close-line" className="w-5 h-5" />
                </div>
              </button>
              <button
                className="w-10 h-10 rounded-full bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 flex items-center justify-center transition-colors duration-200"
                onClick={handleSave}
              >
                <div className="w-5 h-5 flex items-center justify-center text-green-600 dark:text-green-400">
                  <Icon name="check-line" className="w-5 h-5" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </DateTimeProvider>
  );
};

export default TaskForm;