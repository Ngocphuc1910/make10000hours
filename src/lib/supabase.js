import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://ccxhdmyfmfwincvzqjhg.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjeGhkbXlmbWZ3aW5jdnpxamhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTg5MzA2NDAsImV4cCI6MjAxNDUwNjY0MH0.N8BzOUNKpYZkj5xj5vczxWlkuXmyaLQFvxcCpXC_Bbo';

// Add detailed logging to help debug issues
console.log('Supabase initialization:');
console.log('- URL:', supabaseUrl);
console.log('- Key length:', supabaseAnonKey ? supabaseAnonKey.length : 0);

// Check for placeholder values
const isPlaceholder = 
  !supabaseUrl || 
  !supabaseAnonKey || 
  supabaseUrl === 'your_supabase_url' || 
  supabaseAnonKey === 'your_supabase_anon_key' ||
  supabaseUrl.includes('placeholder') || 
  supabaseAnonKey.includes('placeholder');

// Safety check to provide detailed error messages
if (isPlaceholder) {
  console.error('=====================================================');
  console.error('ERROR: Supabase environment variables contain placeholder values.');
  console.error('Authentication and database functions will not work correctly.');
  console.error('');
  console.error('Please update your .env file with actual values:');
  console.error('1. Go to https://supabase.com/dashboard');
  console.error('2. Select your project');
  console.error('3. Go to Settings > API');
  console.error('4. Copy the URL and anon key to your .env file');
  console.error('=====================================================');
}

// Initialize the Supabase client with persist session option explicitly set
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    // 8 hours in seconds
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: {
      getItem: (key) => {
        console.log(`Supabase: Getting storage key: ${key}`);
        const value = localStorage.getItem(key);
        console.log(`Supabase: Value for ${key}:`, value ? 'exists' : 'null');
        return value;
      },
      setItem: (key, value) => {
        console.log(`Supabase: Setting storage key: ${key}`);
        localStorage.setItem(key, value);
      },
      removeItem: (key) => {
        console.log(`Supabase: Removing storage key: ${key}`);
        localStorage.removeItem(key);
      }
    }
  }
});

// Test connection when app loads
supabase.auth.getSession().then(({ data, error }) => {
  if (error) {
    console.error('Supabase connection test failed:', error.message);
  } else {
    console.log('Supabase connection test successful', data.session ? 'User is signed in' : 'No active session');
  }
});

export default supabase; 