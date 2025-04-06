
const fs = require('fs');
const path = require('path');

// Files to keep in sync
const envFiles = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  '.env.test'
];

// Directory where main env files are stored
const envDir = 'config/env';

// Process each file
for (const file of envFiles) {
  try {
    const rootPath = file;
    const envDirPath = path.join(envDir, file);

    // Skip if neither file exists
    if (!fs.existsSync(rootPath) && !fs.existsSync(envDirPath)) {
      continue;
    }

    // If root file is newer, copy to env dir
    if (fs.existsSync(rootPath)) {
      if (!fs.existsSync(envDirPath) || 
          fs.statSync(rootPath).mtime > fs.statSync(envDirPath).mtime) {
        console.log(`Copying newer file from root to env dir: ${rootPath} -> ${envDirPath}`);
        fs.copyFileSync(rootPath, envDirPath);
      }
    }

    // If env dir file is newer, copy to root
    if (fs.existsSync(envDirPath)) {
      if (!fs.existsSync(rootPath) || 
          fs.statSync(envDirPath).mtime > fs.statSync(rootPath).mtime) {
        console.log(`Copying newer file from env dir to root: ${envDirPath} -> ${rootPath}`);
        fs.copyFileSync(envDirPath, rootPath);
      }
    }
  } catch (error) {
    console.error(`Error processing ${file}:`, error.message);
  }
}

console.log('Environment files synchronized successfully!');
