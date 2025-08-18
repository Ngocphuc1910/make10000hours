/**
 * Debug Script for Session-Based Sync Investigation
 * Run this in console to trace exactly what's happening during sync
 */

// Expose debug functions to window
declare global {
  interface Window {
    debugSessionSync: () => Promise<void>;
    debugExtensionListener: () => void;
    debugSyncFlow: () => Promise<void>;
    debugFirebaseWrites: () => void;
    simulateExtensionMessage: () => void;
  }
}

// Debug function to check extension listener status
window.debugExtensionListener = () => {
  console.log('🔍 =========================');
  console.log('🔍 EXTENSION LISTENER DEBUG');
  console.log('🔍 =========================');
  
  // Check if extension listener is imported and initialized
  import('../services/extensionSyncListener').then(({ extensionSyncListener }) => {
    console.log('✅ Extension sync listener imported successfully');
    
    // Access private properties via prototype (for debugging only)
    const listener = extensionSyncListener as any;
    console.log('🔍 Listener state:', {
      isInitialized: listener.isInitialized,
      hasMessageHandler: !!listener.messageHandler,
      hasChromeMessageHandler: !!listener.chromeMessageHandler
    });
    
    // Check if message listeners are attached
    const hasWindowListeners = window.removeEventListener ? true : false;
    console.log('🔍 Window has event listeners capability:', hasWindowListeners);
    
    // Try to trigger extension sync
    console.log('🔄 Testing triggerExtensionSync...');
    extensionSyncListener.triggerExtensionSync()
      .then(() => console.log('✅ triggerExtensionSync completed'))
      .catch(err => console.error('❌ triggerExtensionSync failed:', err));
      
  }).catch(err => {
    console.error('❌ Failed to import extension sync listener:', err);
  });
};

// Debug function to trace the complete sync flow
window.debugSyncFlow = async () => {
  console.log('🔍 ============================');
  console.log('🔍 COMPLETE SYNC FLOW DEBUG');
  console.log('🔍 ============================');
  
  try {
    // 1. Check user authentication
    const { useUserStore } = await import('../store/userStore');
    const user = useUserStore.getState().user;
    console.log('👤 User state:', { 
      authenticated: !!user,
      uid: user?.uid,
      email: user?.email 
    });
    
    if (!user?.uid) {
      console.error('❌ No authenticated user - sync will fail');
      return;
    }
    
    // 2. Check extension sync listener
    const { extensionSyncListener } = await import('../services/extensionSyncListener');
    console.log('📡 Extension sync listener:', {
      exists: !!extensionSyncListener,
      initialized: (extensionSyncListener as any).isInitialized
    });
    
    // 3. Check Firebase service
    const { siteUsageSessionService } = await import('../api/siteUsageSessionService');
    console.log('🔥 Firebase service:', {
      exists: !!siteUsageSessionService,
      collectionName: (siteUsageSessionService as any).collectionName
    });
    
    // 4. Check dashboard store
    const { useDeepFocusDashboardStore } = await import('../store/deepFocusDashboardStore');
    const store = useDeepFocusDashboardStore.getState();
    console.log('📊 Dashboard store:', {
      hasLoadSessionData: typeof store.loadSessionData === 'function',
      currentSessionData: store.siteUsageData?.length || 0,
      currentOnScreenTime: store.onScreenTime || 0
    });
    
    // 5. Test the sync flow
    console.log('🔄 Testing sync flow...');
    await extensionSyncListener.triggerExtensionSync();
    
    // 6. Wait a moment and check for session data
    setTimeout(async () => {
      await store.loadSessionData();
      const updatedStore = useDeepFocusDashboardStore.getState();
      console.log('📈 After sync - store state:', {
        sessionData: updatedStore.siteUsageData?.length || 0,
        onScreenTime: updatedStore.onScreenTime || 0
      });
    }, 2000);
    
  } catch (error) {
    console.error('❌ Sync flow debug failed:', error);
  }
};

// Debug function to monitor Firebase writes
window.debugFirebaseWrites = () => {
  console.log('🔍 ===========================');
  console.log('🔍 FIREBASE WRITES MONITOR');
  console.log('🔍 ===========================');
  
  // Intercept Firebase writes to see what's being written where
  const originalWrite = console.log;
  
  // Monitor console for Firebase-related logs
  const originalLog = console.log;
  const originalError = console.error;
  
  console.log = (...args: any[]) => {
    const message = args.join(' ');
    if (message.includes('Firebase') || message.includes('collection') || message.includes('dailySiteUsage') || message.includes('siteUsageSessions')) {
      originalLog('🔥 FIREBASE LOG:', ...args);
    } else {
      originalLog(...args);
    }
  };
  
  console.error = (...args: any[]) => {
    const message = args.join(' ');
    if (message.includes('Firebase') || message.includes('collection') || message.includes('sync')) {
      originalError('🔥 FIREBASE ERROR:', ...args);
    } else {
      originalError(...args);
    }
  };
  
  console.log('✅ Firebase write monitoring enabled');
  
  // Restore after 30 seconds
  setTimeout(() => {
    console.log = originalLog;
    console.error = originalError;
    console.log('✅ Firebase write monitoring disabled');
  }, 30000);
};

// Simulate extension message to test listener
window.simulateExtensionMessage = () => {
  console.log('🔍 ===============================');
  console.log('🔍 SIMULATING EXTENSION MESSAGE');
  console.log('🔍 ===============================');
  
  const mockSessionData = [
    {
      domain: 'test-domain.com',
      duration: 300, // 5 minutes in seconds
      startTimeUTC: new Date().toISOString(),
      endTimeUTC: new Date(Date.now() + 300000).toISOString(),
      status: 'completed',
      utcDate: new Date().toISOString().split('T')[0],
      userId: 'test-user-id'
    }
  ];
  
  // Send mock message
  window.postMessage({
    type: 'EXTENSION_SITE_USAGE_SESSION_BATCH',
    payload: {
      sessions: mockSessionData
    }
  }, '*');
  
  console.log('📤 Mock extension message sent:', mockSessionData);
};

// Main debug function
window.debugSessionSync = async () => {
  console.log('🚀 ================================');
  console.log('🚀 SESSION SYNC COMPREHENSIVE DEBUG');
  console.log('🚀 ================================');
  
  // Run all debug functions
  window.debugExtensionListener();
  
  setTimeout(() => {
    window.debugSyncFlow();
  }, 1000);
  
  setTimeout(() => {
    window.debugFirebaseWrites();
  }, 2000);
  
  setTimeout(() => {
    window.simulateExtensionMessage();
  }, 3000);
  
  console.log('🔍 Debug sequence initiated. Check console for results over next 30 seconds.');
};

export {};