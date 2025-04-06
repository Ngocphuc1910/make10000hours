import { 
  createTask as createTaskInDb, 
  updateTask as updateTaskInDb, 
  deleteTask as deleteTaskInDb 
} from '../lib/database';
import supabase from '../lib/supabase';

/**
 * Task Synchronization Service
 * 
 * This service provides methods to synchronize tasks between the local state and the database.
 * It handles background synchronization, error handling, and retries.
 */

// Keep track of pending operations
const pendingOperations = {
  create: new Map(),
  update: new Map(),
  delete: new Set()
};

// Initialize a queue of operations to retry
let retryQueue = [];
let isProcessingRetries = false;

/**
 * Sync a new task to the database
 * 
 * @param {string} userId - The current user ID
 * @param {object} task - The task to create
 * @returns {Promise<object>} - The created task from the database, or null if failed
 */
// IMPORTANT: This function is commented out because it's imported from syncService.js
/*
export const syncTaskCreate = async (userId, task) => {
  if (!userId) return null;
  
  try {
    console.log('TaskSync: Creating task in database:', task);
    
    // For session tasks, we'll store that in notes with a special prefix
    // This is a workaround since we can't add a new column
    const notesWithSessionInfo = task.status === 'session' 
      ? `[SESSION_TASK] ${task.description || ''}`
      : task.description || '';
    
    // Map task to database format using the actual column names in the database
    const dbTask = {
      user_id: userId,
      text: task.title || 'Untitled Task', // Never allow null for text field
      notes: notesWithSessionInfo,
      completed: task.completed || (task.status === 'completed'), // Map status to completed boolean
      completed_at: (task.completed || task.status === 'completed') ? new Date().toISOString() : null,
      pomodoro_count: task.pomodoros || 0, // Map pomodoros to pomodoro_count
      target_pomodoros: task.estimatedPomodoros || 1, // Map estimatedPomodoros to target_pomodoros
      project_id: task.projectId || null
    };
    
    console.log('TaskSync: Mapped database task:', dbTask);
    
    // Create in database
    const createdTask = await createTaskInDb(dbTask);
    console.log('TaskSync: Task created successfully:', createdTask);
    
    // Return the created task with proper status
    // Add status field to the response since database.js doesn't set it for session tasks
    const finalTask = {
      ...createdTask,
      status: task.status, // Preserve the original status
      description: task.description || '' // Restore the original description without session marker
    };
    
    console.log('TaskSync: Returning task with status preserved:', finalTask);
    return finalTask;
  } catch (error) {
    console.error('TaskSync: Error creating task:', error);
    
    // Add to pending operations for retry
    pendingOperations.create.set(task.id, {userId, task});
    addToRetryQueue({type: 'create', id: task.id});
    
    return null;
  }
};
*/

/**
 * Sync task update to the database
 * 
 * @param {string} userId - The current user ID
 * @param {string} taskId - The ID of the task to update
 * @param {object} updates - The updates to apply
 * @returns {Promise<boolean>} - Whether the update was successful
 */
