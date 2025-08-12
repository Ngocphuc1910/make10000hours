import React, { useState, useRef, useEffect } from 'react';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
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
}

const SortableTaskItem: React.FC<SortableTaskItemProps> = ({ task, project, onEdit }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    // Prevent horizontal overflow during drag
    maxWidth: '100%',
    overflow: 'hidden',
  };

  // Create filtered listeners that don't interfere with interactive elements
  const handlePointerDown = (event: React.PointerEvent) => {
    // Check if the click is on an interactive element
    const target = event.target as HTMLElement;
    if (
      target.closest('.edit-task-btn') ||
      target.closest('button') ||
      target.closest('input') ||
      target.closest('[role="checkbox"]')
    ) {
      // Don't start drag if clicking on interactive elements
      return;
    }
    
    // Call the original listener for drag functionality
    if (listeners?.onPointerDown) {
      listeners.onPointerDown(event);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      onPointerDown={handlePointerDown}
      className={`${isDragging ? 'z-50' : ''} w-full overflow-hidden cursor-move`}
    >
      <TaskItem
        task={task}
        project={project}
        onEdit={onEdit}
        className="pointer-events-auto"
      />
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
  }, [editingTaskId, currentTask, isRunning, setEnableStartPauseBtn, pause]);

  // Handle drag end with @dnd-kit
  const handleDragEnd = async (event: DragEndEvent) => {
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
        collisionDetection={closestCenter}
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
                  />
                );
              }

              return (
                <SortableTaskItem
                  key={task.id}
                  task={task}
                  project={project}
                  onEdit={handleEditTask}
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