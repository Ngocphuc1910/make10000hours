import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { useTaskStore } from '../../store/taskStore';
import { useUIStore } from '../../store/uiStore';
import { useUserStore } from '../../store/userStore';
import type { Task, Project } from '../../types/models';
import { TaskColumn } from './';
import ProjectColumn from './ProjectColumn';
import { ToastNotification } from './';
import TaskCard from './TaskCard';
import TaskForm from './TaskForm';
import { ProjectLayoutProvider } from '../../contexts/ProjectLayoutContext';
import StatusGroupRow from './StatusGroupRow';
import DraggableColumnHeader from './DraggableColumnHeader';
import { Icon } from '../ui/Icon';
import ColorPicker from '../ui/ColorPicker';
import { triggerAuthenticationFlow } from '../../utils/authGuard';
import { sortTasksByOrder } from '../../utils/taskSorting';

interface ProjectStatusBoardProps {
  className?: string;
  groupByStatus?: boolean;
}

type ToastMessage = {
  id: string;
  message: string;
  taskId?: string;
  undoAction?: () => void;
};

const ProjectStatusBoard: React.FC<ProjectStatusBoardProps> = ({ className = '', groupByStatus = false }) => {
  const tasks = useTaskStore(state => state.tasks);
  const projects = useTaskStore(state => state.projects);
  const updateTaskStatus = useTaskStore(state => state.updateTaskStatus);
  const updateTask = useTaskStore(state => state.updateTask);
  const moveTaskToProject = useTaskStore(state => state.moveTaskToProject);
  const reorderTasks = useTaskStore(state => state.reorderTasks);
  const projectColumnOrder = useTaskStore(state => state.projectColumnOrder);
  const reorderProjectColumns = useTaskStore(state => state.reorderProjectColumns);
  const updateProject = useTaskStore(state => state.updateProject);
  const deleteProject = useTaskStore(state => state.deleteProject);
  const { isLeftSidebarOpen } = useUIStore();
  const isAuthenticated = useUserStore(state => state.isAuthenticated);
  const authStatus = useMemo(() => ({ 
    isAuthenticated, 
    shouldShowAuth: true 
  }), [isAuthenticated]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [expandedStatuses, setExpandedStatuses] = useState<Set<string>>(new Set());
  const [isAddingTask, setIsAddingTask] = useState<{ [key: string]: boolean }>({});
  const [showProjectDropdown, setShowProjectDropdown] = useState<{ [key: string]: boolean }>({});
  const [showColorPicker, setShowColorPicker] = useState<{ [key: string]: boolean }>({});
  const [tempProjectColors, setTempProjectColors] = useState<{ [key: string]: string }>({});
  
  // Refs for scroll synchronization
  const headersRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const groupedContentRef = useRef<HTMLDivElement>(null);

  // Get all projects with tasks, including "No Project"
  const projectsWithTasks = React.useMemo(() => {
    const projectTaskCounts = new Map<string, number>();
    
    // Count tasks for each project (including null/undefined as 'no-project')
    tasks.forEach(task => {
      const projectId = task.projectId || 'no-project';
      projectTaskCounts.set(projectId, (projectTaskCounts.get(projectId) || 0) + 1);
    });
    
    const projectsWithTasksList: Array<{ project: Project | null; taskCount: number; id: string }> = [];
    const seenProjects = new Set<string>();
    
    projectTaskCounts.forEach((taskCount, projectId) => {
      if (projectId === 'no-project') {
        if (!seenProjects.has('no-project')) {
          projectsWithTasksList.push({
            project: null,
            taskCount,
            id: 'no-project'
          });
          seenProjects.add('no-project');
        }
      } else {
        const foundProject = projects.find(p => p.id === projectId);
        if (foundProject && !seenProjects.has(projectId)) {
          projectsWithTasksList.push({
            project: foundProject,
            taskCount,
            id: projectId
          });
          seenProjects.add(projectId);
        }
      }
    });
    
    // Sort by task count (descending) as default
    return projectsWithTasksList.sort((a, b) => b.taskCount - a.taskCount);
  }, [tasks, projects]);

  // Initialize project column order if empty
  React.useEffect(() => {
    if (projectColumnOrder.length === 0 && projectsWithTasks.length > 0) {
      const initialOrder = projectsWithTasks.map(p => p.id);
      reorderProjectColumns(initialOrder);
    }
  }, [projectsWithTasks, projectColumnOrder, reorderProjectColumns]);

  // Get ordered projects based on column order
  const orderedProjects = React.useMemo(() => {
    if (projectColumnOrder.length === 0) return projectsWithTasks;
    
    const orderedList: typeof projectsWithTasks = [];
    
    // Add projects in the specified order
    projectColumnOrder.forEach(projectId => {
      const projectData = projectsWithTasks.find(p => p.id === projectId);
      if (projectData) {
        orderedList.push(projectData);
      }
    });
    
    // Add any new projects not in the order
    projectsWithTasks.forEach(projectData => {
      if (!projectColumnOrder.includes(projectData.id)) {
        orderedList.push(projectData);
      }
    });
    
    return orderedList;
  }, [projectsWithTasks, projectColumnOrder]);

  // Filter tasks by project and sort them by order
  const getProjectTasks = useCallback((projectId: string) => {
    const actualProjectId = projectId === 'no-project' ? null : projectId;
    const projectTasks = tasks.filter(task => (task.projectId || null) === actualProjectId);
    return sortTasksByOrder(projectTasks);
  }, [tasks]);

  // Scroll synchronization between headers and content
  useEffect(() => {
    const headersElement = headersRef.current;
    const contentElement = groupByStatus ? groupedContentRef.current : contentRef.current;
    
    if (!headersElement || !contentElement) return;

    let isHeaderScrolling = false;
    let isContentScrolling = false;

    const syncHeaderScroll = (e: Event) => {
      if (isContentScrolling) return;
      isHeaderScrolling = true;
      const target = e.target as HTMLDivElement;
      contentElement.scrollLeft = target.scrollLeft;
      setTimeout(() => { isHeaderScrolling = false; }, 50);
    };

    const syncContentScroll = (e: Event) => {
      if (isHeaderScrolling) return;
      isContentScrolling = true;
      const target = e.target as HTMLDivElement;
      headersElement.scrollLeft = target.scrollLeft;
      setTimeout(() => { isContentScrolling = false; }, 50);
    };

    headersElement.addEventListener('scroll', syncHeaderScroll);
    contentElement.addEventListener('scroll', syncContentScroll);

    return () => {
      headersElement.removeEventListener('scroll', syncHeaderScroll);
      contentElement.removeEventListener('scroll', syncContentScroll);
    };
  }, [groupByStatus, orderedProjects]);

  // Project dropdown handlers
  const handleProjectDropdownToggle = (projectId: string) => {
    setShowProjectDropdown(prev => ({ 
      ...prev, 
      [projectId]: !prev[projectId] 
    }));
  };

  const handleEditProjectName = (projectId: string) => {
    const project = projectId === 'no-project' ? null : projects.find(p => p.id === projectId);
    if (project) {
      const newName = prompt('Enter new project name:', project.name);
      if (newName && newName.trim() && newName !== project.name) {
        handleSaveProjectName(projectId, newName.trim());
      }
      setShowProjectDropdown(prev => ({ ...prev, [projectId]: false }));
    }
  };

  const handleSaveProjectName = async (projectId: string, newName: string) => {
    if (newName && newName.trim() && projectId !== 'no-project') {
      try {
        await updateProject(projectId, { name: newName.trim() });
        addToast('Project name updated');
      } catch (error) {
        console.error('Failed to update project name:', error);
        addToast('Failed to update project name');
      }
    }
  };

  const handleProjectColorChange = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      setTempProjectColors(prev => ({ ...prev, [projectId]: project.color }));
      setShowColorPicker(prev => ({ ...prev, [projectId]: true }));
      setShowProjectDropdown(prev => ({ ...prev, [projectId]: false }));
    }
  };

  const handleColorChange = (projectId: string, color: string) => {
    setTempProjectColors(prev => ({ ...prev, [projectId]: color }));
  };

  const handleColorSave = async (projectId: string) => {
    const newColor = tempProjectColors[projectId];
    if (newColor && projectId !== 'no-project') {
      try {
        await updateProject(projectId, { color: newColor });
        setShowColorPicker(prev => ({ ...prev, [projectId]: false }));
        setTempProjectColors(prev => ({ ...prev, [projectId]: '' }));
        addToast('Project color updated');
      } catch (error) {
        console.error('Failed to update project color:', error);
        addToast('Failed to update project color');
      }
    }
  };

  const handleColorPickerClose = (projectId: string) => {
    setShowColorPicker(prev => ({ ...prev, [projectId]: false }));
    setTempProjectColors(prev => ({ ...prev, [projectId]: '' }));
  };

  const handleDeleteProject = async (projectId: string) => {
    if (projectId !== 'no-project') {
      const project = projects.find(p => p.id === projectId);
      const projectName = project?.name || 'this project';
      
      if (confirm(`Are you sure you want to delete "${projectName}"? This action cannot be undone.`)) {
        try {
          await deleteProject(projectId);
          setShowProjectDropdown(prev => ({ ...prev, [projectId]: false }));
          addToast('Project deleted');
        } catch (error) {
          console.error('Failed to delete project:', error);
          addToast('Failed to delete project');
        }
      } else {
        setShowProjectDropdown(prev => ({ ...prev, [projectId]: false }));
      }
    }
  };

  // Column configurations for projects
  const columnConfigs = React.useMemo(() => {
    const configs: Record<string, { title: string; color: string; tasks: Task[] }> = {};
    
    orderedProjects.forEach(({ project, id }) => {
      const projectTasks = getProjectTasks(id);
      configs[id] = {
        title: project?.name || 'No Project',
        color: project?.color || '#6B7280',
        tasks: projectTasks
      };
    });
    
    return configs;
  }, [orderedProjects, getProjectTasks]);

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

  // Handle task project change
  const handleTaskProjectChange = async (taskId: string, newProjectId: string | null, targetIndex?: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const oldProjectId = task.projectId || null;
    
    try {
      await moveTaskToProject(taskId, newProjectId, targetIndex);

      // Create toast message
      const oldProject = oldProjectId ? projects.find(p => p.id === oldProjectId)?.name : 'No Project';
      const newProject = newProjectId ? projects.find(p => p.id === newProjectId)?.name : 'No Project';
      const message = `Task moved from ${oldProject} to ${newProject}`;

      // Add toast with undo action
      addToast(message, taskId, () => {
        moveTaskToProject(taskId, oldProjectId);
      });
    } catch (error) {
      console.error('Failed to move task to project:', error);
      addToast('Failed to move task between projects');
    }
  };

  // Handle task reordering within same project
  const handleTaskReorder = async (draggedTaskId: string, targetTaskId: string, insertAfter: boolean) => {
    const draggedTask = tasks.find(t => t.id === draggedTaskId);
    const targetTask = tasks.find(t => t.id === targetTaskId);
    
    if (!draggedTask || !targetTask) return;

    console.log(`🔄 PROJECT REORDER: ${draggedTask.title} relative to ${targetTask.title} (insertAfter: ${insertAfter})`);

    try {
      // Import necessary utilities
      const { sortTasksByOrder } = await import('../../utils/taskSorting');
      const { FractionalOrderingService } = await import('../../services/FractionalOrderingService');
      const { getTaskPosition } = await import('../../utils/taskSorting');
      
      // FIXED: Get tasks in same PROJECT AND SAME STATUS for grouped view
      const projectTasks = sortTasksByOrder(
        tasks.filter(t => 
          (t.projectId || null) === (draggedTask.projectId || null) && 
          t.status === draggedTask.status && // Add status filter for grouped view
          t.id !== draggedTaskId
        )
      );
      
      const targetIndex = projectTasks.findIndex(t => t.id === targetTaskId);
      const finalIndex = insertAfter ? targetIndex + 1 : Math.max(0, targetIndex);
      const clampedIndex = Math.max(0, Math.min(finalIndex, projectTasks.length));
      
      // Get adjacent positions for fractional indexing
      const beforeTask = clampedIndex > 0 ? projectTasks[clampedIndex - 1] : null;
      const afterTask = clampedIndex < projectTasks.length ? projectTasks[clampedIndex] : null;
      
      const beforePos = beforeTask ? getTaskPosition(beforeTask) : null;
      const afterPos = afterTask ? getTaskPosition(afterTask) : null;
      
      // Generate new fractional position
      const newOrderString = FractionalOrderingService.generatePosition(beforePos, afterPos);
      
      console.log(`🎯 PROJECT REORDER CALCULATION:`, {
        draggedTask: draggedTask.title,
        targetTask: targetTask.title,
        project: draggedTask.projectId || 'Dashboard',
        status: draggedTask.status,
        projectTasksCount: projectTasks.length,
        targetIndex,
        finalIndex,
        clampedIndex,
        beforeTask: beforeTask?.title || 'START',
        afterTask: afterTask?.title || 'END',
        newOrderString
      });
      
      // Update the task with new position
      await updateTask(draggedTaskId, {
        orderString: newOrderString
      });
      
      addToast('Task reordered successfully');
    } catch (error) {
      console.error('Failed to reorder tasks:', error);
      addToast('Failed to reorder task');
    }
  };

  // Handle cross-column moves for grouped status view
  const handleGroupedCrossColumnMove = async (draggedTaskId: string, targetTaskId: string, newStatus: Task['status'], newProjectId: string, insertAfter: boolean = false) => {
    const draggedTask = tasks.find(t => t.id === draggedTaskId);
    if (!draggedTask) return;

    const actualNewProjectId = newProjectId === 'no-project' ? null : newProjectId;
    const currentProjectId = draggedTask.projectId || null;
    const isProjectChange = currentProjectId !== actualNewProjectId;
    const isStatusChange = draggedTask.status !== newStatus;

    console.log(`🚀 GROUPED CROSS-COLUMN MOVE:`, {
      draggedTask: draggedTask.title,
      currentProject: currentProjectId || 'Dashboard',
      newProject: actualNewProjectId || 'Dashboard',
      currentStatus: draggedTask.status,
      newStatus,
      isProjectChange,
      isStatusChange,
      insertAfter
    });

    try {
      // Calculate position in destination project+status combination
      const destinationTasks = sortTasksByOrder(
        tasks.filter(t => 
          t.status === newStatus && 
          (t.projectId || null) === actualNewProjectId &&
          t.id !== draggedTaskId
        )
      );

      const targetIndex = destinationTasks.findIndex(t => t.id === targetTaskId);
      const finalIndex = insertAfter ? targetIndex + 1 : Math.max(0, targetIndex);
      const clampedIndex = Math.max(0, Math.min(finalIndex, destinationTasks.length));

      // Get adjacent positions for fractional indexing
      const beforeTask = clampedIndex > 0 ? destinationTasks[clampedIndex - 1] : null;
      const afterTask = clampedIndex < destinationTasks.length ? destinationTasks[clampedIndex] : null;
      
      const { getTaskPosition } = await import('../../utils/taskSorting');
      const { FractionalOrderingService } = await import('../../services/FractionalOrderingService');
      
      const beforePos = beforeTask ? getTaskPosition(beforeTask) : null;
      const afterPos = afterTask ? getTaskPosition(afterTask) : null;
      const newOrderString = FractionalOrderingService.generatePosition(beforePos, afterPos);

      // Prepare updates object
      const updates: Partial<Task> = {
        orderString: newOrderString,
        ...(isProjectChange && { projectId: actualNewProjectId }),
        ...(isStatusChange && {
          status: newStatus,
          completed: newStatus === 'completed' ? true : (draggedTask.status === 'completed' ? false : draggedTask.completed),
          hideFromPomodoro: newStatus === 'pomodoro' ? false : (draggedTask.hideFromPomodoro ?? false)
        })
      };


      // Single atomic update
      await updateTask(draggedTaskId, updates);

      console.log(`✅ GROUPED MOVE SUCCESS:`, {
        projectChange: isProjectChange ? `${currentProjectId || 'Dashboard'} → ${actualNewProjectId || 'Dashboard'}` : 'none',
        statusChange: isStatusChange ? `${draggedTask.status} → ${newStatus}` : 'none',
        orderString: newOrderString
      });

      // Toast notification
      const projectName = actualNewProjectId ? projects.find(p => p.id === actualNewProjectId)?.name || 'Unknown Project' : 'Dashboard';
      const statusName = newStatus === 'pomodoro' ? 'In Pomodoro' : newStatus === 'todo' ? 'To Do List' : 'Completed';
      
      if (isProjectChange && isStatusChange) {
        addToast(`Task moved to ${projectName} - ${statusName}`);
      } else if (isProjectChange) {
        addToast(`Task moved to ${projectName}`);
      } else if (isStatusChange) {
        addToast(`Task moved to ${statusName}`);
      }

    } catch (error) {
      console.error('❌ Grouped cross-column move failed:', error);
      addToast('Failed to move task - please try again');
    }
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

  // Handle adding task toggle for grouped view
  const handleAddTaskToggle = useCallback((status: Task['status'], projectId: string, adding: boolean) => {
    const key = `${status}-${projectId}`;
    setIsAddingTask(prev => ({ ...prev, [key]: adding }));
  }, []);

  // Toggle status expansion
  const toggleStatusExpansion = (status: Task['status']) => {
    setExpandedStatuses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(status)) {
        newSet.delete(status);
      } else {
        newSet.add(status);
      }
      return newSet;
    });
  };

  // Click outside handler to close dropdowns (but not ColorPicker modal)
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Don't close if clicking inside project dropdown OR ColorPicker modal
      if (!target.closest('.project-dropdown') && !target.closest('[data-color-picker-modal]')) {
        setShowProjectDropdown({});
        // Don't close ColorPicker here - it has its own click-outside handler
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle column drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = projectColumnOrder.indexOf(active.id as string);
      const newIndex = projectColumnOrder.indexOf(over.id as string);
      
      const newOrder = [...projectColumnOrder];
      const [movedItem] = newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, movedItem);
      
      reorderProjectColumns(newOrder);
    }
  };

  // Group tasks by status for status grouping
  const statusGroups = React.useMemo(() => {
    if (!groupByStatus) return null;
    
    return orderedProjects.map(({ project, id }) => {
      const projectTasks = getProjectTasks(id);
      
      return {
        project,
        projectId: id,
        statusTasks: {
          pomodoro: projectTasks.filter(t => t.status === 'pomodoro'),
          todo: projectTasks.filter(t => t.status === 'todo'),
          completed: projectTasks.filter(t => t.status === 'completed')
        }
      };
    });
  }, [orderedProjects, groupByStatus, getProjectTasks]);

  return (
    <ProjectLayoutProvider>
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className={`flex flex-col bg-background-primary ${className}`}>
          {/* Fixed Headers Row */}
          <SortableContext items={projectColumnOrder} strategy={horizontalListSortingStrategy}>
            <div 
              className="grid gap-6 bg-background-primary sticky top-0 z-30 pl-2 pt-4 overflow-x-auto scrollbar-hide" 
              style={{ gridTemplateColumns: `repeat(${orderedProjects.length}, minmax(320px, 1fr))` }}
              ref={headersRef}
            >
              {orderedProjects.map(({ project, id }) => {
                const config = columnConfigs[id];
                return (
                  <DraggableColumnHeader
                    key={id}
                    id={id}
                    status={id as any} // This is a bit of a hack, but DraggableColumnHeader expects status
                    title={config.title}
                    taskCount={config.tasks.length}
                    color={config.color}
                  >
                    <div className="relative project-dropdown">
                      <button 
                        className="p-2 rounded-full hover:bg-background-container group"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProjectDropdownToggle(id);
                        }}
                      >
                        <div className="w-4 h-4 flex items-center justify-center text-text-secondary group-hover:text-text-primary">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="5" r="2"/>
                            <circle cx="12" cy="12" r="2"/>
                            <circle cx="12" cy="19" r="2"/>
                          </svg>
                        </div>
                      </button>
                      
                      {/* Project Dropdown Menu */}
                      {showProjectDropdown[id] && id !== 'no-project' && (
                        <div className="absolute right-0 mt-2 w-48 bg-background-secondary border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                          <div className="py-1 px-2">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleProjectColorChange(id);
                              }}
                              className="w-full px-3 py-2 text-sm text-text-primary hover:bg-background-container text-left flex items-center transition-colors duration-200 rounded-md"
                            >
                              <Icon name="palette-line" size={16} className="mr-2" />
                              Edit project color
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditProjectName(id);
                              }}
                              className="w-full px-3 py-2 text-sm text-text-primary hover:bg-background-container text-left flex items-center transition-colors duration-200 rounded-md"
                            >
                              <Icon name="edit-line" size={16} className="mr-2" />
                              Edit project name
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProject(id);
                              }}
                              className="w-full px-3 py-2 text-sm text-red-600 hover:bg-red-500/10 text-left flex items-center transition-colors duration-200 rounded-md"
                            >
                              <Icon name="delete-bin-line" size={16} className="mr-2" />
                              Delete project
                            </button>
                          </div>
                        </div>
                      )}
                      
                    </div>
                  </DraggableColumnHeader>
                );
              })}
            </div>
          </SortableContext>

          {/* Scrollable Content Row */}
          <div className="flex flex-col flex-1 overflow-hidden">
            {groupByStatus ? (
              /* Status Group Rows spanning all projects */
              <div className={`flex-1 overflow-hidden`}>
                <div 
                  className={`pr-6 pb-6 ${isLeftSidebarOpen ? 'pl-6' : 'pl-2'} overflow-y-auto overflow-x-auto scrollbar-hide`}
                  ref={groupedContentRef}
                >
                  {['pomodoro', 'todo', 'completed'].map((status: Task['status']) => (
                    <div key={status} className="mb-6">
                      {/* Status Chip spanning all columns */}
                      <div className="sticky bg-background-primary backdrop-blur-sm mb-4 top-0 z-20">
                        <div className="flex items-center gap-2 pr-2 py-2 rounded-lg cursor-pointer" onClick={() => toggleStatusExpansion(status)}>
                          <div className={`flex items-center justify-center w-4 h-4 transition-transform duration-200 ${
                            expandedStatuses.has(status) ? 'rotate-90' : 'rotate-0'
                          }`}>
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-text-secondary">
                              <path 
                                d="M4.5 3L7.5 6L4.5 9" 
                                stroke="currentColor" 
                                strokeWidth="1.5" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                          <div 
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: status === 'pomodoro' ? '#EF4444' : status === 'todo' ? '#3B82F6' : '#10B981' }}
                          />
                          <span className="text-sm font-medium text-text-primary flex-1">
                            {status === 'pomodoro' ? 'In Pomodoro' : status === 'todo' ? 'To Do List' : 'Completed'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Tasks for this status distributed across project columns */}
                      {expandedStatuses.has(status) && (
                        <div 
                          className={`grid gap-6 mb-4`} 
                          style={{ gridTemplateColumns: `repeat(${orderedProjects.length}, minmax(320px, 1fr))` }}
                        >
                        {orderedProjects.map(({ project, id }) => {
                          const projectTasks = getProjectTasks(id).filter(t => t.status === status);
                          const addTaskKey = `${status}-${id}`;
                          return (
                            <div 
                              key={`${status}-${id}`} 
                              className="flex flex-col min-h-[120px]"
                              onDragOver={(e) => {
                                e.preventDefault();
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                
                                const taskId = e.dataTransfer.getData('text/plain');
                                if (taskId) {
                                  console.log(`📥 Grouped column drop: Moving task ${taskId} to ${status} in project ${id}`);
                                  handleGroupedCrossColumnMove(taskId, '', status, id, false);
                                }
                              }}
                            >
                              <div className="space-y-3">
                                {projectTasks.map(task => (
                                  <TaskCard 
                                    key={task.id} 
                                    task={task}
                                    onStatusChange={handleTaskStatusChange}
                                    onReorder={(draggedTaskId: string, targetTaskId: string, insertAfter: boolean) => 
                                      handleTaskReorder(draggedTaskId, targetTaskId, insertAfter)
                                    }
                                    onCrossColumnMove={(draggedTaskId: string, targetTaskId: string, newStatus: Task['status'], insertAfter?: boolean) => 
                                      handleGroupedCrossColumnMove(draggedTaskId, targetTaskId, newStatus, id, insertAfter || false)
                                    }
                                    columnStatus={status}
                                    context="task-management"
                                    hideCheckbox={true}
                                  />
                                ))}
                              </div>
                              
                              {/* New Task button for this status in this project */}
                              <div className="mt-2">
                                {!isAddingTask[addTaskKey] ? (
                                  <button
                                    className="flex items-center text-text-secondary hover:text-text-primary bg-background-primary hover:bg-background-container transition-colors duration-200 py-2 px-2 rounded focus:outline-none w-full"
                                    onClick={() => {
                                      if (!authStatus.isAuthenticated && authStatus.shouldShowAuth) {
                                        triggerAuthenticationFlow();
                                        return;
                                      }
                                      handleAddTaskToggle(status, id, true);
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
                                    initialProjectId={id === 'no-project' ? undefined : id}
                                    onCancel={() => handleAddTaskToggle(status, id, false)} 
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
                </div>
              </div>
            ) : (
              /* Traditional Project Column Layout */
              <div 
                className="grid gap-6 flex-1 pl-2 pt-1 overflow-x-auto scrollbar-hide" 
                style={{ gridTemplateColumns: `repeat(${orderedProjects.length}, minmax(320px, 1fr))` }}
                ref={contentRef}
              >
                {orderedProjects.map(({ project, id }, index) => {
                  const config = columnConfigs[id];
                  return (
                    <ProjectColumn
                      key={id}
                      project={project}
                      tasks={config.tasks}
                      onProjectChange={handleTaskProjectChange}
                      onStatusChange={handleTaskStatusChange}
                      onTaskReorder={handleTaskReorder}
                      title={config.title}
                      taskCount={config.tasks.length}
                      color={config.color}
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
      </DndContext>
      
      {/* Color Picker Modals */}
      {Object.entries(showColorPicker).map(([projectId, isOpen]) => {
        const project = projects.find(p => p.id === projectId);
        if (!isOpen || !project || projectId === 'no-project') return null;
        
        return (
          <ColorPicker
            key={projectId}
            isOpen={isOpen}
            onClose={() => handleColorPickerClose(projectId)}
            currentColor={tempProjectColors[projectId] || project.color}
            onColorChange={(color) => handleColorChange(projectId, color)}
            onSave={() => handleColorSave(projectId)}
          />
        );
      })}
    </ProjectLayoutProvider>
  );
};

export default ProjectStatusBoard;