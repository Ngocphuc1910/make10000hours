/**
 * Test Script for Blocking Sites Sync Between Web App and Extension
 * 
 * This script tests the bidirectional sync functionality between
 * the web app and browser extension for blocking sites.
 */

console.log('🧪 Testing Blocking Sites Sync Functionality');

// Helper functions for testing
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const testBlockingSiteSync = async () => {
  console.log('\n📋 Test Plan:');
  console.log('1. Check if extension is installed and connected');
  console.log('2. Test web app → extension sync');
  console.log('3. Test extension → web app sync (simulated)');
  console.log('4. Test conflict resolution');
  console.log('5. Verify consistency after operations\n');

  try {
    // Test 1: Check extension connectivity
    console.log('🔍 Test 1: Checking extension connectivity...');
    
    if (typeof window !== 'undefined' && window.ExtensionDataService) {
      const isInstalled = window.ExtensionDataService.isExtensionInstalled();
      console.log(`Extension installed: ${isInstalled}`);
      
      if (isInstalled) {
        try {
          const isConnected = await window.ExtensionDataService.testConnection();
          console.log(`Extension connected: ${isConnected}`);
        } catch (error) {
          console.warn('Extension connection test failed:', error.message);
        }
      } else {
        console.warn('❌ Extension not installed - sync tests will be skipped');
        return;
      }
    } else {
      console.warn('❌ ExtensionDataService not available - running in wrong context');
      return;
    }

    // Test 2: Web app → Extension sync
    console.log('\n🔄 Test 2: Testing web app → extension sync...');
    
    // Sample blocked sites data
    const testSites = [
      'facebook.com',
      'twitter.com', 
      'instagram.com',
      'tiktok.com',
      'youtube.com'
    ];
    
    console.log(`Syncing ${testSites.length} test sites to extension...`);
    
    try {
      const syncResult = await window.ExtensionDataService.syncBlockedSitesFromWebApp(testSites);
      console.log('Sync result:', syncResult);
      
      if (syncResult.success) {
        console.log(`✅ Successfully synced ${syncResult.synced} sites`);
        if (syncResult.failed > 0) {
          console.warn(`⚠️ ${syncResult.failed} sites failed to sync`);
        }
      } else {
        console.error('❌ Sync failed:', syncResult.error);
      }
    } catch (error) {
      console.error('❌ Sync operation failed:', error);
    }

    await sleep(1000);

    // Test 3: Verify sync by getting blocked sites from extension
    console.log('\n🔍 Test 3: Verifying sync by reading from extension...');
    
    try {
      const getResult = await window.ExtensionDataService.sendMessage({ type: 'GET_BLOCKED_SITES' });
      console.log('Extension blocked sites:', getResult);
      
      if (getResult.success && getResult.data) {
        const extensionSites = getResult.data;
        console.log(`Extension has ${extensionSites.length} blocked sites:`, extensionSites);
        
        // Check if our test sites are present
        const missingSites = testSites.filter(site => !extensionSites.includes(site));
        const extraSites = extensionSites.filter(site => !testSites.includes(site));
        
        if (missingSites.length === 0 && extraSites.length === 0) {
          console.log('✅ Perfect sync - all sites match');
        } else {
          if (missingSites.length > 0) {
            console.warn('⚠️ Missing sites in extension:', missingSites);
          }
          if (extraSites.length > 0) {
            console.warn('⚠️ Extra sites in extension:', extraSites);
          }
        }
      }
    } catch (error) {
      console.error('❌ Failed to get blocked sites from extension:', error);
    }

    // Test 4: Test individual site operations
    console.log('\n🎯 Test 4: Testing individual site operations...');
    
    const testSite = 'reddit.com';
    console.log(`Adding ${testSite} to blocked sites...`);
    
    try {
      const addResult = await window.ExtensionDataService.blockSite(testSite);
      console.log('Add result:', addResult);
      
      await sleep(500);
      
      console.log(`Removing ${testSite} from blocked sites...`);
      const removeResult = await window.ExtensionDataService.unblockSite(testSite);
      console.log('Remove result:', removeResult);
    } catch (error) {
      console.error('❌ Individual site operations failed:', error);
    }

    // Test 5: Test batch operations
    console.log('\n📦 Test 5: Testing batch operations...');
    
    const batchSites = ['linkedin.com', 'snapchat.com', 'tiktok.com'];
    console.log(`Batch blocking ${batchSites.length} sites...`);
    
    try {
      const batchResult = await window.ExtensionDataService.blockMultipleSites(batchSites);
      console.log('Batch result:', batchResult);
      
      if (batchResult.success && batchResult.summary) {
        const { successCount, failureCount, total } = batchResult.summary;
        console.log(`✅ Batch operation: ${successCount}/${total} succeeded, ${failureCount} failed`);
      }
    } catch (error) {
      console.error('❌ Batch operation failed:', error);
    }

    console.log('\n🎉 Sync functionality tests completed!');
    console.log('\n📊 Summary:');
    console.log('- Extension connectivity: Tested');
    console.log('- Web app → Extension sync: Tested');
    console.log('- Extension data retrieval: Tested');
    console.log('- Individual operations: Tested');
    console.log('- Batch operations: Tested');

  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
};

// Helper function to test sync in web app context
const testWebAppSync = async () => {
  console.log('\n🌐 Testing Web App Sync Functions...');
  
  if (typeof window !== 'undefined' && window.useDeepFocusStore) {
    try {
      const store = window.useDeepFocusStore.getState();
      
      console.log('Current blocked sites in store:', store.blockedSites.length);
      
      // Test sync function
      if (store.syncBlockedSitesToExtension) {
        console.log('🔄 Testing syncBlockedSitesToExtension...');
        await store.syncBlockedSitesToExtension();
        console.log('✅ Sync function executed');
      } else {
        console.warn('⚠️ syncBlockedSitesToExtension not available');
      }
      
    } catch (error) {
      console.error('❌ Web app sync test failed:', error);
    }
  } else {
    console.warn('⚠️ useDeepFocusStore not available - not in web app context');
  }
};

// Main test runner
const runTests = async () => {
  console.log('🚀 Starting Blocking Sites Sync Tests...\n');
  
  await testBlockingSiteSync();
  await testWebAppSync();
  
  console.log('\n✅ All tests completed!');
  console.log('\n📝 To run these tests:');
  console.log('1. Open the web app in a browser with the extension installed');
  console.log('2. Open browser dev tools console');
  console.log('3. Paste and run this script');
  console.log('4. Observe the test results in the console');
};

// Auto-run if in browser context
if (typeof window !== 'undefined') {
  runTests().catch(console.error);
} else {
  console.log('📋 This script should be run in a browser context with the extension installed.');
}

// Export for manual testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testBlockingSiteSync, testWebAppSync, runTests };
}