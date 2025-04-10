# Task Schema Migration

This document explains the process of aligning the tasks table database schema with the application code expectations.

## Background

There was a mismatch between the database schema and the code:

- The application code expected columns like `name`, `description`, `status`, `estimated_pomodoros`, etc.
- The actual database had columns like `text`, `notes`, `completed`, `pomodoro_count`, etc.

This mismatch caused issues with task creation and retrieval.

## Files Created
## Files Create

1. **Migration SQL** - `supabase/migrations/20240406_fix_tasks_schema.sql`
   - Renames existing columns to match code expectations
   - Adds missing columns
   - Creates a trigger to keep `status` and `completed` fields in sync

2. **Migration Script** - `scripts/run_task_schema_migration.js`
   - Applies the migration to the database
   - Verifies the changes were successful

3. **Testing Script** - `scripts/test_task_creation.js`
   - Tests creating and retrieving tasks after the migration
   - Validates that the schema changes work with the application code

4. **Schema Check Script** - `scripts/check_tasks_schema.js`
   - Displays the current schema of the tasks table
   - Validates that all required columns are present

## How to Run the Migration

1. Set environment variables:
   ```
   export REACT_APP_SUPABASE_URL=your_supabase_url
   export REACT_APP_SUPABASE_ANON_KEY=your_anon_key
   export SUPABASE_SERVICE_KEY=your_service_key
   ```

2. Run the migration:
   ```
   node scripts/run_task_schema_migration.js
   ```

3. Check the schema:
   ```
   node scripts/check_tasks_schema.js
   ```

4. Test task creation:
   ```
   node scripts/test_task_creation.js
   ```

## Validation

After running the migration, you should be able to:

1. Create new tasks in the application UI
2. See the tasks listed correctly
3. Update and complete tasks
4. Query tasks by user in the database

When you query `"give me a list of tasks created by user X"`, the system should be able to correctly retrieve all tasks with detailed information.

## Trigger Explanation

The migration creates a trigger to keep the `status` and `completed` fields in sync:

- When `status` is set to 'completed', `completed` is automatically set to TRUE
- When `status` is set to 'todo', `completed` is automatically set to FALSE
- When `completed` is set to TRUE, `status` is automatically set to 'completed'
- When `completed` is set to FALSE, `status` is automatically set to 'todo'

This ensures backward compatibility with any code that still uses the `completed` field.

## Column Mapping

| Original Column     | New Column Name      |
|---------------------|----------------------|
| text                | name                 |
| notes               | description          |
| pomodoro_count      | completed_pomodoros  |
| target_pomodoros    | estimated_pomodoros  |
| completed (boolean) | status (text)        |

The `completed` field is kept for backward compatibility but will stay in sync with the new `status` field. 