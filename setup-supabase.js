#!/usr/bin/env node

/**
 * This script helps set up a Supabase project by:
 * 1. Checking if you have an access token (or asking you to get one)
 * 2. Listing your existing Supabase projects
 * 3. Either selecting an existing project or creating a new one
 * 4. Setting up the database schema
 * 5. Updating your .env file with the credentials
 */

const { execSync } = require('child_process');
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
const main = async () => {
  console.log('=== Supabase Setup Script ===');
  
  // Check if Supabase CLI is installed
  let supabaseCLI = runCommand('npx supabase --version');
  if (!supabaseCLI) {
    console.log('Supabase CLI is not installed. Installing...');
    runCommand('npm install -g supabase');
  }
  
  // Check if user has a Supabase access token
  console.log('\nChecking for Supabase access token...');
  
  // Instruct user to get a token if they don't have one
  console.log(`
To use this script, you need a Supabase access token.
If you don't have one, follow these steps:

1. Go to https://supabase.com/dashboard/account/tokens
2. Generate a new access token
3. Copy the token for use in the next step
  `);
  
  const token = await promptUser('Enter your Supabase access token: ');
  if (!token) {
    console.error('No token provided. Exiting.');
    rl.close();
    return;
  }
  
  // Save token for Supabase CLI
  runCommand(`npx supabase login "${token}"`);
  
  // List existing projects or create a new one
  console.log('\nFetching your Supabase projects...');
  
  const projects = JSON.parse(runCommand('npx supabase projects list --json') || '[]');
  
  if (projects && projects.length > 0) {
    console.log('\nExisting projects:');
    projects.forEach((project, index) => {
      console.log(`${index + 1}. ${project.name} (${project.id})`);
    });
    
    console.log('\nOptions:');
    console.log('- Enter a number to select an existing project');
    console.log('- Enter "new" to create a new project');
    
    const choice = await promptUser('Your choice: ');
    
    let selectedProject;
    
    if (choice.toLowerCase() === 'new') {
      // Create new project
      const projectName = await promptUser('Enter a name for your new project: ');
      const orgId = await promptUser('Enter your organization ID (from Supabase dashboard): ');
      const dbPassword = await promptUser('Create a database password: ');
      const region = await promptUser('Enter region (e.g., us-east-1): ');
      
      console.log(`\nCreating new project: ${projectName}...`);
      const createOutput = runCommand(`npx supabase projects create "${projectName}" --org-id "${orgId}" --db-password "${dbPassword}" --region "${region}"`);
      
      // Extract project info
      const projectInfo = JSON.parse(createOutput || '{}');
      selectedProject = projectInfo;
    } else {
      // Use existing project
      const index = parseInt(choice) - 1;
      if (isNaN(index) || index < 0 || index >= projects.length) {
        console.error('Invalid selection. Exiting.');
        rl.close();
        return;
      }
      
      selectedProject = projects[index];
    }
    
    if (selectedProject) {
      console.log(`\nSelected project: ${selectedProject.name} (${selectedProject.id})`);
      
      // Get project API keys
      console.log('\nFetching project API keys...');
      const apiKeys = JSON.parse(runCommand(`npx supabase projects api-keys --project-ref "${selectedProject.id}" --json`) || '{}');
      
      const anon_key = apiKeys?.anon_key;
      const projectUrl = `https://${selectedProject.id}.supabase.co`;
      
      if (anon_key) {
        // Update .env file
        console.log('\nUpdating .env file...');
        
        const envPath = path.join(process.cwd(), '.env');
        let envContent = '';
        
        if (fs.existsSync(envPath)) {
          envContent = fs.readFileSync(envPath, 'utf-8');
        }
        
        // Replace or add Supabase credentials
        envContent = envContent
          .replace(/REACT_APP_SUPABASE_URL=.*$/m, `REACT_APP_SUPABASE_URL=${projectUrl}`)
          .replace(/REACT_APP_SUPABASE_ANON_KEY=.*$/m, `REACT_APP_SUPABASE_ANON_KEY=${anon_key}`);
        
        // If the variables don't exist, add them
        if (!envContent.includes('REACT_APP_SUPABASE_URL')) {
          envContent += `\nREACT_APP_SUPABASE_URL=${projectUrl}`;
        }
        
        if (!envContent.includes('REACT_APP_SUPABASE_ANON_KEY')) {
          envContent += `\nREACT_APP_SUPABASE_ANON_KEY=${anon_key}`;
        }
        
        fs.writeFileSync(envPath, envContent);
        
        console.log('\nEnvironment variables updated successfully!');
        
        // Provide SQL migration instructions
        console.log('\nNext steps:');
        console.log('1. Go to https://supabase.com/dashboard/project/' + selectedProject.id + '/sql/new');
        console.log('2. Copy the contents of ./supabase/migrations/20240316_initial_schema.sql');
        console.log('3. Paste into the SQL editor and run the query to set up your database schema');
        
        console.log('\nSupabase setup complete! Your app is now connected to Supabase.');
      } else {
        console.error('Could not retrieve API keys. Please set up manually.');
      }
    }
  } else {
    console.error('No projects found or error fetching projects.');
  }
  
  rl.close();
};

// Run the script
main().catch(error => {
  console.error('An error occurred:', error);
  rl.close();
}); 