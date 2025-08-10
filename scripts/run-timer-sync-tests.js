#!/usr/bin/env node

/**
 * Timer-Task Synchronization Bug Detection Test Runner
 * 
 * This script provides an easy way to run the comprehensive timer-task
 * synchronization tests that expose critical bugs in the Pomodoro application.
 * 
 * Usage:
 *   node scripts/run-timer-sync-tests.js [options]
 * 
 * Options:
 *   --all               Run all timer-sync tests
 *   --core              Run core synchronization tests
 *   --network           Run network interruption tests  
 *   --multi-device      Run multi-device sync tests
 *   --work-session      Run work session tracking tests
 *   --watch             Run in watch mode for development
 *   --verbose           Show verbose output
 *   --debug             Show debug information
 *   --bail              Stop on first failure
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Test configuration
const TESTS_DIR = 'src/__tests__/timer-task-sync';
const TEST_FILES = {
  core: 'timer-task-sync.test.ts',
  network: 'network-interruption.test.ts', 
  multiDevice: 'multi-device-sync.test.ts',
  workSession: 'work-session-tracking.test.ts'
};

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  all: args.includes('--all'),
  core: args.includes('--core'),
  network: args.includes('--network'),
  multiDevice: args.includes('--multi-device'),
  workSession: args.includes('--work-session'),
  watch: args.includes('--watch'),
  verbose: args.includes('--verbose'),
  debug: args.includes('--debug'),
  bail: args.includes('--bail')
};

// Default to all tests if no specific test specified
if (!options.core && !options.network && !options.multiDevice && !options.workSession) {
  options.all = true;
}

console.log('🔍 Timer-Task Synchronization Bug Detection Tests');
console.log('================================================');

// Check if test directory exists
const testsPath = path.join(process.cwd(), TESTS_DIR);
if (!fs.existsSync(testsPath)) {
  console.error(`❌ Test directory not found: ${testsPath}`);
  console.error('Please ensure you have created the timer-task-sync tests.');
  process.exit(1);
}

// Determine which tests to run
const testsToRun = [];
if (options.all) {
  testsToRun.push(...Object.values(TEST_FILES));
} else {
  if (options.core) testsToRun.push(TEST_FILES.core);
  if (options.network) testsToRun.push(TEST_FILES.network);
  if (options.multiDevice) testsToRun.push(TEST_FILES.multiDevice);
  if (options.workSession) testsToRun.push(TEST_FILES.workSession);
}

// Build Jest command
const jestArgs = [];

// Test files
testsToRun.forEach(testFile => {
  jestArgs.push(path.join(TESTS_DIR, testFile));
});

// Jest options
if (options.watch) jestArgs.push('--watch');
if (options.verbose) jestArgs.push('--verbose');
if (options.bail) jestArgs.push('--bail=1');

// Use custom Jest config if it exists
const jestConfigPath = path.join(TESTS_DIR, 'jest.config.js');
if (fs.existsSync(jestConfigPath)) {
  jestArgs.push('--config', jestConfigPath);
}

// Add timeout for complex sync tests
jestArgs.push('--testTimeout=30000');

// Environment setup
const env = {
  ...process.env,
  NODE_ENV: 'test',
  JEST_ENVIRONMENT: 'jsdom'
};

if (options.debug) {
  console.log('🔧 Debug Information:');
  console.log(`Tests Directory: ${testsPath}`);
  console.log(`Tests to Run: ${testsToRun.join(', ')}`);
  console.log(`Jest Args: ${jestArgs.join(' ')}`);
  console.log('');
}

console.log(`📋 Running ${testsToRun.length} test file(s):`);
testsToRun.forEach(test => {
  console.log(`  ✓ ${test}`);
});
console.log('');

// Check if Jest is available
const hasJest = fs.existsSync(path.join(process.cwd(), 'node_modules', '.bin', 'jest'));
if (!hasJest) {
  console.error('❌ Jest not found. Please install Jest:');
  console.error('npm install --save-dev jest @testing-library/react @testing-library/jest-dom ts-jest');
  process.exit(1);
}

// Run Jest
const jestPath = path.join(process.cwd(), 'node_modules', '.bin', 'jest');
const jestProcess = spawn(jestPath, jestArgs, {
  stdio: 'inherit',
  env: env,
  cwd: process.cwd()
});

// Handle process events
jestProcess.on('close', (code) => {
  console.log('');
  
  if (code === 0) {
    console.log('✅ Timer-Task Sync Tests Completed Successfully!');
    console.log('');
    console.log('🎯 Next Steps:');
    console.log('  • Review any failing tests - they indicate ACTUAL bugs');
    console.log('  • Check console output for specific bug scenarios detected');
    console.log('  • Use --debug flag for more detailed information');
    console.log('  • Run individual test categories with --core, --network, etc.');
  } else {
    console.log('🔴 Timer-Task Sync Tests Found Issues!');
    console.log('');
    console.log('💡 What This Means:');
    console.log('  • FAILING tests indicate ACTUAL synchronization bugs');
    console.log('  • These are the exact issues causing timeSpent not to update');
    console.log('  • Review the specific test failures for bug details');
    console.log('');
    console.log('🛠 Debugging Tips:');
    console.log('  • Run with --verbose for detailed output');
    console.log('  • Run with --bail to stop on first failure');
    console.log('  • Check specific test categories individually');
    console.log('  • Look for "CRITICAL BUG DETECTED" messages in output');
  }
  
  process.exit(code);
});

jestProcess.on('error', (error) => {
  console.error('❌ Error running Jest:', error.message);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Tests interrupted by user');
  jestProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Tests terminated');
  jestProcess.kill('SIGTERM');
});