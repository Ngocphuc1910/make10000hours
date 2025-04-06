import { createTask, getTasks } from '../lib/database';

// Task sync operations
export const syncTaskCreate = async (userId, taskData) => {
  try {
    console.log('DEBUGGING: syncService - Creating task for user:', userId);
    
    if (!userId) {
      console.error('DEBUGGING: syncService - Cannot create task: No user ID provided');
      return null;
    }
    
    // Check for valid taskData
    if (!taskData || typeof taskData !== 'object') {
      console.error('DEBUGGING: syncService - Invalid task data:', taskData);
      return null;
    }

    // Ensure we have valid data with proper type conversions
    const safeTaskData = {
      title: taskData.title || 'Untitled Task',
      description: taskData.description || '',
      status: taskData.status || 'todo',
      // Use parseInt with radix to avoid octal/hex interpretation
      estimatedPomodoros: parseInt(taskData.estimatedPomodoros, 10) || 1,
      pomodoros: parseInt(taskData.pomodoros, 10) || 0,
      projectId: taskData.projectId || null
    };
    
    console.log('DEBUGGING: syncService - Creating task with data:', safeTaskData);
    
    // Add a session marker if needed for database storage
    if (safeTaskData.status === 'session') {
      console.log('DEBUGGING: syncService - This is a session task, adding marker');
      // The session marker is now handled directly in createTask
    }
    
    // Call database function with userId and taskData
    const createdTask = await createTask(userId, safeTaskData);
    
    // Check if createTask returned a result
    if (!createdTask) {
      console.error('DEBUGGING: syncService - Task creation returned null');
      
      // Store task in localStorage as fallback
      try {
        const fallbackId = `local-${Date.now()}`;
        const fallbackTask = {
          id: fallbackId,
          name: safeTaskData.title,
          text: safeTaskData.title,
          description: safeTaskData.description,
          status: safeTaskData.status,
          estimated_pomodoros: safeTaskData.estimatedPomodoros,
          completed_pomodoros: safeTaskData.pomodoros,
          project_id: safeTaskData.projectId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        console.log('DEBUGGING: syncService - Created fallback task:', fallbackTask);
        
        // Store in localStorage for persistence
        try {
          const fallbackTasks = JSON.parse(localStorage.getItem('pomodoro-fallback-tasks') || '[]');
          fallbackTasks.push(fallbackTask);
          localStorage.setItem('pomodoro-fallback-tasks', JSON.stringify(fallbackTasks));
        } catch (storageError) {
          console.error('DEBUGGING: syncService - Error storing fallback task in localStorage:', storageError);
        }
        
        return fallbackTask;
      } catch (fallbackError) {
        console.error('DEBUGGING: syncService - Error creating fallback task:', fallbackError);
        return null;
      }
    }
    
    // Check if we received a valid ID (should be a UUID)
    const isValidUuid = typeof createdTask.id === 'string' && 
                      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(createdTask.id);
    
    if (isValidUuid) {
      console.log('DEBUGGING: syncService - Task created successfully with valid UUID:', createdTask.id);
    } else {
      console.warn('DEBUGGING: syncService - Task created but has suspicious ID:', createdTask.id);
      
      // If the ID doesn't look like a UUID, it might be a local fallback - check the type
      if (typeof createdTask.id === 'string' && createdTask.id.startsWith('local-')) {
        console.warn('DEBUGGING: syncService - Task has a local fallback ID, this means it was not saved to the database');
      }
    }
    
    // Ensure the output has consistent field names
    const normalizedTask = {
      id: createdTask.id,
      name: createdTask.name || createdTask.text || safeTaskData.title,
      text: createdTask.text || createdTask.name || safeTaskData.title,
      description: createdTask.description || safeTaskData.description,
      status: createdTask.status || safeTaskData.status,
      estimated_pomodoros: createdTask.estimated_pomodoros || safeTaskData.estimatedPomodoros,
      completed_pomodoros: createdTask.completed_pomodoros || safeTaskData.pomodoros,
      project_id: createdTask.project_id || safeTaskData.projectId,
      created_at: createdTask.created_at || new Date().toISOString(),
      updated_at: createdTask.updated_at || new Date().toISOString()
    };
    
    console.log('DEBUGGING: syncService - Returning normalized task:', normalizedTask);
    return normalizedTask;
  } catch (error) {
    console.error('DEBUGGING: syncService - Error creating task:', error);
    
    // Return a fallback object to prevent app crashes
    const fallbackId = `error-${Date.now()}`;
    return {
      id: fallbackId,
      name: taskData.title || 'Untitled Task',
      text: taskData.title || 'Untitled Task',
      description: taskData.description || '',
      status: taskData.status || 'todo',
      estimated_pomodoros: parseInt(taskData.estimatedPomodoros, 10) || 1,
      completed_pomodoros: parseInt(taskData.pomodoros, 10) || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }
};

export const syncTaskFetch = async (userId) => {
  try {
    console.log('DEBUGGING: syncService - Fetching tasks for user:', userId);
    
    if (!userId) {
      console.error('DEBUGGING: syncService - Cannot fetch tasks: No user ID provided');
      return null;
    }
    
    // Call database function to get tasks
    const tasks = await getTasks(userId);
    
    if (!tasks) {
      console.error('DEBUGGING: syncService - Task fetching failed');
      return null;
    }
    
    console.log(`DEBUGGING: syncService - Successfully fetched ${tasks.length} tasks`);
    return tasks;
  } catch (error) {
    console.error('DEBUGGING: syncService - Error fetching tasks:', error);
    return null;
  }
}; 