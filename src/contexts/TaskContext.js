import React, { createContext, useState, useEffect } from 'react';
import { getTasks, createTask, updateTask as updateTaskInDb, deleteTask as deleteTaskInDb } from '../lib/database';
import { useAuth } from '../hooks/useAuth';
import { 
  syncTaskCreate, 
  syncTaskUpdate, 
  syncTaskDelete, 
  getPendingOperations, 
  clearPendingOperations 
} from '../services/taskSyncService';

export const TaskContext = createContext();

export const TaskProvider = ({ children }) => {
  const [tasks, setTasks] = useState([]);
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionTasks, setSessionTasks] = useState([]); // Store session tasks that aren't in the main task list yet
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle', 'syncing', 'error'
  const [pendingChanges, setPendingChanges] = useState(0);
  const { currentUser } = useAuth();

  // Load tasks from database when user changes
  useEffect(() => {
    const loadTasks = async () => {
      if (!currentUser) {
        // If no user is logged in, try localStorage as fallback
        try {
          setLoading(true);
          
          // Load from localStorage
          const savedTasks = JSON.parse(localStorage.getItem('pomodoro-tasks') || '[]');
          setTasks(savedTasks);
          
          // Load session tasks
          const savedSessionTasks = JSON.parse(localStorage.getItem('pomodoro-session-tasks') || '[]');
          setSessionTasks(savedSessionTasks);
          
          // Load active task
          const savedActiveTaskId = localStorage.getItem('pomodoro-active-task-id');
          if (savedActiveTaskId) {
            setActiveTaskId(savedActiveTaskId);
          }
        } catch (error) {
          console.error('Error loading tasks from localStorage:', error);
        } finally {
          setLoading(false);
        }
        return;
      }
      
      try {
        setLoading(true);
        setSyncStatus('syncing');
        
        // Load from database
        const dbTasks = await getTasks(currentUser.id);
        console.log('Tasks loaded from database:', dbTasks);
        
        // Map database format to app format
        const mappedTasks = dbTasks.map(dbTask => ({
          id: dbTask.id,
          title: dbTask.name,
          description: dbTask.description,
          completed: dbTask.status === 'completed',
          estimatedPomodoros: dbTask.estimated_pomodoros,
          pomodoros: dbTask.completed_pomodoros,
          projectId: dbTask.project_id,
          priority: dbTask.priority,
          createdAt: dbTask.created_at,
          isSessionTask: dbTask.status === 'session'
        }));
        
        // Split into regular tasks and session tasks
        const regularTasks = mappedTasks.filter(task => !task.isSessionTask);
        const dbSessionTasks = mappedTasks.filter(task => task.isSessionTask);
        
        setTasks(regularTasks);
        
        // Merge with any session tasks from localStorage for backward compatibility
        const localSessionTasks = JSON.parse(localStorage.getItem('pomodoro-session-tasks') || '[]');
        const mergedSessionTasks = [
          ...dbSessionTasks,
          ...localSessionTasks.filter(localTask => {
            // Only include local tasks that aren't already in the DB session tasks
            return !dbSessionTasks.some(dbTask => dbTask.id === localTask.id);
          })
        ];
        
        setSessionTasks(mergedSessionTasks);
        
        // Load active task
        const savedActiveTaskId = localStorage.getItem('pomodoro-active-task-id');
        if (savedActiveTaskId) {
          setActiveTaskId(savedActiveTaskId);
        }
        
        setSyncStatus('idle');
      } catch (error) {
        console.error('Error loading tasks from database:', error);
        setSyncStatus('error');
        
        // Fallback to localStorage if database fails
        const savedTasks = JSON.parse(localStorage.getItem('pomodoro-tasks') || '[]');
        setTasks(savedTasks);
        
        const savedSessionTasks = JSON.parse(localStorage.getItem('pomodoro-session-tasks') || '[]');
        setSessionTasks(savedSessionTasks);
      } finally {
        setLoading(false);
      }
    };
    
    loadTasks();
  }, [currentUser]);
  
  // Check for pending operations and update UI
  useEffect(() => {
    const checkPendingOperations = () => {
      const pending = getPendingOperations();
      const totalPending = 
        pending.create.length + 
        pending.update.length + 
        pending.delete.length;
        
      setPendingChanges(totalPending);
    };
    
    // Initial check
    checkPendingOperations();
    
    // Set up interval to check regularly
    const interval = setInterval(checkPendingOperations, 10000);
    
    return () => {
      clearInterval(interval);
    };
  }, []);
  
  // For backward compatibility, still save to localStorage when tasks change
  useEffect(() => {
    localStorage.setItem('pomodoro-tasks', JSON.stringify(tasks));
  }, [tasks]);
  
  // Save session tasks to localStorage when they change
  useEffect(() => {
    localStorage.setItem('pomodoro-session-tasks', JSON.stringify(sessionTasks));
  }, [sessionTasks]);
  
  // Save active task to localStorage when it changes
  useEffect(() => {
    if (activeTaskId) {
      localStorage.setItem('pomodoro-active-task-id', activeTaskId);
    } else {
      localStorage.removeItem('pomodoro-active-task-id');
    }
  }, [activeTaskId]);
  
  // Add a new task directly to the main task list
  const addTask = async (taskData) => {
    const newTaskBase = {
      ...taskData,
      completed: false
    };
    
    let newTask;
    
    if (currentUser) {
      // Create a temporary ID for immediate UI update
      const tempId = `temp-${Date.now()}`;
      
      // Create a new task with the temporary ID
      newTask = {
        id: tempId,
        ...newTaskBase,
        createdAt: new Date().toISOString(),
        synced: false
      };
      
      // Add to state immediately for UI responsiveness
      setTasks(prevTasks => [...prevTasks, newTask]);
      
      // Try to save to database in the background
      try {
        setSyncStatus('syncing');
        
        // Use the sync service
        const dbTask = await syncTaskCreate(currentUser.id, {
          ...newTaskBase,
          title: taskData.title,
          description: taskData.description || '',
          estimatedPomodoros: taskData.estimatedPomodoros || 1,
          pomodoros: taskData.pomodoros || 0,
          priority: taskData.priority || 0,
          projectId: taskData.projectId || null
        });
        
        if (dbTask) {
          // Replace the temporary task with the database task
          setTasks(prevTasks => prevTasks.map(task => 
            task.id === tempId ? {
              id: dbTask.id,
              title: dbTask.name,
              description: dbTask.description,
              completed: dbTask.status === 'completed',
              estimatedPomodoros: dbTask.estimated_pomodoros,
              pomodoros: dbTask.completed_pomodoros,
              projectId: dbTask.project_id,
              priority: dbTask.priority,
              createdAt: dbTask.created_at,
              synced: true
            } : task
          ));
          
          // Update the newTask reference to return
          newTask = {
            id: dbTask.id,
            title: dbTask.name,
            description: dbTask.description,
            completed: dbTask.status === 'completed',
            estimatedPomodoros: dbTask.estimated_pomodoros,
            pomodoros: dbTask.completed_pomodoros,
            projectId: dbTask.project_id,
            priority: dbTask.priority,
            createdAt: dbTask.created_at,
            synced: true
          };
          
          setSyncStatus('idle');
        }
      } catch (error) {
        console.error('Error adding task to database:', error);
        setSyncStatus('error');
        // Task will remain with tempId and synced: false
        // The sync service will handle retries
      }
    } else {
      // No user logged in, use local storage only
      newTask = {
        id: Date.now().toString(),
        ...newTaskBase,
        createdAt: new Date().toISOString(),
        synced: true // Mark as synced even though it's only in localStorage
      };
      setTasks(prevTasks => [...prevTasks, newTask]);
    }
    
    return newTask;
  };
  
  // Add a session task without adding it to the main task list yet
  const addSessionTask = async (taskData) => {
    console.log('DEBUGGING: TaskContext - addSessionTask called with:', taskData);
    
    let newTask;
    
    if (currentUser) {
      // Create a temporary ID for immediate UI update
      const tempId = `temp-session-${Date.now()}`;
      
      // Create the task object with temporary ID
      newTask = {
        id: tempId,
        ...taskData,
        createdAt: taskData.createdAt || new Date().toISOString(),
        completed: false,
        synced: false
      };
      
      // Add to session tasks immediately for responsive UI
      setSessionTasks(prevSessionTasks => {
        // Check if task with similar properties already exists
        const taskExists = prevSessionTasks.some(task => 
          task.title === taskData.title && 
          new Date(task.createdAt).toDateString() === new Date().toDateString()
        );
        
        if (taskExists) {
          console.log('DEBUGGING: TaskContext - Similar task already exists in session tasks, not adding duplicate');
          return prevSessionTasks;
        }
        
        return [...prevSessionTasks, newTask];
      });
      
      // Try to save to database in the background
      try {
        setSyncStatus('syncing');
        
        // Use the sync service
        const dbTask = await syncTaskCreate(currentUser.id, {
          ...taskData,
          title: taskData.title,
          description: taskData.description || '',
          status: 'session', // Special status to identify session tasks
          priority: taskData.priority || 0,
          estimatedPomodoros: taskData.estimatedPomodoros || 1,
          pomodoros: 0,
          position: 0,
          projectId: taskData.projectId || null
        });
        
        if (dbTask) {
          // Replace the temporary task with the database version
          setSessionTasks(prevSessionTasks => prevSessionTasks.map(task => 
            task.id === tempId ? {
              id: dbTask.id,
              title: dbTask.name,
              description: dbTask.description,
              completed: dbTask.status === 'completed',
              estimatedPomodoros: dbTask.estimated_pomodoros,
              pomodoros: dbTask.completed_pomodoros || 0,
              projectId: dbTask.project_id,
              priority: dbTask.priority,
              createdAt: dbTask.created_at,
              synced: true
            } : task
          ));
          
          // Update the returned task reference
          newTask = {
            id: dbTask.id,
            title: dbTask.name,
            description: dbTask.description,
            completed: dbTask.status === 'completed',
            estimatedPomodoros: dbTask.estimated_pomodoros,
            pomodoros: dbTask.completed_pomodoros || 0,
            projectId: dbTask.project_id,
            priority: dbTask.priority,
            createdAt: dbTask.created_at,
            synced: true
          };
          
          setSyncStatus('idle');
        }
      } catch (error) {
        console.error('Error adding session task to database:', error);
        setSyncStatus('error');
        // The sync service will handle retries
      }
    } else {
      // No user logged in, use local storage only
      newTask = {
        id: taskData.id || Date.now().toString(),
        ...taskData,
        createdAt: taskData.createdAt || new Date().toISOString(),
        completed: false,
        synced: true // Mark as synced even though it's only in localStorage
      };
      
      setSessionTasks(prevSessionTasks => {
        // Check if task with this ID already exists in session tasks
        const taskExists = prevSessionTasks.some(task => task.id === newTask.id);
        if (taskExists) {
          console.log('DEBUGGING: TaskContext - Task with ID already exists in session tasks, not adding duplicate');
          return prevSessionTasks;
        }
        
        return [...prevSessionTasks, newTask];
      });
    }
    
    console.log('DEBUGGING: TaskContext - New session task created:', newTask);
    return newTask;
  };
  
  // Set active task
  const setActiveTask = (taskId) => {
    console.log('DEBUGGING: TaskContext - setActiveTask called with ID:', taskId);
    
    // Just update the activeTaskId state - no side effects
    setActiveTaskId(taskId);
    console.log('DEBUGGING: TaskContext - Active task ID updated to:', taskId);
    
    // No longer automatically move to main tasks - we'll do this explicitly
    // This allows us to have active tasks in the session list without them being in the main list
    console.log('DEBUGGING: TaskContext - No automatic movement to main tasks');
  };
  
  // Explicitly move a task to the main tasks list
  const moveToMainTasks = async (taskId) => {
    console.log('DEBUGGING: TaskContext - moveToMainTasks EXPLICITLY called for ID:', taskId);
    
    // Sanity check - make sure we have a valid ID
    if (!taskId) {
      console.log('DEBUGGING: TaskContext - Invalid taskId, cannot move to main tasks');
      return;
    }
    
    // First check if it already exists in the main tasks array
    const existsInMainTasks = tasks.some(task => task.id === taskId);
    console.log('DEBUGGING: TaskContext - Task already exists in main tasks?', existsInMainTasks);
    
    if (existsInMainTasks) {
      console.log('DEBUGGING: TaskContext - Task already in main tasks, no action needed');
      return; // Task already exists in main tasks, no need to add it again
    }
    
    // Find the task in session tasks
    const sessionTask = sessionTasks.find(task => task.id === taskId);
    console.log('DEBUGGING: TaskContext - Found task in sessionTasks?', !!sessionTask);
    
    if (sessionTask) {
      // Task found in session tasks, add it to main tasks
      console.log('DEBUGGING: TaskContext - Found session task, adding to main tasks:', sessionTask);
      
      if (currentUser) {
        try {
          setSyncStatus('syncing');
          
          // Update the status in database from 'session' to 'todo'
          await syncTaskUpdate(currentUser.id, taskId, { status: 'todo' });
          console.log('Task status updated in database from session to todo');
          
          setSyncStatus('idle');
        } catch (error) {
          console.error('Error updating task status in database:', error);
          setSyncStatus('error');
          // Continue with local operations even if database update fails
        }
      }
      
      setTasks(prevTasks => {
        // Double-check it's not already in main tasks
        if (prevTasks.some(task => task.id === taskId)) {
          console.log('DEBUGGING: TaskContext - Task already in main tasks (double check), not adding again');
          return prevTasks;
        }
        
        // Add to main tasks
        console.log('DEBUGGING: TaskContext - Adding session task to main tasks list');
        return [...prevTasks, sessionTask];
      });
    } else {
      // Task not found in session tasks, look elsewhere
      console.log('DEBUGGING: TaskContext - Task not found in session tasks, looking in other sources');
      
      // Try to find from other sources
      const allTasksFromStorage = [
        ...JSON.parse(localStorage.getItem('pomodoro-tasks') || '[]'),
        ...JSON.parse(localStorage.getItem('pomodoro-session-tasks') || '[]')
      ];
      
      const taskFromStorage = allTasksFromStorage.find(task => task.id === taskId);
      
      if (taskFromStorage) {
        console.log('DEBUGGING: TaskContext - Found task in storage:', taskFromStorage);
        
        // Add task to main tasks if not already there
        setTasks(prevTasks => {
          // Double-check it's not already in main tasks
          if (prevTasks.some(task => task.id === taskId)) {
            console.log('DEBUGGING: TaskContext - Task already in main tasks (from storage check), not adding again');
            return prevTasks;
          }
          
          // Add to main tasks
          console.log('DEBUGGING: TaskContext - Adding task from storage to main tasks list');
          return [...prevTasks, taskFromStorage];
        });
      } else {
        console.log('DEBUGGING: TaskContext - Task not found anywhere with ID:', taskId);
      }
    }
  };
  
  // Update a task
  const updateTask = async (taskId, taskData) => {
    // Update locally first for UI responsiveness
    // Update in main tasks if it exists there
    setTasks(prevTasks => 
      prevTasks.map(task => 
        task.id === taskId ? { ...task, ...taskData, synced: false } : task
      )
    );
    
    // Also update in session tasks if it exists there
    setSessionTasks(prevSessionTasks =>
      prevSessionTasks.map(task =>
        task.id === taskId ? { ...task, ...taskData, synced: false } : task
      )
    );
    
    // Update in database if user is logged in
    if (currentUser) {
      try {
        setSyncStatus('syncing');
        
        // Use the sync service
        const success = await syncTaskUpdate(currentUser.id, taskId, taskData);
        
        if (success) {
          // Mark as synced
          setTasks(prevTasks => 
            prevTasks.map(task => 
              task.id === taskId ? { ...task, synced: true } : task
            )
          );
          
          setSessionTasks(prevSessionTasks =>
            prevSessionTasks.map(task =>
              task.id === taskId ? { ...task, synced: true } : task
            )
          );
          
          setSyncStatus('idle');
        }
      } catch (error) {
        console.error('Error updating task in database:', error);
        setSyncStatus('error');
        // The sync service will handle retries
      }
    }
  };
  
  // Delete a task
  const deleteTask = async (taskId) => {
    // Delete locally first for UI responsiveness
    setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
    setSessionTasks(prevSessionTasks => prevSessionTasks.filter(task => task.id !== taskId));
    
    // If the deleted task was active, clear active task
    if (activeTaskId === taskId) {
      setActiveTaskId(null);
    }
    
    // Delete from database if user is logged in
    if (currentUser) {
      try {
        setSyncStatus('syncing');
        
        // Use the sync service
        await syncTaskDelete(currentUser.id, taskId);
        
        setSyncStatus('idle');
      } catch (error) {
        console.error('Error deleting task from database:', error);
        setSyncStatus('error');
        // The sync service will handle retries
      }
    }
  };
  
  // Clear completed tasks
  const clearCompletedTasks = async () => {
    // Get the completed tasks
    const completedTasks = [
      ...tasks.filter(task => task.completed),
      ...sessionTasks.filter(task => task.completed)
    ];
    
    // Delete locally first for UI responsiveness
    setTasks(prevTasks => prevTasks.filter(task => !task.completed));
    setSessionTasks(prevSessionTasks => prevSessionTasks.filter(task => !task.completed));
    
    // Delete from database if user is logged in
    if (currentUser && completedTasks.length > 0) {
      try {
        setSyncStatus('syncing');
        
        // Delete each completed task from database using the sync service
        await Promise.all(completedTasks.map(task => 
          syncTaskDelete(currentUser.id, task.id)
        ));
        
        setSyncStatus('idle');
      } catch (error) {
        console.error('Error deleting completed tasks from database:', error);
        setSyncStatus('error');
        // The sync service will handle retries
      }
    }
  };
  
  // Get a task by ID from either the main tasks or session tasks
  const getTaskById = (taskId) => {
    return tasks.find(task => task.id === taskId) || 
           sessionTasks.find(task => task.id === taskId);
  };
  
  // Force synchronization of all pending changes
  const syncPendingChanges = async () => {
    if (!currentUser) return false;
    
    try {
      setSyncStatus('syncing');
      
      // Get pending operations
      const pending = getPendingOperations();
      const totalPending = 
        pending.create.length + 
        pending.update.length + 
        pending.delete.length;
      
      if (totalPending === 0) {
        setSyncStatus('idle');
        return true;
      }
      
      // For now, we'll just clear the pending changes
      // In a real implementation, you'd want to retry the operations
      clearPendingOperations();
      
      setSyncStatus('idle');
      setPendingChanges(0);
      return true;
    } catch (error) {
      console.error('Error syncing pending changes:', error);
      setSyncStatus('error');
      return false;
    }
  };
  
  const value = {
    tasks,
    sessionTasks,
    activeTaskId,
    loading,
    syncStatus,
    pendingChanges,
    addTask,
    addSessionTask,
    updateTask,
    deleteTask,
    setActiveTask,
    clearCompletedTasks,
    getTaskById,
    moveToMainTasks,
    syncPendingChanges
  };
  
  return (
    <TaskContext.Provider value={value}>
      {children}
    </TaskContext.Provider>
  );
}; 