import supabase from './supabase';
import { checkInternetConnection, checkSupabaseConnection } from '../utils/networkUtils';

// Supabase URL for connection checks
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://ccxhdmyfmfwincvzqjhg.supabase.co';

/**
 * Test Supabase connection and table setup
 * Run this in the console to debug connection issues
 */
export const testSupabaseConnection = async () => {
  console.log('=== Testing Supabase Connection ===');
  
  try {
    // Step 0: Check environment variables
    console.log('0. Checking environment variables...');
    
    // Check URL
    const envUrl = process.env.REACT_APP_SUPABASE_URL;
    if (!envUrl) {
      console.error('❌ REACT_APP_SUPABASE_URL environment variable is not set');
      return {
        success: false,
        error: 'Supabase URL is not configured. Check your .env file.'
      };
    }
    
    console.log(`✅ REACT_APP_SUPABASE_URL is set: ${envUrl.substring(0, 20)}...`);
    
    // Check API key
    const envKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
    if (!envKey) {
      console.error('❌ REACT_APP_SUPABASE_ANON_KEY environment variable is not set');
      return {
        success: false,
        error: 'Supabase API key is not configured. Check your .env file.'
      };
    }
    
    // Only log part of the key for security
    const keyStart = envKey.substring(0, 10);
    const keyEnd = envKey.substring(envKey.length - 5);
    console.log(`✅ REACT_APP_SUPABASE_ANON_KEY is set: ${keyStart}...${keyEnd} (length: ${envKey.length})`);
    
    // Check if key format looks valid (simple check)
    if (!envKey.includes('.') || envKey.length < 30) {
      console.warn('⚠️ Supabase API key format might be incorrect');
    }
    
    // Step 1: Test internet connectivity
    console.log('1. Testing internet connectivity...');
    const hasInternet = await checkInternetConnection();
    
    if (!hasInternet) {
      console.error('❌ No internet connection detected');
      return { 
        success: false, 
        error: 'No internet connection. Please check your network settings and try again.' 
      };
    }
    
    console.log('✅ Internet connection successful');
    
    // Step 2: Test Supabase API connectivity
    console.log('2. Testing Supabase API connectivity...');
    const connectionCheck = await checkSupabaseConnection(supabaseUrl);
    
    if (!connectionCheck.success) {
      console.error('❌ Supabase API connection failed:', connectionCheck.error);
      return { 
        success: false, 
        error: connectionCheck.error
      };
    }
    
    console.log('✅ Supabase API connectivity successful');
    
    // Step 3: Test authentication
    console.log('3. Testing authentication...');
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
    
    // Step 4: Test user_settings table
    console.log('4. Testing user_settings table...');
    
    if (!authData.session) {
      console.log('⚠️ Skipping table test - no active user session');
      return { 
        success: true, 
        authenticated: false,
        message: 'Connection and API successful but user is not logged in' 
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