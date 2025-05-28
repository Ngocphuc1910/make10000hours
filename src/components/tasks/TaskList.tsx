import React, { useState, useRef } from 'react';
import { useTaskStore } from '../../store/taskStore';
import TaskItem from './TaskItem';
import TaskForm from './TaskForm';
import type { Task } from '../../types/models';

interface TaskListProps {
  className?: string;
  compactView?: boolean;
}

export const TaskList: React.FC<TaskListProps> = ({ 
  className = '',
  compactView = false
}) => {
  const { 
    tasks, 
    projects, 
    isAddingTask, 
    editingTaskId, 
    setIsAddingTask, 
    setEditingTaskId,
    reorderTasks,
    toggleTaskCompletion
  } = useTaskStore();
  
  // For drag and drop
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const draggedTaskIndex = useRef<number>(-1);
  
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: string) => {
    // Store the dragged task ID
    setDraggedTaskId(taskId);
    
    // Find the task index
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    draggedTaskIndex.current = taskIndex;
    
    // Visual feedback
    e.currentTarget.classList.add('opacity-70', 'border-dashed');
  };
  
  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove('opacity-70', 'border-dashed');
    
    // Reset the dragged task ID
    setDraggedTaskId(null);
    draggedTaskIndex.current = -1;
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };
  
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.add('bg-gray-50');
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove('bg-gray-50');
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>, dropTargetId: string) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-gray-50');
    
    // If no task was dragged or dropping on itself, do nothing
    if (!draggedTaskId || draggedTaskId === dropTargetId) return;
    
    const draggedTask = tasks.find(t => t.id === draggedTaskId);
    const dropTarget = tasks.find(t => t.id === dropTargetId);
    
    if (!draggedTask || !dropTarget) return;
    
    // If dragging between different completion states, toggle completion
    if (draggedTask.completed !== dropTarget.completed) {
      toggleTaskCompletion(draggedTaskId);
    } else {
      // Same completion state, just reorder
      const dropIndex = tasks.findIndex(t => t.id === dropTargetId);
      reorderTasks(draggedTaskId, dropIndex);
    }
  };
  
  const handleAddTask = () => {
    setIsAddingTask(true);
    setEditingTaskId(null);
  };
  
  const handleEditTask = (taskId: string) => {
    setEditingTaskId(taskId);
    setIsAddingTask(false);
  };
  
  const handleCancelForm = () => {
    setIsAddingTask(false);
    setEditingTaskId(null);
  };
  
  // Sort tasks by order
  const sortedTasks = [...tasks].sort((a, b) => a.order - b.order);
  
  return (
    <div className={`h-full flex flex-col ${className}`}>
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h2 className="font-semibold text-gray-800 text-left">Tasks & Projects</h2>
        <button 
          id="addTaskBtn"
          onClick={handleAddTask}
          className="px-3 py-2 text-primary hover:bg-primary hover:bg-opacity-10 !rounded-button whitespace-nowrap flex items-center"
        >
          <span className="mr-1">Add Task</span>
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-add-line"></i>
          </div>
        </button>
      </div>
      
      <div className={`flex-1 overflow-y-auto ${compactView ? 'compact-view' : ''}`}>
        <div className="p-4">
          <div className="space-y-3" id="taskList">
            {sortedTasks.map((task: Task) => {
              const project = projects.find(p => p.id === task.projectId);
              
              if (editingTaskId === task.id) {
                return (
                  <TaskForm 
                    key={task.id} 
                    task={task}
                    onCancel={handleCancelForm} 
                  />
                );
              }
              
              if (!project) return null;
              
              return (
                <div
                  key={task.id}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, task.id)}
                >
                  <TaskItem 
                    task={task} 
                    project={project} 
                    onEdit={handleEditTask} 
                  />
                </div>
              );
            })}
            
            {/* Task Creation Form */}
            {isAddingTask && (
              <TaskForm onCancel={handleCancelForm} />
            )}
            
            {/* Add New Task Button */}
            {!isAddingTask && (
              <button
                id="addNewTaskBtn"
                onClick={handleAddTask}
                className="w-full py-3 px-4 border border-dashed border-gray-300 rounded-md text-gray-500 hover:text-primary hover:border-primary hover:bg-primary/5 transition-colors duration-200 flex items-center justify-center gap-2 mt-4"
              >
                <i className="ri-add-line"></i>
                <span>Add New Task</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskList; 