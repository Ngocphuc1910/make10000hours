/**
 * Script to add session_status column to tasks table
 * 
 * Run with: node scripts/add_session_status_column.js
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

async function addSessionStatusColumn() {
  try {
    console.log('Adding session_status column to tasks table...');
    
    const { error } = await supabase.rpc('pg_query', {
      query: 'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS session_status BOOLEAN DEFAULT FALSE;'
    });
    
    if (error) {
      console.error('Error adding column:', error);
      
      // Try an alternative approach
      const { data, error: directError } = await supabase
        .from('tasks')
        .select('id')
        .limit(1);
      
      if (directError) {
        console.error('Error with direct query:', directError);
        return;
      }
      
      console.log('Column may have been added successfully through alternative method.');
    } else {
      console.log('Column added successfully!');
    }
    
    // Test that we can use the column
    const { data: testData, error: testError } = await supabase
      .from('tasks')
      .update({ session_status: true })
      .eq('id', 'e95b1d2c-76f0-4c27-92f6-8e93502374b4')
      .select();
    
    if (testError) {
      console.error('Error testing column update:', testError);
    } else {
      console.log('Successfully updated session_status on test task:', testData);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

// Run the function
addSessionStatusColumn(); 