export const syncTaskUpdate = async (userId, taskId, updates) => {
  if (!userId) return false;
  
  // Skip if taskId is a default or temporary ID
  if (taskId.startsWith('default-') || taskId.startsWith('temp-') || 
      taskId.startsWith('local-') || taskId.startsWith('error-') || 
      taskId.startsWith('exception-')) {
    console.log('TaskSync: Skipping update for non-database task ID:', taskId);
    return false;
  }
  
  try {
    console.log('TaskSync: Updating task in database:', taskId, updates);
    
    // Map updates to database format using the actual column names
    const dbUpdates = {};
    
    if (updates.title !== undefined) dbUpdates.text = updates.title;
    
    // Special handling for description and status
    if (updates.description !== undefined || updates.status !== undefined) {
      // First get the current task to check its current status
      const { data: currentTask, error: getError } = await supabase
        .from('tasks')
        .select('notes')
        .eq('id', taskId)
        .single();
      
      if (getError) {
        console.error('TaskSync: Error getting current task:', getError);
      } else {
        const currentNotes = currentTask.notes || '';
        const isCurrentlySessionTask = currentNotes.startsWith('[SESSION_TASK]');
        const cleanDescription = isCurrentlySessionTask 
          ? currentNotes.replace('[SESSION_TASK] ', '') 
          : currentNotes;
        
        // Determine if this should be a session task after update
        const newDescription = updates.description !== undefined ? updates.description : cleanDescription;
        const newStatus = updates.status !== undefined ? updates.status : (isCurrentlySessionTask ? 'session' : 'todo');
        
        // Update notes field based on status
        if (newStatus === 'session') {
          dbUpdates.notes = `[SESSION_TASK] ${newDescription}`;
        } else {
          dbUpdates.notes = newDescription;
        }
      }
    }
    
    // Handle completed/status conversion
    if (updates.completed !== undefined) {
      dbUpdates.completed = updates.completed;
      if (updates.completed) {
        dbUpdates.completed_at = new Date().toISOString();
      } else {
        dbUpdates.completed_at = null;
      }
    }
    if (updates.status !== undefined) {
      dbUpdates.completed = updates.status === 'completed';
      if (updates.status === 'completed') {
        dbUpdates.completed_at = new Date().toISOString();
      } else {
        dbUpdates.completed_at = null;
      }
    }
    
    if (updates.estimatedPomodoros !== undefined) dbUpdates.target_pomodoros = updates.estimatedPomodoros;
    if (updates.pomodoros !== undefined) dbUpdates.pomodoro_count = updates.pomodoros;
    if (updates.projectId !== undefined) dbUpdates.project_id = updates.projectId;
    
    // Only update if we have something to update
    if (Object.keys(dbUpdates).length > 0) {
      console.log('TaskSync: Updating with:', dbUpdates);
      await updateTaskInDb(taskId, dbUpdates);
      console.log('TaskSync: Task updated successfully');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('TaskSync: Error updating task:', error);
    
    // Add to pending operations for retry
    pendingOperations.update.set(taskId, {userId, taskId, updates});
    addToRetryQueue({type: 'update', id: taskId});
    
    return false;
  }
};

/**
 * Sync task deletion to the database
 * 
 * @param {string} userId - The current user ID
 * @param {string} taskId - The ID of the task to delete
 * @returns {Promise<boolean>} - Whether the deletion was successful
 */
export const syncTaskDelete = async (userId, taskId) => {
  if (!userId) return false;
  
  // Skip if taskId is a default or temporary ID
  if (taskId.startsWith('default-') || taskId.startsWith('temp-') || 
      taskId.startsWith('local-') || taskId.startsWith('error-') || 
      taskId.startsWith('exception-')) {
    console.log('TaskSync: Skipping delete for non-database task ID:', taskId);
    return true; // Return true to prevent unnecessary retries
  }
  
  try {
    console.log('TaskSync: Deleting task from database:', taskId);
    
    // Check if the task exists in the database before attempting to delete
    const { data, error: checkError } = await supabase
      .from('tasks')
      .select('id, notes')
      .eq('id', taskId)
      .single();
    
    if (checkError) {
      // If the task doesn't exist in the database, consider it a success
      // This could happen if the task was created locally and never synced
      if (checkError.code === 'PGRST116') {
        console.log('TaskSync: Task does not exist in database, skipping delete');
        return true;
      }
      
      console.error('TaskSync: Error checking task existence:', checkError);
      throw checkError;
    }
    
    // Check if this is a session task from the notes field
    const isSessionTask = data?.notes?.startsWith('[SESSION_TASK]');
    if (isSessionTask) {
      console.log('TaskSync: Deleting session task:', taskId);
    }
    
    // Delete the task from the database
    await deleteTaskInDb(taskId);
    console.log('TaskSync: Task deleted successfully');
    
    return true;
  } catch (error) {
    console.error('TaskSync: Error deleting task:', error);
    
    // Add to pending operations for retry
    pendingOperations.delete.set(taskId, {userId, taskId});
    addToRetryQueue({type: 'delete', id: taskId});
    
    return false;
  }
};

/**
 * Add an operation to the retry queue
 * 
 * @param {object} operation - The operation to add
 */
const addToRetryQueue = (operation) => {
  retryQueue.push(operation);
  
  // If not already processing retries, start processing
  if (!isProcessingRetries) {
    processRetryQueue();
  }
};

/**
 * Process the retry queue with exponential backoff
 */
const processRetryQueue = async () => {
  if (retryQueue.length === 0) {
    isProcessingRetries = false;
    return;
  }
  
  isProcessingRetries = true;
  
  // Get the next operation
  const operation = retryQueue.shift();
  
  // Validate operation ID
  if (!operation || !operation.id) {
    console.error('TaskSync: Invalid operation in retry queue:', operation);
    // Continue processing the queue
    processRetryQueue();
    return;
  }
  
  // Skip if it's a default or temporary ID 
  if (operation.id.startsWith('default-') || operation.id.startsWith('temp-') || 
      operation.id.startsWith('local-') || operation.id.startsWith('error-') || 
      operation.id.startsWith('exception-')) {
    console.log('TaskSync: Skipping retry for non-database operation ID:', operation.id);
    // Continue processing the queue
    processRetryQueue();
    return;
  }
  
  // Wait a bit before retrying (exponential backoff could be implemented here)
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  try {
    let success = false;
    
    // Process based on operation type
    if (operation.type === 'create') {
      const pendingCreate = pendingOperations.create.get(operation.id);
      if (pendingCreate) {
        try {
          // Import syncTaskCreate here to avoid circular dependencies
          const { syncTaskCreate } = require('./syncService');
          const result = await syncTaskCreate(pendingCreate.userId, pendingCreate.task);
          success = !!result;
          if (success) {
            pendingOperations.create.delete(operation.id);
          }
        } catch (createError) {
          console.error('TaskSync: Error in create retry:', createError);
          success = false;
        }
      } else {
        // If the operation is not in the pending operations, consider it a success
        success = true;
      }
    } else if (operation.type === 'update') {
      const pendingUpdate = pendingOperations.update.get(operation.id);
      if (pendingUpdate) {
        try {
          success = await syncTaskUpdate(
            pendingUpdate.userId, 
            pendingUpdate.taskId, 
            pendingUpdate.updates
          );
          if (success) {
            pendingOperations.update.delete(operation.id);
          }
        } catch (updateError) {
          console.error('TaskSync: Error in update retry:', updateError);
          success = false;
        }
      } else {
        // If the operation is not in the pending operations, consider it a success
        success = true;
      }
    } else if (operation.type === 'delete') {
      if (pendingOperations.delete.has(operation.id)) {
        try {
          success = await syncTaskDelete(operation.userId, operation.id);
          if (success) {
            pendingOperations.delete.delete(operation.id);
          }
        } catch (deleteError) {
          console.error('TaskSync: Error in delete retry:', deleteError);
          success = false;
        }
      } else {
        // If the operation is not in the pending operations, consider it a success
        success = true;
      }
    }
    
    // If failed, add back to the retry queue with a max retry limit
    if (!success) {
      // Add a retry count to the operation
      operation.retryCount = (operation.retryCount || 0) + 1;
      
      // Limit retries to 5 attempts to prevent infinite loops
      if (operation.retryCount <= 5) {
        retryQueue.push(operation);
      } else {
        console.warn('TaskSync: Max retries reached for operation:', operation);
        // Remove from pending operations to prevent further retries
        if (operation.type === 'create') pendingOperations.create.delete(operation.id);
        if (operation.type === 'update') pendingOperations.update.delete(operation.id);
        if (operation.type === 'delete') pendingOperations.delete.delete(operation.id);
      }
    }
    
    // Save pending operations after any changes
    savePendingOperations();
  } catch (error) {
    console.error('TaskSync: Error in retry processing:', error);
    
    // Add a retry count to the operation
    operation.retryCount = (operation.retryCount || 0) + 1;
    
    // Limit retries to 5 attempts
    if (operation.retryCount <= 5) {
      retryQueue.push(operation);
    } else {
      console.warn('TaskSync: Max retries reached for operation after error:', operation);
    }
  }
  
  // Continue processing the queue
  processRetryQueue();
};

/**
 * Get all pending operations
 * 
 * @returns {object} - Pending operations
 */
export const getPendingOperations = () => {
  return {
    create: Array.from(pendingOperations.create.values()),
    update: Array.from(pendingOperations.update.values()),
    delete: Array.from(pendingOperations.delete)
  };
};

/**
 * Clear all pending operations
 */
export const clearPendingOperations = () => {
  pendingOperations.create.clear();
  pendingOperations.update.clear();
  pendingOperations.delete.clear();
  retryQueue = [];
};

/**
 * Save pending operations to localStorage for persistence
 */
const savePendingOperations = () => {
  try {
    const serializedOperations = {
      create: Array.from(pendingOperations.create.entries()),
      update: Array.from(pendingOperations.update.entries()),
      delete: Array.from(pendingOperations.delete)
    };
    
    localStorage.setItem('pendingTaskOperations', JSON.stringify(serializedOperations));
    console.log('DEBUGGING: taskSyncService - Pending operations saved to localStorage');
  } catch (error) {
    console.error('DEBUGGING: taskSyncService - Error saving pending operations:', error);
  }
};

// Function to execute a single pending create operation
const executePendingCreate = async (operation) => {
  try {
    console.log('DEBUGGING: taskSyncService - Executing pending create operation:', operation);
    
    // Import syncTaskCreate here to avoid circular dependencies
    const { syncTaskCreate } = require('./syncService');
    
    const result = await syncTaskCreate(operation.userId, operation.data);
    
    if (result) {
      // Remove the operation from pending operations
      pendingOperations.create = pendingOperations.create.filter(op => op.id !== operation.id);
      // Save updated pending operations
      savePendingOperations();
      
      console.log('DEBUGGING: taskSyncService - Create operation completed successfully:', result);
      return true;
    } else {
      console.error('DEBUGGING: taskSyncService - Create operation failed');
      return false;
    }
  } catch (error) {
    console.error('DEBUGGING: taskSyncService - Error executing create operation:', error);
    return false;
  }
}; 