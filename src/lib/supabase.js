import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

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

// Initialize Supabase client with better options
const supabaseOptions = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
};

// Create the client with proper error handling
const supabase = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  supabaseOptions
);

// Test connection when app loads
supabase.auth.getSession().then(({ data, error }) => {
  if (error) {
    console.error('Supabase connection test failed:', error.message);
  } else {
    console.log('Supabase connection test successful', data.session ? 'User is signed in' : 'No active session');
  }
});

export default supabase; 