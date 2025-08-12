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
import { calculateMonthCellLayout, MonthCellLayout, calculateMonthViewLayout, MonthGlobalLayout } from './utils';

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

  // Calculate optimized layout for all cells with global occupation tracking
  const optimizedCellLayouts = useMemo(() => {
    // First, calculate the global month layout
    const globalLayout = calculateMonthViewLayout(days, events);
    
    // Then calculate individual cell layouts using the global occupation info
    const cellLayouts: { [dayIndex: number]: MonthCellLayout } = {};
    
    days.forEach((day, idx) => {
      // Only pass single-day events to avoid any interference
      const singleDayEvents = events.filter(event => !event.isMultiDay);
      
      // Get occupied rows for this specific day from global layout
      const dayKey = format(day, 'yyyy-MM-dd');
      const occupiedRows = globalLayout.dayOccupationMap[dayKey] || new Set();
      
      // Pass occupied rows to cell layout function for proper gap-filling
      const cellLayout = calculateMonthCellLayout(day, singleDayEvents, new Set(occupiedRows));
      cellLayouts[idx] = cellLayout;
    });
    
    return {
      cellLayouts,
      globalMultiDayLayout: globalLayout.multiDayLayout,
      globalLayout
    };
  }, [events, days]);

  // Keep track of multiday layout for compatibility with existing overlay rendering
  const multiDayEventLayout = useMemo(() => {
    const multiDayEvents = events.filter(event => event.isMultiDay && event.displayStart && event.displayEnd);
    
    if (multiDayEvents.length === 0) {
      return { eventsByWeek: {}, maxRowsByWeek: {} };
    }

    // Group events by weeks they span, using our optimized row assignments
    const eventsByWeek: Record<number, { event: CalendarEvent; startDay: number; endDay: number; row: number }[]> = {};
    const maxRowsByWeek: Record<number, number> = {};

    multiDayEvents.forEach(event => {
      if (!event.displayStart || !event.displayEnd) return;

      const eventStartDay = days.findIndex(day => isSameDay(day, event.displayStart!));
      const eventEndDay = days.findIndex(day => isSameDay(day, event.displayEnd!));
      
      if (eventStartDay === -1) return;
      
      const endDay = eventEndDay === -1 ? days.length - 1 : eventEndDay;
      const startWeekRow = Math.floor(eventStartDay / 7);
      const endWeekRow = Math.floor(endDay / 7);
      
      // Get the row assignment from our optimized layout
      const row = optimizedCellLayouts.globalMultiDayLayout[event.id] || 0;

      // Add event to each week it spans
      for (let weekRow = startWeekRow; weekRow <= endWeekRow; weekRow++) {
        if (!eventsByWeek[weekRow]) {
          eventsByWeek[weekRow] = [];
        }
        
        const weekStartCol = weekRow === startWeekRow ? (eventStartDay % 7) : 0;
        const weekEndCol = weekRow === endWeekRow ? (endDay % 7) : 6;
        
        eventsByWeek[weekRow].push({
          event,
          startDay: weekStartCol,
          endDay: weekEndCol,
          row
        });
        
        // Update max row for this week
        maxRowsByWeek[weekRow] = Math.max(maxRowsByWeek[weekRow] || 0, row);
      }
    });

    return { eventsByWeek, maxRowsByWeek };
  }, [events, days, optimizedCellLayouts]);


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
              // SIMPLIFIED FIX: Use CSS percentage positioning with left offset to match single-day events
              const left = (startDay / 7) * 100 + 0.05; // Ultra-fine-tuned offset for perfect left alignment
              // FIXED WIDTH: Balanced margin for proper alignment with single-day events
              const width = ((endDay - startDay + 1) / 7) * 100 - 0.5; // Reduced margin to bring closer to cell border
              
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
                    paddingLeft: '4px', // Match single-day event left positioning
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
                      
                      // Calculate overflow based on available space, accounting for multi-day events
                      const containerHeight = eventsContainerRefs.current[idx]?.clientHeight || 120;
                      
                      // FIXED: Industry-standard overflow calculation (Google Calendar/Notion pattern)
                      // Multi-day events are overlay decoration - don't affect single-day event overflow
                      const dateNumberSpace = 30; // Space taken by date number
                      const availableEventSpace = containerHeight - dateNumberSpace;
                      const maxSingleDayRows = Math.floor(availableEventSpace / 22);
                      
                      // Reserve space for "+X more" only when there's overflow
                      let visibleEventsCount = maxSingleDayRows;
                      if (eventsToRender.length > maxSingleDayRows) {
                        visibleEventsCount = Math.max(1, maxSingleDayRows - 1); // Reserve 1 row for "+X more"
                      }
                      
                      const hasOverflow = eventsToRender.length > visibleEventsCount;
                      
                      // DEBUG: Log the calculation for cells with many events
                      if (eventsToRender.length > 3 && process.env.NODE_ENV === 'development') {
                        console.log(`📊 Cell ${idx} industry-standard overflow:`, {
                          containerHeight,
                          dateNumberSpace,
                          availableEventSpace,
                          maxSingleDayRows,
                          visibleEventsCount,
                          eventsToRender: eventsToRender.length,
                          hasOverflow,
                          approach: 'Google Calendar/Notion pattern'
                        });
                      }
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
                            (() => {
                              // FINAL FIX: Calculate multi-day events that visually occupy space in this cell
                              const weekIndex = Math.floor(idx / 7);
                              const dayInWeek = idx % 7;
                              const multiDayEventsInCell = multiDayEventLayout.eventsByWeek[weekIndex]?.filter(({ startDay, endDay }) => 
                                dayInWeek >= startDay && dayInWeek <= endDay
                              ) || [];
                              
                              // Position "+X more" below BOTH multi-day events AND single-day events
                              const multiDayOffset = multiDayEventsInCell.length * 22;
                              const singleDayOffset = eventsToShow.length * 22;
                              const totalOffset = multiDayOffset + singleDayOffset + 8;
                              
                              return (
                                <div 
                                  className="absolute w-full"
                                  style={{
                                    // Position after both multi-day and single-day events
                                    top: `${totalOffset}px`,
                                    height: '20px',
                                    left: '4px',
                                    right: '6px',
                                    zIndex: 100 // Ensure "+X more" appears above all events
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
                              );
                            })()
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