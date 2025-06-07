import React from 'react';
import { useDrop } from 'react-dnd';
import { DragItem, DropResult } from '../types';

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
  const [{ isOver, canDrop }, drop] = useDrop<DragItem, DropResult, { isOver: boolean; canDrop: boolean }>({
    accept: 'event',
    drop: (item: DragItem) => {
      const dropResult: DropResult = {
        targetDate: date,
        targetTime: hour !== undefined ? { hour, minute } : undefined,
        isAllDay
      };
      onDrop(item, dropResult);
      return dropResult;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  return (
    <div
      ref={drop as any}
      className={`
        drop-zone
        ${className}
        ${isOver && canDrop ? 'bg-blue-100 bg-opacity-50 drag-over' : ''}
        ${isOver && !canDrop ? 'bg-red-100 bg-opacity-50 invalid-drop' : ''}
        transition-colors duration-200
      `}
      style={style}
    >
      {children}
      {isOver && (
        <div className={`absolute inset-0 pointer-events-none rounded ${
          canDrop ? 'border-2 border-blue-400 border-dashed' : 'border-2 border-red-400 border-dashed'
        }`} />
      )}
    </div>
  );
}; 