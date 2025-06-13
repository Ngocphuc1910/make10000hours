import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTaskStore } from '../../store/taskStore';
import TaskItem from './TaskItem';
import TaskForm from './TaskForm';
import type { Task, Project } from '../../types/models';
import { formatMinutesToHoursAndMinutes } from '../../utils/timeUtils';
import TaskListSorted from './TaskListSorted';

export const TimeSpent: React.FC = () => {
  const {
    tasks,
  } = useTaskStore();

  // Sort tasks by order and filter to show only Pomodoro tasks
  // Keep completed tasks visible until manually archived
  const sortedTasks = [...tasks]
    .filter(task => {
      // Don't show archived tasks
      if (task.hideFromPomodoro) return false;

      // Show active pomodoro tasks
      if (task.status === 'pomodoro') return true;

      // Show completed tasks (regardless of current status, as long as they're marked completed)
      // These should stay visible until manually archived
      if (task.completed) return true;

      return false;
    })
    .sort((a, b) => a.order - b.order);

  // Calculate total time statistics using stored task.timeSpent for consistency with TaskItem display
  const totalTimeSpent = sortedTasks.reduce((sum, task) => {
    return sum + (task.timeSpent || 0);
  }, 0);
  const totalTimeEstimated = sortedTasks.reduce((sum, task) => sum + (task.timeEstimated || 0), 0);

  // Calculate time remaining only for tasks with "pomodoro" status (active tasks in Pomodoro workflow)
  const pomodoroTasks = sortedTasks.filter(task => task.status === 'pomodoro');
  const pomodoroTimeEstimated = pomodoroTasks.reduce((sum, task) => sum + (task.timeEstimated || 0), 0);
  const pomodoroTimeSpent = pomodoroTasks.reduce((sum, task) => {
    return sum + (task.timeSpent || 0);
  }, 0);
  const timeRemaining = Math.max(0, pomodoroTimeEstimated - pomodoroTimeSpent);

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