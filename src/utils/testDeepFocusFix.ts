/**
 * Test utility to verify Deep Focus fixes
 * Run this in browser console to test the implemented fixes
 */

export const testDeepFocusFixes = {
  /**
   * Test 1: Verify no GlobalKeyboardShortcuts re-render spam
   */
  testGlobalShortcutsStability: () => {
    console.log('🧪 Testing GlobalKeyboardShortcuts stability...');
    
    // Count console logs for 5 seconds
    let logCount = 0;
    const originalLog = console.log;
    
    console.log = (...args) => {
      if (args[0]?.includes?.('GlobalKeyboardShortcuts: Component mounted')) {
        logCount++;
      }
      originalLog.apply(console, args);
    };
    
    setTimeout(() => {
      console.log = originalLog;
      console.log(`✅ Test Result: ${logCount} GlobalKeyboardShortcuts mount logs in 5 seconds (should be 0-1)`);
      
      if (logCount <= 1) {
        console.log('✅ PASS: GlobalKeyboardShortcuts stability test');
      } else {
        console.log('❌ FAIL: Too many GlobalKeyboardShortcuts re-renders');
      }
    }, 5000);
  },

  /**
   * Test 2: Test batch blocking functionality  
   */
  testBatchBlocking: async () => {
    console.log('🧪 Testing batch blocking functionality...');
    
    try {
      const ExtensionDataService = (await import('../services/extensionDataService')).default;
      
      if (!ExtensionDataService.isExtensionInstalled()) {
        console.log('⚠️ Extension not installed - skipping batch blocking test');
        return;
      }
      
      const testDomains = ['example.com', 'test.com', 'demo.com'];
      console.log('📦 Testing batch block for:', testDomains);
      
      const result = await ExtensionDataService.blockMultipleSites(testDomains);
      console.log('📦 Batch block result:', result);
      
      if (result.success) {
        console.log('✅ PASS: Batch blocking test');
      } else {
        console.log('❌ FAIL: Batch blocking test');
      }
      
    } catch (error) {
      console.log('❌ FAIL: Batch blocking test error:', error);
    }
  },

  /**
   * Test 3: Monitor for debouncing errors
   */
  testDebounceErrors: () => {
    console.log('🧪 Monitoring for debouncing errors (30 seconds)...');
    
    let debounceErrors = 0;
    const originalError = console.error;
    
    console.error = (...args) => {
      const errorMessage = args.join(' ');
      if (errorMessage.includes('Extension call debounced') || 
          errorMessage.includes('ADD_BLOCKED_SITE too frequent')) {
        debounceErrors++;
      }
      originalError.apply(console, args);
    };
    
    setTimeout(() => {
      console.error = originalError;
      console.log(`✅ Test Result: ${debounceErrors} debouncing errors in 30 seconds (should be 0)`);
      
      if (debounceErrors === 0) {
        console.log('✅ PASS: No debouncing errors detected');
      } else {
        console.log('❌ FAIL: Debouncing errors still occurring');
      }
    }, 30000);
  },

  /**
   * Test 4: Test the specific issue - Deep Focus switch not turning OFF when disabled from extension
   */
  testDisableFromExtension: () => {
    console.log('🧪 Testing Deep Focus disable from extension...');
    
    try {
      // Dynamic import to avoid bundler issues
      import('../store/deepFocusStore').then(({ useDeepFocusStore }) => {
        const initialState = useDeepFocusStore.getState();
        
        console.log('📊 Initial state:', {
          isDeepFocusActive: initialState.isDeepFocusActive,
          activeSessionId: initialState.activeSessionId
        });
        
        // Simulate the extension message that occurs when disabling from extension
        console.log('📤 Simulating extension disable message...');
        
        // This is the exact message structure sent by the extension content script
        window.postMessage({
          type: 'EXTENSION_FOCUS_STATE_CHANGED',
          payload: {
            isActive: false, // This is the key - extension is telling us it's disabled
            isVisible: false,
            isFocused: false,
            blockedSites: [],
            targetUserId: null
          },
          source: 'test-extension-id',
          extensionId: 'test-extension-id'
        }, '*');
        
        // Check state after a brief delay to allow async processing
        setTimeout(() => {
          const newState = useDeepFocusStore.getState();
          console.log('📊 State after extension disable:', {
            isDeepFocusActive: newState.isDeepFocusActive,
            activeSessionId: newState.activeSessionId,
            hasTimers: !!(newState.timer || newState.secondTimer)
          });
          
          if (newState.isDeepFocusActive === false) {
            console.log('✅ SUCCESS: Deep Focus correctly disabled from extension');
          } else {
            console.log('❌ FAILED: Deep Focus still active after extension disable');
            console.log('🔍 This indicates the syncCompleteFocusState method is not properly setting isDeepFocusActive to false');
          }
        }, 1000);
      });
    } catch (error) {
      console.error('❌ Failed to test disable from extension:', error);
    }
  },

  /**
   * Test 5: Test switch synchronization across pages
   */
  testSwitchSynchronization: () => {
    console.log('🧪 Testing switch synchronization across pages...');
    
    try {
      // Dynamic import to avoid bundler issues
      import('../store/deepFocusStore').then(({ useDeepFocusStore }) => {
        // Enable Deep Focus to test both directions
        console.log('📤 Testing enable synchronization...');
        window.postMessage({
          type: 'EXTENSION_FOCUS_STATE_CHANGED',
          payload: {
            isActive: true,
            isVisible: true,
            isFocused: true,
            blockedSites: ['youtube.com', 'twitter.com'],
            targetUserId: null
          },
          source: 'test-extension-id',
          extensionId: 'test-extension-id'
        }, '*');
        
        setTimeout(() => {
          const enabledState = useDeepFocusStore.getState();
          console.log('📊 State after enable:', { isDeepFocusActive: enabledState.isDeepFocusActive });
          
          // Now test disable
          console.log('📤 Testing disable synchronization...');
          window.postMessage({
            type: 'EXTENSION_FOCUS_STATE_CHANGED',
            payload: {
              isActive: false,
              isVisible: false,
              isFocused: false,
              blockedSites: [],
              targetUserId: null
            },
            source: 'test-extension-id',
            extensionId: 'test-extension-id'
          }, '*');
          
          setTimeout(() => {
            const disabledState = useDeepFocusStore.getState();
            console.log('📊 State after disable:', { isDeepFocusActive: disabledState.isDeepFocusActive });
            
            if (enabledState.isDeepFocusActive === true && disabledState.isDeepFocusActive === false) {
              console.log('✅ SUCCESS: Switch synchronization working correctly');
            } else {
              console.log('❌ FAILED: Switch synchronization has issues');
              console.log('🔍 Expected: enabled=true, disabled=false');
              console.log('🔍 Actual: enabled=' + enabledState.isDeepFocusActive + ', disabled=' + disabledState.isDeepFocusActive);
            }
          }, 1000);
        }, 1000);
      });
    } catch (error) {
      console.error('❌ Failed to test switch synchronization:', error);
    }
  },

  /**
   * Run all tests
   */
  runAllTests: () => {
    console.log('🚀 Running all Deep Focus fix tests...');
    
    // Run tests with delays to avoid interference
    testDeepFocusFixes.testGlobalShortcutsStability();
    
    setTimeout(() => {
      testDeepFocusFixes.testDebounceErrors();
    }, 1000);
    
    setTimeout(() => {
      testDeepFocusFixes.testBatchBlocking();
    }, 2000);
    
    setTimeout(() => {
      testDeepFocusFixes.testDisableFromExtension();
    }, 3000);
    
    setTimeout(() => {
      testDeepFocusFixes.testSwitchSynchronization();
    }, 4000);
    
    console.log('✅ All tests initiated. Check individual test results above.');
  }
};

// Make available in global scope for console testing
if (typeof window !== 'undefined') {
  (window as any).testDeepFocusFixes = testDeepFocusFixes;
} 