import React, { useState } from 'react';
import type { Task, Project } from '../../types/models';
import { useTaskStore } from '../../store/taskStore';
import TaskCard from './TaskCard';
import TaskForm from './TaskForm';
import { Icon } from '../ui/Icon';
import { useAuthGuard, triggerAuthenticationFlow } from '../../utils/authGuard';
import { useUIStore } from '../../store/uiStore';

interface ProjectColumnProps {
  project: Project | null;
  tasks: Task[];
  onProjectChange: (taskId: string, newProjectId: string | null, targetIndex?: number) => void;
  onStatusChange: (taskId: string, status: Task['status']) => void;
  onTaskReorder: (draggedTaskId: string, targetTaskId: string, insertAfter: boolean) => void;
  title?: string;
  taskCount?: number;
  color?: string;
}

const ProjectColumn: React.FC<ProjectColumnProps> = ({
  project,
  tasks,
  onProjectChange,
  onStatusChange,
  onTaskReorder,
  title,
  taskCount: _taskCount,
  color
}) => {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const authStatus = useAuthGuard();
  const { isLeftSidebarOpen } = useUIStore();
  
  const projectId = project?.id || null;
  const projectName = title || project?.name || 'No Project';
  const projectColor = color || project?.color || '#6B7280';

  // Handle task card reordering within the same project
  const handleTaskReorder = (draggedTaskId: string, targetTaskId: string, insertAfter: boolean = false) => {
    const draggedTask = tasks.find(t => t.id === draggedTaskId);
    const targetTask = tasks.find(t => t.id === targetTaskId);
    
    if (!draggedTask || !targetTask) {
      console.warn('⚠️ ProjectColumn reorder: Invalid tasks for reordering');
      return;
    }

    // Ensure both tasks belong to this project
    const draggedProjectId = draggedTask.projectId || null;
    const targetProjectId = targetTask.projectId || null;
    
    if (draggedProjectId !== projectId || targetProjectId !== projectId) {
      console.warn('⚠️ ProjectColumn reorder: Tasks not in same project');
      return;
    }

    console.log(`🔄 ProjectColumn reordering within ${projectName}: ${draggedTaskId} to position relative to ${targetTaskId}`);
    onTaskReorder(draggedTaskId, targetTaskId, insertAfter);
  };

  // Handle cross-project moves with positioning
  const handleCrossProjectMove = async (draggedTaskId: string, targetTaskId: string, newStatus: Task['status'], insertAfter: boolean = false, targetProjectId?: string) => {
    console.log(`🔄 ProjectColumn cross-project move: ${draggedTaskId} to project ${targetProjectId || projectId}`);
    
    // Determine the actual target project ID
    const finalTargetProjectId = targetProjectId !== undefined ? targetProjectId : projectId;
    
    // Get the target index within this project's tasks
    const targetIndex = tasks.findIndex(t => t.id === targetTaskId);
    const finalIndex = insertAfter ? targetIndex + 1 : targetIndex;
    
    // Find the dragged task to check if status actually changed
    // Note: draggedTask might not be in current project's tasks if it's from another project
    const allTasks = useTaskStore.getState().tasks;
    const draggedTask = allTasks.find(t => t.id === draggedTaskId);
    const isStatusActuallyChanging = draggedTask && draggedTask.status !== newStatus;
    
    console.log(`🎯 ProjectColumn move details:`, {
      draggedTaskId,
      targetTaskId, 
      draggedTaskCurrentStatus: draggedTask?.status,
      newStatus,
      isStatusActuallyChanging,
      insertAfter,
      targetProjectId: finalTargetProjectId,
      projectName,
      targetIndex,
      finalIndex
    });
    
    // Call the project change handler with position information
    onProjectChange(draggedTaskId, finalTargetProjectId, finalIndex);
    
    // FIXED: Only update status if it actually changed
    if (isStatusActuallyChanging) {
      console.log(`📝 Status is actually changing from ${draggedTask?.status} to ${newStatus}`);
      onStatusChange(draggedTaskId, newStatus);
    } else {
      console.log(`📝 Status unchanged (${draggedTask?.status}), skipping status update`);
    }
  };

  return (
    <div className="project-column flex flex-col flex-1">
      {/* Project Column Content - Make entire container a drop target */}
      <div 
        className={`task-list-container pb-6 pt-4 flex-1 min-h-[300px] ${isLeftSidebarOpen ? 'pl-6' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          
          const taskId = e.dataTransfer.getData('text/plain');
          if (taskId) {
            console.log(`📥 Project column drop: Moving task ${taskId} to project ${projectName}`);
            handleCrossProjectMove(taskId, '', 'todo', false, projectId);
          }
        }}
      >
        {/* Project Tasks */}
        <div className="space-y-3">
          {tasks.map(task => (
            <TaskCard 
              key={task.id} 
              task={task}
              onStatusChange={onStatusChange}
              onReorder={handleTaskReorder}
              onCrossColumnMove={handleCrossProjectMove}
              columnStatus={task.status} // Keep original status for status-based UI
              context="task-management"
              targetProject={{
                id: projectId || 'no-project',
                name: projectName,
                color: projectColor
              }}
              dragContext="project" // Indicate this is project-based drag context
              hideCheckbox={true}
            />
          ))}
        </div>
        
        {/* New Task Button */}
        <div className="mt-2">
          {!isAddingTask ? (
            <button
              className="flex items-center text-text-secondary hover:text-text-primary bg-background-primary hover:bg-background-container transition-colors duration-200 py-2 px-2 rounded focus:outline-none w-full"
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
              status={'todo'} // Default status for new tasks in project columns
              initialProjectId={projectId || undefined}
              onCancel={() => setIsAddingTask(false)} 
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectColumn;