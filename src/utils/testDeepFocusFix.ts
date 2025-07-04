/**
 * Test utility to verify Deep Focus fixes
 * Run this in browser console to test the implemented fixes
 */

import { deepFocusSessionService } from '../api/deepFocusSessionService';

export const testDeepFocusFixes = {
  
  /**
   * Test 1: Verify session creation locking prevents duplicates
   */
  testSessionCreationLocking: async (userId: string) => {
    console.log('🧪 Testing session creation locking...');
    
    try {
      // Simulate multiple concurrent session creation calls
      const promises = [
        deepFocusSessionService.startSession(userId),
        deepFocusSessionService.startSession(userId),
        deepFocusSessionService.startSession(userId)
      ];
      
      const results = await Promise.all(promises);
      
      // All promises should return the same session ID
      const uniqueSessionIds = new Set(results);
      
      if (uniqueSessionIds.size === 1) {
        console.log('✅ Session creation locking works - all calls returned same session ID:', results[0]);
        return { success: true, sessionId: results[0] };
      } else {
        console.error('❌ Session creation locking failed - multiple session IDs created:', results);
        return { success: false, sessionIds: results };
      }
    } catch (error) {
      console.error('❌ Session creation locking test failed:', error);
      return { success: false, error };
    }
  },

  /**
   * Test 2: Verify extension message deduplication
   */
  testExtensionMessageDeduplication: () => {
    console.log('🧪 Testing extension message deduplication...');
    
    let messageCount = 0;
    const originalHandler = window.dispatchEvent;
    
    // Mock window.dispatchEvent to count extensionFocusHandled events
    window.dispatchEvent = function(event: Event) {
      if (event instanceof CustomEvent && event.type === 'extensionFocusHandled') {
        messageCount++;
        console.log(`📥 Extension focus handled event #${messageCount}`);
      }
      return originalHandler.call(this, event);
    };
    
    try {
      // Simulate rapid duplicate messages from extension
      const timestamp = Date.now();
      const messageData = {
        type: 'EXTENSION_FOCUS_STATE_CHANGED',
        payload: {
          isActive: true,
          isVisible: true,
          isFocused: true,
          blockedSites: [],
          timestamp,
          messageId: `test-extension_true_${timestamp}`
        },
        source: 'test-extension',
        extensionId: 'test-extension'
      };
      
      // Send the same message multiple times rapidly
      for (let i = 0; i < 5; i++) {
        window.postMessage(messageData, '*');
      }
      
      // Wait for processing
      setTimeout(() => {
        if (messageCount <= 1) {
          console.log('✅ Extension message deduplication works - only', messageCount, 'message(s) processed');
        } else {
          console.error('❌ Extension message deduplication failed - processed', messageCount, 'messages');
        }
        
        // Restore original handler
        window.dispatchEvent = originalHandler;
      }, 1000);
      
    } catch (error) {
      console.error('❌ Extension message deduplication test failed:', error);
      // Restore original handler
      window.dispatchEvent = originalHandler;
    }
  },

  /**
   * Test 3: Verify single session creation when toggling from extension
   */
  testSingleSessionFromExtension: async (userId: string) => {
    console.log('🧪 Testing single session creation from extension toggle...');
    
    try {
      // Clean up any existing sessions first
      await deepFocusSessionService.cleanupOrphanedSessions(userId);
      
      // Get initial session count
      const initialSessions = await deepFocusSessionService.getUserSessions(userId);
      const initialActiveCount = initialSessions.filter(s => s.status === 'active').length;
      
      console.log('📊 Initial active sessions:', initialActiveCount);
      
      // Simulate extension toggle message
      const timestamp = Date.now();
      window.postMessage({
        type: 'EXTENSION_FOCUS_STATE_CHANGED',
        payload: {
          isActive: true,
          isVisible: true,
          isFocused: true,
          blockedSites: ['facebook.com', 'twitter.com'],
          targetUserId: userId,
          timestamp,
          messageId: `test-extension_true_${timestamp}`,
          source: 'extension-content-script'
        },
        source: 'test-extension',
        extensionId: 'test-extension',
        messageTimestamp: timestamp,
        messageSource: 'focus-time-tracker-extension'
      }, '*');
      
      // Wait for session creation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check final session count
      const finalSessions = await deepFocusSessionService.getUserSessions(userId);
      const finalActiveCount = finalSessions.filter(s => s.status === 'active').length;
      
      console.log('📊 Final active sessions:', finalActiveCount);
      
      if (finalActiveCount === initialActiveCount + 1) {
        console.log('✅ Single session creation from extension works - exactly 1 new session created');
        return { success: true, newSessionCount: 1 };
      } else {
        const newSessionCount = finalActiveCount - initialActiveCount;
        console.error('❌ Multiple sessions created from extension toggle:', newSessionCount);
        return { success: false, newSessionCount };
      }
      
    } catch (error) {
      console.error('❌ Single session creation test failed:', error);
      return { success: false, error };
    }
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
            targetUserId: null,
            timestamp: Date.now(),
            messageId: `test-extension_false_${Date.now()}`,
            source: 'extension-content-script'
          },
          source: 'test-extension-id',
          extensionId: 'test-extension-id',
          messageTimestamp: Date.now(),
          messageSource: 'focus-time-tracker-extension'
        }, '*');
        
        // Check state after a delay
        setTimeout(() => {
          const finalState = useDeepFocusStore.getState();
          
          console.log('📊 Final state:', {
            isDeepFocusActive: finalState.isDeepFocusActive,
            activeSessionId: finalState.activeSessionId
          });
          
          if (!finalState.isDeepFocusActive) {
            console.log('✅ Deep Focus disable from extension works correctly');
          } else {
            console.error('❌ Deep Focus did not disable from extension message');
          }
        }, 1000);
      });
    } catch (error) {
      console.error('❌ Deep Focus disable test failed:', error);
    }
  },

  /**
   * Test 5: Run all tests
   */
  runAllTests: async (userId: string) => {
    console.log('🔬 Running all Deep Focus duplicate session fixes tests...');
    console.log('=====================================');
    
    // Test 1: Session creation locking
    await testDeepFocusFixes.testSessionCreationLocking(userId);
    console.log('-------------------------------------');
    
    // Test 2: Extension message deduplication
    testDeepFocusFixes.testExtensionMessageDeduplication();
    console.log('-------------------------------------');
    
    // Test 3: Single session from extension
    await testDeepFocusFixes.testSingleSessionFromExtension(userId);
    console.log('-------------------------------------');
    
    // Test 4: Disable from extension
    testDeepFocusFixes.testDisableFromExtension();
    console.log('=====================================');
    
    console.log('📋 All tests completed. Check console for individual results.');
  }
};

// Export for console testing
(window as any).testDeepFocusFixes = testDeepFocusFixes; 