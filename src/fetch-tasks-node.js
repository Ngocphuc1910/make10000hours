// Script to fetch tasks for a specific user - Node.js version
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://ccxhdmyfmfwincvzqjhg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjeGhkbXlmbWZ3aW5jdnpxamhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIxNDAyMzIsImV4cCI6MjA1NzcxNjIzMn0.nf8fOFwXcFayteHi-HOhcxiHw4aLE7oOtWv8HeQAYjU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchTasksForUser(email) {
  console.log(`Fetching tasks for user: ${email}`);
  
  try {
    // First, let's authenticate with service role key to perform admin operations
    // NOT USED HERE - this requires a server-side operation with your admin key
    
    // Instead, let's try to find the user by querying the profiles table
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();
    
    if (profileError) {
      console.error('Error fetching profile:', profileError);
      
      // We'll need to use the auth API directly
      try {
        // First sign in as the user to get their session
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: email,
          password: 'YOUR_PASSWORD_HERE' // You should securely provide this
        });
        
        if (signInError) {
          console.error('Sign in error:', signInError);
          return { error: 'Authentication failed' };
        }
        
        const userId = signInData.user.id;
        console.log(`Signed in as user with ID: ${userId}`);
        
        // Now get their tasks
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        
        if (tasksError) {
          console.error('Error fetching tasks:', tasksError);
          return { error: tasksError };
        }
        
        console.log(`Found ${tasksData.length} tasks for user`);
        return { tasks: tasksData };
      } catch (authError) {
        console.error('Authentication error:', authError);
        return { error: 'Authentication failed' };
      }
    }
    
    // If we got the user ID, fetch their tasks
    const userId = profileData.id;
    console.log(`Found user ID from profile: ${userId}`);
    
    const { data: tasksData, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (tasksError) {
      console.error('Error fetching tasks:', tasksError);
      return { error: tasksError };
    }
    
    console.log(`Found ${tasksData.length} tasks for user`);
    return { tasks: tasksData };
    
  } catch (error) {
    console.error('Unexpected error:', error);
    return { error };
  }
}

// Execute the function
(async () => {
  const email = 'ngocphuc159tl@gmail.com';
  const result = await fetchTasksForUser(email);
  
  if (result.error) {
    console.error('Error:', result.error);
  } else {
    console.log('Tasks found:', result.tasks.length);
    console.log('Tasks:');
    result.tasks.forEach((task, index) => {
      console.log(`[${index + 1}] ${task.text} (Created: ${new Date(task.created_at).toLocaleString()})`);
      if (task.notes) console.log(`    Notes: ${task.notes}`);
      console.log(`    Status: ${task.completed ? 'Completed' : 'Not completed'}`);
      console.log(`    Pomodoros: ${task.pomodoro_count}/${task.target_pomodoros}`);
      console.log('');
    });
  }
})(); 