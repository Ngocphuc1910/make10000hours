import React, { useState } from 'react';
import type { Project, Task } from '../../../types/models';
import { useTaskStore } from '../../../store/taskStore';
import { Icon } from '../../ui/Icon';
import TaskItem from '../../../components/dashboard/views/TaskItem';
import ColorPicker from '../../ui/ColorPicker';
import { getRandomPresetColor } from '../../../utils/colorUtils';
import { useAuthGuard, triggerAuthenticationFlow } from '../../../utils/authGuard';

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
  const deleteProject = useTaskStore(state => state.deleteProject);
  const updateProject = useTaskStore(state => state.updateProject);
  const updateTask = useTaskStore(state => state.updateTask);
  const reorderTasks = useTaskStore(state => state.reorderTasks);
  const moveTaskToStatusAndPosition = useTaskStore(state => state.moveTaskToStatusAndPosition);
  const authStatus = useAuthGuard();
  const [projectName, setProjectName] = useState(project?.name || '');
  
  // Persist activeFilter state in localStorage per project to prevent automatic tab switching
  const [activeFilter, setActiveFilter] = useState<'pomodoro' | 'todo' | 'completed' | null>(() => {
    if (!project) return null;
    
    // Restore saved filter from localStorage to maintain filter state across re-renders
    const saved = localStorage.getItem(`projectFilter_${project.id}`);
    return (saved === 'pomodoro' || saved === 'todo' || saved === 'completed') ? saved : null;
  });
  
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedColor, setSelectedColor] = useState(project?.color || '#BB5F5A');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState(project?.name || '');
  const [draggedOverFilter, setDraggedOverFilter] = useState<string | null>(null);
  
  // Save activeFilter to localStorage whenever it changes
  React.useEffect(() => {
    if (project) {
      if (activeFilter === null) {
        localStorage.removeItem(`projectFilter_${project.id}`);
      } else {
        localStorage.setItem(`projectFilter_${project.id}`, activeFilter);
      }
    }
  }, [activeFilter, project]);

  // Handle task reordering within the same project
  const handleTaskReorder = (draggedTaskId: string, targetTaskId: string, insertAfter: boolean = false) => {
    if (!project) return;
    
    const allTasks = useTaskStore.getState().tasks;
    const targetIndex = allTasks.findIndex(t => t.id === targetTaskId);
    const newIndex = insertAfter ? targetIndex + 1 : targetIndex;
    
    reorderTasks(draggedTaskId, newIndex);
  };

  // Handle cross-project moves with positioning
  const handleCrossProjectMove = async (draggedTaskId: string, targetTaskId: string, newProjectId: string, insertAfter: boolean = false) => {
    if (!project) return;
    
    const allTasks = useTaskStore.getState().tasks;
    const targetIndex = allTasks.findIndex(t => t.id === targetTaskId);
    const finalIndex = insertAfter ? targetIndex + 1 : targetIndex;
    
    // Determine the target status based on the active filter
    let targetStatus: Task['status'] | undefined;
    let targetCompleted: boolean | undefined;
    
    if (activeFilter) {
      // If there's an active filter, update the status to match the filter
      targetStatus = activeFilter;
      targetCompleted = activeFilter === 'completed' ? true : false;
    } else {
      // If no filter is active, keep the original status
      const draggedTask = allTasks.find(t => t.id === draggedTaskId);
      targetStatus = draggedTask?.status;
      targetCompleted = draggedTask?.completed;
    }
    
    // Update the task's project and status (if filter is active) while positioning
    const draggedTask = allTasks.find(t => t.id === draggedTaskId);
    if (draggedTask) {
      const updateData: Partial<Task> = {
        projectId: newProjectId,
        ...(targetStatus && { status: targetStatus }),
        ...(targetCompleted !== undefined && { completed: targetCompleted })
      };
      
      await updateTask(draggedTaskId, updateData);
      
      // Small delay to ensure the project update is processed, then reorder
      setTimeout(() => {
        reorderTasks(draggedTaskId, finalIndex);
      }, 50);
    }
  };

  // Update selected color when project color changes
  React.useEffect(() => {
    if (project?.color) {
      setSelectedColor(project.color);
    }
  }, [project?.color]);

  // Update editing name when project name changes
  React.useEffect(() => {
    if (project?.name) {
      setEditingName(project.name);
    }
  }, [project?.name]);
  
  // Filter tasks for this project
  const projectTasks = project ? tasks.filter(task => task.projectId === project.id) : [];
  
  // Filter tasks based on selected filter
  const filteredTasks = projectTasks.filter(task => {
    if (activeFilter === null) return true; // Show all tasks when no filter is selected
    if (activeFilter === 'pomodoro') return task.status === 'pomodoro';
    if (activeFilter === 'todo') return !task.completed && task.status === 'todo';
    if (activeFilter === 'completed') return task.completed;
    return true;
  }).sort((a, b) => {
    // Sort tasks by status only when no filter is active (showing all tasks)
    if (activeFilter === null) {
      // Define sort order: todo -> pomodoro -> completed
      const statusOrder = { 'todo': 1, 'pomodoro': 2, 'completed': 3 };
      
      // Get status priority for task a
      const aStatus = a.completed ? 'completed' : a.status;
      const aPriority = statusOrder[aStatus as keyof typeof statusOrder] || 4;
      
      // Get status priority for task b  
      const bStatus = b.completed ? 'completed' : b.status;
      const bPriority = statusOrder[bStatus as keyof typeof statusOrder] || 4;
      
      return aPriority - bPriority;
    }
    
    // No sorting when a filter is active
    return 0;
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
      color: getRandomPresetColor()
    });
    
    if (onCancel) onCancel();
  };
  
  // Handle key press for project name input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveProject();
    }
  };
  

  
  // Handle adding a new task
  const handleAddTask = () => {
    if (!authStatus.isAuthenticated && authStatus.shouldShowAuth) {
      triggerAuthenticationFlow();
      return;
    }
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
  
  // Handle project deletion
  const handleDeleteProject = async () => {
    if (!project) return;
    
    const projectTasks = tasks.filter(task => task.projectId === project.id);
    const taskCount = projectTasks.length;
    
    let confirmMessage = `Are you sure you want to delete the project "${project.name}"?`;
    if (taskCount > 0) {
      confirmMessage += `\n\nThis will also permanently delete ${taskCount} task${taskCount === 1 ? '' : 's'} in this project.`;
    }
    confirmMessage += '\n\nThis action cannot be undone.';
    
    if (window.confirm(confirmMessage)) {
      try {
        await deleteProject(project.id);
        setShowDropdown(false);
      } catch (error) {
        console.error('Failed to delete project:', error);
        alert('Failed to delete project. Please try again.');
      }
    }
  };

  // Handle opening color picker
  const handleChangeColor = () => {
    setSelectedColor(project?.color || '#BB5F5A');
    setShowColorPicker(true);
    setShowDropdown(false);
  };

  // Handle color change
  const handleColorChange = (color: string) => {
    setSelectedColor(color);
  };

  // Handle saving color
  const handleSaveColor = async () => {
    if (!project) return;
    
    try {
      await updateProject(project.id, { color: selectedColor });
      console.log(`Project color updated to ${selectedColor}`);
      setShowColorPicker(false);
    } catch (error) {
      console.error('Error updating project color:', error);
      alert('Failed to update project color. Please try again.');
    }
  };

  // Handle closing color picker
  const handleCloseColorPicker = () => {
    setSelectedColor(project?.color || '#BB5F5A');
    setShowColorPicker(false);
  };

  // Handle inline name editing
  const handleEditName = () => {
    setEditingName(project?.name || '');
    setIsEditingName(true);
    setShowDropdown(false);
  };

  // Handle saving inline name edit
  const handleSaveNameEdit = async () => {
    if (!project || !editingName.trim()) {
      // If empty, revert to original name
      setEditingName(project?.name || '');
      setIsEditingName(false);
      return;
    }
    
    try {
      await updateProject(project.id, { name: editingName.trim() });
      console.log(`Project name updated to ${editingName.trim()}`);
      setIsEditingName(false);
    } catch (error) {
      console.error('Error updating project name:', error);
      alert('Failed to update project name. Please try again.');
      setEditingName(project?.name || '');
      setIsEditingName(false);
    }
  };

  // Handle canceling inline name edit
  const handleCancelNameEdit = () => {
    setEditingName(project?.name || '');
    setIsEditingName(false);
  };

  // Handle key press for inline editing
  const handleNameKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveNameEdit();
    } else if (e.key === 'Escape') {
      handleCancelNameEdit();
    }
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.project-dropdown') && showDropdown) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showDropdown]);
  
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
    
    // Get task data from the new format
    const draggedTaskId = e.dataTransfer.getData('text/plain');
    const draggedTaskProjectId = e.dataTransfer.getData('application/x-task-project');
    
    if (draggedTaskId && project) {
      // Get the current task to check its current status
      const allTasks = useTaskStore.getState().tasks;
      const draggedTask = allTasks.find(t => t.id === draggedTaskId);
      
      if (draggedTask) {
        // Determine if we need to change project (cross-project drop)
        const targetProjectId = draggedTaskProjectId !== project.id ? project.id : draggedTask.projectId;
        
        // Special handling when dragging from completed to other statuses
        if (draggedTask.completed && filterType !== 'completed') {
          // If moving from completed to another status, mark as not completed
          updateTask(draggedTaskId, {
            projectId: targetProjectId,
            status: filterType as 'pomodoro' | 'todo' | 'completed',
            completed: false
          });
        } else {
          // Normal case
          updateTask(draggedTaskId, {
            projectId: targetProjectId,
            status: filterType as 'pomodoro' | 'todo' | 'completed',
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
      <div className="project-container bg-background-primary border border-border rounded-lg shadow-sm w-[600px] min-w-[600px] animate-fade-in">
        <div className="project-header flex items-center justify-between px-4 py-3 bg-background-container rounded-t-lg">
          <div className="flex items-center flex-1 mr-4">
            <div className="w-5 h-5 flex items-center justify-center mr-2 text-text-secondary">
              <Icon name="arrow-down-s-line" />
            </div>
            <input 
              type="text" 
              className="flex-1 font-medium text-text-primary bg-transparent border-none focus:ring-2 focus:ring-primary rounded-md px-3 py-1.5" 
              placeholder="Enter project name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyPress={handleKeyPress}
              autoFocus
            />
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="text-xs text-text-secondary mr-2">Progress:</div>
              <div className="w-32 h-2 bg-progress-bg rounded-full">
                <div className="h-2 bg-primary rounded-full" style={{ width: '0%' }}></div>
              </div>
              <div className="ml-2 text-xs font-medium text-text-primary">0%</div>
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
                className="p-1.5 rounded-md hover:bg-background-container transition-colors duration-200" 
                title="Cancel"
              >
                <div className="w-5 h-5 flex items-center justify-center text-text-secondary">
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
    <div className="project-container bg-background-primary border border-border rounded-lg shadow-sm w-[600px] min-w-[600px]">
      <div 
        className={`project-header flex items-center justify-between px-4 py-3 bg-background-container rounded-t-lg ${isEditingName ? 'cursor-default' : 'cursor-pointer'}`}
        onClick={!isEditingName ? toggleCollapsed : undefined}
      >
        <div className="flex items-center flex-1">
          <div className="w-5 h-5 flex items-center justify-center mr-2 text-text-secondary">
            <Icon name={isCollapsed ? "arrow-right-s-line" : "arrow-down-s-line"} />
          </div>
          {isEditingName ? (
            <div className="flex items-center flex-1 mr-4">
              <input 
                type="text" 
                className="flex-1 font-medium text-text-primary bg-transparent border border-red-300 focus:border-red-500 focus:outline-none rounded-md px-3 py-1.5" 
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={handleNameKeyPress}
                autoFocus
              />
              <button 
                onClick={handleSaveNameEdit}
                className="p-1.5 ml-2 rounded-md hover:bg-background-container transition-colors duration-200" 
                title="Save"
              >
                <div className="w-4 h-4 flex items-center justify-center text-green-600">
                  <Icon name="check-line" />
                </div>
              </button>
              <button 
                onClick={handleCancelNameEdit}
                className="p-1.5 rounded-md hover:bg-background-container transition-colors duration-200" 
                title="Cancel"
              >
                <div className="w-4 h-4 flex items-center justify-center text-text-secondary">
                  <Icon name="close-line" />
                </div>
              </button>
            </div>
          ) : (
            <h3 className="font-medium text-text-primary">{project.name}</h3>
          )}
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <div className="text-xs text-text-secondary mr-2">Progress:</div>
            <div className="w-32 h-2 bg-progress-bg rounded-full">
              <div 
                className="h-2 rounded-full progress-bar-animation" 
                style={{ 
                  width: `${progressPercentage}%`,
                  backgroundColor: project.color || '#BB5F5A'
                }}
              ></div>
            </div>
            <div className="ml-2 text-xs font-medium text-text-primary">{progressPercentage}%</div>
          </div>
          <div className="project-menu relative project-dropdown">
            <button 
              className="p-1 rounded-full hover:bg-background-container"
              onClick={(e) => {
                e.stopPropagation();
                setShowDropdown(!showDropdown);
              }}
            >
              <div className="w-5 h-5 flex items-center justify-center text-text-secondary">
                <Icon name="more-2-fill" />
              </div>
            </button>
            
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-background-secondary border border-border rounded-lg shadow-lg z-10 overflow-hidden">
                <div className="py-1 px-2">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleChangeColor();
                    }}
                    className="w-full px-3 py-2 text-sm text-text-primary hover:bg-background-container text-left flex items-center transition-colors duration-200 rounded-md"
                  >
                    <Icon name="palette-line" size={16} className="mr-2" />
                    Update color
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditName();
                    }}
                    className="w-full px-3 py-2 text-sm text-text-primary hover:bg-background-container text-left flex items-center transition-colors duration-200 rounded-md"
                  >
                    <Icon name="edit-line" size={16} className="mr-2" />
                    Edit project name
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProject();
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
        </div>
      </div>
      {!isCollapsed && (
        <div className="project-tasks px-4 py-2">
          <div className="flex items-center justify-between py-2 border-b border-border">
            <div className="flex items-center space-x-3 task-filters">
              {/* To do list */}
              <button 
                className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                  activeFilter === 'todo'
                    ? 'bg-primary/10 text-primary hover:bg-primary/20'
                    : 'text-text-secondary hover:bg-background-container'
                } ${draggedOverFilter === 'todo' ? 'drag-over' : ''}`}
                onClick={() => setActiveFilter(activeFilter === 'todo' ? null : 'todo')}
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
                    : 'text-text-secondary hover:bg-background-container'
                } ${draggedOverFilter === 'pomodoro' ? 'drag-over' : ''}`}
                onClick={() => setActiveFilter(activeFilter === 'pomodoro' ? null : 'pomodoro')}
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
                    : 'text-text-secondary hover:bg-background-container'
                } ${draggedOverFilter === 'completed' ? 'drag-over' : ''}`}
                onClick={() => setActiveFilter(activeFilter === 'completed' ? null : 'completed')}
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
              className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md text-primary hover:bg-primary/10 whitespace-nowrap"
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
                onReorder={handleTaskReorder}
                onCrossProjectMove={handleCrossProjectMove}
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
                className="p-4 text-center text-text-secondary text-sm italic"
                onDragOver={handleTaskListDragOver}
                onDrop={handleTaskListDrop}
              >
                No tasks found in this category
              </div>
            )}
          </div>
        </div>
      )}

      {/* Color Picker Modal */}
      <ColorPicker
        isOpen={showColorPicker}
        onClose={handleCloseColorPicker}
        currentColor={project?.color || '#BB5F5A'}
        onColorChange={handleColorChange}
        onSave={handleSaveColor}
      />


    </div>
  );
};

export default ProjectCard; 