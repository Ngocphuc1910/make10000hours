import React from 'react';
import { CalendarEvent } from '../types';
import { differenceInDays, startOfWeek, endOfWeek, startOfDay, endOfDay } from 'date-fns';

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
    <div
      className={`
        absolute flex items-center px-2 py-1 text-xs text-white cursor-pointer
        transition-all hover:z-20 hover:shadow-lg hover:opacity-90
        select-none
        ${extendsLeft ? 'rounded-l-none pl-1' : 'rounded-l'}
        ${extendsRight ? 'rounded-r-none pr-1' : 'rounded-r'}
        ${event.isCompleted ? 'opacity-60 line-through' : ''}
      `}
      style={{
        left: `${left * DAY_WIDTH + 4}px`,
        width: `${width * DAY_WIDTH - 8}px`,
        top: `${row * 28 + 4}px`,
        height: '24px',
        backgroundColor: event.color,
        zIndex: 10 - row, // Higher rows have lower z-index
      }}
      onClick={handleClick}
      title={`${event.title}${event.description ? '\\n' + event.description : ''}${
        event.project ? '\\nProject: ' + event.project : ''
      }${
        event.daySpan && event.daySpan > 1 ? `\\nDuration: ${event.daySpan} days` : ''
      }`}
    >
      {/* Left extension indicator */}
      {extendsLeft && (
        <span className="text-white text-xs mr-1 flex-shrink-0" aria-label="Continues from previous week">
          ←
        </span>
      )}
      
      {/* Event title with truncation */}
      <span className="truncate flex-1 font-medium">
        {event.title}
      </span>
      
      {/* Right extension indicator */}
      {extendsRight && (
        <span className="text-white text-xs ml-1 flex-shrink-0" aria-label="Continues to next week">
          →
        </span>
      )}
      
      {/* Completion indicator */}
      {event.isCompleted && (
        <span className="text-white text-xs ml-1 flex-shrink-0" aria-label="Completed">
          ✓
        </span>
      )}
    </div>
  );
};

MultiDayEventBar.displayName = 'MultiDayEventBar';