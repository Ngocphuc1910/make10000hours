// Script to fetch tasks for a specific user
import supabase from './lib/supabase';

async function fetchTasksForUser(email) {
  console.log(`Fetching tasks for user: ${email}`);
  
  try {
    // First get the user ID from the email
    const { data: userData, error: userError } = await supabase
      .from('auth.users')
      .select('id')
      .eq('email', email)
      .single();
    
    if (userError) {
      console.error('Error fetching user ID:', userError);
      
      // Try alternative method to get user ID
      const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) {
        console.error('Error listing users:', authError);
        return { error: 'Could not find user ID' };
      }
      
      const user = authData.users.find(u => u.email === email);
      if (!user) {
        console.error('User not found');
        return { error: 'User not found' };
      }
      
      // Use the found user ID to get tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (tasksError) {
        console.error('Error fetching tasks:', tasksError);
        return { error: tasksError };
      }
      
      console.log(`Found ${tasksData.length} tasks for user`);
      return { tasks: tasksData };
    }
    
    // If we got the user ID, fetch their tasks
    const userId = userData.id;
    console.log(`Found user ID: ${userId}`);
    
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
    console.log('Tasks:', JSON.stringify(result.tasks, null, 2));
  }
})(); 