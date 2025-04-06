const fs = require('fs');

// List of files to remove
const filesToRemove = [
  'list-tasks.js',
  'list-tasks-browser.js',
  'get-user-tasks.js',
  'list-users.js',
  'list-users-browser.js'
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

console.log('Cleanup of original utility files complete!');
