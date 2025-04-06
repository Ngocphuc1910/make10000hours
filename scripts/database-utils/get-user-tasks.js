const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with the correct credentials from supabase.js
const supabaseUrl = 'https://ccxhdmyfmfwincvzqjhg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjeGhkbXlmbWZ3aW5jdnpxamhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTg5MzA2NDAsImV4cCI6MjAxNDUwNjY0MH0.N8BzOUNKpYZkj5xj5vczxWlkuXmyaLQFvxcCpXC_Bbo';

console.log('Connecting to Supabase...');

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

const targetEmail = 'ngocphuc159tl@gmail.com';

async function findUserByEmail() {
  console.log(`Looking for user with email: ${targetEmail}`);
  
  try {
    // Query the profiles table for this email
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', targetEmail)
      .maybeSingle();
    
    if (userError) {
      console.error('Error finding user by email:', userError.message);
      return;
    }
    
    if (!userData) {
      console.log(`No user found with email: ${targetEmail}`);
      console.log('Listing all profiles to troubleshoot:');
      await listAllProfiles();
      return;
    }
    
    console.log(`Found user: ${userData.id} (${userData.email})`);
    return userData;
  } catch (error) {
    console.error('Unexpected error:', error.message);
  }
}

async function listAllProfiles() {
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .limit(10);
    
    if (error) {
      console.error('Error listing profiles:', error.message);
      return;
    }
    
    console.log(`Found ${profiles.length} profiles:`);
    profiles.forEach(profile => {
      console.log(`- ${profile.id}: ${profile.email || 'No email'} (${profile.full_name || 'No name'})`);
    });
  } catch (error) {
    console.error('Unexpected error:', error.message);
  }
}

async function getTasksForUser(userId) {
  try {
    console.log(`Fetching tasks for user ID: ${userId}`);
    
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching tasks:', error.message);
      return;
    }
    
    console.log(`Found ${tasks.length} tasks for user:`);
    
    if (tasks.length === 0) {
      console.log('No tasks found for this user.');
      return [];
    }
    
    // Print tasks in a structured format
    tasks.forEach((task, index) => {
      console.log(`\nTask #${index + 1}:`);
      console.log(`  ID: ${task.id}`);
      console.log(`  Name: ${task.name}`);
      console.log(`  Description: ${task.description || 'None'}`);
      console.log(`  Status: ${task.status}`);
      console.log(`  Priority: ${task.priority}`);
      console.log(`  Estimated Pomodoros: ${task.estimated_pomodoros}`);
      console.log(`  Completed Pomodoros: ${task.completed_pomodoros}`);
      console.log(`  Created At: ${new Date(task.created_at).toLocaleString()}`);
      console.log(`  Updated At: ${new Date(task.updated_at).toLocaleString()}`);
    });
    
    return tasks;
  } catch (error) {
    console.error('Unexpected error:', error.message);
  }
}

async function main() {
  try {
    // First find the user
    const user = await findUserByEmail();
    
    if (!user) {
      // If no user found, we've already listed profiles
      return;
    }
    
    // Get tasks for this user
    await getTasksForUser(user.id);
  } catch (error) {
    console.error('Error in main function:', error.message);
  }
}

// Run the main function
main(); 