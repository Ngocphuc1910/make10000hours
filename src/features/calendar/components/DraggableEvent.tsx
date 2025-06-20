import React from 'react';
import { useDrag } from 'react-dnd';
import { CalendarEvent, DragItem } from '../types';
import { formatTimeForDisplay, getEventDurationMinutes } from '../utils';

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
  // Use useRef to store alt key state for immediate access during drag
  const altPressedRef = React.useRef(false);
  
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) {
        altPressedRef.current = true;
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.altKey) {
        altPressedRef.current = false;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const [{ isDragging }, drag] = useDrag<DragItem, any, { isDragging: boolean }>({
    type: 'event',
    item: () => {
      const displayDuration = getEventDurationMinutes(event);
      const actualDuration = event.end.getTime() - event.start.getTime();
      
      // Use ref to get current alt key state at drag time
      const isDuplicate = altPressedRef.current;
      
      // Debug logging for zero-duration events
      if (actualDuration === 0) {
        console.log('Creating drag item for zero-duration event:', {
          eventId: event.id,
          actualDuration: actualDuration,
          displayDurationMinutes: displayDuration,
          start: event.start,
          end: event.end
        });
      }
      
      if (isDuplicate) {
        console.log('🔄 Alt+Drag detected - will duplicate task:', event.title, 'in view:', sourceView, 'isAllDay:', event.isAllDay);
      }
      
      return {
        type: 'event' as const,
        event,
        sourceDate: event.start,
        sourceView: sourceView as any,
        displayDurationMinutes: displayDuration,
        isDuplicate: isDuplicate
      };
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

  // Only toggle duplicate mode when Alt/Option is actually held.
  // For some OS/browser combinations (notably macOS), `e.altKey` may be
  // reported as `false` for all-day cells even when the key is physically
  // pressed.  Overwriting the ref with that `false` value clears the flag
  // and prevents duplication.  Instead, we only set the flag to `true` when
  // the modifier is detected and otherwise leave the previous value intact –
  // it will be reset by the global `keyup` listener.
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.altKey) {
      altPressedRef.current = true;
    }
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
        task-item relative rounded cursor-pointer transition-all duration-200
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
      onMouseDown={handleMouseDown}
    >
      {eventContent}
      {isDragging && (
        <div className="absolute inset-0 bg-white bg-opacity-10 rounded border border-white border-opacity-30" />
      )}
    </div>
  );
}; 