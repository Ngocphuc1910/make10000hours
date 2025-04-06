// Direct test script to check for session tasks
const { createClient } = require('@supabase/supabase-js');

// Create Supabase client with the service role key
const supabaseUrl = 'https://ccxhdmyfmfwincvzqjhg.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjeGhkbXlmbWZ3aW5jdnpxamhnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjE0MDIzMiwiZXhwIjoyMDU3NzE2MjMyfQ.GhWSw8WtSK9dNLS_LZgo8MuTrsEtsmtOGgObJ-wyiyk';
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testSessionTasks() {
  try {
    // Find all tasks that have [SESSION_TASK] in notes
    const { data: sessionTasks, error } = await supabase
      .from('tasks')
      .select('*')
      .like('notes', '[SESSION_TASK]%');
    
    if (error) {
      console.error('Error querying session tasks:', error);
      return;
    }
    
    console.log(`Found ${sessionTasks.length} session tasks in the database:`);
    
    sessionTasks.forEach(task => {
      console.log(`\nTask ID: ${task.id}`);
      console.log(`Text: ${task.text}`);
      console.log(`Notes: ${task.notes}`);
      console.log(`User ID: ${task.user_id}`);
      
      // Extract the actual description (without [SESSION_TASK] prefix)
      const cleanDescription = task.notes.replace('[SESSION_TASK] ', '');
      console.log(`Clean description: ${cleanDescription}`);
      
      console.log(`Status: session (derived from notes prefix)`);
    });

    // Now we'll test updating a session task
    if (sessionTasks.length > 0) {
      const testTask = sessionTasks[0];
      console.log(`\nUpdating session task ${testTask.id}`);
      
      // Simulate updating while preserving session status
      const originalNotes = testTask.notes;
      const cleanDesc = originalNotes.replace('[SESSION_TASK] ', '');
      const updatedDesc = `${cleanDesc} - Updated at ${new Date().toISOString()}`;
      const newNotes = `[SESSION_TASK] ${updatedDesc}`;
      
      const { data, error: updateError } = await supabase
        .from('tasks')
        .update({ notes: newNotes })
        .eq('id', testTask.id)
        .select()
        .single();
      
      if (updateError) {
        console.error('Error updating session task:', updateError);
      } else {
        console.log('Task updated successfully:');
        console.log(`New notes: ${data.notes}`);
        console.log(`Session status preserved: ${data.notes.startsWith('[SESSION_TASK]')}`);
      }
    }
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

// Run the test
testSessionTasks(); 