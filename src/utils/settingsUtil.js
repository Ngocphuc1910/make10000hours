import { defaultSettings } from '../types/settings';

/**
 * Validates settings object to ensure all required fields are present and have valid values
 * @param {Object} settings - Settings object to validate
 * @returns {Object} - { isValid: boolean, errors: string[] }
 */
export const validateSettings = (settings) => {
  const errors = [];
  
  if (!settings) {
    return { isValid: false, errors: ['Settings object is required'] };
  }
  
  // Check required number fields
  ['pomodoroTime', 'shortBreakTime', 'longBreakTime'].forEach(field => {
    if (typeof settings[field] !== 'number') {
      errors.push(`${field} must be a number`);
    } else if (settings[field] <= 0) {
      errors.push(`${field} must be greater than 0`);
    }
  });
  
  // Check required boolean fields
  ['shortBreakEnabled', 'longBreakEnabled', 'autoStartSessions'].forEach(field => {
    if (typeof settings[field] !== 'boolean') {
      errors.push(`${field} must be a boolean`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Merges user settings with default settings to ensure all fields are present
 * @param {Object} userSettings - User's custom settings
 * @returns {Object} - Complete settings object with defaults for missing fields
 */
export const mergeWithDefaultSettings = (userSettings) => {
  if (!userSettings) return { ...defaultSettings };
  
  return {
    ...defaultSettings,
    ...userSettings
  };
};

/**
 * Generates SQL to create or update user settings directly in the database
 * This can be copied and pasted into the Supabase SQL Editor
 * @param {string} userId - User ID to update settings for
 * @param {Object} settings - Settings object to save
 * @returns {string} - SQL script that can be run in Supabase SQL Editor
 */
export const generateSettingsSql = (userId, settings) => {
  if (!userId) {
    return '-- Error: User ID is required';
  }
  
  const { isValid, errors } = validateSettings(settings);
  if (!isValid) {
    return `-- Error: Invalid settings\n-- ${errors.join('\n-- ')}`;
  }
  
  const settingsJson = JSON.stringify(settings, null, 2)
    .replace(/"/g, '\\"')  // Escape quotes for SQL
    .replace(/\n/g, '\n  '); // Indent JSON for readability
  
  return `-- SQL script to update settings for user: ${userId}
-- Run this in the Supabase SQL Editor
-- Uses admin rights to bypass RLS policies

-- Check if user exists
DO $$
DECLARE
  user_exists boolean;
  settings_exists boolean;
BEGIN
  -- Check if user exists in auth.users
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = '${userId}')
  INTO user_exists;
  
  IF NOT user_exists THEN
    RAISE EXCEPTION 'User with ID % does not exist', '${userId}';
  END IF;
  
  -- Check if user settings table exists
  SELECT EXISTS(
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'user_settings'
  ) INTO settings_exists;
  
  IF NOT settings_exists THEN
    -- Create user_settings table if it doesn't exist
    CREATE TABLE IF NOT EXISTS public.user_settings (
      id SERIAL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(user_id)
    );
    
    -- Create RLS policies for user_settings table
    ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
    
    -- Policy for users to read their own settings
    CREATE POLICY "Users can read their own settings" 
      ON public.user_settings
      FOR SELECT
      USING (auth.uid() = user_id);
    
    -- Policy for users to insert their own settings
    CREATE POLICY "Users can insert their own settings" 
      ON public.user_settings
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
    
    -- Policy for users to update their own settings
    CREATE POLICY "Users can update their own settings" 
      ON public.user_settings
      FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
  
  -- Upsert user settings
  INSERT INTO public.user_settings (user_id, settings, created_at, updated_at)
  VALUES (
    '${userId}',
    '"${settingsJson}"'::jsonb,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) 
  DO UPDATE SET
    settings = '"${settingsJson}"'::jsonb,
    updated_at = NOW();
    
  RAISE NOTICE 'Settings updated successfully for user %', '${userId}';
END $$;
`;
};

/**
 * Generates a test script to help debug database connection issues
 * @returns {string} - SQL script to test database permissions
 */
export const generateTestSql = () => {
  return `-- Test script to check database permissions
-- Run this in the Supabase SQL Editor

-- Check if user_settings table exists
SELECT EXISTS(
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'user_settings'
) AS table_exists;

-- Check RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM
  pg_policies
WHERE
  tablename = 'user_settings';

-- Check a few random users to see if they have settings
SELECT
  u.id,
  u.email,
  CASE WHEN s.id IS NULL THEN false ELSE true END AS has_settings
FROM
  auth.users u
LEFT JOIN
  public.user_settings s ON u.id = s.user_id
ORDER BY
  u.created_at DESC
LIMIT 5;
`;
}; 