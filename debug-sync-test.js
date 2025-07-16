// Debug Sync Test Script
// Copy and paste this into the browser console on the Deep Focus page

console.log('🔧 Starting sync debug test...');

// Test script to manually trigger sync and debug the issue
(async function debugSyncTest() {
  try {
    console.log('📋 Step 1: Checking user authentication...');
    
    // Access the stores directly
    const { useUserStore } = await import('./src/store/userStore.js');
    const { useDeepFocusStore } = await import('./src/store/deepFocusStore.js');
    
    const user = useUserStore.getState().user;
    console.log('👤 User:', user?.uid ? `✅ ${user.uid}` : '❌ Not authenticated');
    
    if (!user?.uid) {
      console.error('❌ User not authenticated - cannot test sync');
      return;
    }
    
    console.log('📋 Step 2: Testing extension connection...');
    
    // Test extension connection
    const ExtensionDataService = (await import('./src/services/extensionDataService.js')).default;
    const isInstalled = ExtensionDataService.isExtensionInstalled();
    console.log('🔌 Extension installed:', isInstalled ? '✅ Yes' : '❌ No');
    
    if (!isInstalled) {
      console.error('❌ Extension not installed - cannot test sync');
      return;
    }
    
    console.log('📋 Step 3: Getting extension data...');
    
    // Get today's stats from extension
    const extensionResponse = await ExtensionDataService.getTodayStats();
    console.log('📊 Extension response:', extensionResponse);
    
    console.log('📋 Step 4: Testing date calculation...');
    
    // Test date calculation
    const { formatLocalDate } = await import('./src/utils/timeUtils.js');
    const today = formatLocalDate(new Date());
    console.log('📅 Calculated date (local):', today);
    console.log('📅 Expected date should be: 2025-07-16');
    
    if (today !== '2025-07-16') {
      console.warn('⚠️ Date mismatch detected!');
    }
    
    console.log('📋 Step 5: Testing Firebase backup...');
    
    // Test Firebase backup
    const { siteUsageService } = await import('./src/api/siteUsageService.js');
    const dataToBackup = extensionResponse.data || extensionResponse;
    const documentId = `${user.uid}_${today}`;
    
    console.log('🔍 Document ID will be:', documentId);
    console.log('🔍 Data to backup:', dataToBackup);
    
    // Manual backup call
    console.log('💾 Calling siteUsageService.backupDayData...');
    await siteUsageService.backupDayData(user.uid, today, dataToBackup);
    console.log('✅ Firebase backup completed');
    
    console.log('📋 Step 6: Testing store backup function...');
    
    // Test the store function
    const backupTodayData = useDeepFocusStore.getState().backupTodayData;
    console.log('🎯 Calling store backupTodayData function...');
    await backupTodayData();
    console.log('✅ Store backup function completed');
    
    console.log('🎉 Debug test completed successfully!');
    
  } catch (error) {
    console.error('❌ Debug test failed:', error);
    console.error('🔍 Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
  }
})();

console.log('🔧 Debug script loaded. Check output above.');