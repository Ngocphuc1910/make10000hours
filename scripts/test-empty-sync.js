/**
 * Quick Test Script for Empty Blocking Sites Sync
 * 
 * This script specifically tests the scenario where all blocking sites
 * are deleted from the web app and should be cleared from the extension.
 */

console.log('🧪 Testing Empty Blocking Sites Sync');

const testEmptySync = async () => {
  try {
    // Check if we're in the right context
    if (typeof window === 'undefined' || !window.ExtensionDataService) {
      console.error('❌ This script must be run in the web app browser console');
      return;
    }

    console.log('🔍 Step 1: Checking extension connection...');
    const isInstalled = window.ExtensionDataService.isExtensionInstalled();
    console.log(`Extension installed: ${isInstalled}`);
    
    if (!isInstalled) {
      console.error('❌ Extension not installed - cannot test sync');
      return;
    }

    // Test connection
    try {
      const isConnected = await window.ExtensionDataService.testConnection();
      console.log(`Extension connected: ${isConnected}`);
      
      if (!isConnected) {
        console.error('❌ Extension not responding - cannot test sync');
        return;
      }
    } catch (error) {
      console.error('❌ Extension connection failed:', error);
      return;
    }

    console.log('🔍 Step 2: Getting current blocked sites from extension...');
    try {
      const currentSites = await window.ExtensionDataService.sendMessage({ type: 'GET_BLOCKED_SITES' });
      console.log('Current extension blocked sites:', currentSites);
      
      if (currentSites.success) {
        console.log(`Extension currently has ${currentSites.data.length} blocked sites:`, currentSites.data);
      }
    } catch (error) {
      console.warn('⚠️ Could not get current sites:', error);
    }

    console.log('🧹 Step 3: Testing empty sync (clearing all sites)...');
    
    // Test syncing empty array
    const emptyArray = [];
    const syncResult = await window.ExtensionDataService.syncBlockedSitesFromWebApp(emptyArray);
    console.log('Empty sync result:', syncResult);
    
    if (syncResult.success) {
      console.log(`✅ Empty sync successful - synced ${syncResult.synced} sites, failed ${syncResult.failed}`);
    } else {
      console.error('❌ Empty sync failed:', syncResult.error);
      return;
    }

    // Wait a moment for the sync to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('🔍 Step 4: Verifying sites were cleared from extension...');
    try {
      const afterSyncSites = await window.ExtensionDataService.sendMessage({ type: 'GET_BLOCKED_SITES' });
      console.log('After sync blocked sites:', afterSyncSites);
      
      if (afterSyncSites.success) {
        const siteCount = afterSyncSites.data.length;
        console.log(`Extension now has ${siteCount} blocked sites:`, afterSyncSites.data);
        
        if (siteCount === 0) {
          console.log('✅ SUCCESS: All sites cleared from extension!');
        } else {
          console.error('❌ FAILURE: Extension still has blocked sites:', afterSyncSites.data);
        }
      }
    } catch (error) {
      console.error('❌ Could not verify sync result:', error);
    }

    console.log('🔍 Step 5: Testing with a few sites to verify sync still works...');
    
    const testSites = ['test1.com', 'test2.com'];
    const testSyncResult = await window.ExtensionDataService.syncBlockedSitesFromWebApp(testSites);
    console.log('Test sites sync result:', testSyncResult);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const finalCheck = await window.ExtensionDataService.sendMessage({ type: 'GET_BLOCKED_SITES' });
    if (finalCheck.success) {
      console.log(`Final verification - extension has ${finalCheck.data.length} sites:`, finalCheck.data);
    }

    console.log('🎉 Empty sync test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

// Auto-run the test
testEmptySync().catch(console.error);

console.log('\n📝 Instructions:');
console.log('1. Open the web app in a browser with the extension installed');
console.log('2. Open browser dev tools console');
console.log('3. Paste and run this script');
console.log('4. Observe test results - all sites should be cleared from extension');