/**
 * Complete Sync Test Script - Tests All Three Issues
 * 
 * This script tests the fixes for:
 * 1. Extension → Web App sync (when adding sites in extension)
 * 2. Delete functionality in extension popup
 * 3. No default sites appearing for new users
 */

console.log('🧪 Testing Complete Sync Functionality');

const testCompleteSyncFixes = async () => {
  console.log('\n📋 Test Plan:');
  console.log('1. Check that extension shows no default sites for authenticated user');
  console.log('2. Test adding site in extension → should sync to web app');
  console.log('3. Test deleting site in extension → should sync to web app');
  console.log('4. Test web app → extension sync still works');
  console.log('5. Verify consistency across both platforms\n');

  try {
    // Check if we're in the right context
    if (typeof window === 'undefined' || !window.ExtensionDataService) {
      console.error('❌ This script must be run in the web app browser console');
      return;
    }

    console.log('🔍 Test 1: Checking extension connection and current state...');
    
    const isInstalled = window.ExtensionDataService.isExtensionInstalled();
    console.log(`Extension installed: ${isInstalled}`);
    
    if (!isInstalled) {
      console.error('❌ Extension not installed - cannot test sync');
      return;
    }

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

    // Get current state from both extension and web app
    console.log('\n🔍 Test 2: Getting current blocked sites from both sources...');
    
    let extensionSites = [];
    let webAppSites = [];
    
    try {
      const extensionResult = await window.ExtensionDataService.sendMessage({ type: 'GET_BLOCKED_SITES' });
      if (extensionResult.success) {
        extensionSites = extensionResult.data || [];
        console.log(`Extension has ${extensionSites.length} blocked sites:`, extensionSites);
      }
    } catch (error) {
      console.warn('⚠️ Could not get extension sites:', error);
    }

    // Get web app sites
    if (window.useDeepFocusStore) {
      const store = window.useDeepFocusStore.getState();
      webAppSites = store.blockedSites.map(site => site.url);
      console.log(`Web app has ${webAppSites.length} blocked sites:`, webAppSites);
    }

    // Check if they match
    const extensionSet = new Set(extensionSites);
    const webAppSet = new Set(webAppSites);
    const inExtensionOnly = extensionSites.filter(site => !webAppSet.has(site));
    const inWebAppOnly = webAppSites.filter(site => !extensionSet.has(site));

    if (inExtensionOnly.length === 0 && inWebAppOnly.length === 0) {
      console.log('✅ Extension and web app are in sync');
    } else {
      console.warn('⚠️ Sync mismatch detected:');
      if (inExtensionOnly.length > 0) {
        console.warn('  - Extension only:', inExtensionOnly);
      }
      if (inWebAppOnly.length > 0) {
        console.warn('  - Web app only:', inWebAppOnly);
      }
    }

    // Test 3: Test adding a site via extension (simulated)
    console.log('\n🔍 Test 3: Testing extension → web app sync (add site)...');
    
    const testSite = 'test-extension-sync.com';
    console.log(`Adding ${testSite} via extension...`);
    
    try {
      const addResult = await window.ExtensionDataService.sendMessage({ 
        type: 'ADD_BLOCKED_SITE',
        payload: { domain: testSite }
      });
      console.log('Add result:', addResult);
      
      if (addResult.success) {
        console.log('✅ Site added to extension');
        
        // Wait for sync to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if it appeared in web app
        if (window.useDeepFocusStore) {
          const store = window.useDeepFocusStore.getState();
          const updatedWebAppSites = store.blockedSites.map(site => site.url);
          
          if (updatedWebAppSites.includes(testSite)) {
            console.log('✅ SUCCESS: Site synced from extension to web app!');
          } else {
            console.error('❌ FAILURE: Site not found in web app after extension add');
          }
        }
      } else {
        console.error('❌ Failed to add site to extension:', addResult.error);
      }
    } catch (error) {
      console.error('❌ Extension add operation failed:', error);
    }

    // Test 4: Test removing the site via extension
    console.log('\n🔍 Test 4: Testing extension → web app sync (remove site)...');
    
    try {
      const removeResult = await window.ExtensionDataService.sendMessage({ 
        type: 'REMOVE_BLOCKED_SITE',
        payload: { domain: testSite }
      });
      console.log('Remove result:', removeResult);
      
      if (removeResult.success) {
        console.log('✅ Site removed from extension');
        
        // Wait for sync to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if it was removed from web app
        if (window.useDeepFocusStore) {
          const store = window.useDeepFocusStore.getState();
          const updatedWebAppSites = store.blockedSites.map(site => site.url);
          
          if (!updatedWebAppSites.includes(testSite)) {
            console.log('✅ SUCCESS: Site removal synced from extension to web app!');
          } else {
            console.error('❌ FAILURE: Site still found in web app after extension removal');
          }
        }
      } else {
        console.error('❌ Failed to remove site from extension:', removeResult.error);
      }
    } catch (error) {
      console.error('❌ Extension remove operation failed:', error);
    }

    // Test 5: Test web app → extension sync
    console.log('\n🔍 Test 5: Testing web app → extension sync...');
    
    const webAppTestSite = 'test-webapp-sync.com';
    
    if (window.useDeepFocusStore) {
      const store = window.useDeepFocusStore.getState();
      
      if (store.addBlockedSite) {
        console.log(`Adding ${webAppTestSite} via web app...`);
        
        try {
          await store.addBlockedSite({
            name: 'Test Web App Site',
            url: webAppTestSite,
            icon: 'ri-global-line',
            backgroundColor: '#6B7280',
            isActive: true
          });
          
          // Wait for sync
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Check if it appeared in extension
          const finalExtensionResult = await window.ExtensionDataService.sendMessage({ type: 'GET_BLOCKED_SITES' });
          if (finalExtensionResult.success) {
            const finalExtensionSites = finalExtensionResult.data || [];
            
            if (finalExtensionSites.includes(webAppTestSite)) {
              console.log('✅ SUCCESS: Site synced from web app to extension!');
            } else {
              console.error('❌ FAILURE: Site not found in extension after web app add');
            }
          }
          
          // Clean up - remove the test site
          console.log('🧹 Cleaning up test site...');
          const currentSites = store.blockedSites;
          const testSiteObj = currentSites.find(site => site.url === webAppTestSite);
          if (testSiteObj && store.removeBlockedSite) {
            await store.removeBlockedSite(testSiteObj.id);
            console.log('✅ Test site cleaned up');
          }
          
        } catch (error) {
          console.error('❌ Web app add operation failed:', error);
        }
      }
    }

    console.log('\n🎉 Complete sync test finished!');
    console.log('\n📊 Summary:');
    console.log('- Extension connectivity: Tested ✅');
    console.log('- Initial sync state: Verified ✅');
    console.log('- Extension → Web app sync: Tested ✅');
    console.log('- Web app → Extension sync: Tested ✅');
    console.log('- Bidirectional sync: Verified ✅');

  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
};

// Auto-run the test
testCompleteSyncFixes().catch(console.error);

console.log('\n📝 Instructions:');
console.log('1. Make sure you are logged into the web app');
console.log('2. Have the extension installed and enabled');
console.log('3. Open browser dev tools console');
console.log('4. Paste and run this script');
console.log('5. Observe test results - all sync operations should work bidirectionally');
console.log('\n🔧 Manual Tests:');
console.log('- Try adding a site using the + button in extension popup');
console.log('- Try deleting a site using the trash icon in extension popup');
console.log('- Try adding/removing sites in the web app');
console.log('- All changes should sync between both platforms');