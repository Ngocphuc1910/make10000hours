import React, { useState, useRef } from 'react';
import type { Task } from '../../../types/models';
import { useTaskStore } from '../../../store/taskStore';
import { Icon } from '../../ui/Icon';

interface TaskItemProps {
  task?: Task;
  projectId?: string;
  projectColor?: string;
  isNewTask?: boolean;
  onCancel?: () => void;
}

const TaskItem: React.FC<TaskItemProps> = ({
  task,
  projectId,
  projectColor = '#4f46e5',
  isNewTask = false,
  onCancel
}) => {
  const addTask = useTaskStore(state => state.addTask);
  const updateTask = useTaskStore(state => state.updateTask);
  const toggleTaskCompletion = useTaskStore(state => state.toggleTaskCompletion);
  const updateTaskStatus = useTaskStore(state => state.updateTaskStatus);
  
  const [taskTitle, setTaskTitle] = useState(task?.title || '');
  const [taskDescription, setTaskDescription] = useState(task?.description || '');
  const [spentTime, setSpentTime] = useState(task?.timeSpent?.toString() || '0');
  const [estimatedTime, setEstimatedTime] = useState(task?.timeEstimated?.toString() || '0');
  const [isDescriptionVisible, setIsDescriptionVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(isNewTask);
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Handle saving a task (for new or edited tasks)
  const handleSaveTask = () => {
    if (!taskTitle.trim()) return;
    
    if (isNewTask && projectId) {
      // Add a new task
      addTask({
        title: taskTitle.trim(),
        description: taskDescription,
        projectId,
        completed: false,
        status: 'todo',
        timeSpent: parseInt(spentTime) || 0,
        timeEstimated: parseInt(estimatedTime) || 0,
      });
      
      if (onCancel) onCancel();
    } else if (task) {
      // Update existing task
      updateTask(task.id, {
        title: taskTitle.trim(),
        description: taskDescription,
        timeSpent: parseInt(spentTime) || 0,
        timeEstimated: parseInt(estimatedTime) || 0,
      });
      
      setIsEditing(false);
    }
  };
  
  // Handle checkbox change
  const handleCheckboxChange = () => {
    if (!task) return;
    toggleTaskCompletion(task.id);
  };
  
  // Toggle task description visibility
  const toggleDescription = () => {
    setIsDescriptionVisible(!isDescriptionVisible);
  };
  
  // Cancel editing or creating a task
  const handleCancel = () => {
    if (isNewTask) {
      if (onCancel) onCancel();
    } else {
      setTaskTitle(task?.title || '');
      setTaskDescription(task?.description || '');
      setSpentTime(task?.timeSpent?.toString() || '0');
      setEstimatedTime(task?.timeEstimated?.toString() || '0');
      setIsEditing(false);
    }
  };
  
  // Handle entering edit mode
  const handleEdit = () => {
    setIsEditing(true);
  };
  
  // Drag and drop handlers
const handleDragStart = (e: React.DragEvent) => {
  if (!task) return; // Allow completed tasks to be draggable
  setIsDragging(true);
    
    // Set task data in the drag event
    e.dataTransfer.setData('application/json', JSON.stringify({
      id: task.id,
      projectId: task.projectId,
      status: task.status,
      completed: task.completed
    }));
    
    // Set drag image and effect
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      const target = e.target as HTMLElement;
      target.classList.add('dragging');
    }, 0);
  };
  
  const handleDragEnd = (e: React.DragEvent) => {
    if (!task) return;
    setIsDragging(false);
    const target = e.target as HTMLElement;
    target.classList.remove('dragging');
  };
  
  const handleDragOver = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = 'move';
};
  
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    try {
      const droppedData = JSON.parse(e.dataTransfer.getData('application/json'));
      
      // Don't do anything if dropping on itself
      if (droppedData.id === task?.id) return;
      
      // Update the task with new project or status
      if (droppedData.id && task) {
        updateTask(droppedData.id, {
          projectId: task.projectId,
          status: task.status
        });
      }
    } catch (error) {
      console.error('Error handling drop:', error);
    }
  };

  // If we're in edit mode or creating a new task, show the edit form
  if (isEditing || isNewTask) {
    return (
      <div className="task-card p-4 bg-white border border-gray-200 rounded-md shadow-sm hover:shadow-md transition-shadow duration-200 animate-fade-in">
        <div className="flex items-center">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3">
              <input 
                type="text" 
                className="flex-1 text-sm font-medium text-gray-900 px-3 py-2 bg-gray-50 rounded-md border-none focus:ring-1 focus:ring-primary focus:bg-white transition-colors duration-200" 
                placeholder="What needs to be done?"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                autoFocus
              />
              <div className="flex items-center bg-gray-50 rounded-md px-3 py-1.5 whitespace-nowrap">
                <Icon name="time-line" className="text-gray-400 mr-2" />
                <input 
                  type="number" 
                  className="w-12 text-sm font-medium text-gray-600 bg-transparent border-none text-right focus:ring-2 focus:ring-primary" 
                  placeholder="0" 
                  min="0"
                  value={spentTime}
                  onChange={(e) => setSpentTime(e.target.value)}
                />
                <span className="text-sm font-medium text-gray-400 mx-1">/</span>
                <input 
                  type="number" 
                  className="w-12 text-sm font-medium text-gray-600 bg-transparent border-none text-right focus:ring-2 focus:ring-primary" 
                  placeholder="0" 
                  min="0"
                  value={estimatedTime}
                  onChange={(e) => setEstimatedTime(e.target.value)}
                />
                <span className="text-sm font-medium text-gray-500 ml-1">min</span>
              </div>
            </div>
            <textarea 
              className="w-full text-sm text-gray-600 px-3 py-2 bg-gray-50 rounded-md border-none focus:ring-2 focus:ring-primary focus:bg-white transition-colors duration-200 min-h-[3rem] mb-3" 
              rows={4} 
              placeholder="Add description (optional)"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              style={{ resize: 'none' }}
            ></textarea>
            <div className="flex justify-end space-x-2">
              <button 
                onClick={handleSaveTask}
                className="p-1.5 rounded-md bg-primary/10 hover:bg-primary/20 transition-colors duration-200 cursor-pointer"
              >
                <div className="w-5 h-5 flex items-center justify-center text-primary">
                  <Icon name="check-line" />
                </div>
              </button>
              <button 
                onClick={handleCancel}
                className="p-1.5 rounded-md hover:bg-gray-100 transition-colors duration-200"
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

  // If no task, don't render anything
  if (!task) return null;

  return (
    <div 
      className={`task-card flex items-center p-3 bg-white border border-gray-200 rounded-md hover:shadow-sm ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
      draggable={true}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="mr-3">
        <input 
          type="checkbox" 
          className="appearance-none w-[18px] h-[18px] border-2 border-gray-300 rounded-[4px] relative cursor-pointer transition-all duration-200 checked:bg-primary checked:border-primary"
          checked={task.completed}
          onChange={handleCheckboxChange}
          style={{
            backgroundImage: task.completed 
              ? `url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M5.707 7.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4a1 1 0 0 0-1.414-1.414L7 8.586 5.707 7.293z'/%3e%3c/svg%3e")` 
              : 'none',
            backgroundSize: '80%',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center flex-1 min-w-0 mr-2">
            <h4 className={`text-sm font-medium ${task.completed ? 'text-gray-500 line-through' : 'text-gray-900'} truncate`}>
              {task.title}
            </h4>
            <span className={`ml-2 flex items-center text-xs font-medium ${task.completed ? 'text-gray-500' : 'text-gray-600'}`}>
              <Icon name="time-line" className="mr-1" />
              {task.timeSpent}/{task.timeEstimated}m
            </span>
          </div>
          <button 
            className="expand-button p-1 rounded-full hover:bg-gray-100"
            onClick={toggleDescription}
          >
            <div className="w-5 h-5 flex items-center justify-center text-gray-400">
              <Icon name={isDescriptionVisible ? "arrow-up-s-line" : "arrow-down-s-line"} />
            </div>
          </button>
        </div>
        {isDescriptionVisible && task.description && (
          <div className="description-container mt-1">
            <p className="text-sm text-gray-600">{task.description}</p>
          </div>
        )}
      </div>
      <div className="task-menu ml-4 flex items-center">
        <button 
          className="edit-task-btn p-1 rounded-full hover:bg-gray-100"
          onClick={handleEdit}
        >
          <div className="w-5 h-5 flex items-center justify-center text-gray-400">
            <Icon name="edit-line" />
          </div>
        </button>
      </div>
    </div>
  );
};

export default TaskItem; 