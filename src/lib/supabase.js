import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Add logging to help debug issues
console.log('Supabase initialization:');
console.log('URL defined:', !!supabaseUrl);
console.log('Key defined:', !!supabaseAnonKey);

// Safety check to provide a fallback if env vars are not set
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Authentication will not work.');
}

// Initialize Supabase client with error handling
const supabase = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

export default supabase; 