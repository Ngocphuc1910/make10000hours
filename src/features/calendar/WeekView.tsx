import React, { useState, useRef, useCallback } from 'react';
import { format, startOfWeek, addDays, isSameDay, isToday } from 'date-fns';
import { CalendarEvent, DragItem, DropResult } from './types';
import { DraggableEvent } from './components/DraggableEvent';
import { DroppableTimeSlot } from './components/DroppableTimeSlot';
import { useTaskStore } from '../../store/taskStore';

interface WeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onTimeSlotClick?: (date: Date) => void;
  onAllDayClick?: (date: Date) => void;
  onMouseDown?: (e: React.MouseEvent<HTMLElement>) => void;
  onDragCreate?: (start: Date, end: Date) => void;
  onEventDrop?: (item: DragItem, dropResult: DropResult) => void;
  onEventResize?: (event: CalendarEvent, direction: 'top' | 'bottom', newTime: Date) => void;
  onEventResizeMove?: (taskIdx: number, direction: 'top' | 'bottom', newTime: Date) => void;
  clearDragIndicator?: boolean;
}

interface DragState {
  isDragging: boolean;
  startElement: HTMLElement | null;
  startY: number;
  startTime: Date | null;
  dayIndex: number;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const TIME_SLOT_HEIGHT = 60; // pixels per hour
const TIME_COLUMN_WIDTH = 64; // 16 * 4 = 64px (w-16)

export const WeekView: React.FC<WeekViewProps> = ({
  currentDate,
  events,
  onEventClick,
  onTimeSlotClick,
  onAllDayClick,
  onMouseDown,
  onDragCreate,
  onEventDrop,
  onEventResize,
  onEventResizeMove,
  clearDragIndicator
}) => {
  const { projects } = useTaskStore();
  const startDate = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday = 1
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));

  // DEBUG: Log all events received by WeekView
  React.useEffect(() => {
    console.log('🎯 WeekView received events:', events.length);
    
    // Check for duplicate events (same taskId but different isAllDay values)
    const taskEvents = events.filter(e => e.isTask && e.taskId);
    const taskEventGroups = taskEvents.reduce((groups, event) => {
      const key = event.taskId!;
      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
      return groups;
    }, {} as Record<string, typeof events>);
    
    Object.entries(taskEventGroups).forEach(([taskId, eventsForTask]) => {
      if (eventsForTask.length > 1) {
        console.log('🚨 DUPLICATE TASK EVENTS DETECTED for taskId:', taskId);
        console.log('Events:', eventsForTask.map(e => ({
          id: e.id,
          title: e.title,
          isAllDay: e.isAllDay,
          start: format(e.start, 'MMM dd HH:mm'),
          end: format(e.end, 'MMM dd HH:mm')
        })));
      }
    });
    
    // Log summary of event types
    const allDayCount = events.filter(e => e.isAllDay).length;
    const timedCount = events.filter(e => !e.isAllDay).length;
    console.log(`📊 Event Summary: ${allDayCount} all-day, ${timedCount} timed`);
  }, [events]);

  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    startElement: null,
    startY: 0,
    startTime: null,
    dayIndex: 0
  });
  
  const [dragIndicator, setDragIndicator] = useState<{
    visible: boolean;
    top: number;
    height: number;
    startTime: Date | null;
    endTime: Date | null;
    dayIndex: number;
  }>({
    visible: false,
    top: 0,
    height: 0,
    startTime: null,
    endTime: null,
    dayIndex: 0
  });

  const weekGridRef = useRef<HTMLDivElement>(null);
  const scrollableRef = useRef<HTMLDivElement>(null);

  // Get dynamic time slot height
  const getTimeSlotHeight = useCallback((): number => {
    if (scrollableRef.current) {
      const containerHeight = scrollableRef.current.offsetHeight;
      return containerHeight / 24; // Divide by 24 hours
    }
    return TIME_SLOT_HEIGHT; // Fallback
  }, []);

  // Get last used project color for drag indicator
  const getLastUsedProjectColor = useCallback(() => {
    const lastUsedProjectId = localStorage.getItem('lastUsedProjectId') || 'no-project';
    const lastUsedProject = projects.find(p => p.id === lastUsedProjectId);
    return lastUsedProject?.color || '#EF4444'; // fallback to red
  }, [projects]);

  // Get events for a specific day
  const getDayEvents = (date: Date) => {
    const dayEvents = events.filter(event => 
      isSameDay(event.start, date) && !event.isAllDay
    );
    
    // DEBUG: Log timed events for this day
    if (dayEvents.length > 0) {
      console.log(`🔍 TIMED Events for ${format(date, 'MMM dd')}:`, dayEvents.map(e => ({
        id: e.id,
        title: e.title,
        isAllDay: e.isAllDay,
        isTask: e.isTask,
        taskId: e.taskId,
        start: format(e.start, 'HH:mm'),
        end: format(e.end, 'HH:mm')
      })));
    }
    
    return dayEvents;
  };

  // Get all-day events for a specific day
  const getAllDayEvents = (date: Date) => {
    const allDayEvents = events.filter(event => 
      isSameDay(event.start, date) && event.isAllDay
    );
    
    // DEBUG: Log all-day events for this day
    if (allDayEvents.length > 0) {
      console.log(`📅 ALL-DAY Events for ${format(date, 'MMM dd')}:`, allDayEvents.map(e => ({
        id: e.id,
        title: e.title,
        isAllDay: e.isAllDay,
        isTask: e.isTask,
        taskId: e.taskId,
        start: format(e.start, 'MMM dd HH:mm'),
        end: format(e.end, 'MMM dd HH:mm')
      })));
    }
    
    return allDayEvents;
  };

  // Calculate the maximum number of all-day events across all days
  const getMaxAllDayEventsCount = () => {
    return Math.max(
      ...weekDays.map(day => getAllDayEvents(day).length),
      1 // Minimum of 1 to ensure some height
    );
  };

  // Calculate all-day row height based on max events
  const getAllDayRowHeight = () => {
    const maxEvents = getMaxAllDayEventsCount();
    return Math.max(40, maxEvents * 26 + 12); // 24px per event + 2px gap + 12px padding
  };

  // Calculate event position and height
  const getEventStyle = (event: CalendarEvent) => {
    const timeSlotHeight = getTimeSlotHeight();
    const startHour = event.start.getHours() + (event.start.getMinutes() / 60);
    const endHour = event.end.getHours() + (event.end.getMinutes() / 60);
    const duration = endHour - startHour;
    
    // For zero-duration events, use 30-minute height for display
    const displayHeight = duration === 0 
      ? timeSlotHeight * 0.5  // 30 minutes = half slot height
      : Math.max(duration * timeSlotHeight, timeSlotHeight * 0.5);

    return {
      position: 'absolute' as const,
      top: `${startHour * timeSlotHeight + 2}px`,
      height: `${displayHeight - 4}px`,
      left: '4px',
      right: '4px',
      backgroundColor: event.color,
      zIndex: 10,
    };
  };

  // Calculate time from Y position and day
  const calculateTimeFromY = useCallback((element: HTMLElement, y: number, dayIndex: number): Date => {
    const hour = parseInt(element.getAttribute('data-hour') || '0');
    const rect = element.getBoundingClientRect();
    const minutes = Math.floor((y / rect.height) * 60);
    
    // Round minutes to nearest 15
    const roundedMinutes = Math.round(minutes / 15) * 15;
    const totalMinutes = hour * 60 + roundedMinutes;
    
    const resultDate = new Date(weekDays[dayIndex]);
    resultDate.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
    
    return resultDate;
  }, [weekDays]);

  // Handle mouse down on time slots
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    
    const element = e.currentTarget;
    const dayIndex = parseInt(element.getAttribute('data-day') || '0');
    const rect = element.getBoundingClientRect();
    const startY = e.clientY - rect.top;
    const startTime = calculateTimeFromY(element, startY, dayIndex);
    
    setDragState({
      isDragging: true,
      startElement: element,
      startY,
      startTime,
      dayIndex
    });

    setDragIndicator({
      visible: true,
      top: startY + (parseInt(element.getAttribute('data-hour') || '0') * getTimeSlotHeight()) + 80 + getAllDayRowHeight(),
      height: 1,
      startTime,
      endTime: startTime,
      dayIndex
    });

    // Prevent text selection during drag
    e.preventDefault();
  }, [calculateTimeFromY, getTimeSlotHeight]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState.isDragging || !dragState.startElement || !weekGridRef.current) return;

    // Get the day column container for the drag day
    const dayColumns = weekGridRef.current.querySelectorAll('.day-column');
    const targetDayColumn = dayColumns[dragState.dayIndex] as HTMLElement;
    
    if (!targetDayColumn) return;

    // Get the time slots container within the day column (excluding headers)
    const timeSlotContainer = targetDayColumn.querySelector('[data-hour="0"]')?.parentElement;
    if (!timeSlotContainer) return;

    const containerRect = timeSlotContainer.getBoundingClientRect();
    const currentY = e.clientY - containerRect.top;
    const timeSlotHeight = getTimeSlotHeight();
    
    // Find which hour slot we're in
    const hourSlotIndex = Math.floor(currentY / timeSlotHeight);
    const hourSlot = targetDayColumn.querySelector(`[data-hour="${hourSlotIndex}"]`) as HTMLElement;
    
    if (hourSlot) {
      const hourSlotRect = hourSlot.getBoundingClientRect();
      const relativeY = e.clientY - hourSlotRect.top;
      const endTime = calculateTimeFromY(hourSlot, relativeY, dragState.dayIndex);
      
      const startTop = dragState.startY + (parseInt(dragState.startElement.getAttribute('data-hour') || '0') * timeSlotHeight);
      const endTop = currentY;
      
      const top = Math.min(startTop, endTop);
      const height = Math.abs(endTop - startTop);
      
      setDragIndicator(prev => ({
        ...prev,
        top: top + 80 + getAllDayRowHeight(), // Add offset for sticky headers
        height: Math.max(height, 30), // Minimum height
        endTime: endTime > dragState.startTime! ? endTime : dragState.startTime!,
        startTime: endTime > dragState.startTime! ? dragState.startTime! : endTime
      }));
    }
  }, [dragState, calculateTimeFromY, getTimeSlotHeight]);

  // Handle mouse up
  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (!dragState.isDragging || !dragIndicator.startTime || !dragIndicator.endTime) {
      setDragState({
        isDragging: false,
        startElement: null,
        startY: 0,
        startTime: null,
        dayIndex: 0
      });
      setDragIndicator(prev => ({ ...prev, visible: false }));
      return;
    }

    // Only create if drag duration is meaningful (at least 15 minutes)
    const durationMs = dragIndicator.endTime.getTime() - dragIndicator.startTime.getTime();
    if (durationMs >= 15 * 60 * 1000) { // 15 minutes
      onDragCreate?.(dragIndicator.startTime, dragIndicator.endTime);
    }

    // Reset drag state but keep indicator visible for task creation
    setDragState({
      isDragging: false,
      startElement: null,
      startY: 0,
      startTime: null,
      dayIndex: 0
    });
    // Don't reset dragIndicator here - let it persist during task creation
  }, [dragState, dragIndicator, onDragCreate]);

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

  // Format time for display
  const formatTimeRange = (start: Date | null, end: Date | null) => {
    if (!start || !end) return '';
    return `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`;
  };

  // React to clearDragIndicator prop changes
  React.useEffect(() => {
    if (clearDragIndicator) {
      setDragIndicator({
        visible: false,
        top: 0,
        height: 0,
        startTime: null,
        endTime: null,
        dayIndex: 0
      });
    }
  }, [clearDragIndicator]);

  return (
    <div className="calendar-week-container flex flex-col h-full w-full bg-background-primary dark:bg-[#141414]">
      {/* Unified Grid Container */}
      <div className="grid grid-cols-8 h-full w-full" style={{ 
        gridTemplateColumns: `${TIME_COLUMN_WIDTH}px repeat(7, minmax(0, 1fr))`,
        gridTemplateRows: 'auto auto 1fr'
      }}>
        
        {/* Fixed Date Headers Row */}
        <div className="calendar-week-header col-span-8 grid grid-cols-subgrid bg-background-primary dark:bg-[#141414] border-b border-border sticky top-0 z-30" style={{ height: '80px' }}>
          {/* GMT header */}
          <div className="border-r border-border flex items-center justify-center text-xs text-text-secondary bg-background-primary dark:bg-[#141414]">
            GMT+07
          </div>
          {/* Day headers */}
          {weekDays.map((day, dayIndex) => (
            <div key={dayIndex} className={`calendar-week-day-header flex flex-col items-center justify-center py-3 bg-background-primary dark:bg-[#141414] min-w-0 ${dayIndex < 6 ? 'border-r border-border' : ''} ${isToday(day) ? 'bg-primary bg-opacity-5' : ''}`}>
              <div className="text-xs text-text-secondary font-medium mb-1">{format(day, 'EEE').toUpperCase()}</div>
              <div className={`text-lg font-medium ${isToday(day) ? 'text-primary bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center' : 'text-text-primary'}`}>
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>

        {/* All Day Events Row */}
        <div className="calendar-week-allday col-span-8 grid grid-cols-subgrid bg-background-primary dark:bg-[#141414] border-b border-border sticky z-30" 
             style={{ 
               height: `${getAllDayRowHeight()}px`,
               top: '80px'
             }}>
          {/* All day label */}
          <div className="border-r border-b border-border flex items-center justify-center text-xs text-text-secondary bg-background-primary dark:bg-[#141414]">
            All day
          </div>
          {/* All day events */}
          {weekDays.map((day, dayIndex) => (
            <div key={dayIndex} className={`relative min-w-0 ${dayIndex < 6 ? 'border-r border-border' : ''}`}>
              <DroppableTimeSlot
                date={day}
                isAllDay={true}
                onDrop={onEventDrop!}
                className="h-full cursor-pointer hover:bg-background-container transition-colors relative"
              >
                <div 
                  className="w-full h-full flex flex-col items-center justify-start px-1 pt-1 pb-2 overflow-hidden"
                  onClick={(e) => {
                    // Only trigger if clicking on empty space
                    if (e.target === e.currentTarget) {
                      onAllDayClick?.(day);
                    }
                  }}
                >
                  {getAllDayEvents(day).map((event, index) => (
                    <div
                      key={event.id}
                      className="flex-shrink-0 relative w-full"
                      style={{ height: '24px', marginBottom: '2px', minWidth: 0 }}
                    >
                      <DraggableEvent
                        event={event}
                        onClick={onEventClick}
                        sourceView="week"
                        className={`absolute inset-0 px-2 py-1 text-xs rounded truncate flex items-center ${
                          event.isTask ? 'border-l-2 border-white border-opacity-50' : ''
                        } ${event.isCompleted ? 'calendar-event-completed' : ''}`}
                        style={{
                          backgroundColor: event.color,
                          position: 'relative',
                          width: '100%',
                          height: '100%'
                        }}
                      >
                        <div className="flex items-center text-white w-full">
                          <span className={`truncate ${event.isCompleted ? 'line-through' : ''}`}>
                            {event.title}
                          </span>
                        </div>
                      </DraggableEvent>
                    </div>
                  ))}
                </div>
              </DroppableTimeSlot>
            </div>
          ))}
        </div>

        {/* Scrollable Content Area */}
        <div className="calendar-scrollable col-span-8 grid grid-cols-subgrid overflow-auto scrollbar-thin bg-background-primary dark:bg-[#141414]" ref={scrollableRef}>
          {/* Time Column for all hours */}
          <div className="calendar-week-time-column bg-background-primary dark:bg-[#141414] border-r border-border flex flex-col">
            {HOURS.map(hour => (
              <div key={hour} className="flex-1 min-h-[60px] border-b border-border flex items-start justify-center pt-1">
                <span className="text-xs text-text-secondary">{format(new Date().setHours(hour, 0), 'HH:mm')}</span>
              </div>
            ))}
          </div>

          {/* Day Columns */}
          <div className="contents" ref={weekGridRef}>
            {weekDays.map((day, dayIndex) => (
              <div key={dayIndex} className={`calendar-week-day-column relative day-column min-w-0 flex flex-col ${dayIndex < 6 ? 'border-r border-border' : ''}`}>
              {/* Time slots grid */}
              {HOURS.map(hour => (
                <DroppableTimeSlot
                  key={hour}
                  date={day}
                  hour={hour}
                  onDrop={onEventDrop!}
                  className="flex-1 min-h-[60px] border-b border-border cursor-cell hover:bg-background-container hover:bg-opacity-50 relative"
                >
                  <div
                    className="w-full h-full"
                    data-day={dayIndex}
                    data-hour={hour}
                    onMouseDown={handleMouseDown}
                    onClick={(e) => {
                      if (e.target === e.currentTarget && !dragState.isDragging) {
                        const clickedDate = new Date(day);
                        clickedDate.setHours(hour, 0, 0, 0); // Set hour and reset minutes/seconds
                        
                        // Show time slot indicator using existing dragIndicator system
                        const startTime = new Date(clickedDate);
                        const endTime = new Date(clickedDate);
                        endTime.setHours(endTime.getHours() + 1); // 1-hour duration
                        
                        setDragIndicator({
                          visible: true,
                          top: hour * getTimeSlotHeight() + 80 + getAllDayRowHeight(),
                          height: getTimeSlotHeight(),
                          startTime,
                          endTime,
                          dayIndex
                        });
                        
                        onTimeSlotClick?.(clickedDate);
                      }
                    }}
                  />
                </DroppableTimeSlot>
              ))}

              {/* Drag indicator for this day */}
              {dragIndicator.visible && dragIndicator.dayIndex === dayIndex && (
                <div
                  className="absolute rounded pointer-events-none z-20 pl-0.5 pr-1 py-1"
                  style={{
                    top: `${dragIndicator.top - 80 - getAllDayRowHeight() + 2}px`,
                    height: `${dragIndicator.height - 4}px`,
                    left: '4px',
                    right: '4px',
                    backgroundColor: getLastUsedProjectColor(),
                    opacity: 0.7,
                  }}
                >
                  <div className="text-xs text-white font-medium">
                    {formatTimeRange(dragIndicator.startTime, dragIndicator.endTime)}
                  </div>
                </div>
              )}

              {/* Events for this day - positioned absolutely */}
              {getDayEvents(day).map(event => (
                <DraggableEvent
                  key={event.id}
                  event={event}
                  onClick={onEventClick}
                  sourceView="week"
                  onResize={onEventResize}
                  onResizeMove={onEventResizeMove}
                  className={`rounded absolute ${
                    event.isTask ? 'border-l-4' : ''
                  } ${event.isCompleted ? 'calendar-event-completed' : ''}`}
                  style={{
                    ...getEventStyle(event),
                    borderLeftColor: event.isTask ? event.color : undefined
                  }}
                >
                  <div className="pl-0.5 pr-1 py-1">
                    <div className={`task-item-title ${event.isCompleted ? 'line-through' : ''}`}>
                      {event.title}
                    </div>
                    <div className="task-item-time">
                      {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}
                    </div>
                    {!event.isTask && event.description && (
                      <div className={`text-xs opacity-75 mt-1 truncate text-white ${event.isCompleted ? 'text-gray-400' : ''}`}>
                        {event.description}
                      </div>
                    )}
                  </div>
                </DraggableEvent>
              ))}

              {/* Current time indicator */}
              {isToday(day) && (
                <div
                  className="current-time-indicator absolute"
                  style={{
                    top: `${(new Date().getHours() * getTimeSlotHeight()) + ((new Date().getMinutes() / 60) * getTimeSlotHeight())}px`,
                    left: 0,
                    right: 0,
                    zIndex: 15,
                  }}
                />
              )}
            </div>
          ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeekView;