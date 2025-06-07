import React from 'react';
import { useDrag } from 'react-dnd';
import { CalendarEvent, DragItem } from '../types';
import { formatTimeForDisplay } from '../utils';

interface DraggableEventProps {
  event: CalendarEvent;
  style?: React.CSSProperties;
  onClick?: (event: CalendarEvent) => void;
  children?: React.ReactNode;
  className?: string;
  sourceView?: string;
}

export const DraggableEvent: React.FC<DraggableEventProps> = ({
  event,
  style,
  onClick,
  children,
  className = '',
  sourceView = 'week'
}) => {
  const [{ isDragging }, drag] = useDrag<DragItem, any, { isDragging: boolean }>({
    type: 'event',
    item: {
      type: 'event' as const,
      event,
      sourceDate: event.start,
      sourceView: sourceView as any
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    canDrag: event.isDraggable !== false,
  });



  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(event);
  };



  const eventContent = children || (
    <div className="text-xs text-white font-medium truncate px-2 py-1">
      {!event.isAllDay && (
        <div className="text-[10px] opacity-80">
          {formatTimeForDisplay(event.start)}
        </div>
      )}
      <div className="truncate">{event.title}</div>
    </div>
  );

  return (
    <div
      ref={event.isDraggable !== false ? drag as any : null}
      className={`
        task-item relative rounded cursor-pointer
        ${isDragging ? 'opacity-60 dragging shadow-lg' : 'hover:shadow-md'}
        ${event.isDraggable !== false ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
        ${className}
      `}
      style={{
        backgroundColor: event.color,
        border: isDragging ? `2px solid ${event.color}` : 'none',
        ...style,
      }}
      onClick={handleClick}
    >
      {eventContent}
      {isDragging && (
        <div className="absolute inset-0 bg-white bg-opacity-10 rounded border border-white border-opacity-30" />
      )}
    </div>
  );
}; 