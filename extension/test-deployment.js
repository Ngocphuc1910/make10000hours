/**
 * Deployment Test Script
 * Quick verification that enhanced activity detection is working
 */

console.log('🚀 Enhanced Activity Detection Deployment Test');
console.log('='.repeat(50));

// Test 1: Check if new message handlers exist
chrome.runtime.sendMessage({ type: 'GET_ACTIVITY_STATE' })
  .then(response => {
    if (response?.success) {
      console.log('✅ Enhanced activity detection: WORKING');
      console.log('   Activity State:', response.data);
    } else {
      console.log('❌ Enhanced activity detection: FAILED');
    }
  })
  .catch(error => {
    console.log('❌ Enhanced activity detection: ERROR -', error.message);
  });

// Test 2: Check auto-management toggle
chrome.runtime.sendMessage({ 
  type: 'TOGGLE_AUTO_MANAGEMENT', 
  payload: { enabled: true } 
})
  .then(response => {
    if (response?.success) {
      console.log('✅ Auto-management toggle: WORKING');
    } else {
      console.log('❌ Auto-management toggle: FAILED');
    }
  })
  .catch(error => {
    console.log('❌ Auto-management toggle: ERROR -', error.message);
  });

// Test 3: Simulate inactivity
const testInactivity = () => {
  const activityData = {
    isActive: false,
    timeSinceLastActivity: 6 * 60 * 1000, // 6 minutes
    isVisible: true,
    isWindowFocused: true,
    eventType: 'deployment_test'
  };

  chrome.runtime.sendMessage({
    type: 'ENHANCED_ACTIVITY_DETECTED',
    payload: activityData
  })
    .then(response => {
      if (response?.success) {
        console.log('✅ Enhanced activity messages: WORKING');
        
        // Check if session gets paused
        setTimeout(() => {
          chrome.runtime.sendMessage({ type: 'GET_ACTIVITY_STATE' })
            .then(stateResponse => {
              if (stateResponse?.data?.isSessionPaused) {
                console.log('✅ Auto-pause on inactivity: WORKING');
              } else {
                console.log('⚠️ Auto-pause on inactivity: NOT TRIGGERED (may need active session)');
              }
            });
        }, 1000);
      } else {
        console.log('❌ Enhanced activity messages: FAILED');
      }
    })
    .catch(error => {
      console.log('❌ Enhanced activity messages: ERROR -', error.message);
    });
};

// Run inactivity test after a delay
setTimeout(testInactivity, 2000);

console.log('\n📖 Manual Tests:');
console.log('1. Close laptop lid for 30+ minutes → Should pause time tracking');
console.log('2. Leave browser idle for 10+ minutes → Should exclude inactive time');
console.log('3. Toggle auto-management in popup → Should enable/disable auto-pause');
console.log('4. Check activity status indicator → Should show active/idle/paused state');

console.log('\n🧪 Run full test suite with:');
console.log('activityTestSuite.runAllTests()'); // From test-enhanced-activity.js 