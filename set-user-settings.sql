-- SQL script to update user settings for a specific user
-- Run this in your Supabase SQL Editor

-- Check if user exists first
DO $$
DECLARE
  user_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM auth.users 
    WHERE id = 'b65e0de2-f2ae-4dd0-8911-fc202a6cd9fd'
  ) INTO user_exists;
  
  IF NOT user_exists THEN
    RAISE EXCEPTION 'User with ID b65e0de2-f2ae-4dd0-8911-fc202a6cd9fd does not exist';
  END IF;
END $$;

-- Now check if settings exist for this user
DO $$
DECLARE
  settings_exist BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM user_settings
    WHERE user_id = 'b65e0de2-f2ae-4dd0-8911-fc202a6cd9fd'
  ) INTO settings_exist;
  
  -- Insert or update settings based on whether they exist
  IF settings_exist THEN
    -- Update existing settings
    UPDATE user_settings
    SET 
      settings = '{"pomodoroTime": 100, "shortBreakTime": 9, "shortBreakEnabled": true, "longBreakTime": 19, "longBreakEnabled": false, "autoStartSessions": true}'::jsonb,
      updated_at = NOW()
    WHERE user_id = 'b65e0de2-f2ae-4dd0-8911-fc202a6cd9fd';
    
    RAISE NOTICE 'Updated existing settings for user b65e0de2-f2ae-4dd0-8911-fc202a6cd9fd';
  ELSE
    -- Insert new settings
    INSERT INTO user_settings (user_id, settings, created_at, updated_at)
    VALUES (
      'b65e0de2-f2ae-4dd0-8911-fc202a6cd9fd',
      '{"pomodoroTime": 100, "shortBreakTime": 9, "shortBreakEnabled": true, "longBreakTime": 19, "longBreakEnabled": false, "autoStartSessions": true}'::jsonb,
      NOW(),
      NOW()
    );
    
    RAISE NOTICE 'Inserted new settings for user b65e0de2-f2ae-4dd0-8911-fc202a6cd9fd';
  END IF;
END $$;

-- Verify the settings were saved correctly
SELECT * FROM user_settings
WHERE user_id = 'b65e0de2-f2ae-4dd0-8911-fc202a6cd9fd'; 