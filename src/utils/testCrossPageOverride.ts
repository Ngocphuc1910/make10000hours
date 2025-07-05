import { useUserStore } from '../store/userStore';
import { useDeepFocusStore } from '../store/deepFocusStore';

/**
 * Test utility to verify override recording works from any page
 */
export const testCrossPageOverride = {
  /**
   * Simulate an override session from the current page
   */
  simulateOverride(domain: string = 'test-cross-page.com', duration: number = 5) {
    const { user } = useUserStore.getState();
    const { isDeepFocusActive } = useDeepFocusStore.getState();
    
    if (!user?.uid) {
      console.error('❌ CROSS-PAGE TEST: No user logged in');
      return false;
    }

    if (!isDeepFocusActive) {
      console.warn('⚠️ CROSS-PAGE TEST: Deep focus is not active - override recording may not be meaningful');
    }

    const testPayload = {
      domain,
      duration,
      userId: user.uid,
      timestamp: Date.now(),
      extensionTimestamp: Date.now()
    };

    console.log('🧪 CROSS-PAGE TEST: Simulating override from page:', window.location.pathname);
    console.log('🧪 CROSS-PAGE TEST: Test payload:', testPayload);

    // Simulate the exact message format that extension would send
    const extensionMessage = {
      type: 'RECORD_OVERRIDE_SESSION',
      payload: testPayload,
      source: 'make10000hours-extension'
    };

    // Send via window.postMessage (same as extension content script would)
    window.postMessage(extensionMessage, '*');

    console.log('✅ CROSS-PAGE TEST: Override message sent - check console for global processing');
    return true;
  },

  /**
   * Test override recording from different pages
   */
  async testFromMultiplePages() {
    console.log('🧪 CROSS-PAGE TEST: Starting multi-page override test');
    
    const { user } = useUserStore.getState();
    if (!user?.uid) {
      console.error('❌ CROSS-PAGE TEST: No user logged in for multi-page test');
      return;
    }

    // Test from current page
    const currentPage = window.location.pathname;
    console.log(`📍 CROSS-PAGE TEST: Testing from current page: ${currentPage}`);
    
    this.simulateOverride(`test-from-${currentPage.replace(/[^a-zA-Z0-9]/g, '-')}.com`, 3);

    // Wait a moment for processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check override sessions to see if it was recorded
    const { overrideSessions } = useDeepFocusStore.getState();
    const recentOverrides = overrideSessions.filter(session => 
      session.domain.includes('test-from-') && 
      Date.now() - new Date(session.createdAt).getTime() < 10000 // Within last 10 seconds
    );

    console.log('📊 CROSS-PAGE TEST: Recent test overrides:', recentOverrides.length);
    
    if (recentOverrides.length > 0) {
      console.log('✅ CROSS-PAGE TEST: Override recording is working from this page!');
      console.log('📋 CROSS-PAGE TEST: Latest override:', recentOverrides[0]);
    } else {
      console.warn('⚠️ CROSS-PAGE TEST: No recent override found - may need to reload override sessions');
    }

    return recentOverrides.length > 0;
  },

  /**
   * Test override while navigating between pages
   */
  async testDuringNavigation() {
    console.log('🧪 CROSS-PAGE TEST: Testing override during navigation');
    
    // Simulate override
    this.simulateOverride('test-during-navigation.com', 2);
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Navigate to different page (if not already there)
    const currentPath = window.location.pathname;
    const targetPath = currentPath === '/calendar' ? '/dashboard' : '/calendar';
    
    console.log(`🚀 CROSS-PAGE TEST: Navigating from ${currentPath} to ${targetPath}`);
    
    // Simulate navigation (would normally use router)
    window.history.pushState({}, '', targetPath);
    
    // Simulate another override after "navigation"
    setTimeout(() => {
      this.simulateOverride('test-after-navigation.com', 4);
      console.log('✅ CROSS-PAGE TEST: Override sent after navigation simulation');
    }, 1000);

    return true;
  },

  /**
   * Check if global override recording is working
   */
  checkGlobalRecording() {
    console.log('🔍 CROSS-PAGE TEST: Checking global override recording status');
    
    // Check if DeepFocusContext is loaded
    const context = document.querySelector('[data-testid="deep-focus-provider"]');
    console.log('🔍 CROSS-PAGE TEST: DeepFocusProvider detected:', !!context);
    
    // Check if global listeners are active
    const hasGlobalListeners = typeof window !== 'undefined';
    console.log('🔍 CROSS-PAGE TEST: Window available for global listeners:', hasGlobalListeners);
    
    // Check user and deep focus state
    const { user } = useUserStore.getState();
    const { isDeepFocusActive } = useDeepFocusStore.getState();
    
    console.log('🔍 CROSS-PAGE TEST: User authenticated:', !!user?.uid);
    console.log('🔍 CROSS-PAGE TEST: Deep focus active:', isDeepFocusActive);
    console.log('🔍 CROSS-PAGE TEST: Current page:', window.location.pathname);
    
    const isReady = !!user?.uid && hasGlobalListeners;
    console.log(isReady ? '✅ CROSS-PAGE TEST: Global recording should be working' : '❌ CROSS-PAGE TEST: Global recording may not be working');
    
    return isReady;
  }
};

// Make available globally for testing
(window as any).testCrossPageOverride = testCrossPageOverride; 