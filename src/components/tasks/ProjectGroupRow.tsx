import React from 'react';
import TaskCard from './TaskCard';
import TaskForm from './TaskForm';
import ProjectChip from './ProjectChip';
import { Icon } from '../ui/Icon';
import { triggerAuthenticationFlow } from '../../utils/authGuard';
import type { Task, Project } from '../../types/models';

interface ProjectGroupRowProps {
  project: Project | null;
  projectTasks: {
    pomodoro: Task[];
    todo: Task[];
    completed: Task[];
  };
  isExpanded: boolean;
  expandedProjects: Set<string>;
  onToggleProject: (projectId: string | null) => void;
  onStatusChange: (taskId: string, status: Task['status']) => void;
  onTaskReorder: (draggedTaskId: string, targetTaskId: string, insertAfter?: boolean) => void;
  onCrossColumnMove: (draggedTaskId: string, targetTaskId: string, newStatus: Task['status'], insertAfter?: boolean, targetProjectId?: string) => void;
  authStatus: any;
  allTasks: Task[];
  columnOrder: Task['status'][];
}

const ProjectGroupRow: React.FC<ProjectGroupRowProps> = ({
  project,
  projectTasks,
  isExpanded,
  expandedProjects,
  onToggleProject,
  onStatusChange,
  onTaskReorder,
  onCrossColumnMove,
  authStatus,
  allTasks,
  columnOrder,
}) => {
  const [isAddingTask, setIsAddingTask] = React.useState<{ [key: string]: boolean }>({});
  const projectId = project?.id || 'no-project';

  const handleAddTaskToggle = (status: Task['status'], adding: boolean) => {
    setIsAddingTask(prev => ({ ...prev, [status]: adding }));
  };

  return (
    <div className="project-group-row mb-6">
      <div className="grid grid-cols-3 gap-6">
        {columnOrder.map((status, index) => (
          <div key={status} className="flex flex-col">
            {/* Sticky Project Chip or Invisible Spacer - FIX: Ensure no pointer interference */}
            <div className="sticky top-[56px] z-20 bg-background-primary backdrop-blur-sm mb-4 pointer-events-none">
              <div className="pointer-events-auto">
              {index === 0 ? (
                <ProjectChip
                  project={project}
                  taskCount={projectTasks.pomodoro.length + projectTasks.todo.length + projectTasks.completed.length}
                  isExpanded={isExpanded}
                  onToggle={onToggleProject}
                />
              ) : (
                <div className="w-full flex items-center gap-2 pr-3 py-2 text-left rounded-lg opacity-0 pointer-events-none">
                  <div className="w-4 h-4"></div>
                  <div className="w-2.5 h-2.5"></div>
                  <span className="text-sm font-medium">.</span>
                  <div className="px-2 py-0.5 rounded-full text-xs">0</div>
                </div>
              )}
              </div>
            </div>
            
            {/* Tasks for this column when expanded */}
            {isExpanded && (
              <>
                <div className="space-y-3">
                  {projectTasks[status].map(task => (
                    <TaskCard 
                      key={task.id} 
                      task={task}
                      onStatusChange={onStatusChange}
                      onReorder={onTaskReorder}
                      onCrossColumnMove={(draggedTaskId: string, targetTaskId: string, newStatus: Task['status'], insertAfter?: boolean, targetProjectId?: string) => {
                        console.log(`🔧 ENHANCED ProjectGroupRow passing cross-column move:`, {
                          draggedTaskId,
                          targetTaskId, 
                          newStatus,
                          insertAfter,
                          targetProjectId: targetProjectId || 'undefined',
                          currentProject: projectId,
                          projectName: project?.name || 'No Project',
                          finalTargetProject: targetProjectId !== undefined ? targetProjectId : projectId
                        });
                        // CRITICAL: Pass the current project as the target project context
                        // If targetProjectId is explicitly provided, use it; otherwise use current project context
                        const finalTargetProjectId = targetProjectId !== undefined ? targetProjectId : projectId;
                        onCrossColumnMove(draggedTaskId, targetTaskId, newStatus, insertAfter, finalTargetProjectId);
                      }}
                      columnStatus={status}
                      context="task-management"
                      hideCheckbox={true}
                      targetProject={project}
                    />
                  ))}
                </div>
                <div className="mt-2">
                  {!isAddingTask[status] ? (
                    <button
                      className="flex items-center text-text-secondary hover:text-text-primary bg-background-primary hover:bg-background-container transition-colors duration-200 py-2 px-2 rounded focus:outline-none w-full"
                      onClick={() => {
                        if (!authStatus.isAuthenticated && authStatus.shouldShowAuth) {
                          triggerAuthenticationFlow();
                          return;
                        }
                        handleAddTaskToggle(status, true);
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
                      onCancel={() => handleAddTaskToggle(status, false)} 
                    />
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProjectGroupRow;