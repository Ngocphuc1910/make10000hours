import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://ccxhdmyfmfwincvzqjhg.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjeGhkbXlmbWZ3aW5jdnpxamhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIxNDAyMzIsImV4cCI6MjA1NzcxNjIzMn0.nf8fOFwXcFayteHi-HOhcxiHw4aLE7oOtWv8HeQAYjU';

// Add detailed logging to help debug issues
console.log('Supabase initialization:');
console.log('- URL:', supabaseUrl);
console.log('- Key length:', supabaseAnonKey ? supabaseAnonKey.length : 0);
console.log('- Key first/last chars:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 10)}...${supabaseAnonKey.substring(supabaseAnonKey.length - 10)}` : 'N/A');

// Force clear any potentially corrupted auth data in localStorage
console.log('Clearing previous Supabase auth data...');
Object.keys(localStorage).forEach(key => {
  if (key.includes('sb-') && key.includes('auth')) {
    console.log(`Removing key: ${key}`);
    localStorage.removeItem(key);
  }
});

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

// Enhanced storage with debug logging and error handling
const enhancedStorage = {
  getItem: (key) => {
    try {
      console.log(`Supabase: Getting storage key: ${key}`);
      const value = localStorage.getItem(key);
      
      // Debug logging for session data
      if (key.includes('sb-') && key.includes('auth')) {
        try {
          const parsed = JSON.parse(value);
          const expiresAt = parsed?.expiresAt || parsed?.expires_at;
          if (expiresAt) {
            const expiryDate = new Date(expiresAt * 1000);
            const now = new Date();
            console.log(`Supabase: Token expires at ${expiryDate.toISOString()}, ${Math.floor((expiryDate - now) / 1000 / 60)} minutes remaining`);
          }
        } catch (e) {
          console.log('Supabase: Unable to parse token data for logging');
        }
      }
      
      console.log(`Supabase: Value for ${key}: ${value ? 'exists' : 'null'}`);
      return value;
    } catch (error) {
      console.error(`Supabase: Error getting storage key ${key}:`, error);
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      console.log(`Supabase: Setting storage key: ${key}`);
      localStorage.setItem(key, value);
      
      // Verify storage was successful
      const storedValue = localStorage.getItem(key);
      if (storedValue !== value) {
        console.warn(`Supabase: Storage verification failed for key ${key}`);
      }
    } catch (error) {
      console.error(`Supabase: Error setting storage key ${key}:`, error);
    }
  },
  removeItem: (key) => {
    try {
      console.log(`Supabase: Removing storage key: ${key}`);
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Supabase: Error removing storage key ${key}:`, error);
    }
  }
};

// Initialize with modified options
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: enhancedStorage,
    // Increase debug for more visibility
    debug: true,
    // Explicitly set the storage key
    storageKey: 'sb-auth-token-new',
  },
  global: {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  },
});

// Test connection when the module loads
const testConnection = async () => {
  try {
    console.log('Supabase: Testing connection to Supabase on module load');
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Supabase: Connection test error:', error);
    } else {
      console.log('Supabase: Connection test success, session:', data?.session ? 'exists' : 'none');
    }
    
    // Check and log all auth-related keys in localStorage
    Object.keys(localStorage).forEach(key => {
      if (key.includes('sb-') && key.includes('auth')) {
        console.log(`Supabase: Found auth storage key: ${key}`);
      }
    });
  } catch (e) {
    console.error('Supabase: Connection test exception:', e);
  }
};

// Run test immediately
testConnection();

export default supabase; 