const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Use the same Supabase URL and key as the main app
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://ccxhdmyfmfwincvzqjhg.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('❌ Error: REACT_APP_SUPABASE_ANON_KEY environment variable is not set');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

async function runMigration() {
  console.log('🚀 Starting time fields verification and update');
  
  try {
    // Check if tasks table exists
    console.log('🔍 Checking if tasks table exists...');
    const { data: tasksCheck, error: tasksCheckError } = await supabase
      .from('tasks')
      .select('id')
      .limit(1);
    
    if (tasksCheckError) {
      console.error('❌ Error checking tasks table:', tasksCheckError.message);
      return false;
    }
    
    console.log('✅ Tasks table exists and is accessible');
    
    // Verify and update columns one by one
    // We can't perform schema changes with the JS client, but we can check if the columns exist
    
    console.log('🔍 Checking timeSpent column...');
    try {
      const { data: timeSpentCheck, error: timeSpentError } = await supabase
        .from('tasks')
        .select('timeSpent')
        .limit(1);
      
      if (timeSpentError) {
        console.error('❌ Error: timeSpent column does not exist or is not accessible');
        console.error('   Error details:', timeSpentError.message);
      } else {
        console.log('✅ timeSpent column exists and is accessible');
      }
    } catch (err) {
      console.error('❌ Error checking timeSpent column:', err.message);
    }
    
    console.log('🔍 Checking timeEstimated column...');
    try {
      const { data: timeEstimatedCheck, error: timeEstimatedError } = await supabase
        .from('tasks')
        .select('timeEstimated')
        .limit(1);
      
      if (timeEstimatedError) {
        console.error('❌ Error: timeEstimated column does not exist or is not accessible');
        console.error('   Error details:', timeEstimatedError.message);
      } else {
        console.log('✅ timeEstimated column exists and is accessible');
      }
    } catch (err) {
      console.error('❌ Error checking timeEstimated column:', err.message);
    }
    
    // Check database schema to confirm column names
    console.log('🔍 Checking task column names...');
    const { data: columnTest, error: columnError } = await supabase
      .from('tasks')
      .select('*')
      .limit(1);
    
    if (columnError) {
      console.error('❌ Error testing table columns:', columnError.message);
    } else if (columnTest && columnTest.length > 0) {
      console.log('✅ Task column structure:');
      const columnNames = Object.keys(columnTest[0]);
      console.log(columnNames);
      
      // Check specifically for pomodoro-related columns
      const hasTargetPomodoros = columnNames.includes('target_pomodoros');
      const hasPomodoroCount = columnNames.includes('pomodoro_count');
      console.log(`Target pomodoros column: ${hasTargetPomodoros ? 'target_pomodoros ✅' : 'missing ❌'}`);
      console.log(`Pomodoro count column: ${hasPomodoroCount ? 'pomodoro_count ✅' : 'missing ❌'}`);
    }
    
    // Try to get all tasks with target_pomodoros > 0 and update their timeEstimated
    console.log('🔄 Retrieving tasks with target_pomodoros...');
    const { data: pomodoro_tasks, error: fetchError } = await supabase
      .from('tasks')
      .select('id, target_pomodoros, timeEstimated')
      .gt('target_pomodoros', 0)
      .is('timeEstimated', null)
      .limit(100);
    
    if (fetchError) {
      console.error('❌ Error fetching tasks with target_pomodoros:', fetchError.message);
    } else if (pomodoro_tasks && pomodoro_tasks.length > 0) {
      console.log(`✅ Found ${pomodoro_tasks.length} tasks that need timeEstimated updates`);
      
      // Update each task individually
      console.log('🔄 Updating tasks timeEstimated based on target_pomodoros...');
      let successCount = 0;
      
      for (const task of pomodoro_tasks) {
        const timeEstimated = task.target_pomodoros * 25;
        const { error: updateError } = await supabase
          .from('tasks')
          .update({ timeEstimated })
          .eq('id', task.id);
        
        if (updateError) {
          console.error(`❌ Error updating task ${task.id}:`, updateError.message);
        } else {
          successCount++;
          console.log(`✅ Updated task ${task.id}: ${task.target_pomodoros} pomodoros → ${timeEstimated} minutes`);
        }
      }
      
      console.log(`🎉 Successfully updated ${successCount} out of ${pomodoro_tasks.length} tasks`);
    } else {
      console.log('✅ No tasks found that need timeEstimated updates');
    }
    
    // Also fix any tasks that have null timeSpent but should have 0
    console.log('🔍 Checking for tasks with missing timeSpent...');
    const { data: missing_timeSpent, error: timeSpentFetchError } = await supabase
      .from('tasks')
      .select('id, timeSpent')
      .is('timeSpent', null)
      .limit(100);
    
    if (timeSpentFetchError) {
      console.error('❌ Error fetching tasks with missing timeSpent:', timeSpentFetchError.message);
    } else if (missing_timeSpent && missing_timeSpent.length > 0) {
      console.log(`✅ Found ${missing_timeSpent.length} tasks that need timeSpent updates`);
      
      // Update each task individually
      console.log('🔄 Setting default timeSpent value (0) for tasks...');
      let timeSpentSuccessCount = 0;
      
      for (const task of missing_timeSpent) {
        const { error: updateError } = await supabase
          .from('tasks')
          .update({ timeSpent: 0 })
          .eq('id', task.id);
        
        if (updateError) {
          console.error(`❌ Error updating timeSpent for task ${task.id}:`, updateError.message);
        } else {
          timeSpentSuccessCount++;
          console.log(`✅ Updated timeSpent for task ${task.id} to 0 hours`);
        }
      }
      
      console.log(`🎉 Successfully updated timeSpent for ${timeSpentSuccessCount} out of ${missing_timeSpent.length} tasks`);
    } else {
      console.log('✅ No tasks found that need timeSpent updates');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}

// Run the migration
runMigration()
  .then(success => {
    if (success) {
      console.log('🎉 Migration verification process completed successfully');
      console.log('Manual steps to ensure schema is correct:');
      console.log('1. Log in to Supabase dashboard at https://app.supabase.com');
      console.log('2. Go to the Table Editor and verify that tasks table has:');
      console.log('   - timeSpent column (NUMERIC type)');
      console.log('   - timeEstimated column (INTEGER type)');
      console.log('3. If these columns are missing, go to SQL Editor and run:');
      console.log(`
-- Add timeSpent column (stored in hours as a float)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "timeSpent" NUMERIC(8,2) DEFAULT 0;

-- Add timeEstimated column (stored in minutes as an integer)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "timeEstimated" INTEGER DEFAULT 25;

-- Update existing tasks to have timeEstimated based on target_pomodoros if available
UPDATE tasks 
SET "timeEstimated" = target_pomodoros * 25
WHERE target_pomodoros > 0 AND ("timeEstimated" IS NULL OR "timeEstimated" = 0);
      `);
    } else {
      console.log('⚠️ Migration verification process completed with errors');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('❌ Fatal error in migration process:', err);
    process.exit(1);
  }); 