/**
 * Debug utility for testing extension communication
 * Use this in browser console to diagnose extension connectivity issues
 */

import ExtensionDataService from '../services/extensionDataService';

export const debugExtensionCommunication = {
  
  // Test basic extension detection
  async testExtensionDetection() {
    console.log('🔍 Testing extension detection...');
    console.log('Extension installed:', ExtensionDataService.isExtensionInstalled());
    console.log('Chrome runtime available:', typeof (window as any).chrome?.runtime !== 'undefined');
  },

  // Test postMessage communication
  async testPostMessageCommunication() {
    console.log('📡 Testing postMessage communication...');
    
    try {
      const result = await ExtensionDataService.testConnection();
      console.log('PostMessage test result:', result);
      return result;
    } catch (error) {
      console.error('PostMessage test failed:', error);
      return false;
    }
  },

  // Test direct chrome.runtime communication
  async testChromeRuntimeCommunication() {
    console.log('🔗 Testing chrome.runtime communication...');
    
    if (typeof (window as any).chrome?.runtime === 'undefined') {
      console.log('❌ Chrome runtime not available');
      return false;
    }

    try {
      const response = await (window as any).chrome.runtime.sendMessage({ type: 'PING' });
      console.log('Chrome runtime test result:', response);
      return true;
    } catch (error) {
      console.error('Chrome runtime test failed:', error);
      return false;
    }
  },

  // Test overall connection
  async testConnection() {
    console.log('🧪 Running comprehensive connection test...');
    
    const results = {
      extensionDetection: ExtensionDataService.isExtensionInstalled(),
      postMessage: false,
      chromeRuntime: false,
      overall: false
    };

    // Test postMessage
    try {
      results.postMessage = await this.testPostMessageCommunication();
    } catch (error) {
      console.error('PostMessage test error:', error);
    }

    // Test chrome runtime
    try {
      results.chromeRuntime = await this.testChromeRuntimeCommunication();
    } catch (error) {
      console.error('Chrome runtime test error:', error);
    }

    // Test overall connection using service
    try {
      results.overall = await ExtensionDataService.testConnection();
    } catch (error) {
      console.error('Overall connection test error:', error);
    }

    console.log('📊 Connection test results:', results);
    return results;
  },

  // Send a ping to extension
  async ping() {
    console.log('🏓 Sending ping to extension...');
    
    window.postMessage({
      type: 'EXTENSION_PING',
      messageId: Math.random().toString(36),
      source: 'make10000hours-webapp-debug'
    }, '*');

    // Listen for response
    const listener = (event: MessageEvent) => {
      if (event.data?.type === 'EXTENSION_PONG') {
        console.log('🏓 Received pong from extension:', event.data);
        window.removeEventListener('message', listener);
      }
    };

    window.addEventListener('message', listener);

    // Clean up listener after 5 seconds
    setTimeout(() => {
      window.removeEventListener('message', listener);
      console.log('⏰ Ping timeout - no response from extension');
    }, 5000);
  },

  // Check extension status in UI
  checkExtensionStatusInUI() {
    const statusElements = document.querySelectorAll('[class*="Extension"]');
    console.log('🖥️ Extension status elements found:', statusElements.length);
    statusElements.forEach((el, index) => {
      console.log(`Element ${index}:`, el.textContent, el.className);
    });
  },

  // Full diagnostic
  async runFullDiagnostic() {
    console.log('🔧 Running full extension diagnostic...');
    console.log('=====================================');
    
    await this.testExtensionDetection();
    console.log('-------------------------------------');
    
    const connectionResults = await this.testConnection();
    console.log('-------------------------------------');
    
    await this.ping();
    console.log('-------------------------------------');
    
    this.checkExtensionStatusInUI();
    console.log('=====================================');
    
    console.log('📋 Diagnostic Summary:');
    console.log('- Extension installed:', ExtensionDataService.isExtensionInstalled());
    console.log('- PostMessage working:', connectionResults.postMessage);
    console.log('- Chrome runtime working:', connectionResults.chromeRuntime);
    console.log('- Overall connection:', connectionResults.overall);
    
    if (!connectionResults.overall) {
      console.log('');
      console.log('💡 Troubleshooting tips:');
      console.log('1. Make sure the Focus Time Tracker extension is installed and enabled');
      console.log('2. Refresh the page and try again');
      console.log('3. Check if the extension is working on other websites');
      console.log('4. Try reloading the extension in chrome://extensions/');
    }
  }
};

// Make it available in console for debugging
(window as any).debugExtensionCommunication = debugExtensionCommunication;

console.log('🔧 Extension communication debugger loaded. Use debugExtensionCommunication.runFullDiagnostic() to test.'); 