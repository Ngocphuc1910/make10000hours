import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, isSameDay } from 'date-fns';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { CalendarEvent, CalendarView, DragItem, DropResult } from './types';
import WeekView from './WeekView';
import DayView from './DayView';
import MonthView from './MonthView';
// EventDialog import removed - using TaskForm for all calendar interactions

import { useTaskStore } from '../../store/taskStore';
import { mergeEventsAndTasks, calculateNewEventTime, isValidDrop } from './utils';
import TaskForm from '../../components/tasks/TaskForm';

// Old DragState interface - removed since we have new drag-to-create system

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
  // Old drag state - removed since we have new drag-to-create system
  
  // Get tasks and projects from task store
  const { tasks, projects, updateTask, setEditingTaskId: setStoreEditingTaskId } = useTaskStore();
  
  // Merge calendar events with task events
  const allEvents = useMemo(() => {
    return mergeEventsAndTasks(calendarEvents, tasks, projects);
  }, [calendarEvents, tasks, projects]);

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

      switch (event.key.toLowerCase()) {
        case 'd':
          event.preventDefault();
          setCurrentView('day');
          break;
        case 'w':
          event.preventDefault();
          setCurrentView('week');
          break;
        case 'm':
          event.preventDefault();
          setCurrentView('month');
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [editingTaskId, isDragCreateTaskOpen, isTimeSlotTaskOpen]);
  
  const handleNavigate = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setCurrentDate(new Date());
      return;
    }

    const moveDate = direction === 'next' ? 1 : -1;
    switch (currentView) {
      case 'month':
        setCurrentDate(addMonths(currentDate, moveDate));
        break;
      case 'week':
        setCurrentDate(addWeeks(currentDate, moveDate));
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
    
    // Create all-day event times
    const startTime = new Date(date);
    startTime.setHours(0, 0, 0, 0);
    const endTime = new Date(date);
    endTime.setHours(23, 59, 59, 999);
    
    // Determine task status based on whether the scheduled date is today
    const isToday = isSameDay(startTime, new Date());
    const status: 'pomodoro' | 'todo' = isToday ? 'pomodoro' : 'todo';
    
    setTimeSlotData({ startTime, endTime, status, isAllDay: true });
    setIsTimeSlotTaskOpen(true);
  };

  // Old handleSaveEvent - removed since we only use TaskForm now

  const handleEventDrop = useCallback((item: DragItem, dropResult: DropResult) => {
    if (!isValidDrop(item.event, dropResult, allEvents)) {
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

    // Update the event in the appropriate store
    if (item.event.isTask && item.event.taskId) {
      // Handle task updates through task store
      const task = tasks.find(t => t.id === item.event.taskId);
      if (task) {

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

        // Update the task through the task store
        updateTask(task.id, taskUpdateData).catch(error => {
          console.error('Failed to update task scheduling:', error);
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

  // Old drag functions - removed since we have new drag-to-create system in DayView/WeekView

  // Old drag logic - removed since we have new drag-to-create system

  // Old drag event listeners - removed since we have new drag-to-create system

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex flex-col h-full bg-white">
      {/* Calendar Controls */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleNavigate('today')}
            className="px-4 py-1.5 text-sm font-medium bg-white border border-gray-300 rounded-button text-gray-700 hover:bg-gray-50"
          >
            Today
          </button>
          <div className="flex items-center">
            <button
              onClick={() => handleNavigate('prev')}
              className="p-1.5 rounded-full hover:bg-gray-100"
            >
              <div className="w-5 h-5 flex items-center justify-center text-gray-600">
                <i className="ri-arrow-left-s-line" />
              </div>
            </button>
            <button
              onClick={() => handleNavigate('next')}
              className="p-1.5 rounded-full hover:bg-gray-100"
            >
              <div className="w-5 h-5 flex items-center justify-center text-gray-600">
                <i className="ri-arrow-right-s-line" />
              </div>
            </button>
          </div>
          <h2 className="text-lg font-medium text-gray-800">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
        </div>

        <div className="flex items-center">
          <div className="flex bg-gray-100 p-1 rounded-full">
            <button
              onClick={() => setCurrentView('day')}
              className={`px-3 py-1 text-sm rounded-full ${
                currentView === 'day'
                  ? 'bg-primary text-white'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setCurrentView('week')}
              className={`px-3 py-1 text-sm rounded-full ${
                currentView === 'week'
                  ? 'bg-primary text-white'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setCurrentView('month')}
              className={`px-3 py-1 text-sm rounded-full ${
                currentView === 'month'
                  ? 'bg-primary text-white'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              Month
            </button>
          </div>

          <button
            onClick={() => {
              // Clear any existing drag indicators
              setClearDragIndicator(true);
              setTimeout(() => setClearDragIndicator(false), 100);
              
              setEditingTaskId('new');
              setStoreEditingTaskId('new');
            }}
            className="ml-4 px-4 py-1.5 bg-primary text-white text-sm font-medium rounded-button hover:bg-opacity-90 flex items-center"
          >
            <div className="w-4 h-4 flex items-center justify-center mr-1">
              <i className="ri-add-line" />
            </div>
            Add Task
          </button>

          <button className="ml-2 p-2 rounded-full hover:bg-gray-100">
            <div className="w-5 h-5 flex items-center justify-center text-gray-500">
              <i className="ri-settings-4-line" />
            </div>
          </button>

          <button className="ml-2 p-2 rounded-full hover:bg-gray-100">
            <div className="w-5 h-5 flex items-center justify-center text-gray-500">
              <i className="ri-more-2-fill" />
            </div>
          </button>
        </div>
      </div>

      {/* Calendar Content */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        {currentView === 'week' && (
          <WeekView
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
            onDateClick={handleTimeSlotClick}
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
            />
          </div>
        </div>
      )}

      {/* Task Form Overlay for drag-create */}
      {isDragCreateTaskOpen && dragCreateData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
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
            />
          </div>
        </div>
      )}

      {/* Task Form Overlay for time slot clicks */}
      {isTimeSlotTaskOpen && timeSlotData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <TaskForm
              initialStartTime={timeSlotData.startTime}
              initialEndTime={timeSlotData.endTime}
              status={timeSlotData.status}
              onCancel={() => {
                setIsTimeSlotTaskOpen(false);
                setTimeSlotData(null);
                setClearDragIndicator(true);
                setTimeout(() => setClearDragIndicator(false), 100);
              }}
              onSave={() => {
                setIsTimeSlotTaskOpen(false);
                setTimeSlotData(null);
                setClearDragIndicator(true);
                setTimeout(() => setClearDragIndicator(false), 100);
              }}
            />
          </div>
        </div>
      )}
      </div>
    </DndProvider>
  );
};

export default Calendar; 