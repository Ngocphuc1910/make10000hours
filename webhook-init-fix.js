/**
 * WEBHOOK INITIALIZATION FIX
 * 
 * This script identifies and fixes the initialization race condition
 * that prevents webhooks from working properly.
 * 
 * ROOT CAUSE: Circular dependency in initialization order:
 * 1. useSimpleGoogleCalendarAuth hook starts webhook monitoring
 * 2. But sync store isn't properly initialized yet  
 * 3. So syncStore.syncEnabled = false
 * 4. So shouldMonitor = false
 * 5. So webhook monitoring never starts
 */

console.log('🔧 WEBHOOK INITIALIZATION FIX');
console.log('=============================');

/**
 * Step 1: Diagnose the current state
 */
async function diagnoseCurrentState() {
  console.log('\n📋 DIAGNOSING CURRENT STATE...');
  
  try {
    // Check user store state
    const { useUserStore } = await import('./src/store/userStore');
    const userState = useUserStore.getState();
    
    console.log('👤 User Store State:', {
      isInitialized: userState.isInitialized,
      hasUser: !!userState.user,
      userId: userState.user?.uid
    });
    
    // Check sync store state  
    const { useSyncStore } = await import('./src/store/syncStore');
    const syncState = useSyncStore.getState();
    
    console.log('🔄 Sync Store State:', {
      syncEnabled: syncState.syncEnabled,
      syncInProgress: syncState.syncInProgress,
      hasWebhookMonitoring: !!syncState.webhookMonitoringInterval,
      hasSyncStateListener: !!syncState.syncStateListener
    });
    
    // Check Google Calendar auth state
    const { useSimpleGoogleCalendarAuth } = await import('./src/hooks/useSimpleGoogleCalendarAuth');
    // Note: Can't call hook outside component, will check token storage directly
    
    if (userState.user) {
      const { simpleGoogleOAuthService } = await import('./src/services/auth/simpleGoogleOAuth');
      const token = await simpleGoogleOAuthService.getStoredToken();
      
      console.log('📅 Google Calendar Token:', {
        hasToken: !!token,
        syncEnabled: token?.syncEnabled,
        email: token?.email
      });
      
      // Check if sync manager can be created
      const { createSyncManager } = await import('./src/services/sync/syncManager');
      const syncManager = createSyncManager(userState.user.uid);
      
      try {
        const syncStatus = await syncManager.getSyncStatus();
        console.log('⚙️ Sync Manager Status:', syncStatus);
      } catch (error) {
        console.error('❌ Sync Manager Error:', error.message);
      }
    }
    
    return {
      userInitialized: userState.isInitialized,
      hasUser: !!userState.user,
      syncEnabled: syncState.syncEnabled,
      hasWebhookMonitoring: !!syncState.webhookMonitoringInterval
    };
    
  } catch (error) {
    console.error('❌ Diagnosis failed:', error);
    return null;
  }
}

/**
 * Step 2: Force proper initialization sequence
 */
