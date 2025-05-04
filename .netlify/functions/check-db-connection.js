// Netlify serverless function to check database connection
const { createClient } = require('@supabase/supabase-js');

exports.handler = async function(event, context) {
  // Set CORS headers for preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: ''
    };
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://ccxhdmyfmfwincvzqjhg.supabase.co';
    const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjeGhkbXlmbWZ3aW5jdnpxamhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIxNDAyMzIsImV4cCI6MjA1NzcxNjIzMn0.nf8fOFwXcFayteHi-HOhcxiHw4aLE7oOtWv8HeQAYjU';
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Check connection to Supabase
    const { data, error } = await supabase.from('tasks').select('*').limit(1);
    
    if (error) {
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false, 
          error: {
            message: error.message,
            code: error.code
          }
        })
      };
    }
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: true, 
        data: { 
          connected: true,
          message: "Successfully connected to Supabase",
          timestamp: new Date().toISOString()
        }
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: false, 
        error: { 
          message: error.message 
        }
      })
    };
  }
}; 