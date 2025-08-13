/**
 * Simple Debug Script for Website Session Tracking - Extension Context
 * Run this in the extension popup console
 */

console.log('🚀 Starting simple session tracking debug...');

async function quickDebug() {
  console.log('\n=== QUICK SESSION TRACKING DEBUG ===');
  
  try {
    // 1. Check raw storage
    console.log('\n--- 1. RAW STORAGE CHECK ---');
    const storage = await chrome.storage.local.get(['site_usage_sessions']);
    const sessions = storage.site_usage_sessions || {};
    
    console.log('Total sessions in storage:', Object.keys(sessions).length);
    console.log('Raw sessions data:', sessions);
    
    const activeSessions = Object.values(sessions).filter(s => s.status === 'active');
    console.log('Active sessions count:', activeSessions.length);
    
    activeSessions.forEach((session, i) => {
      console.log(`Active session ${i + 1}:`, {
        id: session.id,
        domain: session.domain,
        duration: session.duration,
        status: session.status,
        startTime: new Date(session.startTime),
        lastSaved: session.lastSavedTime ? new Date(session.lastSavedTime) : 'N/A',
        ageMinutes: Math.round((Date.now() - session.startTime) / 60000)
      });
    });
    
    // 2. Test direct storage manipulation
    console.log('\n--- 2. DIRECT STORAGE TEST ---');
    
    // Create a test session directly in storage
    const testSessionId = `debug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const testSession = {
      id: testSessionId,
      userId: 'debug-user',
      domain: 'direct-test.com',
      startTime: Date.now(),
      startTimeUTC: new Date().toISOString(),
      endTime: null,
      endTimeUTC: null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      utcDate: new Date().toISOString().split('T')[0],
      duration: 0,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      visits: 1,
      lastSavedTime: Date.now()
    };
    
    // Save test session
    sessions[testSessionId] = testSession;
    await chrome.storage.local.set({ site_usage_sessions: sessions });
    console.log('✅ Created direct test session:', testSessionId);
    
    // Update duration directly
    testSession.duration = 5000;
    testSession.updatedAt = Date.now();
    testSession.lastSavedTime = Date.now();
    sessions[testSessionId] = testSession;
    await chrome.storage.local.set({ site_usage_sessions: sessions });
    console.log('✅ Updated test session duration to 5000ms');
    
    // Verify update
    const updatedStorage = await chrome.storage.local.get(['site_usage_sessions']);
    const updatedSessions = updatedStorage.site_usage_sessions || {};
    const updatedSession = updatedSessions[testSessionId];
    
    if (updatedSession && updatedSession.duration === 5000) {
      console.log('✅ Direct storage update successful!');
      console.log('Updated session:', updatedSession);
    } else {
      console.error('❌ Direct storage update failed');
      console.log('Expected duration: 5000, Actual:', updatedSession?.duration);
    }
    
    // 3. Test background communication
    console.log('\n--- 3. BACKGROUND COMMUNICATION TEST ---');
    
    try {
      // Try to get background page directly
      const bg = chrome.extension.getBackgroundPage();
      if (bg) {
        console.log('✅ Background page accessible');
        console.log('Background page objects:', Object.keys(bg));
        
        // Check for StorageManager
        if (bg.StorageManager) {
          console.log('✅ StorageManager class found in background');
        } else {
          console.log('❌ StorageManager class not found in background');
        }
        
        // Check for storageManager instance
        if (bg.storageManager) {
          console.log('✅ storageManager instance found in background');
          
          // Test method existence
          const methods = ['createWebsiteSession', 'updateWebsiteSessionDuration', 'completeWebsiteSession'];
          methods.forEach(method => {
            if (typeof bg.storageManager[method] === 'function') {
              console.log(`✅ Method ${method} exists`);
            } else {
              console.error(`❌ Method ${method} missing`);
            }
          });
          
          // Try to create session via background
          console.log('🔄 Testing session creation via background...');
          try {
            const bgSessionId = await bg.storageManager.createWebsiteSession('bg-test.com');
            console.log('✅ Background session creation successful:', bgSessionId);
            
            // Try to update duration
            const updateResult = await bg.storageManager.updateWebsiteSessionDuration(bgSessionId, 3000);
            if (updateResult) {
              console.log('✅ Background duration update successful:', updateResult.duration);
            } else {
              console.error('❌ Background duration update failed');
            }
          } catch (error) {
            console.error('❌ Background session test failed:', error);
          }
        } else {
          console.log('❌ storageManager instance not found in background');
        }
        
        // Check for FocusTimeTracker
        if (bg.FocusTimeTracker) {
          console.log('✅ FocusTimeTracker class found in background');
        }
        
        if (bg.focusTimeTracker) {
          console.log('✅ focusTimeTracker instance found in background');
          
          // Check if periodic save is running
          if (bg.focusTimeTracker.periodicSaveInterval) {
            console.log('✅ Periodic save interval is active');
          } else {
            console.log('❌ Periodic save interval not found');
          }
        }
        
      } else {
        console.log('❌ Background page not accessible');
      }
    } catch (error) {
      console.error('❌ Background communication error:', error);
    }
    
    // 4. Message-based communication test
    console.log('\n--- 4. MESSAGE COMMUNICATION TEST ---');
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: 'DEBUG_SESSION_INFO'
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });
      
      console.log('✅ Message communication successful:', response);
    } catch (error) {
      console.error('❌ Message communication failed:', error);
    }
    
    // 5. Current tab info
    console.log('\n--- 5. CURRENT TAB INFO ---');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('Current tab:', tab?.url);
      
      const domain = tab?.url ? new URL(tab.url).hostname : 'unknown';
      console.log('Current domain:', domain);
      
      // Check if there's an active session for current domain
      const currentDomainSessions = Object.values(sessions).filter(s => 
        s.domain === domain && s.status === 'active'
      );
      
      console.log(`Active sessions for ${domain}:`, currentDomainSessions.length);
      currentDomainSessions.forEach(session => {
        console.log('Session:', {
          id: session.id,
          duration: session.duration,
          age: Math.round((Date.now() - session.startTime) / 60000) + ' minutes'
        });
      });
      
    } catch (error) {
      console.error('❌ Tab info error:', error);
    }
    
    console.log('\n=== DEBUG COMPLETE ===');
    
  } catch (error) {
    console.error('❌ Debug script error:', error);
  }
}

// Helper to clean test data
window.cleanTestSessions = async function() {
  const storage = await chrome.storage.local.get(['site_usage_sessions']);
  const sessions = storage.site_usage_sessions || {};
  
  const cleanedSessions = {};
  Object.entries(sessions).forEach(([id, session]) => {
    // Keep non-test sessions
    if (!session.domain.includes('test') && !id.includes('debug')) {
      cleanedSessions[id] = session;
    }
  });
  
  await chrome.storage.local.set({ site_usage_sessions: cleanedSessions });
  console.log('🧹 Cleaned test sessions');
};

// Run the debug
quickDebug();

console.log('\n📚 Available commands:');
console.log('- cleanTestSessions() // Clean up test data');