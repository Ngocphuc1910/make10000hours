#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to prompt for input
const prompt = (question) => new Promise((resolve) => {
  rl.question(question, (answer) => resolve(answer));
});

async function updateEnvironmentFile() {
  console.log('\n===== Environment Variable Configuration =====\n');
  
  // Determine which environment to update
  const env = await prompt(
    'Which environment do you want to update? (local, development, production): '
  );
  
  let envFile;
  switch (env.toLowerCase()) {
    case 'local':
      envFile = 'config/env/.env.local';
      break;
    case 'development':
      envFile = 'config/env/.env.development.local';
      break;
    case 'production':
      envFile = 'config/env/.env.production';
      break;
    default:
      console.log('Invalid environment. Using .env.local');
      envFile = 'config/env/.env.local';
  }
  
  // Check if file exists, if not, create from example
  if (!fs.existsSync(envFile) && fs.existsSync('config/env/.env.example')) {
    const exampleContent = fs.readFileSync('config/env/.env.example', 'utf8');
    fs.writeFileSync(envFile, exampleContent);
    console.log(`Created ${envFile} from example template`);
  } else if (!fs.existsSync(envFile)) {
    fs.writeFileSync(envFile, '# Environment variables\n');
    console.log(`Created empty ${envFile}`);
  }
  
  // Read current content
  let envContent = fs.readFileSync(envFile, 'utf8');
  
  // Get Supabase URL
  const currentUrl = envContent.match(/REACT_APP_SUPABASE_URL=(.+)/);
  const defaultUrl = currentUrl ? currentUrl[1] : 'https://your-project-id.supabase.co';
  
  const supabaseUrl = await prompt(
    `Enter Supabase URL [${defaultUrl}]: `
  );
  
  // Get Supabase Key
  const currentKey = envContent.match(/REACT_APP_SUPABASE_ANON_KEY=(.+)/);
  const defaultKey = currentKey ? currentKey[1] : 'your-anon-key';
  
  const supabaseKey = await prompt(
    `Enter Supabase Anon Key [${defaultKey}]: `
  );
  
  // Update content
  envContent = envContent.replace(
    /REACT_APP_SUPABASE_URL=.*/,
    `REACT_APP_SUPABASE_URL=${supabaseUrl || defaultUrl}`
  );
  
  envContent = envContent.replace(
    /REACT_APP_SUPABASE_ANON_KEY=.*/,
    `REACT_APP_SUPABASE_ANON_KEY=${supabaseKey || defaultKey}`
  );
  
  // Write updated content
  fs.writeFileSync(envFile, envContent);
  console.log(`\nUpdated ${envFile} successfully!\n`);
  
  // Create symlink if it doesn't exist
  const rootEnvFile = path.basename(envFile);
  if (!fs.existsSync(rootEnvFile)) {
    try {
      const relativeDestPath = path.relative(path.dirname(rootEnvFile), envFile);
      fs.symlinkSync(relativeDestPath, rootEnvFile);
      console.log(`Created symlink: ${rootEnvFile} -> ${relativeDestPath}\n`);
    } catch (err) {
      console.log(`Note: Could not create symlink in root directory. Error: ${err.message}\n`);
    }
  }
  
  console.log('Configuration complete! You may need to restart your development server.');
  rl.close();
}

updateEnvironmentFile();
