import React, { useState, useRef, useEffect } from 'react';
import { useTaskStore } from '../../store/taskStore';
import TaskItem from './TaskItem';
import TaskForm from './TaskForm';
import type { Task } from '../../types/models';
import { useTimerStore } from '../../store/timerStore';
import { TaskFilteringService } from '../../services/TaskFilteringService';
import { useUserStore } from '../../store/userStore';
import { sortTasksByOrder } from '../../utils/taskSorting';

export const TaskListSorted: React.FC = () => {
  const {
    tasks,
    projects,
    editingTaskId,
    taskListViewMode,
    setIsAddingTask,
    setEditingTaskId,
    reorderTasks,
    reorderTasksGlobal,
  } = useTaskStore();
  const {
    isRunning,
    pause,
    setEnableStartPauseBtn,
    start,
    currentTask,
  } = useTimerStore();
  
  const { user } = useUserStore();

  // UI state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [shouldAutoResume, setShouldAutoResume] = useState(false);

  // For drag and drop
  const draggedTaskId = useRef<string | null>(null);
  const draggedTaskIndex = useRef<number>(-1);
  const taskListRef = useRef<HTMLDivElement>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);
  const [currentlyDraggedTaskId, setCurrentlyDraggedTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (currentTask && editingTaskId === currentTask.id) {
      // If editing the current task, disable the start/pause button
      setEnableStartPauseBtn(false);

      if (isRunning) {
        // If a task is being edited while the timer is running, pause the timer
        pause();
      }
    } else {
      // Otherwise, enable the start/pause button
      setEnableStartPauseBtn(true);
    }
  }, [editingTaskId]);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: string, sortedTasks: Task[]) => {
    // Store the dragged task ID
    draggedTaskId.current = taskId;
    setCurrentlyDraggedTaskId(taskId);

    // CRITICAL FIX: Find the task index in the SORTED tasks that are actually displayed
    const taskIndex = sortedTasks.findIndex(t => t.id === taskId);
    draggedTaskIndex.current = taskIndex;

    // Enhanced visual feedback to match TaskCard behavior
    e.currentTarget.classList.add('dragging');
    e.currentTarget.classList.add('opacity-50');
    e.currentTarget.style.transform = 'scale(1.02)';
    e.currentTarget.style.transition = 'all 0.2s ease';
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    // Clean up visual feedback to match TaskCard behavior
    e.currentTarget.classList.remove('dragging', 'opacity-50');
    e.currentTarget.style.transform = '';
    e.currentTarget.style.transition = '';

    // Reset the dragged task ID and drop indicators
    draggedTaskId.current = null;
    draggedTaskIndex.current = -1;
    setCurrentlyDraggedTaskId(null);
    setDragOverTaskId(null);
    setDropPosition(null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, taskId: string) => {
    e.preventDefault();
    
    if (!draggedTaskId.current || draggedTaskId.current === taskId) return;
    
    // Calculate drop position based on mouse position within the target element
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'before' : 'after';
    
    setDragOverTaskId(taskId);
    setDropPosition(position);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, taskId: string) => {
    e.preventDefault();
    // Remove the background color change, we'll use drop line indicator instead
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    // Only clear if we're actually leaving the task area
    const rect = e.currentTarget.getBoundingClientRect();
    const { clientX, clientY } = e;
    
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      setDragOverTaskId(null);
      setDropPosition(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, dropTargetId: string, sortedTasks: Task[]) => {
    e.preventDefault();
    
    // Clear drop indicators
    setDragOverTaskId(null);
    setDropPosition(null);

    // If no task was dragged or dropping on itself, do nothing
    if (!draggedTaskId.current || draggedTaskId.current === dropTargetId) return;

    const draggedTask = sortedTasks.find(t => t.id === draggedTaskId.current);
    const dropTarget = sortedTasks.find(t => t.id === dropTargetId);

    if (!draggedTask || !dropTarget) return;

    // CRITICAL FIX: Use the drop index from SORTED tasks that are actually displayed
    const dropIndex = sortedTasks.findIndex(t => t.id === dropTargetId);
    
    console.log(`🎯 TaskListSorted drag & drop: ${draggedTask.title} -> position ${dropIndex} in sorted list of ${sortedTasks.length} tasks`);
    
    // Use global reordering to allow dragging completed tasks between incomplete ones
    reorderTasksGlobal(draggedTaskId.current, dropIndex, sortedTasks);
  };

  const handleEditTask = (taskId: string) => {
    setEditingTaskId(taskId);
    setIsAddingTask(false);

    if (isRunning) {
      setShouldAutoResume(true);
    } else {
      setShouldAutoResume(false);
    }
  };

  const handleCancelForm = () => {
    setIsAddingTask(false);
    setEditingTaskId(null);

    if (shouldAutoResume) {
      // If we paused the timer to edit a task, resume it now
      setShouldAutoResume(false);
      start();
    }
  };

  // Filter and sort tasks using TaskFilteringService with timezone awareness
  const filteredTasks = [...tasks]
    .filter(task => {
      // Don't show archived tasks
      if (task.hideFromPomodoro) return false;
      
      // Use TaskFilteringService for timezone-aware filtering
      const userTimezone = user?.settings?.timezone?.current;
      
      if (taskListViewMode === 'pomodoro') {
        return TaskFilteringService.getPomodoroTasks([task]).length > 0;
      } else {
        return TaskFilteringService.getTodaysTasks([task], userTimezone).length > 0;
      }
    });

  const sortedTasks = sortTasksByOrder(filteredTasks);


  return (
    <div className="space-y-2.5" id="taskListSorted" ref={taskListRef}>
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

        if (!project) {
          // Create a fallback project for tasks with missing projects
          const fallbackProject = {
            id: task.projectId || 'unknown',
            name: 'Unknown Project',
            userId: task.userId
          };
          
          return (
            <div key={task.id} className="relative">
              {/* Drop indicator line - BEFORE */}
              {dragOverTaskId === task.id && dropPosition === 'before' && (
                <div className="absolute -top-0.5 left-2 right-2 h-0.5 bg-blue-400 rounded-full z-10 opacity-80" />
              )}
              
              <TaskItem
                task={task}
                project={fallbackProject}
                onEdit={handleEditTask}
                className={`transition-all duration-200 ease-in-out ${(dragOverTaskId === task.id || currentlyDraggedTaskId === task.id) ? 'drag-over' : ''}`}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, task.id, sortedTasks)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, task.id)}
                onDragEnter={(e) => handleDragEnter(e, task.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, task.id, sortedTasks)}
              />
              
              {/* Drop indicator line - AFTER */}
              {dragOverTaskId === task.id && dropPosition === 'after' && (
                <div className="absolute -bottom-0.5 left-2 right-2 h-0.5 bg-blue-400 rounded-full z-10 opacity-80" />
              )}
            </div>
          );
        }

        return (
          <div key={task.id} className="relative">
            {/* Drop indicator line - BEFORE */}
            {dragOverTaskId === task.id && dropPosition === 'before' && (
              <div className="absolute -top-0.5 left-2 right-2 h-0.5 bg-blue-400 rounded-full z-10 opacity-80" />
            )}
            
            <TaskItem
              task={task}
              project={project}
              onEdit={handleEditTask}
              className={`transition-all duration-200 ease-in-out ${(dragOverTaskId === task.id || currentlyDraggedTaskId === task.id) ? 'drag-over' : ''}`}
              draggable={true}
              onDragStart={(e) => handleDragStart(e, task.id, sortedTasks)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, task.id)}
              onDragEnter={(e) => handleDragEnter(e, task.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, task.id, sortedTasks)}
            />
            
            {/* Drop indicator line - AFTER */}
            {dragOverTaskId === task.id && dropPosition === 'after' && (
              <div className="absolute -bottom-0.5 left-2 right-2 h-0.5 bg-blue-400 rounded-full z-10 opacity-80" />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TaskListSorted;