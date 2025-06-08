import React from 'react';
import { useDrop } from 'react-dnd';
import { DragItem, DropResult } from '../types';
import { getEventDurationMinutes } from '../utils';

interface DroppableTimeSlotProps {
  date: Date;
  hour?: number;
  minute?: number;
  isAllDay?: boolean;
  onDrop: (item: DragItem, dropResult: DropResult) => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const DroppableTimeSlot: React.FC<DroppableTimeSlotProps> = ({
  date,
  hour,
  minute = 0,
  isAllDay = false,
  onDrop,
  children,
  className = '',
  style
}) => {
  const [{ isOver, canDrop, draggedItem }, drop] = useDrop<DragItem, DropResult, { isOver: boolean; canDrop: boolean; draggedItem: DragItem | null }>({
    accept: 'event',
    drop: (item: DragItem) => {
      const dropResult: DropResult = {
        targetDate: date,
        targetTime: hour !== undefined ? { hour, minute } : undefined,
        isAllDay
      };
      
      // Clean drop - debug logging removed for production
      
      onDrop(item, dropResult);
      return dropResult;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
      draggedItem: monitor.getItem(),
    }),
  });

  // Calculate drop zone height based on dragged event duration
  const getDropZoneHeight = () => {
    if (!draggedItem || isAllDay) return 'auto';
    
    // Use the display duration from the drag item (already handles zero-duration events)
    const durationMinutes = draggedItem.displayDurationMinutes;
    const cellHeight = 60; // 60px per hour slot
    const heightPx = (durationMinutes / 60) * cellHeight;
    const finalHeight = `${Math.max(heightPx, 30)}px`;
    
    // Debug logging for zero-duration events
    if (durationMinutes === 30) {
      console.log('Zero-duration event detected:', {
        originalStart: draggedItem.event.start,
        originalEnd: draggedItem.event.end,
        displayDurationMinutes: durationMinutes,
        calculatedHeight: finalHeight
      });
    }
    
    return finalHeight;
  };

  // Get the event color for drop zone styling
  const getDropZoneColor = () => {
    if (!draggedItem) return '#3B82F6';
    return draggedItem.event.color || '#3B82F6';
  };

  return (
    <div
      ref={drop as any}
      className={`drop-zone ${className} transition-all duration-200 relative`}
      style={style}
    >
      {children}
      {isOver && (
        <div 
          className={`absolute pointer-events-none rounded-md transition-all duration-200 drop-indicator ${canDrop ? 'valid' : 'invalid'}`}
          style={{
            top: 0,
            left: 0,
            right: 0,
            height: getDropZoneHeight(),
            border: `1px solid ${canDrop ? getDropZoneColor() : '#EF4444'}`,
            backgroundColor: canDrop 
              ? `${getDropZoneColor()}15` 
              : '#FEF2F2',
            borderStyle: 'solid',
            boxSizing: 'border-box',
            '--drop-color': getDropZoneColor(),
            '--drop-bg-color': `${getDropZoneColor()}15`
          } as React.CSSProperties}
        />
      )}
    </div>
  );
}; 