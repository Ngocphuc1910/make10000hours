import React, { useState, useRef, useCallback, useMemo } from 'react';
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from 'date-fns';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { CalendarEvent, CalendarView, DragItem, DropResult } from './types';
import WeekView from './WeekView';
import DayView from './DayView';
import MonthView from './MonthView';
import EventDialog from './EventDialog';

import { useTaskStore } from '../../store/taskStore';
import { mergeEventsAndTasks, calculateNewEventTime, isValidDrop } from './utils';
import TaskForm from '../../components/tasks/TaskForm';

interface DragState {
  isDragging: boolean;
  startElement: HTMLElement | null;
  startY: number;
  dragIndicator: HTMLElement | null;
}

export const Calendar: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<CalendarView>('week');
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent>();
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [isAllDayEvent, setIsAllDayEvent] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    startElement: null,
    startY: 0,
    dragIndicator: null
  });
  
  // Get tasks and projects from task store
  const { tasks, projects, updateTask, setEditingTaskId: setStoreEditingTaskId } = useTaskStore();
  
  // Merge calendar events with task events
  const allEvents = useMemo(() => {
    return mergeEventsAndTasks(calendarEvents, tasks, projects);
  }, [calendarEvents, tasks, projects]);
  
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
    // If this is a task event, open task editing instead of event dialog
    if (event.isTask && event.taskId) {
      setEditingTaskId(event.taskId);
      setStoreEditingTaskId(event.taskId);
    } else {
      setSelectedEvent(event);
      setIsAllDayEvent(event.isAllDay);
      setIsEventDialogOpen(true);
    }
  };

  const handleTimeSlotClick = (date: Date) => {
    setSelectedDate(date);
    setSelectedEvent(undefined);
    setIsAllDayEvent(false);
    setIsEventDialogOpen(true);
  };

  const handleAllDayClick = (date: Date) => {
    setSelectedDate(date);
    setSelectedEvent(undefined);
    setIsAllDayEvent(true);
    setIsEventDialogOpen(true);
  };

  const handleSaveEvent = (event: CalendarEvent) => {
    if (selectedEvent) {
      setCalendarEvents(calendarEvents.map(e => e.id === selectedEvent.id ? event : e));
    } else {
      setCalendarEvents([...calendarEvents, event]);
    }
    setIsEventDialogOpen(false);
  };

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

  const calculateTime = useCallback((element: HTMLElement, y: number) => {
    const hour = parseInt(element.getAttribute('data-hour') || '0');
    const rect = element.getBoundingClientRect();
    const minutes = Math.floor((y / rect.height) * 60);
    const roundedMinutes = Math.round(minutes / 5) * 5;
    const totalHours = hour + Math.floor(roundedMinutes / 60);
    const finalMinutes = roundedMinutes % 60;
    return { hour: totalHours, minutes: finalMinutes };
  }, []);

  const formatTime = (hours: number, minutes: number) => {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const handleDragCreate = useCallback((startTime: Date, endTime: Date) => {
    setSelectedDate(startTime);
    setSelectedEvent(undefined);
    setIsAllDayEvent(false);
    setIsEventDialogOpen(true);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('day-column')) {
      setDragState({
        isDragging: true,
        startElement: target,
        startY: e.clientY - target.getBoundingClientRect().top,
        dragIndicator: null
      });

      // Create drag indicator
      const dragIndicator = document.createElement('div');
      dragIndicator.className = 'task-item';
      dragIndicator.style.backgroundColor = '#BB5F5A';
      dragIndicator.style.opacity = '0.7';
      dragIndicator.style.top = `${dragState.startY}px`;
      dragIndicator.style.height = '1px';
      dragIndicator.style.pointerEvents = 'none';
      dragIndicator.style.zIndex = '30';

      const timeDisplay = document.createElement('div');
      timeDisplay.className = 'text-xs text-white font-medium pl-2 pt-1';
      const startTime = calculateTime(target, dragState.startY);
      timeDisplay.textContent = formatTime(startTime.hour, startTime.minutes);
      dragIndicator.appendChild(timeDisplay);

      target.appendChild(dragIndicator);
      setDragState(prevState => ({ ...prevState, dragIndicator }));
    }
  }, [calculateTime]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState.isDragging || !dragState.startElement || !dragState.dragIndicator) return;

    const startElement = dragState.startElement;
    const rect = startElement.getBoundingClientRect();
    const currentY = e.clientY - rect.top;
    
    const top = Math.min(dragState.startY, currentY);
    const height = Math.abs(currentY - dragState.startY);
    
    dragState.dragIndicator.style.top = `${top}px`;
    dragState.dragIndicator.style.height = `${height}px`;

    // Update time display
    const timeDisplay = dragState.dragIndicator.querySelector('div');
    if (timeDisplay) {
      const startTime = calculateTime(startElement, dragState.startY);
      const endTime = calculateTime(startElement, currentY);
      
      if (endTime.hour > startTime.hour || (endTime.hour === startTime.hour && endTime.minutes > startTime.minutes)) {
        timeDisplay.textContent = `${formatTime(startTime.hour, startTime.minutes)} - ${formatTime(endTime.hour, endTime.minutes)}`;
      } else {
        timeDisplay.textContent = `${formatTime(endTime.hour, endTime.minutes)} - ${formatTime(startTime.hour, startTime.minutes)}`;
      }
    }
  }, [calculateTime]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (!dragState.isDragging || !dragState.startElement) return;

    const startElement = dragState.startElement;
    const rect = startElement.getBoundingClientRect();
    const endY = e.clientY - rect.top;

    // Only show dialog if drag distance is significant
    if (Math.abs(endY - dragState.startY) > 10) {
      // Calculate start and end times
      const startTime = calculateTime(startElement, dragState.startY);
      const endTime = calculateTime(startElement, endY);

      // Create new event with drag times
      const newDate = new Date(currentDate);
      const startDate = new Date(newDate);
      startDate.setHours(Math.min(startTime.hour, endTime.hour), Math.min(startTime.minutes, endTime.minutes), 0, 0);
      
      const endDate = new Date(newDate);
      endDate.setHours(Math.max(startTime.hour, endTime.hour), Math.max(startTime.minutes, endTime.minutes), 0, 0);

      setSelectedDate(startDate);
      setSelectedEvent(undefined);
      setIsAllDayEvent(false);
      setIsEventDialogOpen(true);
    }

    // Clean up
    if (dragState.dragIndicator) {
      dragState.dragIndicator.remove();
    }
    
    setDragState(prevState => ({ ...prevState, isDragging: false, startElement: null, dragIndicator: null }));
  }, [calculateTime, currentDate]);

  // Add document event listeners for drag
  React.useEffect(() => {
    if (dragState.isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState.isDragging, handleMouseMove, handleMouseUp]);

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
              setSelectedEvent(undefined);
              setSelectedDate(new Date());
              setIsAllDayEvent(false);
              setIsEventDialogOpen(true);
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
            onMouseDown={handleMouseDown}
            onEventDrop={handleEventDrop}
          />
        )}
        
        {currentView === 'day' && (
          <DayView
            currentDate={currentDate}
            events={allEvents}
            onEventClick={handleEventClick}
            onTimeSlotClick={handleTimeSlotClick}
            onAllDayClick={handleAllDayClick}
            onMouseDown={handleMouseDown}
            onEventDrop={handleEventDrop}
          />
        )}

        {currentView === 'month' && (
          <MonthView
            currentDate={currentDate}
            events={allEvents}
            onEventClick={handleEventClick}
            onDateClick={handleTimeSlotClick}
            onEventDrop={handleEventDrop}
          />
        )}
      </div>

      <EventDialog
        isOpen={isEventDialogOpen}
        onClose={() => setIsEventDialogOpen(false)}
        onSave={handleSaveEvent}
        initialEvent={selectedEvent}
        initialDate={selectedDate}
        isAllDay={isAllDayEvent}
      />

      {/* Task Form Overlay for editing tasks */}
      {editingTaskId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <TaskForm
              task={tasks.find(t => t.id === editingTaskId)}
              onCancel={() => {
                setEditingTaskId(null);
                setStoreEditingTaskId(null);
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