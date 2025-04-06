/**
 * Script to add a test task to the database
 * 
 * Run with: node scripts/add_test_task.js
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://ccxhdmyfmfwincvzqjhg.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjeGhkbXlmbWZ3aW5jdnpxamhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTg5MzA2NDAsImV4cCI6MjAxNDUwNjY0MH0.N8BzOUNKpYZkj5xj5vczxWlkuXmyaLQFvxcCpXC_Bbo';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// The user ID to test with
const TEST_USER_ID = 'b65e0de2-f2ae-4dd0-8911-fc202a6cd9fd'; // ngocphuc159tl@gmail.com

async function addTestTask() {
  try {
    console.log('Adding test task...');

    // Create a new task using the existing database schema
    const newTask = {
      user_id: TEST_USER_ID,
      text: 'Test Task Created via Script',
      notes: 'This task was created to verify the database integration fixes',
      completed: false,
      completed_at: null,
      pomodoro_count: 0,
      target_pomodoros: 4,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('tasks')
      .insert(newTask)
      .select();
    
    if (error) {
      console.error('Error adding task:', error);
      return;
    }
    
    console.log('Task added successfully:', data);
    
    // List all tasks for the user
    await listTasks();
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

async function listTasks() {
  console.log('\nListing all tasks for user...');
  
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', TEST_USER_ID)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error listing tasks:', error);
    return;
  }
  
  console.log(`Found ${data.length} tasks for user:`);
  data.forEach((task, index) => {
    console.log(`\nTask ${index + 1}:`);
    console.log(`- ID: ${task.id}`);
    console.log(`- Name: ${task.text}`);
    console.log(`- Description: ${task.notes}`);
    console.log(`- Completed: ${task.completed}`);
    console.log(`- Pomodoros: ${task.pomodoro_count}/${task.target_pomodoros}`);
    console.log(`- Created: ${new Date(task.created_at).toLocaleString()}`);
  });
}

// Run the script
addTestTask(); 