import { 
  getTasks, 
  createTask as createTaskInDb, 
  updateTask as updateTaskInDb, 
  deleteTask as deleteTaskInDb 
} from '../lib/database';

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
export const syncTaskCreate = async (userId, task) => {
  if (!userId) return null;
  
  try {
    console.log('TaskSync: Creating task in database:', task);
    
    // Map task to database format
    const dbTask = {
      user_id: userId,
      name: task.title,
      description: task.description || '',
      status: task.completed ? 'completed' : (task.status || 'todo'),
      priority: task.priority || 0,
      estimated_pomodoros: task.estimatedPomodoros || 1,
      completed_pomodoros: task.pomodoros || 0,
      position: task.position || 0,
      project_id: task.projectId || null
    };
    
    // Create in database
    const createdTask = await createTaskInDb(dbTask);
    console.log('TaskSync: Task created successfully:', createdTask);
    
    // Return the created task
    return createdTask;
  } catch (error) {
    console.error('TaskSync: Error creating task:', error);
    
    // Add to pending operations for retry
    pendingOperations.create.set(task.id, {userId, task});
    addToRetryQueue({type: 'create', id: task.id});
    
    return null;
  }
};

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
  
  try {
    console.log('TaskSync: Updating task in database:', taskId, updates);
    
    // Map updates to database format
    const dbUpdates = {};
    
    if (updates.title !== undefined) dbUpdates.name = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.completed !== undefined) dbUpdates.status = updates.completed ? 'completed' : 'todo';
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.estimatedPomodoros !== undefined) dbUpdates.estimated_pomodoros = updates.estimatedPomodoros;
    if (updates.pomodoros !== undefined) dbUpdates.completed_pomodoros = updates.pomodoros;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.projectId !== undefined) dbUpdates.project_id = updates.projectId;
    if (updates.position !== undefined) dbUpdates.position = updates.position;
    
    // Only update if we have something to update
    if (Object.keys(dbUpdates).length > 0) {
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
  
  try {
    console.log('TaskSync: Deleting task from database:', taskId);
    await deleteTaskInDb(taskId);
    console.log('TaskSync: Task deleted successfully');
    return true;
  } catch (error) {
    console.error('TaskSync: Error deleting task:', error);
    
    // Add to pending operations for retry
    pendingOperations.delete.add(taskId);
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
  
  // Wait a bit before retrying (exponential backoff could be implemented here)
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  try {
    let success = false;
    
    // Process based on operation type
    if (operation.type === 'create') {
      const pendingCreate = pendingOperations.create.get(operation.id);
      if (pendingCreate) {
        const result = await syncTaskCreate(pendingCreate.userId, pendingCreate.task);
        success = !!result;
        if (success) {
          pendingOperations.create.delete(operation.id);
        }
      }
    } else if (operation.type === 'update') {
      const pendingUpdate = pendingOperations.update.get(operation.id);
      if (pendingUpdate) {
        success = await syncTaskUpdate(
          pendingUpdate.userId, 
          pendingUpdate.taskId, 
          pendingUpdate.updates
        );
        if (success) {
          pendingOperations.update.delete(operation.id);
        }
      }
    } else if (operation.type === 'delete') {
      if (pendingOperations.delete.has(operation.id)) {
        success = await syncTaskDelete(operation.userId, operation.id);
        if (success) {
          pendingOperations.delete.delete(operation.id);
        }
      }
    }
    
    // If failed, add back to the retry queue
    if (!success) {
      retryQueue.push(operation);
    }
  } catch (error) {
    console.error('TaskSync: Error in retry processing:', error);
    retryQueue.push(operation);
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