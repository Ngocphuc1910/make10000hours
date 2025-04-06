const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with the credentials from supabase.js
const supabaseUrl = 'https://ccxhdmyfmfwincvzqjhg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjeGhkbXlmbWZ3aW5jdnpxamhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTg5MzA2NDAsImV4cCI6MjAxNDUwNjY0MH0.N8BzOUNKpYZkj5xj5vczxWlkuXmyaLQFvxcCpXC_Bbo';

console.log('Connecting to Supabase...');

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function listAllProfiles() {
  try {
    console.log('Fetching all user profiles...');
    
    // Query all profiles
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url, created_at, updated_at, daily_goal_hours')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching profiles:', error.message);
      return;
    }
    
    console.log(`Found ${profiles.length} user profiles:`);
    
    if (profiles.length === 0) {
      console.log('No users found in the database.');
      return [];
    }
    
    // Display profiles in a more readable format
    profiles.forEach((profile, index) => {
      console.log(`\nUser #${index + 1}:`);
      console.log(`  ID: ${profile.id}`);
      console.log(`  Email: ${profile.email || 'Not set'}`);
      console.log(`  Name: ${profile.full_name || 'Not set'}`);
      console.log(`  Avatar: ${profile.avatar_url ? 'Set' : 'Not set'}`);
      console.log(`  Daily Goal: ${profile.daily_goal_hours || 0} hours`);
      console.log(`  Created: ${new Date(profile.created_at).toLocaleString()}`);
      console.log(`  Last Updated: ${new Date(profile.updated_at).toLocaleString()}`);
    });
    
    return profiles;
  } catch (error) {
    console.error('Unexpected error:', error.message);
  }
}

async function listRecentLogins() {
  try {
    console.log('\nAttempting to fetch recent login information...');
    
    // This is a more complex query and might not work depending on your database structure
    // Supabase auth stores sessions in auth.sessions table which may not be accessible with anon key
    const { data: sessions, error } = await supabase
      .from('auth.sessions') // This might not be accessible
      .select('user_id, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.log('Cannot access session data with current permissions.');
      return;
    }
    
    if (sessions && sessions.length > 0) {
      console.log(`Found ${sessions.length} recent login sessions:`);
      sessions.forEach((session, index) => {
        console.log(`  ${index + 1}. User ID: ${session.user_id}, Login time: ${new Date(session.created_at).toLocaleString()}`);
      });
    }
  } catch (error) {
    console.log('Session data is not accessible with current permissions.');
  }
}

async function main() {
  try {
    // List all user profiles
    await listAllProfiles();
    
    // Try to get login information (might not work with anon key)
    await listRecentLogins();
    
    console.log('\nDone. For more detailed user activity, you may need admin access to the auth schema.');
  } catch (error) {
    console.error('Error in main function:', error.message);
  }
}

// Run the main function
main(); 