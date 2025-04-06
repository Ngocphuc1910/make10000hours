-- Update tasks table to match the intended schema
BEGIN;

-- First, rename columns to match the intended schema
ALTER TABLE tasks RENAME COLUMN text TO name;
ALTER TABLE tasks RENAME COLUMN notes TO description;
ALTER TABLE tasks RENAME COLUMN pomodoro_count TO completed_pomodoros;
ALTER TABLE tasks RENAME COLUMN target_pomodoros TO estimated_pomodoros;

-- Add the missing columns
ALTER TABLE tasks ADD COLUMN status TEXT DEFAULT 'todo';
ALTER TABLE tasks ADD COLUMN priority INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN position INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN due_date TIMESTAMP WITH TIME ZONE;

-- Update status based on completed field
UPDATE tasks SET status = 'completed' WHERE completed = TRUE;
UPDATE tasks SET status = 'todo' WHERE completed = FALSE;

-- Create a trigger to keep status and completed in sync
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

-- Add sample task if none exists
INSERT INTO tasks (
  user_id,
  name,
  description,
  status,
  estimated_pomodoros,
  completed_pomodoros,
  created_at,
  updated_at
)
SELECT
  'b65e0de2-f2ae-4dd0-8911-fc202a6cd9fd',
  'Example Task - Created During Schema Update',
  'This is an example task created during the schema update process.',
  'todo',
  3,
  0,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM tasks LIMIT 1
);

COMMIT; 