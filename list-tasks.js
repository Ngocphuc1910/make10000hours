require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Get Supabase URL and key from environment or use default test values
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://ccxhdmyfmfwincvzqjhg.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjeGhkbXlmbWZ3aW5jdnpxamhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODUzNjE0ODUsImV4cCI6MjAwMDkzNzQ4NX0.i1rDcQOGOm4r6u4qdOSECzOOJntZLl_iAapHRxP6RNw';

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key available:', !!supabaseKey);

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

const userEmail = 'ngocphuc159tl@gmail.com';

async function listAllUsers() {
  try {
    const { data: users, error } = await supabase
      .from('profiles')
      .select('*');
    
    if (error) {
      console.error('Error fetching users:', error.message);
      return;
    }
    
    console.log(`Found ${users.length} users:`);
    users.forEach(user => {
      console.log(`- ${user.id}: ${user.email || 'No email'}`);
    });
    
    return users;
  } catch (error) {
    console.error('Unexpected error:', error.message);
  }
}

async function listAllTasks() {
  try {
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching tasks:', error.message);
      return;
    }
    
    console.log(`Found ${tasks.length} tasks in total:`);
    tasks.forEach(task => {
      console.log(`- ${task.id}: ${task.name} (user: ${task.user_id})`);
    });
    
    return tasks;
  } catch (error) {
    console.error('Unexpected error:', error.message);
  }
}

async function getUserTasks(email) {
  try {
    // First find the user with this email
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', email)
      .maybeSingle();
    
    if (userError) {
      console.error('Error finding user:', userError.message);
      return;
    }
    
    if (!userData) {
      console.log(`No user found with email: ${email}`);
      
      // Show all users instead
      await listAllUsers();
      
      return;
    }
    
    console.log(`Found user: ${userData.id} (${userData.email})`);
    
    // Now get tasks for this user
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userData.id)
      .order('created_at', { ascending: false });
    
    if (tasksError) {
      console.error('Error fetching tasks:', tasksError.message);
      return;
    }
    
    console.log(`Found ${tasks.length} tasks for user ${email}:`);
    if (tasks.length === 0) {
      console.log('No tasks found. Listing all tasks instead:');
      await listAllTasks();
      return [];
    }
    
    console.log(JSON.stringify(tasks, null, 2));
    return tasks;
  } catch (error) {
    console.error('Unexpected error:', error.message);
  }
}

// Execute
getUserTasks(userEmail); 