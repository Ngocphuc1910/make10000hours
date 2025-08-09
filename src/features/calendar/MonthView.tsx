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
  const [overflowData, setOverflowData] = useState<Record<number, { isOverflowing: boolean; visibleEvents: number; hiddenCount: number }>>({});
  const gridRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);
  const eventsContainerRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Get all days in the month grid (including days from prev/next months)
  const getDaysInMonth = () => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }); // Monday = 1
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  };

  // Get events for a specific day, including multi-day events
  const getEventsForDay = (date: Date) => {
    return events.filter(event => {
      // For multi-day events, check if the day falls within the event's date range
      if (event.isMultiDay && event.displayStart && event.displayEnd) {
        const dayStart = startOfDay(date);
        const eventStart = startOfDay(event.displayStart);
        const eventEnd = endOfDay(event.displayEnd);
        return dayStart >= eventStart && dayStart <= eventEnd;
      }
      
      // For single-day events, check if they occur on this day
      return isSameDay(event.start, date);
    }).sort((a, b) => {
      // Sort all-day events first, then by start time
      if (a.isAllDay && !b.isAllDay) return -1;
      if (!a.isAllDay && b.isAllDay) return 1;
      return a.start.getTime() - b.start.getTime();
    });
  };

  // Get multi-day events that affect a specific day (for space reservation)
  const getMultiDayEventsForDay = (date: Date) => {
    return events.filter(event => {
      if (!event.isMultiDay || !event.displayStart || !event.displayEnd) return false;
      const dayStart = startOfDay(date);
      const eventStart = startOfDay(event.displayStart);
      const eventEnd = endOfDay(event.displayEnd);
      return dayStart >= eventStart && dayStart <= eventEnd;
    });
  };


  // Get color class for event dots
  const getEventDotColor = (color: string) => {
    const colorMap: { [key: string]: string } = {
      '#3B82F6': 'bg-blue-500',
      '#84CC16': 'bg-green-500', 
      '#F59E0B': 'bg-yellow-500',
      '#EF4444': 'bg-red-500',
      '#EC4899': 'bg-pink-500',
      '#BB5F5A': 'bg-red-500'
    };
    return colorMap[color] || 'bg-blue-500';
  };

  // Detect overflow accounting for multi-day events space
  const detectOverflow = useCallback((cellIndex: number, eventsContainer: HTMLDivElement, multiDayEventCount: number) => {
    if (!eventsContainer) {
      return { isOverflowing: false, visibleEvents: 0, hiddenCount: 0 };
    }

    // Always look at ALL single-day events to get accurate count
    const allEventElements = eventsContainer.querySelectorAll('.month-view-event');
    const containerHeight = eventsContainer.clientHeight;
    
    if (containerHeight <= 0) {
      return { isOverflowing: false, visibleEvents: 0, hiddenCount: 0 };
    }
    
    if (allEventElements.length === 0) {
      return { isOverflowing: false, visibleEvents: 0, hiddenCount: 0 };
    }
    
    let visibleEvents = 0;
    let totalHeight = 0;
    
    // Reserve space for multi-day events (22px each: 20px + 2px gap)
    const multiDayReservedHeight = multiDayEventCount * 22;
    
    // Reserve space for "+X more" button (24px)
    const moreButtonHeight = 24;
    const availableHeight = containerHeight - multiDayReservedHeight - moreButtonHeight;
    
    // Calculate which events can fit - use fixed height for consistency
    for (let i = 0; i < allEventElements.length; i++) {
      const eventHeight = 22; // Fixed height: 20px event + 2px gap
      
      if (totalHeight + eventHeight <= availableHeight) {
        visibleEvents++;
        totalHeight += eventHeight;
      } else {
        break;
      }
    }
    
    // If all events fit without needing "+X more", check if we have extra space
    if (visibleEvents === allEventElements.length) {
      const totalHeightWithoutMore = visibleEvents * 22;
      if (totalHeightWithoutMore + multiDayReservedHeight <= containerHeight) {
        // All events fit without "+X more" button
        return { isOverflowing: false, visibleEvents, hiddenCount: 0 };
      }
    }
    
    const totalEvents = allEventElements.length;
    const hiddenCount = Math.max(0, totalEvents - visibleEvents);
    const isOverflowing = hiddenCount > 0;
    
    return { isOverflowing, visibleEvents, hiddenCount };
  }, []);

  const days = getDaysInMonth();
  
  // Calculate number of rows needed (5 or 6)
  const numberOfRows = Math.ceil(days.length / 7);

  // Calculate multi-day event layout with proper row positioning
  const multiDayEventLayout = useMemo(() => {
    const multiDayEvents = events.filter(event => event.isMultiDay && event.displayStart && event.displayEnd);
    
    if (multiDayEvents.length === 0) {
      return { eventsByWeek: {}, maxRowsByWeek: {} };
    }

    // Group events by weeks they span
    const eventsByWeek: Record<number, { event: CalendarEvent; startDay: number; endDay: number; row?: number }[]> = {};
    const maxRowsByWeek: Record<number, number> = {};

    // First pass: group events by week
    multiDayEvents.forEach(event => {
      if (!event.displayStart || !event.displayEnd) return;

      const eventStartDay = days.findIndex(day => isSameDay(day, event.displayStart!));
      const eventEndDay = days.findIndex(day => isSameDay(day, event.displayEnd!));
      
      if (eventStartDay === -1) return;
      
      const endDay = eventEndDay === -1 ? days.length - 1 : eventEndDay;
      const startWeekRow = Math.floor(eventStartDay / 7);
      const endWeekRow = Math.floor(endDay / 7);

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
          endDay: weekEndCol
        });
      }
    });

    // Second pass: assign rows within each week to avoid conflicts
    Object.keys(eventsByWeek).forEach(weekRowStr => {
      const weekRow = parseInt(weekRowStr);
      const weekEvents = eventsByWeek[weekRow];
      
      // Sort by start date, then by duration (longer events get priority)
      weekEvents.sort((a, b) => {
        const startComparison = a.startDay - b.startDay;
        if (startComparison !== 0) return startComparison;
        
        const aDuration = a.endDay - a.startDay;
        const bDuration = b.endDay - b.startDay;
        return bDuration - aDuration; // Longer duration first
      });

      // Assign rows using conflict detection
      const rows: typeof weekEvents[][] = [];
      
      weekEvents.forEach(eventData => {
        let assignedRow = -1;
        
        // Find the first row where this event doesn't conflict
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
          const hasConflict = rows[rowIndex].some(existingEvent => {
            // Check if events overlap in terms of day span
            return !(eventData.endDay < existingEvent.startDay || eventData.startDay > existingEvent.endDay);
          });
          
          if (!hasConflict) {
            assignedRow = rowIndex;
            break;
          }
        }
        
        // If no existing row works, create a new one
        if (assignedRow === -1) {
          assignedRow = rows.length;
          rows.push([]);
        }
        
        // Assign the event to the row
        eventData.row = assignedRow;
        rows[assignedRow].push(eventData);
      });
      
      maxRowsByWeek[weekRow] = Math.max(0, rows.length - 1);
    });

    return { eventsByWeek, maxRowsByWeek };
  }, [events, days]);

  // Helper function to check if a day is the start, middle, or end of a multi-day event
  const getMultiDayEventInfo = (event: CalendarEvent, day: Date) => {
    if (!event.isMultiDay || !event.displayStart || !event.displayEnd) {
      return null;
    }
    
    const isStart = isSameDay(day, event.displayStart);
    const isEnd = isSameDay(day, event.displayEnd);
    const isContinuation = !isStart && !isEnd;
    
    return { isStart, isEnd, isContinuation };
  };

  // Initialize refs arrays
  useEffect(() => {
    cellRefs.current = Array(days.length).fill(null);
    eventsContainerRefs.current = Array(days.length).fill(null);
  }, [days.length]);

  // Overflow detection accounting for multi-day events in each cell
  const debouncedOverflowDetection = useCallback(() => {
    requestAnimationFrame(() => {
      const newOverflowData: Record<number, { isOverflowing: boolean; visibleEvents: number; hiddenCount: number }> = {};
      
      eventsContainerRefs.current.forEach((container, index) => {
        if (container) {
          const weekIndex = Math.floor(index / 7);
          const maxRow = multiDayEventLayout.maxRowsByWeek[weekIndex] || -1;
          const multiDayRowCount = maxRow + 1;
          const overflow = detectOverflow(index, container, multiDayRowCount);
          newOverflowData[index] = overflow;
        }
      });
      
      setOverflowData(prev => {
        // Only update if data has actually changed
        const hasChanged = Object.keys(newOverflowData).some(key => {
          const idx = parseInt(key);
          const prevData = prev[idx];
          const newData = newOverflowData[idx];
          
          return !prevData || 
                 prevData.isOverflowing !== newData.isOverflowing ||
                 prevData.visibleEvents !== newData.visibleEvents ||
                 prevData.hiddenCount !== newData.hiddenCount;
        });
        
        return hasChanged ? { ...prev, ...newOverflowData } : prev;
      });
    });
  }, [detectOverflow, days, getMultiDayEventsForDay]);

  // Simplified ResizeObserver - only measure containers with single-day events
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      // Simple debounced detection on any resize
      debouncedOverflowDetection();
    });

    // Only observe containers that actually contain measurable single-day events
    eventsContainerRefs.current.forEach((container, index) => {
      if (container) {
        container.dataset.cellIndex = index.toString();
        resizeObserver.observe(container);
      }
    });

    return () => resizeObserver.disconnect();
  }, [debouncedOverflowDetection, days.length]);

  // Simple window resize listener
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout;
    
    const handleWindowResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => debouncedOverflowDetection(), 150);
    };

    window.addEventListener('resize', handleWindowResize);
    return () => {
      window.removeEventListener('resize', handleWindowResize);
      if (resizeTimeout) clearTimeout(resizeTimeout);
    };
  }, [debouncedOverflowDetection]);

  const setCellRef = useCallback((element: HTMLDivElement | null, index: number) => {
    cellRefs.current[index] = element;
  }, []);

  const setEventsContainerRef = useCallback((element: HTMLDivElement | null, index: number) => {
    eventsContainerRefs.current[index] = element;
    
    if (element) {
      element.dataset.cellIndex = index.toString();
      
      // Simple initial detection
      setTimeout(() => debouncedOverflowDetection(), 50);
    }
  }, [debouncedOverflowDetection]);

  // Simple component update detection
  useEffect(() => {
    const timer = setTimeout(() => debouncedOverflowDetection(), 100);
    return () => clearTimeout(timer);
  }, [events, debouncedOverflowDetection]);

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
              const left = (startDay / 7) * 100;
              const width = ((endDay - startDay + 1) / 7) * 100;
              const top = (weekIndex / numberOfRows) * 100;
              const rowOffset = 30 + (row * 22); // 30px for date numbers + 22px per row (20px + 2px gap)
              
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
                    top: `calc(${top}% + ${rowOffset}px)`,
                    height: '20px',
                    paddingLeft: '4px',
                    paddingRight: '4px',
                    zIndex: 15 + row
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
          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          
          // Use timezone-aware today check
          const userTimezone = user?.settings?.timezone?.current || timezoneUtils.getCurrentTimezone();
          const todayInUserTimezone = timezoneUtils.formatDateInTimezone(new Date(), userTimezone, 'yyyy-MM-dd');
          const dayString = format(day, 'yyyy-MM-dd');
          const isCurrentDay = todayInUserTimezone === dayString;
          
          // Filter events for inline rendering (exclude multi-day events which are in overlay)
          const singleDayAllDayEvents = dayEvents.filter(event => event.isAllDay && !event.isMultiDay);
          const timedEvents = dayEvents.filter(event => !event.isAllDay);
          
          // Events for this cell (no multi-day since they're in overlay)
          const cellEvents = [...singleDayAllDayEvents, ...timedEvents];

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

                {/* Events container with flexible height and proper containment */}
                <div 
                  ref={(el) => setEventsContainerRef(el, idx)}
                  className="flex-1 min-h-0 h-full max-h-full relative overflow-hidden"
                  style={{
                    // Reserve space at top for multi-day events in overlay based on actual rows used
                    paddingTop: `${(() => {
                      const weekIndex = Math.floor(idx / 7);
                      const maxRow = multiDayEventLayout.maxRowsByWeek[weekIndex] || -1;
                      return (maxRow + 1) * 22; // Each row is 22px (20px + 2px gap)
                    })()}px`
                  }}
                >
                  <div className="flex flex-col gap-[2px] h-full relative">
                    {/* Render cell events (single-day and timed events only) */}
                    {cellEvents.map((event, eventIdx) => {
                      const cellOverflow = overflowData[idx];
                      const shouldHide = cellOverflow && eventIdx >= cellOverflow.visibleEvents;
                      
                      // Render all-day events (single-day only, multi-day are in overlay)
                      if (event.isAllDay) {
                        return (
                          <DraggableEvent
                            key={event.id}
                            event={event}
                            onClick={onEventClick}
                            sourceView="month"
                            className={`month-view-event block w-full cursor-grab text-xs px-2 py-1 flex items-center flex-shrink-0 rounded single-day-event ${
                              !isCurrentMonth ? 'opacity-60' : event.isCompleted ? 'calendar-event-completed' : ''
                            } ${shouldHide ? 'hidden' : ''}`}
                            style={{ 
                              backgroundColor: event.color,
                              height: '20px',
                              minHeight: '20px',
                              maxHeight: '20px'
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
                        );
                      }
                      
                      // Render timed events
                      return (
                      
                        <DraggableEvent
                          key={event.id}
                          event={event}
                          onClick={onEventClick}
                          sourceView="month"
                          className={`month-view-event timed-event block hover:bg-background-container rounded px-1 py-0.5 text-xs flex-shrink-0 ${
                            !isCurrentMonth ? 'opacity-60' : event.isCompleted ? 'calendar-event-completed' : ''
                          } ${shouldHide ? 'hidden' : ''}`}
                          style={{ 
                            backgroundColor: 'transparent',
                            height: '20px',
                            minHeight: '20px',
                            maxHeight: '20px'
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
                      );
                    })}
                    
                    {/* Show "+X more" based on overflow detection */}
                    {overflowData[idx]?.isOverflowing && (
                      <div 
                        className={`text-xs cursor-pointer hover:text-primary px-1 py-0.5 flex-shrink-0 ${
                          !isCurrentMonth ? 'text-gray-400 opacity-60' : 'text-gray-600'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDayViewClick?.(day);
                        }}
                      >
                        +{overflowData[idx].hiddenCount} more
                      </div>
                    )}
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