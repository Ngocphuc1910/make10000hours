/**
 * Extension Context Invalidation Fix - Test Script
 * Tests the robustness of the extension against context invalidation scenarios
 */

class ExtensionResilienceTest {
  constructor() {
    this.testResults = [];
    this.connectionManager = null;
    this.messageQueue = null;
    this.monitor = null;
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🧪 Starting Extension Resilience Tests...');
    
    // Initialize test environment
    await this.initializeTestEnvironment();
    
    // Run individual tests
    await this.testUtilitiesLoading();
    await this.testContextValidation();
    await this.testConnectionManager();
    await this.testMessageQueue();
    await this.testSafeMessaging();
    await this.testPingHandler();
    await this.testConnectionMonitor();
    await this.testRecoveryScenarios();
    
    // Display results
    this.displayTestResults();
    
    return this.testResults;
  }

  /**
   * Initialize test environment
   */
  async initializeTestEnvironment() {
    console.log('🔧 Initializing test environment...');
    
    try {
      // Wait for utilities to be available
      await this.waitForUtilities();
      
      // Initialize utilities
      if (window.ExtensionConnectionManager) {
        this.connectionManager = new window.ExtensionConnectionManager();
      }
      
      if (window.ExtensionMessageQueue && this.connectionManager) {
        this.messageQueue = new window.ExtensionMessageQueue(this.connectionManager);
      }
      
      if (window.ExtensionConnectionMonitor && this.connectionManager) {
        this.monitor = new window.ExtensionConnectionMonitor(this.connectionManager, {
          showDebugPanel: true,
          logLevel: 'debug'
        });
      }
      
      this.addTestResult('Environment Setup', true, 'Test environment initialized successfully');
      
    } catch (error) {
      this.addTestResult('Environment Setup', false, `Failed to initialize: ${error.message}`);
    }
  }

  /**
   * Wait for utilities to be available
   */
  async waitForUtilities() {
    return new Promise((resolve) => {
      if (window.ExtensionConnectionManager) {
        resolve();
        return;
      }
      
      window.addEventListener('extensionUtilitiesReady', resolve);
      
      // Fallback timeout
      setTimeout(resolve, 3000);
    });
  }

  /**
   * Test utilities loading
   */
  async testUtilitiesLoading() {
    console.log('🔍 Testing utilities loading...');
    
    try {
      const requiredUtilities = [
        'ExtensionContextValidator',
        'ExtensionConnectionManager', 
        'ExtensionMessageQueue',
        'ExtensionConnectionMonitor'
      ];
      
      const loadedUtilities = requiredUtilities.filter(util => typeof window[util] !== 'undefined');
      const allLoaded = loadedUtilities.length === requiredUtilities.length;
      
      this.addTestResult(
        'Utilities Loading',
        allLoaded,
        allLoaded 
          ? 'All utilities loaded successfully'
          : `Missing utilities: ${requiredUtilities.filter(u => !loadedUtilities.includes(u)).join(', ')}`
      );
      
    } catch (error) {
      this.addTestResult('Utilities Loading', false, `Error: ${error.message}`);
    }
  }

  /**
   * Test context validation
   */
  async testContextValidation() {
    console.log('🔍 Testing context validation...');
    
    try {
      if (!window.ExtensionContextValidator) {
        this.addTestResult('Context Validation', false, 'ExtensionContextValidator not available');
        return;
      }
      
      const validator = window.ExtensionContextValidator;
      
      // Test API availability check
      const apiAvailable = validator.isExtensionAPIAvailable();
      
      // Test context validity check
      const contextValid = validator.isContextValid();
      
      // Test status retrieval
      const status = validator.getContextStatus();
      
      const allChecksPass = apiAvailable && contextValid && status && status.extensionId;
      
      this.addTestResult(
        'Context Validation',
        allChecksPass,
        allChecksPass 
          ? 'All context validation checks passed'
          : `API: ${apiAvailable}, Context: ${contextValid}, Status: ${!!status}`
      );
      
    } catch (error) {
      this.addTestResult('Context Validation', false, `Error: ${error.message}`);
    }
  }

  /**
   * Test connection manager
   */
  async testConnectionManager() {
    console.log('🔍 Testing connection manager...');
    
    try {
      if (!this.connectionManager) {
        this.addTestResult('Connection Manager', false, 'Connection manager not initialized');
        return;
      }
      
      // Test connection check
      const isConnected = await this.connectionManager.checkConnection();
      
      // Test status retrieval
      const status = this.connectionManager.getStatus();
      
      // Test message sending
      const response = await this.connectionManager.sendMessage({
        type: 'PING',
        test: true
      }, { timeout: 5000 });
      
      const allTestsPass = isConnected && status && response && response.success;
      
      this.addTestResult(
        'Connection Manager',
        allTestsPass,
        allTestsPass 
          ? 'Connection manager working correctly'
          : `Connected: ${isConnected}, Status: ${!!status}, Response: ${!!response}`
      );
      
    } catch (error) {
      this.addTestResult('Connection Manager', false, `Error: ${error.message}`);
    }
  }

  /**
   * Test message queue
   */
  async testMessageQueue() {
    console.log('🔍 Testing message queue...');
    
    try {
      if (!this.messageQueue) {
        this.addTestResult('Message Queue', false, 'Message queue not initialized');
        return;
      }
      
      // Test message sending
      const testMessage = {
        type: 'PING',
        test: 'message_queue_test',
        timestamp: Date.now()
      };
      
      const response = await this.messageQueue.sendMessage(testMessage, {
        priority: 'normal',
        timeout: 5000
      });
      
      // Test queue status
      const status = this.messageQueue.getStatus();
      
      const testsPassed = response && response.success && status;
      
      this.addTestResult(
        'Message Queue',
        testsPassed,
        testsPassed 
          ? 'Message queue working correctly'
          : `Response: ${!!response}, Status: ${!!status}`
      );
      
    } catch (error) {
      this.addTestResult('Message Queue', false, `Error: ${error.message}`);
    }
  }

  /**
   * Test safe messaging (from content script perspective)
   */
  async testSafeMessaging() {
    console.log('🔍 Testing safe messaging...');
    
    try {
      // Simulate the safe messaging function used in content scripts
      const sendMessageSafely = async (message, options = {}) => {
        const { 
          fallback = { success: false, error: 'Extension not available' },
          priority = 'normal',
          shouldQueue = true 
        } = options;

        try {
          if (this.messageQueue) {
            return await this.messageQueue.sendMessage(message, {
              priority,
              fallback,
              shouldQueue
            });
          }

          if (this.connectionManager) {
            return await this.connectionManager.sendMessage(message, { fallback });
          }

          if (window.ExtensionContextValidator && !window.ExtensionContextValidator.isContextValid()) {
            return fallback;
          }

          // Direct Chrome API call (test fallback)
          return await this.sendMessageDirect(message);
          
        } catch (error) {
          return fallback;
        }
      };
      
      // Test with valid message
      const response = await sendMessageSafely({
        type: 'PING',
        test: 'safe_messaging_test'
      });
      
      const testPassed = response && (response.success || response.queued);
      
      this.addTestResult(
        'Safe Messaging',
        testPassed,
        testPassed 
          ? 'Safe messaging working correctly'
          : `Response: ${JSON.stringify(response)}`
      );
      
    } catch (error) {
      this.addTestResult('Safe Messaging', false, `Error: ${error.message}`);
    }
  }

  /**
   * Direct message sending (fallback method)
   */
  async sendMessageDirect(message) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Message timeout'));
      }, 5000);

      try {
        chrome.runtime.sendMessage(message, (response) => {
          clearTimeout(timeoutId);
          
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Test ping handler in background script
   */
  async testPingHandler() {
    console.log('🔍 Testing ping handler...');
    
    try {
      const startTime = Date.now();
      
      const response = await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Ping timeout'));
        }, 5000);

        chrome.runtime.sendMessage(
          { type: 'PING', timestamp: startTime },
          (response) => {
            clearTimeout(timeoutId);
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      });
      
      const responseTime = Date.now() - startTime;
      const testPassed = response && response.success && response.timestamp && responseTime < 2000;
      
      this.addTestResult(
        'Ping Handler',
        testPassed,
        testPassed 
          ? `Ping successful (${responseTime}ms)`
          : `Response: ${JSON.stringify(response)}`
      );
      
    } catch (error) {
      this.addTestResult('Ping Handler', false, `Error: ${error.message}`);
    }
  }

  /**
   * Test connection monitor
   */
  async testConnectionMonitor() {
    console.log('🔍 Testing connection monitor...');
    
    try {
      if (!this.monitor) {
        this.addTestResult('Connection Monitor', false, 'Connection monitor not initialized');
        return;
      }
      
      // Test status retrieval
      const status = this.monitor.getStatus();
      
      // Test health check
      await this.monitor.performHealthCheck();
      
      // Check if status indicator is created
      const statusIndicator = document.getElementById('extension-status-indicator');
      
      const testsPassed = status && statusIndicator;
      
      this.addTestResult(
        'Connection Monitor',
        testsPassed,
        testsPassed 
          ? 'Connection monitor working correctly'
          : `Status: ${!!status}, Indicator: ${!!statusIndicator}`
      );
      
    } catch (error) {
      this.addTestResult('Connection Monitor', false, `Error: ${error.message}`);
    }
  }

  /**
   * Test recovery scenarios
   */
  async testRecoveryScenarios() {
    console.log('🔍 Testing recovery scenarios...');
    
    try {
      // Test 1: Message sending with potential context invalidation
      const messageResults = [];
      
      for (let i = 0; i < 3; i++) {
        try {
          const response = await this.connectionManager.sendMessage({
            type: 'PING',
            test: `recovery_test_${i}`,
            timestamp: Date.now()
          }, { 
            retries: 2,
            fallback: { success: false, error: 'Fallback used' }
          });
          
          messageResults.push(response.success || !!response.queued);
        } catch (error) {
          messageResults.push(false);
        }
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const successRate = messageResults.filter(Boolean).length / messageResults.length;
      const testPassed = successRate >= 0.5; // At least 50% success rate
      
      this.addTestResult(
        'Recovery Scenarios',
        testPassed,
        `Success rate: ${(successRate * 100).toFixed(0)}% (${messageResults.filter(Boolean).length}/${messageResults.length})`
      );
      
    } catch (error) {
      this.addTestResult('Recovery Scenarios', false, `Error: ${error.message}`);
    }
  }

  /**
   * Add test result
   */
  addTestResult(testName, passed, details) {
    const result = {
      test: testName,
      passed,
      details,
      timestamp: Date.now()
    };
    
    this.testResults.push(result);
    
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${testName}: ${details}`);
  }

  /**
   * Display test results summary
   */
  displayTestResults() {
    console.log('\n🧪 Extension Resilience Test Results');
    console.log('=====================================');
    
    const passed = this.testResults.filter(r => r.passed).length;
    const total = this.testResults.length;
    const successRate = (passed / total * 100).toFixed(1);
    
    console.log(`Overall: ${passed}/${total} tests passed (${successRate}%)`);
    console.log('');
    
    this.testResults.forEach(result => {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${result.test}: ${result.details}`);
    });
    
    console.log('');
    
    if (passed === total) {
      console.log('🎉 All tests passed! Extension context invalidation fix is working correctly.');
    } else if (successRate >= 80) {
      console.log('⚠️ Most tests passed. Extension should be resilient with minor issues.');
    } else {
      console.log('❌ Multiple test failures. Extension context invalidation fix needs attention.');
    }
    
    return {
      passed,
      total,
      successRate,
      results: this.testResults
    };
  }

  /**
   * Run individual test by name
   */
  async runTest(testName) {
    const testMethods = {
      'utilities': this.testUtilitiesLoading,
      'context': this.testContextValidation,
      'connection': this.testConnectionManager,
      'queue': this.testMessageQueue,
      'messaging': this.testSafeMessaging,
      'ping': this.testPingHandler,
      'monitor': this.testConnectionMonitor,
      'recovery': this.testRecoveryScenarios
    };
    
    if (testMethods[testName]) {
      await this.initializeTestEnvironment();
      await testMethods[testName].call(this);
      this.displayTestResults();
    } else {
      console.error(`Unknown test: ${testName}. Available tests: ${Object.keys(testMethods).join(', ')}`);
    }
  }
}

// Auto-run tests when script is loaded
if (typeof window !== 'undefined') {
  window.ExtensionResilienceTest = ExtensionResilienceTest;
  
  // Run tests automatically if this is a test environment
  if (window.location.search.includes('test=extension-resilience')) {
    window.addEventListener('load', async () => {
      console.log('🔄 Auto-running extension resilience tests...');
      const tester = new ExtensionResilienceTest();
      await tester.runAllTests();
    });
  }
}

// Also support module export if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExtensionResilienceTest;
}

// Expose global test runner
console.log('🧪 Extension Resilience Test loaded. Run tests with:');
console.log('const tester = new ExtensionResilienceTest(); await tester.runAllTests();'); 