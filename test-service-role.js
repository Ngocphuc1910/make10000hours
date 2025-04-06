// Direct test script using service role key for testing
const { createClient } = require('@supabase/supabase-js');

// Create Supabase client with the service role key
const supabaseUrl = 'https://ccxhdmyfmfwincvzqjhg.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjeGhkbXlmbWZ3aW5jdnpxamhnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjE0MDIzMiwiZXhwIjoyMDU3NzE2MjMyfQ.GhWSw8WtSK9dNLS_LZgo8MuTrsEtsmtOGgObJ-wyiyk';
const supabase = createClient(supabaseUrl, serviceRoleKey);

// Test function to directly create a session task
async function testSessionTask() {
  try {
    // For testing purposes, we'll query an existing user from the tasks table
    const { data: existingTask, error: taskError } = await supabase
      .from('tasks')
      .select('user_id')
      .limit(1)
      .single();
    
    let userId;
    if (taskError || !existingTask) {
      console.error('Error getting existing task or no tasks found:', taskError);
      console.log('Using a test user ID instead');
      // Try using a random UUID as user ID
      userId = "00000000-0000-4000-8000-000000000000"; // Test UUID
    } else {
      userId = existingTask.user_id;
      console.log('Using existing user ID from tasks table:', userId);
    }
    
    // Create a test session task directly in the database
    const taskData = {
      user_id: userId,
      text: 'Service Role Test Session Task',
      notes: '[SESSION_TASK] Created with service role for testing',
      completed: false,
      completed_at: null,
      pomodoro_count: 0,
      target_pomodoros: 1,
      // Removed priority field as it doesn't exist in the schema
    };
    
    console.log('Inserting task with service role:', taskData);
    
    const { data, error } = await supabase
      .from('tasks')
      .insert(taskData)
      .select('id, text, notes, user_id')
      .single();
    
    if (error) {
      console.error('Error creating task:', error);
    } else {
      console.log('Task created successfully:', data);
      
      // Verify it exists with the SESSION_TASK marker
      console.log('Checking if task has the [SESSION_TASK] marker:', 
        data.notes && data.notes.startsWith('[SESSION_TASK]'));
    }
    
    // Now test retrieving all session tasks
    const { data: sessionTasks, error: queryError } = await supabase
      .from('tasks')
      .select('id, text, notes, user_id')
      .like('notes', '[SESSION_TASK]%');
    
    if (queryError) {
      console.error('Error querying session tasks:', queryError);
    } else {
      console.log('Found session tasks:', sessionTasks.length);
      sessionTasks.forEach(task => {
        console.log(`- Task ID: ${task.id}, Text: ${task.text}, Notes: ${task.notes}`);
      });
    }
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

// Run the test
testSessionTask(); 