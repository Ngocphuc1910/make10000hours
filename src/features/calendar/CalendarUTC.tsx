import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, isSameDay } from 'date-fns';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useNavigate, useLocation } from 'react-router-dom';
import { CalendarEvent, CalendarView, DragItem, DropResult } from './types';
import ScrollableWeekView, { ScrollableWeekViewRef } from './ScrollableWeekView';
import DayView from './DayView';
import MonthView from './MonthView';
import Icon from '../../components/ui/Icon';
import { Tooltip } from '../../components/ui/Tooltip';
import { useExtensionSync } from '../../hooks/useExtensionSync';
import { DeepFocusSwitch } from '../../components/ui/DeepFocusSwitch';
import { useUIStore } from '../../store/uiStore';

import { useTaskStore } from '../../store/taskStore';
import { useUserStore } from '../../store/userStore';
import { transitionQueryService } from '../../services/transitionService';
import { utcFeatureFlags } from '../../services/featureFlags';
import { timezoneUtils } from '../../utils/timezoneUtils';
import { utcMonitoring } from '../../services/monitoring';
import { useTimezoneChangeNotification } from '../../hooks/useTimezoneChangeNotification';
import { TimezoneChangeModal } from '../../components/notifications/TimezoneChangeModal';

// Enhanced UTC utilities
import { 
  mergeEventsAndTasksUTC, 
  calculateNewEventTimeUTC, 
  isValidDropUTC 
} from './utcUtils';

import TaskFormUTC from '../../components/tasks/TaskFormUTC';
import { Task } from '../../types/models';
import { useAuthGuard, triggerAuthenticationFlow } from '../../utils/authGuard';
import { useSyncStore } from '../../store/syncStore';
import { useSimpleGoogleCalendarAuth } from '../../hooks/useSimpleGoogleCalendarAuth';

// Enhanced Undo/Redo state for UTC support
interface UTCUndoRedoState {
  taskId: string;
  beforeState: {
    // Legacy fields
    scheduledDate: string | null;
    scheduledStartTime: string | null;
    scheduledEndTime: string | null;
    includeTime: boolean;
    status: 'pomodoro' | 'todo' | 'completed';
    // UTC fields
    scheduledStartTimeUTC?: string | null;
    scheduledEndTimeUTC?: string | null;
    timezoneContext?: any;
  };
  afterState: {
    // Legacy fields
    scheduledDate: string | null;
    scheduledStartTime: string | null;
    scheduledEndTime: string | null;
    includeTime: boolean;
    status: 'pomodoro' | 'todo' | 'completed';
    // UTC fields
    scheduledStartTimeUTC?: string | null;
    scheduledEndTimeUTC?: string | null;
    timezoneContext?: any;
    isNewlyCreated?: boolean;
  };
}

