import { overrideSessionService } from '../api/overrideSessionService';
import { useUserStore } from '../store/userStore';

/**
 * Debug utility to test override session functionality
 */
export const debugOverrideSession = {
  /**
   * Test creating an override session manually
   */
  async testCreateSession() {
    const { user } = useUserStore.getState();
    
    if (!user?.uid) {
      console.error('❌ No user logged in for test');
      return;
    }

    const testData = {
      userId: user.uid,
      domain: 'test-domain.com',
      duration: 5,
      reason: 'manual_override' as const,
      timestamp: new Date()
    };

    console.log('🔍 DEBUG: Testing override session creation with:', testData);

    try {
      const result = await overrideSessionService.createOverrideSession(testData);
      console.log('✅ Test override session created successfully:', result);
      return result;
    } catch (error) {
      console.error('❌ Test override session failed:', error);
      throw error;
    }
  },

  /**
   * Test the extension message flow
   */
  testExtensionMessage() {
    const { user } = useUserStore.getState();
    
    if (!user?.uid) {
      console.error('❌ No user logged in for test');
      return;
    }

    const testPayload = {
      domain: 'extension-test.com',
      duration: 5,
      userId: user.uid,
      timestamp: Date.now()
    };

    console.log('🔍 DEBUG: Testing extension message with:', testPayload);

    // Simulate extension message
    window.postMessage({
      type: 'RECORD_OVERRIDE_SESSION',
      payload: testPayload,
      source: 'make10000hours'
    }, '*');

    console.log('📤 Test extension message sent');
  },

  /**
   * Test user sync
   */
  testUserSync() {
    const { user } = useUserStore.getState();
    
    if (!user?.uid) {
      console.error('❌ No user logged in for sync test');
      return;
    }

    const payload = {
      userId: user.uid,
      userEmail: user.email || '',
      displayName: user.displayName || ''
    };

    console.log('🔍 DEBUG: Testing user sync with:', payload);

    // Test via window message
    window.postMessage({
      type: 'SET_USER_ID',
      payload,
      source: 'make10000hours'
    }, '*');

    // Test via Chrome API if available
    if (typeof (window as any).chrome !== 'undefined' && 
        (window as any).chrome?.runtime?.sendMessage) {
      console.log('ℹ️ Chrome extension API available, but using window.postMessage bridge for security');
      console.log('ℹ️ Direct chrome.runtime.sendMessage from web pages requires extension ID');
    }

    console.log('📤 Test user sync messages sent');
  },

  /**
   * Get current override sessions for debugging
   */
  async getOverrideSessions() {
    const { user } = useUserStore.getState();
    
    if (!user?.uid) {
      console.error('❌ No user logged in');
      return;
    }

    try {
      const sessions = await overrideSessionService.getUserOverrides(user.uid);
      console.log('📋 Current override sessions:', sessions);
      return sessions;
    } catch (error) {
      console.error('❌ Failed to get override sessions:', error);
      throw error;
    }
  }
};

// Add to window for console access
(window as any).debugOverrideSession = debugOverrideSession; 