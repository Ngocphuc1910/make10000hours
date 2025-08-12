import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  startOfDay,
  endOfDay
} from 'date-fns';
import { CalendarEvent, DragItem, DropResult } from './types';
import { DraggableEvent } from './components/DraggableEvent';
import { DroppableTimeSlot } from './components/DroppableTimeSlot';
import { useUserStore } from '../../store/userStore';
import { timezoneUtils } from '../../utils/timezoneUtils';
import { calculateMonthCellLayout, MonthCellLayout, calculateMonthViewLayout, MonthGlobalLayout, calculateOptimizedEventLayout, calculateMonthOptimizedLayout, calculateUnifiedMonthLayout, UnifiedMonthLayout } from './utils';

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onDateClick?: (date: Date) => void;
  onEventDrop?: (item: DragItem, dropResult: DropResult) => void;
  onDayViewClick?: (date: Date) => void;
}

export const MonthView: React.FC<MonthViewProps> = ({
  currentDate,
  events,
  onEventClick,
  onDateClick,
  onEventDrop,
  onDayViewClick
}) => {
  const { user } = useUserStore();
  const gridRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);
  const eventsContainerRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Get all days in the month grid (including days from prev/next months)
  const getDaysInMonth = () => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }); // Monday = 1
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  };




  const days = getDaysInMonth();
  
  // Calculate number of rows needed (5 or 6)
  const numberOfRows = Math.ceil(days.length / 7);

  // Calculate optimized layout using unified algorithm based on proven week view pattern
  const unifiedLayout = useMemo(() => {
    // Performance monitoring for algorithm execution
    const startTime = performance.now();
    const result = calculateUnifiedMonthLayout(days, events);
    const executionTime = performance.now() - startTime;
    
    // Log performance metrics for monitoring (only in development)
    if (process.env.NODE_ENV === 'development' && events.length > 0) {
      console.log(`🎯 Unified algorithm performance:`, {
        executionTime: `${executionTime.toFixed(2)}ms`,
        events: events.length,
        days: days.length,
        totalRows: result.totalRows,
        multiDayEvents: result.multiDayEvents.length,
        singleDayEvents: result.singleDayEvents.length,
        efficiency: `${((result.multiDayEvents.length + result.singleDayEvents.length) / result.totalRows * 100).toFixed(1)}% space utilization`,
        algorithm: 'unified (week-view pattern)'
      });
    }
    
    return result;
  }, [events, days]);
  
  // Convert unified layout to compatible format for existing rendering system
  const optimizedCellLayouts = useMemo(() => {
    // Create cell layouts compatible with existing rendering system
    const cellLayouts: { [dayIndex: number]: MonthCellLayout } = {};
    const globalMultiDayLayout: { [eventId: string]: number } = {};
    
    // Map multi-day events to their rows (compatible with existing row-based system)
    unifiedLayout.multiDayEvents.forEach(({ event, position }) => {
      globalMultiDayLayout[event.id] = position.row;
    });
    
    // Create cell layouts for each day
    days.forEach((day, idx) => {
      // Get single-day events for this specific day
      const singleDayEventsForDay = unifiedLayout.singleDayEvents
        .filter(({ position }) => position.dayIndex === idx)
        .map(({ event, position }) => ({ event, row: position.row }));
      
      cellLayouts[idx] = {
        singleDayEvents: singleDayEventsForDay,
        totalRows: Math.max(1, unifiedLayout.totalRows)
      };
    });
    
    return {
      cellLayouts,
      globalMultiDayLayout,
      totalRows: unifiedLayout.totalRows,
      unifiedLayout: unifiedLayout
    };
  }, [unifiedLayout, days]);

  // Convert unified layout to week-based format for existing overlay rendering
  const multiDayEventLayout = useMemo(() => {
    if (unifiedLayout.multiDayEvents.length === 0) {
      return { eventsByWeek: {}, maxRowsByWeek: {} };
    }

    // Convert unified multi-day events to week-based format
    const eventsByWeek: Record<number, { event: CalendarEvent; startDay: number; endDay: number; row: number }[]> = {};
    const maxRowsByWeek: Record<number, number> = {};

    unifiedLayout.multiDayEvents.forEach(({ event, position }) => {
      // Use the pre-calculated week spans from our unified algorithm
      position.weekSpans.forEach(({ week, startCol, endCol }) => {
        if (!eventsByWeek[week]) {
          eventsByWeek[week] = [];
        }
        
        eventsByWeek[week].push({
          event,
          startDay: startCol,
          endDay: endCol,
          row: position.row // Use row from unified layout for compatibility
        });
        
        // Update max row for this week
        maxRowsByWeek[week] = Math.max(maxRowsByWeek[week] || 0, position.row);
      });
    });

    return { eventsByWeek, maxRowsByWeek };
  }, [unifiedLayout]);


  // Initialize refs arrays
  useEffect(() => {
    cellRefs.current = Array(days.length).fill(null);
    eventsContainerRefs.current = Array(days.length).fill(null);
  }, [days.length]);

  const setCellRef = useCallback((element: HTMLDivElement | null, index: number) => {
    cellRefs.current[index] = element;
  }, []);

  const setEventsContainerRef = useCallback((element: HTMLDivElement | null, index: number) => {
    eventsContainerRefs.current[index] = element;
  }, []);

  return (
    <div className="w-full bg-background-primary h-full flex flex-col">
      {/* Week day headers - Sticky */}
      <div className="grid grid-cols-7 border-t border-b border-border bg-background-primary sticky top-0 z-10">
        {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => (
          <div
            key={day}
            className="py-2 text-center text-sm font-medium text-text-secondary"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid container - Always responsive */}
      <div className="flex-1 overflow-hidden">
        <div 
          ref={gridRef}
          className="grid grid-cols-7 border-t border-border h-full relative"
          style={{ 
            gridTemplateRows: `repeat(${numberOfRows}, minmax(140px, 1fr))`
          }}
        >
        
        {/* Multi-day spanning overlay - properly spans across cells with row positioning */}
        <div 
          className="absolute inset-0 pointer-events-none z-10"
          style={{ 
            gridTemplateRows: `repeat(${numberOfRows}, minmax(140px, 1fr))`
          }}
        >
          {/* Render multi-day events with proper row positioning */}
          {Object.entries(multiDayEventLayout.eventsByWeek).map(([weekIndexStr, weekEvents]) => {
            const weekIndex = parseInt(weekIndexStr);
            
            return weekEvents.map(({ event, row, startDay, endDay }) => {
              // SIMPLIFIED FIX: Use CSS percentage positioning for consistency
              const left = (startDay / 7) * 100;
              // FIXED WIDTH: Subtract small margin to prevent clipping of rounded borders
              const width = ((endDay - startDay + 1) / 7) * 100 - 0.3; // Small margin with padding handling alignment
              
              // UNIFIED POSITIONING: Calculate absolute position from grid start
              const cellHeight = 140; // minmax(140px, 1fr) from grid definition
              const dateNumberHeight = 30; // Space reserved for date number
              const eventHeight = 22; // 20px event + 2px gap
              
              const absoluteTop = (weekIndex * cellHeight) + dateNumberHeight + (row * eventHeight);
              const topPercentage = (absoluteTop / (numberOfRows * cellHeight)) * 100;
              
              // Determine rounding style
              const eventStartDay = days.findIndex(day => event.displayStart && isSameDay(day, event.displayStart));
              const eventEndDay = days.findIndex(day => event.displayEnd && isSameDay(day, event.displayEnd));
              const actualEndDay = eventEndDay === -1 ? days.length - 1 : eventEndDay;
              const startWeekRow = Math.floor(eventStartDay / 7);
              const endWeekRow = Math.floor(actualEndDay / 7);
              
              const roundingClass = weekIndex === startWeekRow && weekIndex === endWeekRow ? 'rounded' :
                                  weekIndex === startWeekRow ? 'rounded-l' :
                                  weekIndex === endWeekRow ? 'rounded-r' : 'rounded-none';
              
              return (
                <div
                  key={`${event.id}-week-${weekIndex}`}
                  className="absolute pointer-events-auto"
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    top: `${topPercentage}%`,
                    height: '20px',
                    paddingLeft: '4px',
                    paddingRight: '6px', // Match single-day event right margin
                    zIndex: 10 + row
                  }}
                >
                  <DraggableEvent
                    event={event}
                    onClick={onEventClick}
                    sourceView="month"
                    className={`
                      w-full h-full flex items-center px-2 text-xs text-white cursor-grab
                      ${event.isCompleted ? 'calendar-event-completed' : ''}
                      ${roundingClass}
                    `}
                    style={{
                      backgroundColor: event.color,
                      height: '20px',
                      minHeight: '20px',
                      maxHeight: '20px'
                    }}
                  >
                    <span className={`font-medium truncate leading-tight w-full text-white ${
                      event.isCompleted ? 'line-through' : ''
                    }`} title={event.title}>
                      {weekIndex === startWeekRow ? event.title : '...'}
                    </span>
                  </DraggableEvent>
                </div>
              );
            });
          })}
        </div>
        
        {days.map((day, idx) => {
          const isCurrentMonth = isSameMonth(day, currentDate);
          
          // Use timezone-aware today check
          const userTimezone = user?.settings?.timezone?.current || timezoneUtils.getCurrentTimezone();
          const todayInUserTimezone = timezoneUtils.formatDateInTimezone(new Date(), userTimezone, 'yyyy-MM-dd');
          const dayString = format(day, 'yyyy-MM-dd');
          const isCurrentDay = todayInUserTimezone === dayString;

          return (
            <DroppableTimeSlot
              key={idx}
              date={day}
              isAllDay={true}
              onDrop={onEventDrop!}
              className={`
                month-cell border-r border-b border-border p-1 cursor-pointer transition-colors relative z-0
                ${idx % 7 === 0 ? 'border-l' : ''}
                ${!isCurrentMonth 
                  ? 'bg-background-secondary/30 text-text-secondary' 
                  : isCurrentDay 
                    ? 'bg-primary/5 text-text-primary' 
                    : 'bg-background-primary text-text-primary hover:bg-background-container/50'
                }
              `}
            >
              <div 
                ref={(el) => setCellRef(el, idx)}
                className="w-full h-full flex flex-col min-h-0"
                onClick={() => onDateClick?.(day)}
              >
                {/* Date number */}
                <div className="text-sm mb-1 flex-shrink-0">
                  {isCurrentDay ? (
                    <div className="text-white bg-primary rounded-full w-6 h-6 flex items-center justify-center font-medium">
                      {format(day, 'd')}
                    </div>
                  ) : (
                    <div className={`font-medium ${
                      !isCurrentMonth 
                        ? 'text-text-secondary/70' 
                        : 'text-text-primary'
                    }`}>
                      {format(day, 'd')}
                    </div>
                  )}
                </div>

                {/* Events container with optimized layout */}
                <div 
                  ref={(el) => setEventsContainerRef(el, idx)}
                  className="flex-1 min-h-0 h-full max-h-full relative"
                >
                  <div className="relative h-full">
                    {/* Render events using optimized positioning */}
                    {(() => {
                      const cellLayout = optimizedCellLayouts.cellLayouts[idx];
                      if (!cellLayout) return null;
                      
                      // Only use single-day events for cell-based rendering
                      // Multi-day events are handled by the overlay system
                      const eventsToRender = cellLayout.singleDayEvents;
                      
                      // Sort by row position to ensure proper stacking
                      eventsToRender.sort((a, b) => a.row - b.row);
                      
                      // Calculate overflow based on available space
                      const totalAvailableRows = Math.floor((eventsContainerRefs.current[idx]?.clientHeight || 120) / 22);
                      const visibleEventsCount = Math.max(0, totalAvailableRows - 1); // Reserve 1 row for "+X more" if needed
                      const hasOverflow = eventsToRender.length > visibleEventsCount;
                      const eventsToShow = hasOverflow ? eventsToRender.slice(0, visibleEventsCount) : eventsToRender;
                      const hiddenCount = hasOverflow ? eventsToRender.length - visibleEventsCount : 0;
                      
                      return (
                        <>
                          {/* Render positioned events */}
                          {eventsToShow.map(({ event, row }) => {
                            const isTimedEvent = !event.isAllDay;
                            
                            return (
                              <div
                                key={event.id}
                                className="absolute w-full"
                                style={{
                                  top: `${row * 22 + 8}px`, // Simple offset - multi-day events are in separate overlay
                                  height: '20px',
                                  left: '4px',
                                  right: '6px', // Reduced margin since overflow-hidden removed
                                  zIndex: 30 + row // Higher z-index to appear above multi-day events
                                }}
                              >
                                {isTimedEvent ? (
                                  // Render timed events
                                  <DraggableEvent
                                    event={event}
                                    onClick={onEventClick}
                                    sourceView="month"
                                    className={`month-view-event timed-event block hover:bg-background-container rounded px-1 py-0.5 text-xs ${
                                      !isCurrentMonth ? 'opacity-60' : event.isCompleted ? 'calendar-event-completed' : ''
                                    }`}
                                    style={{ 
                                      backgroundColor: 'transparent',
                                      height: '20px',
                                      width: '100%'
                                    }}
                                  >
                                    <div className={`flex items-center w-full leading-tight ${
                                      !isCurrentMonth ? 'text-text-secondary' : 'text-text-primary'
                                    }`}>
                                      <span 
                                        className="inline-block w-1.5 h-1.5 rounded-full mr-1 flex-shrink-0"
                                        style={{ backgroundColor: event.color }}
                                      ></span>
                                      <span className={`truncate ${event.isCompleted ? 'line-through' : ''}`} style={{
                                        textDecorationColor: event.isCompleted ? (!isCurrentMonth ? 'rgb(156, 163, 175)' : 'rgb(107, 114, 128)') : undefined
                                      }}>
                                        {format(event.start, 'h:mm a')} {event.title}
                                      </span>
                                    </div>
                                  </DraggableEvent>
                                ) : (
                                  // Render single-day all-day events
                                  <DraggableEvent
                                    event={event}
                                    onClick={onEventClick}
                                    sourceView="month"
                                    className={`month-view-event block w-full cursor-grab text-xs px-2 py-1 flex items-center rounded single-day-event ${
                                      !isCurrentMonth ? 'opacity-60' : event.isCompleted ? 'calendar-event-completed' : ''
                                    }`}
                                    style={{ 
                                      backgroundColor: event.color,
                                      height: '20px',
                                      width: '100%'
                                    }}
                                  >
                                    <div 
                                      className={`font-medium truncate leading-tight w-full text-white ${
                                        event.isCompleted ? 'line-through' : ''
                                      }`}
                                      title={event.title}
                                    >
                                      {event.title}
                                    </div>
                                  </DraggableEvent>
                                )}
                              </div>
                            );
                          })}
                          
                          {/* Show "+X more" for overflow */}
                          {hasOverflow && hiddenCount > 0 && (
                            <div 
                              className="absolute w-full"
                              style={{
                                top: `${eventsToShow.length * 22 + 8}px`,
                                height: '20px',
                                left: '4px',
                                right: '6px' // Reduced margin since overflow-hidden removed
                              }}
                            >
                              <div 
                                className={`text-xs cursor-pointer hover:text-primary px-1 py-0.5 ${
                                  !isCurrentMonth ? 'text-gray-400 opacity-60' : 'text-gray-600'
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDayViewClick?.(day);
                                }}
                              >
                                +{hiddenCount} more
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </DroppableTimeSlot>
          );
        })}
        </div>
      </div>
    </div>
  );
};

export default MonthView;