/**
 * Script to run the tasks schema update
 * 
 * Run with: node scripts/run_schema_update.js
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with the service role key
const supabaseUrl = 'https://ccxhdmyfmfwincvzqjhg.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjeGhkbXlmbWZ3aW5jdnpxamhnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MjE0MDIzMiwiZXhwIjoyMDU3NzE2MjMyfQ.GhWSw8WtSK9dNLS_LZgo8MuTrsEtsmtOGgObJ-wyiyk';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Create test tasks using the current schema
async function createTestTasks() {
  try {
    console.log('Adding test task with current schema...');
    
    // Add a test task using the current column names
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: 'b65e0de2-f2ae-4dd0-8911-fc202a6cd9fd',
        text: 'Important Task with Current Schema',
        notes: 'This task was created using the current schema field names',
        completed: false,
        pomodoro_count: 0,
        target_pomodoros: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select();
    
    if (error) {
      console.error('Error creating task:', error);
    } else {
      console.log('Task created successfully!');
      console.log(data);
    }
    
    // List all tasks
    await listAllTasks();
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

// List all tasks
async function listAllTasks() {
  try {
    console.log('\nListing all tasks:');
    
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error listing tasks:', error);
      return;
    }
    
    console.log(`Found ${data.length} tasks:`);
    data.forEach((task, index) => {
      console.log(`\nTask ${index + 1}:`);
      console.log(`ID: ${task.id}`);
      console.log(`Name: ${task.text}`);
      console.log(`Description: ${task.notes}`);
      console.log(`Completed: ${task.completed}`);
      console.log(`Pomodoros: ${task.pomodoro_count}/${task.target_pomodoros}`);
      console.log(`Created: ${new Date(task.created_at).toLocaleString()}`);
    });
  } catch (err) {
    console.error('Error listing tasks:', err);
  }
}

// List all users
async function listAllUsers() {
  try {
    console.log('\nListing all users:');
    
    const { data, error } = await supabase
      .from('auth.users')
      .select('id, email, created_at')
      .order('created_at', { ascending: false });
    
    if (error) {
      // Try alternative approach for auth users
      const { data: directData, error: directError } = await supabase.auth.admin.listUsers();
      
      if (directError) {
        console.error('Error listing users:', directError);
        return;
      }
      
      console.log(`Found ${directData.users.length} users:`);
      directData.users.forEach(user => {
        console.log(`- ${user.email} (${user.id})`);
      });
      return;
    }
    
    console.log(`Found ${data.length} users:`);
    data.forEach(user => {
      console.log(`- ${user.email} (${user.id})`);
    });
  } catch (err) {
    console.error('Error listing users:', err);
  }
}

// Run the test
async function runTests() {
  try {
    console.log('Starting tests with current schema...');
    
    // Check column structure
    const { data: columns, error: columnError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'tasks')
      .order('ordinal_position');
    
    if (columnError) {
      console.error('Error fetching columns:', columnError);
    } else {
      console.log('Current tasks table schema:');
      columns.forEach(col => {
        console.log(`- ${col.column_name} (${col.data_type})`);
      });
    }
    
    // Create test tasks and list all tasks
    await createTestTasks();
    
    // List users
    await listAllUsers();
    
    console.log('\nTests completed!');
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

// Run the test script
runTests(); 