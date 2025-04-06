/**
 * Script to check the current tasks table schema
 * 
 * Run with: node scripts/check_tasks_schema.js
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://ccxhdmyfmfwincvzqjhg.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjeGhkbXlmbWZ3aW5jdnpxamhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTg5MzA2NDAsImV4cCI6MjAxNDUwNjY0MH0.N8BzOUNKpYZkj5xj5vczxWlkuXmyaLQFvxcCpXC_Bbo';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTasksSchema() {
  try {
    console.log('Checking tasks table schema...');
    
    // Query the information schema for column details
    const { data: columns, error } = await supabase
      .rpc('get_table_schema', { table_name: 'tasks' });
    
    if (error) {
      // Fallback to a direct query if RPC is not available
      console.log('RPC not available, trying direct query...');
      const { data: directColumns, error: directError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable, column_default')
        .eq('table_name', 'tasks')
        .order('ordinal_position', { ascending: true });
      
      if (directError) {
        console.error('Error fetching schema:', directError);
        return;
      }
      
      console.log('Current tasks table schema:');
      console.table(directColumns);
      
      // Check if we have the expected columns for the frontend code
      const requiredColumns = [
        'name', 'description', 'status', 'priority',
        'estimated_pomodoros', 'completed_pomodoros'
      ];
      
      const missingColumns = requiredColumns.filter(
        col => !directColumns.some(dbCol => dbCol.column_name === col)
      );
      
      if (missingColumns.length > 0) {
        console.warn('Warning: Missing columns required by the frontend code:');
        console.warn(missingColumns.join(', '));
      } else {
        console.log('✓ All required columns are present');
      }
      
      return;
    }
    
    console.log('Current tasks table schema:');
    console.table(columns);
    
    // Check if we have the expected columns for the frontend code
    const requiredColumns = [
      'name', 'description', 'status', 'priority',
      'estimated_pomodoros', 'completed_pomodoros'
    ];
    
    const missingColumns = requiredColumns.filter(
      col => !columns.some(dbCol => dbCol.column_name === col)
    );
    
    if (missingColumns.length > 0) {
      console.warn('Warning: Missing columns required by the frontend code:');
      console.warn(missingColumns.join(', '));
    } else {
      console.log('✓ All required columns are present');
    }
    
    // Check sample task data
    const { data: sampleTask, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .limit(1)
      .single();
    
    if (taskError) {
      console.error('Error fetching sample task:', taskError);
    } else {
      console.log('Sample task data:');
      console.log(sampleTask);
    }
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

// Create the RPC function if it doesn't exist
async function createSchemaRpc() {
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE OR REPLACE FUNCTION get_table_schema(table_name TEXT)
      RETURNS TABLE (
        column_name TEXT,
        data_type TEXT,
        is_nullable TEXT,
        column_default TEXT
      )
      LANGUAGE sql
      SECURITY DEFINER
      AS $$
        SELECT 
          column_name, 
          data_type, 
          is_nullable,
          column_default
        FROM 
          information_schema.columns 
        WHERE 
          table_name = table_name
        ORDER BY 
          ordinal_position;
      $$;
    `
  });

  if (error) {
    console.log('Could not create RPC function, will use direct query');
  }
}

// Run the check
createSchemaRpc().then(checkTasksSchema); 