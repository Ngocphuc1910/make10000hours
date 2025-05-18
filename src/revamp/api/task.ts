import { Task } from '../models/task';
import supabase from './supabase';

/**
 * Task operations
 */
export const getTasks = async (userId: string, projectId?: string): Promise<Task[]> => {
  if (!supabase) return [];
  let query = supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId);
  
  if (projectId) {
    query = query.eq('project_id', projectId);
  }
  
  const { data, error } = await query.order('created_at', { ascending: false });
  
  if (error) throw error;
  
  console.log('Database: Raw tasks from DB:', data);
  
  // Map database fields to the expected format in the code
  return data.map(task => {
    // Determine the status based on available fields
    let status = 'todo';
    let description = task.notes || '';
    
    if (task.completed) {
      status = 'completed';
    } 
    // Check if this is a session task by looking for the [SESSION_TASK] marker
    else if (task.notes && task.notes.startsWith('[SESSION_TASK]')) {
      status = 'session';
      // Remove the [SESSION_TASK] marker from the description
      description = task.notes.replace('[SESSION_TASK] ', '');
    }
    
    console.log(`Database: Task ${task.id} notes -> description mapping: "${task.notes || 'EMPTY'}" -> "${description || 'EMPTY'}"`);
    
    return {
      id: task.id,
      user_id: task.user_id,
      project_id: task.project_id,
      title: task.text, // Map text to name
      note: description, // Clean description
      status: status, // Use the determined status
      time_spent: parseFloat(task.timeSpent) || 0, // Include timeSpent field (in hours)
      time_estimated: parseInt(task.timeEstimated, 10) || 25, // Include timeEstimated field (in minutes)
      created_at: task.created_at,
      updated_at: task.updated_at
    };
  });
};

