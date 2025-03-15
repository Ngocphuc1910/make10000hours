import React, { createContext, useState, useEffect } from 'react';

export const TaskContext = createContext();

export const TaskProvider = ({ children }) => {
  const [tasks, setTasks] = useState([]);
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load tasks from localStorage
  useEffect(() => {
    const loadTasks = () => {
      try {
        setLoading(true);
        
        // Load from localStorage
        const savedTasks = JSON.parse(localStorage.getItem('pomodoro-tasks') || '[]');
        setTasks(savedTasks);
        
        // Load active task
        const savedActiveTaskId = localStorage.getItem('pomodoro-active-task-id');
        if (savedActiveTaskId) {
          setActiveTaskId(savedActiveTaskId);
        }
      } catch (error) {
        console.error('Error loading tasks:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadTasks();
  }, []);
  
  // Save tasks to localStorage when they change
  useEffect(() => {
    localStorage.setItem('pomodoro-tasks', JSON.stringify(tasks));
  }, [tasks]);
  
  // Save active task to localStorage when it changes
  useEffect(() => {
    if (activeTaskId) {
      localStorage.setItem('pomodoro-active-task-id', activeTaskId);
    } else {
      localStorage.removeItem('pomodoro-active-task-id');
    }
  }, [activeTaskId]);
  
  // Add a new task
  const addTask = (taskData) => {
    const newTask = {
      id: Date.now().toString(),
      ...taskData,
      createdAt: new Date().toISOString(),
      completed: false
    };
    
    setTasks(prevTasks => [...prevTasks, newTask]);
    return newTask;
  };
  
  // Update a task
  const updateTask = (taskId, taskData) => {
    setTasks(prevTasks => 
      prevTasks.map(task => 
        task.id === taskId ? { ...task, ...taskData } : task
      )
    );
  };
  
  // Delete a task
  const deleteTask = (taskId) => {
    setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
    
    // If the deleted task was active, clear active task
    if (activeTaskId === taskId) {
      setActiveTaskId(null);
    }
  };
  
  // Set active task
  const setActiveTask = (taskId) => {
    setActiveTaskId(taskId);
  };
  
  // Clear completed tasks
  const clearCompletedTasks = () => {
    setTasks(prevTasks => prevTasks.filter(task => !task.completed));
  };
  
  const value = {
    tasks,
    activeTaskId,
    loading,
    addTask,
    updateTask,
    deleteTask,
    setActiveTask,
    clearCompletedTasks
  };
  
  return (
    <TaskContext.Provider value={value}>
      {children}
    </TaskContext.Provider>
  );
}; 