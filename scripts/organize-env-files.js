const fs = require('fs');
const path = require('path');

// Configuration
const filesToMove = [
  { source: '.env', destination: 'config/env/.env' },
  { source: '.env.local', destination: 'config/env/.env.local' },
  { source: '.env.example', destination: 'config/env/.env.example' },
  { source: '.env.production', destination: 'config/env/.env.production' },
  { source: '.env.development.local.backup', destination: 'config/env/.env.development.local.backup' }
];

// Create directory if it doesn't exist
const envDir = 'config/env';
if (!fs.existsSync(envDir)) {
  fs.mkdirSync(envDir, { recursive: true });
  console.log(`Created directory: ${envDir}`);
}

// Process each file
for (const { source, destination } of filesToMove) {
  if (!fs.existsSync(source)) {
    console.log(`Source file not found: ${source}`);
    continue;
  }

  try {
    // Read the file content
    const content = fs.readFileSync(source, 'utf8');
    
    // Create symlink in the original location pointing to the new file
    fs.writeFileSync(destination, content);
    console.log(`Copied: ${source} -> ${destination}`);
    
    // Create a backup of the original file
    const backupPath = `${source}.bak`;
    fs.writeFileSync(backupPath, content);
    console.log(`Created backup: ${backupPath}`);
    
    // Now create a symlink from the original location to the new one
    // First, remove the original file
    fs.unlinkSync(source);
    
    // Create the symlink - use relative paths for portability
    const relativeDestPath = path.relative(path.dirname(source), destination);
    fs.symlinkSync(relativeDestPath, source);
    console.log(`Created symlink: ${source} -> ${relativeDestPath}`);
  } catch (error) {
    console.error(`Error processing file ${source}:`, error.message);
  }
}

// Create a README for the env directory
const readmeContent = `# Environment Configuration Files

This directory contains environment configuration files for the project.

## Files

- \`.env\`: Default environment variables for all environments
- \`.env.local\`: Local environment variables that override the defaults (not committed to git)
- \`.env.production\`: Production-specific environment variables
- \`.env.example\`: Example environment file with placeholder values for documentation
- \`.env.development.local.backup\`: Backup of development environment variables

## Usage

The environment files are structured according to the Create React App environment variables system:

1. \`.env\`: Default values for all environments
2. \`.env.development\` or \`.env.production\`: Environment-specific values
3. \`.env.local\`: Local overrides for default values (not tracked in Git)
4. \`.env.development.local\` or \`.env.production.local\`: Local overrides for environment-specific values

## Important Note

These files contain sensitive information like API keys. Make sure that:

1. Files with actual credentials are listed in \`.gitignore\`
2. Only example files without real credentials are committed to the repository
3. Follow the secure practices described in the project documentation

## Symlinks

The original environment files in the project root are symlinks pointing to these files. This organization keeps the root directory clean while maintaining compatibility with tools that expect the files in the root.
`;

fs.writeFileSync(`${envDir}/README.md`, readmeContent);
console.log(`Created README for environment files: ${envDir}/README.md`);

// Update .gitignore to ensure that sensitive env files are not committed
const gitignorePath = '.gitignore';
if (fs.existsSync(gitignorePath)) {
  let gitignore = fs.readFileSync(gitignorePath, 'utf8');
  
  // Add entries for the new locations if they don't exist
  const newEntries = [
    'config/env/.env.local',
    'config/env/.env.*.local',
    'config/env/.env.development.local',
    'config/env/.env.test.local',
    'config/env/.env.production.local'
  ];
  
  let updated = false;
  for (const entry of newEntries) {
    if (!gitignore.includes(entry)) {
      gitignore += `\n${entry}`;
      updated = true;
    }
  }
  
  if (updated) {
    fs.writeFileSync(gitignorePath, gitignore);
    console.log('Updated .gitignore with new environment file paths');
  }
}

// Create an update script to help users update environment variables
const updateEnvScriptContent = `#!/usr/bin/env node
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
  console.log('\\n===== Environment Variable Configuration =====\\n');
  
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
    console.log(\`Created \${envFile} from example template\`);
  } else if (!fs.existsSync(envFile)) {
    fs.writeFileSync(envFile, '# Environment variables\\n');
    console.log(\`Created empty \${envFile}\`);
  }
  
  // Read current content
  let envContent = fs.readFileSync(envFile, 'utf8');
  
  // Get Supabase URL
  const currentUrl = envContent.match(/REACT_APP_SUPABASE_URL=(.+)/);
  const defaultUrl = currentUrl ? currentUrl[1] : 'https://your-project-id.supabase.co';
  
  const supabaseUrl = await prompt(
    \`Enter Supabase URL [\${defaultUrl}]: \`
  );
  
  // Get Supabase Key
  const currentKey = envContent.match(/REACT_APP_SUPABASE_ANON_KEY=(.+)/);
  const defaultKey = currentKey ? currentKey[1] : 'your-anon-key';
  
  const supabaseKey = await prompt(
    \`Enter Supabase Anon Key [\${defaultKey}]: \`
  );
  
  // Update content
  envContent = envContent.replace(
    /REACT_APP_SUPABASE_URL=.*/,
    \`REACT_APP_SUPABASE_URL=\${supabaseUrl || defaultUrl}\`
  );
  
  envContent = envContent.replace(
    /REACT_APP_SUPABASE_ANON_KEY=.*/,
    \`REACT_APP_SUPABASE_ANON_KEY=\${supabaseKey || defaultKey}\`
  );
  
  // Write updated content
  fs.writeFileSync(envFile, envContent);
  console.log(\`\\nUpdated \${envFile} successfully!\\n\`);
  
  // Create symlink if it doesn't exist
  const rootEnvFile = path.basename(envFile);
  if (!fs.existsSync(rootEnvFile)) {
    try {
      const relativeDestPath = path.relative(path.dirname(rootEnvFile), envFile);
      fs.symlinkSync(relativeDestPath, rootEnvFile);
      console.log(\`Created symlink: \${rootEnvFile} -> \${relativeDestPath}\\n\`);
    } catch (err) {
      console.log(\`Note: Could not create symlink in root directory. Error: \${err.message}\\n\`);
    }
  }
  
  console.log('Configuration complete! You may need to restart your development server.');
  rl.close();
}

updateEnvironmentFile();
`;

fs.writeFileSync('scripts/update-env.js', updateEnvScriptContent);
console.log('Created environment update script: scripts/update-env.js');

// Update package.json with new scripts
const packageJsonPath = 'package.json';
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  // Add env configuration scripts
  packageJson.scripts = {
    ...packageJson.scripts,
    "env:update": "node scripts/update-env.js",
    "env:local": "node -e \"require('fs').copyFileSync('config/env/.env.local', '.env.local'); console.log('.env.local updated')\""
  };
  
  // Write updated package.json
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('Updated package.json with new environment configuration scripts');
}

console.log('\nEnvironment files organization complete!'); 