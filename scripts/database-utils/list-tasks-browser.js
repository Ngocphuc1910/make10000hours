// This script can be pasted into the browser console when logged in
// It will fetch tasks for the current logged-in user

(async () => {
  try {
    console.log('Fetching tasks for the current user...');
    
    // Check if Supabase is available from the app
    if (!window.supabase) {
      console.error('Error: Supabase client not found in the window object.');
      console.log('Make sure you are logged in and the app is fully loaded.');
      return;
    }
    
    // Get the current user session
    const { data: { session }, error: sessionError } = await window.supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Error getting session:', sessionError.message);
      return;
    }
    
    if (!session || !session.user) {
      console.error('No active session found. Please log in first.');
      return;
    }
    
    const userId = session.user.id;
    const userEmail = session.user.email;
    
    console.log(`Logged in as: ${userEmail} (ID: ${userId})`);
    
    // Fetch tasks for this user from the database
    const { data: tasks, error: tasksError } = await window.supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (tasksError) {
      console.error('Error fetching tasks:', tasksError.message);
      return;
    }
    
    console.log(`Found ${tasks.length} tasks for user ${userEmail}:`);
    
    if (tasks.length === 0) {
      console.log('No tasks found for this user.');
      return;
    }
    
    // Print tasks in a structured format
    console.table(tasks.map(task => ({
      ID: task.id,
      Name: task.name,
      Description: task.description || 'None',
      Status: task.status,
      Priority: task.priority,
      'Est. Pomodoros': task.estimated_pomodoros,
      'Completed Pomodoros': task.completed_pomodoros,
      'Created At': new Date(task.created_at).toLocaleString(),
      'Updated At': new Date(task.updated_at).toLocaleString()
    })));
    
    // Also check session tasks
    if (window.sessionTasks) {
      console.log(`Found ${window.sessionTasks.length} session tasks:`);
      console.table(window.sessionTasks);
    }
    
    // Additional check for tasks in global state
    if (window.store && window.store.getState && window.store.getState().tasks) {
      const stateTasks = window.store.getState().tasks;
      console.log(`Found ${stateTasks.length} tasks in global state:`);
      console.table(stateTasks);
    }

    // Return the tasks in case the user wants to do something with them
    return tasks;
    
  } catch (error) {
    console.error('Unexpected error:', error.message);
  }
})(); 