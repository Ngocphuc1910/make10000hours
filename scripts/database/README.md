# Database Utility Scripts

This directory contains scripts for interacting with the Supabase database for debugging and maintenance purposes.

## Structure

- `tasks/`: Scripts for managing and listing tasks
  - `list-tasks.js`: Node.js script to list all tasks in the database
  - `list-tasks-browser.js`: Browser script to list tasks for current user
  - `get-user-tasks.js`: Node.js script to get tasks for a specific user

- `users/`: Scripts for managing and listing users
  - `list-users.js`: Node.js script to list all users in the database
  - `list-users-browser.js`: Browser script to list users

## Running the Scripts

### Node.js Scripts

You can run the Node.js scripts using npm:

```bash
npm run db:list-tasks
npm run db:list-users
npm run db:get-user-tasks
```

Or directly with Node:

```bash
node scripts/database/tasks/list-tasks.js
node scripts/database/users/list-users.js
```

### Browser Scripts

To use the browser scripts:

1. Log in to the application
2. Open the browser's developer console (F12 or right-click > Inspect)
3. Copy the content of the script and paste it in the console
4. Press Enter to execute

Note: The browser scripts rely on the application being loaded and a user being logged in.
