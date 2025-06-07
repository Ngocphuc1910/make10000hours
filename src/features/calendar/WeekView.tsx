import React, { useState, useRef, useCallback } from 'react';
import { format, startOfWeek, addDays, isSameDay, isToday } from 'date-fns';
import { CalendarEvent, DragItem, DropResult } from './types';
import { DraggableEvent } from './components/DraggableEvent';
import { DroppableTimeSlot } from './components/DroppableTimeSlot';

interface WeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onTimeSlotClick?: (date: Date) => void;
  onAllDayClick?: (date: Date) => void;
  onMouseDown?: (e: React.MouseEvent<HTMLElement>) => void;
  onDragCreate?: (start: Date, end: Date) => void;
  onEventDrop?: (item: DragItem, dropResult: DropResult) => void;
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
  onEventDrop
}) => {
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
    
    // Round minutes to nearest 5
    const roundedMinutes = Math.round(minutes / 5) * 5;
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
      top: startY + (parseInt(element.getAttribute('data-hour') || '0') * TIME_SLOT_HEIGHT),
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

    const dayColumnRect = targetDayColumn.getBoundingClientRect();
    const currentY = e.clientY - dayColumnRect.top;
    
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
        top,
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

    // Reset drag state
    setDragState({
      isDragging: false,
      startElement: null,
      startY: 0,
      startTime: null,
      dayIndex: 0
    });
    setDragIndicator({
      visible: false,
      top: 0,
      height: 0,
      startTime: null,
      endTime: null,
      dayIndex: 0
    });
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

  return (
    <div className="flex flex-col h-full">
      {/* Container with unified grid layout */}
      <div className="flex flex-col h-full" style={{ '--scrollbar-width': '15px' } as React.CSSProperties}>
        
        {/* Header */}
        <div className="bg-white sticky top-0 z-20 border-b border-gray-200">
          <div className="grid" style={{ gridTemplateColumns: '64px 1fr', paddingRight: 'var(--scrollbar-width)' }}>
            {/* Time column header */}
            <div className="flex items-center justify-center text-xs text-gray-500 py-3 border-r border-gray-200">
              GMT+07
            </div>
            
            {/* Day headers */}
            <div className="grid grid-cols-7">
              {weekDays.map((day, index) => (
                <div key={index} className={`flex flex-col items-center justify-center py-3 ${index < 6 ? 'border-r border-gray-200' : ''} ${isToday(day) ? 'bg-blue-50' : ''}`}>
                  <div className="text-xs text-gray-500 font-medium mb-1">{format(day, 'EEE').toUpperCase()}</div>
                  <div className={`text-lg font-medium ${isToday(day) ? 'text-primary bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center' : 'text-gray-800'}`}>
                    {format(day, 'd')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* All Day Row */}
        <div className="bg-white border-b border-gray-200">
          <div className="grid" style={{ gridTemplateColumns: '64px 1fr', paddingRight: 'var(--scrollbar-width)' }}>
            <div className="flex items-center justify-center text-xs text-gray-500 py-2 border-r border-gray-200">
              All day
            </div>
            <div className="grid grid-cols-7">
              {weekDays.map((day, index) => (
                <DroppableTimeSlot
                  key={index}
                  date={day}
                  isAllDay={true}
                  onDrop={onEventDrop!}
                  className={`min-h-[40px] cursor-pointer hover:bg-gray-50 transition-colors p-1 relative ${index < 6 ? 'border-r border-gray-200' : ''}`}
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
                        className={`mx-1 mb-1 px-2 py-1 text-xs rounded-md truncate flex items-center ${
                          event.isTask ? 'border-l-2 border-white border-opacity-50' : ''
                        }`}
                      >
                        <div className="flex items-center text-white">
                          {event.isTask && (
                            <i className="ri-task-line text-xs mr-1 opacity-70" />
                          )}
                          {event.title}
                        </div>
                      </DraggableEvent>
                    ))}
                  </div>
                </DroppableTimeSlot>
              ))}
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-auto relative bg-white">
          <div className="grid min-h-[1440px]" style={{ gridTemplateColumns: '64px 1fr' }}>
            {/* Time column */}
            <div className="bg-white border-r border-gray-200">
              {HOURS.map(hour => (
                <div key={hour} className="h-[60px] border-b border-gray-200 flex items-start justify-center pt-1">
                  <span className="text-xs text-gray-500">{format(new Date().setHours(hour, 0), 'HH:mm')}</span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            <div className="grid grid-cols-7" ref={weekGridRef}>
              {weekDays.map((day, dayIndex) => (
                <div key={dayIndex} className={`relative day-column ${dayIndex < 6 ? 'border-r border-gray-200' : ''}`}>
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
                      className="absolute drag-indicator px-2 py-1"
                      style={{
                        top: `${dragIndicator.top}px`,
                        height: `${dragIndicator.height}px`,
                        left: '2px',
                        right: '2px',
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
                      className={`rounded absolute ${
                        event.isTask ? 'border-l-4' : ''
                      }`}
                      style={{
                        ...getEventStyle(event),
                        borderLeftColor: event.isTask ? event.color : undefined
                      }}
                    >
                      <div className="text-xs text-white font-medium px-2 py-1">
                        <div className="flex items-center">
                          {event.isTask && (
                            <i className="ri-task-line text-xs mr-1 opacity-70" />
                          )}
                          <span className="truncate">{event.title}</span>
                        </div>
                        <div className="opacity-80 mt-1">
                          {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}
                        </div>
                        {event.isTask && (
                          <div className="text-xs opacity-70 mt-1 truncate">
                            {event.project}
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
                        top: `${(new Date().getHours() * TIME_SLOT_HEIGHT) + ((new Date().getMinutes() / 60) * TIME_SLOT_HEIGHT)}px`,
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
    </div>
  );
};

export default WeekView;