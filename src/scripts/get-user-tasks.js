const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key:', supabaseAnonKey ? 'Available (masked)' : 'Not available');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const userEmail = 'ngocphuc159tl@gmail.com';

async function getUserTasks() {
  try {
    // First, get the user ID from the email
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', userEmail)
      .single();
    
    if (userError) {
      console.error('Error finding user:', userError.message);
      return;
    }
    
    if (!userData) {
      console.log(`No user found with email: ${userEmail}`);
      return;
    }
    
    const userId = userData.id;
    console.log(`Found user ID: ${userId}`);
    
    // Now get all tasks for this user
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (tasksError) {
      console.error('Error fetching tasks:', tasksError.message);
      return;
    }
    
    console.log(`Found ${tasks ? tasks.length : 0} tasks for user ${userEmail}:`);
    if (tasks && tasks.length > 0) {
      console.log(JSON.stringify(tasks, null, 2));
    } else {
      console.log('No tasks found.');
    }
    
    return tasks;
  } catch (error) {
    console.error('Unexpected error:', error.message);
  }
}

getUserTasks(); 