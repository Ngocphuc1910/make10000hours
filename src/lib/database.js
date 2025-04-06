import supabaseClient from './supabase';

// Use global.supabaseOverride if available (for testing)
const supabase = global.supabaseOverride || supabaseClient;

/**
 * User profile operations
 */
export const getUserProfile = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      // If profile doesn't exist yet, return null instead of throwing
      if (error.code === 'PGRST116') {
        console.log('Profile not found for user:', userId, 'This is normal for new users');
        return null;
      }
      
      // Handle case where profiles table does not exist
      if (error.code === '42P01' || error.message.includes('relation "public.profiles" does not exist')) {
        console.warn('Profiles table does not exist in the database. Creating default profile.');
        // Return a default profile object that won't break the app
        return { 
          id: userId,
          email: null,
          full_name: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
      
      console.error('Error fetching user profile:', error);
      return null; // Return null instead of throwing to prevent app crashes
    }
    return data;
  } catch (error) {
    console.error('Unexpected error in getUserProfile:', error);
    return null; // Return null for any other errors to keep the app working
  }
};

export const createOrUpdateUserProfile = async (profileData) => {
  // Check if profile exists
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', profileData.id)
    .single();
  
  let result;
  
  if (existingProfile) {
    // Update existing profile
    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...profileData,
        updated_at: new Date().toISOString()
      })
      .eq('id', profileData.id)
      .select();
    
    if (error) throw error;
    result = data[0];
  } else {
    // Create new profile
    const { data, error } = await supabase
      .from('profiles')
      .insert(profileData)
      .select();
    
    if (error) throw error;
    result = data[0];
  }
  
  return result;
};

export const updateUserProfile = async (userId, updates) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)
    .select();
  
  if (error) throw error;
  return data[0];
};

/**
 * User settings operations
 */
export const getUserSettings = async (userId) => {
  console.log('Database: Getting user settings for user:', userId);
  
  // Return default settings if no userId provided
  if (!userId) {
    console.log('Database: No userId provided to getUserSettings, returning defaults');
    return getDefaultSettings();
  }
  
  // Check if auth session is valid
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Database: Session error in getUserSettings:', sessionError);
      return getDefaultSettings();
    }
    
    if (!session) {
      console.log('Database: No active session found in getUserSettings');
      return getDefaultSettings();
    }
    
    if (session.user.id !== userId) {
      console.error('Database: Session user ID does not match requested user ID');
      return getDefaultSettings();
    }
    
    // Verify token is not expired
    const expiresAt = new Date(session.expires_at * 1000);
    const now = new Date();
    console.log(`Database: Session expires at ${expiresAt.toISOString()}, ${Math.floor((expiresAt - now) / 1000 / 60)} minutes remaining`);
    
    if (expiresAt < now) {
      console.error('Database: Session token is expired');
      return getDefaultSettings();
    }
  
    // Query the database
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
  
    if (error) {
      console.error('Database: Error getting user settings:', error);
      
      // If table doesn't exist, return default settings
      if (error.code === 'PGRST301' || error.message.includes('does not exist')) {
        console.error('Database: user_settings table does not exist');
        return getDefaultSettings();
      }
      
      // Check localStorage if we can't access the database
      return getFallbackSettings();
    }
  
    // If no user settings found, return default settings
    if (!data) {
      console.log('Database: No user settings found, returning defaults');
      return getDefaultSettings();
    }
  
    console.log('Database: User settings found:', data);
    
    // Ensure we return the settings object, not the row
    const settings = data.settings || {};
    
    // Apply defaults to ensure all required fields exist
    return mergeWithDefaults(settings);
  } catch (error) {
    console.error('Database: Unexpected error in getUserSettings:', error);
    return getFallbackSettings();
  }
};

/**
 * Get default settings
 */
function getDefaultSettings() {
  console.log('Database: Using default settings');
  
  // Default settings
  const defaults = {
    pomodoroTime: 25,
    shortBreakTime: 5,
    longBreakTime: 15,
    shortBreakEnabled: true,
    longBreakEnabled: true,
    longBreakInterval: 4,
    autoStartSessions: false,
    soundEnabled: true,
    volume: 0.5
  };
  
  return defaults;
}

/**
 * Get settings from localStorage as fallback
 */
function getFallbackSettings() {
  try {
    console.log('Database: Attempting to get settings from localStorage');
    const localSettings = localStorage.getItem('timerSettings');
    
    if (localSettings) {
      const parsed = JSON.parse(localSettings);
      console.log('Database: Found settings in localStorage:', parsed);
      return mergeWithDefaults(parsed);
    }
  } catch (e) {
    console.error('Database: Error parsing localStorage settings:', e);
  }
  
  return getDefaultSettings();
}

