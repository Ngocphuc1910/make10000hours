import React, { useState } from 'react';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { useTaskStore } from '../../store/taskStore';
import { useUIStore } from '../../store/uiStore';
import type { Task, Project } from '../../types/models';
import { TaskColumn } from './';
import { ToastNotification } from './';
import { ProjectLayoutProvider } from '../../contexts/ProjectLayoutContext';
import ProjectGroupRow from './ProjectGroupRow';
import DraggableColumnHeader from './DraggableColumnHeader';
import { sortTasksByOrder } from '../../utils/taskSorting';
import { FractionalOrderingService } from '../../services/FractionalOrderingService';

interface TaskStatusBoardProps {
  className?: string;
  groupByProject?: boolean;
}

type ToastMessage = {
  id: string;
  message: string;
  taskId?: string;
  undoAction?: () => void;
};

const TaskStatusBoard: React.FC<TaskStatusBoardProps> = ({ className = '', groupByProject = false }) => {
  const tasks = useTaskStore(state => state.tasks);
  const projects = useTaskStore(state => state.projects);
  const updateTaskStatus = useTaskStore(state => state.updateTaskStatus);
  const columnOrder = useTaskStore(state => state.columnOrder);
  const reorderColumns = useTaskStore(state => state.reorderColumns);
  const reorderTasks = useTaskStore(state => state.reorderTasks);
  const moveTaskToStatusAndPosition = useTaskStore(state => state.moveTaskToStatusAndPosition);
  const updateTask = useTaskStore(state => state.updateTask);
  const { isLeftSidebarOpen } = useUIStore();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());


  // Filter AND SORT tasks by status using fractional positions
  const pomodoroTasks = sortTasksByOrder(tasks.filter(task => task.status === 'pomodoro'));
  const todoTasks = sortTasksByOrder(tasks.filter(task => task.status === 'todo'));
  const completedTasks = sortTasksByOrder(tasks.filter(task => task.status === 'completed'));

  // Column configurations
  const columnConfigs = {
    pomodoro: { title: 'In Pomodoro', color: '#EF4444', tasks: pomodoroTasks },
    todo: { title: 'To Do List', color: '#3B82F6', tasks: todoTasks },
    completed: { title: 'Completed', color: '#10B981', tasks: completedTasks },
  };

  // Handle task status change
  const handleTaskStatusChange = (taskId: string, newStatus: Task['status']) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const oldStatus = task.status;
    updateTaskStatus(taskId, newStatus);

    // Create toast message
    let message = '';
    if (newStatus === 'completed') {
      message = 'Task moved to Completed';
    } else if (newStatus === 'todo') {
      message = oldStatus === 'completed' ? 'Task moved to To Do List' : 'Task marked as incomplete';
    } else if (newStatus === 'pomodoro') {
      message = 'Task moved to In Pomodoro';
    }

    // Add toast with undo action
    addToast(message, taskId, () => {
      updateTaskStatus(taskId, oldStatus);
    });
  };

  // Add toast notification
  const addToast = (message: string, taskId?: string, undoAction?: () => void) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, taskId, undoAction }]);

    // Auto-remove toast after 3 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 3000);
  };

  // Remove toast notification
  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Toggle project expansion
  const toggleProjectExpansion = (projectId: string | null) => {
    const id = projectId || 'no-project';
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Handle column drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = columnOrder.indexOf(active.id as Task['status']);
      const newIndex = columnOrder.indexOf(over.id as Task['status']);
      
      const newOrder = [...columnOrder];
      const [movedItem] = newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, movedItem);
      
      reorderColumns(newOrder);
    }
  };

  // Get all projects with tasks (for chips) - memoized to prevent multiple calls
  const getProjectsWithTasks = React.useMemo(() => {
    const projectTaskCounts = new Map<string, number>();
    
    // Count tasks for each unique project (including null/undefined as 'no-project')
    tasks.forEach(task => {
      const projectId = task.projectId || 'no-project';
      projectTaskCounts.set(projectId, (projectTaskCounts.get(projectId) || 0) + 1);
    });
    
    // Convert to array and get project details, ensuring no duplicates
    const projectsWithTasks: Array<{ project: Project | null; taskCount: number }> = [];
    const seenProjects = new Set<string>();
    
    projectTaskCounts.forEach((taskCount, projectId) => {
      if (projectId === 'no-project') {
        // Only add one "No Project" entry
        if (!seenProjects.has('no-project')) {
          projectsWithTasks.push({
            project: null,
            taskCount
          });
          seenProjects.add('no-project');
        }
      } else {
        const foundProject = projects.find(p => p.id === projectId);
        if (foundProject && !seenProjects.has(projectId)) {
          projectsWithTasks.push({
            project: foundProject,
            taskCount
          });
          seenProjects.add(projectId);
        }
      }
    });
    
    // Sort by task count (descending)
    return projectsWithTasks.sort((a, b) => b.taskCount - a.taskCount);
  }, [tasks, projects]);

  // Handle task reordering within the same column in project view
  const handleTaskReorder = (draggedTaskId: string, targetTaskId: string, insertAfter: boolean = false) => {
    const draggedTask = tasks.find(t => t.id === draggedTaskId);
    const targetTask = tasks.find(t => t.id === targetTaskId);
    
    if (!draggedTask || !targetTask || draggedTask.status !== targetTask.status) {
      return;
    }

    if (groupByProject) {
      // CRITICAL FIX: In project view, only reorder within the same project context
      handleProjectSpecificReorder(draggedTaskId, targetTaskId, insertAfter);
    } else {
      // By Status view: use global reordering
      const statusTasks = sortTasksByOrder(tasks.filter(t => t.status === targetTask.status));
      const targetIndex = statusTasks.findIndex(t => t.id === targetTaskId);
      const newIndex = insertAfter ? targetIndex + 1 : targetIndex;
      
      console.log(`🔄 Status view reordering within ${targetTask.status}: ${draggedTaskId} to position ${newIndex}`);
      reorderTasks(draggedTaskId, newIndex);
    }
  };

  // NEW: Project-specific reordering that doesn't affect global task order
  const handleProjectSpecificReorder = async (draggedTaskId: string, targetTaskId: string, insertAfter: boolean = false) => {
    const draggedTask = tasks.find(t => t.id === draggedTaskId);
    const targetTask = tasks.find(t => t.id === targetTaskId);
    
    if (!draggedTask || !targetTask) return;
    
    // CRITICAL: Only reorder within the same project AND status
    if (draggedTask.status !== targetTask.status || 
        (draggedTask.projectId || null) !== (targetTask.projectId || null)) {
      console.log(`🚫 Project reorder rejected: Different project or status`);
      return;
    }

    const projectId = targetTask.projectId || null;
    const status = targetTask.status;

    // Get tasks in the same project and status, sorted by display order
    const projectStatusTasks = sortTasksByOrder(
      tasks.filter(t => 
        t.status === status && 
        (t.projectId || null) === projectId && 
        t.id !== draggedTaskId
      )
    );

    const targetIndex = projectStatusTasks.findIndex(t => t.id === targetTaskId);
    const newIndex = insertAfter ? targetIndex + 1 : Math.max(0, targetIndex);
    const clampedIndex = Math.max(0, Math.min(newIndex, projectStatusTasks.length));

    console.log(`🎯 PROJECT-SPECIFIC REORDER:`, {
      draggedTask: draggedTask.title,
      targetTask: targetTask.title,
      project: projectId || 'Dashboard',
      status,
      projectStatusTasksCount: projectStatusTasks.length,
      targetIndex,
      newIndex,
      clampedIndex
    });

    // Use the existing reorderTasks logic but with project context
    try {
      const beforeTask = clampedIndex > 0 ? projectStatusTasks[clampedIndex - 1] : null;
      const afterTask = clampedIndex < projectStatusTasks.length ? projectStatusTasks[clampedIndex] : null;
      
      const beforePos = beforeTask ? (beforeTask.orderString || beforeTask.order?.toString() || 'a0') : null;
      const afterPos = afterTask ? (afterTask.orderString || afterTask.order?.toString() || 'z0') : null;
      
      // Generate new fractional position using the existing service
      const newOrderString = FractionalOrderingService.generatePosition(beforePos, afterPos);
      
      // Update the task with the new position
      await updateTask(draggedTaskId, {
        orderString: newOrderString
      });
      
      console.log(`✅ PROJECT REORDER SUCCESS: ${draggedTask.title} -> ${newOrderString}`);
      
    } catch (error) {
      console.error('❌ Project-specific reorder failed:', error);
    }
  };

  // Handle cross-column moves with positioning in project view
  const handleCrossColumnMove = async (draggedTaskId: string, targetTaskId: string, newStatus: Task['status'], insertAfter: boolean = false, targetProjectId?: string) => {
    const draggedTask = tasks.find(t => t.id === draggedTaskId);
    if (!draggedTask) {
      console.error('❌ Task not found:', draggedTaskId);
      return;
    }

    if (groupByProject) {
      // CRITICAL FIX: In project view, handle cross-column moves independently
      await handleProjectCrossColumnMove(draggedTaskId, targetTaskId, newStatus, insertAfter, targetProjectId);
    } else {
      // By Status view: use existing cross-column logic
      await handleStatusCrossColumnMove(draggedTaskId, targetTaskId, newStatus, insertAfter, targetProjectId);
    }
  };

  // NEW: Project-specific cross-column moves that don't affect By Status view ordering
  const handleProjectCrossColumnMove = async (draggedTaskId: string, targetTaskId: string, newStatus: Task['status'], insertAfter: boolean = false, targetProjectId?: string) => {
    const draggedTask = tasks.find(t => t.id === draggedTaskId);
    if (!draggedTask) return;

    const currentProjectId = draggedTask.projectId || null;
    // Handle 'dashboard' special case - convert back to null for database storage
    const finalProjectId = targetProjectId === 'dashboard' ? null : (targetProjectId !== undefined ? targetProjectId : null);
    
    // FIXED: Normalize both values for proper comparison
    const normalizedCurrentProject = currentProjectId === null ? 'dashboard' : currentProjectId;
    const normalizedTargetProject = finalProjectId === null ? 'dashboard' : finalProjectId;
    const isProjectChange = normalizedCurrentProject !== normalizedTargetProject;
    const isStatusChange = draggedTask.status !== newStatus;
    
    console.log(`🚀 PROJECT CROSS-COLUMN MOVE:`, {
      draggedTask: draggedTask.title,
      currentProject: currentProjectId || 'Dashboard',
      targetProject: finalProjectId || 'Dashboard',
      normalizedCurrentProject,
      normalizedTargetProject,
      originalTargetProjectId: targetProjectId,
      currentStatus: draggedTask.status,
      newStatus,
      isProjectChange,
      isStatusChange,
      insertAfter
    });

    try {
      // CRITICAL FIX: Make atomic update to prevent race conditions
      // Calculate position first if status is changing
      let updates: Partial<Task> = {};
      
      if (isProjectChange) {
        updates.projectId = finalProjectId;
      }
      
      if (isStatusChange) {
        // Filter destination tasks by the target project (important for project view)
        const projectStatusTasks = sortTasksByOrder(
          tasks.filter(t => 
            t.status === newStatus && 
            (t.projectId || null) === finalProjectId &&
            t.id !== draggedTaskId
          )
        );

        const targetIndex = projectStatusTasks.findIndex(t => t.id === targetTaskId);
        const finalIndex = insertAfter ? targetIndex + 1 : Math.max(0, targetIndex);
        const clampedIndex = Math.max(0, Math.min(finalIndex, projectStatusTasks.length));

        // Calculate new position within the target project and status
        const beforeTask = clampedIndex > 0 ? projectStatusTasks[clampedIndex - 1] : null;
        const afterTask = clampedIndex < projectStatusTasks.length ? projectStatusTasks[clampedIndex] : null;

        const beforePos = beforeTask ? (beforeTask.orderString || beforeTask.order?.toString() || 'a0') : null;
        const afterPos = afterTask ? (afterTask.orderString || afterTask.order?.toString() || 'z0') : null;

        // Generate new fractional position
        const newOrderString = FractionalOrderingService.generatePosition(beforePos, afterPos);

        // Add status-related updates
        updates.status = newStatus;
        updates.completed = newStatus === 'completed' ? true : (draggedTask.status === 'completed' ? false : draggedTask.completed);
        updates.hideFromPomodoro = newStatus === 'pomodoro' ? false : (draggedTask.hideFromPomodoro ?? false);
        updates.orderString = newOrderString;
      }
      
      // Single atomic update for all changes
      await updateTask(draggedTaskId, updates);
      
      console.log(`✅ ATOMIC PROJECT MOVE: ${draggedTask.title}`, {
        projectChange: isProjectChange ? `${currentProjectId || 'Dashboard'} → ${finalProjectId || 'Dashboard'}` : 'none',
        statusChange: isStatusChange ? `${draggedTask.status} → ${newStatus}` : 'none',
        orderString: updates.orderString || 'unchanged'
      });

      // Add toast notification
      const projectName = finalProjectId ? projects.find(p => p.id === finalProjectId)?.name || 'Unknown Project' : 'Dashboard';
      const statusName = newStatus === 'pomodoro' ? 'In Pomodoro' : newStatus === 'todo' ? 'To Do List' : 'Completed';
      
      if (isProjectChange && isStatusChange) {
        addToast(`Task moved to ${projectName} - ${statusName}`);
      } else if (isProjectChange) {
        addToast(`Task moved to ${projectName}`);
      } else if (isStatusChange) {
        addToast(`Task moved to ${statusName}`);
      }

    } catch (error) {
      console.error('❌ Project cross-column move failed:', error);
      addToast('Failed to move task - please try again');
    }
  };

  // EXISTING: Status view cross-column logic (unchanged)
  const handleStatusCrossColumnMove = async (draggedTaskId: string, targetTaskId: string, newStatus: Task['status'], insertAfter: boolean = false, targetProjectId?: string) => {
    const draggedTask = tasks.find(t => t.id === draggedTaskId);
    if (!draggedTask) return;

    const currentProjectId = draggedTask.projectId || null;
    const finalProjectId = targetProjectId !== undefined ? targetProjectId : null;
    const isProjectChange = currentProjectId !== finalProjectId;
    
    console.log(`🚀 STATUS CROSS-COLUMN MOVE:`, {
      draggedTask: draggedTask.title,
      currentProject: currentProjectId || 'no-project',
      finalProject: finalProjectId || 'no-project',
      newStatus,
      isProjectChange,
      statusChange: draggedTask.status !== newStatus
    });
    
    // For project changes, filter destination tasks by the target project
    const destinationStatusTasks = isProjectChange 
      ? sortTasksByOrder(tasks.filter(t => t.status === newStatus && (t.projectId || null) === finalProjectId))
      : sortTasksByOrder(tasks.filter(t => t.status === newStatus && t.id !== draggedTaskId));
    
    const targetIndex = destinationStatusTasks.findIndex(t => t.id === targetTaskId);
    const finalIndex = insertAfter ? targetIndex + 1 : Math.max(0, targetIndex);
    
    if (isProjectChange) {
      // Handle cross-project moves with atomic update
      try {
        console.log(`🔄 CROSS-PROJECT: Updating task with project and status change`);
        
        // First update the projectId
        await updateTask(draggedTaskId, {
          projectId: finalProjectId
        });
        
        console.log(`✅ Successfully updated task project: ${currentProjectId || 'no-project'} → ${finalProjectId || 'no-project'}`);
        
        // Then handle the status/position change
        if (draggedTask.status !== newStatus) {
          // Small delay to ensure project update is processed
          setTimeout(async () => {
            console.log(`🗺️ Now updating status and position: ${newStatus}, index ${finalIndex}`);
            await moveTaskToStatusAndPosition(draggedTaskId, newStatus as Task['status'], finalIndex);
          }, 100);
        } else {
          // Same status, just repositioning within the new project
          console.log(`🗺️ Same status, repositioning within new project to index ${finalIndex}`);
          setTimeout(async () => {
            await reorderTasks(draggedTaskId, finalIndex);
          }, 100);
        }
        
        // Add toast notification for project change
        const projectName = finalProjectId ? projects.find(p => p.id === finalProjectId)?.name || 'Unknown Project' : 'No Project';
        const statusName = newStatus === 'pomodoro' ? 'In Pomodoro' : newStatus === 'todo' ? 'To Do List' : 'Completed';
        addToast(`Task moved to ${projectName} - ${statusName}`);
        
      } catch (error) {
        console.error('❌ Failed to update task for cross-project move:', error);
        addToast('Failed to move task - please try again');
      }
    } else {
      // Only status/position change
      console.log(`🗺️ Moving task to status and position: ${newStatus}, index ${finalIndex}`);
      try {
        await moveTaskToStatusAndPosition(draggedTaskId, newStatus as Task['status'], finalIndex);
        
        // Add toast for status change
        const statusName = newStatus === 'pomodoro' ? 'In Pomodoro' : newStatus === 'todo' ? 'To Do List' : 'Completed';
        addToast(`Task moved to ${statusName}`);
        
      } catch (error) {
        console.error('❌ Failed to move task:', error);
        addToast('Failed to move task - please try again');
      }
    }
  };

  // Group tasks by project for row-based rendering when grouping is enabled
  const projectGroups = React.useMemo(() => {
    if (!groupByProject) return null;
    
    return getProjectsWithTasks.map(({ project }) => {
      const projectId = project?.id || 'no-project';
      const projectTasks = tasks.filter(task => (task.projectId || 'no-project') === projectId);
      
      // CRITICAL FIX: Create a proper targetProject object for Dashboard/No Project
      const targetProjectObject = project || {
        id: 'dashboard', // Use 'dashboard' as a special identifier instead of null
        name: 'Dashboard',
        color: '#6B7280', // Gray color for Dashboard
        userId: '' // Will be set properly when needed
      };
      
      return {
        project: targetProjectObject, // Always provide a complete project object
        projectTasks: {
          pomodoro: sortTasksByOrder(projectTasks.filter(t => t.status === 'pomodoro')),
          todo: sortTasksByOrder(projectTasks.filter(t => t.status === 'todo')),
          completed: sortTasksByOrder(projectTasks.filter(t => t.status === 'completed'))
        }
      };
    });
  }, [tasks, groupByProject, getProjectsWithTasks]);

  return (
    <ProjectLayoutProvider>
      <div className={`flex flex-col bg-background-primary ${className}`}>
        {/* Fixed Headers Row - DndContext only for column reordering */}
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
            <div className="grid gap-6 bg-background-primary sticky top-0 z-30 pl-2" style={{ gridTemplateColumns: `repeat(${columnOrder.length}, minmax(320px, 1fr))` }}>
              {columnOrder.map((status) => {
                const config = columnConfigs[status];
                return (
                  <DraggableColumnHeader
                    key={status}
                    id={status}
                    status={status}
                    title={config.title}
                    taskCount={config.tasks.length}
                    color={config.color}
                  >
                    <button className="p-2 rounded-full hover:bg-background-container group">
                      <div className="w-4 h-4 flex items-center justify-center text-text-secondary group-hover:text-text-primary">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="5" r="2"/>
                          <circle cx="12" cy="12" r="2"/>
                          <circle cx="12" cy="19" r="2"/>
                        </svg>
                      </div>
                    </button>
                  </DraggableColumnHeader>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>

        {/* Scrollable Content Row - Outside DndContext to allow native HTML5 drag and drop */}
        <div className="flex flex-col flex-1">
          {groupByProject && projectGroups ? (
            /* Project Group Rows - Notion-inspired approach */
            <div className={`flex-1 pr-6 pb-6 pt-4 ${isLeftSidebarOpen ? 'pl-6' : 'pl-2'}`}>
              {projectGroups.map(({ project, projectTasks }) => (
                <ProjectGroupRow
                  key={project?.id || 'no-project'}
                  project={project}
                  projectTasks={projectTasks}
                  isExpanded={expandedProjects.has(project?.id || 'no-project')}
                  expandedProjects={expandedProjects}
                  onToggleProject={toggleProjectExpansion}
                  onStatusChange={handleTaskStatusChange}
                  onTaskReorder={handleTaskReorder}
                  onCrossColumnMove={(draggedTaskId: string, targetTaskId: string, newStatus: Task['status'], insertAfter?: boolean, targetProjectId?: string) => {
                    console.log(`🔧 TaskStatusBoard receiving cross-column move:`, {
                      draggedTaskId,
                      targetTaskId,
                      newStatus,
                      insertAfter,
                      targetProjectId
                    });
                    handleCrossColumnMove(draggedTaskId, targetTaskId, newStatus, insertAfter, targetProjectId);
                  }}
                  authStatus={{ isAuthenticated: true, shouldShowAuth: false }} // TODO: Get actual auth status
                  allTasks={tasks}
                  columnOrder={columnOrder}
                />
              ))}
            </div>
          ) : (
            /* Traditional Column Layout */
            <div className="grid gap-6 flex-1 pl-2" style={{ gridTemplateColumns: `repeat(${columnOrder.length}, minmax(320px, 1fr))` }}>
              {columnOrder.map((status, index) => {
                const config = columnConfigs[status];
                return (
                  <TaskColumn
                    key={status}
                    title={config.title}
                    tasks={config.tasks}
                    status={status}
                    badgeColor={status === 'pomodoro' ? 'bg-red-500' : status === 'todo' ? 'bg-blue-500' : 'bg-green-500'}
                    onStatusChange={handleTaskStatusChange}
                    groupByProject={groupByProject}
                    expandedProjects={expandedProjects}
                    isFirstColumn={index === 0}
                    projects={getProjectsWithTasks}
                    onToggleProject={toggleProjectExpansion}
                    allTasks={tasks}
                    hideHeader={true}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Toast Notifications */}
        <div className="fixed bottom-4 right-4 z-50">
          {toasts.map(toast => (
            <ToastNotification 
              key={toast.id}
              message={toast.message}
              onClose={() => removeToast(toast.id)}
              onUndo={toast.undoAction}
            />
          ))}
        </div>
      </div>
    </ProjectLayoutProvider>
  );
};

export default TaskStatusBoard; 