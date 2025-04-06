// Test script for the complete session task workflow
const { createClient } = require('@supabase/supabase-js');

// Create Supabase client with the service role key
const supabaseUrl = 'https://ccxhdmyfmfwincvzqjhg.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjeGhkbXlmbWZ3aW5jdnpxamhnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjE0MDIzMiwiZXhwIjoyMDU3NzE2MjMyfQ.GhWSw8WtSK9dNLS_LZgo8MuTrsEtsmtOGgObJ-wyiyk';
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testFullSessionWorkflow() {
  try {
    console.log('====== TESTING FULL SESSION TASK WORKFLOW ======');
    
    // Step 1: Get a user ID for testing
    const { data: existingTask, error: taskError } = await supabase
      .from('tasks')
      .select('user_id')
      .limit(1)
      .single();
    
    if (taskError || !existingTask) {
      console.error('Error getting existing task or no tasks found:', taskError);
      return;
    }
    
    const userId = existingTask.user_id;
    console.log(`Step 1: Using user ID: ${userId}`);
    
    // Step 2: Create a new session task
    console.log('\nStep 2: Creating a new session task');
    const newTask = {
      user_id: userId,
      text: 'Full Workflow Test Session Task',
      notes: '[SESSION_TASK] Initial session task description',
      completed: false,
      completed_at: null,
      pomodoro_count: 0,
      target_pomodoros: 2
    };
    
    const { data: createdTask, error: createError } = await supabase
      .from('tasks')
      .insert(newTask)
      .select()
      .single();
    
    if (createError) {
      console.error('Error creating task:', createError);
      return;
    }
    
    console.log('Session task created successfully:');
    console.log(`- ID: ${createdTask.id}`);
    console.log(`- Text: ${createdTask.text}`);
    console.log(`- Notes: ${createdTask.notes}`);
    console.log(`- Is session task: ${createdTask.notes.startsWith('[SESSION_TASK]')}`);
    
    // Step 3: Update the session task while keeping it as a session task
    console.log('\nStep 3: Updating session task while preserving session status');
    
    const { data: updatedSessionTask, error: updateError1 } = await supabase
      .from('tasks')
      .update({
        text: 'Updated Session Task Title',
        notes: '[SESSION_TASK] Updated session description',
        pomodoro_count: 1
      })
      .eq('id', createdTask.id)
      .select()
      .single();
    
    if (updateError1) {
      console.error('Error updating session task:', updateError1);
    } else {
      console.log('Session task updated successfully:');
      console.log(`- ID: ${updatedSessionTask.id}`);
      console.log(`- Text: ${updatedSessionTask.text}`);
      console.log(`- Notes: ${updatedSessionTask.notes}`);
      console.log(`- Is still session task: ${updatedSessionTask.notes.startsWith('[SESSION_TASK]')}`);
      console.log(`- Pomodoro count: ${updatedSessionTask.pomodoro_count}`);
    }
    
    // Step 4: Convert session task to regular task
    console.log('\nStep 4: Converting session task to regular task');
    
    // Extract the clean description without the session marker
    const cleanDescription = updatedSessionTask.notes.replace('[SESSION_TASK] ', '');
    
    const { data: regularTask, error: updateError2 } = await supabase
      .from('tasks')
      .update({
        notes: cleanDescription // Remove the [SESSION_TASK] prefix
      })
      .eq('id', createdTask.id)
      .select()
      .single();
    
    if (updateError2) {
      console.error('Error converting session task to regular task:', updateError2);
    } else {
      console.log('Task converted to regular task successfully:');
      console.log(`- ID: ${regularTask.id}`);
      console.log(`- Text: ${regularTask.text}`);
      console.log(`- Notes: ${regularTask.notes}`);
      console.log(`- Is session task: ${regularTask.notes.startsWith('[SESSION_TASK]')}`);
    }
    
    // Step 5: Delete the task
    console.log('\nStep 5: Deleting the task');
    
    const { error: deleteError } = await supabase
      .from('tasks')
      .delete()
      .eq('id', createdTask.id);
    
    if (deleteError) {
      console.error('Error deleting task:', deleteError);
    } else {
      console.log(`Task ${createdTask.id} deleted successfully`);
    }
    
    // Step 6: Verify deletion
    console.log('\nStep 6: Verifying task was deleted');
    
    const { data: taskCheck, error: checkError } = await supabase
      .from('tasks')
      .select()
      .eq('id', createdTask.id);
    
    if (checkError) {
      console.error('Error checking task:', checkError);
    } else {
      console.log(`Task found: ${taskCheck.length > 0}`);
      console.log(`Verification complete: Task ${taskCheck.length === 0 ? 'was' : 'was not'} deleted`);
    }
    
    console.log('\n====== FULL SESSION TASK WORKFLOW TEST COMPLETE ======');
    
  } catch (err) {
    console.error('Unexpected error during workflow test:', err);
  }
}

// Run the test
testFullSessionWorkflow(); 