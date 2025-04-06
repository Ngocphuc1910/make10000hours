/**
 * Script to apply the task schema migration to fix the discrepancy 
 * between the database schema and the application code
 * 
 * Run with: node scripts/run_task_schema_migration.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client with admin key (required for schema changes)
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://ccxhdmyfmfwincvzqjhg.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY; // This must be the service key with more privileges

if (!supabaseServiceKey) {
  console.error('ERROR: SUPABASE_SERVICE_KEY environment variable is required.');
  console.error('This is NOT the same as your anon key. Get it from Supabase dashboard → Settings → API → service_role key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  try {
    console.log('Starting tasks schema migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20240406_fix_tasks_schema.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the SQL
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSql });
    
    if (error) {
      console.error('Error running migration:', error);
      process.exit(1);
    }
    
    console.log('Migration completed successfully!');
    
    // Verify the changes
    const { data: columns, error: columnError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'tasks');
    
    if (columnError) {
      console.error('Error verifying columns:', columnError);
    } else {
      console.log('Updated tasks table columns:', columns.map(c => c.column_name).join(', '));
    }
    
    // Check a sample task
    const { data: sampleTask, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .limit(1)
      .single();
    
    if (taskError) {
      console.error('Error fetching sample task:', taskError);
    } else {
      console.log('Sample task after migration:', sampleTask);
    }
    
  } catch (err) {
    console.error('Unexpected error during migration:', err);
    process.exit(1);
  }
}

runMigration(); 