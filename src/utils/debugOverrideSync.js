/**
 * Debug Override Session Sync Flow
 * 
 * Run this in the web app console to diagnose why override sessions aren't syncing to Firebase
 * Usage: debugOverrideSync()
 */

window.debugOverrideSync = async function() {
  console.log('🔍 Starting Override Session Sync Debug...');
  console.log('=============================================');
  
  try {
    // Step 1: Check if user is authenticated
    console.log('\n📋 STEP 1: User Authentication Check');
    const { useUserStore } = await import('../store/userStore');
    const userStore = useUserStore.getState();
    const user = userStore.user;
    
    if (!user) {
      console.error('❌ No authenticated user found');
      return;
    }
    
    console.log('✅ User authenticated:', {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName
    });
    
    // Step 1.5: Force sync user ID to extension
    console.log('\n📋 STEP 1.5: Force Sync User ID to Extension');
    try {
      const userPayload = {
        userId: user.uid,
        uid: user.uid,
        userEmail: user.email,
        displayName: user.displayName,
        timezone: user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
      };
      
      // Try direct chrome extension message
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        console.log('🔄 Sending user ID to extension via chrome.runtime.sendMessage...');
        const response = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({
            type: 'SET_USER_INFO',
            payload: userPayload
          }, (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        });
        console.log('✅ User ID synced to extension:', response);
      } else {
        console.warn('⚠️ Chrome extension API not available - user sync may not work');
      }
    } catch (error) {
      console.warn('⚠️ Failed to sync user ID to extension:', error.message);
      console.log('🔄 Continuing with debug anyway...');
    }
    
    // Step 2: Check extension connectivity
    console.log('\n📋 STEP 2: Extension Connectivity Check');
    try {
      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Extension ping timeout')), 3000);
        
        window.postMessage({ 
          type: 'PING_EXTENSION',
          source: 'web-app',
          timestamp: Date.now()
        }, '*');
        
        const handler = (event) => {
          if (event.data?.type === 'EXTENSION_PONG') {
            clearTimeout(timeout);
            window.removeEventListener('message', handler);
            resolve(event.data);
          }
        };
        
        window.addEventListener('message', handler);
      });
      
      console.log('✅ Extension is responsive:', response);
    } catch (error) {
      console.warn('⚠️ Extension ping failed:', error.message);
      console.log('🔄 Continuing anyway...');
    }
    
    // Step 3: Test extension data request
    console.log('\n📋 STEP 3: Test Extension Data Request');
    const requestStartTime = Date.now();
    
    // Listen for extension response
    const extensionResponsePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Extension data request timeout')), 10000);
      
      const handler = (event) => {
        console.log('📨 Received message from extension:', event.data?.type);
        
        if (event.data?.type === 'EXTENSION_SITE_USAGE_SESSION_BATCH') {
          clearTimeout(timeout);
          window.removeEventListener('message', handler);
          resolve(event.data);
        }
      };
      
      window.addEventListener('message', handler);
    });
    
    // Send request to extension
    console.log('📤 Sending REQUEST_SITE_USAGE_SESSIONS to extension...');
    window.postMessage({ 
      type: 'REQUEST_SITE_USAGE_SESSIONS',
      source: 'web-app',
      timestamp: Date.now()
    }, '*');
    
    let extensionData;
    try {
      extensionData = await extensionResponsePromise;
      const responseTime = Date.now() - requestStartTime;
      console.log(`✅ Extension responded in ${responseTime}ms`);
      console.log('📊 Extension data received:', {
        type: extensionData.type,
        sessionCount: extensionData.payload?.sessions?.length || 0,
        userId: extensionData.payload?.userId,
        timestamp: extensionData.payload?.timestamp
      });
    } catch (error) {
      console.error('❌ Extension data request failed:', error.message);
      return;
    }
    
    // Step 4: Analyze session data
    console.log('\n📋 STEP 4: Analyze Session Data');
    const sessions = extensionData.payload?.sessions || [];
    
    if (sessions.length === 0) {
      console.warn('⚠️ No sessions received from extension');
      return;
    }
    
    const siteUsageSessions = sessions.filter(s => s.type !== 'override');
    const overrideSessions = sessions.filter(s => s.type === 'override');
    
    console.log('📊 Session breakdown:', {
      total: sessions.length,
      siteUsage: siteUsageSessions.length,
      override: overrideSessions.length
    });
    
    if (overrideSessions.length === 0) {
      console.warn('⚠️ No override sessions found in extension data');
      console.log('🔍 All session types:', sessions.map(s => ({ id: s.id, type: s.type, domain: s.domain })));
      return;
    }
    
    console.log('✅ Override sessions found:', overrideSessions.map(s => ({
      id: s.id,
      type: s.type,
      domain: s.domain,
      duration: s.duration,
      userId: s.userId,
      date: s.date
    })));
    
    // Step 5: Test Firebase service imports
    console.log('\n📋 STEP 5: Test Firebase Service Imports');
    try {
      const { overrideSessionService } = await import('../api/overrideSessionService');
      console.log('✅ overrideSessionService imported successfully');
      
      const { siteUsageSessionService } = await import('../api/siteUsageSessionService');
      console.log('✅ siteUsageSessionService imported successfully');
    } catch (error) {
      console.error('❌ Firebase service import failed:', error);
      return;
    }
    
    // Step 6: Test manual override session creation
    console.log('\n📋 STEP 6: Test Manual Override Session Creation');
    if (overrideSessions.length > 0) {
      const testSession = overrideSessions[0];
      console.log('🧪 Testing override session creation with:', testSession);
      
      try {
        const { overrideSessionService } = await import('../api/overrideSessionService');
        
        const durationMinutes = Math.round(testSession.duration / 60);
        console.log(`🔄 Creating test override session: ${testSession.domain} (${durationMinutes} minutes)`);
        
        const docId = await overrideSessionService.createOverrideSession({
          userId: testSession.userId,
          domain: testSession.domain,
          duration: durationMinutes,
          url: testSession.url,
          reason: 'manual_override'
        });
        
        console.log('✅ Manual override session created successfully!');
        console.log('📄 Document ID:', docId);
        console.log('🎯 Check Firebase Console for new document in overrideSessions collection');
        
      } catch (error) {
        console.error('❌ Manual override session creation failed:', error);
        console.error('🔍 Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
    }
    
    // Step 7: Test extension sync listener processing
    console.log('\n📋 STEP 7: Test Extension Sync Listener Processing');
    try {
      const { extensionSyncListener } = await import('../services/extensionSyncListener');
      console.log('✅ Extension sync listener imported');
      
      // Test manual processing
      console.log('🧪 Testing manual session processing...');
      await extensionSyncListener.testProcessSessions(overrideSessions);
      console.log('✅ Manual session processing completed');
      
    } catch (error) {
      console.error('❌ Extension sync listener test failed:', error);
      console.error('🔍 Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    
    // Step 8: Check current Firebase data
    console.log('\n📋 STEP 8: Check Current Firebase Override Sessions');
    try {
      const { overrideSessionService } = await import('../api/overrideSessionService');
      
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      
      const existingSessions = await overrideSessionService.getUserOverrides(user.uid, startOfDay, endOfDay);
      
      console.log('📊 Current Firebase override sessions for today:', {
        count: existingSessions.length,
        sessions: existingSessions.map(s => ({
          id: s.id,
          domain: s.domain,
          duration: s.duration,
          createdAt: s.createdAt
        }))
      });
      
    } catch (error) {
      console.error('❌ Failed to fetch current Firebase sessions:', error);
    }
    
    console.log('\n🏁 Override Session Sync Debug Complete');
    console.log('=============================================');
    
  } catch (error) {
    console.error('❌ Debug script failed:', error);
    console.error('🔍 Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
  }
};

// Also expose a simpler version for quick testing
window.debugQuickOverrideSync = async function() {
  try {
    console.log('🚀 Quick Override Sync Test');
    
    const { extensionSyncListener } = await import('../services/extensionSyncListener');
    await extensionSyncListener.triggerExtensionSync();
    
    console.log('✅ Sync triggered - check console for detailed logs');
  } catch (error) {
    console.error('❌ Quick sync failed:', error);
  }
};

// Export debug functions
console.log('🔧 Override sync debug functions loaded:');
console.log('- debugOverrideSync() - Full diagnostic');
console.log('- debugQuickOverrideSync() - Quick sync test');