/**
 * Merge user settings with defaults
 */
function mergeWithDefaults(userSettings) {
  const defaults = getDefaultSettings();
  
  // Type conversion to ensure correct types
  const merged = {
    ...defaults,
    ...userSettings,
    // Ensure number types
    pomodoroTime: Number(userSettings.pomodoroTime) || defaults.pomodoroTime,
    shortBreakTime: Number(userSettings.shortBreakTime) || defaults.shortBreakTime,
    longBreakTime: Number(userSettings.longBreakTime) || defaults.longBreakTime,
    longBreakInterval: Number(userSettings.longBreakInterval) || defaults.longBreakInterval,
    // Ensure boolean types
    shortBreakEnabled: userSettings.shortBreakEnabled !== undefined ? !!userSettings.shortBreakEnabled : defaults.shortBreakEnabled,
    longBreakEnabled: userSettings.longBreakEnabled !== undefined ? !!userSettings.longBreakEnabled : defaults.longBreakEnabled,
    autoStartSessions: userSettings.autoStartSessions !== undefined ? !!userSettings.autoStartSessions : defaults.autoStartSessions,
    soundEnabled: userSettings.soundEnabled !== undefined ? !!userSettings.soundEnabled : defaults.soundEnabled,
    // Handle volume specially (must be between 0 and 1)
    volume: userSettings.volume !== undefined ? Math.min(Math.max(Number(userSettings.volume), 0), 1) : defaults.volume
  };
  
  console.log('Database: Merged settings with defaults:', merged);
  return merged;
}

/**
 * Saves user settings to the database
 * 
 * @param {string} userId - The user's ID
 * @param {object} settings - The settings object to save
 * @returns {object} The saved settings record
 * 
 * NOTE: When adding new settings to the UI, no database schema changes are needed
 * because we store all settings in the JSONB 'settings' column.
 */
export const saveUserSettings = async (userId, settings) => {
  if (!userId) {
    console.error('Database: No userId provided to saveUserSettings');
    throw new Error('You must be logged in to save settings');
  }
  
  console.log(`Database: Attempting to save settings for user ${userId}`);
  
  try {
    // Get the current session to verify authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Database: Session verification error:', sessionError);
      throw new Error(`Authentication error: ${sessionError.message}`);
    }
    
    if (!session) {
      console.error('Database: No active session found');
      throw new Error('No active session. Please log in again');
    }
    
    if (session.user.id !== userId) {
      console.error('Database: Session user ID does not match requested user ID');
      throw new Error('Authentication mismatch. Please log in again');
    }
    
    const expiresAt = new Date(session.expires_at * 1000);
    const now = new Date();
    const timeUntilExpiry = expiresAt - now;
    
    console.log('Database: Session verified, token expires:', expiresAt.toISOString());
    console.log('Database: Time until token expiry:', Math.floor(timeUntilExpiry / 1000 / 60), 'minutes');
    
    if (timeUntilExpiry < 5 * 60 * 1000) { // Less than 5 minutes
      console.warn('Database: Auth token expires soon, may need to refresh');
    }
    
    // First check if this user already has settings
    const { data: existingSettings, error: getError } = await supabase
      .from('user_settings')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (getError) {
      console.error('Database: Error checking for existing settings:', getError);
      
      // Handle table not existing
      if (getError.code === 'PGRST301') {
        throw new Error('The user_settings table does not exist. Please run the SQL setup.');
      }
      
      // Handle other errors
      throw new Error(`Error checking settings: ${getError.message}`);
    }
    
    console.log('Database: Existing settings check result:', existingSettings);
    
    let result;
    
    // If settings exist, update them
    if (existingSettings) {
      console.log(`Database: Updating existing settings for user ${userId}`);
      
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .update({ settings, updated_at: new Date() })
          .eq('user_id', userId)
          .select();
        
        if (error) {
          console.error('Database: Error updating settings:', error);
          
          if (error.message && error.message.includes('Method Not Allowed')) {
            throw new Error('Error updating settings: Method Not Allowed. Check your RLS policies.');
          }
          
          throw new Error(`Error updating settings: ${error.message}`);
        }
        
        result = data;
        console.log('Database: Settings updated successfully:', data);
      } catch (updateError) {
        console.error('Database: Exception during update operation:', updateError);
        throw updateError;
      }
    } 
    // If no settings exist, insert new ones
    else {
      console.log(`Database: Creating new settings for user ${userId}`);
      
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .insert({
            user_id: userId,
            settings,
            created_at: new Date(),
            updated_at: new Date()
          })
          .select();
        
        if (error) {
          console.error('Database: Error inserting settings:', error);
          
          if (error.message && error.message.includes('Method Not Allowed')) {
            throw new Error('Error inserting settings: Method Not Allowed. Check your RLS policies.');
          }
          
          if (error.code === 'PGRST301') {
            throw new Error('The user_settings table does not exist. Please run the SQL setup.');
          }
          
          throw new Error(`Error inserting settings: ${error.message}`);
        }
        
        result = data;
        console.log('Database: Settings inserted successfully:', data);
      } catch (insertError) {
        console.error('Database: Exception during insert operation:', insertError);
        throw insertError;
      }
    }
    
    return result;
  } catch (error) {
    console.error('Database: Error in saveUserSettings:', error);
    
    // Provide more helpful error messages
    if (error.message.includes('network error')) {
      throw new Error('Network error. Please check your internet connection and try again.');
    }
    
    throw error;
  }
};

