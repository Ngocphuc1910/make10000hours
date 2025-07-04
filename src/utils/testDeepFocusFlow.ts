import { deepFocusSessionService } from '../api/deepFocusSessionService';
import { useDeepFocusStore } from '../store/deepFocusStore';
import { useUserStore } from '../store/userStore';

/**
 * Test turning OFF deep focus via extension message
 */
export const testExtensionTurnOff = async () => {
  console.log('🧪 Testing Extension Turn OFF → Session Completion...');
  
  try {
    // Get current user
    const userState = useUserStore.getState();
    const userId = userState.user?.uid;
    
    if (!userId) {
      console.error('❌ No user logged in for testing');
      return false;
    }
    
    console.log('👤 Testing turn OFF for user:', userId);
    
    // Step 1: First turn ON deep focus to create a session
    console.log('🔄 Step 1: Turning ON deep focus to create a session...');
    const { enableDeepFocus } = useDeepFocusStore.getState();
    await enableDeepFocus();
    
    // Wait for session creation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const stateAfterOn = useDeepFocusStore.getState();
    console.log('📊 State after turning ON:', {
      isActive: stateAfterOn.isDeepFocusActive,
      sessionId: stateAfterOn.activeSessionId
    });
    
    if (!stateAfterOn.isDeepFocusActive || !stateAfterOn.activeSessionId) {
      console.error('❌ Failed to create session in Step 1');
      return false;
    }
    
    const activeSessionId = stateAfterOn.activeSessionId;
    console.log('✅ Step 1 complete - session created:', activeSessionId);
    
    // Step 2: Simulate extension turning OFF deep focus
    console.log('🔄 Step 2: Simulating extension turning OFF deep focus...');
    
    const mockExtensionOffMessage = {
      type: 'EXTENSION_FOCUS_STATE_CHANGED',
      payload: {
        isActive: false,
        isVisible: false,
        isFocused: false,
        blockedSites: [],
        targetUserId: userId,
        timestamp: Date.now(),
        messageId: `test_off_${Date.now()}`,
        source: 'extension-content-script'
      },
      source: 'test-extension-id',
      extensionId: 'test-extension-id',
      messageTimestamp: Date.now(),
      messageSource: 'focus-time-tracker-extension'
    };
    
    console.log('📤 Sending extension OFF message...');
    window.postMessage(mockExtensionOffMessage, '*');
    
    // Wait for processing
    console.log('⏳ Waiting 3 seconds for processing...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 3: Check if web app state updated to OFF
    const stateAfterOff = useDeepFocusStore.getState();
    console.log('📊 State after turning OFF:', {
      isActive: stateAfterOff.isDeepFocusActive,
      sessionId: stateAfterOff.activeSessionId
    });
    
    // Step 4: Check if session was completed in Firebase
    console.log('🔍 Checking session status in Firebase...');
    const allSessions = await deepFocusSessionService.getUserSessions(userId);
    const completedSession = allSessions.find(s => s.id === activeSessionId);
    
    console.log('📊 Session in Firebase:', {
      found: !!completedSession,
      status: completedSession?.status,
      duration: completedSession?.duration,
      endTime: completedSession?.endTime
    });
    
    // Verify success conditions
    const webAppTurnedOff = !stateAfterOff.isDeepFocusActive && !stateAfterOff.activeSessionId;
    const sessionCompleted = completedSession && completedSession.status === 'completed' && completedSession.endTime;
    
    const success = webAppTurnedOff && sessionCompleted;
    
    if (success) {
      console.log('✅ Extension turn OFF test passed!');
      console.log('🎉 Session properly completed:', completedSession?.id);
      console.log('📊 Final duration:', completedSession?.duration, 'minutes');
      return true;
    } else {
      console.error('❌ Extension turn OFF test failed');
      console.error('📊 Web app turned off:', webAppTurnedOff);
      console.error('📊 Session completed:', sessionCompleted);
      
      if (!webAppTurnedOff) {
        console.error('❌ Web app state issue - isActive:', stateAfterOff.isDeepFocusActive, 'sessionId:', stateAfterOff.activeSessionId);
      }
      
      if (!sessionCompleted) {
        console.error('❌ Session completion issue:', {
          sessionExists: !!completedSession,
          status: completedSession?.status,
          hasEndTime: !!completedSession?.endTime
        });
      }
      
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    return false;
  }
};

/**
 * Simple test to verify extension message handling is working
 */
export const testExtensionMessageHandling = async () => {
  console.log('🧪 Testing Extension Message Handling...');
  
  // Get current user
  const userState = useUserStore.getState();
  const userId = userState.user?.uid;
  
  if (!userId) {
    console.error('❌ No user logged in for testing');
    return false;
  }
  
  console.log('👤 Testing for user:', userId);
  
  // Get initial state
  const initialState = useDeepFocusStore.getState();
  console.log('📊 Initial state:', {
    isActive: initialState.isDeepFocusActive,
    sessionId: initialState.activeSessionId
  });
  
  // Clean up any existing sessions
  await deepFocusSessionService.cleanupOrphanedSessions(userId);
  
  // Simulate the exact message that the extension sends
  const mockExtensionMessage = {
    type: 'EXTENSION_FOCUS_STATE_CHANGED',
    payload: {
      isActive: true,
      isVisible: true,
      isFocused: true,
      blockedSites: ['facebook.com', 'twitter.com'],
      targetUserId: userId,
      timestamp: Date.now(),
      messageId: `test_${Date.now()}`,
      source: 'extension-content-script'
    },
    source: 'test-extension-id',
    extensionId: 'test-extension-id',
    messageTimestamp: Date.now(),
    messageSource: 'focus-time-tracker-extension'
  };
  
  console.log('📤 Sending mock extension message:', mockExtensionMessage);
  
  // Send the message
  window.postMessage(mockExtensionMessage, '*');
  
  // Wait for processing
  console.log('⏳ Waiting 3 seconds for processing...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Check if web app state updated
  const updatedState = useDeepFocusStore.getState();
  console.log('📊 Updated state:', {
    isActive: updatedState.isDeepFocusActive,
    sessionId: updatedState.activeSessionId
  });
  
  // Check if session was created in Firebase
  const activeSession = await deepFocusSessionService.getActiveSession(userId);
  console.log('📊 Active session in Firebase:', activeSession);
  
  const success = updatedState.isDeepFocusActive && activeSession !== null;
  
  if (success) {
    console.log('✅ Extension message handling is working!');
    console.log('🎉 Session created:', activeSession?.id);
    
    // Clean up
    if (activeSession) {
      await deepFocusSessionService.endSession(activeSession.id);
      console.log('🧹 Test session cleaned up');
    }
    
    return true;
  } else {
    console.error('❌ Extension message handling failed');
    console.error('📊 Expected: isActive=true, session exists');
    console.error('📊 Actual: isActive=' + updatedState.isDeepFocusActive + ', session=' + (activeSession ? 'exists' : 'null'));
    return false;
  }
};

export const testExtensionToWebAppCommunication = {
  
  /**
   * Test 1: Simulate extension popup toggle and verify web app response
   */
  testExtensionPopupToggle: async () => {
    console.log('🧪 Testing Extension Popup → Web App Communication...');
    
    try {
      // Get current user
      const userState = useUserStore.getState();
      const userId = userState.user?.uid;
      
      if (!userId) {
        console.error('❌ No user logged in for testing');
        return false;
      }
      
      // Get initial state
      const initialState = useDeepFocusStore.getState();
      const initialIsActive = initialState.isDeepFocusActive;
      const initialSessionId = initialState.activeSessionId;
      
      console.log('📊 Initial state:', {
        isActive: initialIsActive,
        sessionId: initialSessionId
      });
      
      // Simulate extension sending focus state change message
      const mockExtensionMessage = {
        type: 'EXTENSION_FOCUS_STATE_CHANGED',
        payload: {
          isActive: true,
          isVisible: true,
          isFocused: true,
          blockedSites: ['facebook.com', 'twitter.com', 'youtube.com'],
          targetUserId: userId,
          timestamp: Date.now(),
          messageId: `test_${Date.now()}`,
          source: 'extension-content-script'
        },
        source: 'test-extension-id',
        extensionId: 'test-extension-id',
        messageTimestamp: Date.now(),
        messageSource: 'focus-time-tracker-extension'
      };
      
      // Send the message
      console.log('📤 Sending mock extension message...');
      window.postMessage(mockExtensionMessage, '*');
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if web app state updated
      const updatedState = useDeepFocusStore.getState();
      console.log('📊 Updated state:', {
        isActive: updatedState.isDeepFocusActive,
        sessionId: updatedState.activeSessionId
      });
      
      // Verify session was created
      const activeSession = await deepFocusSessionService.getActiveSession(userId);
      
      const success = updatedState.isDeepFocusActive && activeSession !== null;
      
      if (success) {
        console.log('✅ Extension → Web App communication working!');
        console.log('📊 Session created:', activeSession?.id);
        
        // Clean up - end the test session
        if (activeSession) {
          await deepFocusSessionService.endSession(activeSession.id);
          console.log('🧹 Test session cleaned up');
        }
      } else {
        console.error('❌ Extension → Web App communication failed');
        console.error('Web app state:', updatedState.isDeepFocusActive);
        console.error('Active session:', activeSession);
      }
      
      return success;
      
    } catch (error) {
      console.error('❌ Test failed with error:', error);
      return false;
    }
  },
  
  /**
   * Test 2: Verify bidirectional communication (Web App → Extension)
   */
  testWebAppToExtension: async () => {
    console.log('🧪 Testing Web App → Extension Communication...');
    
    try {
      // Get current user
      const userState = useUserStore.getState();
      const userId = userState.user?.uid;
      
      if (!userId) {
        console.error('❌ No user logged in for testing');
        return false;
      }
      
      // Get initial state
      const initialState = useDeepFocusStore.getState();
      
      // Toggle deep focus from web app
      console.log('🔄 Toggling deep focus from web app...');
      const { enableDeepFocus } = useDeepFocusStore.getState();
      await enableDeepFocus();
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if session was created
      const activeSession = await deepFocusSessionService.getActiveSession(userId);
      const updatedState = useDeepFocusStore.getState();
      
      const success = updatedState.isDeepFocusActive && activeSession !== null;
      
      if (success) {
        console.log('✅ Web App → Extension communication working!');
        console.log('📊 Session created:', activeSession?.id);
        
        // Clean up
        if (activeSession) {
          await deepFocusSessionService.endSession(activeSession.id);
          console.log('🧹 Test session cleaned up');
        }
      } else {
        console.error('❌ Web App → Extension communication failed');
      }
      
      return success;
      
    } catch (error) {
      console.error('❌ Test failed with error:', error);
      return false;
    }
  },
  
  /**
   * Test 3: Verify no duplicate sessions are created
   */
  testNoDuplicateSessions: async () => {
    console.log('🧪 Testing No Duplicate Sessions...');
    
    try {
      // Get current user
      const userState = useUserStore.getState();
      const userId = userState.user?.uid;
      
      if (!userId) {
        console.error('❌ No user logged in for testing');
        return false;
      }
      
      // Clean up any existing sessions
      await deepFocusSessionService.cleanupOrphanedSessions(userId);
      
      // Send multiple rapid extension messages (simulate the original problem)
      const mockMessages = Array.from({ length: 3 }, (_, i) => ({
        type: 'EXTENSION_FOCUS_STATE_CHANGED',
        payload: {
          isActive: true,
          isVisible: true,
          isFocused: true,
          blockedSites: ['facebook.com'],
          targetUserId: userId,
          timestamp: Date.now() + i,
          messageId: `test_${Date.now()}_${i}`,
          source: 'extension-content-script'
        },
        source: 'test-extension-id',
        extensionId: 'test-extension-id',
        messageTimestamp: Date.now() + i,
        messageSource: 'focus-time-tracker-extension'
      }));
      
      console.log('📤 Sending 3 rapid extension messages...');
      mockMessages.forEach(msg => window.postMessage(msg, '*'));
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check how many sessions were created
      const sessions = await deepFocusSessionService.getUserSessions(userId);
      const activeSessions = sessions.filter(s => s.status === 'active');
      
      const success = activeSessions.length === 1;
      
      if (success) {
        console.log('✅ No duplicate sessions created!');
        console.log('📊 Active sessions:', activeSessions.length);
        
        // Clean up
        if (activeSessions.length > 0) {
          await deepFocusSessionService.endSession(activeSessions[0].id);
          console.log('🧹 Test session cleaned up');
        }
      } else {
        console.error('❌ Duplicate sessions detected!');
        console.error('Active sessions:', activeSessions.length);
        console.error('Sessions:', activeSessions);
      }
      
      return success;
      
  } catch (error) {
      console.error('❌ Test failed with error:', error);
      return false;
    }
  },
  
  /**
   * Run all tests
   */
  runAllTests: async () => {
    console.log('🧪 Running All Deep Focus Communication Tests...');
    
    const results = {
      extensionToWebApp: await testExtensionToWebAppCommunication.testExtensionPopupToggle(),
      webAppToExtension: await testExtensionToWebAppCommunication.testWebAppToExtension(),
      noDuplicateSessions: await testExtensionToWebAppCommunication.testNoDuplicateSessions()
    };
    
    const allPassed = Object.values(results).every(result => result);
    
    console.log('📊 Test Results:', results);
    console.log(allPassed ? '✅ All tests passed!' : '❌ Some tests failed!');
    
    return results;
  }
};

// Export for global access
(window as any).testExtensionTurnOff = testExtensionTurnOff;
(window as any).testExtensionMessageHandling = testExtensionMessageHandling;
(window as any).testDeepFocusFlow = testExtensionToWebAppCommunication; 