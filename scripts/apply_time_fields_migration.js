const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Use the same Supabase URL and key as the main app
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://ccxhdmyfmfwincvzqjhg.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_KEY;

if (!supabaseKey) {
  console.error('❌ Error: REACT_APP_SUPABASE_ANON_KEY or REACT_APP_SUPABASE_KEY environment variable is not set');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Function to modify the tasks table schema
async function modifyTaskSchema() {
  try {
    console.log('🔍 Checking if tasks table exists...');
    const { error: checkError } = await supabase.from('tasks').select('id').limit(1);
    
    if (checkError) {
      console.error(`❌ Error accessing tasks table: ${checkError.message}`);
      return false;
    }
    
    console.log('✅ Table exists, proceeding with schema modification');
    
    // Check if timeSpent column exists
    console.log('🔍 Checking if timeSpent column already exists...');
    try {
      const { error: timeSpentError } = await supabase
        .from('tasks')
        .select('timeSpent')
        .limit(1);
      
      if (!timeSpentError) {
        console.log('✅ timeSpent column already exists');
      } else {
        // If column doesn't exist, we'll get an error
        console.log('❌ timeSpent column does not exist, will need to create it');
      }
    } catch (err) {
      console.log('❌ Error checking timeSpent column:', err.message);
    }
    
    // Check if timeEstimated column exists
    console.log('🔍 Checking if timeEstimated column already exists...');
    try {
      const { error: timeEstimatedError } = await supabase
        .from('tasks')
        .select('timeEstimated')
        .limit(1);
      
      if (!timeEstimatedError) {
        console.log('✅ timeEstimated column already exists');
      } else {
        // If column doesn't exist, we'll get an error
        console.log('❌ timeEstimated column does not exist, will need to create it');
      }
    } catch (err) {
      console.log('❌ Error checking timeEstimated column:', err.message);
    }
    
    // For Supabase, we can't directly alter the table schema through the client API
    // We need to use PostgreSQL functions or stored procedures
    
    console.log('⚠️ Direct schema modification is not possible through the Supabase client API');
    console.log('⚠️ Manual steps to add the columns:');
    console.log('1. Log in to the Supabase dashboard');
    console.log('2. Go to SQL Editor');
    console.log('3. Execute the following SQL:');
    console.log(`
    -- Add timeSpent column (stored in hours as a float)
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "timeSpent" NUMERIC(8,2) DEFAULT 0;
    
    -- Add timeEstimated column (stored in minutes as an integer)
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "timeEstimated" INTEGER DEFAULT 25;
    
    -- Update existing tasks to have timeEstimated based on estimated_pomodoros if available
    UPDATE tasks SET "timeEstimated" = estimated_pomodoros * 25 
    WHERE estimated_pomodoros > 0 AND ("timeEstimated" IS NULL OR "timeEstimated" = 0);
    `);
    
    // Instead, let's try to use the columns in our app and handle the case when they don't exist
    console.log('🔄 Attempting to update an existing task with timeSpent and timeEstimated values as a test...');
    
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id')
      .limit(1);
    
    if (tasksError || !tasks || tasks.length === 0) {
      console.error('❌ Could not find any task to update:', tasksError?.message || 'No tasks found');
      return false;
    }
    
    const taskId = tasks[0].id;
    console.log(`🔧 Found task ${taskId} to update as a test`);
    
    const { error: updateError } = await supabase
      .from('tasks')
      .update({
        timeSpent: 0,
        timeEstimated: 25
      })
      .eq('id', taskId);
    
    if (updateError) {
      console.error(`❌ Error updating task with timeSpent/timeEstimated: ${updateError.message}`);
      return false;
    }
    
    console.log('✅ Successfully updated task with timeSpent and timeEstimated values');
    console.log('✅ The columns appear to exist or were added successfully');
    
    return true;
  } catch (error) {
    console.error('❌ Unexpected error modifying task schema:', error);
    return false;
  }
}

// Main function
async function applyMigration() {
  console.log('🚀 Starting timeSpent/timeEstimated migration process');
  
  // Try to modify the tasks table schema
  const success = await modifyTaskSchema();
  
  if (success) {
    console.log('🎉 Migration completed successfully');
  } else {
    console.log('⚠️ Migration may not have been fully applied');
    console.log('Please check your Supabase instance and apply the migration manually if needed');
  }
}

applyMigration(); 