// This script can be pasted into the browser console when logged in
// It will list all users (profiles) in the database

(async () => {
  try {
    console.log('Fetching user profiles...');
    
    // Check if Supabase is available from the app
    if (!window.supabase) {
      console.error('Error: Supabase client not found in the window object.');
      console.log('Make sure you are logged in and the app is fully loaded.');
      return;
    }
    
    // Get the current user session to confirm authentication
    const { data: { session }, error: sessionError } = await window.supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Error getting session:', sessionError.message);
      return;
    }
    
    if (!session || !session.user) {
      console.error('No active session found. Please log in first.');
      return;
    }
    
    console.log(`Logged in as: ${session.user.email} (ID: ${session.user.id})`);
    
    // Fetch all profiles from the database
    const { data: profiles, error: profilesError } = await window.supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url, created_at, updated_at, daily_goal_hours')
      .order('created_at', { ascending: false });
    
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError.message);
      return;
    }
    
    console.log(`Found ${profiles.length} user profiles:`);
    
    if (profiles.length === 0) {
      console.log('No users found in the database.');
      return;
    }
    
    // Display profiles in a table format
    console.table(profiles.map(profile => ({
      ID: profile.id.substring(0, 8) + '...', // Truncate ID for readability
      Email: profile.email || 'Not set',
      Name: profile.full_name || 'Not set',
      'Daily Goal': profile.daily_goal_hours || 0,
      'Created At': new Date(profile.created_at).toLocaleString(),
      'Last Updated': new Date(profile.updated_at).toLocaleString()
    })));
    
    // For a more detailed view of a specific user, uncomment and modify:
    /*
    const targetEmail = 'ngocphuc159tl@gmail.com';
    const targetUser = profiles.find(p => p.email === targetEmail);
    if (targetUser) {
      console.log('\nDetailed information for user:', targetEmail);
      console.log(targetUser);
    }
    */
    
    // Try to get info about current user's auth
    console.log('\nCurrent user authentication info:');
    const { data: authData, error: authError } = await window.supabase.auth.getUser();
    
    if (authError) {
      console.error('Error getting auth data:', authError.message);
    } else if (authData) {
      console.log('User auth data:', authData);
    }
    
    // Return the profiles in case the user wants to do something with them
    return profiles;
    
  } catch (error) {
    console.error('Unexpected error:', error.message);
  }
})(); 