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
    const start = startOfWeek(startOfMonth(currentDate));
    const end = endOfWeek(endOfMonth(currentDate));
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

  // Get background color for all-day events
  const getAllDayEventBg = (color: string) => {
    const colorMap: { [key: string]: string } = {
      '#3B82F6': '#dbeafe', // blue-100
      '#84CC16': '#dcfce7', // green-100
      '#F59E0B': '#fefce8', // yellow-100 
      '#EF4444': '#fee2e2', // red-100
      '#EC4899': '#fdf2f8', // pink-100
      '#BB5F5A': '#fee2e2'  // red-100
    };
    return colorMap[color] || '#dbeafe';
  };

  // Get text color for all-day events
  const getAllDayEventText = (color: string) => {
    const colorMap: { [key: string]: string } = {
      '#3B82F6': '#1e40af', // blue-800
      '#84CC16': '#166534', // green-800
      '#F59E0B': '#92400e', // yellow-800
      '#EF4444': '#991b1b', // red-800 
      '#EC4899': '#be185d', // pink-800
      '#BB5F5A': '#991b1b'  // red-800
    };
    return colorMap[color] || '#1e40af';
  };

  const days = getDaysInMonth();
  
  // Calculate number of rows needed (5 or 6)
  const numberOfRows = Math.ceil(days.length / 7);

  return (
    <div className="w-full bg-white h-full flex flex-col">
      {/* Week day headers */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => (
          <div
            key={day}
            className="py-2 text-center text-sm font-medium text-gray-500"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid - dynamic rows (5 or 6) */}
      <div className="grid grid-cols-7 flex-1 min-h-0"
           style={{ gridTemplateRows: `repeat(${numberOfRows}, minmax(140px, 1fr))` }}>
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
                border-b border-r border-gray-200 p-1 cursor-pointer
                ${!isCurrentMonth ? 'bg-gray-50' : 'bg-white'}
                ${isCurrentDay ? 'bg-primary bg-opacity-5' : ''}
                ${idx % 7 === 6 ? '!border-r-0' : ''}
                ${Math.floor(idx / 7) === numberOfRows - 1 ? '!border-b-0' : ''}
              `}
            >
              <div 
                className="w-full h-full flex flex-col min-h-0"
                onClick={() => onDateClick?.(day)}
              >
                {/* Date number */}
                <div className={`text-sm mb-1 flex-shrink-0 ${
                  isCurrentDay 
                    ? 'text-primary font-medium' 
                    : !isCurrentMonth 
                      ? 'text-gray-400' 
                      : 'text-gray-900'
                }`}>
                  {format(day, 'd')}
                </div>

                {/* Events container with flexible height */}
                <div className="flex-1 min-h-0">
                  {(() => {
                    // Calculate available space for events (roughly 4-5 events max visible)
                    const maxVisibleEvents = 4;
                    const eventsToShow: CalendarEvent[] = [];
                    const totalEvents = allDayEvents.length + timedEvents.length;
                    
                    // Add all-day events first (prioritized)
                    eventsToShow.push(...allDayEvents);
                    
                    // Add timed events next, respecting max visible limit
                    const remainingSlots = maxVisibleEvents - eventsToShow.length;
                    if (remainingSlots > 0) {
                      eventsToShow.push(...timedEvents.slice(0, remainingSlots));
                    }
                    
                    const remainingEvents = totalEvents - eventsToShow.length;
                    
                    return (
                      <>
                        {eventsToShow.map((event, eventIdx) => {
                          if (event.isAllDay) {
                            return (
                              <DraggableEvent
                                key={event.id}
                                event={event}
                                onClick={onEventClick}
                                sourceView="month"
                                className="month-view-event block cursor-grab rounded text-xs px-1.5 py-0.5 min-h-[18px] mb-0.5"
                                style={{ 
                                  backgroundColor: getAllDayEventBg(event.color || '#3B82F6'),
                                  border: 'none'
                                }}
                              >
                                <div 
                                  className="font-medium truncate leading-tight" 
                                  title={event.title} 
                                  style={{ color: getAllDayEventText(event.color || '#3B82F6') }}
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
                                className="month-view-event block hover:bg-gray-50 rounded px-1 py-0.5 min-h-[16px] mb-1"
                                style={{ backgroundColor: 'transparent' }}
                              >
                                <div className="flex items-center w-full text-gray-900 leading-tight text-xs">
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
                        
                        {/* Show "X more" if there are additional events */}
                        {remainingEvents > 0 && (
                          <div 
                            className="text-xs text-gray-500 font-medium cursor-pointer hover:text-primary hover:bg-gray-50 px-1 py-0.5 rounded min-h-[16px] flex items-center"
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
  );
};

export default MonthView; 