import React, { useLayoutEffect, useRef } from 'react';
import TaskCard from './TaskCard';
import TaskForm from './TaskForm';
import { Icon } from '../ui/Icon';
import { triggerAuthenticationFlow } from '../../utils/authGuard';
import type { Task } from '../../types/models';

interface ProjectTaskBlockProps {
  projectId: string;
  allTasks: Task[];
  status: Task['status'];
  isFirstColumn: boolean;
  onStatusChange: (taskId: string, status: Task['status']) => void;
  onTaskReorder: (draggedTaskId: string, targetTaskId: string, insertAfter?: boolean) => void;
  onCrossColumnMove: (draggedTaskId: string, targetTaskId: string, newStatus: Task['status'], insertAfter?: boolean) => void;
  isAddingTask: boolean;
  setIsAddingTask: (adding: boolean) => void;
  authStatus: any;
  onMeasurement: (measurement: {
    top: number;
    height: number;
    chipHeight: number;
    contentHeight: number;
    isExpanded: boolean;
  }) => void;
}

const ProjectTaskBlock: React.FC<ProjectTaskBlockProps> = ({
  projectId,
  allTasks,
  status,
  isFirstColumn,
  onStatusChange,
  onTaskReorder,
  onCrossColumnMove,
  isAddingTask,
  setIsAddingTask,
  authStatus,
  onMeasurement,
}) => {
  const blockRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Get tasks for this project across ALL columns
  const allProjectTasks = {
    pomodoro: allTasks.filter(task => (task.projectId || 'no-project') === projectId && task.status === 'pomodoro'),
    todo: allTasks.filter(task => (task.projectId || 'no-project') === projectId && task.status === 'todo'),
    completed: allTasks.filter(task => (task.projectId || 'no-project') === projectId && task.status === 'completed')
  };

  // Find the maximum number of tasks across all columns for this project
  const maxTasksInProject = Math.max(
    allProjectTasks.pomodoro.length,
    allProjectTasks.todo.length,
    allProjectTasks.completed.length
  );

  // Get tasks for current column
  const currentColumnTasks = allProjectTasks[status as keyof typeof allProjectTasks];

  // Measure and report dimensions (only master column)
  useLayoutEffect(() => {
    if (!isFirstColumn || !blockRef.current || !contentRef.current) return;

    let lastHeight = 0;
    
    const measureAndReport = () => {
      const blockRect = blockRef.current!.getBoundingClientRect();
      const contentRect = contentRef.current!.getBoundingClientRect();
      
      // Only update if height actually changed to prevent infinite loops
      if (Math.abs(blockRect.height - lastHeight) > 1) {
        lastHeight = blockRect.height;
        
        const measurement = {
          top: blockRect.top,
          height: blockRect.height,
          chipHeight: 67, // Fixed chip height
          contentHeight: contentRect.height,
          isExpanded: true,
        };

        // Use setTimeout to avoid synchronous state updates
        setTimeout(() => onMeasurement(measurement), 0);
      }
    };

    // Initial measurement with delay
    setTimeout(measureAndReport, 0);

    // Set up ResizeObserver for dynamic updates
    const resizeObserver = new ResizeObserver(() => {
      // Debounce measurements
      setTimeout(measureAndReport, 10);
    });
    
    resizeObserver.observe(blockRef.current);
    resizeObserver.observe(contentRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isFirstColumn, onMeasurement, currentColumnTasks.length, maxTasksInProject]);

  return (
    <div 
      ref={blockRef}
      style={{ 
        minHeight: `${maxTasksInProject * 84 + 100}px` // Ensure consistent height across columns
      }}
      className="mb-8 relative"
    >
      <div ref={contentRef}>
        {/* Render actual tasks */}
        <div className="space-y-3">
          {currentColumnTasks.map(task => (
            <TaskCard 
              key={task.id} 
              task={task}
              onStatusChange={onStatusChange}
              onReorder={onTaskReorder}
              onCrossColumnMove={onCrossColumnMove}
              columnStatus={status}
            />
          ))}
        </div>
        
        {/* Fill remaining space if this column has fewer tasks */}
        {currentColumnTasks.length < maxTasksInProject && (
          <div 
            style={{ 
              height: `${(maxTasksInProject - currentColumnTasks.length) * 84}px` 
            }}
            className="opacity-0"
          />
        )}
        
        {/* New Task button for this project */}
        <div className="mt-2">
          {!isAddingTask ? (
            <button
              className="flex items-center text-text-secondary hover:text-text-primary hover:bg-background-container transition-colors duration-200 py-2 px-2 rounded focus:outline-none w-full"
              onClick={() => {
                if (!authStatus.isAuthenticated && authStatus.shouldShowAuth) {
                  triggerAuthenticationFlow();
                  return;
                }
                setIsAddingTask(true);
              }}
            >
              <div className="w-4 h-4 flex items-center justify-center mr-2">
                <Icon name="add-line" />
              </div>
              <span className="text-sm">New Task</span>
            </button>
          ) : (
            <TaskForm 
              status={status} 
              onCancel={() => setIsAddingTask(false)} 
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectTaskBlock;