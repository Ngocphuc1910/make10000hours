import supabase from './src/lib/supabase';
import { syncTaskCreate } from './src/services/syncService';

// Test function to create a session task
async function testCreateSessionTask() {
  try {
    // Get current user (you need to be logged in)
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('Error: No authenticated user found. Please log in first.');
      return;
    }
    
    console.log('Creating test session task for user:', user.id);
    
    // Create a test session task
    const sessionTask = {
      title: 'Test Session Task',
      description: 'This is a test session task created via script',
      status: 'session', // This is what marks it as a session task
      estimatedPomodoros: 1,
      pomodoros: 0,
      priority: 1
    };
    
    const result = await syncTaskCreate(user.id, sessionTask);
    console.log('Result from task creation:', result);
    
    // Verify it exists in the database
    const { data, error } = await supabase
      .from('tasks')
      .select('id, text, notes')
      .eq('id', result.id)
      .single();
      
    if (error) {
      console.error('Error verifying task:', error);
    } else {
      console.log('Task verified in database:', data);
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testCreateSessionTask(); 