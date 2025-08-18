/**
 * Debug Active Sync Services
 * Quick script to identify what sync services are running and interfering
 */

declare global {
  interface Window {
    debugActiveSyncs: () => Promise<void>;
    findDailySiteUsageWrites: () => void;
    interceptFirebaseWrites: () => void;
  }
}

// Find all code that writes to dailySiteUsage
window.findDailySiteUsageWrites = async () => {
  console.log('🔍 ===============================');
  console.log('🔍 FINDING dailySiteUsage WRITERS');
  console.log('🔍 ===============================');
  
  try {
    // Check siteUsageService (old service)
    const siteUsageService = await import('../api/siteUsageService').catch(() => null);
    if (siteUsageService) {
      console.log('❌ OLD siteUsageService found - this writes to dailySiteUsage');
      console.log('🔍 siteUsageService methods:', Object.getOwnPropertyNames(siteUsageService.siteUsageService));
    }
    
    // Check if backup services are imported anywhere
    const deepFocusSync = await import('../services/deepFocusSync').catch(() => null);
    if (deepFocusSync) {
      console.log('❌ DeepFocusSync found - this may write to dailySiteUsage');
      console.log('🔍 DeepFocusSync methods:', Object.getOwnPropertyNames(deepFocusSync.DeepFocusSync));
    }
    
    // Check useDeepFocusContext
    console.log('🔍 Checking if useDeepFocusContext is still active...');
    const contextModule = await import('../contexts/DeepFocusContext').catch(() => null);
    if (contextModule) {
      console.log('❌ DeepFocusContext found - this may contain backupTodayData');
    }
    
    console.log('✅ Scan complete. Any ❌ items above may be writing to dailySiteUsage');
    
  } catch (error) {
    console.error('❌ Error scanning for dailySiteUsage writers:', error);
  }
};

// Intercept all Firebase writes
window.interceptFirebaseWrites = () => {
  console.log('🔍 ===========================');
  console.log('🔍 INTERCEPTING FIREBASE WRITES');
  console.log('🔍 ===========================');
  
  // Try to intercept Firebase writes by monitoring collections
  const originalLog = console.log;
  
  // Override console to catch Firebase writes
  const originalConsoleLog = console.log;
  console.log = (...args: any[]) => {
    const message = args.join(' ');
    
    // Catch Firebase collection references
    if (message.includes('collection(') || message.includes('doc(') || message.includes('batch')) {
      originalConsoleLog('🔥 FIREBASE OPERATION:', ...args);
    }
    
    // Catch our specific collections
    if (message.includes('dailySiteUsage')) {
      originalConsoleLog('❌ OLD COLLECTION WRITE:', ...args);
    }
    
    if (message.includes('siteUsageSessions')) {
      originalConsoleLog('✅ NEW COLLECTION WRITE:', ...args);
    }
    
    originalConsoleLog(...args);
  };
  
  console.log('✅ Firebase write interception active for 30 seconds');
  
  // Restore after 30 seconds
  setTimeout(() => {
    console.log = originalConsoleLog;
    console.log('✅ Firebase write interception disabled');
  }, 30000);
};

// Main debug function for active syncs
window.debugActiveSyncs = async () => {
  console.log('🚀 ============================');
  console.log('🚀 DEBUG ACTIVE SYNC SERVICES');
  console.log('🚀 ============================');
  
  // 1. Check what services are loaded
  console.log('📋 Checking loaded services...');
  
  // Check if extension sync listener is working
  try {
    const { extensionSyncListener } = await import('../services/extensionSyncListener');
    console.log('✅ Extension sync listener:', {
      exists: !!extensionSyncListener,
      initialized: (extensionSyncListener as any).isInitialized
    });
  } catch (error) {
    console.log('❌ Extension sync listener not found:', error);
  }
  
  // Check what's in the deep focus context
  try {
    const { useDeepFocusContext } = await import('../contexts/DeepFocusContext');
    console.log('❌ DeepFocusContext exists - may have old backup methods');
  } catch (error) {
    console.log('✅ DeepFocusContext not found');
  }
  
  // 2. Check current page component
  console.log('📋 Checking current page component...');
  const currentPath = window.location.hash;
  console.log('🔍 Current path:', currentPath);
  
  // 3. Find all dailySiteUsage writers
  await window.findDailySiteUsageWrites();
  
  // 4. Start intercepting Firebase writes
  window.interceptFirebaseWrites();
  
  // 5. Check what happens when we trigger a sync
  console.log('🔄 Testing sync trigger...');
  try {
    // Simulate clicking the refresh button
    const refreshButton = document.querySelector('[title="Refresh extension data"]');
    if (refreshButton) {
      console.log('🔍 Found refresh button, simulating click...');
      (refreshButton as HTMLElement).click();
    } else {
      console.log('❌ Refresh button not found');
    }
  } catch (error) {
    console.log('❌ Error simulating sync:', error);
  }
  
  console.log('🔍 Active sync debug complete. Monitor console for Firebase writes.');
};

export {};