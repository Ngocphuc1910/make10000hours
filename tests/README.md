# Tests Directory

This directory contains test files for the Pomodoro application, organized into the following directories:

## Directory Structure

- `integration/`: Tests that interact with external systems (like Supabase)
- `unit/`: Tests for individual units of code
- `utils/`: Utility tests and connection tests

## Running Tests

You can run the tests using the following NPM scripts:

```bash
# Run a specific test suite
npm run test:integration    # Run the direct integration test
npm run test:session        # Run session task-specific tests
npm run test:workflow       # Run full session workflow test
npm run test:utils          # Run Supabase connection test

# Run all tests
npm run test:all
```

## Adding New Tests

When adding new test files:

1. Place them in the appropriate directory
2. Use the `.test.js` extension
3. Update the script in `package.json` if needed

## Test File Naming

- Integration tests: `feature-name.test.js`
- Unit tests: `component-name.test.js`
- Utility tests: `utility-name.test.js` 