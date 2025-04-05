#!/usr/bin/env node

/**
 * This script generates TypeScript types from your Supabase database schema
 * It requires a valid REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in .env.local
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY must be set in .env.local');
  process.exit(1);
}

console.log('Generating TypeScript types from Supabase schema...');

// Create directory for types if it doesn't exist
const typesDir = path.join(__dirname, 'src', 'types');
if (!fs.existsSync(typesDir)) {
  fs.mkdirSync(typesDir, { recursive: true });
}

try {
  // Run npx supabase to generate types
  const output = execSync(
    `npx supabase gen types typescript --project-id "${supabaseUrl.replace('https://', '').replace('.supabase.co', '')}" --schema public > src/types/supabase.ts`,
    { encoding: 'utf-8' }
  );
  
  console.log('TypeScript types generated successfully at src/types/supabase.ts');
} catch (error) {
  console.error('Error generating types:', error.message);
  process.exit(1);
} 