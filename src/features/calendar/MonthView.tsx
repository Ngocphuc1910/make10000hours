import React from 'react';
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



  const days = getDaysInMonth();
  
  // Calculate number of rows needed (5 or 6)
  const numberOfRows = Math.ceil(days.length / 7);
  
  // Determine if we need scrolling (6 rows) or not (5 rows)
  const needsScrolling = numberOfRows === 6;
  const rowHeight = needsScrolling ? 140 : 'auto'; // Fixed height for 6 rows, flexible for 5

  return (
    <div className="w-full bg-background-primary h-full flex flex-col">
      {/* Week day headers - Sticky */}
      <div className="grid grid-cols-7 border-b border-border bg-background-primary sticky top-0 z-10">
        {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => (
          <div
            key={day}
            className="py-2 text-center text-sm font-medium text-text-secondary"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid container - Scrollable for 6 rows */}
      <div className={`flex-1 ${needsScrolling ? 'overflow-auto' : 'overflow-hidden'}`}>
        <div 
          className="grid grid-cols-7 border-l border-t border-border"
          style={{ 
            gridTemplateRows: needsScrolling 
              ? `repeat(${numberOfRows}, ${rowHeight}px)` 
              : `repeat(${numberOfRows}, minmax(140px, 1fr))`,
            minHeight: needsScrolling ? `${numberOfRows * 140}px` : '100%'
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
                border-b border-r border-border p-1 cursor-pointer transition-colors
                ${!isCurrentMonth 
                  ? 'bg-background-secondary/30 text-text-secondary' 
                  : isCurrentDay 
                    ? 'bg-primary/5 text-text-primary' 
                    : 'bg-background-primary text-text-primary hover:bg-background-container/50'
                }
              `}
            >
              <div 
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

                {/* Events container with flexible height */}
                <div className="flex-1 min-h-0">
                  {(() => {
                    // Show max 4 events with priority: all-day events first, then timed events
                    const maxVisibleEvents = 4;
                    const eventsToShow: CalendarEvent[] = [];
                    const totalEvents = allDayEvents.length + timedEvents.length;
                    
                    // Add all-day events first (up to max limit)
                    const allDayToShow = allDayEvents.slice(0, maxVisibleEvents);
                    eventsToShow.push(...allDayToShow);
                    
                    // Add timed events only if we have remaining slots
                    const remainingSlots = maxVisibleEvents - eventsToShow.length;
                    if (remainingSlots > 0) {
                      const timedToShow = timedEvents.slice(0, remainingSlots);
                      eventsToShow.push(...timedToShow);
                    }
                    
                    const remainingEvents = totalEvents - eventsToShow.length;
                    
                    return (
                      <>
                        <div className="space-y-4">
                          {eventsToShow.map((event, eventIdx) => {
                            if (event.isAllDay) {
                              return (
                                <DraggableEvent
                                  key={event.id}
                                  event={event}
                                  onClick={onEventClick}
                                  sourceView="month"
                                  className={`month-view-event block w-full cursor-grab rounded text-xs px-2 py-1 h-5 flex items-center ${
                                    !isCurrentMonth ? 'opacity-60' : ''
                                  }`}
                                  style={{ 
                                    backgroundColor: event.color
                                  }}
                                >
                                  <div 
                                    className="font-medium truncate leading-tight w-full text-white" 
                                    title={event.title}
                                  >
                                    {event.title}
                                  </div>
                                </DraggableEvent>
                              );
                            } else {
                              return (
                                <DraggableEvent
                                  key={event.id}
                                  event={event}
                                  onClick={onEventClick}
                                  sourceView="month"
                                  className={`month-view-event block hover:bg-background-container rounded px-1 py-0.5 min-h-[16px] text-xs ${
                                    !isCurrentMonth ? 'opacity-60' : ''
                                  }`}
                                  style={{ backgroundColor: 'transparent' }}
                                >
                                  <div className={`flex items-center w-full leading-tight ${
                                    !isCurrentMonth ? 'text-text-secondary' : 'text-text-primary'
                                  }`}>
                                    <span 
                                      className="inline-block w-1.5 h-1.5 rounded-full mr-1 flex-shrink-0" 
                                      style={{ backgroundColor: event.color }}
                                    ></span>
                                    <span className="truncate">
                                      {format(event.start, 'h:mm a')} {event.title}
                                    </span>
                                  </div>
                                </DraggableEvent>
                              );
                            }
                          })}
                        </div>
                        
                        {/* Show "X more" if there are additional events */}
                        {remainingEvents > 0 && (
                          <div 
                            className={`text-xs font-medium cursor-pointer hover:text-primary hover:bg-background-container px-1 py-0.5 rounded min-h-[16px] flex items-center mt-1 ${
                              !isCurrentMonth ? 'text-text-secondary/70 opacity-60' : 'text-text-secondary'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onDayViewClick?.(day);
                            }}
                          >
                            +{remainingEvents} more
                          </div>
                        )}
                      </>
                    );
                  })()}
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