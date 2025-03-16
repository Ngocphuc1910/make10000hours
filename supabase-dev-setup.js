#!/usr/bin/env node

/**
 * This script sets up a development environment with Supabase
 * It allows connecting to an existing project or creating a new one
 * and configures your local environment to use it
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
  console.log('=== Supabase Development Setup ===');
  
  // Get Supabase access token
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
        // Update .env.local file
        console.log('\nUpdating .env.local file for development...');
        
        const envPath = path.join(process.cwd(), '.env.local');
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
        
        console.log('\nEnvironment variables updated successfully in .env.local!');
        
        // Create database schema
        console.log('\nWould you like to set up the database schema now?');
        const setupDb = await promptUser('Set up database schema? (y/n): ');
        
        if (setupDb.toLowerCase() === 'y') {
          console.log('\nSetting up database schema...');
          
          // Read the SQL file
          const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '20240316_initial_schema.sql');
          
          if (fs.existsSync(sqlPath)) {
            const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
            
            // Ask user to copy the SQL content
            console.log('\nPlease follow these steps to set up your database:');
            console.log('1. Open the Supabase SQL Editor for your project at:');
            console.log(`   https://supabase.com/dashboard/project/${selectedProject.id}/sql/new`);
            console.log('2. Copy the following SQL and paste it into the editor:');
            console.log('\n-------------------SQL CONTENT-------------------');
            console.log(sqlContent);
            console.log('-------------------END SQL CONTENT-------------------\n');
            console.log('3. Run the SQL to create your database schema');
            
            await promptUser('Press Enter when you have completed these steps...');
          } else {
            console.error(`SQL file not found at: ${sqlPath}`);
          }
        }
        
        console.log('\nSupabase development setup complete!');
        console.log(`Your app is now configured to use the Supabase project: ${selectedProject.name}`);
        console.log('You can start your React app with: npm start');
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