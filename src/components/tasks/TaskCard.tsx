import React, { useState, useRef, useEffect } from 'react';
import type { Task } from '../../types/models';
import { useTaskStore } from '../../store/taskStore';
import { Icon } from '../ui/Icon';
import CustomCheckbox from '../ui/CustomCheckbox';
import TaskForm from './TaskForm';

interface TaskCardProps {
  task: Task;
  onStatusChange: (taskId: string, status: Task['status']) => void;
  onReorder?: (draggedTaskId: string, targetTaskId: string, insertAfter?: boolean) => void;
  onCrossColumnMove?: (draggedTaskId: string, targetTaskId: string, newStatus: Task['status'], insertAfter?: boolean, targetProjectId?: string) => void;
  columnStatus?: Task['status'];
  context?: 'task-management' | 'pomodoro' | 'default';
  targetProject?: { id: string; name: string; color: string } | null;
  dragContext?: 'status' | 'project';
}

// Global state to track which task is currently being dragged
let currentDraggedTaskId: string | null = null;

const TaskCard: React.FC<TaskCardProps> = ({ task, onStatusChange, onReorder, onCrossColumnMove, columnStatus, context = 'default', targetProject, dragContext = 'status' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragPosition, setDragPosition] = useState<'top' | 'bottom' | null>(null);
  const [isBeingDragged, setIsBeingDragged] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const toggleTaskCompletion = useTaskStore(state => state.toggleTaskCompletion);
  const projects = useTaskStore(state => state.projects);
  const editingTaskId = useTaskStore(state => state.editingTaskId);
  const setEditingTaskId = useTaskStore(state => state.setEditingTaskId);
  
  const isEditing = editingTaskId === task.id;

  const project = projects.find(p => p.id === task.projectId);

  // Listen for global drag events to show original position styling
  useEffect(() => {
    const handleTaskDragStart = (event: CustomEvent) => {
      const draggedTaskId = event.detail?.taskId;
      if (draggedTaskId === task.id) {
        setIsBeingDragged(true);
      }
    };

    const handleTaskDragEnd = () => {
      setIsBeingDragged(false);
    };

    window.addEventListener('taskDragStart', handleTaskDragStart as EventListener);
    window.addEventListener('taskDragEnd', handleTaskDragEnd);

    return () => {
      window.removeEventListener('taskDragStart', handleTaskDragStart as EventListener);
      window.removeEventListener('taskDragEnd', handleTaskDragEnd);
    };
  }, [task.id]);

  // Project color indicator styles
  const getStatusIndicator = () => {
    if (!project) return null;
    return (
      <span 
        className="inline-block w-2 h-2 rounded-full mr-1.5" 
        style={{ backgroundColor: project.color }}
      ></span>
    );
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    console.log(`🚀 ENHANCED TaskCard drag start: ${task.id} (${task.title}) - Context: ${context}, Column: ${columnStatus}, Project: ${task.projectId || 'no-project'}, DragContext: ${dragContext}`);
    
    // Validate drag start conditions
    if (!task.id || !task.title) {
      console.error('❌ Invalid task data for drag start:', task);
      e.preventDefault();
      return;
    }
    
    try {
      // Set comprehensive drag data
      e.dataTransfer.setData('text/plain', task.id);
      e.dataTransfer.setData('application/x-task-status', task.status);
      e.dataTransfer.setData('application/x-task-project', task.projectId || 'no-project');
      e.dataTransfer.setData('application/x-task-title', task.title); // Add title for debugging
      e.dataTransfer.setData('application/x-drag-context', dragContext); // Add drag context
      e.dataTransfer.effectAllowed = 'move';
      
      console.log('📦 ENHANCED Drag data set successfully:', {
        taskId: task.id,
        taskTitle: task.title,
        taskStatus: task.status,
        taskProject: task.projectId || 'no-project',
        targetProject: targetProject?.id || 'no-project',
        targetProjectName: targetProject?.name || 'No Project',
        context: context,
        columnStatus: columnStatus
      });
      
      // Track this task as being dragged globally
      currentDraggedTaskId = task.id;
      setIsBeingDragged(true);
      
      // Trigger re-render of all TaskCard instances to show original position styling
      window.dispatchEvent(new CustomEvent('taskDragStart', { detail: { taskId: task.id } }));
      
      if (cardRef.current) {
        cardRef.current.classList.add('dragging');
        // Enhanced visual feedback - opacity and scale
        cardRef.current.classList.add('opacity-50');
        cardRef.current.style.transform = 'scale(1.02)';
        cardRef.current.style.transition = 'all 0.2s ease';
      }
    } catch (error) {
      console.error('❌ Error setting drag data:', error);
      e.preventDefault();
    }
  };

  const handleDragEnd = () => {
    console.log(`🏁 TaskCard drag end: ${task.id}`);
    
    // Clear global drag state
    currentDraggedTaskId = null;
    setIsBeingDragged(false);
    
    // Notify all TaskCard instances that drag ended
    window.dispatchEvent(new CustomEvent('taskDragEnd'));
    
    if (cardRef.current) {
      cardRef.current.classList.remove('dragging', 'opacity-50');
      cardRef.current.style.transform = '';
      cardRef.current.style.transition = '';
    }
    setIsDragOver(false);
    setDragPosition(null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if we can accept this drop
    const draggedTaskId = e.dataTransfer.types.includes('text/plain');
    if (!draggedTaskId) {
      console.log('🚫 DragOver rejected: No task data');
      return;
    }
    
    // Visual feedback for drop position
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) {
      const y = e.clientY - rect.top;
      const height = rect.height;
      const isTopHalf = y < height / 2;
      setDragPosition(isTopHalf ? 'top' : 'bottom');
      setIsDragOver(true);
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only hide indicators if actually leaving the card
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX;
      const y = e.clientY;
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        setIsDragOver(false);
        setDragPosition(null);
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    console.log(`🎯 TaskCard drop on: ${task.id} (${task.title}) - Project: ${targetProject?.name || 'No Project'}`);
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setDragPosition(null);
    
    const draggedTaskId = e.dataTransfer.getData('text/plain');
    const draggedTaskStatus = e.dataTransfer.getData('application/x-task-status');
    const draggedTaskProject = e.dataTransfer.getData('application/x-task-project');
    const draggedDragContext = e.dataTransfer.getData('application/x-drag-context') || 'status';
    
    // CRITICAL FIX: Ensure we use the correct target project context
    // The target project is the project context this TaskCard exists in
    // Handle 'dashboard' special case
    const targetProjectId = targetProject?.id === 'dashboard' ? 'dashboard' : (targetProject?.id || null);
    const draggedProjectNormalized = draggedTaskProject === 'no-project' ? null : draggedTaskProject;
    const isProjectChange = draggedProjectNormalized !== targetProjectId;
    
    console.log(`🔍 DETAILED PROJECT DEBUG:
      - targetProject FULL object: ${JSON.stringify(targetProject, null, 2)}
      - targetProject type: ${typeof targetProject}
      - targetProject null check: ${targetProject === null}
      - targetProject undefined check: ${targetProject === undefined}
      - targetProjectId: ${targetProjectId}
      - draggedTaskProject: ${draggedTaskProject}
      - draggedProjectNormalized: ${draggedProjectNormalized}`);
    const isStatusChange = draggedTaskStatus !== task.status;
    
    console.log(`🎯 ENHANCED Drop analysis:
      - Dragged Task: ${draggedTaskId} 
      - From Project: ${draggedTaskProject} (normalized: ${draggedProjectNormalized})
      - To Project: ${targetProjectId}
      - Target Project Name: ${targetProject?.name || 'No Project'}
      - This Task's Project: ${task.projectId || 'no-project'}
      - From Status: ${draggedTaskStatus} 
      - To Status: ${task.status}
      - Drag Context: ${draggedDragContext} -> ${dragContext}
      - Project Change: ${isProjectChange}
      - Status Change: ${isStatusChange}
      - Insert Position: ${dragPosition}`);
    
    if (!draggedTaskId) {
      console.warn('⚠️ Drop rejected: No dragged task ID');
      return;
    }
    
    if (draggedTaskId === task.id) {
      console.log('🚫 Drop ignored: Cannot drop task on itself');
      return;
    }
    
    // Enhanced validation with better error messages
    if (!isStatusChange && !isProjectChange) {
      if (!onReorder) {
        console.warn('⚠️ Drop rejected: Same column reorder but no onReorder handler');
        return;
      }
      // Same column, same project reordering
      console.log('🔄 Executing same column reordering (no project/status change)');
      onReorder(draggedTaskId, task.id, dragPosition === 'bottom');
    } else {
      if (!onCrossColumnMove) {
        console.warn('⚠️ Drop rejected: Cross-column/project move but no onCrossColumnMove handler');
        return;
      }
      // Cross column or cross project move
      console.log(`🔄 Executing cross column/project move: ${isProjectChange ? 'Project Change' : 'Status Change'}`);
      try {
        // CRITICAL: Pass the target project ID explicitly
        onCrossColumnMove(draggedTaskId, task.id, task.status, dragPosition === 'bottom', targetProjectId);
      } catch (error) {
        console.error('❌ Error executing cross column/project move:', error);
      }
    }
  };

  const handleCheckboxChange = () => {
    // Pass context information to know which column the task was completed from
    const context = columnStatus === 'todo' ? 'todo' : 'default';
    toggleTaskCompletion(task.id, context);
    // Status changes and timer handling are now managed automatically in the store
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // If another task is being edited, set this task as the new editing task
    // The TaskForm component will handle auto-saving the previous task
    setEditingTaskId(task.id);
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleTaskClick = (e: React.MouseEvent) => {
    // Only enable direct click editing in task management context
    if (context === 'task-management') {
      // Don't trigger if clicking on interactive elements
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('input') || target.closest('[role="checkbox"]')) {
        return;
      }
      
      e.stopPropagation();
      setEditingTaskId(task.id);
    }
  };

  // Get task card colors based on status
  const getTaskCardClasses = () => {
    if (task.completed) {
      return context === 'task-management' 
        ? 'bg-task-completed-bg border-task-completed-border dark:border-transparent'
        : 'bg-task-completed-bg border-task-completed-border';
    }
    
    switch (task.status) {
      case 'todo':
        return context === 'task-management'
          ? 'bg-task-todo-bg border-task-todo-border dark:border-transparent'
          : 'bg-task-todo-bg border-task-todo-border';
      case 'pomodoro':
        return context === 'task-management'
          ? 'bg-task-pomodoro-bg border-task-pomodoro-border dark:border-transparent'
          : 'bg-task-pomodoro-bg border-task-pomodoro-border';
      case 'completed':
        return context === 'task-management'
          ? 'bg-task-completed-bg border-task-completed-border dark:border-transparent'
          : 'bg-task-completed-bg border-task-completed-border';
      default:
        return context === 'task-management'
          ? 'bg-background-secondary border-border dark:border-transparent'
          : 'bg-background-secondary border-border';
    }
  };

  if (isEditing) {
    return <TaskForm task={task} onCancel={() => setEditingTaskId(null)} />;
  }

  return (
    <div className="relative">
      {/* Subtle Drop indicator lines - only show on actual drop targets, not original position */}
      {isDragOver && !isBeingDragged && dragPosition === 'top' && (
        <div className="absolute -top-0.5 left-2 right-2 h-0.5 bg-blue-400 rounded-full z-10 opacity-80"></div>
      )}
      {isDragOver && !isBeingDragged && dragPosition === 'bottom' && (
        <div className="absolute -bottom-0.5 left-2 right-2 h-0.5 bg-blue-400 rounded-full z-10 opacity-80"></div>
      )}
      
      <div
        ref={cardRef}
        className={`task-card flex items-start p-3 border ${getTaskCardClasses()}
        ${task.completed ? 'opacity-70 text-text-secondary' : ''}
        ${isDragOver || isBeingDragged ? 'drag-over' : ''}
        rounded-md hover:shadow-sm cursor-pointer transition-all duration-200 ease-in-out`}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleTaskClick}
        data-task-id={task.id}
        data-status={task.status}
      >
      <div className="mr-3 mt-0.5">
        <CustomCheckbox
          id={`task-checkbox-${task.id}`}
          checked={task.completed}
          onChange={handleCheckboxChange}
        />
      </div>

      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 mr-2">
            <h4 
              className={`text-sm font-medium text-left whitespace-pre-wrap break-words
              ${task.completed ? 'text-text-secondary line-through' : 'text-text-primary'}`}
            >
              {task.title}
            </h4>
            <div className="flex items-center mt-0.5 text-xs text-left">
              <div className="flex items-center">
                {getStatusIndicator()}
                <span className={`${task.completed ? 'text-text-secondary' : 'text-text-secondary'}`}>
                  {project?.name || 'Unknown project'}
                </span>
              </div>
              <span className="mx-2 text-border">•</span>
              <span className={`flex items-center ${task.completed ? 'text-text-secondary' : 'text-text-secondary'}`}>
                <i className="ri-time-line mr-1"></i>
                {task.timeSpent}/{task.timeEstimated}m
              </span>
            </div>
            {isExpanded && task.description && (
              <div className="task-description mt-2">
                <p className="text-sm text-text-secondary mb-2 whitespace-pre-wrap break-words">{task.description}</p>
              </div>
            )}
          </div>
          {task.description && (
            <button 
              className="expand-button p-1 rounded-full hover:bg-background-container flex-shrink-0"
              onClick={handleExpandClick}
            >
              <div className="w-5 h-5 flex items-center justify-center text-text-secondary">
                <i className={`ri-arrow-${isExpanded ? 'up' : 'down'}-s-line`}></i>
              </div>
            </button>
          )}
        </div>
      </div>

      {context !== 'task-management' && (
        <div className="task-menu ml-4 flex items-start">
          <button 
            className="edit-task-btn p-1 rounded-full hover:bg-background-primary flex-shrink-0"
            onClick={handleEditClick}
          >
            <div className="w-5 h-5 flex items-center justify-center text-text-secondary">
              <i className="ri-edit-line"></i>
            </div>
          </button>
        </div>
      )}
      </div>
    </div>
  );
};

export default TaskCard; 