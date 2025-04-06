// Test script to check Supabase connection and insert a task directly
// Using CommonJS for direct Node execution
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client directly in this file
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://ccxhdmyfmfwincvzqjhg.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjeGhkbXlmbWZ3aW5jdnpxamhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIxNDAyMzIsImV4cCI6MjA1NzcxNjIzMn0.nf8fOFwXcFayteHi-HOhcxiHw4aLE7oOtWv8HeQAYjU';

console.log('Supabase connection info:');
console.log('- URL:', supabaseUrl);
console.log('- Key length:', supabaseAnonKey ? supabaseAnonKey.length : 0);

// Initialize the client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Execute immediately
(async function testSupabaseConnection() {
  console.log('Testing Supabase connection...');
  
  try {
    // Test 1: Check connection by getting session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Session error:', sessionError);
    } else {
      console.log('Session check successful:', sessionData.session ? 'Session exists' : 'No session');
    }
    
    // Test 2: Try to select from tasks table
    console.log('Checking tasks table...');
    const { data: tasksData, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .limit(1);
      
    if (tasksError) {
      console.error('Error checking tasks table:', tasksError);
      
      // Check if it's a table not found error
      if (tasksError.code === '42P01' || tasksError.message.includes('relation "public.tasks" does not exist')) {
        console.error('CRITICAL ERROR: The tasks table does not exist in the database!');
        console.log('This explains why tasks are not being saved.');
        console.log('You need to run the SQL to create the tasks table:');
        console.log(`
CREATE TABLE public.tasks (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  text text NOT NULL,
  notes text,
  completed boolean DEFAULT false,
  completed_at timestamp with time zone,
  pomodoro_count integer DEFAULT 0,
  target_pomodoros integer DEFAULT 1,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their own tasks" ON public.tasks
  FOR ALL
  USING (auth.uid() = user_id);
        `);
      }
    } else {
      console.log('Tasks table check successful:', tasksData);
      
      // Test 3: Try a simple anonymous insert with minimal fields
      console.log('Attempting to insert a simple anonymous task...');
      
      const testTask = {
        // Using a fixed UUID for testing anonymous inserts
        user_id: '00000000-0000-0000-0000-000000000000',
        text: 'Test Task ' + new Date().toISOString()
      };
      
      const { data: insertData, error: insertError } = await supabase
        .from('tasks')
        .insert([testTask])
        .select();
        
      if (insertError) {
        console.error('Error inserting simple test task:', insertError);
        console.error('Error details:', insertError.message);
        
        if (insertError.code === '23503') {
          console.log('Foreign key constraint error. This is normal for anonymous inserts.');
          console.log('This confirms the table exists and the schema is likely correct.');
          console.log('The issue is likely with authentication or row-level security policies.');
        }
      } else {
        console.log('Simple test task inserted successfully:', insertData);
      }
    }
    
    console.log('Supabase connection tests completed');
  } catch (error) {
    console.error('Unexpected error during Supabase connection test:', error);
  }
})(); 