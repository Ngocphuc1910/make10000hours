import React, { useState } from 'react';
import type { Project, Task } from '../../../types/models';
import { useTaskStore } from '../../../store/taskStore';
import { Icon } from '../../ui/Icon';
import TaskItem from '../../../components/dashboard/views/TaskItem';

interface ProjectCardProps {
  project?: Project;
  isNewProject?: boolean;
  onCancel?: () => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ 
  project, 
  isNewProject = false,
  onCancel
}) => {
  const tasks = useTaskStore(state => state.tasks);
  const addProject = useTaskStore(state => state.addProject);
  const updateTask = useTaskStore(state => state.updateTask);
  const [projectName, setProjectName] = useState(project?.name || '');
  
  // Persist activeFilter state in localStorage per project to prevent automatic tab switching
  const [activeFilter, setActiveFilter] = useState<'pomodoro' | 'todo' | 'completed'>(() => {
    if (!project) return 'todo';
    const saved = localStorage.getItem(`projectFilter_${project.id}`);
    return (saved as 'pomodoro' | 'todo' | 'completed') || 'todo';
  });
  
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [draggedOverFilter, setDraggedOverFilter] = useState<string | null>(null);
  
  // Save activeFilter to localStorage whenever it changes
  React.useEffect(() => {
    if (project) {
      localStorage.setItem(`projectFilter_${project.id}`, activeFilter);
    }
  }, [activeFilter, project]);
  
  // Filter tasks for this project
  const projectTasks = project ? tasks.filter(task => task.projectId === project.id) : [];
  
  // Filter tasks based on selected filter
  const filteredTasks = projectTasks.filter(task => {
    if (activeFilter === 'pomodoro') return task.status === 'pomodoro';
    if (activeFilter === 'todo') return !task.completed && task.status === 'todo';
    if (activeFilter === 'completed') return task.completed;
    return true;
  });
  
  // Calculate project progress
  const totalTasks = projectTasks.length;
  const completedTasks = projectTasks.filter(task => task.completed).length;
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  // Count tasks for each filter
  const pomodoroCount = projectTasks.filter(task => task.status === 'pomodoro').length;
  const todoCount = projectTasks.filter(task => !task.completed && task.status === 'todo').length;
  const completedCount = projectTasks.filter(task => task.completed).length;
  
  // Handle saving a new project
  const handleSaveProject = () => {
    if (!projectName.trim()) return;
    
    addProject({
      name: projectName.trim(),
      color: getRandomColor()
    });
    
    if (onCancel) onCancel();
  };
  
  // Handle key press for project name input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveProject();
    }
  };
  
  // Generate a random color for new projects
  const getRandomColor = () => {
    const colors = ['#4f46e5', '#10b981', '#ef4444', '#f59e0b', '#6366f1'];
    return colors[Math.floor(Math.random() * colors.length)];
  };
  
  // Handle adding a new task
  const handleAddTask = () => {
    setIsAddingTask(true);
  };
  
  // Handle canceling task addition
  const handleCancelAddTask = () => {
    setIsAddingTask(false);
  };

  // Toggle project collapsed state
  const toggleCollapsed = () => {
    setIsCollapsed(!isCollapsed);
  };
  
  // Drag and drop handlers for filter tabs
  const handleFilterDragOver = (e: React.DragEvent, filterType: 'pomodoro' | 'todo' | 'completed') => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (draggedOverFilter !== filterType) {
      setDraggedOverFilter(filterType);
    }
  };
  
  const handleFilterDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedOverFilter(null);
  };
  
  const handleFilterDrop = (e: React.DragEvent, filterType: 'pomodoro' | 'todo' | 'completed') => {
    e.preventDefault();
    e.stopPropagation();
    setDraggedOverFilter(null);
    
    try {
      const droppedData = JSON.parse(e.dataTransfer.getData('application/json'));
      
      if (droppedData.id && project) {
        // Special handling when dragging from completed to other statuses
        if (droppedData.completed && filterType !== 'completed') {
          // If moving from completed to another status, mark as not completed
          updateTask(droppedData.id, {
            projectId: project.id,
            status: filterType,
            completed: false
          });
        } else {
          // Normal case
          updateTask(droppedData.id, {
            projectId: project.id,
            status: filterType,
            // If dropping in completed filter, mark as completed
            completed: filterType === 'completed'
          });
        }
        
        // Show a brief visual confirmation
        const filterElement = e.currentTarget as HTMLElement;
        filterElement.classList.add('drop-success');
        
        setTimeout(() => {
          filterElement.classList.remove('drop-success');
        }, 500);
      }
    } catch (error) {
      console.error('Error handling drop on filter:', error);
    }
  };
  
  // Drag and drop handlers for task list container
  const handleTaskListDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  
  const handleTaskListDrop = (e: React.DragEvent) => {
    e.preventDefault();
    
    try {
      const droppedData = JSON.parse(e.dataTransfer.getData('application/json'));
      
      if (droppedData.id && project) {
        // Update the task with the new project, keep the original status
        updateTask(droppedData.id, {
          projectId: project.id
        });
      }
    } catch (error) {
      console.error('Error handling drop on task list:', error);
    }
  };

  if (isNewProject) {
    return (
      <div className="project-container bg-white border border-gray-200 rounded-lg shadow-sm w-[600px] min-w-[600px] animate-fade-in">
        <div className="project-header flex items-center justify-between px-4 py-3 bg-gray-50 rounded-t-lg">
          <div className="flex items-center flex-1 mr-4">
            <div className="w-5 h-5 flex items-center justify-center mr-2 text-gray-500">
              <Icon name="arrow-down-s-line" />
            </div>
            <input 
              type="text" 
              className="flex-1 font-medium text-gray-900 bg-transparent border-none focus:ring-2 focus:ring-primary rounded-md px-3 py-1.5" 
              placeholder="Enter project name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyPress={handleKeyPress}
              autoFocus
            />
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="text-xs text-gray-500 mr-2">Progress:</div>
              <div className="w-32 h-2 bg-gray-200 rounded-full">
                <div className="h-2 bg-primary rounded-full" style={{ width: '0%' }}></div>
              </div>
              <div className="ml-2 text-xs font-medium text-gray-700">0%</div>
            </div>
            <div className="flex items-center space-x-2">
              <button 
                onClick={handleSaveProject}
                className="p-1.5 rounded-md bg-primary/10 hover:bg-primary/20 transition-colors duration-200" 
                title="Save project"
              >
                <div className="w-5 h-5 flex items-center justify-center text-primary">
                  <Icon name="check-line" />
                </div>
              </button>
              <button 
                onClick={onCancel}
                className="p-1.5 rounded-md hover:bg-gray-100 transition-colors duration-200" 
                title="Cancel"
              >
                <div className="w-5 h-5 flex items-center justify-center text-gray-400">
                  <Icon name="close-line" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="project-container bg-white border border-gray-200 rounded-lg shadow-sm w-[600px] min-w-[600px]">
      <div 
        className="project-header flex items-center justify-between px-4 py-3 bg-gray-50 rounded-t-lg cursor-pointer"
        onClick={toggleCollapsed}
      >
        <div className="flex items-center">
          <div className="w-5 h-5 flex items-center justify-center mr-2 text-gray-500">
            <Icon name={isCollapsed ? "arrow-right-s-line" : "arrow-down-s-line"} />
          </div>
          <h3 className="font-medium text-gray-900">{project.name}</h3>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <div className="text-xs text-gray-500 mr-2">Progress:</div>
            <div className="w-32 h-2 bg-gray-200 rounded-full">
              <div 
                className="h-2 rounded-full progress-bar-animation" 
                style={{ 
                  width: `${progressPercentage}%`,
                  backgroundColor: '#BB5F5A'
                }}
              ></div>
            </div>
            <div className="ml-2 text-xs font-medium text-gray-700">{progressPercentage}%</div>
          </div>
          <div className="project-menu relative">
            <button 
              className="p-1 rounded-full hover:bg-gray-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-5 h-5 flex items-center justify-center text-gray-500">
                <Icon name="more-2-fill" />
              </div>
            </button>
          </div>
        </div>
      </div>
      {!isCollapsed && (
        <div className="project-tasks px-4 py-2">
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <div className="flex items-center space-x-3 task-filters">
              {/* Reordered tabs: To do list > In Pomodoro > Completed */}
              <button 
                className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                  activeFilter === 'todo'
                    ? 'bg-primary/10 text-primary hover:bg-primary/20'
                    : 'text-gray-600 hover:bg-gray-100'
                } ${draggedOverFilter === 'todo' ? 'drag-over' : ''}`}
                onClick={() => setActiveFilter('todo')}
                onDragOver={(e) => handleFilterDragOver(e, 'todo')}
                onDragLeave={handleFilterDragLeave}
                onDrop={(e) => handleFilterDrop(e, 'todo')}
                style={{ position: 'relative', padding: draggedOverFilter === 'todo' ? '4px 12px' : '' }}
              >
                <div className="w-4 h-4 flex items-center justify-center mr-1">
                  <Icon name="list-check" />
                </div>
                To Do List ({todoCount})
              </button>
              <button 
                className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                  activeFilter === 'pomodoro'
                    ? 'bg-primary/10 text-primary hover:bg-primary/20'
                    : 'text-gray-600 hover:bg-gray-100'
                } ${draggedOverFilter === 'pomodoro' ? 'drag-over' : ''}`}
                onClick={() => setActiveFilter('pomodoro')}
                onDragOver={(e) => handleFilterDragOver(e, 'pomodoro')}
                onDragLeave={handleFilterDragLeave}
                onDrop={(e) => handleFilterDrop(e, 'pomodoro')}
                style={{ position: 'relative', padding: draggedOverFilter === 'pomodoro' ? '4px 12px' : '' }}
              >
                <div className="w-4 h-4 flex items-center justify-center mr-1">
                  <Icon name="timer-line" />
                </div>
                In Pomodoro ({pomodoroCount})
              </button>
              <button 
                className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                  activeFilter === 'completed'
                    ? 'bg-primary/10 text-primary hover:bg-primary/20'
                    : 'text-gray-600 hover:bg-gray-100'
                } ${draggedOverFilter === 'completed' ? 'drag-over' : ''}`}
                onClick={() => setActiveFilter('completed')}
                onDragOver={(e) => handleFilterDragOver(e, 'completed')}
                onDragLeave={handleFilterDragLeave}
                onDrop={(e) => handleFilterDrop(e, 'completed')}
                style={{ position: 'relative', padding: draggedOverFilter === 'completed' ? '4px 12px' : '' }}
              >
                <div className="w-4 h-4 flex items-center justify-center mr-1">
                  <Icon name="check-line" />
                </div>
                Completed ({completedCount})
              </button>
            </div>
            <button 
              onClick={handleAddTask}
              className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md text-primary hover:bg-indigo-50 whitespace-nowrap"
            >
              <div className="w-4 h-4 flex items-center justify-center mr-1">
                <Icon name="add-line" />
              </div>
              Add Task
            </button>
          </div>
          <div 
            className="task-list py-2 space-y-2"
            onDragOver={handleTaskListDragOver}
            onDrop={handleTaskListDrop}
          >
            {filteredTasks.map(task => (
              <TaskItem 
                key={task.id} 
                task={task} 
                projectColor={project.color}
              />
            ))}
            
            {/* New Task Form */}
            {isAddingTask && (
              <TaskItem 
                isNewTask 
                projectId={project.id}
                onCancel={handleCancelAddTask}
              />
            )}
            
            {/* Empty state when no tasks match filter */}
            {filteredTasks.length === 0 && !isAddingTask && (
              <div 
                className="p-4 text-center text-gray-500 text-sm italic"
                onDragOver={handleTaskListDragOver}
                onDrop={handleTaskListDrop}
              >
                No tasks found in this category
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectCard; 