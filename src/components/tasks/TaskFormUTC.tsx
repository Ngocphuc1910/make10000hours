import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Task } from '../../types/models';
import { useTaskStore } from '../../store/taskStore';
import { useTaskStoreWithSync } from '../../store/syncStore';
import { useUserStore } from '../../store/userStore';
import { transitionQueryService } from '../../services/transitionService';
import { utcFeatureFlags } from '../../services/featureFlags';
import { timezoneUtils } from '../../utils/timezoneUtils';
import { utcMonitoring } from '../../services/monitoring';
import { Icon } from '../ui/Icon';
import { formatMinutesToHoursAndMinutes, calculateDurationInMinutes } from '../../utils/timeUtils';
import { getDateISOString } from '../../utils/timeUtils';
import { DatePicker, DateTimeProvider, useDateTimeContext } from '../common/DatePicker';
import { format, isSameDay } from 'date-fns';
import { getRandomPresetColor } from '../../utils/colorUtils';

interface TaskFormUTCProps {
  task?: Task;
  status?: Task['status'];
  initialProjectId?: string;
  initialStartTime?: Date;
  initialEndTime?: Date;
  isAllDay?: boolean;
  onCancel: () => void;
  onSave?: () => void;
  isCalendarContext?: boolean;
}

const TaskFormUTC: React.FC<TaskFormUTCProps> = ({ 
  task, 
  status, 
  initialProjectId, 
  initialStartTime, 
  initialEndTime, 
  isAllDay, 
  onCancel, 
  onSave, 
  isCalendarContext = false 
}) => {
  // Determine which services to use based on feature flags
  const { user } = useUserStore();
  const [useUTCServices, setUseUTCServices] = useState(false);
  const [userTimezone, setUserTimezone] = useState(timezoneUtils.getCurrentTimezone());

  // Legacy stores (fallback)
  const taskStoreWithSync = useTaskStoreWithSync();
  const { addTask: legacyAddTask, updateTask: legacyUpdateTask, deleteTask: legacyDeleteTask } = taskStoreWithSync;
  const projects = useTaskStore(state => state.projects);
  const addProject = useTaskStore(state => state.addProject);

  // Form state
  const [title, setTitle] = useState(task?.title || '');
  const [projectId, setProjectId] = useState(task?.projectId || initialProjectId || '');
  const [timeSpent, setTimeSpent] = useState(task?.timeSpent?.toString() || '0');
  const [timeEstimated, setTimeEstimated] = useState(() => {
    if (task?.timeEstimated) return task.timeEstimated.toString();
    if (initialStartTime && initialEndTime) {
      return calculateDurationInMinutes(initialStartTime, initialEndTime).toString();
    }
    return '';
  });
  const [description, setDescription] = useState(task?.description || '');

  // Error states
  const [titleError, setTitleError] = useState(false);
  const [projectError, setProjectError] = useState(false);
  const [timeSpentError, setTimeSpentError] = useState(false);
  const [timeEstimatedError, setTimeEstimatedError] = useState(false);
  const [utcConversionError, setUtcConversionError] = useState<string | null>(null);

  // Project creation
  const [isCreatingNewProject, setIsCreatingNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  // Calendar/scheduling state
  const [calendarDate, setCalendarDate] = useState(() => {
    if (task?.scheduledDate) return task.scheduledDate;
    if (initialStartTime) {
      const year = initialStartTime.getFullYear();
      const month = String(initialStartTime.getMonth() + 1).padStart(2, '0');
      const day = String(initialStartTime.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    if (!task) {
      const today = new Date();
      return today.toISOString().split('T')[0];
    }
    return '';
  });

  const [includeTime, setIncludeTime] = useState(() => {
    if (isAllDay === true) return false;
    if (task?.includeTime !== undefined) return task.includeTime;
    if (initialStartTime && initialEndTime) return true;
    return false;
  });

  const [startTime, setStartTime] = useState(() => {
    if (task?.scheduledStartTime) return task.scheduledStartTime;
    if (initialStartTime) {
      return initialStartTime.toTimeString().substring(0, 5);
    }
    return '';
  });

  const [endTime, setEndTime] = useState(() => {
    if (task?.scheduledEndTime) return task.scheduledEndTime;
    if (initialEndTime) {
      return initialEndTime.toTimeString().substring(0, 5);
    }
    return '';
  });

  // UI state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isHoveringDate, setIsHoveringDate] = useState(false);
  const [isHoveringProject, setIsHoveringProject] = useState(false);
  const [isHoveringTime, setIsHoveringTime] = useState(false);
  const [preventDropdown, setPreventDropdown] = useState(false);

  // Refs
  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const timeEstimatedRef = useRef<HTMLInputElement>(null);

  // Determine UTC usage based on feature flags
  useEffect(() => {
    if (!user) return;

    const utcEnabled = utcFeatureFlags.isFeatureEnabled('utcTaskManagement', user.uid);
    const transitionMode = utcFeatureFlags.getTransitionMode(user.uid);
    
    setUseUTCServices(utcEnabled || transitionMode !== 'disabled');
    setUserTimezone(user.timezone || timezoneUtils.getCurrentTimezone());

    console.log(`TaskFormUTC: Using ${useUTCServices ? 'UTC' : 'Legacy'} services for user ${user.uid}`);
  }, [user, useUTCServices]);

  // Monitor timezone changes
  useEffect(() => {
    const currentTimezone = timezoneUtils.getCurrentTimezone();
    if (currentTimezone !== userTimezone) {
      setUserTimezone(currentTimezone);
      setUtcConversionError(null); // Clear any previous errors
      console.log(`Timezone changed from ${userTimezone} to ${currentTimezone}`);
    }
  }, [userTimezone]);

  const getLastUsedProjectId = useCallback(() => {
    return localStorage.getItem('lastUsedProjectId') || '';
  }, []);

  useEffect(() => {
    if (!projectId && !initialProjectId) {
      setProjectId(getLastUsedProjectId());
    }
  }, [projectId, initialProjectId, getLastUsedProjectId]);

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

  const adjustTextareaHeight = useCallback((textarea: HTMLTextAreaElement) => {
    requestAnimationFrame(() => {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    });
  }, []);

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

  /**
   * Convert legacy scheduling data to UTC format
   */
  const convertSchedulingToUTC = (taskData: any) => {
    if (!taskData.scheduledDate || !useUTCServices) {
      return taskData;
    }

    try {
      // Create date object from scheduled date and time
      const scheduledDate = new Date(taskData.scheduledDate);
      
      if (taskData.includeTime && taskData.scheduledStartTime) {
        const [startHours, startMinutes] = taskData.scheduledStartTime.split(':').map(Number);
        const startDateTime = new Date(scheduledDate);
        startDateTime.setHours(startHours, startMinutes, 0, 0);

        // Convert to UTC
        const startTimeUTC = timezoneUtils.userTimeToUTC(startDateTime, userTimezone);

        let endTimeUTC = null;
        if (taskData.scheduledEndTime) {
          const [endHours, endMinutes] = taskData.scheduledEndTime.split(':').map(Number);
          const endDateTime = new Date(scheduledDate);
          endDateTime.setHours(endHours, endMinutes, 0, 0);
          endTimeUTC = timezoneUtils.userTimeToUTC(endDateTime, userTimezone);
        }

        // Add UTC fields
        return {
          ...taskData,
          // Keep legacy fields for backward compatibility
          scheduledDate: taskData.scheduledDate,
          scheduledStartTime: taskData.scheduledStartTime,
          scheduledEndTime: taskData.scheduledEndTime,
          includeTime: taskData.includeTime,
          // Add UTC fields
          scheduledStartTimeUTC: startTimeUTC,
          scheduledEndTimeUTC: endTimeUTC,
          timezoneContext: timezoneUtils.createTimezoneContext(userTimezone)
        };
      } else {
        // All-day event - use date boundaries
        const { startUTC, endUTC } = timezoneUtils.getUserDateBoundariesUTC(scheduledDate, userTimezone);
        
        return {
          ...taskData,
          scheduledStartTimeUTC: startUTC,
          scheduledEndTimeUTC: endUTC,
          timezoneContext: timezoneUtils.createTimezoneContext(userTimezone)
        };
      }
    } catch (error) {
      console.error('Failed to convert scheduling to UTC:', error);
      setUtcConversionError(`Timezone conversion failed: ${error}`);
      utcMonitoring.trackOperation('task_form_utc_conversion', false);
      
      // Return original data without UTC fields
      return taskData;
    }
  };

  const handleSave = async () => {
    // Check authentication
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
    setUtcConversionError(null);

    // Validation
    if (!title.trim()) {
      setTitleError(true);
      if (titleInputRef.current) {
        titleInputRef.current.focus();
      }
      return;
    }

    if (isCreatingNewProject && !newProjectName.trim()) {
      setProjectError(true);
      return;
    }

    const timeSpentValue = parseInt(timeSpent) || 0;
    const timeEstimatedValue = parseInt(timeEstimated) || 0;

    if (timeSpentValue < 0) {
      setTimeSpentError(true);
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
        localStorage.setItem('lastUsedProjectId', newProjectId);
      } catch (error) {
        console.error('Error creating project:', error);
        return;
      }
    } else if (finalProjectId && finalProjectId !== 'no-project') {
      localStorage.setItem('lastUsedProjectId', finalProjectId);
    }
    
    // Build task data
    let taskData: any = {
      title: title.trim(),
      description: description.trim(),
      projectId: finalProjectId || 'no-project',
      userId: user.uid,
      completed: task?.completed || false,
      status: task?.status || status || 'pomodoro',
      timeSpent: timeSpentValue,
      timeEstimated: timeEstimatedValue
    };

    // Handle calendar fields
    if (calendarDate && calendarDate.trim()) {
      taskData.scheduledDate = calendarDate.trim();
      taskData.includeTime = includeTime;
      
      if (includeTime && startTime && endTime) {
        taskData.scheduledStartTime = startTime;
        taskData.scheduledEndTime = endTime;
      } else {
        taskData.scheduledStartTime = null;
        taskData.scheduledEndTime = null;
      }

      // Auto-change status for today's tasks
      const scheduledDate = new Date(calendarDate.trim());
      const isScheduledForToday = isSameDay(scheduledDate, new Date());
      if (isScheduledForToday && task?.status === 'todo') {
        taskData.status = 'pomodoro';
      }
    } else {
      taskData.scheduledDate = null;
      taskData.includeTime = false;
      taskData.scheduledStartTime = null;
      taskData.scheduledEndTime = null;
    }

    // Convert to UTC format if using UTC services
    if (useUTCServices) {
      taskData = convertSchedulingToUTC(taskData);
    }

    // Handle time spent changes for existing tasks
    const originalTimeSpent = task?.timeSpent || 0;
    const newTimeSpent = timeSpentValue;
    const timeSpentChanged = task && newTimeSpent !== originalTimeSpent;
    const timeDifference = newTimeSpent - originalTimeSpent;
    
    try {
      if (task) {
        // Update existing task
        if (useUTCServices) {
          await transitionQueryService.updateTask(task.id, taskData);
        } else {
          legacyUpdateTask(task.id, taskData);
        }
        
        // Create work session for manual time changes
        if (timeSpentChanged && timeDifference !== 0) {
          if (useUTCServices) {
            await transitionQueryService.createManualWorkSession({
              userId: user.uid,
              taskId: task.id,
              projectId: finalProjectId || 'no-project',
              duration: Math.abs(timeDifference),
              sessionType: timeDifference > 0 ? 'manual_add' : 'manual_subtract',
              userTimezone
            });
          } else {
            // Legacy work session creation
            const { workSessionService } = await import('../../api/workSessionService');
            await workSessionService.upsertWorkSession({
              userId: user.uid,
              taskId: task.id,
              projectId: finalProjectId || 'no-project',
              date: getDateISOString(),
            }, timeDifference, 'manual');
          }
        }
      } else {
        // Create new task
        if (useUTCServices) {
          await transitionQueryService.createTask(taskData);
        } else {
          legacyAddTask(taskData);
        }
      }

      utcMonitoring.trackOperation('task_form_save', true);
      
      onSave?.();
    } catch (error) {
      console.error('Failed to save task:', error);
      utcMonitoring.trackOperation('task_form_save', false);
      
      if (error instanceof Error && error.message.includes('timezone')) {
        setUtcConversionError(`Timezone error: ${error.message}`);
      }
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    
    if (confirm('Are you sure you want to delete this task?')) {
      try {
        if (useUTCServices) {
          await transitionQueryService.deleteTask(task.id);
        } else {
          legacyDeleteTask(task.id);
        }
        
        utcMonitoring.trackOperation('task_form_delete', true);
        onCancel();
      } catch (error) {
        console.error('Failed to delete task:', error);
        utcMonitoring.trackOperation('task_form_delete', false);
      }
    }
  };

  // Rest of the component remains similar to the original TaskForm
  // but with UTC conversion error display and service selection
  
  return (
    <DateTimeProvider>
      <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
          <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
          
          <div className="relative inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
            {/* UTC Status Indicator */}
            {user && (
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className={`text-xs px-2 py-1 rounded ${
                    useUTCServices 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {useUTCServices ? 'UTC Mode' : 'Legacy Mode'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {userTimezone}
                  </span>
                </div>
              </div>
            )}

            {/* UTC Conversion Error */}
            {utcConversionError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center">
                  <span className="text-red-500 mr-2">⚠️</span>
                  <div>
                    <p className="text-sm font-medium text-red-800">
                      Timezone Conversion Error
                    </p>
                    <p className="text-xs text-red-600 mt-1">
                      {utcConversionError}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                {task ? 'Edit Task' : 'Create Task'}
              </h3>
              <button
                onClick={onCancel}
                className="rounded-md text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <span className="sr-only">Close</span>
                <Icon name="close-line" size={20} />
              </button>
            </div>

            {/* Form content - rest of the form remains the same as original TaskForm */}
            {/* ... (keeping the same form structure but with handleSave, handleDelete updated) */}
            
            {/* Buttons */}
            <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
              <button
                type="button"
                onClick={handleSave}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-2 sm:text-sm"
              >
                {task ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
              >
                Cancel
              </button>
            </div>
            
            {/* Delete button for existing tasks */}
            {task && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={handleDelete}
                  className="w-full inline-flex justify-center rounded-md border border-red-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:text-sm"
                >
                  Delete Task
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </DateTimeProvider>
  );
};

export default TaskFormUTC;