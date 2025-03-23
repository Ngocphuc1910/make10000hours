import supabase from './supabase';

/**
 * User profile operations
 */
export const getUserProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) {
    // If profile doesn't exist yet, return null instead of throwing
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }
  return data;
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
  try {
    console.log("Database: Fetching settings for user:", userId);
    
    // Get default settings from localStorage or use system defaults
    const defaultSettings = JSON.parse(localStorage.getItem('timerSettings')) || {
      pomodoroTime: 25,
      shortBreakTime: 5,
      shortBreakEnabled: true,
      longBreakTime: 15,
      longBreakEnabled: true,
      autoStartSessions: false
    };
    
    // Exit early if no userId provided
    if (!userId) {
      console.log("Database: No userId provided to getUserSettings, returning defaults");
      return defaultSettings;
    }
    
    // Debug authentication status
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error("Database: Auth session error:", sessionError);
    } else if (!session) {
      console.warn("Database: No active session found when getting settings");
    } else {
      console.log("Database: Active session expires:", new Date(session.expires_at * 1000).toISOString());
    }
    
    const { data, error } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      console.error("Database: Error fetching user settings:", error);
      // If settings don't exist yet, return defaults instead of throwing
      if (error.code === 'PGRST116') {
        console.log("Database: No settings found for user (PGRST116), using defaults");
        return defaultSettings;
      }
      
      // Check if table doesn't exist
      if (error.code === 'PGRST301') {
        console.error("Database: Table 'user_settings' does not exist");
        throw new Error("Settings table does not exist. Please run the SQL setup.");
      }
      
      throw error;
    }
    
    // If we get null or undefined settings, return defaults
    if (!data || !data.settings) {
      console.log("Database: No settings found in response, using defaults");
      return defaultSettings;
    }
    
    // Diagnostic log of the settings we found
    console.log("Database: Raw settings from database:", data.settings);
    
    // Merge with defaults to ensure all fields are present
    const mergedSettings = {
      ...defaultSettings,
      ...data.settings
    };
    
    console.log("Database: Settings retrieved and merged with defaults:", mergedSettings);
    return mergedSettings;
  } catch (err) {
    console.error("Database: Unexpected error in getUserSettings:", err);
    
    // On error, try to get settings from localStorage instead of failing completely
    const fallbackSettings = JSON.parse(localStorage.getItem('timerSettings')) || {
      pomodoroTime: 25,
      shortBreakTime: 5,
      shortBreakEnabled: true,
      longBreakTime: 15,
      longBreakEnabled: true,
      autoStartSessions: false
    };
    
    console.log("Database: Falling back to localStorage settings due to error");
    return fallbackSettings;
  }
};

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
  return data;
};

export const createTask = async (taskData) => {
  const { data, error } = await supabase
    .from('tasks')
    .insert(taskData)
    .select();
  
  if (error) throw error;
  return data[0];
};

export const updateTask = async (taskId, updates) => {
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', taskId)
    .select();
  
  if (error) throw error;
  return data[0];
};

export const deleteTask = async (taskId) => {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);
  
  if (error) throw error;
  return true;
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