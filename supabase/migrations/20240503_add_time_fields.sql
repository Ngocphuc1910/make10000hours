-- Migration to add time tracking fields to the tasks table

-- Add timeSpent column (stored in hours as a float)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS timeSpent NUMERIC(8,2) DEFAULT 0;

-- Add timeEstimated column (stored in minutes as an integer)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS timeEstimated INTEGER DEFAULT 25;

-- Update existing tasks to have timeEstimated based on estimated_pomodoros if available
UPDATE tasks 
SET timeEstimated = estimated_pomodoros * 25
WHERE estimated_pomodoros > 0 AND (timeEstimated IS NULL OR timeEstimated = 0);

-- Log the migration
INSERT INTO public.schema_migrations (version, applied_at, description)
VALUES ('20240503_add_time_fields', NOW(), 'Add timeSpent and timeEstimated columns to tasks table'); 