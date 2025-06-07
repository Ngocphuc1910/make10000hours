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

  // Get color variations for different event types
  const getEventColors = (color: string) => {
    const colorMap: { [key: string]: { bg: string; text: string; dot: string } } = {
      '#3B82F6': { bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500' },
      '#84CC16': { bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500' },
      '#F59E0B': { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500' },
      '#EF4444': { bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500' },
      '#EC4899': { bg: 'bg-pink-100', text: 'text-pink-800', dot: 'bg-pink-500' },
      '#BB5F5A': { bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500' }
    };
    return colorMap[color] || { bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500' };
  };

  const days = getDaysInMonth();

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Week day headers */}
      <div className="grid grid-cols-7 border-b border-gray-200 bg-white sticky top-0 z-10">
        {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(day => (
          <div
            key={day}
            className="py-3 text-center text-sm font-medium text-gray-500 border-r border-gray-200 last:border-r-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid - responsive to fill remaining screen space */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr min-h-0">
        {days.map((day, idx) => {
          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isCurrentDay = isToday(day);

          return (
            <DroppableTimeSlot
              key={idx}
              date={day}
              isAllDay={true}
              onDrop={onEventDrop!}
              className={`
                border-b border-r border-gray-200 p-2 cursor-pointer min-h-[120px] flex flex-col relative
                ${!isCurrentMonth ? 'bg-gray-50' : 'bg-white hover:bg-gray-50'}
                ${isCurrentDay ? 'bg-primary bg-opacity-5' : ''}
                ${idx % 7 === 6 ? 'border-r-0' : ''}
                ${Math.floor(idx / 7) === 5 ? 'border-b-0' : ''}
              `}
            >
              <div 
                className="w-full h-full flex flex-col"
                onClick={() => onDateClick?.(day)}
              >
              {/* Date number */}
              <div className={`text-sm mb-2 flex-shrink-0 ${
                isCurrentDay 
                  ? 'text-primary font-medium' 
                  : !isCurrentMonth 
                    ? 'text-gray-400' 
                    : 'text-gray-900'
              }`}>
                {format(day, 'd')}
              </div>

              {/* Events container - scrollable if needed */}
              <div className="flex-1 overflow-hidden">
                {/* All-day events first */}
                {dayEvents.filter(event => event.isAllDay).slice(0, 1).map(event => {
                  const colors = getEventColors(event.color || '#3B82F6');
                  return (
                    <DraggableEvent
                      key={event.id}
                      event={event}
                      onClick={onEventClick}
                      className={`mb-2 -mx-2 px-2 py-1 ${colors.bg} rounded ${
                        event.isTask ? 'border-l-2 border-opacity-60' : ''
                      }`}
                      style={{
                        borderLeftColor: event.isTask ? event.color : undefined
                      }}
                    >
                      <div className={`text-xs ${colors.text} font-medium truncate flex items-center`} title={event.title}>
                        {event.isTask && (
                          <i className="ri-task-line mr-1 opacity-70" />
                        )}
                        {event.title}
                      </div>
                    </DraggableEvent>
                  );
                })}

                {/* Timed events container */}
                <div className="mt-1 space-y-1">
                  {dayEvents.filter(event => !event.isAllDay).slice(0, 4).map(event => {
                    const colors = getEventColors(event.color || '#3B82F6');
                    return (
                      <DraggableEvent
                        key={event.id}
                        event={event}
                        onClick={onEventClick}
                        className="text-xs mb-1 truncate hover:bg-gray-50 p-1 rounded transition-colors flex items-center"
                      >
                        <div className="flex items-center w-full" title={`${format(event.start, 'h:mm a')} ${event.title}`}>
                          <span className={`inline-block w-2 h-2 rounded-full ${colors.dot} mr-1 flex-shrink-0`}></span>
                          {event.isTask && (
                            <i className="ri-task-line mr-1 opacity-70 flex-shrink-0" />
                          )}
                          <span className="truncate">
                            {format(event.start, 'h:mm a')} {event.title}
                          </span>
                        </div>
                      </DraggableEvent>
                    );
                  })}
                  
                  {/* Show "X more" if there are additional events */}
                  {(dayEvents.filter(event => !event.isAllDay).length > 4 || 
                    dayEvents.filter(event => event.isAllDay).length > 1) && (
                    <div className="text-xs text-gray-600 font-medium">
                      {Math.max(
                        dayEvents.filter(event => !event.isAllDay).length - 4,
                        dayEvents.filter(event => event.isAllDay).length - 1
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