/**
 * Script to test task creation and retrieval after schema migration
 * 
 * Run with: node scripts/test_task_creation.js
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://ccxhdmyfmfwincvzqjhg.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjeGhkbXlmbWZ3aW5jdnpxamhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTg5MzA2NDAsImV4cCI6MjAxNDUwNjY0MH0.N8BzOUNKpYZkj5xj5vczxWlkuXmyaLQFvxcCpXC_Bbo';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// The user ID to test with
const TEST_USER_ID = 'b65e0de2-f2ae-4dd0-8911-fc202a6cd9fd'; // ngocphuc159tl@gmail.com

async function testTaskFunctionality() {
  try {
    console.log('Testing task creation and retrieval...');

    // Step 1: Sign in as the test user
    console.log('Signing in as test user...');
    // You would normally sign in with email/password here, but for this test
    // we'll continue with the anonymous key and rely on RLS policies
    
    // Step 2: Create a new task
    const newTask = {
      user_id: TEST_USER_ID,
      name: 'Test Task - Created after migration',
      description: 'This task was created to test the schema migration fix',
      status: 'todo',
      priority: 1,
      estimated_pomodoros: 3,
      completed_pomodoros: 0,
      position: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log('Creating new task...');
    const { data: createdTask, error: createError } = await supabase
      .from('tasks')
      .insert(newTask)
      .select();
    
    if (createError) {
      console.error('Error creating task:', createError);
      return;
    }
    
    console.log('Task created successfully:', createdTask);
    
    // Step 3: Retrieve all tasks for the user
    console.log('Retrieving all tasks for user...');
    const { data: userTasks, error: retrieveError } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', TEST_USER_ID);
    
    if (retrieveError) {
      console.error('Error retrieving tasks:', retrieveError);
      return;
    }
    
    console.log(`Retrieved ${userTasks.length} tasks for user:`);
    userTasks.forEach(task => {
      console.log(`- ${task.name} (${task.status}): ${task.description} (${task.completed_pomodoros}/${task.estimated_pomodoros} pomodoros)`);
    });
    
    // Step 4: Update a task to test status/completed sync
    console.log('Testing status/completed sync by marking task as completed...');
    const { data: updatedTask, error: updateError } = await supabase
      .from('tasks')
      .update({ status: 'completed' })
      .eq('id', createdTask[0].id)
      .select();
    
    if (updateError) {
      console.error('Error updating task:', updateError);
      return;
    }
    
    console.log('Task updated:', updatedTask);
    console.log('Checking if completed flag was automatically updated:', updatedTask[0].completed);
    
    console.log('Test completed successfully!');
  } catch (err) {
    console.error('Unexpected error during test:', err);
  }
}

testTaskFunctionality(); 