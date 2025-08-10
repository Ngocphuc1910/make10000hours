import React, { useState, useLayoutEffect, useRef } from 'react';
import type { Task, Project } from '../../types/models';
import { useTaskStore } from '../../store/taskStore';
import TaskCard from './TaskCard';
import TaskForm from './TaskForm';
import ProjectChips from './ProjectChips';
import { Icon } from '../ui/Icon';
import { useAuthGuard, triggerAuthenticationFlow } from '../../utils/authGuard';
import { useUIStore } from '../../store/uiStore';

interface TaskColumnProps {
  title: string;
  tasks: Task[];
  status: Task['status'];
  badgeColor: string;
  onStatusChange: (taskId: string, status: Task['status']) => void;
  groupByProject?: boolean;
  expandedProjects?: Set<string>;
  isFirstColumn?: boolean;
  projects?: Array<{ project: Project | null; taskCount: number }>;
  onToggleProject?: (projectId: string | null) => void;
  allTasks?: Task[];
  hideHeader?: boolean;
  projectId?: string; // Add projectId prop for by-project view
}

const TaskColumn: React.FC<TaskColumnProps> = ({
  title,
  tasks,
  status,
  badgeColor,
  onStatusChange,
  groupByProject = false,
  expandedProjects = new Set(),
  isFirstColumn = false,
  projects = [],
  onToggleProject,
  allTasks = [],
  hideHeader = false,
  projectId
}) => {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const reorderTasks = useTaskStore(state => state.reorderTasks);
  const moveTaskToStatusAndPosition = useTaskStore(state => state.moveTaskToStatusAndPosition);
  const allProjects = useTaskStore(state => state.projects);
  const authStatus = useAuthGuard();
  const { isLeftSidebarOpen } = useUIStore();
  

  // Handle task card reordering within the same column
  const handleTaskReorder = (draggedTaskId: string, targetTaskId: string, insertAfter: boolean = false) => {
    const draggedTask = tasks.find(t => t.id === draggedTaskId);
    const targetTask = tasks.find(t => t.id === targetTaskId);
    
    if (!draggedTask || !targetTask || draggedTask.status !== targetTask.status) {
      return;
    }

    // Calculate new index based on where we're dropping
    const allTasks = useTaskStore.getState().tasks;
    const targetIndex = allTasks.findIndex(t => t.id === targetTaskId);
    const newIndex = insertAfter ? targetIndex + 1 : targetIndex;
    
    reorderTasks(draggedTaskId, newIndex);
  };

  // Handle cross-column moves with positioning
  const handleCrossColumnMove = async (draggedTaskId: string, targetTaskId: string, newStatus: Task['status'], insertAfter: boolean = false) => {
    // Calculate the target position in the destination column
    const allTasks = useTaskStore.getState().tasks;
    const targetIndex = allTasks.findIndex(t => t.id === targetTaskId);
    const finalIndex = insertAfter ? targetIndex + 1 : targetIndex;
    
    // Use the atomic method to move task with status and position in one operation
    // Note: This method is now optimized to only update tasks that actually changed
    moveTaskToStatusAndPosition(draggedTaskId, newStatus, finalIndex);
  };

  // Utility function to group tasks by project
  const groupTasksByProject = (tasks: Task[]): Array<{ project: Project | null; tasks: Task[] }> => {
    const grouped = new Map<string | null, Task[]>();
    
    tasks.forEach(task => {
      const projectId = task.projectId || null;
      if (!grouped.has(projectId)) {
        grouped.set(projectId, []);
      }
      grouped.get(projectId)!.push(task);
    });
    
    // Convert to array and sort by task count (descending)
    const groupedArray = Array.from(grouped.entries()).map(([projectId, tasks]) => ({
      project: projectId ? allProjects.find(p => p.id === projectId) || null : null,
      tasks
    }));
    
    return groupedArray.sort((a, b) => b.tasks.length - a.tasks.length);
  };

  // Get visible project groups based on expanded state
  const getVisibleProjectGroups = (tasks: Task[]) => {
    if (!groupByProject) {
      return [{ project: null, tasks }]; // Return all tasks in one group for flat view
    }
    
    // For first column, return grouped projects
    if (isFirstColumn) {
      return groupTasksByProject(tasks).filter(({ project }) => {
        const projectId = project?.id || 'no-project';
        return expandedProjects.has(projectId);
      });
    }
    
    // For non-first columns, return flat list of tasks from expanded projects only
    const filteredTasks = tasks.filter(task => {
      const taskProjectId = task.projectId || 'no-project';
      return expandedProjects.has(taskProjectId);
    });
    
    return [{ project: null, tasks: filteredTasks }];
  };

  
  return (
    <div className="status-section flex flex-col flex-1">
      {/* Status Section Header - conditionally rendered */}
      {!hideHeader && (
        <div className={`status-section-header pr-4 py-2 sticky top-0 z-20 border-b border-border ${isLeftSidebarOpen ? 'pl-4' : ''}`} style={{ backgroundColor: '#ffffff' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* Larger colored dot */}
              <span className={`w-3 h-3 rounded-full ${
                status === 'pomodoro' ? 'bg-red-500' :
                status === 'todo' ? 'bg-blue-500' :
                status === 'completed' ? 'bg-green-500' : ''
              }`}></span>
              
              {/* Status title */}
              <h3 className="text-base font-semibold text-text-primary">{title}</h3>
              
              {/* Task count badge */}
              <span className="text-sm font-medium text-text-secondary bg-background-container px-3 py-1 rounded-full">
                {tasks.length}
              </span>
            </div>
            
            {/* Detail/More icon */}
            <button 
              className="p-2 rounded-full hover:bg-background-container group"
              onClick={() => {
                if (!authStatus.isAuthenticated && authStatus.shouldShowAuth) {
                  triggerAuthenticationFlow();
                  return;
                }
                setIsAddingTask(true);
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
          </div>
        </div>
      )}
      
      {/* Task List Container */}
      <div 
        className={`task-list-container pb-6 ${hideHeader ? 'pt-4' : 'pt-4'} flex-1 ${isLeftSidebarOpen ? 'pl-6' : ''}`}
      >
        {/* Project-based layout with uniform height blocks */}
        {groupByProject && projects.length > 0 && (
          <div className="space-y-1">
            {projects.map(({ project }) => {
              const projectId = project?.id || 'no-project';
              const isExpanded = expandedProjects.has(projectId);
              
              return (
                <div key={`project-container-${projectId}`} className="mb-4">
                  {/* Project Chips - only show in first column */}
                  {isFirstColumn && (
                    <div className="mb-4">
                      <ProjectChips
                        projects={[{ project, taskCount: 0 }]}
                        expandedProjects={expandedProjects}
                        onToggleProject={onToggleProject!}
                        allTasks={allTasks}
                        onStatusChange={onStatusChange}
                        columnStatus={status}
                      />
                    </div>
                  )}
                  
                  {/* Spacer for non-first columns to align with chip */}
                  {!isFirstColumn && (
                    <div style={{ height: '67px' }} className="mb-4" />
                  )}
                  
                  {/* Project tasks - show for expanded projects with uniform height */}
                  {isExpanded && (
                    (() => {
                      // Get tasks for this project across ALL columns
                      const allProjectTasks = {
                        pomodoro: allTasks.filter(task => (task.projectId || 'no-project') === projectId && task.status === 'pomodoro'),
                        todo: allTasks.filter(task => (task.projectId || 'no-project') === projectId && task.status === 'todo'),
                        completed: allTasks.filter(task => (task.projectId || 'no-project') === projectId && task.status === 'completed')
                      };
                      
                      // Find the maximum number of tasks across all columns
                      const maxTasksInProject = Math.max(
                        allProjectTasks.pomodoro.length,
                        allProjectTasks.todo.length,
                        allProjectTasks.completed.length
                      );
                      
                      // Get tasks for current column
                      const currentColumnTasks = allProjectTasks[status as keyof typeof allProjectTasks];
                      
                      // Calculate uniform height for all columns
                      const taskHeight = 84; // Each task card height including spacing
                      const buttonHeight = 50; // New task button height
                      const uniformHeight = (maxTasksInProject * taskHeight) + buttonHeight + 40; // +40 for margins
                      
                      return (
                        <div 
                          className="mb-8"
                          style={{ minHeight: `${uniformHeight}px` }}
                        >
                          {/* Render tasks */}
                          <div className="space-y-3">
                            {currentColumnTasks.map(task => (
                              <TaskCard 
                                key={task.id} 
                                task={task}
                                onStatusChange={onStatusChange}
                                onReorder={handleTaskReorder}
                                onCrossColumnMove={handleCrossColumnMove}
                                columnStatus={status}
                                context="task-management"
                              />
                            ))}
                          </div>
                          
                          {/* Fill space if this column has fewer tasks */}
                          {currentColumnTasks.length < maxTasksInProject && (
                            <div 
                              style={{ 
                                height: `${(maxTasksInProject - currentColumnTasks.length) * taskHeight}px` 
                              }}
                            />
                          )}
                          
                          {/* New Task button */}
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
                                status={status} 
                                initialProjectId={projectId}
                                onCancel={() => setIsAddingTask(false)} 
                              />
                            )}
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              );
            })}
          </div>
        )}


        
        {/* Show tasks that don't belong to any project in the project list */}
        {groupByProject && projects.length > 0 && (
          <div className="space-y-3">
            {tasks
              .filter(task => {
                const taskProjectId = task.projectId || 'no-project';
                // Only show tasks that don't belong to any project in the projects list
                const belongsToProjectInList = projects.some(({ project }) => 
                  (project?.id || 'no-project') === taskProjectId
                );
                return !belongsToProjectInList;
              })
              .map(task => (
                <TaskCard 
                  key={task.id} 
                  task={task}
                  onStatusChange={onStatusChange}
                  onReorder={handleTaskReorder}
                  onCrossColumnMove={handleCrossColumnMove}
                  columnStatus={status}
                  context="task-management"
                />
              ))
            }
          </div>
        )}

        {/* Original task groups for non-grouped view */}
        {!groupByProject && (
          <div className="space-y-4">
            {getVisibleProjectGroups(tasks).map(({ project, tasks: groupTasks }) => {
              const projectId = project?.id || 'no-project';
              
              return (
                <div key={`${status}-${projectId}`} className="project-section">
                  {/* Tasks in this group */}
                  <div className="space-y-3">
                    {groupTasks.map(task => (
                      <TaskCard 
                        key={task.id} 
                        task={task}
                        onStatusChange={onStatusChange}
                        onReorder={handleTaskReorder}
                        onCrossColumnMove={handleCrossColumnMove}
                        columnStatus={status}
                        context="task-management"
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* New Task Button - only show when not grouping by project */}
        {!groupByProject && (
          <div className="mt-2">
            {!isAddingTask ? (
              <div className="sticky top-16 bg-background-primary/95 backdrop-blur-sm pt-1 -mx-4 px-4">
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
              </div>
            ) : (
              <TaskForm 
                status={status} 
                initialProjectId={projectId} 
                onCancel={() => setIsAddingTask(false)} 
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskColumn; 