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

export const WeekView: React.FC<WeekViewProps> = ({
  currentDate,
  events,
  onEventClick,
  onTimeSlotClick,
  onAllDayClick,
  onMouseDown,
  onDragCreate,
  onEventDrop,
  clearDragIndicator
}) => {
  const { projects } = useTaskStore();
  const startDate = startOfWeek(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));

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

  // Get last used project color for drag indicator
  const getLastUsedProjectColor = useCallback(() => {
    const lastUsedProjectId = localStorage.getItem('lastUsedProjectId') || 'no-project';
    const lastUsedProject = projects.find(p => p.id === lastUsedProjectId);
    return lastUsedProject?.color || '#EF4444'; // fallback to red
  }, [projects]);

  // Get events for a specific day
  const getDayEvents = (date: Date) => {
    return events.filter(event => 
      isSameDay(event.start, date) && !event.isAllDay
    );
  };

  // Get all-day events for a specific day
  const getAllDayEvents = (date: Date) => {
    return events.filter(event => 
      isSameDay(event.start, date) && event.isAllDay
    );
  };

  // Calculate event position and height
  const getEventStyle = (event: CalendarEvent) => {
    const startHour = event.start.getHours() + (event.start.getMinutes() / 60);
    const endHour = event.end.getHours() + (event.end.getMinutes() / 60);
    const duration = endHour - startHour;

    return {
      position: 'absolute' as const,
      top: `${startHour * TIME_SLOT_HEIGHT}px`,
      height: `${Math.max(duration * TIME_SLOT_HEIGHT, 30)}px`,
      left: '2px',
      right: '2px',
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
      top: startY + (parseInt(element.getAttribute('data-hour') || '0') * TIME_SLOT_HEIGHT) + 100,
      height: 1,
      startTime,
      endTime: startTime,
      dayIndex
    });

    // Prevent text selection during drag
    e.preventDefault();
  }, [calculateTimeFromY]);

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
    
    // Find which hour slot we're in
    const hourSlotIndex = Math.floor(currentY / TIME_SLOT_HEIGHT);
    const hourSlot = targetDayColumn.querySelector(`[data-hour="${hourSlotIndex}"]`) as HTMLElement;
    
    if (hourSlot) {
      const hourSlotRect = hourSlot.getBoundingClientRect();
      const relativeY = e.clientY - hourSlotRect.top;
      const endTime = calculateTimeFromY(hourSlot, relativeY, dragState.dayIndex);
      
      const startTop = dragState.startY + (parseInt(dragState.startElement.getAttribute('data-hour') || '0') * TIME_SLOT_HEIGHT);
      const endTop = currentY;
      
      const top = Math.min(startTop, endTop);
      const height = Math.abs(endTop - startTop);
      
      setDragIndicator(prev => ({
        ...prev,
        top: top + 100, // Add offset for sticky headers
        height: Math.max(height, 30), // Minimum height
        endTime: endTime > dragState.startTime! ? endTime : dragState.startTime!,
        startTime: endTime > dragState.startTime! ? dragState.startTime! : endTime
      }));
    }
  }, [dragState, calculateTimeFromY]);

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
    <div className="flex flex-col h-full bg-white">
      {/* Single scrollable container for perfect alignment */}
      <div className="flex-1 overflow-auto" ref={scrollableRef}>
        <div className="flex min-h-[calc(100vh-120px)]">
          {/* Time column with sticky headers */}
          <div className="w-16 flex-shrink-0 bg-white border-r border-gray-200 sticky left-0 z-20">
            {/* GMT header */}
            <div className="h-[60px] border-b border-gray-200 flex items-center justify-center text-xs text-gray-500 bg-white sticky top-0 z-30">
              GMT+07
            </div>
            {/* All day header */}
            <div className="h-[40px] border-b border-gray-200 flex items-center justify-center text-xs text-gray-500 bg-white sticky top-[60px] z-30">
              All day
            </div>
            {/* Time slots */}
            {HOURS.map(hour => (
              <div key={hour} className="h-[60px] border-b border-gray-200 flex items-start justify-center pt-1">
                <span className="text-xs text-gray-500">{format(new Date().setHours(hour, 0), 'HH:mm')}</span>
              </div>
            ))}
          </div>

          {/* Day columns with sticky headers */}
          <div className="flex-1 week-grid-cols" ref={weekGridRef}>
            {weekDays.map((day, dayIndex) => (
              <div key={dayIndex} className={`relative day-column ${dayIndex < 6 ? 'border-r border-gray-200' : ''}`}>
                {/* Day header - sticky positioned */}
                <div className={`h-[60px] border-b border-gray-200 flex flex-col items-center justify-center py-3 bg-white sticky top-0 z-20 ${isToday(day) ? 'bg-blue-50' : ''}`}>
                  <div className="text-xs text-gray-500 font-medium mb-1">{format(day, 'EEE').toUpperCase()}</div>
                  <div className={`text-lg font-medium ${isToday(day) ? 'text-primary bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center' : 'text-gray-800'}`}>
                    {format(day, 'd')}
                  </div>
                </div>

                {/* All Day Row - sticky positioned */}
                <div className="h-[40px] border-b border-gray-200 bg-white sticky top-[60px] z-20">
                  <DroppableTimeSlot
                    date={day}
                    isAllDay={true}
                    onDrop={onEventDrop!}
                    className="h-full cursor-pointer hover:bg-gray-50 transition-colors p-1 relative"
                  >
                    <div 
                      className="w-full h-full"
                      onClick={() => onAllDayClick?.(day)}
                    >
                      {getAllDayEvents(day).map(event => (
                        <DraggableEvent
                          key={event.id}
                          event={event}
                          onClick={onEventClick}
                          sourceView="week"
                          className={`mx-1 mb-1 px-2 py-1 text-xs rounded-md truncate flex items-center ${
                            event.isTask ? 'border-l-2 border-white border-opacity-50' : ''
                          }`}
                        >
                          <div className="flex items-center text-white">
                            {event.title}
                          </div>
                        </DraggableEvent>
                      ))}
                    </div>
                  </DroppableTimeSlot>
                </div>

                {/* Time slots grid */}
                {HOURS.map(hour => (
                  <DroppableTimeSlot
                    key={hour}
                    date={day}
                    hour={hour}
                    onDrop={onEventDrop!}
                    className="h-[60px] border-b border-gray-200 cursor-cell hover:bg-gray-50 hover:bg-opacity-50 relative"
                  >
                    <div
                      className="w-full h-full"
                      data-day={dayIndex}
                      data-hour={hour}
                      onMouseDown={handleMouseDown}
                      onClick={(e) => {
                        if (e.target === e.currentTarget && !dragState.isDragging) {
                          const clickedDate = new Date(day);
                          clickedDate.setHours(hour);
                          onTimeSlotClick?.(clickedDate);
                        }
                      }}
                    />
                  </DroppableTimeSlot>
                ))}

                {/* Drag indicator for this day */}
                {dragIndicator.visible && dragIndicator.dayIndex === dayIndex && (
                  <div
                    className="absolute rounded pointer-events-none z-20 px-2 py-1"
                    style={{
                      top: `${dragIndicator.top}px`,
                      height: `${dragIndicator.height}px`,
                      left: '2px',
                      right: '2px',
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
                    className={`rounded absolute ${
                      event.isTask ? 'border-l-4' : ''
                    }`}
                    style={{
                      ...getEventStyle(event),
                      top: `${parseFloat(getEventStyle(event).top) + 100}px`, // Offset for sticky headers
                      borderLeftColor: event.isTask ? event.color : undefined
                    }}
                  >
                    <div className="text-xs text-white font-medium px-2 py-1">
                      <div className="flex items-center">
                        <span className="truncate">{event.title}</span>
                      </div>
                      <div className="opacity-80 mt-1">
                        {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}
                      </div>
                      {!event.isTask && event.description && (
                        <div className="text-xs opacity-75 mt-1 truncate">
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
                      top: `${(new Date().getHours() * TIME_SLOT_HEIGHT) + ((new Date().getMinutes() / 60) * TIME_SLOT_HEIGHT) + 100}px`, // Offset for sticky headers
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