import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTaskStore } from '../../store/taskStore';
import TaskItem from './TaskItem';
import TaskForm from './TaskForm';
import type { Task, Project } from '../../types/models';
import { formatMinutesToHoursAndMinutes } from '../../utils/timeUtils';
import TaskListSorted from './TaskListSorted';
import { TaskFilteringService } from '../../services/TaskFilteringService';
import { useUserStore } from '../../store/userStore';
import { sortTasksByOrder } from '../../utils/taskSorting';

export const TimeSpent: React.FC = () => {
  const {
    tasks,
    taskListViewMode,
  } = useTaskStore();
  
  const { user } = useUserStore();

  // Filter and sort tasks using TaskFilteringService with timezone awareness
  const filteredTasks = TaskFilteringService.filterTasksByViewMode(
    tasks.filter(task => !task.hideFromPomodoro), // Don't show archived tasks
    taskListViewMode,
    user?.settings?.timezone?.current
  );
  const sortedTasks = sortTasksByOrder(filteredTasks);

  // Calculate total time statistics using stored task.timeSpent for consistency with TaskItem display
  const totalTimeSpent = sortedTasks.reduce((sum, task) => {
    return sum + (task.timeSpent || 0);
  }, 0);
  const totalTimeEstimated = sortedTasks.reduce((sum, task) => sum + (task.timeEstimated || 0), 0);

  // Calculate time remaining based on current view mode
  let timeRemaining = 0;
  if (taskListViewMode === 'pomodoro') {
    // For Pomodoro view: only count active pomodoro tasks
    const pomodoroTasks = sortedTasks.filter(task => task.status === 'pomodoro');
    const pomodoroTimeEstimated = pomodoroTasks.reduce((sum, task) => sum + (task.timeEstimated || 0), 0);
    const pomodoroTimeSpent = pomodoroTasks.reduce((sum, task) => sum + (task.timeSpent || 0), 0);
    timeRemaining = Math.max(0, pomodoroTimeEstimated - pomodoroTimeSpent);
  } else if (taskListViewMode === 'today') {
    // For Today view: count all today's incomplete tasks
    const incompleteTasks = sortedTasks.filter(task => !task.completed);
    const todayTimeEstimated = incompleteTasks.reduce((sum, task) => sum + (task.timeEstimated || 0), 0);
    const todayTimeSpent = incompleteTasks.reduce((sum, task) => sum + (task.timeSpent || 0), 0);
    timeRemaining = Math.max(0, todayTimeEstimated - todayTimeSpent);
  }

  return (
    <div className="text-sm text-text-secondary">
      <span>Total time spent: </span>
      <span className="font-medium text-text-primary">
        {formatMinutesToHoursAndMinutes(totalTimeSpent)}
      </span>
      {totalTimeEstimated > 0 && (
        <span>
          {' '}({formatMinutesToHoursAndMinutes(timeRemaining)} left)
        </span>
      )}
    </div>
  );
};

export default TimeSpent;