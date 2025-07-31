import React from 'react';
import type { Task } from '../../types/models';

interface StatusChipProps {
  status: Task['status'];
  title: string;
  color: string;
  taskCount: number;
  isExpanded: boolean;
  onToggle: () => void;
}

const StatusChip: React.FC<StatusChipProps> = ({
  status,
  title,
  color,
  taskCount,
  isExpanded,
  onToggle,
}) => {
  return (
    <button
      className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg ${
        isExpanded 
          ? 'hover:shadow-none hover:ring-0 hover:border-none hover:outline-none focus:shadow-none focus:ring-0 focus:border-none focus:outline-none' 
          : 'group transition-all duration-200 ease-out hover:shadow-sm hover:ring-1 hover:ring-black/5'
      }`}
      style={{
        backgroundColor: 'transparent',
        border: 'none',
        outline: 'none',
        boxShadow: 'none',
      }}
      onClick={onToggle}
      {...(isExpanded && {
        onMouseEnter: (e: React.MouseEvent) => {
          const target = e.currentTarget as HTMLButtonElement;
          target.style.boxShadow = 'none';
          target.style.outline = 'none';
          target.style.border = 'none';
        },
        onFocus: (e: React.FocusEvent) => {
          const target = e.currentTarget as HTMLButtonElement;
          target.style.boxShadow = 'none';
          target.style.outline = 'none';
          target.style.border = 'none';
        }
      })}
    >
      {/* Expand/Collapse Arrow */}
      <div className={`flex items-center justify-center w-4 h-4 transition-transform duration-200 ${
        isExpanded ? 'rotate-90' : 'rotate-0'
      }`}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`${
          isExpanded ? 'text-text-secondary' : 'text-text-secondary group-hover:text-text-primary transition-colors'
        }`}>
          <path 
            d="M4.5 3L7.5 6L4.5 9" 
            stroke="currentColor" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      </div>
      
      {/* Status Info */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Status Color Dot */}
        <div 
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        
        {/* Status Name */}
        <span className={`text-sm font-medium truncate ${
          isExpanded ? 'text-text-primary' : 'text-text-primary group-hover:text-text-primary transition-colors'
        }`}>
          {title}
        </span>
        
        {/* Task Count Badge */}
        <div className="flex-shrink-0">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            isExpanded 
              ? 'bg-background-container text-text-secondary'
              : 'bg-background-container text-text-secondary group-hover:bg-background-hover transition-colors'
          }`}>
            {taskCount}
          </span>
        </div>
      </div>
    </button>
  );
};

export default StatusChip;