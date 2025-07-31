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
  onCrossColumnMove: (draggedTaskId: string, targetTaskId: string, newStatus: Task['status'], insertAfter?: boolean) => void;
  authStatus: any;
  allTasks: Task[];
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
}) => {
  const [isAddingTask, setIsAddingTask] = React.useState<{ [key: string]: boolean }>({});
  const projectId = project?.id || 'no-project';

  const handleAddTaskToggle = (status: Task['status'], adding: boolean) => {
    setIsAddingTask(prev => ({ ...prev, [status]: adding }));
  };

  const renderColumn = (status: Task['status'], tasks: Task[], isFirstColumn: boolean) => (
    <div className="project-column flex flex-col">
      {/* Project chip only in first column */}
      {isFirstColumn ? (
        <div className="mb-4">
          <ProjectChip
            project={project}
            taskCount={tasks.length} // Show task count for this specific column
            isExpanded={isExpanded}
            onToggle={onToggleProject}
          />
        </div>
      ) : (
        /* Spacer for alignment with chip in first column - precise measurements */
        <div className="mb-4">
          {/* Exact match for ProjectChip: px-3 py-2 + content height */}
          <div className="w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg opacity-0 pointer-events-none">
            <div className="w-4 h-4"></div> {/* Arrow space */}
            <div className="w-2.5 h-2.5"></div> {/* Color dot space */}
            <span className="text-sm font-medium">.</span> {/* Text height */}
            <div className="px-2 py-0.5 rounded-full text-xs">0</div> {/* Badge space */}
          </div>
        </div>
      )}

      {/* Tasks when expanded */}
      {isExpanded && (
        <div className="flex flex-col">
          {/* Task list */}
          <div className="space-y-3">
            {tasks.map(task => (
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
          
          {/* New Task button - right below tasks */}
          <div className="mt-2">
            {!isAddingTask[status] ? (
              <button
                className="flex items-center text-text-secondary hover:text-text-primary hover:bg-background-container transition-colors duration-200 py-2 px-2 rounded focus:outline-none w-full"
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
                onCancel={() => handleAddTaskToggle(status, false)} 
              />
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="project-group-row grid grid-cols-3 gap-6 mb-6">
      {/* Column 1: In Pomodoro */}
      {renderColumn('pomodoro', projectTasks.pomodoro, true)}
      
      {/* Column 2: To Do List */}
      {renderColumn('todo', projectTasks.todo, false)}
      
      {/* Column 3: Completed */}
      {renderColumn('completed', projectTasks.completed, false)}
    </div>
  );
};

export default ProjectGroupRow;