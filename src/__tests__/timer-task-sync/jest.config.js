/**
 * Jest Configuration for Timer-Task Synchronization Tests
 * 
 * Optimized configuration for running timer-task sync bug detection tests
 * with proper mocking, timeouts, and error reporting.
 */

module.exports = {
  // Test environment
  testEnvironment: 'jsdom',
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/timer-task-sync/test-setup.ts'],
  
  // Test matching patterns
  testMatch: [
    '<rootDir>/src/__tests__/timer-task-sync/**/*.test.ts',
    '<rootDir>/src/__tests__/timer-task-sync/**/*.test.tsx'
  ],
  
  // Module name mapping for imports
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^../../(.*)$': '<rootDir>/src/$1'
  },
  
  // Transform configuration
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx'
      }
    }]
  },
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/store/timerStore.ts',
    'src/store/taskStore.ts', 
    'src/services/transitionService.ts',
    'src/api/workSessionService.ts',
    'src/services/workSessionServiceUTC.ts'
  ],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/build/',
    '/dist/'
  ],
  
  // Module paths to ignore
  modulePathIgnorePatterns: [
    '/build/',
    '/dist/'
  ],
  
  // Timeout configuration for async operations
  testTimeout: 30000, // 30 seconds for complex sync operations
  
  // Error handling
  errorOnDeprecated: true,
  
  // Verbose output for debugging
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  
  // Global variables
  globals: {
    'ts-jest': {
      isolatedModules: true
    }
  },
  
  // Mock configuration
  clearMocks: true,
  
  // Test result processing
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './test-results',
      outputName: 'timer-sync-results.xml',
      suiteName: 'Timer-Task Synchronization Tests'
    }]
  ],
  
  // Bail configuration - stop on first failure for debugging
  // bail: 1, // Uncomment for debugging individual test failures
  
  // Max workers for parallel execution
  maxWorkers: '50%',
  
  // Watch mode configuration
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ]
};