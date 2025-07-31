import React, { useState } from 'react';
import { useTaskStore } from '../../store/taskStore';
import type { Task, Project } from '../../types/models';
import { TaskColumn } from './';
import { ToastNotification } from './';
import { ProjectLayoutProvider } from '../../contexts/ProjectLayoutContext';
import ProjectGroupRow from './ProjectGroupRow';

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
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [activeTaskCreation, setActiveTaskCreation] = useState<Task['status'] | null>(null);


  // Filter tasks by status
  const pomodoroTasks = tasks.filter(task => task.status === 'pomodoro');
  const todoTasks = tasks.filter(task => task.status === 'todo');
  const completedTasks = tasks.filter(task => task.status === 'completed');

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

  // Group tasks by project for row-based rendering when grouping is enabled
  const projectGroups = React.useMemo(() => {
    if (!groupByProject) return null;
    
    return getProjectsWithTasks.map(({ project }) => {
      const projectId = project?.id || 'no-project';
      const projectTasks = tasks.filter(task => (task.projectId || 'no-project') === projectId);
      
      return {
        project,
        projectTasks: {
          pomodoro: projectTasks.filter(t => t.status === 'pomodoro'),
          todo: projectTasks.filter(t => t.status === 'todo'),
          completed: projectTasks.filter(t => t.status === 'completed')
        }
      };
    });
  }, [tasks, groupByProject, getProjectsWithTasks]);

  return (
    <ProjectLayoutProvider>
      <div className={`flex flex-col bg-background-primary ${className}`}>
      {/* Fixed Headers Row */}
      <div className="flex flex-row bg-background-primary sticky top-0 z-30">
        {/* In Pomodoro Header */}
        <div className="flex-1 pr-4 py-3 pl-4" style={{ backgroundColor: '#ffffff' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              <h3 className="text-base font-semibold text-text-primary">In Pomodoro</h3>
              <span className="text-sm font-medium text-text-secondary bg-background-container px-3 py-1 rounded-full">
                {pomodoroTasks.length}
              </span>
            </div>
            <button className="p-2 rounded-full hover:bg-background-container group">
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

        {/* To Do List Header */}
        <div className="flex-1 pr-4 py-3 pl-4" style={{ backgroundColor: '#ffffff' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="w-3 h-3 rounded-full bg-blue-500"></span>
              <h3 className="text-base font-semibold text-text-primary">To Do List</h3>
              <span className="text-sm font-medium text-text-secondary bg-background-container px-3 py-1 rounded-full">
                {todoTasks.length}
              </span>
            </div>
            <button className="p-2 rounded-full hover:bg-background-container group">
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

        {/* Completed Header */}
        <div className="flex-1 pr-4 py-3 pl-4" style={{ backgroundColor: '#ffffff' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
              <h3 className="text-base font-semibold text-text-primary">Completed</h3>
              <span className="text-sm font-medium text-text-secondary bg-background-container px-3 py-1 rounded-full">
                {completedTasks.length}
              </span>
            </div>
            <button className="p-2 rounded-full hover:bg-background-container group">
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
      </div>

      {/* Scrollable Content Row */}
      <div className="flex flex-col flex-1">
        {groupByProject && projectGroups ? (
          /* Project Group Rows - Notion-inspired approach */
          <div className="flex-1 pr-4 py-4">
            {projectGroups.map(({ project, projectTasks }) => (
              <ProjectGroupRow
                key={project?.id || 'no-project'}
                project={project}
                projectTasks={projectTasks}
                isExpanded={expandedProjects.has(project?.id || 'no-project')}
                expandedProjects={expandedProjects}
                onToggleProject={toggleProjectExpansion}
                onStatusChange={handleTaskStatusChange}
                onTaskReorder={() => {}} // TODO: Implement reordering
                onCrossColumnMove={() => {}} // TODO: Implement cross-column moves
                authStatus={{ isAuthenticated: true, shouldShowAuth: false }} // TODO: Get actual auth status
                allTasks={tasks}
              />
            ))}
          </div>
        ) : (
          /* Traditional Column Layout */
          <div className="flex flex-row flex-1">
            {/* In Pomodoro Column Content */}
            <TaskColumn
              title="In Pomodoro"
              tasks={pomodoroTasks}
              status="pomodoro"
              badgeColor="bg-red-500"
              onStatusChange={handleTaskStatusChange}
              groupByProject={groupByProject}
              expandedProjects={expandedProjects}
              isFirstColumn={true}
              projects={getProjectsWithTasks}
              onToggleProject={toggleProjectExpansion}
              allTasks={tasks}
              hideHeader={true}
            />

            {/* To Do List Column Content */}
            <TaskColumn
              title="To Do List"
              tasks={todoTasks}
              status="todo"
              badgeColor="bg-blue-500"
              onStatusChange={handleTaskStatusChange}
              groupByProject={groupByProject}
              expandedProjects={expandedProjects}
              isFirstColumn={false}
              projects={getProjectsWithTasks}
              onToggleProject={toggleProjectExpansion}
              allTasks={tasks}
              hideHeader={true}
            />

            {/* Completed Column Content */}
            <TaskColumn
              title="Completed"
              tasks={completedTasks}
              status="completed"
              badgeColor="bg-green-500"
              onStatusChange={handleTaskStatusChange}
              groupByProject={groupByProject}
              expandedProjects={expandedProjects}
              isFirstColumn={false}
              projects={getProjectsWithTasks}
              onToggleProject={toggleProjectExpansion}
              allTasks={tasks}
              hideHeader={true}
            />
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