/**
 * Project operations
 */
export const getProjects = async (userId) => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
};

export const createProject = async (projectData) => {
  const { data, error } = await supabase
    .from('projects')
    .insert(projectData)
    .select();
  
  if (error) throw error;
  return data[0];
};

export const updateProject = async (projectId, updates) => {
  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', projectId)
    .select();
  
  if (error) throw error;
  return data[0];
};

export const deleteProject = async (projectId) => {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);
  
  if (error) throw error;
  return true;
};

/**
 * Task operations
 */
export const getTasks = async (userId, projectId = null) => {
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
    
    return {
      id: task.id,
      user_id: task.user_id,
      project_id: task.project_id,
      name: task.text, // Map text to name
      description: description, // Clean description
      status: status, // Use the determined status
      estimated_pomodoros: task.target_pomodoros || 0, // Map target_pomodoros to estimated_pomodoros
      completed_pomodoros: task.pomodoro_count || 0, // Map pomodoro_count to completed_pomodoros
      due_date: task.due_date,
      is_archived: task.is_archived || false,
      created_at: task.created_at,
      updated_at: task.updated_at
    };
  });
};

export const createTask = async (userId, taskData) => {
  console.log('DEBUGGING: database.js - createTask called with:', userId, taskData);
  
  if (!userId) {
    console.error('DEBUGGING: database.js - Cannot create task: No user ID provided');
    return null;
  }
  
  try {
    // Map expected fields to database column names - Use ONLY actual column names that exist in the database
    const dbTaskData = {
      user_id: userId,
      text: taskData.title || 'Untitled Task', // DB column is 'text' not 'name'
      notes: taskData.status === 'session' 
        ? `[SESSION_TASK] ${taskData.description || ''}`  // Mark session tasks
        : (taskData.description || ''),
      completed: taskData.status === 'completed',
      completed_at: taskData.status === 'completed' ? new Date().toISOString() : null,
      pomodoro_count: parseInt(taskData.pomodoros, 10) || 0, // DB column is 'pomodoro_count'
      target_pomodoros: parseInt(taskData.estimatedPomodoros, 10) || 1, // DB column is 'target_pomodoros'
      project_id: taskData.projectId || null
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
          text: dbTaskData.text,
          notes: dbTaskData.notes,
          status: 'error', // Special status to indicate this is an error
          error_message: 'Invalid API key - tasks cannot be saved to database',
          completed: dbTaskData.completed,
          completed_at: dbTaskData.completed_at,
          pomodoro_count: dbTaskData.pomodoro_count,
          target_pomodoros: dbTaskData.target_pomodoros,
          project_id: dbTaskData.project_id,
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
          text: dbTaskData.text,
          notes: dbTaskData.notes,
          status: taskData.status || 'todo',
          completed: dbTaskData.completed,
          completed_at: dbTaskData.completed_at,
          pomodoro_count: dbTaskData.pomodoro_count,
          target_pomodoros: dbTaskData.target_pomodoros,
          project_id: dbTaskData.project_id,
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
          text: dbTaskData.text,
          notes: dbTaskData.notes,
          status: 'error',
          error_message: 'Invalid API key - tasks cannot be saved to database',
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
        text: dbTaskData.text,
        notes: dbTaskData.notes,
        status: taskData.status || 'todo',
        estimated_pomodoros: dbTaskData.target_pomodoros,
        completed_pomodoros: dbTaskData.pomodoro_count,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
    
    console.log('DEBUGGING: database.js - Task created successfully:', data);
    
    // Format the response to match the expected structure in the application
    return {
      id: data.id,
      user_id: data.user_id,
      name: data.text, // Map text to name for app consumption
      text: data.text,
      description: data.notes && data.notes.startsWith('[SESSION_TASK]') 
        ? data.notes.replace('[SESSION_TASK] ', '') 
        : data.notes,
      status: data.completed ? 'completed' : 
             (data.notes && data.notes.startsWith('[SESSION_TASK]')) ? 'session' : 'todo',
      estimated_pomodoros: data.target_pomodoros || 1,
      completed_pomodoros: data.pomodoro_count || 0,
      project_id: data.project_id,
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  } catch (error) {
    console.error('DEBUGGING: database.js - Unexpected error creating task:', error);
    
    // Always return a valid object to prevent app crashes
    return {
      id: `exception-${Date.now()}`,
      user_id: userId,
      text: taskData.title || 'Untitled Task',
      status: taskData.status || 'todo',
      estimated_pomodoros: parseInt(taskData.estimatedPomodoros, 10) || 1,
      completed_pomodoros: parseInt(taskData.pomodoros, 10) || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }
};

export const updateTask = async (taskId, updates) => {
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
    const dbUpdates = {};
    
    if (updates.name !== undefined) dbUpdates.text = updates.name;
    if (updates.description !== undefined) dbUpdates.notes = updates.description;
    if (updates.status !== undefined) {
      dbUpdates.completed = updates.status === 'completed';
      if (updates.status === 'completed') {
        dbUpdates.completed_at = new Date().toISOString();
      } else {
        dbUpdates.completed_at = null;
      }
    }
    if (updates.estimated_pomodoros !== undefined) dbUpdates.target_pomodoros = updates.estimated_pomodoros;
    if (updates.completed_pomodoros !== undefined) dbUpdates.pomodoro_count = updates.completed_pomodoros;
    if (updates.is_archived !== undefined) dbUpdates.is_archived = updates.is_archived;
    if (updates.due_date !== undefined) dbUpdates.due_date = updates.due_date;
    
    dbUpdates.updated_at = new Date().toISOString();
    
    console.log('DEBUGGING: database.js - Updating task with data:', dbUpdates);
    
    // First check if the task exists
    const { data: existingTask, error: checkError } = await supabase
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
    return {
      id: task.id,
      user_id: task.user_id,
      project_id: task.project_id,
      name: task.text,
      description: task.notes,
      status: task.completed ? 'completed' : 'todo',
      estimated_pomodoros: task.target_pomodoros || 0,
      completed_pomodoros: task.pomodoro_count || 0,
      due_date: task.due_date,
      is_archived: task.is_archived || false,
      created_at: task.created_at,
      updated_at: task.updated_at
    };
  } catch (error) {
    console.error('DEBUGGING: database.js - Unexpected error updating task:', error);
    return null;
  }
};

export const deleteTask = async (taskId) => {
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
    const { data: existingTask, error: checkError } = await supabase
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

/**
 * Pomodoro session operations
 */
export const getPomodoroSessions = async (userId, limit = 20) => {
  const { data, error } = await supabase
    .from('pomodoro_sessions')
    .select('*, tasks(name, project_id), projects(name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data;
};

export const createPomodoroSession = async (sessionData) => {
  const { data, error } = await supabase
    .from('pomodoro_sessions')
    .insert(sessionData)
    .select();
  
  if (error) throw error;
  return data[0];
};

export const updatePomodoroSession = async (sessionId, updates) => {
  const { data, error } = await supabase
    .from('pomodoro_sessions')
    .update(updates)
    .eq('id', sessionId)
    .select();
  
  if (error) throw error;
  return data[0];
};

/**
 * Stats and reporting
 */
export const getDailyStats = async (userId, startDate, endDate) => {
  const { data, error } = await supabase
    .from('pomodoro_sessions')
    .select('duration, created_at, project_id, projects(name)')
    .eq('user_id', userId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);
  
  if (error) throw error;
  return data;
};

export const getTotalHours = async (userId) => {
  const { data, error } = await supabase
    .from('pomodoro_sessions')
    .select('duration')
    .eq('user_id', userId);
  
  if (error) throw error;
  
  // Calculate total hours
  const totalSeconds = data.reduce((sum, session) => sum + session.duration, 0);
  return totalSeconds / 3600; // Convert seconds to hours
}; 