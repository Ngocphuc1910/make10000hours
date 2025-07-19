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
// EventDialog import removed - using TaskForm for all calendar interactions

import { useTaskStore } from '../../store/taskStore';
import { useUserStore } from '../../store/userStore';
import { mergeEventsAndTasks, calculateNewEventTime, isValidDrop } from './utils';
import TaskForm from '../../components/tasks/TaskForm';
import { Task } from '../../types/models';

// Old DragState interface - removed since we have new drag-to-create system

// Undo/Redo state types
interface UndoRedoState {
  taskId: string;
  beforeState: {
    scheduledDate: string | null;
    scheduledStartTime: string | null;
    scheduledEndTime: string | null;
    includeTime: boolean;
    status: 'pomodoro' | 'todo' | 'completed';
  };
  afterState: {
    scheduledDate: string | null;
    scheduledStartTime: string | null;
    scheduledEndTime: string | null;
    includeTime: boolean;
    status: 'pomodoro' | 'todo' | 'completed';
    isNewlyCreated?: boolean; // true if this is a newly created task
  };
}

export const Calendar: React.FC = () => {
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

  // Ref for ScrollableWeekView to control navigation
  const scrollableWeekViewRef = useRef<ScrollableWeekViewRef>(null);

  // Undo/Redo state management
  const [undoStack, setUndoStack] = useState<UndoRedoState[]>([]);
  const [redoStack, setRedoStack] = useState<UndoRedoState[]>([]);
  // Old drag state - removed since we have new drag-to-create system

  // Get tasks and projects from task store
  const { tasks, projects, addTask, updateTask, setEditingTaskId: setStoreEditingTaskId, deleteTask, updateTaskLocally } = useTaskStore();
  const { user } = useUserStore();

  // Merge calendar events with task events
  const allEvents = useMemo(() => {
    return mergeEventsAndTasks(calendarEvents, tasks, projects);
  }, [calendarEvents, tasks, projects]);

  const navigate = useNavigate();
  const location = useLocation();
  const { isLeftSidebarOpen, toggleLeftSidebar } = useUIStore();

  useExtensionSync(); // Bidirectional extension sync

  // Handle URL query parameters for view selection
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const viewParam = urlParams.get('view');
    if (viewParam && ['day', 'week', 'month'].includes(viewParam)) {
      setCurrentView(viewParam as CalendarView);
    }
  }, [location.search]);

  // Undo/Redo functions
  const performUndo = useCallback(() => {
    console.log('↩️ performUndo called, undo stack length:', undoStack.length);
    if (undoStack.length === 0) {
      console.log('❌ Undo stack is empty');
      return;
    }

    const lastAction = undoStack[undoStack.length - 1];
    const { taskId, beforeState, afterState } = lastAction;
    console.log('🔄 Undoing action for task:', taskId, 'to state:', beforeState);

    // Convert null to undefined for the updateTask function
    const updateData = {
      ...beforeState,
      scheduledDate: beforeState.scheduledDate === null ? undefined : beforeState.scheduledDate,
      scheduledStartTime: beforeState.scheduledStartTime === null ? undefined : beforeState.scheduledStartTime,
      scheduledEndTime: beforeState.scheduledEndTime === null ? undefined : beforeState.scheduledEndTime,
    };

    // Apply the before state
    if (!afterState.isNewlyCreated) {
      updateTask(taskId, updateData).then(() => {
        // Move action to redo stack
        setRedoStack(prev => [...prev, lastAction]);
        // Remove from undo stack
        setUndoStack(prev => prev.slice(0, -1));
      }).catch(error => {
        console.error('Failed to undo task change:', error);
      });
    } else {
      // If this was a newly created task, we need to delete it instead
      deleteTask(taskId).then(() => {
        // Move action to redo stack
        setRedoStack(prev => [...prev, lastAction]);
        // Remove from undo stack
        setUndoStack(prev => prev.slice(0, -1));
      }).catch(error => {
        console.error('Failed to undo task creation:', error);
      });
    }
  }, [undoStack, updateTask]);

  const performRedo = useCallback(() => {
    if (redoStack.length === 0) return;

    const lastUndoneAction = redoStack[redoStack.length - 1];
    const { taskId, afterState } = lastUndoneAction;

    // Convert null to undefined for the updateTask function
    const updateData = {
      ...afterState,
      scheduledDate: afterState.scheduledDate === null ? undefined : afterState.scheduledDate,
      scheduledStartTime: afterState.scheduledStartTime === null ? undefined : afterState.scheduledStartTime,
      scheduledEndTime: afterState.scheduledEndTime === null ? undefined : afterState.scheduledEndTime,
    };

    // Apply the after state
    updateTask(taskId, updateData).then(() => {
      // Move action back to undo stack
      setUndoStack(prev => [...prev, lastUndoneAction]);
      // Remove from redo stack
      setRedoStack(prev => prev.slice(0, -1));
    }).catch(error => {
      console.error('Failed to redo task change:', error);
    });
  }, [redoStack, updateTask]);

  // Keyboard shortcuts for view switching
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts if no modal is open and target is not an input/textarea
      const target = event.target as HTMLElement;
      if (
        editingTaskId ||
        isDragCreateTaskOpen ||
        isTimeSlotTaskOpen ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Check for Command+Z (undo) and Command+Shift+Z (redo) on Mac
      if (event.metaKey && event.key.toLowerCase() === 'z') {
        console.log('⌨️ Command+Z detected, shiftKey:', event.shiftKey);
        event.preventDefault();
        if (event.shiftKey) {
          // Command+Shift+Z = Redo
          console.log('🔄 Calling performRedo');
          performRedo();
        } else {
          // Command+Z = Undo
          console.log('↩️ Calling performUndo');
          performUndo();
        }
        return;
      }

      switch (event.key.toLowerCase()) {
        case 'q':
          event.preventDefault();
          handleNavigate('prev');
          break;
        case 'e':
          event.preventDefault();
          handleNavigate('next');
          break;
        case 'arrowleft':
          event.preventDefault();
          handleNavigate('prev');
          break;
        case 'arrowright':
          event.preventDefault();
          handleNavigate('next');
          break;
        case 'd':
          event.preventDefault();
          setCurrentView('day');
          navigate('/calendar?view=day');
          break;
        case 'w':
          event.preventDefault();
          setCurrentView('week');
          navigate('/calendar?view=week');
          break;
        case 'm':
          event.preventDefault();
          setCurrentView('month');
          navigate('/calendar?view=month');
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [editingTaskId, isDragCreateTaskOpen, isTimeSlotTaskOpen, currentView, currentDate, performUndo, performRedo]);

  const handleNavigate = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setCurrentDate(new Date());
      // For week view, also use the smooth scrolling
      if (currentView === 'week' && scrollableWeekViewRef.current) {
        scrollableWeekViewRef.current.navigateWeek('today');
      }
      return;
    }

    const moveDate = direction === 'next' ? 1 : -1;
    switch (currentView) {
      case 'month':
        setCurrentDate(addMonths(currentDate, moveDate));
        break;
      case 'week':
        // Use the ScrollableWeekView's smooth navigation for week view
        if (scrollableWeekViewRef.current) {
          scrollableWeekViewRef.current.navigateWeek(direction);
        } else {
          // Fallback for when ref isn't available yet
          setCurrentDate(addWeeks(currentDate, moveDate));
        }
        break;
      case 'day':
        setCurrentDate(addDays(currentDate, moveDate));
        break;
    }
  };

  const handleEventClick = (event: CalendarEvent) => {
    // Close any open forms first
    setIsDragCreateTaskOpen(false);
    setDragCreateData(null);
    setIsTimeSlotTaskOpen(false);
    setTimeSlotData(null);

    // Clear any existing drag indicators
    setClearDragIndicator(true);
    setTimeout(() => setClearDragIndicator(false), 100);

    // Always open TaskForm for all events (both tasks and regular events)
    if (event.isTask && event.taskId) {
      setEditingTaskId(event.taskId);
      setStoreEditingTaskId(event.taskId);
    } else {
      // For regular events, open TaskForm for new task creation
      setEditingTaskId('new');
      setStoreEditingTaskId('new');
    }
  };

  const handleTimeSlotClick = (date: Date) => {
    // Close any open forms first
    setEditingTaskId(null);
    setStoreEditingTaskId(null);
    setIsDragCreateTaskOpen(false);
    setDragCreateData(null);

    // Clear any existing drag indicators
    setClearDragIndicator(true);
    setTimeout(() => setClearDragIndicator(false), 100);

    // Create start and end times (1 hour duration by default)
    const startTime = new Date(date);
    const endTime = new Date(date);
    endTime.setHours(endTime.getHours() + 1);

    // Determine task status based on whether the scheduled date is today
    const isToday = isSameDay(startTime, new Date());
    const status: 'pomodoro' | 'todo' = isToday ? 'pomodoro' : 'todo';

    setTimeSlotData({ startTime, endTime, status, isAllDay: false });
    setIsTimeSlotTaskOpen(true);
  };

  const handleAllDayClick = (date: Date) => {
    // Close any open forms first
    setEditingTaskId(null);
    setStoreEditingTaskId(null);
    setIsDragCreateTaskOpen(false);
    setDragCreateData(null);

    // Clear any existing drag indicators
    setClearDragIndicator(true);
    setTimeout(() => setClearDragIndicator(false), 100);

    // Create all-day event - use same date for both start and end without specific times
    const startTime = new Date(date);
    startTime.setHours(0, 0, 0, 0);
    const endTime = new Date(date);
    endTime.setHours(0, 0, 0, 0); // Same as start time for all-day events

    // Determine task status based on whether the scheduled date is today
    const isToday = isSameDay(startTime, new Date());
    const status: 'pomodoro' | 'todo' = isToday ? 'pomodoro' : 'todo';

    setTimeSlotData({ startTime, endTime, status, isAllDay: true });
    setIsTimeSlotTaskOpen(true);
  };

  // Separate handler for month view date clicks (should create all-day events)
  const handleMonthDateClick = (date: Date) => {
    // Month view clicks should create all-day events
    handleAllDayClick(date);
  };

  // Old handleSaveEvent - removed since we only use TaskForm now

  const handleEventDrop = useCallback((item: DragItem, dropResult: DropResult) => {
    // If user is duplicating via Alt/Option key, allow drop even at the same position
    const isAltDuplicate = item.isDuplicate === true;

    // For non-duplicate moves, validate the drop location
    if (!isAltDuplicate && !isValidDrop(item.event, dropResult, allEvents)) {
      return;
    }

    // Preserve the original event's all-day status when dropping in month view
    // Only force all-day when explicitly dropped in week/day view all-day zones
    const shouldBeAllDay = currentView === 'month'
      ? item.event.isAllDay  // In month view, preserve original isAllDay status
      : (dropResult.isAllDay || false); // In week/day view, use drop zone's isAllDay status

    const { start, end } = calculateNewEventTime(item.event, {
      ...dropResult,
      isAllDay: shouldBeAllDay
    });

    const updatedEvent: CalendarEvent = {
      ...item.event,
      start,
      end,
      isAllDay: shouldBeAllDay
    };

    // Handle task duplication or update
    if (item.event.isTask && item.event.taskId) {
      // Handle task updates through task store
      const task = tasks.find(t => t.id === item.event.taskId);
      if (task) {
        // Check if this is a duplication (Alt+Drag)
        if (item.isDuplicate) {
          console.log('🔄 Duplicating task:', task.title);

          // Prepare the new task data for duplication
          const duplicateTaskData: Omit<Task, 'id' | 'order' | 'createdAt' | 'updatedAt'> = {
            title: task.title,
            description: task.description || '',
            status: task.status,
            projectId: task.projectId,
            userId: user?.uid || task.userId,
            timeEstimated: task.timeEstimated,
            scheduledDate: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`,
            includeTime: !shouldBeAllDay,
            completed: false,
            timeSpent: 0
          };

          if (!shouldBeAllDay) {
            // Add time fields only if not all-day
            duplicateTaskData.scheduledStartTime = start.toTimeString().substring(0, 5); // HH:MM format
            duplicateTaskData.scheduledEndTime = end.toTimeString().substring(0, 5); // HH:MM format
          }

          // Auto-change status: "To do list" → "In Pomodoro" when duplicated to today
          const isMovedToToday = isSameDay(start, new Date());
          if (isMovedToToday && task.status === 'todo') {
            duplicateTaskData.status = 'pomodoro';
          }

          // Auto-change status: "In Pomodoro" → "To do list" when duplicated from today to another date (Week/Month view only)
          const isMovedFromToday = isSameDay(item.event.start, new Date()) && !isSameDay(start, new Date());
          const isWeekOrMonthView = currentView === 'week' || currentView === 'month';
          if (isMovedFromToday && isWeekOrMonthView && task.status === 'pomodoro') {
            duplicateTaskData.status = 'todo';
          }

          // Create the duplicate task
          addTask(duplicateTaskData).then((newTaskId) => {
            console.log('✅ Task duplicated successfully with ID:', newTaskId);

            // Add to undo stack for the newly created task
            const duplicateUndoAction: UndoRedoState = {
              taskId: newTaskId,
              beforeState: {
                scheduledDate: null,
                scheduledStartTime: null,
                scheduledEndTime: null,
                includeTime: false,
                status: 'todo' as 'pomodoro' | 'todo' | 'completed'
              },
              afterState: {
                scheduledDate: duplicateTaskData.scheduledDate || null,
                scheduledStartTime: duplicateTaskData.scheduledStartTime || null,
                scheduledEndTime: duplicateTaskData.scheduledEndTime || null,
                includeTime: Boolean(duplicateTaskData.includeTime),
                status: duplicateTaskData.status,
                isNewlyCreated: true,
              }
            };

            // Add to undo stack after successful creation
            console.log('🔄 Adding duplication action to undo stack:', duplicateUndoAction);
            setUndoStack(prev => {
              const newStack = [...prev, duplicateUndoAction];
              console.log('📚 Undo stack updated after duplication, length:', newStack.length);
              return newStack;
            });
            // Clear redo stack when new action is performed
            setRedoStack([]);
          }).catch((error) => {
            console.error('❌ Failed to duplicate task:', error);
          });

          return; // Exit early - don't modify original task
        }
        // Capture the before state for undo/redo
        const beforeState = {
          scheduledDate: task.scheduledDate || null,
          scheduledStartTime: task.scheduledStartTime || null,
          scheduledEndTime: task.scheduledEndTime || null,
          includeTime: task.includeTime || false,
          status: task.status
        };

        // Prepare task update data
        const taskUpdateData: any = {
          scheduledDate: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`, // YYYY-MM-DD format in local timezone
          includeTime: !shouldBeAllDay
        };

        // Add time fields only if not all-day
        if (!shouldBeAllDay) {
          taskUpdateData.scheduledStartTime = start.toTimeString().substring(0, 5); // HH:MM format
          taskUpdateData.scheduledEndTime = end.toTimeString().substring(0, 5); // HH:MM format
        } else {
          // For all-day events, explicitly set time fields to null (Firebase compatible)
          taskUpdateData.scheduledStartTime = null;
          taskUpdateData.scheduledEndTime = null;
        }

        // Auto-change status: "To do list" → "In Pomodoro" when moved to today
        const isMovedToToday = isSameDay(start, new Date());
        if (isMovedToToday && task.status === 'todo') {
          taskUpdateData.status = 'pomodoro';
        }

        // Auto-change status: "In Pomodoro" → "To do list" when moved from today to another date (Week/Month view only)
        const isMovedFromToday = isSameDay(item.event.start, new Date()) && !isSameDay(start, new Date());
        const isWeekOrMonthView = currentView === 'week' || currentView === 'month';
        if (isMovedFromToday && isWeekOrMonthView && task.status === 'pomodoro') {
          taskUpdateData.status = 'todo';
        }

        // Capture the after state for undo/redo
        const afterState = {
          scheduledDate: taskUpdateData.scheduledDate,
          scheduledStartTime: taskUpdateData.scheduledStartTime,
          scheduledEndTime: taskUpdateData.scheduledEndTime,
          includeTime: taskUpdateData.includeTime,
          status: taskUpdateData.status || task.status
        };

        // Add to undo stack before making the change
        const undoRedoAction: UndoRedoState = {
          taskId: task.id,
          beforeState,
          afterState
        };

        console.log('🔄 Adding action to undo stack:', undoRedoAction);
        setUndoStack(prev => {
          const newStack = [...prev, undoRedoAction];
          console.log('📚 Undo stack updated, length:', newStack.length);
          return newStack;
        });
        // Clear redo stack when new action is performed
        setRedoStack([]);

        // Update the task through the task store
        updateTask(task.id, taskUpdateData).catch(error => {
          console.error('Failed to update task scheduling:', error);
          // Remove the action from undo stack if update failed
          setUndoStack(prev => prev.slice(0, -1));
        });
      }
    } else {
      // Update calendar event
      setCalendarEvents(calendarEvents.map(e =>
        e.id === item.event.id ? updatedEvent : e
      ));
    }
  }, [allEvents, calendarEvents, tasks, currentView]);

  // Old calculateTime and formatTime - removed since we have new drag-to-create system

  const handleDragCreate = useCallback((startTime: Date, endTime: Date) => {
    // Close any open forms first
    setEditingTaskId(null);
    setStoreEditingTaskId(null);
    setIsTimeSlotTaskOpen(false);
    setTimeSlotData(null);

    // Determine task status based on whether the scheduled date is today
    const isToday = isSameDay(startTime, new Date());
    const status: 'pomodoro' | 'todo' = isToday ? 'pomodoro' : 'todo';

    setDragCreateData({ startTime, endTime, status });
    setIsDragCreateTaskOpen(true);
  }, []);

  const handleDateRangeChange = useCallback((startDate: Date, endDate: Date) => {
    setVisibleDateRange({ startDate, endDate });
  }, []);
  
  // Handle event resize
  const handleEventResize = useCallback((event: CalendarEvent, direction: 'top' | 'bottom', newTime: Date) => {
    if (!event.isTask || !event.taskId) {
      // Handle regular calendar events
      setCalendarEvents(calendarEvents.map(e => {
        if (e.id === event.id) {
          const updatedEvent = { ...e };
          
          if (direction === 'top') {
            updatedEvent.start = newTime;
          } else {
            updatedEvent.end = newTime;
          }
          
          return updatedEvent;
        }
        return e;
      }));
      return;
    }
    
    // Handle task events
    const task = tasks.find(t => t.id === event.taskId);
    if (!task) return;
    
    // Capture the before state for undo/redo
    const beforeState = {
      scheduledDate: task.scheduledDate || null,
      scheduledStartTime: task.scheduledStartTime || null,
      scheduledEndTime: task.scheduledEndTime || null,
      includeTime: task.includeTime || false,
      status: task.status
    };
    
    // Create updated task data
    const taskUpdateData: any = {};
    
    // Format the time in HH:MM format
    const formattedTime = newTime.toTimeString().substring(0, 5);
    
    if (direction === 'top') {
      // Update start time
      taskUpdateData.scheduledStartTime = formattedTime;
    } else {
      // Update end time
      taskUpdateData.scheduledEndTime = formattedTime;
    }
    
    // Capture the after state for undo/redo
    const afterState = {
      ...beforeState,
      scheduledStartTime: direction === 'top' ? formattedTime : beforeState.scheduledStartTime,
      scheduledEndTime: direction === 'bottom' ? formattedTime : beforeState.scheduledEndTime
    };
    
    // Add to undo stack before making the change
    const undoRedoAction: UndoRedoState = {
      taskId: task.id,
      beforeState,
      afterState
    };
    
    setUndoStack(prev => [...prev, undoRedoAction]);
    // Clear redo stack when new action is performed
    setRedoStack([]);
    
    // Update the task
    updateTask(task.id, taskUpdateData).catch(error => {
      console.error('Failed to resize task:', error);
      // Remove the action from undo stack if update failed
      setUndoStack(prev => prev.slice(0, -1));
    });
  }, [calendarEvents, tasks, updateTask]);

  const handleEventResizeMove = (taskIdx: number, direction: 'top' | 'bottom', newTime: Date) => {
    // Handle task events
    const task = tasks[taskIdx];
    if (!task) return;

    // Update the task preview without saving
    const updatedTask: Partial<Task> = {};
    
    if (direction === 'top') {
      updatedTask.scheduledStartTime = newTime.toTimeString().substring(0, 5);
    } else {
      updatedTask.scheduledEndTime = newTime.toTimeString().substring(0, 5);
    }
    
    // Update the task in the store temporarily for preview
    updateTaskLocally(taskIdx, updatedTask);
  }

  // Old drag functions - removed since we have new drag-to-create system in DayView/WeekView

  // Old drag logic - removed since we have new drag-to-create system

  // Old drag event listeners - removed since we have new drag-to-create system

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="calendar-main-container flex flex-col h-full bg-background-primary dark:bg-[#141414]">
        {/* Calendar Controls */}
        <div className="calendar-header h-16 border-b border-border px-4 flex items-center justify-between bg-background-secondary">
          {/* Left Section - Month/Year and Navigation */}
          <div className="flex items-center space-x-4">
            {!isLeftSidebarOpen && (
              <button
                onClick={toggleLeftSidebar}
                className="p-2 mr-2 rounded-md hover:bg-background-primary hover:shadow-sm hover:scale-105 transition-all duration-200 group"
                aria-label="Show Sidebar"
              >
                <div className="w-5 h-5 flex items-center justify-center text-text-secondary group-hover:text-text-primary transition-colors duration-200">
                  <Icon name="menu-line" size={20} />
                </div>
              </button>
            )}
            <div className="flex items-center">
              <button
                onClick={() => handleNavigate('prev')}
                className="p-1.5 rounded-full hover:bg-background-container text-text-secondary hover:text-text-primary"
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-arrow-left-s-line" />
                </div>
              </button>
              <button
                onClick={() => handleNavigate('next')}
                className="p-1.5 rounded-full hover:bg-background-container text-text-secondary hover:text-text-primary"
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="ri-arrow-right-s-line" />
                </div>
              </button>
            </div>
            <DeepFocusSwitch 
              size="medium" 
              showLabel={false} 
              showPageTitle={true} 
              pageTitle={format(currentDate, 'MMMM yyyy')}
            />
          </div>

          {/* Right Section - View Controls and Navigation Icons */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => handleNavigate('today')}
              className="px-4 py-1.5 text-sm font-medium bg-background-secondary border border-border rounded-button text-text-primary hover:bg-background-container"
            >
              Today
            </button>

            <div className="inline-flex rounded-full bg-background-container p-1">
              <button
                type="button"
                onClick={() => setCurrentView('day')}
                className={`inline-flex items-center px-4 py-1.5 text-sm font-medium rounded-full ${currentView === 'day'
                    ? 'bg-background-primary text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                  }`}
              >
                Day
              </button>
              <button
                type="button"
                onClick={() => setCurrentView('week')}
                className={`inline-flex items-center px-4 py-1.5 text-sm font-medium rounded-full ${currentView === 'week'
                    ? 'bg-background-primary text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                  }`}
              >
                Week
              </button>
              <button
                type="button"
                onClick={() => setCurrentView('month')}
                className={`inline-flex items-center px-4 py-1.5 text-sm font-medium rounded-full ${currentView === 'month'
                    ? 'bg-background-primary text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                  }`}
              >
                Month
              </button>
            </div>

            {/* Navigation Icons */}
            <Tooltip text="Pomodoro Timer">
              <button
                className={`p-2 rounded-full !rounded-button whitespace-nowrap text-text-secondary ${location.pathname === '/pomodoro'
                    ? 'bg-background-container text-text-primary'
                    : 'hover:bg-background-container hover:text-text-primary'
                  }`}
                onClick={location.pathname === '/pomodoro' ? undefined : () => navigate('/pomodoro')}
                aria-label={location.pathname === '/pomodoro' ? 'Current page: Pomodoro Timer' : 'Go to Pomodoro Timer'}
              >
                <span className="w-5 h-5 flex items-center justify-center">
                  <Icon name="timer-line" size={20} />
                </span>
              </button>
            </Tooltip>

            <Tooltip text="Task management">
              <button
                className={`p-2 rounded-full !rounded-button whitespace-nowrap text-text-secondary ${location.pathname === '/projects'
                    ? 'bg-background-container text-text-primary'
                    : 'hover:bg-background-container hover:text-text-primary'
                  }`}
                onClick={location.pathname === '/projects' ? undefined : () => navigate('/projects')}
                aria-label={location.pathname === '/projects' ? 'Current page: Task Management' : 'Go to Task Management'}
              >
                <span className="w-5 h-5 flex items-center justify-center">
                  <Icon name="task-line" size={20} />
                </span>
              </button>
            </Tooltip>

            <Tooltip text="Productivity Insights">
              <button
                className={`p-2 rounded-full !rounded-button whitespace-nowrap text-text-secondary ${location.pathname === '/dashboard'
                    ? 'bg-background-container text-text-primary'
                    : 'hover:bg-background-container hover:text-text-primary'
                  }`}
                onClick={location.pathname === '/dashboard' ? undefined : () => navigate('/dashboard')}
                aria-label={location.pathname === '/dashboard' ? 'Current page: Productivity Insights' : 'Go to Productivity Insights'}
              >
                <span className="w-5 h-5 flex items-center justify-center">
                  <Icon name="dashboard-line" size={20} />
                </span>
              </button>
            </Tooltip>

            <Tooltip text="Calendar">
              <button
                className={`p-2 rounded-full !rounded-button whitespace-nowrap text-text-secondary ${location.pathname === '/calendar'
                    ? 'bg-background-container text-text-primary'
                    : 'hover:bg-background-container hover:text-text-primary'
                  }`}
                onClick={location.pathname === '/calendar' ? undefined : () => navigate('/calendar')}
                aria-label={location.pathname === '/calendar' ? 'Current page: Calendar' : 'Go to Calendar'}
              >
                <span className="w-5 h-5 flex items-center justify-center">
                  <Icon name="calendar-line" size={20} />
                </span>
              </button>
            </Tooltip>

            <Tooltip text="Deep Focus">
              <button
                className={`p-2 rounded-full !rounded-button whitespace-nowrap text-text-secondary ${location.pathname === '/deep-focus'
                    ? 'bg-background-container text-text-primary'
                    : 'hover:bg-background-container hover:text-text-primary'
                  }`}
                onClick={location.pathname === '/deep-focus' ? undefined : () => navigate('/deep-focus')}
                aria-label={location.pathname === '/deep-focus' ? 'Current page: Deep Focus' : 'Go to Deep Focus'}
              >
                <span className="w-5 h-5 flex items-center justify-center">
                  <Icon name="brain-line" size={20} />
                </span>
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Calendar Content */}
        <div className="flex-1 overflow-hidden custom-scrollbar">
          {currentView === 'week' && (
            <div className="h-full w-full">
              <ScrollableWeekView
                ref={scrollableWeekViewRef}
                currentDate={currentDate}
                events={allEvents}
                onEventClick={handleEventClick}
                onTimeSlotClick={handleTimeSlotClick}
                onAllDayClick={handleAllDayClick}
                onDragCreate={handleDragCreate}
                onEventDrop={handleEventDrop}
                onEventResize={handleEventResize}
                onEventResizeMove={handleEventResizeMove}
                onDateRangeChange={handleDateRangeChange}
                clearDragIndicator={clearDragIndicator}
              />
            </div>
          )}

          {currentView === 'day' && (
            <DayView
              currentDate={currentDate}
              events={allEvents}
              onEventClick={handleEventClick}
              onTimeSlotClick={handleTimeSlotClick}
              onAllDayClick={handleAllDayClick}
              onDragCreate={handleDragCreate}
              onEventDrop={handleEventDrop}
              clearDragIndicator={clearDragIndicator}
            />
          )}

          {currentView === 'month' && (
            <MonthView
              currentDate={currentDate}
              events={allEvents}
              onEventClick={handleEventClick}
              onDateClick={handleMonthDateClick}
              onEventDrop={handleEventDrop}
              onDayViewClick={(date) => {
                setCurrentDate(date);
                setCurrentView('day');
              }}
            />
          )}
        </div>

        {/* EventDialog removed - using TaskForm for all calendar interactions */}

        {/* Task Form Overlay for editing tasks */}
        {editingTaskId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <TaskForm
                task={editingTaskId === 'new' ? undefined : tasks.find(t => t.id === editingTaskId)}
                onCancel={() => {
                  setEditingTaskId(null);
                  setStoreEditingTaskId(null);
                  setClearDragIndicator(true);
                  setTimeout(() => setClearDragIndicator(false), 100);
                }}
                onSave={() => {
                  setEditingTaskId(null);
                  setStoreEditingTaskId(null);
                  setClearDragIndicator(true);
                  setTimeout(() => setClearDragIndicator(false), 100);
                }}
                isCalendarContext={true}
              />
            </div>
          </div>
        )}

        {/* Task Form Overlay for drag-create */}
        {isDragCreateTaskOpen && dragCreateData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-background-secondary rounded-lg shadow-xl max-w-md w-full mx-4">
              <TaskForm
                initialStartTime={dragCreateData.startTime}
                initialEndTime={dragCreateData.endTime}
                status={dragCreateData.status}
                onCancel={() => {
                  setIsDragCreateTaskOpen(false);
                  setDragCreateData(null);
                  setClearDragIndicator(true);
                  setTimeout(() => setClearDragIndicator(false), 100);
                }}
                onSave={() => {
                  setIsDragCreateTaskOpen(false);
                  setDragCreateData(null);
                  setClearDragIndicator(true);
                  setTimeout(() => setClearDragIndicator(false), 100);
                }}
                isCalendarContext={true}
              />
            </div>
          </div>
        )}

        {/* Task Form Overlay for time slot clicks */}
        {isTimeSlotTaskOpen && timeSlotData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-background-secondary rounded-lg shadow-xl max-w-md w-full mx-4">
              <TaskForm
                initialStartTime={timeSlotData.startTime}
                initialEndTime={timeSlotData.endTime}
                status={timeSlotData.status}
                isAllDay={timeSlotData.isAllDay}
                onCancel={() => {
                  setIsTimeSlotTaskOpen(false);
                  setTimeSlotData(null);
                }}
                onSave={() => {
                  setIsTimeSlotTaskOpen(false);
                  setTimeSlotData(null);
                }}
                isCalendarContext={true}
              />
            </div>
          </div>
        )}
      </div>
    </DndProvider>
  );
};

export default Calendar;