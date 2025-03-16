#!/usr/bin/env node

/**
 * This script copies the SQL schema to the clipboard so you can paste it
 * into the Supabase SQL editor.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const main = () => {
  console.log('=== Copying Supabase Schema to Clipboard ===');
  
  const sqlPath = path.join(__dirname, 'supabase', 'migrations', '20240316_initial_schema.sql');
  
  if (!fs.existsSync(sqlPath)) {
    console.error(`SQL file not found at: ${sqlPath}`);
    process.exit(1);
  }
  
  try {
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
    
    // Use pbcopy on Mac to copy to clipboard
    execSync('pbcopy', { input: sqlContent });
    
    console.log('\nSQL schema has been copied to your clipboard!');
    console.log('\nPlease follow these steps to set up your database:');
    console.log('1. Open the Supabase SQL Editor for your project at:');
    console.log('   https://supabase.com/dashboard/project/ccxhdmyfmfwincvzqjhg/sql/new');
    console.log('2. Paste the SQL schema from your clipboard');
    console.log('3. Run the SQL to create your database schema');
    
  } catch (error) {
    console.error('Error copying schema:', error.message);
    process.exit(1);
  }
};

main(); 