import React from 'react';
import TaskCard from './TaskCard';
import TaskForm from './TaskForm';
import StatusChip from './StatusChip';
import { Icon } from '../ui/Icon';
import { triggerAuthenticationFlow } from '../../utils/authGuard';
import type { Task, Project } from '../../types/models';

interface StatusGroupRowProps {
  project: Project | null;
  statusTasks: {
    pomodoro: Task[];
    todo: Task[];
    completed: Task[];
  };
  isExpanded: boolean;
  expandedStatuses: Set<string>;
  onToggleStatus: (status: Task['status']) => void;
  onStatusChange: (taskId: string, status: Task['status']) => void;
  onTaskReorder: (draggedTaskId: string, targetTaskId: string, insertAfter?: boolean) => void;
  onCrossColumnMove: (draggedTaskId: string, targetTaskId: string, newStatus: Task['status'], insertAfter?: boolean) => void;
  authStatus: any;
  allTasks: Task[];
  projectColumnOrder: string[];
}

const StatusGroupRow: React.FC<StatusGroupRowProps> = ({
  project,
  statusTasks,
  isExpanded,
  expandedStatuses,
  onToggleStatus,
  onStatusChange,
  onTaskReorder,
  onCrossColumnMove,
  authStatus,
  allTasks,
  projectColumnOrder,
}) => {
  const [isAddingTask, setIsAddingTask] = React.useState<{ [key: string]: boolean }>({});
  const projectId = project?.id || 'no-project';

  const handleAddTaskToggle = (status: Task['status'], adding: boolean) => {
    setIsAddingTask(prev => ({ ...prev, [status]: adding }));
  };

  // Status configurations
  const statusConfigs = {
    pomodoro: { title: 'In Pomodoro', color: '#EF4444' },
    todo: { title: 'To Do List', color: '#3B82F6' },
    completed: { title: 'Completed', color: '#10B981' },
  };

  const statusOrder: Task['status'][] = ['pomodoro', 'todo', 'completed'];

  return (
    <div className="status-group-row mb-6">
      {statusOrder.map((status) => (
        <div key={status} className="mb-4">
          {/* Status Chip spanning all columns */}
          <div className="sticky top-[56px] z-20 bg-background-primary backdrop-blur-sm mb-4">
            <StatusChip
              status={status}
              title={statusConfigs[status].title}
              color={statusConfigs[status].color}
              taskCount={statusTasks[status].length}
              isExpanded={expandedStatuses.has(`${projectId}-${status}`)}
              onToggle={() => onToggleStatus(status)}
            />
          </div>
          
          {/* Tasks for this status when expanded - distributed across project columns */}
          {expandedStatuses.has(`${projectId}-${status}`) && (
            <div className={`grid gap-6 mb-4`} style={{ gridTemplateColumns: `repeat(${projectColumnOrder.length}, 1fr)` }}>
              {projectColumnOrder.map((currentProjectId) => (
                <div key={`${status}-${currentProjectId}`} className="flex flex-col">
                  {currentProjectId === projectId && (
                    <>
                      <div className="space-y-3">
                        {statusTasks[status].map(task => (
                          <TaskCard 
                            key={task.id} 
                            task={task}
                            onStatusChange={onStatusChange}
                            onReorder={onTaskReorder}
                            onCrossColumnMove={onCrossColumnMove}
                            columnStatus={status}
                            context="task-management"
                          />
                        ))}
                      </div>
                      
                      {/* New Task button for this status in this project */}
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
                            onCancel={() => handleAddTaskToggle(status, false)} 
                          />
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default StatusGroupRow;