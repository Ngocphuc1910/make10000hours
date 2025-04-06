const fs = require('fs');

// List of files to remove
const filesToRemove = [
  'test-session-task.js',
  'test-full-session-workflow.js',
  'test-session-direct.js',
  'test-get-tasks.js',
  'test-service-role.js',
  'test-direct.js',
  'test-simple.js',
  'src/test-supabase-connection.js'
];

// Remove each file if it exists
for (const file of filesToRemove) {
  if (fs.existsSync(file)) {
    try {
      fs.unlinkSync(file);
      console.log(`Removed file: ${file}`);
    } catch (error) {
      console.error(`Error removing file ${file}:`, error);
    }
  } else {
    console.log(`File already removed or not found: ${file}`);
  }
}

console.log('Cleanup of old test files complete!'); 