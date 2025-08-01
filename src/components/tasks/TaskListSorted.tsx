import React, { useState, useRef, useEffect } from 'react';
import { useTaskStore } from '../../store/taskStore';
import TaskItem from './TaskItem';
import TaskForm from './TaskForm';
import type { Task } from '../../types/models';
import { useTimerStore } from '../../store/timerStore';

export const TaskListSorted: React.FC = () => {
  const {
    tasks,
    projects,
    editingTaskId,
    taskListViewMode,
    setIsAddingTask,
    setEditingTaskId,
    reorderTasks,
  } = useTaskStore();
  const {
    isRunning,
    pause,
    setEnableStartPauseBtn,
    start,
    currentTask,
  } = useTimerStore();

  // UI state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [shouldAutoResume, setShouldAutoResume] = useState(false);

  // For drag and drop
  const draggedTaskId = useRef<string | null>(null);
  const draggedTaskIndex = useRef<number>(-1);
  const taskListRef = useRef<HTMLDivElement>(null);

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

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: string) => {
    // Store the dragged task ID
    draggedTaskId.current = taskId;

    // Find the task index
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    draggedTaskIndex.current = taskIndex;

    // Visual feedback
    e.currentTarget.classList.add('opacity-70', 'border-dashed');
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove('opacity-70', 'border-dashed');

    // Reset the dragged task ID
    draggedTaskId.current = null;
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
    if (!draggedTaskId.current || draggedTaskId.current === dropTargetId) return;

    const draggedTask = tasks.find(t => t.id === draggedTaskId.current);
    const dropTarget = tasks.find(t => t.id === dropTargetId);

    if (!draggedTask || !dropTarget) return;

    // Just reorder the tasks, don't change completion status
    const dropIndex = tasks.findIndex(t => t.id === dropTargetId);
    reorderTasks(draggedTaskId.current, dropIndex);
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

  // Helper function to get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Sort tasks by order and filter based on current view mode
  // Keep completed tasks visible until manually archived
  const sortedTasks = [...tasks]
    .filter(task => {
      // Don't show archived tasks
      if (task.hideFromPomodoro) return false;

      if (taskListViewMode === 'pomodoro') {
        // Show tasks with status "pomodoro" (IN POMODORO)
        if (task.status === 'pomodoro') return true;

        // Show completed tasks (status becomes "completed" when task is marked done)
        if (task.status === 'completed' && task.completed) return true;

        return false;
      } else if (taskListViewMode === 'today') {
        const todayDate = getTodayDate();
        
        // Show tasks scheduled for today
        if (task.scheduledDate === todayDate) return true;

        // Show completed tasks that were completed today (we can still show completed ones)
        if (task.status === 'completed' && task.completed) {
          // If the task was scheduled for today or has no scheduled date but was completed today
          if (task.scheduledDate === todayDate || !task.scheduledDate) return true;
        }

        return false;
      }

      return false;
    })
    .sort((a, b) => a.order - b.order);


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
                project={fallbackProject}
                onEdit={handleEditTask}
              />
            </div>
          );
        }

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
    </div>
  );
};

export default TaskListSorted;