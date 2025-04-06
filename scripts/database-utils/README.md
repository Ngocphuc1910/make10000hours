# Database Utility Scripts

This directory contains utility scripts for interacting with the Supabase database. These scripts can be run both from Node.js and from the browser console.

## Node.js Scripts

Run these scripts from the project root using Node.js:

- `list-tasks.js` - Lists all tasks in the database
- `list-users.js` - Lists all users/profiles in the database
- `get-user-tasks.js` - Gets tasks for a specific user by email

Example:
```bash
node scripts/database-utils/list-users.js
```

## Browser Console Scripts

Copy and paste these scripts into your browser console when logged into the application:

- `list-tasks-browser.js` - Lists tasks for the currently logged-in user
- `list-users-browser.js` - Lists all users/profiles in the database

## Usage Notes

- Node.js scripts require the `@supabase/supabase-js` package
- Browser scripts expect to be run in an environment where `window.supabase` is already defined
- These scripts are for development and debugging purposes only
- They contain sensitive API keys and should not be exposed to users 