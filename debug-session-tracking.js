/**
 * Comprehensive Debug Script for Website Session Tracking
 * Copy and paste this entire script into the Chrome Extension Console
 * (Right-click extension icon -> Inspect popup -> Console tab)
 */

console.log('🚀 Starting comprehensive session tracking debug...');

// Global debug state
window.debugState = {
  testSessionId: null,
  testDomain: 'debug-test.com',
  intervalId: null,
  startTime: Date.now()
};

/**
 * 1. Test StorageManager availability and methods
 */
async function testStorageManager() {
  console.log('\n=== 1. TESTING STORAGE MANAGER ===');
  
  try {
    // Check if StorageManager exists
    if (typeof StorageManager === 'undefined') {
      console.error('❌ StorageManager is not defined in global scope');
      return false;
    }
    
    console.log('✅ StorageManager class exists');
    
    // Check if we have an instance
    let storageManager;
    if (typeof window.storageManager !== 'undefined') {
      storageManager = window.storageManager;
      console.log('✅ Found window.storageManager instance');
    } else if (typeof chrome !== 'undefined' && chrome.extension && chrome.extension.getBackgroundPage) {
      const bg = chrome.extension.getBackgroundPage();
      if (bg && bg.storageManager) {
        storageManager = bg.storageManager;
        console.log('✅ Found background page storageManager');
      }
    } else {
      console.log('ℹ️ Creating new StorageManager instance for testing');
      storageManager = new StorageManager();
      await storageManager.initialize();
    }
    
    if (!storageManager) {
      console.error('❌ Could not get StorageManager instance');
      return false;
    }
    
    // Test required methods exist
    const requiredMethods = [
      'createWebsiteSession',
      'updateWebsiteSessionDuration', 
      'completeWebsiteSession',
      'getActiveWebsiteSession',
      'getAllActiveWebsiteSessions'
    ];
    
    for (const method of requiredMethods) {
      if (typeof storageManager[method] === 'function') {
        console.log(`✅ Method ${method} exists`);
      } else {
        console.error(`❌ Method ${method} is missing or not a function`);
        return false;
      }
    }
    
    window.debugState.storageManager = storageManager;
    return true;
    
  } catch (error) {
    console.error('❌ Error testing StorageManager:', error);
    return false;
  }
}

/**
 * 2. Test session creation
 */
