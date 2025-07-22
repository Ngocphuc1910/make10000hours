/**
 * COMPREHENSIVE WEBHOOK DEBUG SCRIPT
 * 
 * This script will thoroughly test the Google Calendar webhook system
 * to identify why webhooks are not working when you create tasks in Google Calendar.
 * 
 * Usage: 
 * 1. Open browser console on localhost:3001
 * 2. Paste this entire script and run it
 * 3. Follow the test instructions
 */

console.log('🚀 STARTING COMPREHENSIVE WEBHOOK DEBUG...');
console.log('=====================================');

// Global state for debugging
window.webhookDebugState = {
  userId: null,
  authToken: null,
  syncState: null,
  webhookInfo: null,
  testResults: [],
  listenerActive: false
};

/**
 * Test 1: Verify User Authentication and Setup
 */
async function test1_VerifyAuth() {
  console.log('\n📋 TEST 1: VERIFY USER AUTHENTICATION');
  console.log('=====================================');
  
  try {
    // Import user store
    const { useUserStore } = await import('./src/store/userStore');
    const userState = useUserStore.getState();
    
    console.log('👤 User State:', {
      isInitialized: userState.isInitialized,
      hasUser: !!userState.user,
      userId: userState.user?.uid,
      email: userState.user?.email
    });
    
    if (!userState.isInitialized || !userState.user) {
      throw new Error('User not properly authenticated');
    }
    
    window.webhookDebugState.userId = userState.user.uid;
    
    // Check Google Calendar access
    const { useSimpleGoogleCalendarAuth } = await import('./src/hooks/useSimpleGoogleCalendarAuth');
    const authHook = useSimpleGoogleCalendarAuth();
    
    console.log('📅 Google Calendar Auth:', {
      hasCalendarAccess: authHook.hasCalendarAccess,
      isCheckingAccess: authHook.isCheckingAccess,
      hasToken: !!authHook.token,
      syncEnabled: authHook.token?.syncEnabled,
      error: authHook.error
    });
    
    if (!authHook.hasCalendarAccess) {
      throw new Error('No Google Calendar access - please grant access first');
    }
    
    window.webhookDebugState.authToken = authHook.token;
    
    console.log('✅ TEST 1 PASSED: User authenticated with Google Calendar access');
    return { success: true, data: { userId: userState.user.uid, token: authHook.token } };
    
  } catch (error) {
    console.error('❌ TEST 1 FAILED:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test 2: Check Sync State and Webhook Configuration
 */
async function test2_CheckSyncState() {
  console.log('\n📋 TEST 2: CHECK SYNC STATE & WEBHOOK CONFIG');
  console.log('=============================================');
  
  try {
    const { createSyncManager } = await import('./src/services/sync/syncManager');
    const syncManager = createSyncManager(window.webhookDebugState.userId);
    
    // Get sync state
    const syncState = await syncManager.getSyncState();
    console.log('🔄 Current Sync State:', {
      exists: !!syncState,
      isEnabled: syncState?.isEnabled,
      hasNextSyncToken: !!syncState?.nextSyncToken,
      nextSyncToken: syncState?.nextSyncToken ? syncState.nextSyncToken.substring(0, 30) + '...' : 'NONE',
      hasWebhookChannelId: !!syncState?.webhookChannelId,
      webhookChannelId: syncState?.webhookChannelId,
      webhookResourceId: syncState?.webhookResourceId,
      webhookExpirationTime: syncState?.webhookExpirationTime,
      lastWebhookNotification: syncState?.lastWebhookNotification,
      webhookTriggeredSync: syncState?.webhookTriggeredSync
    });
    
    window.webhookDebugState.syncState = syncState;
    
    // Check webhook status
    const webhookStatus = await syncManager.getWebhookStatus();
    console.log('🔗 Webhook Status:', webhookStatus);
    
    window.webhookDebugState.webhookInfo = webhookStatus;
    
    if (!syncState) {
      throw new Error('No sync state found - sync not initialized');
    }
    
    if (!syncState.isEnabled) {
      throw new Error('Sync is not enabled');
    }
    
    if (!webhookStatus.isActive) {
      console.warn('⚠️ Webhook is not active - this might be the issue');
    }
    
    console.log('✅ TEST 2 PASSED: Sync state exists and enabled');
    return { success: true, data: { syncState, webhookStatus } };
    
  } catch (error) {
    console.error('❌ TEST 2 FAILED:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test 3: Check Firebase Sync State Document
 */
async function test3_CheckFirebaseState() {
  console.log('\n📋 TEST 3: CHECK FIREBASE SYNC STATE DOCUMENT');
  console.log('===============================================');
  
  try {
    const { db } = await import('./src/api/firebase');
    const { doc, getDoc } = await import('firebase/firestore');
    
    const syncStateRef = doc(db, 'syncStates', window.webhookDebugState.userId);
    const syncStateDoc = await getDoc(syncStateRef);
    
    console.log('🔥 Firebase Sync State Document:', {
      exists: syncStateDoc.exists(),
      data: syncStateDoc.exists() ? syncStateDoc.data() : null
    });
    
    if (!syncStateDoc.exists()) {
      throw new Error('Sync state document does not exist in Firebase');
    }
    
    const data = syncStateDoc.data();
    
    // Check critical webhook fields
    console.log('🔍 Webhook Configuration Check:', {
      hasWebhookChannelId: !!data.webhookChannelId,
      hasWebhookResourceId: !!data.webhookResourceId,
      webhookExpirationTime: data.webhookExpirationTime,
      webhookTriggeredSync: data.webhookTriggeredSync,
      isExpired: data.webhookExpirationTime ? new Date() > data.webhookExpirationTime.toDate() : 'Unknown'
    });
    
    console.log('✅ TEST 3 PASSED: Firebase sync state document exists');
    return { success: true, data: data };
    
  } catch (error) {
    console.error('❌ TEST 3 FAILED:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test 4: Check Sync Store State
 */
async function test4_CheckSyncStore() {
  console.log('\n📋 TEST 4: CHECK SYNC STORE STATE');
  console.log('=================================');
  
  try {
    const { useSyncStore } = await import('./src/store/syncStore');
    const syncStoreState = useSyncStore.getState();
    
    console.log('🏪 Sync Store State:', {
      syncEnabled: syncStoreState.syncEnabled,
      syncInProgress: syncStoreState.syncInProgress,
      lastSyncTime: syncStoreState.lastSyncTime,
      syncError: syncStoreState.syncError,
      pendingTasks: syncStoreState.pendingTasks.size,
      errorTasks: syncStoreState.errorTasks.size,
      hasWebhookMonitoring: !!syncStoreState.webhookMonitoringInterval,
      hasSyncStateListener: !!syncStoreState.syncStateListener
    });
    
    if (!syncStoreState.syncEnabled) {
      console.warn('⚠️ Sync store shows sync as disabled');
    }
    
    if (!syncStoreState.syncStateListener) {
      console.warn('⚠️ No sync state listener active - this is likely the issue!');
    }
    
    console.log('✅ TEST 4 PASSED: Sync store state retrieved');
    return { success: true, data: syncStoreState };
    
  } catch (error) {
    console.error('❌ TEST 4 FAILED:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test 5: Test Real-time Firebase Listener
 */
async function test5_TestFirebaseListener() {
  console.log('\n📋 TEST 5: TEST REAL-TIME FIREBASE LISTENER');
  console.log('============================================');
  
  try {
    const { db } = await import('./src/api/firebase');
    const { doc, onSnapshot, updateDoc } = await import('firebase/firestore');
    
    console.log('👂 Setting up test listener on sync state document...');
    
    const syncStateRef = doc(db, 'syncStates', window.webhookDebugState.userId);
    let listenerTriggered = false;
    
    const unsubscribe = onSnapshot(syncStateRef, (docSnapshot) => {
      listenerTriggered = true;
      console.log('🔥 FIREBASE LISTENER TRIGGERED!', {
        exists: docSnapshot.exists(),
        timestamp: new Date().toISOString(),
        data: docSnapshot.exists() ? docSnapshot.data() : null
      });
    }, (error) => {
      console.error('❌ Firebase listener error:', error);
    });
    
    // Wait a bit then test the listener
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('🧪 Testing listener by updating sync state...');
    await updateDoc(syncStateRef, {
      testWebhookFlag: true,
      testTimestamp: new Date()
    });
    
    // Wait for listener to trigger
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    unsubscribe();
    
    if (!listenerTriggered) {
      throw new Error('Firebase listener did not trigger');
    }
    
    console.log('✅ TEST 5 PASSED: Firebase real-time listener working');
    return { success: true, data: { listenerWorking: true } };
    
  } catch (error) {
    console.error('❌ TEST 5 FAILED:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test 6: Simulate Webhook Trigger
 */
async function test6_SimulateWebhook() {
  console.log('\n📋 TEST 6: SIMULATE WEBHOOK TRIGGER');
  console.log('===================================');
  
  try {
    const { db } = await import('./src/api/firebase');
    const { doc, updateDoc } = await import('firebase/firestore');
    
    console.log('🎭 Simulating webhook trigger by setting webhookTriggeredSync: true...');
    
    const syncStateRef = doc(db, 'syncStates', window.webhookDebugState.userId);
    
    // Simulate webhook trigger
    await updateDoc(syncStateRef, {
      webhookTriggeredSync: true,
      lastWebhookNotification: new Date(),
      simulatedWebhook: true,
      updatedAt: new Date()
    });
    
    console.log('✅ Simulated webhook trigger set - check console for sync activity');
    console.log('⏳ Wait 10 seconds to see if sync is triggered...');
    
    // Wait and observe
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    console.log('✅ TEST 6 COMPLETED: Webhook simulation sent');
    return { success: true, data: { webhookSimulated: true } };
    
  } catch (error) {
    console.error('❌ TEST 6 FAILED:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test 7: Check Google Calendar API Access
 */
async function test7_TestGoogleCalendarAPI() {
  console.log('\n📋 TEST 7: TEST GOOGLE CALENDAR API ACCESS');
  console.log('==========================================');
  
  try {
    const { createSyncManager } = await import('./src/services/sync/syncManager');
    const syncManager = createSyncManager(window.webhookDebugState.userId);
    
    console.log('📅 Testing Google Calendar API access...');
    
    // Test API access by trying to get sync status
    const syncStatus = await syncManager.getSyncStatus();
    console.log('📊 Sync Status:', syncStatus);
    
    // Test listing events (this will test authentication)
    const { googleCalendarService } = await import('./src/services/sync/googleCalendarService');
    
    console.log('📋 Testing event listing...');
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    
    const events = await googleCalendarService.listEvents(today, tomorrow);
    console.log('📅 Recent events retrieved:', {
      count: events.items.length,
      hasNextSyncToken: !!events.nextSyncToken,
      firstFewEvents: events.items.slice(0, 3).map(e => ({
        id: e.id,
        summary: e.summary,
        start: e.start
      }))
    });
    
    console.log('✅ TEST 7 PASSED: Google Calendar API access working');
    return { success: true, data: { apiWorking: true, eventsCount: events.items.length } };
    
  } catch (error) {
    console.error('❌ TEST 7 FAILED:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test 8: Manual Webhook Monitor Restart
 */
async function test8_RestartWebhookMonitoring() {
  console.log('\n📋 TEST 8: RESTART WEBHOOK MONITORING');
  console.log('=====================================');
  
  try {
    const { useSyncStore } = await import('./src/store/syncStore');
    const syncStore = useSyncStore.getState();
    
    console.log('🔄 Stopping existing webhook monitoring...');
    syncStore.stopWebhookMonitoring();
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('🚀 Starting fresh webhook monitoring...');
    syncStore.startWebhookMonitoring();
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const newState = useSyncStore.getState();
    console.log('📊 New monitoring state:', {
      hasWebhookMonitoring: !!newState.webhookMonitoringInterval,
      hasSyncStateListener: !!newState.syncStateListener
    });
    
    console.log('✅ TEST 8 COMPLETED: Webhook monitoring restarted');
    return { success: true, data: { monitoringRestarted: true } };
    
  } catch (error) {
    console.error('❌ TEST 8 FAILED:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Run all tests in sequence
 */
async function runAllTests() {
  console.log('🚀 STARTING COMPREHENSIVE WEBHOOK DEBUG SUITE');
  console.log('==============================================\n');
  
  const tests = [
    { name: 'User Authentication', fn: test1_VerifyAuth },
    { name: 'Sync State & Webhook Config', fn: test2_CheckSyncState },
    { name: 'Firebase State Document', fn: test3_CheckFirebaseState },
    { name: 'Sync Store State', fn: test4_CheckSyncStore },
    { name: 'Firebase Real-time Listener', fn: test5_TestFirebaseListener },
    { name: 'Simulate Webhook Trigger', fn: test6_SimulateWebhook },
    { name: 'Google Calendar API Access', fn: test7_TestGoogleCalendarAPI },
    { name: 'Restart Webhook Monitoring', fn: test8_RestartWebhookMonitoring }
  ];
  
  const results = [];
  
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    console.log(`\n🏃 Running Test ${i + 1}/${tests.length}: ${test.name}`);
    
    try {
      const result = await test.fn();
      results.push({ test: test.name, ...result });
      
      if (!result.success) {
        console.log(`⚠️ Test failed, but continuing...`);
      }
    } catch (error) {
      console.error(`💥 Test crashed:`, error);
      results.push({ test: test.name, success: false, error: error.message });
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log('\n📊 TEST RESULTS SUMMARY');
  console.log('=======================');
  
  results.forEach((result, index) => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${index + 1}. ${result.test}: ${status}`);
    if (!result.success) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  const passedTests = results.filter(r => r.success).length;
  const totalTests = results.length;
  
  console.log(`\n🎯 OVERALL: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 ALL TESTS PASSED! Webhook system should be working.');
    console.log('💡 If you still don\'t see webhooks, the issue might be with Google\'s webhook delivery.');
  } else {
    console.log('🔧 ISSUES FOUND! Check the failed tests above.');
  }
  
  // Store results globally for inspection
  window.webhookDebugResults = results;
  
  return results;
}

/**
 * Continuous monitoring function
 */
function startContinuousMonitoring() {
  console.log('\n🔍 STARTING CONTINUOUS WEBHOOK MONITORING');
  console.log('=========================================');
  console.log('This will log every Firebase sync state change...');
  
  const { db } = import('./src/api/firebase').then(async ({ db }) => {
    const { doc, onSnapshot } = await import('firebase/firestore');
    
    if (!window.webhookDebugState.userId) {
      console.error('❌ No user ID available for monitoring');
      return;
    }
    
    const syncStateRef = doc(db, 'syncStates', window.webhookDebugState.userId);
    
    const unsubscribe = onSnapshot(syncStateRef, (docSnapshot) => {
      const timestamp = new Date().toISOString();
      console.log(`🔔 [${timestamp}] SYNC STATE CHANGE DETECTED:`, {
        exists: docSnapshot.exists(),
        data: docSnapshot.exists() ? docSnapshot.data() : null
      });
      
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        if (data.webhookTriggeredSync === true) {
          console.log('🚨 WEBHOOK TRIGGER DETECTED! This should start sync...');
        }
      }
    }, (error) => {
      console.error('❌ Monitoring error:', error);
    });
    
    window.stopWebhookMonitoring = unsubscribe;
    console.log('✅ Continuous monitoring started. Use stopWebhookMonitoring() to stop.');
  });
}

// Export functions to global scope for manual testing
window.runWebhookDebugTests = runAllTests;
window.startWebhookMonitoring = startContinuousMonitoring;
window.test1_VerifyAuth = test1_VerifyAuth;
window.test2_CheckSyncState = test2_CheckSyncState;
window.test3_CheckFirebaseState = test3_CheckFirebaseState;
window.test4_CheckSyncStore = test4_CheckSyncStore;
window.test5_TestFirebaseListener = test5_TestFirebaseListener;
window.test6_SimulateWebhook = test6_SimulateWebhook;
window.test7_TestGoogleCalendarAPI = test7_TestGoogleCalendarAPI;
window.test8_RestartWebhookMonitoring = test8_RestartWebhookMonitoring;

// Auto-run all tests
console.log('🎬 AUTO-RUNNING ALL TESTS...');
runAllTests().then((results) => {
  console.log('\n' + '='.repeat(50));
  console.log('🏁 COMPREHENSIVE WEBHOOK DEBUG COMPLETED');
  console.log('='.repeat(50));
  console.log('\n📖 MANUAL TESTING INSTRUCTIONS:');
  console.log('1. After tests complete, run: startWebhookMonitoring()');
  console.log('2. Create a task in Google Calendar');
  console.log('3. Watch the console for webhook activity');
  console.log('4. Use stopWebhookMonitoring() to stop monitoring');
  console.log('\n🔧 Available manual test functions:');
  console.log('- runWebhookDebugTests() - Run all tests again');
  console.log('- test6_SimulateWebhook() - Simulate a webhook trigger');
  console.log('- test8_RestartWebhookMonitoring() - Restart monitoring');
});