/**
 * EMERGENCY: Recover automatic Google Calendar sync
 */

async function emergencySyncRecovery() {
  console.log('🚨 EMERGENCY SYNC RECOVERY STARTING...');
  
  try {
    // Step 1: Check user authentication first
    const { useUserStore } = await import('./src/store/userStore');
    
    // Wait for user store to be ready
    let user = useUserStore.getState().user;
    if (!user) {
      console.log('⏳ Waiting for user authentication...');
      await new Promise((resolve) => {
        const unsubscribe = useUserStore.subscribe((state) => {
          if (state.user) {
            unsubscribe();
            resolve();
          }
        });
      });
      user = useUserStore.getState().user;
    }
    
    console.log('✅ User authenticated:', user.uid);
    
    // Step 2: Force restart all sync systems
    const { useSyncStore } = await import('./src/store/syncStore');
    
    console.log('🛑 Stopping all existing sync monitoring...');
    useSyncStore.getState().stopWebhookMonitoring();
    
    console.log('🚀 Starting fresh webhook monitoring...');
    useSyncStore.getState().startWebhookMonitoring();
    
    // Step 3: Force fresh full sync to regenerate sync token
    const { createSyncManager } = await import('./src/services/sync/syncManager');
    const syncManager = createSyncManager(user.uid);
    
    console.log('🔄 Forcing fresh full sync to regenerate sync token...');
    await syncManager.performFullSync();
    
    // Step 4: Verify sync state
    const syncState = await syncManager.getSyncState();
    console.log('📊 Sync state after recovery:', {
      isEnabled: syncState?.isEnabled,
      hasNextSyncToken: !!syncState?.nextSyncToken,
      lastFullSync: syncState?.lastFullSync,
      webhookTriggeredSync: syncState?.webhookTriggeredSync
    });
    
    // Step 5: Check current monitoring status
    const currentSyncState = useSyncStore.getState();
    console.log('📊 Current monitoring status:', {
      syncEnabled: currentSyncState.syncEnabled,
      webhookMonitoringActive: !!currentSyncState.webhookMonitoringInterval,
      syncStateListenerActive: !!currentSyncState.syncStateListener
    });
    
    if (syncState?.nextSyncToken) {
      console.log('✅ RECOVERY SUCCESSFUL!');
      console.log('🎯 Automatic sync should work now - try creating a Google Calendar task');
    } else {
      console.error('❌ RECOVERY FAILED: No sync token generated');
      console.log('💡 Try running this again or manually sync from settings');
    }
    
  } catch (error) {
    console.error('❌ Emergency recovery failed:', error);
  }
}

// Make available
if (typeof window !== 'undefined') {
  window.emergencySyncRecovery = emergencySyncRecovery;
  console.log('🆘 Emergency recovery available as: emergencySyncRecovery()');
}