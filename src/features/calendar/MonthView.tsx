import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  isToday
} from 'date-fns';
import { CalendarEvent, DragItem, DropResult } from './types';
import { DraggableEvent } from './components/DraggableEvent';
import { DroppableTimeSlot } from './components/DroppableTimeSlot';

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

  // Get events for a specific day
  const getEventsForDay = (date: Date) => {
    return events.filter(event => 
      isSameDay(event.start, date)
    ).sort((a, b) => {
      // Sort all-day events first, then by start time
      if (a.isAllDay && !b.isAllDay) return -1;
      if (!a.isAllDay && b.isAllDay) return 1;
      return a.start.getTime() - b.start.getTime();
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

  // Detect overflow using Google Calendar's approach - stabilized version
  const detectOverflow = useCallback((cellIndex: number, eventsContainer: HTMLDivElement) => {
    if (!eventsContainer) {
      return { isOverflowing: false, visibleEvents: 0, hiddenCount: 0 };
    }

    // Always look at ALL events to get accurate count
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
    
    // Reserve space for "+X more" button (22px + margin)
    const moreButtonHeight = 24;
    const availableHeight = containerHeight - moreButtonHeight;
    
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
      const totalHeightWithoutMore = visibleEvents * 22; // 20px + 2px gap per event
      if (totalHeightWithoutMore <= containerHeight) {
        // All events fit without "+X more" button
        return { isOverflowing: false, visibleEvents, hiddenCount: 0 };
      }
    }
    
    const totalEvents = allEventElements.length;
    const hiddenCount = Math.max(0, totalEvents - visibleEvents);
    const isOverflowing = hiddenCount > 0;
    
    // Only log for debugging
    if (cellIndex < 2) {
      console.log(`Cell ${cellIndex} overflow:`, {
        containerHeight,
        availableHeight,
        totalEvents,
        visibleEvents,
        hiddenCount,
        isOverflowing
      });
    }
    
    return { isOverflowing, visibleEvents, hiddenCount };
  }, []);

  const days = getDaysInMonth();
  
  // Calculate number of rows needed (5 or 6)
  const numberOfRows = Math.ceil(days.length / 7);

  // Initialize refs arrays
  useEffect(() => {
    cellRefs.current = Array(days.length).fill(null);
    eventsContainerRefs.current = Array(days.length).fill(null);
  }, [days.length]);

  // Debounced overflow detection to prevent infinite loops
  const [isCalculating, setIsCalculating] = useState(false);
  const [forceRecalculation, setForceRecalculation] = useState(0);
  
  const debouncedOverflowDetection = useCallback((force = false) => {
    if (isCalculating && !force) return;
    
    setIsCalculating(true);
    
    // Use requestAnimationFrame to ensure DOM has settled
    requestAnimationFrame(() => {
      const newOverflowData: Record<number, { isOverflowing: boolean; visibleEvents: number; hiddenCount: number }> = {};
      
      // First, temporarily show all events to get accurate measurements
      if (force) {
        console.log('Force recalculation: showing all hidden events');
        eventsContainerRefs.current.forEach((container, index) => {
          if (container) {
            const hiddenEvents = container.querySelectorAll('.month-view-event.hidden');
            console.log(`Cell ${index}: Found ${hiddenEvents.length} hidden events to show`);
            hiddenEvents.forEach(event => {
              (event as HTMLElement).classList.remove('hidden');
            });
          }
        });
      }
      
      // Wait a bit for DOM to update if we forced visibility
      const measureAfterDelay = () => {
        eventsContainerRefs.current.forEach((container, index) => {
          if (container) {
            const overflow = detectOverflow(index, container);
            newOverflowData[index] = overflow;
          }
        });
        
        setOverflowData(prev => {
          // When forcing recalculation, always update
          if (force) {
            console.log('Forced recalculation - updating overflow data', newOverflowData);
            return { ...prev, ...newOverflowData };
          }
          
          // Only update if data has actually changed to prevent unnecessary re-renders
          const hasChanged = Object.keys(newOverflowData).some(key => {
            const idx = parseInt(key);
            const prevData = prev[idx];
            const newData = newOverflowData[idx];
            
            const changed = !prevData || 
                   prevData.isOverflowing !== newData.isOverflowing ||
                   prevData.visibleEvents !== newData.visibleEvents ||
                   prevData.hiddenCount !== newData.hiddenCount;
            
            if (changed && idx < 3) {
              console.log(`Cell ${idx} overflow changed:`, { prev: prevData, new: newData });
            }
            
            return changed;
          });
          
          if (hasChanged) {
            console.log('Overflow data changed - updating state');
            return { ...prev, ...newOverflowData };
          }
          return prev;
        });
        
        setTimeout(() => setIsCalculating(false), 100); // Debounce for 100ms
      };
      
      if (force) {
        setTimeout(measureAfterDelay, 10);
      } else {
        measureAfterDelay();
      }
    });
  }, [detectOverflow, isCalculating]);

  // Set up ResizeObserver for overflow detection
  useEffect(() => {
    let lastSizes: Record<number, { width: number; height: number }> = {};
    
    const resizeObserver = new ResizeObserver((entries) => {
      console.log(`ResizeObserver triggered with ${entries.length} entries`);
      let hasSignificantChange = false;
      
      entries.forEach(entry => {
        const container = entry.target as HTMLDivElement;
        const cellIndex = parseInt(container.dataset.cellIndex || '0');
        const newWidth = entry.contentRect.width;
        const newHeight = entry.contentRect.height;
        
        const lastSize = lastSizes[cellIndex];
        if (lastSize) {
          // Check for significant height changes (more than 20px)
          const heightDiff = Math.abs(newHeight - lastSize.height);
          if (heightDiff > 20) {
            hasSignificantChange = true;
            console.log(`Cell ${cellIndex} significant height change: ${lastSize.height} -> ${newHeight}`);
          }
        } else {
          console.log(`Cell ${cellIndex} first size measurement: ${newWidth}x${newHeight}`);
        }
        
        lastSizes[cellIndex] = { width: newWidth, height: newHeight };
      });
      
      // Force recalculation on significant changes, otherwise use normal debounced detection
      if (hasSignificantChange) {
        console.log('Significant size change detected - forcing recalculation');
        debouncedOverflowDetection(true);
      } else {
        console.log('Normal resize detected - using debounced detection');
        debouncedOverflowDetection(false);
      }
    });

    // Observe all events containers
    eventsContainerRefs.current.forEach((container, index) => {
      if (container) {
        container.dataset.cellIndex = index.toString();
        resizeObserver.observe(container);
        
        // Initialize last size
        const rect = container.getBoundingClientRect();
        lastSizes[index] = { width: rect.width, height: rect.height };
      }
    });

    return () => resizeObserver.disconnect();
  }, [debouncedOverflowDetection, days.length]);

  // Additional window resize listener as fallback with multiple attempts
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout;
    
    const handleWindowResize = () => {
      console.log('Window resized - scheduling recalculation');
      
      // Clear previous timeout
      if (resizeTimeout) clearTimeout(resizeTimeout);
      
      // Try multiple times to ensure recalculation happens
      resizeTimeout = setTimeout(() => {
        console.log('Starting window resize recalculation');
        debouncedOverflowDetection(true);
        
        // Additional attempts to ensure it works
        setTimeout(() => debouncedOverflowDetection(true), 200);
        setTimeout(() => debouncedOverflowDetection(true), 500);
      }, 150);
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
      
      // Delay initial overflow detection to avoid measurement issues
      setTimeout(() => {
        if (eventsContainerRefs.current[index] === element) {
          debouncedOverflowDetection();
        }
      }, 50);
    }
  }, [debouncedOverflowDetection]);

  // Force recalculation when component updates (helps with screen size changes)
  useEffect(() => {
    const timer = setTimeout(() => {
      console.log('Component updated - triggering overflow recalculation');
      debouncedOverflowDetection(false);
    }, 100);
    
    return () => clearTimeout(timer);
  });

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
          className="grid grid-cols-7 border-t border-border h-full"
          style={{ 
            gridTemplateRows: `repeat(${numberOfRows}, minmax(140px, 1fr))`
          }}
        >
        {days.map((day, idx) => {
          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isCurrentDay = isToday(day);
          const allDayEvents = dayEvents.filter(event => event.isAllDay);
          const timedEvents = dayEvents.filter(event => !event.isAllDay);

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
                >
                  <div className="flex flex-col gap-[2px] h-full relative">
                    {/* Render ALL events - let overflow detection handle visibility */}
                    {allDayEvents.map((event, eventIdx) => {
                      const cellOverflow = overflowData[idx];
                      const shouldHide = cellOverflow && eventIdx >= cellOverflow.visibleEvents;
                      
                      return (
                        <DraggableEvent
                          key={event.id}
                          event={event}
                          onClick={onEventClick}
                          sourceView="month"
                          className={`month-view-event block w-full cursor-grab rounded text-xs px-2 py-1 flex items-center flex-shrink-0 ${
                            !isCurrentMonth ? 'opacity-60' : event.isCompleted ? 'calendar-event-completed' : ''
                          } ${shouldHide ? 'hidden' : ''}`}
                          style={{ 
                            backgroundColor: event.color,
                            height: '20px', // Fixed height to prevent compression
                            minHeight: '20px', // Ensure minimum height
                            maxHeight: '20px' // Prevent expansion
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
                    })}
                    
                    {/* Render timed events */}
                    {timedEvents.map((event, eventIdx) => {
                      const adjustedIdx = eventIdx + allDayEvents.length;
                      const cellOverflow = overflowData[idx];
                      const shouldHide = cellOverflow && adjustedIdx >= cellOverflow.visibleEvents;
                      
                      return (
                        <DraggableEvent
                          key={event.id}
                          event={event}
                          onClick={onEventClick}
                          sourceView="month"
                          className={`month-view-event block hover:bg-background-container rounded px-1 py-0.5 text-xs flex-shrink-0 ${
                            !isCurrentMonth ? 'opacity-60' : event.isCompleted ? 'calendar-event-completed' : ''
                          } ${shouldHide ? 'hidden' : ''}`}
                          style={{ 
                            backgroundColor: 'transparent',
                            height: '20px', // Fixed height to prevent compression
                            minHeight: '20px', // Ensure minimum height
                            maxHeight: '20px' // Prevent expansion
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