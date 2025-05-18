import { UserSetting } from '../models/setting';
import supabase from './supabase';

/**
 * User settings operations
 */
export const getUserSettings = async (userId: string): Promise<UserSetting | null> => {
  if (!supabase) return null;
  
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
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    const now = new Date().getTime();

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
function getDefaultSettings(): UserSetting {
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
function getFallbackSettings(): UserSetting {
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
function mergeWithDefaults(userSetting: UserSetting): UserSetting {
  const defaults = getDefaultSettings();
  
  // Type conversion to ensure correct types
  const merged = {
    ...defaults,
    ...userSetting,
    // Ensure number types
    pomodoroTime: Number(userSetting.pomodoroTime) || defaults.pomodoroTime,
    shortBreakTime: Number(userSetting.shortBreakTime) || defaults.shortBreakTime,
    longBreakTime: Number(userSetting.longBreakTime) || defaults.longBreakTime,
    longBreakInterval: Number(userSetting.longBreakInterval) || defaults.longBreakInterval,
    // Ensure boolean types
    shortBreakEnabled: userSetting.shortBreakEnabled !== undefined ? !!userSetting.shortBreakEnabled : defaults.shortBreakEnabled,
    longBreakEnabled: userSetting.longBreakEnabled !== undefined ? !!userSetting.longBreakEnabled : defaults.longBreakEnabled,
    autoStartSessions: userSetting.autoStartSessions !== undefined ? !!userSetting.autoStartSessions : defaults.autoStartSessions,
    soundEnabled: userSetting.soundEnabled !== undefined ? !!userSetting.soundEnabled : defaults.soundEnabled,
    // Handle volume specially (must be between 0 and 1)
    volume: userSetting.volume !== undefined ? Math.min(Math.max(Number(userSetting.volume), 0), 1) : defaults.volume
  };
  
  console.log('Database: Merged settings with defaults:', merged);
  return merged;
}

/**
 * Saves user settings to the database
 * 
 * NOTE: When adding new settings to the UI, no database schema changes are needed
 * because we store all settings in the JSONB 'settings' column.
 */
export const saveUserSettings = async (userId: string, setting: UserSetting) => {
  if (!supabase) return null;
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
    
    const expiresAt = new Date(session.expires_at ? session.expires_at * 1000 : 0);
    const now = new Date();
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();
    
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
          .update({ setting: JSON.stringify(setting), updated_at: new Date() })
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
            setting: JSON.stringify(setting),
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
  } catch (error: any) {
    console.error('Database: Error in saveUserSettings:', error);
    
    // Provide more helpful error messages
    if (error.message.includes('network error')) {
      throw new Error('Network error. Please check your internet connection and try again.');
    }
    
    throw error;
  }
};