// Direct test script using CommonJS
const { createClient } = require('@supabase/supabase-js');

// Create Supabase client with the provided credentials
const supabaseUrl = 'https://ccxhdmyfmfwincvzqjhg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjeGhkbXlmbWZ3aW5jdnpxamhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIxNDAyMzIsImV4cCI6MjA1NzcxNjIzMn0.nf8fOFwXcFayteHi-HOhcxiHw4aLE7oOtWv8HeQAYjU';
const supabase = createClient(supabaseUrl, supabaseKey);

// Test function to directly create a session task
async function testSessionTask() {
  try {
    // First, get the current user
    const { data: authData, error: authError } = await supabase.auth.getSession();
    
    if (authError || !authData.session) {
      console.error('Authentication error or no session:', authError);
      return;
    }
    
    const userId = authData.session.user.id;
    console.log('Using user ID:', userId);
    
    // Create a test session task directly in the database
    const taskData = {
      user_id: userId,
      text: 'Direct Test Session Task',
      notes: '[SESSION_TASK] Created directly for testing',
      completed: false,
      completed_at: null,
      pomodoro_count: 0,
      target_pomodoros: 1,
      priority: 1
    };
    
    console.log('Inserting task:', taskData);
    
    const { data, error } = await supabase
      .from('tasks')
      .insert(taskData)
      .select('id, text, notes')
      .single();
    
    if (error) {
      console.error('Error creating task:', error);
    } else {
      console.log('Task created successfully:', data);
      
      // Verify it exists with the SESSION_TASK marker
      console.log('Checking if task has the [SESSION_TASK] marker:', 
        data.notes && data.notes.startsWith('[SESSION_TASK]'));
    }
    
    // Now test retrieving session tasks
    const { data: sessionTasks, error: queryError } = await supabase
      .from('tasks')
      .select('id, text, notes')
      .like('notes', '[SESSION_TASK]%');
    
    if (queryError) {
      console.error('Error querying session tasks:', queryError);
    } else {
      console.log('Found session tasks:', sessionTasks.length);
      console.log(sessionTasks);
    }
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

// Run the test
testSessionTask(); 