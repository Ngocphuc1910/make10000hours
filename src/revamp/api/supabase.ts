import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Enhanced storage with debug logging and error handling
const enhancedStorage = {
  getItem: (key: string) => {
    try {
      console.log(`Supabase: Getting storage key: ${key}`);
      const value = localStorage.getItem(key);

      // Debug logging for session data
      if (key.includes('sb-') && key.includes('auth') && value) {
        try {
          const parsed = JSON.parse(value);
          const expiresAt = parsed?.expiresAt || parsed?.expires_at;
          if (expiresAt && typeof expiresAt === 'number') {
            const expiryDate = new Date(expiresAt * 1000);
            const now = new Date().getTime();
            console.log(`Supabase: Token expires at ${expiryDate.toISOString()}, ${Math.floor((expiresAt - now) / 1000 / 60)} minutes remaining`);
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
  setItem: (key: string, value: string) => {
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
  removeItem: (key: string) => {
    try {
      console.log(`Supabase: Removing storage key: ${key}`);
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Supabase: Error removing storage key ${key}:`, error);
    }
  }
};

// Initialize with modified options
const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
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
    })
    : null;

// Test connection when the module loads
const testConnection = async () => {
  if (!supabase) {
    console.error('Supabase: Supabase client not initialized. Check your environment variables.');
    return;
  }
  try {
    console.log('Supabase: Testing connection to Supabase on module load');
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error('Supabase: Connection test error:', error);
    } else {
      console.log('Supabase: Connection test success, session:', data?.session ? 'exists' : 'none');
    }
  } catch (e) {
    console.error('Supabase: Connection test exception:', e);
  }
};

// Run test immediately
testConnection();

export default supabase; 