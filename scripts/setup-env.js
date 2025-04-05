#!/usr/bin/env node

/**
 * This script guides users to set up their Supabase environment variables
 * for development and production use.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to prompt for input
const promptUser = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
};

// Main function
const main = async () => {
  console.log('=== Supabase Environment Setup ===');
  console.log('This script will help you set up Supabase environment variables for your project.');
  console.log('You will need your Supabase project URL and anon key from the Supabase dashboard.');
  console.log('');
  console.log('If you don\'t have these yet:');
  console.log('1. Go to https://supabase.com/dashboard');
  console.log('2. Create or select your project');
  console.log('3. Go to Settings > API');
  console.log('4. Copy the URL and anon key');
  console.log('');

  // Get Supabase credentials
  const supabaseUrl = await promptUser('Enter your Supabase URL: ');
  const supabaseAnonKey = await promptUser('Enter your Supabase anon key: ');

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Both Supabase URL and anon key are required. Exiting.');
    rl.close();
    return;
  }

  // Create/update .env file
  const envPath = path.join(process.cwd(), '.env');
  const envContent = `# Supabase credentials
REACT_APP_SUPABASE_URL=${supabaseUrl}
REACT_APP_SUPABASE_ANON_KEY=${supabaseAnonKey}
`;

  fs.writeFileSync(envPath, envContent);
  console.log('\nEnvironment variables updated in .env');

  // Create/update .env.development.local file
  const envDevPath = path.join(process.cwd(), '.env.development.local');
  fs.writeFileSync(envDevPath, envContent);
  console.log('Environment variables updated in .env.development.local');

  console.log('\nSetup complete! Your app should now be able to connect to Supabase.');
  console.log('You can start your React app with: npm start');

  rl.close();
};

// Run the script
main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
}); 