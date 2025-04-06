-- Migration to align the tasks table with the codebase expectations
-- This addresses the discrepancy between the database schema and the application code

-- First, rename existing columns to match expected structure
ALTER TABLE tasks RENAME COLUMN text TO name;
ALTER TABLE tasks RENAME COLUMN notes TO description;
ALTER TABLE tasks RENAME COLUMN pomodoro_count TO completed_pomodoros;
ALTER TABLE tasks RENAME COLUMN target_pomodoros TO estimated_pomodoros;

-- Add missing columns
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'todo';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE;

-- Update status field based on completed flag
UPDATE tasks SET status = 'completed' WHERE completed = TRUE;
UPDATE tasks SET status = 'todo' WHERE completed = FALSE;

-- We'll keep the completed column for now for backward compatibility,
-- but we'll ensure they stay in sync with a trigger

-- Create a trigger to keep status and completed fields in sync
CREATE OR REPLACE FUNCTION sync_task_status_and_completed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.completed = FALSE THEN
    NEW.completed := TRUE;
    NEW.completed_at := CURRENT_TIMESTAMP;
  ELSIF NEW.status = 'todo' AND NEW.completed = TRUE THEN
    NEW.completed := FALSE;
    NEW.completed_at := NULL;
  ELSIF NEW.completed = TRUE AND NEW.status != 'completed' THEN
    NEW.status := 'completed';
    IF NEW.completed_at IS NULL THEN
      NEW.completed_at := CURRENT_TIMESTAMP;
    END IF;
  ELSIF NEW.completed = FALSE AND NEW.status = 'completed' THEN
    NEW.status := 'todo';
    NEW.completed_at := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_status_completed_sync
BEFORE INSERT OR UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION sync_task_status_and_completed();

-- Log the migration
INSERT INTO public.schema_migrations (version, applied_at, description)
VALUES ('20240406_fix_tasks_schema', NOW(), 'Align tasks table schema with codebase expectations'); 