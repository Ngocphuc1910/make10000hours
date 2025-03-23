/**
 * Supabase Setup Script
 * 
 * This script can be run to test Supabase configuration and connection.
 * Usage: node setup-supabase.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('--- Supabase Setup Helper ---');

// Check if .env file exists
const envPath = path.join(__dirname, '../../.env');
const envExamplePath = path.join(__dirname, '../../.env.example');

const createEnvFile = () => {
  try {
    // Check if .env.example exists
    if (fs.existsSync(envExamplePath)) {
      // Copy .env.example to .env if .env doesn't exist
      if (!fs.existsSync(envPath)) {
        fs.copyFileSync(envExamplePath, envPath);
        console.log('Created .env file from .env.example');
        console.log('Please edit the .env file with your actual Supabase values');
        return true;
      }
    } else {
      console.log('Warning: .env.example file not found');
      
      // Create a basic .env file
      const basicEnvContent = `# Supabase configuration
REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-goes-here
`;
      
      if (!fs.existsSync(envPath)) {
        fs.writeFileSync(envPath, basicEnvContent);
        console.log('Created a basic .env file');
        console.log('Please edit the .env file with your actual Supabase values');
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error creating .env file:', error.message);
    return false;
  }
};

// Check and parse .env file
const checkEnvFile = () => {
  try {
    if (!fs.existsSync(envPath)) {
      return { exists: false };
    }
    
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envLines = envContent.split('\n');
    
    const envVars = {};
    let hasPlaceholders = false;
    
    envLines.forEach(line => {
      // Skip comments and empty lines
      if (line.trim().startsWith('#') || !line.trim()) {
        return;
      }
      
      const [key, value] = line.split('=');
      if (key && value) {
        envVars[key.trim()] = value.trim();
        
        // Check for placeholder values
        if (
          value.includes('your-') || 
          value.includes('example') || 
          value.includes('placeholder') ||
          value === 'xxx'
        ) {
          hasPlaceholders = true;
        }
      }
    });
    
    return { 
      exists: true, 
      vars: envVars,
      hasPlaceholders,
      hasRequiredVars: 
        envVars.REACT_APP_SUPABASE_URL && 
        envVars.REACT_APP_SUPABASE_ANON_KEY
    };
  } catch (error) {
    console.error('Error reading .env file:', error.message);
    return { exists: false, error: error.message };
  }
};

// Test Supabase connection
const testSupabaseConnection = async () => {
  try {
    console.log('Testing Supabase connection...');
    
    // We need to create a temporary test file
    const testFilePath = path.join(__dirname, '../../temp-supabase-test.js');
    
    const testScript = `
    const fetch = require('node-fetch');
    
    const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
    const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Error: Missing Supabase environment variables');
      process.exit(1);
    }
    
    async function testConnection() {
      try {
        const response = await fetch(\`\${supabaseUrl}/auth/v1/health\`, {
          headers: {
            'apikey': supabaseKey
          }
        });
        
        const data = await response.json();
        console.log('Connection test result:', response.status);
        console.log('Response data:', data);
        
        if (response.ok) {
          console.log('✅ Successfully connected to Supabase!');
          return true;
        } else {
          console.error('❌ Connection failed:', data);
          return false;
        }
      } catch (error) {
        console.error('❌ Connection error:', error.message);
        return false;
      }
    }
    
    testConnection().then(success => {
      process.exit(success ? 0 : 1);
    });
    `;
    
    fs.writeFileSync(testFilePath, testScript);
    
    try {
      // Execute the test script
      execSync('node ' + testFilePath, { stdio: 'inherit' });
      console.log('Connection test completed successfully');
      return true;
    } catch (error) {
      console.error('Connection test failed');
      return false;
    } finally {
      // Clean up the temporary file
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  } catch (error) {
    console.error('Error testing Supabase connection:', error.message);
    return false;
  }
};

// Main script execution
const main = async () => {
  console.log('Checking Supabase configuration...');
  
  // Step 1: Check/create .env file
  let envCreated = false;
  
  if (!fs.existsSync(envPath)) {
    console.log('.env file not found.');
    envCreated = createEnvFile();
  }
  
  // Step 2: Check env variables
  const envCheck = checkEnvFile();
  
  if (!envCheck.exists) {
    console.error('Unable to read .env file. Please create one manually.');
    process.exit(1);
  }
  
  if (!envCheck.hasRequiredVars) {
    console.error('Required Supabase environment variables are missing.');
    console.log('Make sure your .env file contains:');
    console.log('REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co');
    console.log('REACT_APP_SUPABASE_ANON_KEY=your-anon-key');
    process.exit(1);
  }
  
  if (envCheck.hasPlaceholders) {
    console.warn('Warning: .env file contains placeholder values.');
    console.log('Please replace them with your actual Supabase values before continuing.');
    process.exit(1);
  }
  
  console.log('✅ Environment variables look good!');
  
  // Step 3: Test connection
  console.log('\nTesting connection to Supabase...');
  const connectionSuccess = await testSupabaseConnection();
  
  if (connectionSuccess) {
    console.log('\n✅ Supabase setup verified successfully!');
    console.log('You can now run the application.');
  } else {
    console.error('\n❌ Supabase connection test failed.');
    console.log('Please check your configuration and try again.');
    console.log('See docs/TROUBLESHOOTING.md for more help.');
  }
};

main().catch(error => {
  console.error('An unexpected error occurred:', error);
  process.exit(1);
}); 