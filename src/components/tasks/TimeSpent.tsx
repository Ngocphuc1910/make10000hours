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
    taskListViewMode,
  } = useTaskStore();

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