import React from 'react';
import type { Project } from '../../types/models';

interface ProjectChipProps {
  project: Project | null;
  taskCount: number;
  isExpanded: boolean;
  onToggle: (projectId: string | null) => void;
}

const ProjectChip: React.FC<ProjectChipProps> = ({
  project,
  taskCount,
  isExpanded,
  onToggle,
}) => {
  const projectId = project?.id || 'no-project';
  const projectName = project?.name || 'No Project';
  const projectColor = project?.color || '#6B7280';

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
      onClick={() => onToggle(project?.id || null)}
      {...(isExpanded && {
        onMouseEnter: (e: React.MouseEvent) => {
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.outline = 'none';
          e.currentTarget.style.border = 'none';
        },
        onFocus: (e: React.FocusEvent) => {
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.outline = 'none';
          e.currentTarget.style.border = 'none';
        }
      })}
    >
      {/* Expand/Collapse Arrow */}
      <div className={`flex items-center justify-center w-4 h-4 transition-transform duration-200 ${
        isExpanded ? 'rotate-90' : 'rotate-0'
      }`}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`${
          isExpanded ? 'text-gray-500' : 'text-gray-500 group-hover:text-gray-700 transition-colors'
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
      
      {/* Project Info */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Project Color Dot */}
        <div 
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: projectColor }}
        />
        
        {/* Project Name */}
        <span className={`text-sm font-medium truncate ${
          isExpanded ? 'text-gray-700' : 'text-gray-700 group-hover:text-gray-900 transition-colors'
        }`}>
          {projectName}
        </span>
        
        {/* Task Count Badge */}
        <div className="flex-shrink-0">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            isExpanded 
              ? 'bg-gray-100 text-gray-600'
              : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200 transition-colors'
          }`}>
            {taskCount}
          </span>
        </div>
      </div>
    </button>
  );
};

export default ProjectChip;