const fs = require('fs');
const path = require('path');

// Files to check and clean up
const envFiles = [
  '.env',
  '.env.local',
  '.env.example',
  '.env.production',
  '.env.development.local.backup'
];

// Directory where env files are stored
const envDir = 'config/env';

console.log('Simplifying environment file structure...');

// Check if the directory exists
if (!fs.existsSync(envDir)) {
  console.log(`Error: ${envDir} directory not found. No changes made.`);
  process.exit(1);
}

// Process each file
for (const file of envFiles) {
  try {
    const rootPath = file;
    const backupPath = `${file}.bak`;
    const envDirPath = path.join(envDir, file);

    // Check if root file is a symlink
    if (fs.existsSync(rootPath) && fs.lstatSync(rootPath).isSymbolicLink()) {
      console.log(`Removing symlink: ${rootPath}`);
      fs.unlinkSync(rootPath);
    } else if (fs.existsSync(rootPath)) {
      console.log(`${rootPath} is not a symlink. Keeping as is.`);
    }

    // Remove backup files if they exist
    if (fs.existsSync(backupPath)) {
      console.log(`Removing backup file: ${backupPath}`);
      fs.unlinkSync(backupPath);
    }

    // Verify env directory file exists
    if (!fs.existsSync(envDirPath)) {
      console.log(`Warning: ${envDirPath} not found. No file in target directory.`);
    } else {
      console.log(`Verified: ${envDirPath} exists.`);
    }
  } catch (error) {
    console.error(`Error processing ${file}:`, error.message);
  }
}

// Update package.json scripts to use the new locations directly
const packageJsonPath = 'package.json';
if (fs.existsSync(packageJsonPath)) {
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Update env scripts to use direct paths
    if (packageJson.scripts && packageJson.scripts["env:local"]) {
      // Remove the env:local script since we're no longer using symlinks
      delete packageJson.scripts["env:local"];
      
      // Update the start script to use the env files directly
      if (packageJson.scripts["start"]) {
        packageJson.scripts["start"] = "DOTENV_CONFIG_PATH=./config/env/.env.local react-scripts start";
      }
      
      // Update the build script to use the production env file
      if (packageJson.scripts["build"]) {
        packageJson.scripts["build"] = "DOTENV_CONFIG_PATH=./config/env/.env.production GENERATE_SOURCEMAP=false react-scripts build";
      }
      
      // Write updated package.json
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.log('Updated package.json scripts to use env files from config/env directory directly');
    }
  } catch (error) {
    console.error('Error updating package.json:', error.message);
  }
}

// Update the README.md to explain the simplified structure
const readmePath = `${envDir}/README.md`;
if (fs.existsSync(readmePath)) {
  try {
    let readmeContent = fs.readFileSync(readmePath, 'utf8');
    
    // Update the README to remove references to symlinks
    readmeContent = readmeContent.replace(/## Symlinks[\s\S]*?$/, 
      `## Usage with React Scripts

The environment files are now stored directly in this directory without symlinks in the root folder. To use these files:

1. When starting the development server, the path to \`.env.local\` is specified using DOTENV_CONFIG_PATH
2. For production builds, \`.env.production\` is used via DOTENV_CONFIG_PATH

This keeps your project root clean while still making the environment files accessible to the build system.`);
    
    fs.writeFileSync(readmePath, readmeContent);
    console.log('Updated environment README to reflect simplified structure');
  } catch (error) {
    console.error('Error updating README:', error.message);
  }
}

// Update the main README.md to explain the simplified structure
const mainReadmePath = 'README.md';
if (fs.existsSync(mainReadmePath)) {
  try {
    let mainReadmeContent = fs.readFileSync(mainReadmePath, 'utf8');
    
    // Find the environment configuration section and update it
    const envConfigPattern = /### Environment Configuration[\s\S]*?For more details/;
    const updatedEnvConfig = `### Environment Configuration

The project keeps environment files in a dedicated directory for better organization:

\`\`\`
config/env/
├── .env                     # Default environment variables
├── .env.local               # Local overrides (not committed to git)
├── .env.production          # Production-specific variables
├── .env.example             # Example configuration with documentation
└── .env.development.local.backup  # Backup of development variables
\`\`\`

This keeps your project root clean and organized. The application is configured to find these files in their new location.

To update your environment configuration:

\`\`\`bash
# Interactive update of environment variables
npm run env:update
\`\`\`

For more details`;
    
    mainReadmeContent = mainReadmeContent.replace(envConfigPattern, updatedEnvConfig);
    fs.writeFileSync(mainReadmePath, mainReadmeContent);
    console.log('Updated main README to reflect simplified structure');
  } catch (error) {
    console.error('Error updating main README:', error.message);
  }
}

console.log('\nEnvironment file structure has been simplified!');
console.log('All environment files are now stored only in the config/env directory.');
console.log('The build system has been configured to find them in their new location.');
console.log('\nNo more symlinks or duplicate files in the root directory!'); 