async function testSessionCreation() {
  console.log('\n=== 2. TESTING SESSION CREATION ===');
  
  try {
    const { storageManager, testDomain } = window.debugState;
    
    console.log('🔄 Creating test session for domain:', testDomain);
    const sessionId = await storageManager.createWebsiteSession(testDomain);
    
    if (sessionId) {
      console.log('✅ Session created with ID:', sessionId);
      window.debugState.testSessionId = sessionId;
      
      // Verify session was stored
      const storage = await chrome.storage.local.get(['site_usage_sessions']);
      const sessions = storage.site_usage_sessions || {};
      
      if (sessions[sessionId]) {
        console.log('✅ Session found in storage:', sessions[sessionId]);
        return true;
      } else {
        console.error('❌ Session not found in storage after creation');
        return false;
      }
    } else {
      console.error('❌ Session creation returned null/undefined');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error creating session:', error);
    return false;
  }
}

/**
 * 3. Test duration updates
 */
async function testDurationUpdate() {
  console.log('\n=== 3. TESTING DURATION UPDATE ===');
  
  try {
    const { storageManager, testSessionId } = window.debugState;
    
    if (!testSessionId) {
      console.error('❌ No test session ID available');
      return false;
    }
    
    // Test small update (should be ignored)
    console.log('🔄 Testing small duration update (500ms - should be ignored)...');
    const result1 = await storageManager.updateWebsiteSessionDuration(testSessionId, 500);
    console.log('Result for 500ms update:', result1);
    
    // Test valid update
    console.log('🔄 Testing valid duration update (5000ms)...');
    const result2 = await storageManager.updateWebsiteSessionDuration(testSessionId, 5000);
    
    if (result2) {
      console.log('✅ Duration update successful:', result2);
      console.log('Updated duration:', result2.duration, 'ms');
      
      // Verify in storage
      const storage = await chrome.storage.local.get(['site_usage_sessions']);
      const sessions = storage.site_usage_sessions || {};
      const updatedSession = sessions[testSessionId];
      
      if (updatedSession && updatedSession.duration > 0) {
        console.log('✅ Duration verified in storage:', updatedSession.duration, 'ms');
        return true;
      } else {
        console.error('❌ Duration not updated in storage. Session data:', updatedSession);
        return false;
      }
    } else {
      console.error('❌ Duration update returned null/undefined');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error updating duration:', error);
    return false;
  }
}

/**
 * 4. Test periodic updates simulation
 */
async function testPeriodicUpdates() {
  console.log('\n=== 4. TESTING PERIODIC UPDATES SIMULATION ===');
  
  try {
    const { storageManager, testSessionId } = window.debugState;
    
    if (!testSessionId) {
      console.error('❌ No test session ID available');
      return false;
    }
    
    console.log('🔄 Starting 15-second periodic update simulation...');
    let updateCount = 0;
    
    const intervalId = setInterval(async () => {
      try {
        updateCount++;
        const intervalMs = 5000; // 5 second intervals
        
        console.log(`📊 Update #${updateCount}: Adding ${intervalMs}ms`);
        const result = await storageManager.updateWebsiteSessionDuration(testSessionId, intervalMs);
        
        if (result) {
          console.log(`✅ Update #${updateCount} successful. Total duration: ${result.duration}ms`);
        } else {
          console.error(`❌ Update #${updateCount} failed`);
        }
        
        // Stop after 3 updates (15 seconds total)
        if (updateCount >= 3) {
          clearInterval(intervalId);
          console.log('🏁 Periodic update simulation completed');
          
          // Final verification
          const storage = await chrome.storage.local.get(['site_usage_sessions']);
          const sessions = storage.site_usage_sessions || {};
          const finalSession = sessions[testSessionId];
          
          console.log('📊 Final session state:', finalSession);
          console.log('📊 Expected duration: ~15000ms, Actual:', finalSession?.duration || 0, 'ms');
          
          if (finalSession && finalSession.duration >= 14000) { // Allow some tolerance
            console.log('✅ Periodic updates working correctly!');
            return true;
          } else {
            console.error('❌ Periodic updates not accumulating correctly');
            return false;
          }
        }
      } catch (error) {
        console.error(`❌ Error in periodic update #${updateCount}:`, error);
        clearInterval(intervalId);
        return false;
      }
    }, 5000);
    
    window.debugState.intervalId = intervalId;
    return true;
    
  } catch (error) {
    console.error('❌ Error starting periodic updates:', error);
    return false;
  }
}

/**
 * 5. Test real tracking system integration
 */
async function testRealTrackingSystem() {
  console.log('\n=== 5. TESTING REAL TRACKING SYSTEM INTEGRATION ===');
  
  try {
    // Check if FocusTimeTracker exists
    if (typeof FocusTimeTracker === 'undefined') {
      console.warn('⚠️ FocusTimeTracker not found in current context');
      
      // Try to get from background page
      if (typeof chrome !== 'undefined' && chrome.extension && chrome.extension.getBackgroundPage) {
        const bg = chrome.extension.getBackgroundPage();
        if (bg && bg.FocusTimeTracker) {
          console.log('✅ Found FocusTimeTracker in background page');
          
          // Check if it has the saveCurrentWebsiteSession method
          const tracker = bg.focusTimeTracker || new bg.FocusTimeTracker();
          if (typeof tracker.saveCurrentWebsiteSession === 'function') {
            console.log('✅ saveCurrentWebsiteSession method exists');
          } else {
            console.error('❌ saveCurrentWebsiteSession method missing');
            return false;
          }
        } else {
          console.error('❌ FocusTimeTracker not found in background page');
          return false;
        }
      } else {
        console.error('❌ Cannot access background page');
        return false;
      }
    } else {
      console.log('✅ FocusTimeTracker found in current context');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error testing real tracking system:', error);
    return false;
  }
}

/**
 * 6. Inspect current session state
 */
async function inspectCurrentSessions() {
  console.log('\n=== 6. INSPECTING CURRENT SESSION STATE ===');
  
  try {
    const storage = await chrome.storage.local.get(['site_usage_sessions']);
    const sessions = storage.site_usage_sessions || {};
    
    console.log('📊 Total sessions in storage:', Object.keys(sessions).length);
    
    const activeSessions = Object.values(sessions).filter(s => s.status === 'active');
    const completedSessions = Object.values(sessions).filter(s => s.status === 'completed');
    
    console.log('📊 Active sessions:', activeSessions.length);
    console.log('📊 Completed sessions:', completedSessions.length);
    
    // Show details of active sessions
    activeSessions.forEach((session, index) => {
      console.log(`📋 Active Session #${index + 1}:`, {
        id: session.id,
        domain: session.domain,
        duration: session.duration,
        startTime: new Date(session.startTime),
        lastSaved: new Date(session.lastSavedTime),
        ageMinutes: Math.round((Date.now() - session.startTime) / 60000)
      });
    });
    
    // Show recent completed sessions
    const recentCompleted = completedSessions
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 3);
      
    recentCompleted.forEach((session, index) => {
      console.log(`📋 Recent Completed #${index + 1}:`, {
        id: session.id,
        domain: session.domain,
        duration: session.duration,
        durationMinutes: Math.round(session.duration / 60000),
        completed: new Date(session.endTime)
      });
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ Error inspecting sessions:', error);
    return false;
  }
}

/**
 * 7. Check background script activity
 */
async function checkBackgroundActivity() {
  console.log('\n=== 7. CHECKING BACKGROUND SCRIPT ACTIVITY ===');
  
  try {
    // Send message to background script to check its state
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      console.log('🔄 Sending debug message to background script...');
      
      const response = await chrome.runtime.sendMessage({
        type: 'DEBUG_SESSION_TRACKING',
        action: 'GET_STATUS'
      });
      
      if (response) {
        console.log('✅ Background script response:', response);
        return true;
      } else {
        console.warn('⚠️ No response from background script');
      }
    } else {
      console.warn('⚠️ Cannot communicate with background script');
    }
    
    return false;
    
  } catch (error) {
    console.error('❌ Error checking background activity:', error);
    return false;
  }
}

/**
 * Main debug execution
 */
async function runDebugSuite() {
  console.log('🚀 === WEBSITE SESSION TRACKING DEBUG SUITE ===');
  console.log('Time:', new Date().toISOString());
  
  const results = {};
  
  try {
    results.storageManager = await testStorageManager();
    if (!results.storageManager) {
      console.error('❌ Cannot continue - StorageManager tests failed');
      return results;
    }
    
    results.sessionCreation = await testSessionCreation();
    results.durationUpdate = await testDurationUpdate();
    results.periodicUpdates = await testPeriodicUpdates();
    results.realTrackingSystem = await testRealTrackingSystem();
    results.currentSessions = await inspectCurrentSessions();
    results.backgroundActivity = await checkBackgroundActivity();
    
    console.log('\n=== FINAL RESULTS ===');
    Object.entries(results).forEach(([test, passed]) => {
      const status = passed ? '✅' : '❌';
      console.log(`${status} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
    });
    
    const passedCount = Object.values(results).filter(Boolean).length;
    const totalCount = Object.keys(results).length;
    
    console.log(`\n📊 Overall: ${passedCount}/${totalCount} tests passed`);
    
    if (passedCount === totalCount) {
      console.log('🎉 All tests passed! The session tracking should be working correctly.');
    } else {
      console.log('⚠️ Some tests failed. Check the individual test results above for details.');
    }
    
  } catch (error) {
    console.error('❌ Debug suite failed:', error);
  }
  
  return results;
}

/**
 * Cleanup function
 */
window.debugCleanup = function() {
  if (window.debugState?.intervalId) {
    clearInterval(window.debugState.intervalId);
    console.log('🧹 Cleaned up debug interval');
  }
  
  if (window.debugState?.testSessionId && window.debugState?.storageManager) {
    window.debugState.storageManager.completeWebsiteSession(window.debugState.testSessionId)
      .then(() => console.log('🧹 Completed test session'))
      .catch(err => console.error('Error completing test session:', err));
  }
};

/**
 * Helper functions for manual testing
 */
window.debugHelpers = {
  // Create a test session
  createTestSession: async (domain = 'manual-test.com') => {
    const sessionId = await window.debugState.storageManager.createWebsiteSession(domain);
    console.log('Created test session:', sessionId);
    return sessionId;
  },
  
  // Update session duration
  updateDuration: async (sessionId, durationMs = 5000) => {
    const result = await window.debugState.storageManager.updateWebsiteSessionDuration(sessionId, durationMs);
    console.log('Update result:', result);
    return result;
  },
  
  // Get all sessions
  getSessions: async () => {
    const storage = await chrome.storage.local.get(['site_usage_sessions']);
    console.log('All sessions:', storage.site_usage_sessions);
    return storage.site_usage_sessions;
  },
  
  // Clear all sessions (use with caution!)
  clearAllSessions: async () => {
    await chrome.storage.local.set({ site_usage_sessions: {} });
    console.log('All sessions cleared');
  }
};

// Auto-run the debug suite
runDebugSuite().catch(error => {
  console.error('❌ Failed to run debug suite:', error);
});

console.log('\n📚 Available manual commands:');
console.log('- debugHelpers.createTestSession("example.com")');
console.log('- debugHelpers.updateDuration(sessionId, 5000)');
console.log('- debugHelpers.getSessions()');
console.log('- debugHelpers.clearAllSessions()');
console.log('- debugCleanup()');