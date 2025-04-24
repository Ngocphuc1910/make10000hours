import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { getTasks, updateTask, deleteTask, createTask } from '../lib/database';
import { useAuth } from '../hooks/useAuth';
import { 
  syncTaskUpdate, 
  syncTaskDelete, 
  getPendingOperations, 
  clearPendingOperations 
} from '../services/taskSyncService';
import { syncTaskCreate, syncTaskFetch } from '../services/syncService';
import { SettingsContext } from './SettingsContext';

export const TaskContext = createContext();

export const TaskProvider = ({ children }) => {
  const [tasks, setTasks] = useState([]);
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionTasks, setSessionTasks] = useState([]); // Store session tasks that aren't in the main task list yet
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle', 'syncing', 'error'
  const [pendingChanges, setPendingChanges] = useState(0);
  const [databaseError, setDatabaseError] = useState(null); // Store database connection error
  const { currentUser } = useAuth();
  
  // Get settings context safely with fallback
  const settingsContext = useContext(SettingsContext);
  // Default pomodoro time if settings not available
  const DEFAULT_POMODORO_TIME = 25;
  
  // Get pomodoro time from settings or use default
  const getPomodoroTime = () => {
    return settingsContext?.settings?.pomodoroTime || DEFAULT_POMODORO_TIME;
  };

  // Load tasks when user changes or component mounts
  useEffect(() => {
    console.log('DEBUGGING: TaskContext - User or component changed, loading tasks');
    loadTasks();
  }, [currentUser]);

  // Check for database errors in returned tasks
  useEffect(() => {
    // Look for tasks with error status or api-error in the ID
    const errorTask = [...tasks, ...sessionTasks].find(
      task => task.status === 'error' || 
              (task.id && task.id.startsWith('api-error-'))
    );
    
    if (errorTask) {
      console.error('DEBUGGING: TaskContext - Found error task:', errorTask);
      setDatabaseError(errorTask.error_message || 'Error connecting to database - tasks will not persist');
      setSyncStatus('error');
    } else if (databaseError) {
      // Clear error if no error tasks are found anymore
      setDatabaseError(null);
    }
  }, [tasks, sessionTasks]);

  // Load tasks from database or localStorage
  const loadTasks = async () => {
    console.log('DEBUGGING: TaskContext - loadTasks called');
    setLoading(true);
    setSyncStatus('syncing');
    
    try {
      // First, try to load from localStorage to ensure we have something immediately
      const savedSessionTasks = localStorage.getItem('pomodoro-session-tasks');
      const localSessionTasks = savedSessionTasks ? JSON.parse(savedSessionTasks) : [];
      console.log(`DEBUGGING: TaskContext - Loaded ${localSessionTasks.length} session tasks from localStorage`);
      
      // Set session tasks from localStorage first for immediate UI update
      setSessionTasks(localSessionTasks);
      
      // If user is logged in, try to load from database
      if (currentUser) {
        console.log('DEBUGGING: TaskContext - User is logged in, loading tasks from database');
        const dbTasks = await getTasks(currentUser.id);
        
        if (dbTasks) {
          console.log(`DEBUGGING: TaskContext - Loaded ${dbTasks.length} tasks from database`);
          
          // Process all database tasks
          const mainTasksList = [];
          const sessionTasksList = [];
          
          dbTasks.forEach(task => {
            // Normalize task object
            const normalizedTask = {
              id: task.id,
              title: task.name || task.text || 'Untitled Task',
              description: task.description || '',
              completed: task.status === 'completed',
              estimatedPomodoros: task.estimated_pomodoros || 1,
              pomodoros: task.completed_pomodoros || 0,
              timeSpent: task.timeSpent !== undefined ? parseFloat(task.timeSpent) : 0, // Parse timeSpent as stored
              timeEstimated: task.timeEstimated !== undefined ? parseFloat(task.timeEstimated) : (task.estimated_pomodoros * getPomodoroTime()), // Parse timeEstimated as stored
              projectId: task.project_id,
              createdAt: task.created_at,
              synced: true
            };
            
            console.log(`DEBUGGING: TaskContext - Normalized task ${task.id}: title="${task.name || task.text || 'Untitled Task'}", timeSpent=${normalizedTask.timeSpent}, timeEstimated=${normalizedTask.timeEstimated}`);
            
            // Separate into main tasks and session tasks based on status
            if (task.status === 'session' || 
                (task.notes && task.notes.includes('session'))) {
              sessionTasksList.push(normalizedTask);
            } else {
              mainTasksList.push(normalizedTask);
            }
          });
          
          // Merge database session tasks with local ones (prefer database)
          const dbSessionIds = sessionTasksList.map(task => task.id);
          const mergedSessionTasks = [
            ...sessionTasksList,
            ...localSessionTasks.filter(task => 
              // Keep local tasks that don't exist in database
              task.id && !task.id.includes('temp-') && !dbSessionIds.includes(task.id)
            )
          ];
          
          // Sort merged tasks by creation date (oldest first) to ensure consistent ordering
          // This ensures that new tasks will appear at the bottom of the list
          mergedSessionTasks.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
            const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
            return dateA - dateB;
          });
          
          // Update state with merged session tasks
          console.log(`DEBUGGING: TaskContext - Setting ${mergedSessionTasks.length} session tasks after merging`);
          setSessionTasks(mergedSessionTasks);
          
          // Update state with database main tasks
          console.log(`DEBUGGING: TaskContext - Setting ${mainTasksList.length} main tasks`);
          setTasks(mainTasksList);
          
          // Save merged session tasks to localStorage for persistence
          localStorage.setItem('pomodoro-session-tasks', JSON.stringify(mergedSessionTasks));
          localStorage.setItem('pomodoro-tasks', JSON.stringify(mainTasksList));
          
          setSyncStatus('idle');
        } else {
          console.warn('DEBUGGING: TaskContext - No tasks returned from database, using localStorage only');
          // Fall back to localStorage for main tasks
          const savedTasks = localStorage.getItem('pomodoro-tasks');
          const localTasks = savedTasks ? JSON.parse(savedTasks) : [];
          
          // Ensure all localStorage tasks have timeSpent and timeEstimated fields
          const normalizedLocalTasks = localTasks.map(task => ({
            ...task,
            timeSpent: task.timeSpent || 0,
            timeEstimated: task.timeEstimated || (task.estimatedPomodoros * getPomodoroTime())
          }));
          
          setTasks(normalizedLocalTasks);
          setSyncStatus('error');
        }
      } else {
        console.log('DEBUGGING: TaskContext - No user logged in, using localStorage only');
        // No user logged in, load from localStorage
        const savedTasks = localStorage.getItem('pomodoro-tasks');
        const localTasks = savedTasks ? JSON.parse(savedTasks) : [];

        // Get session tasks from localStorage when no user is logged in
        const savedSessionTasks = localStorage.getItem('pomodoro-session-tasks');
        const localSessionTasks = savedSessionTasks ? JSON.parse(savedSessionTasks) : [];

        // Ensure all localStorage tasks have timeSpent and timeEstimated fields
        const normalizedLocalTasks = localTasks.map(task => ({
          ...task,
          timeSpent: task.timeSpent || 0,
          timeEstimated: task.timeEstimated || (task.estimatedPomodoros * getPomodoroTime())
        }));
        
        // Ensure all localStorage session tasks have timeSpent and timeEstimated fields
        const normalizedLocalSessionTasks = localSessionTasks.map(task => ({
          ...task,
          timeSpent: task.timeSpent || 0,
          timeEstimated: task.timeEstimated || (task.estimatedPomodoros * getPomodoroTime())
        }));

        // Sort session tasks by creation date (oldest first) for consistent ordering
        normalizedLocalSessionTasks.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
          const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
          return dateA - dateB;
        });

        setTasks(normalizedLocalTasks);
        setSessionTasks(normalizedLocalSessionTasks);
        setSyncStatus('idle');
      }
    } catch (error) {
      console.error('DEBUGGING: TaskContext - Error loading tasks:', error);
      
      // Fall back to localStorage for both task types
      try {
        const savedTasks = localStorage.getItem('pomodoro-tasks');
        const savedSessionTasks = localStorage.getItem('pomodoro-session-tasks');
        
        const localTasks = savedTasks ? JSON.parse(savedTasks) : [];
        const localSessionTasks = savedSessionTasks ? JSON.parse(savedSessionTasks) : [];
        
        console.log(`DEBUGGING: TaskContext - Fallback: Loading ${localTasks.length} tasks and ${localSessionTasks.length} session tasks from localStorage`);
        
        // Sort session tasks by creation date (oldest first) for consistent ordering
        localSessionTasks.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
          const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
          return dateA - dateB;
        });
        
        setTasks(localTasks);
        setSessionTasks(localSessionTasks);
      } catch (localStorageError) {
        console.error('DEBUGGING: TaskContext - Error loading from localStorage:', localStorageError);
        // Last resort - empty arrays
        setTasks([]);
        setSessionTasks([]);
      }
      
      setSyncStatus('error');
    } finally {
      setLoading(false);
    }
  };
  
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
  
  // Add a new task
  const addTask = async (taskData = {}) => {
    // Ensure task has title
    const title = taskData.title || 'Untitled Task';
    const estimatedPomodoros = taskData.estimatedPomodoros || 1;
    
    // Calculate timeEstimated based on estimatedPomodoros and settings
    const pomodoroTime = getPomodoroTime();
    const timeEstimated = estimatedPomodoros * pomodoroTime;
    
    console.log(`DEBUGGING: TaskContext - addTask called with title="${title}", estimatedPomodoros=${estimatedPomodoros}, calculated timeEstimated=${timeEstimated}`);
    
    // Create task object with timeSpent initialized to 0
    const task = {
      title,
      description: taskData.description || '',
      completed: false,
      estimatedPomodoros,
      pomodoros: 0,
      timeSpent: 0,
      timeEstimated,
      projectId: taskData.projectId || null,
      createdAt: new Date().toISOString()
    };
    
    // If user is logged in, save to database
    if (currentUser) {
      // Create a temporary ID for immediate UI update
      const tempId = `temp-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const taskWithTempId = { ...task, id: tempId, synced: false };
      
      // Add to state and localStorage immediately for responsive UI
      setTasks(prevTasks => {
        const newTasks = [...prevTasks, taskWithTempId];
        localStorage.setItem('pomodoro-tasks', JSON.stringify(newTasks));
        return newTasks;
      });
      
      // Save to database in background
      try {
        console.log('DEBUGGING: TaskContext - Saving task to database:', task);
        // Fix for undefined saveTask - use createTask instead
        const savedTask = await createTask(currentUser.id, {
          user_id: currentUser.id,
          name: task.title,
          description: task.description,
          status: task.completed ? 'completed' : 'active',
          estimated_pomodoros: task.estimatedPomodoros,
          completed_pomodoros: task.pomodoros,
          project_id: task.projectId,
          timeSpent: task.timeSpent, // Save timeSpent to database
          timeEstimated: task.timeEstimated // Save timeEstimated to database
        });
        
        if (savedTask) {
          console.log('DEBUGGING: TaskContext - Task saved successfully with ID:', savedTask.id);
          // Replace temporary task with saved task
          setTasks(prevTasks => {
            const updatedTasks = prevTasks.map(t => 
              t.id === tempId 
              ? { 
                  ...t, 
                  id: savedTask.id, 
                  synced: true, 
                  createdAt: savedTask.created_at 
                } 
              : t
            );
            localStorage.setItem('pomodoro-tasks', JSON.stringify(updatedTasks));
            return updatedTasks;
          });
        } else {
          console.error('DEBUGGING: TaskContext - Failed to save task to database');
          setSyncStatus('error');
        }
      } catch (error) {
        console.error('DEBUGGING: TaskContext - Error saving task to database:', error);
        setSyncStatus('error');
      }
    } else {
      // No user logged in, just use localStorage
      // Generate a simple numeric ID for the task
      const localId = `local-${Date.now()}`;
      const newTask = { ...task, id: localId, synced: true };
      
      // Add to state and localStorage
      setTasks(prevTasks => {
        const newTasks = [...prevTasks, newTask];
        localStorage.setItem('pomodoro-tasks', JSON.stringify(newTasks));
        return newTasks;
      });
    }
  };
  
  // Add a session task without adding it to the main task list yet
  const addSessionTask = async (taskData) => {
    console.log('DEBUGGING: TaskContext - addSessionTask called with task:', taskData);
    
    // Get pomodoro time from settings or use default
    const pomodoroTime = getPomodoroTime();
    console.log(`DEBUGGING: TaskContext - Using pomodoroTime from settings: ${pomodoroTime}`);
    
    // Ensure task has required fields
    const validatedTaskData = {
      ...taskData,
      title: taskData.title || 'Untitled Task', // Never allow empty title
      description: taskData.description || '',
      estimatedPomodoros: parseInt(taskData.estimatedPomodoros, 10) || 1,
      pomodoros: parseInt(taskData.pomodoros, 10) || 0,
      timeSpent: 0, // Initialize with zero time spent
      // Store timeEstimated in minutes directly
      timeEstimated: taskData.timeEstimated !== undefined 
        ? parseFloat(taskData.timeEstimated)
        : (taskData.estimatedPomodoros * pomodoroTime) // Calculate from pomodoros * minutes per pomodoro
    };
    
    console.log(`DEBUGGING: TaskContext - Task data validated. timeEstimated=${validatedTaskData.timeEstimated} minutes, estimatedPomodoros=${validatedTaskData.estimatedPomodoros}`);
    
    // Create a temporary ID for immediate UI update
    const tempId = `temp-${Date.now()}`;
    
    // More robust duplicate check
    const titleLowerCase = validatedTaskData.title.toLowerCase().trim();
    const isDuplicate = sessionTasks.some(
      task => task.title.toLowerCase().trim() === titleLowerCase
    );
    
    if (isDuplicate) {
      console.warn('DEBUGGING: TaskContext - Duplicate task detected, not adding:', validatedTaskData.title);
      return null;
    }
    
    // Create a new task with the temporary ID
    const newTask = {
      id: tempId,
      ...validatedTaskData,
      createdAt: new Date().toISOString(),
      synced: false
    };
    
    // Add to state immediately for UI responsiveness, using a callback to reference the current state
    setSessionTasks(prevSessionTasks => {
      // Double-check for duplicates with the latest state
      const duplicateExists = prevSessionTasks.some(task => 
        task.title.toLowerCase().trim() === titleLowerCase
      );
      
      if (duplicateExists) {
        console.warn('DEBUGGING: TaskContext - Duplicate found on second check, not adding:', validatedTaskData.title);
        return prevSessionTasks; // Return unchanged state if duplicate found
      }
      
      // Add new task to the end of the array to maintain consistent order
      // This ensures new tasks will be displayed at the bottom of the session list
      const newSessionTasks = [...prevSessionTasks, newTask];
      // Update localStorage here to ensure it matches state
      localStorage.setItem('pomodoro-session-tasks', JSON.stringify(newSessionTasks));
      return newSessionTasks;
    });
    
    // Try to save to database in the background
    try {
      setSyncStatus('syncing');
      
      if (currentUser) {
        // Use the sync service from syncService.js, not taskSyncService.js
        console.log('DEBUGGING: TaskContext - Using syncService to create session task for user:', currentUser.id);
        
        const dbTaskData = {
          title: validatedTaskData.title,
          description: validatedTaskData.description || '',
          status: 'session', // Special status to identify session tasks
          estimatedPomodoros: validatedTaskData.estimatedPomodoros || 1,
          pomodoros: validatedTaskData.pomodoros || 0,
          projectId: validatedTaskData.projectId || null,
          timeSpent: 0, // Always initialize timeSpent to 0
          timeEstimated: validatedTaskData.timeEstimated // Use the timeEstimated value
        };
        
        console.log('DEBUGGING: TaskContext - Sending task data to syncTaskCreate:', dbTaskData);
        
        const dbTask = await syncTaskCreate(currentUser.id, dbTaskData);
        
        console.log('DEBUGGING: TaskContext - Result from syncTaskCreate:', dbTask);
        
        if (dbTask && dbTask.id) {
          // Check if we got a real database ID (UUID) or a local fallback ID
          const isRealDatabaseId = dbTask.id && typeof dbTask.id === 'string' && 
                                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dbTask.id);
          
          console.log('DEBUGGING: TaskContext - Got task ID:', dbTask.id, 'Is real database ID:', isRealDatabaseId);
          
          // Replace the temporary task with the database version
          setSessionTasks(prevSessionTasks => {
            // Check if the task still exists (user might have deleted it already)
            if (!prevSessionTasks.some(task => task.id === tempId)) {
              console.log('DEBUGGING: TaskContext - Temp task no longer exists, not updating');
              return prevSessionTasks;
            }
            
            const updatedTasks = prevSessionTasks.map(task => 
              task.id === tempId ? {
                id: dbTask.id,
                title: dbTask.name || dbTask.text || validatedTaskData.title,
                description: dbTask.description || validatedTaskData.description || '',
                completed: dbTask.status === 'completed',
                estimatedPomodoros: dbTask.estimated_pomodoros || validatedTaskData.estimatedPomodoros || 1,
                pomodoros: dbTask.completed_pomodoros || 0,
                timeSpent: parseFloat(dbTask.timeSpent) || 0, // Include timeSpent (in hours)
                timeEstimated: parseInt(dbTask.timeEstimated, 10) || pomodoroTime, // Include timeEstimated (in minutes) with settings
                projectId: dbTask.project_id,
                createdAt: dbTask.created_at || new Date().toISOString(),
                synced: isRealDatabaseId // Only mark as synced if we got a real database ID
              } : task
            );
            
            console.log('DEBUGGING: TaskContext - Updated session tasks after DB save:', updatedTasks.length);
            
            // Update localStorage with the updated task
            localStorage.setItem('pomodoro-session-tasks', JSON.stringify(updatedTasks));
            
            return updatedTasks;
          });
          
          // Update the returned task reference
          newTask.id = dbTask.id;
          newTask.synced = isRealDatabaseId;
          
          setSyncStatus(isRealDatabaseId ? 'idle' : 'error');
          
          if (isRealDatabaseId) {
            console.log('DEBUGGING: TaskContext - Session task successfully saved to database with ID:', dbTask.id);
          } else {
            console.error('DEBUGGING: TaskContext - Got non-database ID from syncTaskCreate:', dbTask.id);
          }
        } else {
          console.error('DEBUGGING: TaskContext - Failed to save task to database, keeping temporary task');
          setSyncStatus('error');
        }
      } else {
        // No user logged in, just store in localStorage (already done via useEffect)
        console.log('DEBUGGING: TaskContext - No user logged in, task saved to localStorage only');
        setSyncStatus('idle');
      }
    } catch (error) {
      console.error('DEBUGGING: TaskContext - Error saving session task to database:', error);
      setSyncStatus('error');
      // Even if database sync fails, the task is still in local storage and sessionTasks state
      console.log('DEBUGGING: TaskContext - Task will remain in local storage despite database error');
    }
    
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
    
    // Skip if taskId is a default or temporary ID
    if (taskId.startsWith('default-') || taskId.startsWith('temp-') || 
        taskId.startsWith('local-') || taskId.startsWith('error-') || 
        taskId.startsWith('exception-')) {
      console.log('DEBUGGING: TaskContext - Skipping moveToMainTasks for non-database task ID:', taskId);
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
          // But we'll keep a copy in the session tasks
          await syncTaskUpdate(currentUser.id, taskId, { 
            status: 'todo'
            // Note: In the actual DB, tasks are differentiated by the [SESSION_TASK] prefix
            // in the notes field, which is handled in the sync service
          });
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
        
        // Add to main tasks but DON'T remove from session tasks
        console.log('DEBUGGING: TaskContext - Adding session task to main tasks list');
        return [...prevTasks, { ...sessionTask }];
      });
      
      // We don't remove the task from sessionTasks anymore
      console.log('DEBUGGING: TaskContext - Task kept in session tasks for visibility');
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
    console.log(`DEBUGGING: TaskContext - updateTask called for ID ${taskId} with data:`, taskData);
    
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
  
  // Add this function to the context
  const getDatabaseError = () => {
    return databaseError;
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
    syncPendingChanges,
    getDatabaseError
  };
  
  return (
    <TaskContext.Provider value={value}>
      {children}
    </TaskContext.Provider>
  );
}; 