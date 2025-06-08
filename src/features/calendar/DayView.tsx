import React, { useState, useRef, useCallback } from 'react';
import { format, isSameDay, isToday } from 'date-fns';
import { CalendarEvent, DragItem, DropResult } from './types';
import { DraggableEvent } from './components/DraggableEvent';
import { DroppableTimeSlot } from './components/DroppableTimeSlot';
import { useTaskStore } from '../../store/taskStore';

interface DayViewProps {
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
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const TIME_SLOT_HEIGHT = 60; // pixels per hour

export const DayView: React.FC<DayViewProps> = ({
  currentDate,
  events,
  onEventClick,
  onTimeSlotClick,
  onAllDayClick,
  onDragCreate,
  onEventDrop,
  clearDragIndicator
}) => {
  const { projects } = useTaskStore();
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    startElement: null,
    startY: 0,
    startTime: null
  });
  
  const [dragIndicator, setDragIndicator] = useState<{
    visible: boolean;
    top: number;
    height: number;
    startTime: Date | null;
    endTime: Date | null;
  }>({
    visible: false,
    top: 0,
    height: 0,
    startTime: null,
    endTime: null
  });

  const dayColumnRef = useRef<HTMLDivElement>(null);

  // Get last used project color for drag indicator
  const getLastUsedProjectColor = useCallback(() => {
    const lastUsedProjectId = localStorage.getItem('lastUsedProjectId') || 'no-project';
    const lastUsedProject = projects.find(p => p.id === lastUsedProjectId);
    return lastUsedProject?.color || '#EF4444'; // fallback to red
  }, [projects]);

  // Get regular events for the day
  const getDayEvents = () => {
    return events.filter(event => 
      isSameDay(event.start, currentDate) && !event.isAllDay
    );
  };

  // Get all-day events
  const getAllDayEvents = () => {
    return events.filter(event => 
      isSameDay(event.start, currentDate) && event.isAllDay
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

  // Calculate time from Y position
  const calculateTimeFromY = useCallback((element: HTMLElement, y: number): Date => {
    const hour = parseInt(element.getAttribute('data-hour') || '0');
    const rect = element.getBoundingClientRect();
    const minutes = Math.floor((y / rect.height) * 60);
    
    // Round minutes to nearest 15
    const roundedMinutes = Math.round(minutes / 15) * 15;
    const totalMinutes = hour * 60 + roundedMinutes;
    
    const resultDate = new Date(currentDate);
    resultDate.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
    
    return resultDate;
  }, [currentDate]);

  // Handle mouse down on time slots
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    
    const element = e.currentTarget;
    const rect = element.getBoundingClientRect();
    const startY = e.clientY - rect.top;
    const startTime = calculateTimeFromY(element, startY);
    
    setDragState({
      isDragging: true,
      startElement: element,
      startY,
      startTime
    });

    setDragIndicator({
      visible: true,
      top: startY + (parseInt(element.getAttribute('data-hour') || '0') * TIME_SLOT_HEIGHT),
      height: 1,
      startTime,
      endTime: startTime
    });

    // Prevent text selection during drag
    e.preventDefault();
  }, [calculateTimeFromY]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState.isDragging || !dragState.startElement || !dayColumnRef.current) return;

    const dayColumnRect = dayColumnRef.current.getBoundingClientRect();
    const currentY = e.clientY - dayColumnRect.top;
    
    // Find which hour slot we're in
    const hourSlotIndex = Math.floor(currentY / TIME_SLOT_HEIGHT);
    const hourSlot = dayColumnRef.current.querySelector(`[data-hour="${hourSlotIndex}"]`) as HTMLElement;
    
    if (hourSlot) {
      const hourSlotRect = hourSlot.getBoundingClientRect();
      const relativeY = e.clientY - hourSlotRect.top;
      const endTime = calculateTimeFromY(hourSlot, relativeY);
      
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
        startTime: null
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
      startTime: null
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
        endTime: null
      });
    }
  }, [clearDragIndicator]);

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
            
            {/* Day header */}
            <div className={`flex flex-col items-center justify-center py-3 ${isToday(currentDate) ? 'bg-blue-50' : ''}`}>
              <div className="text-xs text-gray-500 font-medium mb-1">{format(currentDate, 'EEE').toUpperCase()}</div>
              <div className={`text-lg font-medium ${isToday(currentDate) ? 'text-primary bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center' : 'text-gray-800'}`}>
                {format(currentDate, 'd')}
              </div>
            </div>
          </div>
        </div>

        {/* All Day Row */}
        <div className="bg-white border-b border-gray-200">
          <div className="grid" style={{ gridTemplateColumns: '64px 1fr', paddingRight: 'var(--scrollbar-width)' }}>
            <div className="flex items-center justify-center text-xs text-gray-500 py-2 border-r border-gray-200">
              All day
            </div>
            <DroppableTimeSlot
              date={currentDate}
              isAllDay={true}
              onDrop={onEventDrop!}
              className="min-h-[40px] cursor-pointer hover:bg-gray-50 transition-colors p-1 relative"
            >
              <div 
                className="w-full h-full"
                onClick={() => onAllDayClick?.(currentDate)}
              >
                {getAllDayEvents().map(event => (
                  <DraggableEvent
                    key={event.id}
                    event={event}
                    onClick={onEventClick}
                    sourceView="day"
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

            {/* Day column */}
            <div className="relative" ref={dayColumnRef}>
              {/* Time slots grid */}
              {HOURS.map(hour => (
                <DroppableTimeSlot
                  key={hour}
                  date={currentDate}
                  hour={hour}
                  onDrop={onEventDrop!}
                  className="h-[60px] border-b border-gray-200 cursor-cell hover:bg-gray-50 hover:bg-opacity-50 relative"
                >
                  <div
                    className="w-full h-full"
                    data-day={0}
                    data-hour={hour}
                    onMouseDown={handleMouseDown}
                    onClick={(e) => {
                      if (e.target === e.currentTarget && !dragState.isDragging) {
                        const clickedDate = new Date(currentDate);
                        clickedDate.setHours(hour);
                        onTimeSlotClick?.(clickedDate);
                      }
                    }}
                  />
                </DroppableTimeSlot>
              ))}

              {/* Drag indicator */}
              {dragIndicator.visible && (
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
              {getDayEvents().map(event => (
                <DraggableEvent
                  key={event.id}
                  event={event}
                  onClick={onEventClick}
                  sourceView="day"
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
              {isToday(currentDate) && (
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default DayView;