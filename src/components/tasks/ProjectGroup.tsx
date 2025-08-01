import React, { useState } from 'react';
import type { Task, Project } from '../../types/models';
import TaskCard from './TaskCard';
import { Icon } from '../ui/Icon';

interface ProjectGroupProps {
  project: Project | null;
  tasks: Task[];
  onStatusChange: (taskId: string, status: Task['status']) => void;
  onReorder?: (draggedTaskId: string, targetTaskId: string, insertAfter?: boolean) => void;
  onCrossColumnMove?: (draggedTaskId: string, targetTaskId: string, newStatus: Task['status'], insertAfter?: boolean) => void;
  columnStatus: Task['status'];
  isExpanded: boolean;
  onToggle: () => void;
}

const ProjectGroup: React.FC<ProjectGroupProps> = ({
  project,
  tasks,
  onStatusChange,
  onReorder,
  onCrossColumnMove,
  columnStatus,
  isExpanded,
  onToggle
}) => {
  const projectName = project?.name || 'No Project';
  const projectColor = project?.color || '#6B7280';
  const taskCount = tasks.length;

  return (
    <div className="project-group mb-4">
      {/* Project Header */}
      <button
        className="w-full flex items-center justify-between p-3 bg-background-container hover:bg-background-secondary rounded-lg transition-colors duration-200"
        onClick={onToggle}
      >
        <div className="flex items-center space-x-3">
          {/* Project color indicator */}
          <span 
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: projectColor }}
          ></span>
          
          {/* Project name */}
          <span className="text-sm font-medium text-text-primary text-left">
            {projectName}
          </span>
          
          {/* Task count badge */}
          <span className="text-xs font-medium text-text-secondary bg-background-primary px-2 py-1 rounded-full">
            {taskCount}
          </span>
        </div>
        
        {/* Expand/Collapse icon */}
        <div className="w-4 h-4 flex items-center justify-center text-text-secondary">
          <Icon name={isExpanded ? 'arrow-up-s-line' : 'arrow-down-s-line'} />
        </div>
      </button>
      
      {/* Tasks Container */}
      {isExpanded && (
        <div className="project-tasks mt-3 space-y-3 pl-6">
          {tasks.map(task => (
            <TaskCard 
              key={task.id} 
              task={task}
              onStatusChange={onStatusChange}
              onReorder={onReorder}
              onCrossColumnMove={onCrossColumnMove}
              columnStatus={columnStatus}
              context="task-management"
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectGroup;