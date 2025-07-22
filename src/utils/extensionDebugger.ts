/**
 * Comprehensive Extension Debug Script
 * Tests all aspects of extension communication and Deep Focus functionality
 */

import ExtensionDataService from '../services/extensionDataService';

interface DebugResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  data?: any;
  error?: any;
}

export class ExtensionDebugger {
  private results: DebugResult[] = [];
  
  private log(test: string, status: 'PASS' | 'FAIL' | 'WARN', message: string, data?: any, error?: any) {
    const result: DebugResult = { test, status, message, data, error };
    this.results.push(result);
    
    const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${emoji} ${test}: ${message}`);
    if (data) console.log('  Data:', data);
    if (error) console.log('  Error:', error);
  }

  /**
   * Test 1: Basic Extension Detection
   */
  async testExtensionDetection() {
    console.log('\n🔍 === TEST 1: Extension Detection ===');
    
    try {
      // Check if extension APIs are available
      const hasChrome = typeof (window as any).chrome !== 'undefined';
      const hasRuntime = !!(window as any).chrome?.runtime;
      const hasExtensionId = !!(window as any).chrome?.runtime?.id;
      
      this.log('Extension Chrome API', hasChrome ? 'PASS' : 'FAIL', 
        hasChrome ? 'Chrome API available' : 'Chrome API not available');
      
      this.log('Extension Runtime API', hasRuntime ? 'PASS' : 'FAIL', 
        hasRuntime ? 'Runtime API available' : 'Runtime API not available');
      
      this.log('Extension ID', hasExtensionId ? 'PASS' : 'FAIL', 
        hasExtensionId ? `Extension ID: ${(window as any).chrome.runtime.id}` : 'No extension ID');
      
      // Check if extension is installed using our service
      const isInstalled = ExtensionDataService.isExtensionInstalled();
      this.log('Extension Installation Check', isInstalled ? 'PASS' : 'FAIL',
        isInstalled ? 'Extension detected by service' : 'Extension not detected by service');
      
    } catch (error) {
      this.log('Extension Detection', 'FAIL', 'Exception during detection', undefined, error);
    }
  }

  /**
   * Test 2: Extension Connection Test
   */
  async testExtensionConnection() {
    console.log('\n🔍 === TEST 2: Extension Connection ===');
    
    try {
      // Test basic connection
      const connectionTest = await ExtensionDataService.testConnection();
      this.log('Extension Connection', connectionTest ? 'PASS' : 'FAIL',
        connectionTest ? 'Extension responds to connection test' : 'Extension does not respond');
      
      // Test PING message
      try {
        const pingResponse = await ExtensionDataService.sendMessage({ type: 'PING' });
        this.log('PING Message', 'PASS', 'PING message successful', pingResponse);
      } catch (error) {
        this.log('PING Message', 'FAIL', 'PING message failed', undefined, error);
      }
      
      // Test circuit breaker status
      const circuitBreakerStatus = ExtensionDataService.getCircuitBreakerStatus();
      this.log('Circuit Breaker Status', 'PASS', 'Circuit breaker info retrieved', circuitBreakerStatus);
      
    } catch (error) {
      this.log('Extension Connection', 'FAIL', 'Exception during connection test', undefined, error);
    }
  }

  /**
   * Test 3: Content Script Communication
   */
  async testContentScriptCommunication() {
    console.log('\n🔍 === TEST 3: Content Script Communication ===');
    
    try {
      // Test window.postMessage communication
      const testMessage = {
        type: 'EXTENSION_REQUEST',
        messageId: 'debug-test-' + Date.now(),
        payload: { type: 'PING' }
      };
      
      let responseReceived = false;
      const responseHandler = (event: MessageEvent) => {
        if (event.data?.extensionResponseId === testMessage.messageId) {
          responseReceived = true;
          this.log('Content Script Response', 'PASS', 'Content script forwarded message', event.data);
          window.removeEventListener('message', responseHandler);
        }
      };
      
      window.addEventListener('message', responseHandler);
      window.postMessage(testMessage, '*');
      
      // Wait for response
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (!responseReceived) {
        this.log('Content Script Communication', 'FAIL', 'No response from content script after 2 seconds');
      }
      
    } catch (error) {
      this.log('Content Script Communication', 'FAIL', 'Exception during content script test', undefined, error);
    }
  }

  /**
   * Test 4: Deep Focus Message Types
   */
  async testDeepFocusMessageTypes() {
    console.log('\n🔍 === TEST 4: Deep Focus Message Types ===');
    
    const messageTypes = [
      'GET_TODAY_DEEP_FOCUS_SESSIONS',
      'GET_DEEP_FOCUS_SESSIONS_DATE_RANGE',
      'GET_ACTIVE_DEEP_FOCUS_SESSION',
      'GET_ALL_DEEP_FOCUS_SESSIONS'
    ];
    
    for (const messageType of messageTypes) {
      try {
        const response = await ExtensionDataService.sendMessage({ type: messageType });
        this.log(`Message Type: ${messageType}`, 'PASS', 'Message recognized by extension', response);
      } catch (error) {
        this.log(`Message Type: ${messageType}`, 'FAIL', 'Message not recognized', undefined, error);
      }
      // Add delay between tests to avoid debouncing
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  /**
   * Test 5: Extension Storage and Sessions
   */
  async testExtensionStorage() {
    console.log('\n🔍 === TEST 5: Extension Storage ===');
    
    try {
      // Test if extension has Deep Focus storage
      const response = await ExtensionDataService.sendMessage({ 
        type: 'GET_TODAY_STATS' 
      });
      
      if (response?.success) {
        this.log('Extension Storage Access', 'PASS', 'Extension can access storage', response);
      } else {
        this.log('Extension Storage Access', 'FAIL', 'Extension cannot access storage', response);
      }
      
      // Test Deep Focus specific storage
      try {
        const todayResponse = await ExtensionDataService.getTodayDeepFocusSessions();
        this.log('Deep Focus Storage', 'PASS', 'Deep Focus sessions retrieved', todayResponse);
      } catch (error) {
        this.log('Deep Focus Storage', 'FAIL', 'Cannot retrieve Deep Focus sessions', undefined, error);
      }
      
    } catch (error) {
      this.log('Extension Storage', 'FAIL', 'Exception during storage test', undefined, error);
    }
  }

  /**
   * Test 6: Extension Background Script Version
   */
  async testBackgroundScriptVersion() {
    console.log('\n🔍 === TEST 6: Background Script Version ===');
    
    try {
      // Send a test message to check if debug logs are present
      const testResponse = await ExtensionDataService.sendMessage({ 
        type: 'DEBUG_VERSION_CHECK',
        payload: { timestamp: Date.now() }
      });
      
      // This should fail with "Unknown message type" if the script is updated
      // But the error message should include our debug info
      this.log('Background Script Version', 'WARN', 
        'Debug message sent - check extension console for debug logs');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Unknown message type')) {
        this.log('Background Script Version', 'WARN', 
          'Extension is running (gets unknown message type), but may not have latest handlers');
      } else {
        this.log('Background Script Version', 'FAIL', 
          'Unexpected error from background script', undefined, error);
      }
    }
    
    // Additional test: Check if we can trigger debug logs in extension console
    console.log('📋 IMPORTANT: Check the Chrome extension console for these debug messages:');
    console.log('  - "🔍 DEBUG: Extension version with Deep Focus handlers"');
    console.log('  - "📋 EXTENSION VERSION CHECK: Deep Focus handlers should be available"');
    console.log('  - If these are missing, the extension is using an old cached version');
  }

  /**
   * Test 7: Message Flow Debugging
   */
  async testMessageFlow() {
    console.log('\n🔍 === TEST 7: Message Flow ===');
    
    try {
      // Test each step of the message flow
      console.log('Testing message flow step by step...');
      
      // Step 1: Direct extension message
      try {
        const directResponse = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Direct message timeout'));
          }, 5000);
          
          const messageId = 'direct-test-' + Date.now();
          const responseHandler = (event: MessageEvent) => {
            if (event.data?.extensionResponseId === messageId) {
              clearTimeout(timeout);
              window.removeEventListener('message', responseHandler);
              resolve(event.data.response);
            }
          };
          
          window.addEventListener('message', responseHandler);
          window.postMessage({
            type: 'EXTENSION_REQUEST',
            messageId,
            payload: { type: 'GET_TODAY_DEEP_FOCUS_SESSIONS' }
          }, '*');
        });
        
        this.log('Direct Message Flow', 'PASS', 'Direct message successful', directResponse);
      } catch (error) {
        this.log('Direct Message Flow', 'FAIL', 'Direct message failed', undefined, error);
      }
      
      // Step 2: Service wrapper message
      try {
        const serviceResponse = await ExtensionDataService.getTodayDeepFocusSessions();
        this.log('Service Wrapper Flow', 'PASS', 'Service wrapper successful', serviceResponse);
      } catch (error) {
        this.log('Service Wrapper Flow', 'FAIL', 'Service wrapper failed', undefined, error);
      }
      
    } catch (error) {
      this.log('Message Flow', 'FAIL', 'Exception during message flow test', undefined, error);
    }
  }

  /**
   * Test 8: Extension Manifest and Permissions
   */
  async testExtensionManifest() {
    console.log('\n🔍 === TEST 8: Extension Manifest ===');
    
    try {
      // Check externally_connectable permissions
      const currentOrigin = window.location.origin;
      this.log('Current Origin', 'PASS', `Testing from: ${currentOrigin}`);
      
      // Check if current origin should be allowed
      const allowedOrigins = [
        'https://app.make10000hours.com',
        'https://www.app.make10000hours.com',
        'http://localhost:3001', // Common dev ports
        'http://localhost:3000',
        'http://localhost:3002',
        'http://localhost:3003'
      ];
      
      const isOriginAllowed = allowedOrigins.some(origin => 
        currentOrigin.startsWith(origin) || 
        currentOrigin.match(/^http:\/\/localhost:\d+$/)
      );
      
      this.log('Origin Permissions', isOriginAllowed ? 'PASS' : 'WARN',
        isOriginAllowed ? 'Origin should be allowed' : 'Origin may not be in externally_connectable');
      
    } catch (error) {
      this.log('Extension Manifest', 'FAIL', 'Exception during manifest test', undefined, error);
    }
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🚀 === COMPREHENSIVE EXTENSION DEBUG STARTED ===');
    console.log('This will test all aspects of extension communication...\n');
    
    this.results = [];
    
    // Reset circuit breaker and clear debounce cache before testing
    console.log('🔄 Resetting extension communication state...');
    ExtensionDataService.resetCircuitBreaker();
    // Clear the debounce cache by waiting
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await this.testExtensionDetection();
    await this.testExtensionConnection();
    await this.testContentScriptCommunication();
    await this.testDeepFocusMessageTypes();
    await this.testExtensionStorage();
    await this.testBackgroundScriptVersion();
    await this.testMessageFlow();
    await this.testExtensionManifest();
    
    // Summary
    console.log('\n📊 === DEBUG SUMMARY ===');
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const warned = this.results.filter(r => r.status === 'WARN').length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️ Warnings: ${warned}`);
    console.log(`📋 Total Tests: ${this.results.length}`);
    
    if (failed > 0) {
      console.log('\n❌ CRITICAL FAILURES:');
      this.results.filter(r => r.status === 'FAIL').forEach(r => {
        console.log(`  - ${r.test}: ${r.message}`);
      });
    }
    
    console.log('\n💡 NEXT STEPS:');
    if (failed === 0) {
      console.log('  - All tests passed! Extension should be working correctly.');
    } else {
      console.log('  - Review failed tests above');
      console.log('  - Check Chrome extension console for additional logs');
      console.log('  - Ensure extension is loaded and up-to-date');
    }
    
    return this.results;
  }

  /**
   * Get detailed results
   */
  getResults(): DebugResult[] {
    return this.results;
  }
}

// Global debug function
(window as any).debugExtension = async () => {
  const extDebugger = new ExtensionDebugger();
  return await extDebugger.runAllTests();
};

// Export for use in other modules
export default ExtensionDebugger;