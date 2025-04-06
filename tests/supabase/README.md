# Supabase Integration Tests

This directory contains manual test scripts for Supabase database integration. These tests can be run directly with Node.js to verify Supabase connection and functionality.

## Available Tests

- `test-direct.js` - Tests direct task creation in Supabase
- `test-service-role.js` - Tests operations using the service role
- `test-session-direct.js` - Tests session-related operations directly
- `test-session-task.js` - Tests session task functionality
- `test-get-tasks.js` - Tests retrieving tasks from the database
- `test-full-session-workflow.js` - Tests the complete workflow for session tasks
- `test-simple.js` - Simple test template

## Running Tests

To run a test, use Node.js from the project root:

```bash
node tests/supabase/test-direct.js
```

## Notes

- These tests use direct Supabase connections and may affect your development database
- They are intended for development and debugging purposes
- Use with caution in production environments 