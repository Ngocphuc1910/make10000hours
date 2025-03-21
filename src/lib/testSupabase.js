import supabase from './supabase';

/**
 * Test Supabase connection and table setup
 * Run this in the console to debug connection issues
 */
export const testSupabaseConnection = async () => {
  console.log('=== Testing Supabase Connection ===');
  
  try {
    // Step 1: Test basic connection
    console.log('1. Testing basic connection...');
    const { data, error } = await supabase.from('_test').select('*').limit(1);
    
    if (error && error.code === 'PGRST301') {
      console.log('✅ Supabase connection successful (expected error for non-existent table)');
    } else if (error) {
      console.error('❌ Connection error:', error);
      return { success: false, error: error };
    } else {
      console.log('✅ Supabase connection successful');
    }
    
    // Step 2: Test authentication
    console.log('2. Testing authentication...');
    const { data: authData, error: authError } = await supabase.auth.getSession();
    
    if (authError) {
      console.error('❌ Authentication error:', authError);
      return { success: false, error: authError };
    }
    
    if (authData.session) {
      console.log('✅ Authentication successful - User is logged in');
      console.log('   User ID:', authData.session.user.id);
      console.log('   Email:', authData.session.user.email);
    } else {
      console.log('⚠️ No active session - User is not logged in');
    }
    
    // Step 3: Test user_settings table
    console.log('3. Testing user_settings table...');
    
    if (!authData.session) {
      console.log('⚠️ Skipping table test - no active user session');
      return { 
        success: true, 
        authenticated: false,
        message: 'Connection successful but user is not logged in' 
      };
    }
    
    const { data: tableTest, error: tableError } = await supabase
      .from('user_settings')
      .select('count(*)')
      .limit(1);
    
    if (tableError) {
      if (tableError.code === 'PGRST301') {
        console.error('❌ Table "user_settings" does not exist');
        return { 
          success: false, 
          authenticated: true,
          error: 'The user_settings table does not exist. Please run the SQL setup.' 
        };
      } else {
        console.error('❌ Error accessing user_settings table:', tableError);
        return { success: false, error: tableError };
      }
    } else {
      console.log('✅ user_settings table exists and is accessible');
    }
    
    console.log('✅ All tests passed!');
    return { 
      success: true, 
      authenticated: true,
      message: 'Supabase connection and table setup successful!' 
    };
    
  } catch (err) {
    console.error('❌ Unexpected error:', err);
    return { success: false, error: err };
  }
};

// Export a function that can be called directly from a browser console
window.testSupabase = testSupabaseConnection;

export default testSupabaseConnection; 