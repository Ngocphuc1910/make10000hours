import React from 'react';
import type { Project, Task } from '../../types/models';
import { Icon } from '../ui/Icon';
import TaskCard from './TaskCard';

interface ProjectChipsProps {
  projects: Array<{ project: Project | null; taskCount: number }>;
  expandedProjects: Set<string>;
  onToggleProject: (projectId: string | null) => void;
  allTasks: Task[];
  onStatusChange: (taskId: string, status: Task['status']) => void;
  columnStatus: Task['status'];
}

const ProjectChips: React.FC<ProjectChipsProps> = ({
  projects,
  expandedProjects,
  onToggleProject,
  allTasks,
  onStatusChange,
  columnStatus
}) => {
  return (
    <div className="space-y-1">
      {projects.map(({ project, taskCount }) => {
        const projectId = project?.id || 'no-project';
        const isExpanded = expandedProjects.has(projectId);
        const projectName = project?.name || 'No Project';
        const projectColor = project?.color || '#6B7280';
        
        // Get tasks for this project that match the column status
        const projectTasks = allTasks.filter(task => {
          const taskProjectId = task.projectId || 'no-project';
          return taskProjectId === projectId && task.status === columnStatus;
        });
        
        // Generate lighter background color from project color
        const getChipBackgroundColor = (color: string) => {
          // Convert hex to RGB and create a light background
          const hex = color.replace('#', '');
          const r = parseInt(hex.substr(0, 2), 16);
          const g = parseInt(hex.substr(2, 2), 16);
          const b = parseInt(hex.substr(4, 2), 16);
          return `rgba(${r}, ${g}, ${b}, 0.1)`;
        };
        
        const getChipBorderColor = (color: string) => {
          const hex = color.replace('#', '');
          const r = parseInt(hex.substr(0, 2), 16);
          const g = parseInt(hex.substr(2, 2), 16);
          const b = parseInt(hex.substr(4, 2), 16);
          return `rgba(${r}, ${g}, ${b}, 0.2)`;
        };
        
        return (
          <div key={projectId} className="project-chip-container">
            {/* Beautiful Notion-inspired Project Chip */}
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
              onClick={() => onToggleProject(project?.id || null)}
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
            
            {/* Expanded Tasks Section */}
            {isExpanded && (
              <div className="mt-2 ml-6 space-y-2 animate-in slide-in-from-top-1 duration-200">
                {projectTasks.map(task => (
                  <TaskCard 
                    key={task.id} 
                    task={task}
                    onStatusChange={onStatusChange}
                    columnStatus={task.status}
                    context="task-management"
                  />
                ))}
                {projectTasks.length === 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-400 italic">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
                      <path 
                        d="M7 1L7 13M1 7L13 7" 
                        stroke="currentColor" 
                        strokeWidth="1.5" 
                        strokeLinecap="round"
                      />
                    </svg>
                    No tasks in this project
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ProjectChips;