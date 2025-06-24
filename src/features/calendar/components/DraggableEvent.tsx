import React, { useState, useRef } from 'react';
import { useDrag } from 'react-dnd';
import { CalendarEvent, DragItem } from '../types';
import { formatTimeForDisplay, getEventDurationMinutes } from '../utils';
import { useTaskStore } from '../../../store/taskStore';

interface DraggableEventProps {
  event: CalendarEvent;
  style?: React.CSSProperties;
  onClick?: (event: CalendarEvent) => void;
  children?: React.ReactNode;
  className?: string;
  sourceView?: string;
  onResize?: (event: CalendarEvent, direction: 'top' | 'bottom', newTime: Date) => void;
  onResizeMove?: (taskIdx: number, direction: 'top' | 'bottom', newTime: Date) => void;
}

export const DraggableEvent: React.FC<DraggableEventProps> = ({
  event,
  style,
  onClick,
  children,
  className = '',
  sourceView = 'week',
  onResize,
  onResizeMove,
}) => {
  // Use useRef to store alt key state for immediate access during drag
  const altPressedRef = React.useRef(false);
  
  // Refs for resize tracking
  const isResizingRef = useRef(false);
  const resizeDirectionRef = useRef<'top' | 'bottom' | null>(null);
  const initialClientYRef = useRef<number>(0);
  const initialEventRef = useRef<CalendarEvent | null>(null);
  
  // State to track if resize handles are hovered
  const [isTopHandleHovered, setIsTopHandleHovered] = useState(false);
  const [isBottomHandleHovered, setIsBottomHandleHovered] = useState(false);
  const [selectedTaskIdx, setSelectedTaskIdx] = useState<number>(-1);
  const [timeoutClick, setTimeoutClick] = useState<NodeJS.Timeout | null>(null);
  // Create a ref to track the latest selectedTaskIdx value
  const selectedTaskIdxRef = useRef<number>(-1);
  const { tasks } = useTaskStore();
  
  // Update the ref whenever selectedTaskIdx changes
  React.useEffect(() => {
    selectedTaskIdxRef.current = selectedTaskIdx;
  }, [selectedTaskIdx]);
  
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

  const [{ isDragging }, drag] = useDrag<DragItem, unknown, { isDragging: boolean }>({
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
        sourceView: sourceView as 'day' | 'week' | 'month',
        displayDurationMinutes: displayDuration,
        isDuplicate: isDuplicate
      };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    canDrag: () => {
      // Disable drag when resizing
      return event.isDraggable !== false && !isResizingRef.current;
    },
  });

  // Function to calculate time from pixel movement
  const calculateTimeFromPixels = (oldMinutes: number, pixelDelta: number, isAllDay: boolean) => {
    if (isAllDay) return 0; // No resize for all-day events
    // Round up to the nearest 5 minutes
    const roundedMinutes = Math.ceil((pixelDelta + oldMinutes) / 5) * 5; // Round to nearest 5 minutes
    return roundedMinutes;
  };

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent, direction: 'top' | 'bottom') => {
    e.stopPropagation(); // Prevent event click
    
    if (event.isAllDay || event.isDraggable === false) return;

    const foundIdx = tasks.findIndex(task => task.id === event.taskId);
    if (foundIdx === -1) return; // Event not found in tasks
    setSelectedTaskIdx(foundIdx);
    // Also update the ref immediately for any handlers that might fire before the effect
    selectedTaskIdxRef.current = foundIdx;
    
    // Set resize state
    isResizingRef.current = true;
    resizeDirectionRef.current = direction;
    initialClientYRef.current = e.clientY;
    initialEventRef.current = { ...event };
    
    // Add document listeners
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };
  
  const handleResizeMove = (e: MouseEvent) => {
    if (!isResizingRef.current || !resizeDirectionRef.current || !initialEventRef.current) return;
    
    // Calculate delta in pixels
    const deltaY = e.clientY - initialClientYRef.current;
    
    // Create new time based on direction
    let newTime = new Date();
    if (resizeDirectionRef.current === 'top') {
      // Adjusting start time - add minutes to original start time
      newTime = new Date(initialEventRef.current.start);
      const newMinutes = calculateTimeFromPixels(newTime.getMinutes(), deltaY, event.isAllDay);
      newTime.setMinutes(newMinutes);
      
      // Ensure new start time isn't after end time
      if (newTime < initialEventRef.current.end) {
        // Use the ref value instead of the state variable
        onResizeMove?.(selectedTaskIdxRef.current, 'top', newTime);
      }
    } else {
      // Adjusting end time - add minutes to original end time
      newTime = new Date(initialEventRef.current.end);
      const newMinutes = calculateTimeFromPixels(newTime.getMinutes(), deltaY, event.isAllDay);
      newTime.setMinutes(newMinutes);
      
      // Ensure new end time isn't before start time
      if (newTime > initialEventRef.current.start) {
        // Use the ref value instead of the state variable
        onResizeMove?.(selectedTaskIdxRef.current, 'bottom', newTime);
      }
    }
  };
  
  const handleResizeEnd = (e: MouseEvent) => {
    if (!isResizingRef.current || !resizeDirectionRef.current || !initialEventRef.current) return;
    // Finalize resize
    // Calculate delta in pixels
    const deltaY = e.clientY - initialClientYRef.current;
    
    // Create new time based on direction
    let newTime = new Date();
    if (resizeDirectionRef.current === 'top') {
      // Adjusting start time - add minutes to original start time
      newTime = new Date(initialEventRef.current.start);
      const newMinutes = calculateTimeFromPixels(newTime.getMinutes(), deltaY, event.isAllDay);
      newTime.setMinutes(newMinutes);
      
      // Ensure new start time isn't after end time
      if (newTime < initialEventRef.current.end) {
        onResize?.(event, 'top', newTime);
      }
    } else {
      // Adjusting end time - add minutes to original end time
      newTime = new Date(initialEventRef.current.end);
      const newMinutes = calculateTimeFromPixels(newTime.getMinutes(), deltaY, event.isAllDay);
      newTime.setMinutes(newMinutes);
      
      // Ensure new end time isn't before start time
      if (newTime > initialEventRef.current.start) {
        onResize?.(event, 'bottom', newTime);
      }

      setTimeoutClick(setTimeout(() => {
        setTimeoutClick(null);
      }, 200));
    }

    isResizingRef.current = false;
    resizeDirectionRef.current = null;
    initialEventRef.current = null;
    
    // Remove document listeners
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Only trigger click if not resizing
    if (!isResizingRef.current && !timeoutClick) {
      onClick?.(event);
    }
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

  // Only show resize handles for non-all-day events and draggable events
  const showResizeHandles = !event.isAllDay && event.isDraggable !== false && onResize;

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
      {/* Top resize handle */}
      {showResizeHandles && (
        <div 
          className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize z-10"
          onMouseDown={(e) => handleResizeStart(e, 'top')}
          onMouseEnter={() => setIsTopHandleHovered(true)}
          onMouseLeave={() => setIsTopHandleHovered(false)}
        >
          {isTopHandleHovered && (
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-6 h-1 bg-white rounded-full opacity-70" />
          )}
        </div>
      )}
      
      {eventContent}
      
      {/* Bottom resize handle */}
      {showResizeHandles && (
        <div 
          className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize z-10"
          onMouseDown={(e) => handleResizeStart(e, 'bottom')}
          onMouseEnter={() => setIsBottomHandleHovered(true)}
          onMouseLeave={() => setIsBottomHandleHovered(false)}
        >
          {isBottomHandleHovered && (
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-6 h-1 bg-white rounded-full opacity-70" />
          )}
        </div>
      )}
      
      {isDragging && (
        <div className="absolute inset-0 bg-white bg-opacity-10 rounded border border-white border-opacity-30" />
      )}
    </div>
  );
};