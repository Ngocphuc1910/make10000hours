#!/usr/bin/env node

/**
 * This script sets up your .env.local file with Supabase credentials
 * for your existing project.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Project ID from your Supabase project (visible in the URL)
const PROJECT_ID = 'ccxhdmyfmfwincvzqjhg';
const PROJECT_NAME = 'Make10000hours';

// Function to run a command and return its output
const runCommand = (command) => {
  try {
    return execSync(command, { encoding: 'utf-8' });
  } catch (error) {
    console.error(`Error executing command: ${command}`);
    console.error(error.message);
    return null;
  }
};

// Main function
const main = () => {
  console.log(`=== Setting up Supabase credentials for ${PROJECT_NAME} ===`);
  
  // Get project API keys
  console.log('\nFetching project API keys...');
  
  try {
    const apiKeysCmd = `npx supabase projects api-keys --project-ref "${PROJECT_ID}"`;
    const apiKeysOutput = runCommand(apiKeysCmd);
    
    if (!apiKeysOutput) {
      throw new Error('Failed to fetch API keys');
    }
    
    // Extract anon key from output
    const anonKeyMatch = apiKeysOutput.match(/anon key:\s+(.+)/i);
    
    if (!anonKeyMatch || !anonKeyMatch[1]) {
      throw new Error('Could not find anon key in output');
    }
    
    const anon_key = anonKeyMatch[1].trim();
    const projectUrl = `https://${PROJECT_ID}.supabase.co`;
    
    // Update .env.local file
    console.log('\nUpdating .env.local file with your credentials...');
    
    const envPath = path.join(process.cwd(), '.env.local');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
    }
    
    // Replace or add Supabase credentials
    const newEnvContent = `# Local Supabase credentials - Updated on ${new Date().toISOString()}
REACT_APP_SUPABASE_URL=${projectUrl}
REACT_APP_SUPABASE_ANON_KEY=${anon_key}`;
    
    fs.writeFileSync(envPath, newEnvContent);
    
    console.log('\nEnvironment variables updated successfully in .env.local!');
    console.log(`\nYour app is now configured to use the Supabase project: ${PROJECT_NAME}`);
    console.log('You can start your React app with: npm start');
    
  } catch (error) {
    console.error('Error setting up environment:', error.message);
    process.exit(1);
  }
};

// Run the script
main(); 