async function forceProperInitialization() {
  console.log('\n🔄 FORCING PROPER INITIALIZATION...');
  
  try {
    // 1. Ensure user store is initialized
    const { useUserStore } = await import('./src/store/userStore');
    const userState = useUserStore.getState();
    
    if (!userState.isInitialized) {
      console.log('⏳ Waiting for user store to initialize...');
      // Force initialization
      userState.initialize();
      
      // Wait for it to complete
      await new Promise((resolve) => {
        const checkInit = () => {
          const currentState = useUserStore.getState();
          if (currentState.isInitialized) {
            resolve();
          } else {
            setTimeout(checkInit, 100);
          }
        };
        checkInit();
      });
    }
    
    const finalUserState = useUserStore.getState();
    if (!finalUserState.user) {
      throw new Error('User not authenticated after initialization');
    }
    
    console.log('✅ User store initialized:', finalUserState.user.uid);
    
    // 2. Force sync store initialization
    const { useSyncStore } = await import('./src/store/syncStore');
    console.log('🔄 Initializing sync store...');
    
    await useSyncStore.getState().initializeSync();
    
    const syncState = useSyncStore.getState();
    console.log('✅ Sync store initialized:', {
      syncEnabled: syncState.syncEnabled,
      error: syncState.syncError
    });
    
    if (!syncState.syncEnabled) {
      throw new Error('Sync not enabled after initialization');
    }
    
    // 3. Force webhook monitoring to start
    console.log('🔔 Starting webhook monitoring...');
    useSyncStore.getState().startWebhookMonitoring();
    
    const finalSyncState = useSyncStore.getState();
    console.log('✅ Webhook monitoring started:', {
      hasWebhookMonitoring: !!finalSyncState.webhookMonitoringInterval,
      hasSyncStateListener: !!finalSyncState.syncStateListener
    });
    
    return {
      success: true,
      userInitialized: true,
      syncEnabled: finalSyncState.syncEnabled,
      webhookMonitoring: !!finalSyncState.webhookMonitoringInterval
    };
    
  } catch (error) {
    console.error('❌ Force initialization failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Step 3: Test webhook functionality
 */
async function testWebhookFunctionality() {
  console.log('\n🧪 TESTING WEBHOOK FUNCTIONALITY...');
  
  try {
    const { useUserStore } = await import('./src/store/userStore');
    const { useSyncStore } = await import('./src/store/syncStore');
    const { db } = await import('./src/api/firebase');
    const { doc, updateDoc } = await import('firebase/firestore');
    
    const user = useUserStore.getState().user;
    if (!user) {
      throw new Error('No user available for testing');
    }
    
    console.log('📡 Setting up webhook trigger test...');
    
    // Set up listener to watch for sync activity
    let syncDetected = false;
    const syncState = useSyncStore.getState();
    
    // Monitor console for sync logs
    const originalConsoleLog = console.log;
    console.log = (...args) => {
      const message = args.join(' ');
      if (message.includes('WEBHOOK-TRIGGERED SYNC DETECTED') || 
          message.includes('STARTING INCREMENTAL SYNC FROM WEBHOOK')) {
        syncDetected = true;
        console.log('🎯 WEBHOOK SYNC DETECTED!');
      }
      originalConsoleLog(...args);
    };
    
    // Trigger webhook by updating sync state
    const syncStateRef = doc(db, 'syncStates', user.uid);
    await updateDoc(syncStateRef, {
      webhookTriggeredSync: true,
      lastWebhookNotification: new Date(),
      testTrigger: true,
      updatedAt: new Date()
    });
    
    console.log('✅ Webhook trigger sent, waiting for response...');
    
    // Wait for sync to be detected
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Restore console.log
    console.log = originalConsoleLog;
    
    if (syncDetected) {
      console.log('🎉 WEBHOOK TEST PASSED! Sync was triggered.');
    } else {
      console.warn('⚠️ WEBHOOK TEST FAILED! No sync activity detected.');
    }
    
    return { success: syncDetected, syncDetected };
    
  } catch (error) {
    console.error('❌ Webhook test failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Main fix function
 */
async function fixWebhookInitialization() {
  console.log('🚀 STARTING WEBHOOK INITIALIZATION FIX...\n');
  
  // Step 1: Diagnose current state
  const diagnosis = await diagnoseCurrentState();
  
  if (!diagnosis) {
    console.error('❌ Cannot proceed - diagnosis failed');
    return { success: false, step: 'diagnosis' };
  }
  
  // Step 2: Force proper initialization if needed
  if (!diagnosis.hasWebhookMonitoring || !diagnosis.syncEnabled) {
    console.log('🔧 Issues detected, forcing proper initialization...');
    const initResult = await forceProperInitialization();
    
    if (!initResult.success) {
      console.error('❌ Initialization fix failed:', initResult.error);
      return { success: false, step: 'initialization', error: initResult.error };
    }
  } else {
    console.log('✅ Initialization appears correct, proceeding to test...');
  }
  
  // Step 3: Test webhook functionality
  const testResult = await testWebhookFunctionality();
  
  if (testResult.success) {
    console.log('\n🎉 WEBHOOK FIX COMPLETED SUCCESSFULLY!');
    console.log('✅ Webhooks should now work when you create Google Calendar tasks');
  } else {
    console.log('\n⚠️ WEBHOOK FIX PARTIALLY SUCCESSFUL');
    console.log('🔧 Initialization fixed, but webhook test failed');
    console.log('💡 Try creating a task in Google Calendar to test manually');
  }
  
  return { 
    success: testResult.success, 
    step: 'complete',
    testResult 
  };
}

/**
 * Continuous monitoring function
 */
function startWebhookMonitoring() {
  console.log('\n🔍 STARTING CONTINUOUS WEBHOOK MONITORING...');
  
  import('./src/api/firebase').then(async ({ db }) => {
    const { doc, onSnapshot } = await import('firebase/firestore');
    const { useUserStore } = await import('./src/store/userStore');
    
    const user = useUserStore.getState().user;
    if (!user) {
      console.error('❌ No user available for monitoring');
      return;
    }
    
    const syncStateRef = doc(db, 'syncStates', user.uid);
    
    const unsubscribe = onSnapshot(syncStateRef, (docSnapshot) => {
      const timestamp = new Date().toISOString();
      
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        console.log(`🔔 [${timestamp}] SYNC STATE CHANGE:`, {
          webhookTriggeredSync: data.webhookTriggeredSync,
          lastWebhookNotification: data.lastWebhookNotification?.toDate?.()?.toISOString(),
          isEnabled: data.isEnabled
        });
        
        if (data.webhookTriggeredSync === true) {
          console.log('🚨 WEBHOOK TRIGGER DETECTED! Watch for sync activity...');
        }
      }
    }, (error) => {
      console.error('❌ Monitoring error:', error);
    });
    
    window.stopWebhookMonitoring = unsubscribe;
    console.log('✅ Monitoring started. Use stopWebhookMonitoring() to stop.');
  });
}

// Export functions to global scope
window.fixWebhookInitialization = fixWebhookInitialization;
window.diagnoseWebhookState = diagnoseCurrentState;
window.forceWebhookInit = forceProperInitialization;
window.testWebhookFunction = testWebhookFunctionality;
window.startWebhookMonitoring = startWebhookMonitoring;

// Auto-run the fix
console.log('🎬 AUTO-RUNNING WEBHOOK INITIALIZATION FIX...');
fixWebhookInitialization().then((result) => {
  console.log('\n' + '='.repeat(50));
  console.log('🏁 WEBHOOK INITIALIZATION FIX COMPLETED');
  console.log('='.repeat(50));
  console.log('\n📖 NEXT STEPS:');
  console.log('1. Run: startWebhookMonitoring()');
  console.log('2. Create a task in Google Calendar');
  console.log('3. Watch console for webhook activity');
  console.log('4. Use stopWebhookMonitoring() when done');
  console.log('\n🔧 Available functions:');
  console.log('- fixWebhookInitialization() - Run fix again');
  console.log('- diagnoseWebhookState() - Check current state');
  console.log('- testWebhookFunction() - Test webhook manually');
});