export const CalendarUTC: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<CalendarView>('week');
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [isDragCreateTaskOpen, setIsDragCreateTaskOpen] = useState(false);
  const [dragCreateData, setDragCreateData] = useState<{
    startTime: Date;
    endTime: Date;
    status: 'pomodoro' | 'todo';
  } | null>(null);
  const [isTimeSlotTaskOpen, setIsTimeSlotTaskOpen] = useState(false);
  const [timeSlotData, setTimeSlotData] = useState<{
    startTime: Date;
    endTime: Date;
    status: 'pomodoro' | 'todo';
    isAllDay?: boolean;
  } | null>(null);
  const [clearDragIndicator, setClearDragIndicator] = useState(false);
  const [visibleDateRange, setVisibleDateRange] = useState<{
    startDate: Date;
    endDate: Date;
  } | null>(null);

  // UTC-specific state
  const [useUTCCalendar, setUseUTCCalendar] = useState(false);
  const [userTimezone, setUserTimezone] = useState(timezoneUtils.getCurrentTimezone());
  const [timezoneError, setTimezoneError] = useState<string | null>(null);
  
  const authStatus = useAuthGuard();
  const scrollableWeekViewRef = useRef<ScrollableWeekViewRef>(null);

  // Enhanced undo/redo with UTC support
  const [undoStack, setUndoStack] = useState<UTCUndoRedoState[]>([]);
  const [redoStack, setRedoStack] = useState<UTCUndoRedoState[]>([]);

  // Stores and hooks
  const { tasks, projects, updateTask, addTask, deleteTask } = useTaskStore();
  const { user } = useUserStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { isLeftSidebarOpen, toggleLeftSidebar } = useUIStore();
  
  // Timezone change notification
  const {
    showTimezoneModal,
    detectedTimezone,
    currentTimezone,
    handleTimezoneConfirm,
    handleModalClose
  } = useTimezoneChangeNotification();

  // Determine UTC usage based on feature flags
  useEffect(() => {
    if (!user) return;

    const utcEnabled = utcFeatureFlags.isFeatureEnabled('utcCalendarIntegration', user.uid);
    const transitionMode = utcFeatureFlags.getTransitionMode(user.uid);
    
    setUseUTCCalendar(utcEnabled || transitionMode !== 'disabled');
    setUserTimezone(user.timezone || timezoneUtils.getCurrentTimezone());

    console.log(`CalendarUTC: Using ${useUTCCalendar ? 'UTC' : 'Legacy'} calendar for user ${user.uid}`);
  }, [user, useUTCCalendar]);

  // Monitor timezone changes
  useEffect(() => {
    const currentTimezone = timezoneUtils.getCurrentTimezone();
    if (currentTimezone !== userTimezone && user) {
      setUserTimezone(currentTimezone);
      console.log(`Calendar timezone changed from ${userTimezone} to ${currentTimezone}`);
    }
  }, [userTimezone, user]);

  // Get merged events using UTC-aware utilities
  const mergedEvents = useMemo(() => {
    if (useUTCCalendar) {
      return mergeEventsAndTasksUTC(calendarEvents, tasks, projects, userTimezone);
    } else {
      // Fallback to legacy merge
      const { mergeEventsAndTasks } = require('./utils');
      return mergeEventsAndTasks(calendarEvents, tasks, projects);
    }
  }, [calendarEvents, tasks, projects, useUTCCalendar, userTimezone]);

  // Handle view changes from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const viewParam = urlParams.get('view');
    if (viewParam && ['day', 'week', 'month'].includes(viewParam)) {
      setCurrentView(viewParam as CalendarView);
    }
  }, [location.search]);

  // Enhanced undo functionality with UTC support
  const performUndo = useCallback(() => {
    console.log('↩️ performUndo called, undo stack length:', undoStack.length);
    
    if (undoStack.length === 0) {
      console.log('❌ Undo stack is empty');
      return;
    }

    const undoAction = undoStack[undoStack.length - 1];
    const { taskId, beforeState, afterState } = undoAction;
    
    console.log('🔄 Undoing action for task:', taskId, 'to state:', beforeState);

    // Prepare update data with both legacy and UTC fields
    const updateData: any = {
      scheduledDate: beforeState.scheduledDate === null ? undefined : beforeState.scheduledDate,
      scheduledStartTime: beforeState.scheduledStartTime === null ? undefined : beforeState.scheduledStartTime,
      scheduledEndTime: beforeState.scheduledEndTime === null ? undefined : beforeState.scheduledEndTime,
      includeTime: beforeState.includeTime,
      status: beforeState.status
    };

    // Add UTC fields if present
    if (beforeState.scheduledStartTimeUTC !== undefined) {
      updateData.scheduledStartTimeUTC = beforeState.scheduledStartTimeUTC === null ? undefined : beforeState.scheduledStartTimeUTC;
    }
    if (beforeState.scheduledEndTimeUTC !== undefined) {
      updateData.scheduledEndTimeUTC = beforeState.scheduledEndTimeUTC === null ? undefined : beforeState.scheduledEndTimeUTC;
    }
    if (beforeState.timezoneContext) {
      updateData.timezoneContext = beforeState.timezoneContext;
    }

    if (afterState.isNewlyCreated) {
      deleteTask(taskId).then(() => {
        setRedoStack(prev => [...prev, undoAction]);
        setUndoStack(prev => prev.slice(0, -1));
      }).catch(error => {
        console.error('Failed to undo task creation:', error);
      });
    } else {
      const updatePromise = useUTCCalendar 
        ? transitionQueryService.updateTask(taskId, updateData)
        : updateTask(taskId, updateData);

      updatePromise.then(() => {
        setRedoStack(prev => [...prev, undoAction]);
        setUndoStack(prev => prev.slice(0, -1));
      }).catch(error => {
        console.error('Failed to undo task change:', error);
      });
    }
  }, [undoStack, updateTask, deleteTask, useUTCCalendar]);

  // Enhanced redo functionality
  const performRedo = useCallback(() => {
    if (redoStack.length === 0) return;

    const redoAction = redoStack[redoStack.length - 1];
    const { taskId, afterState } = redoAction;

    const updateData: any = {
      scheduledDate: afterState.scheduledDate === null ? undefined : afterState.scheduledDate,
      scheduledStartTime: afterState.scheduledStartTime === null ? undefined : afterState.scheduledStartTime,
      scheduledEndTime: afterState.scheduledEndTime === null ? undefined : afterState.scheduledEndTime,
      includeTime: afterState.includeTime,
      status: afterState.status
    };

    // Add UTC fields if present
    if (afterState.scheduledStartTimeUTC !== undefined) {
      updateData.scheduledStartTimeUTC = afterState.scheduledStartTimeUTC === null ? undefined : afterState.scheduledStartTimeUTC;
    }
    if (afterState.scheduledEndTimeUTC !== undefined) {
      updateData.scheduledEndTimeUTC = afterState.scheduledEndTimeUTC === null ? undefined : afterState.scheduledEndTimeUTC;
    }
    if (afterState.timezoneContext) {
      updateData.timezoneContext = afterState.timezoneContext;
    }

    const updatePromise = useUTCCalendar 
      ? transitionQueryService.updateTask(taskId, updateData)
      : updateTask(taskId, updateData);

    updatePromise.then(() => {
      setUndoStack(prev => [...prev, redoAction]);
      setRedoStack(prev => prev.slice(0, -1));
    }).catch(error => {
      console.error('Failed to redo task change:', error);
    });
  }, [redoStack, updateTask, useUTCCalendar]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      
      if (!(editingTaskId || isDragCreateTaskOpen || isTimeSlotTaskOpen || 
            target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || 
            target.isContentEditable)) {
        
        if (event.metaKey && event.key.toLowerCase() === 'z') {
          console.log('⌨️ Command+Z detected, shiftKey:', event.shiftKey);
          event.preventDefault();
          if (event.shiftKey) {
            console.log('🔄 Calling performRedo');
            performRedo();
          } else {
            console.log('↩️ Calling performUndo');
            performUndo();
          }
          return;
        }

        switch (event.key.toLowerCase()) {
          case 'q':
            event.preventDefault();
            navigateDate('prev');
            break;
          case 'e':
            event.preventDefault();
            navigateDate('next');
            break;
          case 'arrowleft':
            event.preventDefault();
            navigateDate('prev');
            break;
          case 'arrowright':
            event.preventDefault();
            navigateDate('next');
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [editingTaskId, isDragCreateTaskOpen, isTimeSlotTaskOpen, currentView, currentDate, performUndo, performRedo]);

  // Navigation helper
  const navigateDate = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setCurrentDate(new Date());
      return;
    }

    const increment = direction === 'next' ? 1 : -1;
    switch (currentView) {
      case 'month':
        setCurrentDate(addMonths(currentDate, increment));
        break;
      case 'week':
        setCurrentDate(addWeeks(currentDate, increment));
        break;
      case 'day':
        setCurrentDate(addDays(currentDate, increment));
        break;
    }
  };

  // Enhanced event click handler
  const handleEventClick = useCallback((event: CalendarEvent) => {
    setClearDragIndicator(false);
    setDragCreateData(null);
    setIsTimeSlotTaskOpen(false);
    setTimeSlotData(null);
    setClearDragIndicator(true);
    setTimeout(() => setClearDragIndicator(false), 100);

    if (event.isTask && event.taskId) {
      setEditingTaskId(event.taskId);
    } else {
      setEditingTaskId('new');
    }
  }, []);

  // Enhanced event drop handler with UTC support
  const handleEventDrop = useCallback((draggedEvent: CalendarEvent, dropResult: DropResult) => {
    if (!draggedEvent.isTask || !draggedEvent.taskId) {
      setCalendarEvents(prev => prev.map(event => {
        if (event.id === draggedEvent.id) {
          const { start, end } = useUTCCalendar 
            ? calculateNewEventTimeUTC(draggedEvent, dropResult, userTimezone)
            : (() => {
                const { calculateNewEventTime } = require('./utils');
                return calculateNewEventTime(draggedEvent, dropResult);
              })();
          return { ...event, start, end };
        }
        return event;
      }));
      return;
    }

    const task = tasks.find(t => t.id === draggedEvent.taskId);
    if (!task) return;

    try {
      // Enhanced calculation with UTC support
      const calculation = useUTCCalendar 
        ? calculateNewEventTimeUTC(draggedEvent, dropResult, userTimezone)
        : (() => {
            const { calculateNewEventTime } = require('./utils');
            const { start, end } = calculateNewEventTime(draggedEvent, dropResult);
            return {
              start,
              end,
              updateData: {
                scheduledDate: start.toISOString().split('T')[0],
                includeTime: !dropResult.isAllDay,
                scheduledStartTime: dropResult.isAllDay ? null : start.toTimeString().substring(0, 5),
                scheduledEndTime: dropResult.isAllDay ? null : end.toTimeString().substring(0, 5)
              }
            };
          })();

      const { start, end, updateData } = calculation;

      // Create undo state with UTC fields
      const beforeState = {
        scheduledDate: task.scheduledDate || null,
        scheduledStartTime: task.scheduledStartTime || null,
        scheduledEndTime: task.scheduledEndTime || null,
        includeTime: task.includeTime || false,
        status: task.status,
        ...(useUTCCalendar && {
          scheduledStartTimeUTC: (task as any).scheduledStartTimeUTC || null,
          scheduledEndTimeUTC: (task as any).scheduledEndTimeUTC || null,
          timezoneContext: (task as any).timezoneContext || null
        })
      };

      const afterState = {
        ...beforeState,
        ...updateData
      };

      const undoAction: UTCUndoRedoState = {
        taskId: task.id,
        beforeState,
        afterState
      };

      console.log('🔄 Adding drag action to undo stack:', undoAction);
      setUndoStack(prev => {
        const newStack = [...prev, undoAction];
        console.log('📚 Undo stack updated after drag, length:', newStack.length);
        return newStack;
      });
      setRedoStack([]);

      // Update task using appropriate service
      const updatePromise = useUTCCalendar 
        ? transitionQueryService.updateTask(task.id, updateData)
        : updateTask(task.id, updateData);

      updatePromise.catch(error => {
        console.error('Failed to update task scheduling:', error);
        setUndoStack(prev => prev.slice(0, -1));
        
        if (error.message?.includes('timezone')) {
          setTimezoneError(`Failed to update task: ${error.message}`);
        }
      });

      utcMonitoring.trackOperation('calendar_task_drop', true);

    } catch (error) {
      console.error('Failed to handle event drop:', error);
      utcMonitoring.trackOperation('calendar_task_drop', false);
      
      if (error instanceof Error && error.message.includes('timezone')) {
        setTimezoneError(error.message);
      }
    }
  }, [tasks, updateTask, useUTCCalendar, userTimezone]);

  // Rest of the component remains similar but uses UTC utilities
  // ... (other handlers like handleTimeSlotClick, handleAllDayClick, etc.)

  if (!user) {
    return (
      <div className="calendar-main-container flex flex-col h-full bg-background-primary dark:bg-[#141414]">
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">Please log in to use the calendar</p>
        </div>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="calendar-main-container flex flex-col h-full bg-background-primary dark:bg-[#141414]">
        {/* Timezone Error Display */}
        {timezoneError && (
          <div className="bg-red-50 border-b border-red-200 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-red-600">⚠️</span>
                <div>
                  <p className="text-sm font-medium text-red-800">Timezone Error</p>
                  <p className="text-xs text-red-600">{timezoneError}</p>
                </div>
              </div>
              <button
                onClick={() => setTimezoneError(null)}
                className="text-red-600 hover:text-red-800"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="calendar-header h-16 border-b border-border px-4 flex items-center justify-between bg-background-secondary">
          <div className="flex items-center space-x-4">
            {!isLeftSidebarOpen && (
              <button
                onClick={toggleLeftSidebar}
                className="p-2 mr-2 rounded-md hover:bg-background-primary hover:shadow-sm hover:scale-105 transition-all duration-200 group"
                aria-label="Show Sidebar"
              >
                <div className="w-5 h-5 flex items-center justify-center text-text-secondary group-hover:text-primary transition-colors duration-200">
                  <Icon name="menu-line" size={20} />
                </div>
              </button>
            )}
            
            <div className="flex items-center">
              <button
                onClick={() => navigateDate('prev')}
                className="p-1.5 rounded-full hover:bg-background-container text-text-secondary hover:text-primary"
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-arrow-left-s-line"></i>
                </div>
              </button>
              <button
                onClick={() => navigateDate('next')}
                className="p-1.5 rounded-full hover:bg-background-container text-text-secondary hover:text-primary"
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-arrow-right-s-line"></i>
                </div>
              </button>
            </div>

            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-semibold text-text-primary">
                {format(currentDate, 'MMMM yyyy')}
              </h1>
              <span className={`text-xs px-2 py-1 rounded ${
                useUTCCalendar ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {useUTCCalendar ? 'UTC Calendar' : 'Legacy Calendar'}
              </span>
              <span className="text-xs text-gray-500">
                {userTimezone}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigateDate('today')}
              className="px-4 py-1.5 text-sm font-medium bg-background-secondary border border-border rounded-button text-primary hover:bg-background-container"
            >
              Today
            </button>

            <div className="inline-flex rounded-full bg-background-container p-1">
              {(['day', 'week', 'month'] as CalendarView[]).map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setCurrentView(view)}
                  className={`inline-flex items-center px-4 py-1.5 text-sm font-medium rounded-full ${
                    currentView === view
                      ? 'bg-background-primary text-primary shadow-sm'
                      : 'text-text-secondary hover:text-primary'
                  }`}
                >
                  {view.charAt(0).toUpperCase() + view.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Calendar Views */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          {currentView === 'week' && (
            <ScrollableWeekView
              ref={scrollableWeekViewRef}
              currentDate={currentDate}
              events={mergedEvents}
              onEventClick={handleEventClick}
              onTimeSlotClick={() => {}} // TODO: implement
              onAllDayClick={() => {}} // TODO: implement
              onDragCreate={() => {}} // TODO: implement
              onEventDrop={handleEventDrop}
              onEventResize={() => {}} // TODO: implement
              onEventResizeMove={() => {}} // TODO: implement
              clearDragIndicator={clearDragIndicator}
            />
          )}

          {currentView === 'day' && (
            <DayView
              currentDate={currentDate}
              events={mergedEvents}
              onEventClick={handleEventClick}
              onTimeSlotClick={() => {}} // TODO: implement
              onAllDayClick={() => {}} // TODO: implement
              onDragCreate={() => {}} // TODO: implement
              onEventDrop={handleEventDrop}
              clearDragIndicator={clearDragIndicator}
            />
          )}

          {currentView === 'month' && (
            <MonthView
              currentDate={currentDate}
              events={mergedEvents}
              onEventClick={handleEventClick}
              onDateClick={() => {}} // TODO: implement
              onEventDrop={handleEventDrop}
              onDayViewClick={(date) => {
                setCurrentDate(date);
                setCurrentView('day');
              }}
            />
          )}
        </div>

        {/* Task Form Modal */}
        {editingTaskId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <TaskFormUTC
                task={editingTaskId === 'new' ? undefined : tasks.find(t => t.id === editingTaskId)}
                onCancel={() => {
                  setEditingTaskId(null);
                  setClearDragIndicator(true);
                  setTimeout(() => setClearDragIndicator(false), 100);
                }}
                onSave={() => {
                  setEditingTaskId(null);
                  setClearDragIndicator(true);
                  setTimeout(() => setClearDragIndicator(false), 100);
                }}
              />
            </div>
          </div>
        )}

        {/* Timezone Change Modal */}
        <TimezoneChangeModal
          isOpen={showTimezoneModal}
          onClose={handleModalClose}
          detectedTimezone={detectedTimezone}
          currentTimezone={currentTimezone}
          onConfirm={handleTimezoneConfirm}
        />
      </div>
    </DndProvider>
  );
};