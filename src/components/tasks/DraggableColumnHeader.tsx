import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '../../types/models';

interface DraggableColumnHeaderProps {
  id: string;
  status: Task['status'];
  title: string;
  taskCount: number;
  color: string;
  children?: React.ReactNode;
}

const DraggableColumnHeader: React.FC<DraggableColumnHeaderProps> = ({
  id,
  status,
  title,
  taskCount,
  color,
  children,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex-1 pl-2 py-3 bg-background-primary cursor-move select-none ${
        isDragging 
          ? 'opacity-50 shadow-lg scale-105 ring-2 ring-gray-400/50' 
          : 'hover:bg-background-container transition-all duration-150'
      }`}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: color }}
          ></span>
          <h3 className="text-sm font-semibold text-text-primary">
            {title}
          </h3>
          <span className="text-sm font-medium text-text-secondary bg-background-container px-3 py-1 rounded-full">
            {taskCount}
          </span>
        </div>
        
        {children}
      </div>
    </div>
  );
};

export default DraggableColumnHeader;