export const createTask = async (userId: string, taskData: Task): Promise<Task | null> => {
  if (!supabase) return null;
  
  try {
    // Map expected fields to database column names - Use ONLY actual column names that exist in the database
    const dbTaskData = {
      user_id: userId,
      text: taskData.title || 'Untitled Task', // DB column is 'text' not 'name'
      notes: taskData.status === 'session' 
        ? `[SESSION_TASK] ${taskData.note || ''}`  // Mark session tasks
        : (taskData.note || ''),
      completed: taskData.status === 'completed',
      completed_at: taskData.status === 'completed' ? new Date().toISOString() : null,
      project_id: taskData.project_id,
      timeEstimated: taskData.time_estimated || 25, // Add the timeEstimated field
      timeSpent: taskData.time_spent || 0 // Add the timeSpent field (in hours)
    };
    
    console.log('DEBUGGING: database.js - Saving task to database with data:', dbTaskData);
    
    // First check if the tasks table exists by performing a simple query
    const { error: checkError } = await supabase
      .from('tasks')
      .select('*')
      .limit(1);
      
    if (checkError) {
      // Check for invalid API key error (most common issue)
      if (checkError.message === 'Invalid API key' || checkError.message.includes('Invalid API key')) {
        console.error('DEBUGGING: database.js - CRITICAL ERROR: Invalid Supabase API key!');
        console.error('This is why tasks are not being saved to the database.');
        console.error('Please check your environment variables and Supabase settings.');
        
        // Return a local task with clear error indication
        return {
          id: `api-error-${Date.now()}`,
          user_id: userId,
          title: dbTaskData.text,
          note: dbTaskData.notes,
          status: 'error', // Special status to indicate this is an error
          project_id: dbTaskData.project_id ,
          time_spent: dbTaskData.timeSpent || 0,
          time_estimated: dbTaskData.timeEstimated || 25,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
      
      if (checkError.code === '42P01' || checkError.message.includes('relation "public.tasks" does not exist')) {
        console.error('DEBUGGING: database.js - Tasks table does not exist in the database');
        
        // Return a simulated task object to keep the app working
        return {
          id: `local-${Date.now()}`,
          user_id: userId,
          title: dbTaskData.text,
          note: dbTaskData.notes,
          status: 'error', // Special status to indicate this is an error
          project_id: dbTaskData.project_id ,
          time_spent: dbTaskData.timeSpent || 0,
          time_estimated: dbTaskData.timeEstimated || 25,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
      
      console.error('DEBUGGING: database.js - Error checking tasks table:', checkError);
    }
    
    // Explicitly log the exact SQL that will be executed
    console.log('DEBUGGING: database.js - About to insert task with the following data:', JSON.stringify(dbTaskData));
    
    const { data, error } = await supabase
      .from('tasks')
      .insert([dbTaskData])
      .select()
      .single();
    
    if (error) {
      console.error('DEBUGGING: database.js - Error creating task:', error);
      console.error('DEBUGGING: database.js - Error details:', error.message, error.details, error.hint);
      
      // Handle invalid API key error
      if (error.message === 'Invalid API key' || error.message.includes('Invalid API key')) {
        console.error('DEBUGGING: database.js - CRITICAL ERROR: Invalid Supabase API key for insert operation!');
        return {
          id: `api-error-${Date.now()}`,
          user_id: userId,
          title: dbTaskData.text,
          note: dbTaskData.notes,
          status: 'error', // Special status to indicate this is an error
          project_id: dbTaskData.project_id ,
          time_spent: dbTaskData.timeSpent || 0,
          time_estimated: dbTaskData.timeEstimated || 25,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
      
      // Handle specific error cases
      if (error.code === '23503' && error.message.includes('violates foreign key constraint')) {
        console.warn('DEBUGGING: database.js - Foreign key constraint error, user_id may not exist:', userId);
      }
      
      // Return a local fallback task
      return {
        id: `error-${Date.now()}`,
        user_id: userId,
        title: dbTaskData.text,
        note: dbTaskData.notes,
        status: 'error', // Special status to indicate this is an error
        project_id: dbTaskData.project_id ,
        time_spent: dbTaskData.timeSpent || 0,
        time_estimated: dbTaskData.timeEstimated || 25,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
    
    console.log('DEBUGGING: database.js - Task created successfully:', data);
    
    // Format the response to match the expected structure in the application
    return {
      id: `api-error-${Date.now()}`,
      user_id: userId,
      title: dbTaskData.text,
      note: dbTaskData.notes,
      status: 'error', // Special status to indicate this is an error
      project_id: dbTaskData.project_id ,
      time_spent: dbTaskData.timeSpent || 0,
      time_estimated: dbTaskData.timeEstimated || 25,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('DEBUGGING: database.js - Unexpected error creating task:', error);
    
    // Always return a valid object to prevent app crashes
    return {
      id: `exception-${Date.now()}`,
      user_id: userId,
      title: taskData.title || 'Untitled Task',
      note: taskData.note || '',
      status: 'error', // Special status to indicate this is an error
      project_id: taskData.project_id ,
      time_spent: taskData.time_spent || 0,
      time_estimated: taskData.time_estimated || 25,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }
};

export const updateTask = async (taskId: string, updates: Task): Promise<Task | null> => {
  if (!supabase) return null;
  try {
    console.log('DEBUGGING: database.js - updateTask called with ID:', taskId);
    
    // Skip if taskId is a default or temporary ID
    if (!taskId || taskId.startsWith('default-') || taskId.startsWith('temp-') || 
        taskId.startsWith('local-') || taskId.startsWith('error-') || 
        taskId.startsWith('exception-')) {
      console.log('DEBUGGING: database.js - Skipping update for non-database task ID:', taskId);
      return null;
    }
    
    // Map expected field names to the actual database column names
    const dbUpdates: {[key: string]: any} = {};
    
    if (updates.title) dbUpdates.text = updates.title;
    if (updates.note) dbUpdates.notes = updates.note;
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.time_estimated) dbUpdates.timeEstimated = updates.time_estimated;
    if (updates.time_spent) dbUpdates.timeSpent = updates.time_spent;
    
    dbUpdates.updated_at = new Date().toISOString();
    
    console.log('DEBUGGING: database.js - Updating task with data:', dbUpdates);
    
    // First check if the task exists
    const { error: checkError } = await supabase
      .from('tasks')
      .select('id')
      .eq('id', taskId)
      .single();
      
    if (checkError) {
      console.error('DEBUGGING: database.js - Error checking if task exists:', checkError);
      if (checkError.code === 'PGRST116') {
        console.error('DEBUGGING: database.js - Task does not exist in database');
        return null;
      }
      throw checkError;
    }
    
    const { data, error } = await supabase
      .from('tasks')
      .update(dbUpdates)
      .eq('id', taskId)
      .select();
    
    if (error) {
      console.error('DEBUGGING: database.js - Error updating task:', error);
      return null;
    }
    
    if (!data || data.length === 0) {
      console.error('DEBUGGING: database.js - No task data returned after update');
      return null;
    }
    
    console.log('DEBUGGING: database.js - Task updated successfully:', data[0]);
    
    // Convert the response back to the expected format
    const task = data[0];
    
    // Determine the description, handling session task markers
    let description = task.notes || '';
    if (task.notes && task.notes.startsWith('[SESSION_TASK]')) {
      description = task.notes.replace('[SESSION_TASK] ', '');
    }
    
    return {
      id: task.id,
      user_id: task.user_id,
      project_id: task.project_id,
      title: task.text,
      note: description, // Include properly processed description
      status: task.completed ? 'completed' : 
              (task.notes && task.notes.startsWith('[SESSION_TASK]')) ? 'session' : 'todo',
      time_spent: parseFloat(task.timeSpent) || 0,
      time_estimated: parseInt(task.timeEstimated, 10) || 25,
      created_at: task.created_at,
      updated_at: task.updated_at
    };
  } catch (error) {
    console.error('DEBUGGING: database.js - Unexpected error updating task:', error);
    return null;
  }
};

export const deleteTask = async (taskId: string): Promise<boolean> => {
  if (!supabase) return false;
  try {
    console.log('DEBUGGING: database.js - deleteTask called with ID:', taskId);
    
    // Skip if taskId is a default or temporary ID
    if (!taskId || taskId.startsWith('default-') || taskId.startsWith('temp-') || 
        taskId.startsWith('local-') || taskId.startsWith('error-') || 
        taskId.startsWith('exception-')) {
      console.log('DEBUGGING: database.js - Skipping delete for non-database task ID:', taskId);
      return true; // Return true to avoid unnecessary retries
    }
    
    // Check if task exists before attempting to delete
    const { error: checkError } = await supabase
      .from('tasks')
      .select('id')
      .eq('id', taskId)
      .single();
      
    if (checkError) {
      // If the task doesn't exist, consider it already deleted
      if (checkError.code === 'PGRST116') {
        console.log('DEBUGGING: database.js - Task does not exist, considering already deleted');
        return true;
      }
      console.error('DEBUGGING: database.js - Error checking if task exists:', checkError);
      throw checkError;
    }
    
    // Perform the delete operation
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);
    
    if (error) {
      console.error('DEBUGGING: database.js - Error deleting task:', error);
      return false;
    }
    
    console.log('DEBUGGING: database.js - Task deleted successfully');
    return true;
  } catch (error) {
    console.error('DEBUGGING: database.js - Unexpected error deleting task:', error);
    return false;
  }
};
