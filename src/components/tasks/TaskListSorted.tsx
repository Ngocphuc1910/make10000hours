import React, { useState, useRef, useEffect } from 'react';
import { DndContext, closestCenter, DragEndEvent, DragStartEvent, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTaskStore } from '../../store/taskStore';
import TaskItem from './TaskItem';
import TaskForm from './TaskForm';
import type { Task } from '../../types/models';
import { useTimerStore } from '../../store/timerStore';
import { TaskFilteringService } from '../../services/TaskFilteringService';
import { useUserStore } from '../../store/userStore';
import { sortTasksByOrder } from '../../utils/taskSorting';
import DragDebugger from './DragDebugger';

// Sortable Task Item Component using @dnd-kit
interface SortableTaskItemProps {
  task: Task;
  project: any;
  onEdit: (taskId: string) => void;
  isDragActive: boolean;
}

const SortableTaskItem: React.FC<SortableTaskItemProps> = ({ task, project, onEdit, isDragActive }) => {
  const { setCurrentTask } = useTimerStore();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: task.id,
    // Handle clicks within the drag system
    data: {
      type: 'task',
      task: task,
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
    // Prevent horizontal overflow during drag
    maxWidth: '100%',
    overflow: 'hidden',
    // Ensure dragged item appears above all other items
    zIndex: isDragging ? 9999 : 'auto',
    position: isDragging ? 'relative' : 'static',
  };

  // Handle click events for task selection with drag state safety check
  const handleClick = (e: React.MouseEvent) => {
    // Don't process clicks during active drag operations
    if (isDragging) return;
    
    // Ignore clicks on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('input[type="checkbox"]') || 
        target.closest('.edit-task-btn') ||
        target.closest('.expand-button')) {
      return;
    }
    
    // Don't select completed tasks
    if (task.completed) return;
    
    // Select the task
    setCurrentTask(task);
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        pointerEvents: 'auto',
      }}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={`w-full overflow-hidden ${isDragging ? 'cursor-grabbing shadow-lg scale-105' : 'cursor-pointer'}`}
    >
      <div style={{ pointerEvents: isDragActive ? 'none' : 'auto' }}>
        <TaskItem
          task={task}
          project={project}
          onEdit={onEdit}
          context="pomodoro"
          disableClick={true} // Prevent TaskItem from handling clicks
        />
      </div>
    </div>
  );
};

export const TaskListSorted: React.FC = () => {
  const {
    tasks,
    projects,
    editingTaskId,
    taskListViewMode,
    setIsAddingTask,
    setEditingTaskId,
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

  const [shouldAutoResume, setShouldAutoResume] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const taskListRef = useRef<HTMLDivElement>(null);

  // Configure drag sensors with distance-based activation for reliable click vs drag distinction
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts - prevents click interference
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        distance: 8, // Same distance threshold for touch devices
      },
    })
  );

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
  }, [editingTaskId, currentTask, isRunning, setEnableStartPauseBtn, pause]);

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setIsDragActive(true);
  };

  // Handle drag end with @dnd-kit
  const handleDragEnd = async (event: DragEndEvent) => {
    setIsDragActive(false);
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const draggedTaskId = active.id as string;
      const targetTaskId = over.id as string;
      
      const draggedTaskIndex = sortedTasks.findIndex(t => t.id === draggedTaskId);
      const targetTaskIndex = sortedTasks.findIndex(t => t.id === targetTaskId);
      
      if (draggedTaskIndex !== -1 && targetTaskIndex !== -1) {
        try {
          await reorderTasksGlobal(draggedTaskId, targetTaskIndex, sortedTasks);
        } catch (error) {
          console.error('❌ reorderTasksGlobal failed:', error);
        }
      }
    }
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
    <>
      {process.env.NODE_ENV === 'development' && <DragDebugger enabled={false} />}
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext 
          items={sortedTasks.map(task => task.id)} 
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2.5 overflow-hidden" id="taskListSorted" ref={taskListRef}>
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
                  <SortableTaskItem
                    key={task.id}
                    task={task}
                    project={fallbackProject}
                    onEdit={handleEditTask}
                    isDragActive={isDragActive}
                  />
                );
              }

              return (
                <SortableTaskItem
                  key={task.id}
                  task={task}
                  project={project}
                  onEdit={handleEditTask}
                  isDragActive={isDragActive}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </>
  );
};

export default TaskListSorted;