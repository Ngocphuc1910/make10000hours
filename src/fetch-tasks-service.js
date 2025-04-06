// Script to fetch tasks using service role key
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key
const supabaseUrl = 'https://ccxhdmyfmfwincvzqjhg.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjeGhkbXlmbWZ3aW5jdnpxamhnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjE0MDIzMiwiZXhwIjoyMDU3NzE2MjMyfQ.GhWSw8WtSK9dNLS_LZgo8MuTrsEtsmtOGgObJ-wyiyk';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fetchTasks() {
  try {
    console.log('Fetching all users...');
    
    // Initialize users as empty array
    let users = [];
    
    try {
      // Try to get users via admin API
      const { data, error } = await supabase.auth.admin.listUsers();
      
      if (error) {
        console.error('Error listing users via admin API:', error);
      } else if (data && data.users) {
        users = data.users.map(u => ({ id: u.id, email: u.email }));
        console.log(`Found ${users.length} users via admin API`);
      }
    } catch (adminError) {
      console.error('Admin API error:', adminError);
      
      // Try alternate method - query profiles table if it exists
      try {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, email');
        
        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
        } else if (profilesData && profilesData.length > 0) {
          users = profilesData;
          console.log(`Found ${users.length} users via profiles table`);
        }
      } catch (profilesError) {
        console.error('Profiles query error:', profilesError);
      }
    }
    
    if (users.length === 0) {
      console.log('Could not find any users. Will use task user_ids without email mapping.');
    } else {
      console.log(`Found ${users.length} total users`);
    }
    
    // Fetch all tasks
    console.log('Fetching all tasks...');
    const { data: allTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (tasksError) {
      console.error('Error fetching tasks:', tasksError);
      return { error: tasksError };
    }
    
    console.log(`Found ${allTasks ? allTasks.length : 0} total tasks`);
    
    if (!allTasks || allTasks.length === 0) {
      return { tasksByUser: {} };
    }
    
    // Map user IDs to emails
    const userMap = {};
    users.forEach(user => {
      if (user && user.id && user.email) {
        userMap[user.id] = user.email;
      }
    });
    
    // Organize tasks by user
    const tasksByUser = {};
    
    // Also keep track of all unique user_ids in tasks
    const uniqueUserIds = new Set();
    
    allTasks.forEach(task => {
      if (!task.user_id) return;
      
      uniqueUserIds.add(task.user_id);
      const userEmail = userMap[task.user_id] || task.user_id;
      
      if (!tasksByUser[userEmail]) {
        tasksByUser[userEmail] = [];
      }
      
      tasksByUser[userEmail].push(task);
    });
    
    console.log(`Found tasks for ${uniqueUserIds.size} unique users`);
    
    return { tasksByUser, userMap, allTasks };
    
  } catch (error) {
    console.error('Unexpected error:', error);
    return { error };
  }
}

// Execute the function
(async () => {
  const result = await fetchTasks();
  
  if (result.error) {
    console.error('Error:', result.error);
  } else {
    const targetEmail = 'ngocphuc159tl@gmail.com';
    
    // Look for tasks by target email first
    let userTasks = result.tasksByUser[targetEmail] || [];
    
    // If no tasks found by email, look for user ID that may match this user
    if (userTasks.length === 0 && result.userMap) {
      // Check if any user mapped to this email
      const userId = Object.keys(result.userMap).find(
        uid => result.userMap[uid] === targetEmail
      );
      
      if (userId) {
        userTasks = result.tasksByUser[userId] || [];
      }
    }
    
    // If still no tasks, just show all tasks
    if (userTasks.length === 0 && result.allTasks) {
      console.log(`No tasks found for ${targetEmail}. Showing all ${result.allTasks.length} tasks instead.`);
      
      // Show first 10 tasks as a sample
      const sampleTasks = result.allTasks.slice(0, 10);
      sampleTasks.forEach((task, index) => {
        console.log(`[${index + 1}] ${task.text} (Created: ${new Date(task.created_at).toLocaleString()})`);
        console.log(`    User ID: ${task.user_id}`);
        if (task.notes) console.log(`    Notes: ${task.notes}`);
        console.log(`    Status: ${task.completed ? 'Completed' : 'Not completed'}`);
        console.log(`    Pomodoros: ${task.pomodoro_count}/${task.target_pomodoros}`);
        console.log('');
      });
    } else {
      console.log(`\nTasks for ${targetEmail}:`);
      if (userTasks.length === 0) {
        console.log('No tasks found for this user');
      } else {
        console.log(`Found ${userTasks.length} tasks:`);
        userTasks.forEach((task, index) => {
          console.log(`[${index + 1}] ${task.text} (Created: ${new Date(task.created_at).toLocaleString()})`);
          if (task.notes) console.log(`    Notes: ${task.notes}`);
          console.log(`    Status: ${task.completed ? 'Completed' : 'Not completed'}`);
          console.log(`    Pomodoros: ${task.pomodoro_count || 0}/${task.target_pomodoros || 0}`);
          console.log('');
        });
      }
    }
    
    // Also print a summary of all users and their task counts
    console.log('\nAll users with tasks:');
    Object.keys(result.tasksByUser).sort().forEach(userKey => {
      console.log(`${userKey}: ${result.tasksByUser[userKey].length} tasks`);
    });
  }
})(); 