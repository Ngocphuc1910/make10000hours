import React from 'react';
import { CalendarEvent } from '../types';
import { startOfDay, endOfDay } from 'date-fns';
import { DraggableEvent } from './DraggableEvent';

interface MultiDayEventBarProps {
  event: CalendarEvent;
  dayIndex: number;
  weekStart: Date;
  weekEnd: Date;
  position: { row: number; left: number; width: number };
  onClick?: (event: CalendarEvent) => void;
  sourceView: string;
}

export const MultiDayEventBar: React.FC<MultiDayEventBarProps> = ({
  event,
  dayIndex,
  weekStart,
  weekEnd,
  position,
  onClick,
  sourceView
}) => {
  const DAY_WIDTH = 200; // Match ScrollableWeekView's DAY_WIDTH
  
  // Use the position calculations from calculateMultiDayEventPositions
  const { row, left, width } = position;
  
  // Calculate display boundaries for extension indicators
  const eventStart = new Date(event.displayStart || event.start);
  const eventEnd = new Date(event.displayEnd || event.end);
  const extendsLeft = eventStart < startOfDay(weekStart);
  const extendsRight = eventEnd > endOfDay(weekEnd);
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(event);
  };
  
  return (
    <DraggableEvent
      event={event}
      onClick={onClick}
      sourceView={sourceView}
      className={`
        absolute flex items-center px-2 py-1 text-xs text-white cursor-grab
        transition-all hover:z-20 hover:shadow-lg hover:opacity-90
        select-none font-medium
        ${extendsLeft ? 'rounded-l-none pl-1' : 'rounded-l'}
        ${extendsRight ? 'rounded-r-none pr-1' : 'rounded-r'}
        ${event.isCompleted ? 'calendar-event-completed' : ''}
        ${event.isTask ? 'border-l-2 border-white border-opacity-50' : ''}
      `}
      style={{
        left: `${left * DAY_WIDTH + 4}px`,
        width: `${width * DAY_WIDTH - 8}px`,
        top: `${row * 28 + 4}px`,
        height: '24px',
        backgroundColor: event.color,
        zIndex: 20 + row, // Multi-day events base z-index, single-day events use 30+ to appear on top
        minWidth: `${width * DAY_WIDTH - 8}px`, // Prevent shrinking
        maxWidth: `${width * DAY_WIDTH - 8}px`, // Prevent expanding
      }}
      title={`${event.title}${event.description ? '\n' + event.description : ''}${
        event.project ? '\nProject: ' + event.project : ''
      }${
        event.daySpan && event.daySpan > 1 ? `\nDuration: ${event.daySpan} days` : ''
      }`}
    >
      {/* Left extension indicator */}
      {extendsLeft && (
        <span className="text-white text-xs mr-1 flex-shrink-0" aria-label="Continues from previous week">
          ←
        </span>
      )}
      
      {/* Event title with truncation */}
      <span className={`truncate flex-1 ${event.isCompleted ? 'line-through' : ''}`}>
        {event.title}
      </span>
      
      {/* Right extension indicator */}
      {extendsRight && (
        <span className="text-white text-xs ml-1 flex-shrink-0" aria-label="Continues to next week">
          →
        </span>
      )}
      
    </DraggableEvent>
  );
};

MultiDayEventBar.displayName = 'MultiDayEventBar';