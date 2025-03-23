/**
 * Network utilities for handling connectivity issues
 */

/**
 * Create a fetch request with timeout
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise} The fetch promise with timeout
 */
const fetchWithTimeout = (url, options = {}, timeout = 10000) => {
  // Create an abort controller to handle timeout
  const controller = new AbortController();
  const { signal } = controller;
  
  // Set up the timeout
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);
  
  // Return the fetch promise with the signal
  return fetch(url, { ...options, signal })
    .finally(() => clearTimeout(timeoutId));
};

/**
 * Check if the device is connected to the internet
 * @returns {Promise<boolean>} True if connected, false otherwise
 */
export const checkInternetConnection = async () => {
  try {
    // Try to fetch a simple resource that's likely to be reliable and fast
    // We use Cloudflare's 1.1.1.1 which should be globally available
    const response = await fetchWithTimeout('https://1.1.1.1', { 
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-cache'
    }, 5000); // 5 second timeout
    
    return true; // If we get here, we have connectivity
  } catch (error) {
    console.error('Internet connection check failed:', error);
    if (error.name === 'AbortError') {
      console.error('Connection timed out');
    }
    return false;
  }
};

/**
 * Check if we can connect to the Supabase API
 * @param {string} supabaseUrl - The Supabase URL to check
 * @returns {Promise<Object>} An object with success and optional error properties
 */
export const checkSupabaseConnection = async (supabaseUrl) => {
  try {
    if (!supabaseUrl) {
      return { 
        success: false, 
        error: 'No Supabase URL provided. Check your environment variables.'
      };
    }
    
    // Get the API key
    const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
    if (!supabaseAnonKey) {
      return {
        success: false,
        error: 'No Supabase API key found. Check your environment variables.'
      };
    }
    
    // First check general internet connectivity
    const hasInternet = await checkInternetConnection();
    if (!hasInternet) {
      return { 
        success: false, 
        error: 'No internet connection. Please check your network settings.'
      };
    }
    
    // Now check Supabase specifically
    try {
      const response = await fetchWithTimeout(`${supabaseUrl}/auth/v1/token?grant_type=password`, { 
        method: 'POST',
        cache: 'no-cache',
        headers: {
          'apikey': supabaseAnonKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: 'test@example.com', password: 'password' })
      }, 10000); // 10 second timeout
      
      // For auth endpoint, 400 is actually expected when we don't provide credentials
      if (response.ok || response.status === 400 || response.status === 401) {
        return { success: true };
      } else {
        const responseText = await response.text();
        console.error('API response:', response.status, responseText);
        
        return { 
          success: false, 
          error: `Supabase API returned unexpected status: ${response.status}`,
          status: response.status,
          details: responseText
        };
      }
    } catch (fetchError) {
      if (fetchError.name === 'AbortError') {
        return {
          success: false,
          error: 'Connection timed out. The Supabase server might be down or your connection is very slow.'
        };
      } else {
        return {
          success: false,
          error: fetchError.message || 'Failed to connect to Supabase'
        };
      }
    }
  } catch (error) {
    console.error('Supabase connection check failed:', error);
    return { 
      success: false, 
      error: error.message || 'Unknown connection error'
    };
  }
};

/**
 * Advanced test for Supabase connectivity using various methods
 * This bypasses many common issues with fetch
 */
export const advancedSupabaseTest = async () => {
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    return {
      success: false,
      error: 'Missing Supabase configuration',
      details: {
        url: !!supabaseUrl,
        key: !!supabaseKey
      }
    };
  }
  
  const results = {
    methods: {},
    success: false,
    error: null
  };
  
  // Method 1: Standard fetch with timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
      },
      body: JSON.stringify({ email: 'test@example.com', password: 'password' }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    results.methods.standardFetch = {
      success: true,
      status: response.status,
      statusText: response.statusText
    };
  } catch (error) {
    results.methods.standardFetch = {
      success: false,
      error: error.message,
      aborted: error.name === 'AbortError'
    };
  }
  
  // Method 2: XMLHttpRequest
  try {
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', `${supabaseUrl}/auth/v1/health`, true);
      xhr.setRequestHeader('apikey', supabaseKey);
      xhr.timeout = 5000;
      
      xhr.onload = function() {
        results.methods.xhr = {
          success: true,
          status: xhr.status,
          statusText: xhr.statusText,
          response: xhr.responseText
        };
        resolve();
      };
      
      xhr.onerror = function() {
        results.methods.xhr = {
          success: false,
          error: 'Network error occurred',
          status: xhr.status
        };
        resolve(); // Still resolve to continue testing
      };
      
      xhr.ontimeout = function() {
        results.methods.xhr = {
          success: false,
          error: 'Request timed out'
        };
        resolve(); // Still resolve to continue testing
      };
      
      xhr.send();
    });
    
    // Add a third method: POST to auth token endpoint
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${supabaseUrl}/auth/v1/token?grant_type=password`, true);
      xhr.setRequestHeader('apikey', supabaseKey);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.timeout = 5000;
      
      xhr.onload = function() {
        results.methods.xhrPost = {
          success: true,
          status: xhr.status,
          statusText: xhr.statusText
        };
        resolve();
      };
      
      xhr.onerror = function() {
        results.methods.xhrPost = {
          success: false,
          error: 'Network error occurred',
          status: xhr.status
        };
        resolve();
      };
      
      xhr.ontimeout = function() {
        results.methods.xhrPost = {
          success: false,
          error: 'Request timed out'
        };
        resolve();
      };
      
      xhr.send(JSON.stringify({ email: 'test@example.com', password: 'password' }));
    });
  } catch (error) {
    results.methods.xhr = {
      success: false,
      error: error.message
    };
  }
  
  // Analyze results
  const anyMethodSucceeded = Object.values(results.methods).some(method => method.success);
  results.success = anyMethodSucceeded;
  
  if (!anyMethodSucceeded) {
    results.error = 'All connection methods failed';
  }
  
  return results;
};

/**
 * Check specifically for CORS issues with Supabase
 * @returns {Promise<Object>} Results of the CORS test
 */
export const checkForCORSIssues = async () => {
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    return {
      success: false,
      error: 'Missing Supabase configuration',
    };
  }
  
  try {
    // Test a simple preflight request
    const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
      method: 'OPTIONS',
      headers: {
        'apikey': supabaseKey,
        'Origin': window.location.origin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type, apikey'
      }
    });
    
    if (response.ok) {
      return {
        success: true,
        message: 'CORS preflight check passed',
        status: response.status
      };
    } else {
      return {
        success: false,
        error: 'CORS preflight check failed',
        status: response.status,
        statusText: response.statusText
      };
    }
  } catch (error) {
    console.error('CORS check error:', error);
    return {
      success: false,
      error: error.message || 'Unknown CORS error',
      isCORSError: error instanceof TypeError && error.message.includes('CORS')
    };
  }
}; 