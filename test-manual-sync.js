/**
 * Test Manual Deep Focus Sync
 * This will test if manual sync to Firebase works
 */

console.log('🔄 Testing Manual Deep Focus Sync...');

async function testManualSync() {
  try {
    // Import the required modules
    const { DeepFocusSync } = await import('./src/services/deepFocusSync.js');
    const { useUserStore } = await import('./src/store/userStore.js');
    
    // Get current user
    const user = useUserStore.getState().user;
    if (!user?.uid) {
      console.error('❌ No authenticated user found');
      return;
    }
    
    console.log('👤 User authenticated:', user.uid);
    console.log('🔄 Starting manual sync...');
    
    // Try manual sync
    const result = await DeepFocusSync.smartSync(user.uid, 'today');
    console.log('📊 Manual sync result:', result);
    
    if (result.success) {
      console.log('✅ Manual sync successful!');
      if (result.syncedSessions > 0) {
        console.log(`🎉 Synced ${result.syncedSessions} sessions to Firebase`);
      } else {
        console.log('ℹ️ No new sessions to sync');
      }
    } else {
      console.error('❌ Manual sync failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Manual sync test failed:', error);
  }
}

// Run the test
testManualSync();