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
}

export const MonthView: React.FC<MonthViewProps> = ({
  currentDate,
  events,
  onEventClick,
  onDateClick,
  onEventDrop
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
           style={{ gridTemplateRows: `repeat(${numberOfRows}, minmax(120px, 1fr))` }}>
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
                border-b border-r border-gray-200 p-2 cursor-pointer
                ${!isCurrentMonth ? 'bg-gray-50' : 'bg-white'}
                ${isCurrentDay ? 'bg-primary bg-opacity-5' : ''}
                ${idx % 7 === 6 ? '!border-r-0' : ''}
                ${Math.floor(idx / 7) === numberOfRows - 1 ? '!border-b-0' : ''}
              `}
            >
              <div 
                className="w-full h-full flex flex-col"
                onClick={() => onDateClick?.(day)}
              >
                {/* Date number */}
                <div className={`text-sm ${
                  isCurrentDay 
                    ? 'text-primary font-medium' 
                    : !isCurrentMonth 
                      ? 'text-gray-400' 
                      : 'text-gray-900'
                }`}>
                  {format(day, 'd')}
                </div>

                {/* Events container with fixed max height */}
                <div className="mt-1 max-h-[100px] overflow-hidden">
                  {/* All-day events first - limit to 1 */}
                  {allDayEvents.slice(0, 1).map(event => {
                    return (
                      <DraggableEvent
                        key={event.id}
                        event={event}
                        onClick={onEventClick}
                        sourceView="month"
                        className="month-view-event mb-1 px-2 py-1 rounded block cursor-grab"
                        style={{ 
                          backgroundColor: getAllDayEventBg(event.color || '#3B82F6'),
                          border: 'none'
                        }}
                      >
                        <div className="text-xs font-medium truncate flex items-center" title={event.title} style={{ color: getAllDayEventText(event.color || '#3B82F6') }}>
                          {event.title}
                        </div>
                      </DraggableEvent>
                    );
                  })}

                  {/* Timed events with proper spacing */}
                  <div className="space-y-1">
                    {timedEvents.slice(0, 4).map(event => (
                      <DraggableEvent
                        key={event.id}
                        event={event}
                        onClick={onEventClick}
                        sourceView="month"
                        className="month-view-event text-xs block hover:bg-gray-50 rounded px-1 py-0.5 min-h-[16px]"
                        style={{ backgroundColor: 'transparent' }}
                      >
                        <div className="flex items-center w-full text-gray-900 leading-tight" title={`${format(event.start, 'h:mm a')} ${event.title}`}>
                          <span 
                            className="inline-block w-2 h-2 rounded-full mr-1 flex-shrink-0 mt-0.5" 
                            style={{ backgroundColor: event.color }}
                          ></span>
                          <span className="truncate text-xs">
                            {format(event.start, 'h:mm a')} {event.title}
                          </span>
                        </div>
                      </DraggableEvent>
                    ))}
                    
                    {/* Show "X more" if there are additional events */}
                    {(timedEvents.length > 4 || allDayEvents.length > 1) && (
                      <div className="text-xs text-gray-600 font-medium cursor-pointer hover:text-primary px-1 py-0.5">
                        {Math.max(
                          timedEvents.length - 4,
                          allDayEvents.length - 1
                        )} more
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
  );
};

export default MonthView; 