const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const testFiles = [
  { source: 'test-session-task.js', destination: 'tests/integration/session-tasks.test.js' },
  { source: 'test-full-session-workflow.js', destination: 'tests/integration/full-session-workflow.test.js' },
  { source: 'test-session-direct.js', destination: 'tests/integration/session-direct.test.js' },
  { source: 'test-get-tasks.js', destination: 'tests/integration/get-tasks.test.js' },
  { source: 'test-service-role.js', destination: 'tests/utils/service-role.test.js' },
  { source: 'test-direct.js', destination: 'tests/integration/direct.test.js' },
  { source: 'test-simple.js', destination: 'tests/unit/simple.test.js' },
  { source: 'src/test-supabase-connection.js', destination: 'tests/utils/supabase-connection.test.js' },
];

// Make sure test directories exist
const testDirs = ['tests', 'tests/integration', 'tests/unit', 'tests/utils'];
for (const dir of testDirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

// Move files and update imports
for (const { source, destination } of testFiles) {
  if (!fs.existsSync(source)) {
    console.log(`Source file not found: ${source}`);
    continue;
  }

  // Read the file content
  let content = fs.readFileSync(source, 'utf8');

  // Update imports if moving from root to tests directory
  if (!source.startsWith('src/')) {
    // Update relative imports from './src/' to '../src/'
    content = content.replace(/from ['"]\.\/src\//g, 'from \'../src/');
    content = content.replace(/require\(['"]\.\/src\//g, 'require(\'../src/');
    
    // Update imports for local modules
    content = content.replace(/from ['"]\.\/(?!src)/g, 'from \'../../');
    content = content.replace(/require\(['"]\.\/(?!src)/g, 'require(\'../../');
  } else {
    // Update imports from src to parent directory
    content = content.replace(/from ['"]\.\.\/lib\//g, 'from \'../../src/lib/');
    content = content.replace(/require\(['"]\.\.\/lib\//g, 'require(\'../../src/lib/');
    
    content = content.replace(/from ['"]\.\.\/services\//g, 'from \'../../src/services/');
    content = content.replace(/require\(['"]\.\.\/services\//g, 'require(\'../../src/services/');
  }

  // Write updated content to destination
  fs.writeFileSync(destination, content);
  console.log(`Moved and updated: ${source} -> ${destination}`);
}

// Add npm scripts for running tests
const packageJsonPath = 'package.json';
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Add test scripts
packageJson.scripts = {
  ...packageJson.scripts,
  "test:integration": "node tests/integration/direct.test.js",
  "test:session": "node tests/integration/session-tasks.test.js",
  "test:workflow": "node tests/integration/full-session-workflow.test.js",
  "test:utils": "node tests/utils/supabase-connection.test.js",
  "test:all": "for f in tests/**/*.test.js; do echo \"Running $f\"; node $f; done"
};

// Write updated package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
console.log('Updated package.json with new test scripts');

console.log('Test reorganization complete!'); 