/**
 * Fix Today Data Issue - Debug Script
 * Run this in browser console on Deep Focus page
 */

console.log('🚀 Starting Today Data Issue Fix...');

// 1. Check current state
const checkCurrentState = () => {
  const store = window.useDeepFocusStore?.getState();
  console.log('📊 Current Deep Focus Store State:', {
    timeMetrics: store?.timeMetrics,
    siteUsage: store?.siteUsage?.length,
    isExtensionConnected: store?.isExtensionConnected,
    extensionData: window.extensionData || 'not set'
  });
  
  // Check selected range
  console.log('📅 Selected Date Range:', {
    rangeType: window.selectedRange?.rangeType || 'unknown',
    startDate: window.selectedRange?.startDate,
    endDate: window.selectedRange?.endDate
  });
};

// 2. Test extension communication
const testExtensionComm = () => {
  console.log('🔌 Testing extension communication...');
  
  // Method 1: postMessage
  window.postMessage({
    type: 'EXTENSION_PING',
    payload: { timestamp: Date.now() },
    source: 'make10000hours-webapp'
  }, '*');
  
  // Method 2: Chrome extension API
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    console.log('✅ Chrome extension API available');
    try {
      chrome.runtime.sendMessage({ type: 'GET_TODAY_STATS' }, (response) => {
        console.log('📨 Extension response:', response);
      });
    } catch (error) {
      console.error('❌ Chrome API error:', error);
    }
  } else {
    console.log('❌ Chrome extension API not available');
  }
};

// 3. Force data refresh
const forceDataRefresh = async () => {
  console.log('🔄 Forcing data refresh...');
  
  const store = window.useDeepFocusStore?.getState();
  if (store) {
    try {
      await store.loadExtensionData();
      console.log('✅ Extension data refresh completed');
    } catch (error) {
      console.error('❌ Extension data refresh failed:', error);
    }
    
    try {
      await store.backupTodayData();
      console.log('✅ Today data backup completed');
    } catch (error) {
      console.error('❌ Today data backup failed:', error);
    }
  }
};

// 4. Check Firebase data
const checkFirebaseData = async () => {
  console.log('🔥 Checking Firebase data...');
  
  const userId = '7Y4oV5qJm4MFo0ZJBXkH0cJNk0z1';
  const today = new Date().toISOString().split('T')[0];
  
  console.log('👤 User ID:', userId);
  console.log('📅 Today:', today);
  
  // This would need to be called from a component with Firebase access
  console.log('⚠️ Firebase check requires server-side access');
};

// 5. Manual data injection (for testing)
const injectTestData = () => {
  console.log('💉 Injecting test data...');
  
  const testData = {
    timeMetrics: {
      onScreenTime: 300, // 5 hours
      workingTime: 240,  // 4 hours
      deepFocusTime: 180, // 3 hours
      overrideTime: 60   // 1 hour
    },
    siteUsage: [
      {
        id: 'test-1',
        name: 'YouTube',
        url: 'youtube.com',
        icon: 'ri-youtube-line',
        backgroundColor: 'rgba(251,191,114,1)',
        timeSpent: 120,
        sessions: 15,
        percentage: 40
      },
      {
        id: 'test-2',
        name: 'app.make10000hours.com',
        url: 'app.make10000hours.com',
        icon: 'ri-global-line',
        backgroundColor: 'rgba(87,181,231,1)',
        timeSpent: 90,
        sessions: 25,
        percentage: 30
      }
    ]
  };
  
  // Set extension data for testing
  window.setExtensionData?.(testData);
  console.log('✅ Test data injected');
};

// 6. Run all checks
const runAllChecks = async () => {
  console.log('🔍 Running comprehensive checks...');
  
  checkCurrentState();
  testExtensionComm();
  await forceDataRefresh();
  checkFirebaseData();
  
  console.log('✨ All checks completed!');
};

// Export functions to window for easy access
window.fixTodayData = {
  checkCurrentState,
  testExtensionComm,
  forceDataRefresh,
  checkFirebaseData,
  injectTestData,
  runAllChecks
};

console.log('✅ Fix script loaded! Use window.fixTodayData.runAllChecks() to start'); 