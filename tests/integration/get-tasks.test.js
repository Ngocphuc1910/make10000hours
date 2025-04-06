// Test script to verify getTasks handles session tasks correctly
const { createClient } = require('@supabase/supabase-js');
const { getTasks } = require('../src/lib/database');

// Create Supabase client with the service role key
const supabaseUrl = 'https://ccxhdmyfmfwincvzqjhg.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjeGhkbXlmbWZ3aW5jdnpxamhnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjE0MDIzMiwiZXhwIjoyMDU3NzE2MjMyfQ.GhWSw8WtSK9dNLS_LZgo8MuTrsEtsmtOGgObJ-wyiyk';
const supabase = createClient(supabaseUrl, serviceRoleKey);

// Test function for getTasks
async function testGetTasks() {
  try {
    // Get a user ID from the existing task
    const { data: existingTask, error: taskError } = await supabase
      .from('tasks')
      .select('user_id')
      .limit(1)
      .single();
    
    if (taskError || !existingTask) {
      console.error('Error getting existing task or no tasks found:', taskError);
      return;
    }
    
    const userId = existingTask.user_id;
    console.log('Using existing user ID:', userId);
    
    // Use the getTasks function to retrieve tasks
    const tasks = await getTasks(userId);
    console.log(`Retrieved ${tasks.length} tasks for user ${userId}`);
    
    // Check which tasks are identified as session tasks
    const sessionTasks = tasks.filter(task => task.status === 'session');
    console.log(`Found ${sessionTasks.length} session tasks:`);
    
    sessionTasks.forEach(task => {
      console.log(`- Task ID: ${task.id}, Name: ${task.name}, Status: ${task.status}`);
      // Check if the description has been properly cleaned (no [SESSION_TASK] prefix)
      console.log(`  Description: ${task.description}`);
      console.log(`  Original notes in DB has [SESSION_TASK] prefix: ${task.original_notes ? task.original_notes.startsWith('[SESSION_TASK]') : 'N/A'}`);
    });
    
    // Also check regular tasks
    const regularTasks = tasks.filter(task => task.status !== 'session');
    console.log(`\nFound ${regularTasks.length} regular tasks:`);
    console.log(regularTasks.map(t => `- ${t.name} (${t.status})`).join('\n'));
    
  } catch (err) {
    console.error('Error testing getTasks:', err);
  }
}

// Override the supabase import in database.js with our instance
global.supabaseOverride = supabase;

// Run the test
testGetTasks(); 