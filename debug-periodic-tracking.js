/**
 * Debug script to monitor periodic website session saves
 * Run in extension popup console to monitor real-time tracking
 */

console.log('🔍 Starting periodic tracking monitor...');

// Monitor storage changes
let lastSessionCheck = {};

async function monitorSessions() {
  try {
    const storage = await chrome.storage.local.get(['site_usage_sessions']);
    const sessions = storage.site_usage_sessions || {};
    
    const activeSessions = Object.values(sessions).filter(s => s.status === 'active');
    
    console.log(`📊 [${new Date().toLocaleTimeString()}] Active sessions: ${activeSessions.length}`);
    
    activeSessions.forEach(session => {
      const sessionKey = session.id;
      const lastDuration = lastSessionCheck[sessionKey] || 0;
      
      if (session.duration !== lastDuration) {
        console.log(`🔄 [${new Date().toLocaleTimeString()}] DURATION UPDATE DETECTED!`, {
          sessionId: session.id,
          domain: session.domain,
          previousDuration: lastDuration,
          newDuration: session.duration,
          increment: session.duration - lastDuration,
          lastSaved: new Date(session.lastSavedTime).toLocaleTimeString()
        });
      } else {
        console.log(`⏸️ [${new Date().toLocaleTimeString()}] No change for ${session.domain}:`, {
          duration: session.duration,
          ageMinutes: Math.round((Date.now() - session.startTime) / 60000),
          lastSaved: session.lastSavedTime ? new Date(session.lastSavedTime).toLocaleTimeString() : 'Never'
        });
      }
      
      lastSessionCheck[sessionKey] = session.duration;
    });
    
    if (activeSessions.length === 0) {
      console.log('❌ No active sessions found');
    }
    
  } catch (error) {
    console.error('❌ Error monitoring sessions:', error);
  }
}

// Check background page state
async function checkBackgroundState() {
  try {
    const bg = chrome.extension.getBackgroundPage();
    if (!bg) {
      console.error('❌ Cannot access background page');
      return;
    }
    
    console.log('=== BACKGROUND STATE CHECK ===');
    
    // Check FocusTimeTracker
    if (bg.focusTimeTracker) {
      const tracker = bg.focusTimeTracker;
      
      console.log('📊 FocusTimeTracker state:', {
        hasCurrentSession: !!tracker.currentSession,
        isActive: tracker.currentSession?.isActive,
        domain: tracker.currentSession?.domain,
        sessionId: tracker.currentSession?.sessionId,
        startTime: tracker.currentSession?.startTime ? new Date(tracker.currentSession.startTime).toLocaleTimeString() : 'None',
        hasPeriodicInterval: !!tracker.periodicSaveInterval,
        isSaving: tracker.isSaving,
        lastHeartbeat: tracker.lastHeartbeat ? new Date(tracker.lastHeartbeat).toLocaleTimeString() : 'None'
      });
      
      // Check if periodic save is running
      if (tracker.periodicSaveInterval) {
        console.log('✅ Periodic save interval is ACTIVE');
      } else {
        console.log('❌ Periodic save interval is NOT ACTIVE');
      }
      
    } else {
      console.log('❌ focusTimeTracker instance not found');
    }
    
    // Check StorageManager
    if (bg.storageManager) {
      console.log('✅ StorageManager instance found');
      
      // Test method availability
      const methods = ['createWebsiteSession', 'updateWebsiteSessionDuration'];
      methods.forEach(method => {
        if (typeof bg.storageManager[method] === 'function') {
          console.log(`✅ Method ${method} available`);
        } else {
          console.log(`❌ Method ${method} missing`);
        }
      });
    } else {
      console.log('❌ storageManager instance not found');
    }
    
  } catch (error) {
    console.error('❌ Error checking background state:', error);
  }
}

// Force a manual save test
async function testManualSave() {
  try {
    console.log('🧪 Testing manual save...');
    
    const bg = chrome.extension.getBackgroundPage();
    if (!bg || !bg.focusTimeTracker) {
      console.error('❌ Cannot access background focusTimeTracker');
      return;
    }
    
    const tracker = bg.focusTimeTracker;
    
    // Force a save cycle
    console.log('🔄 Forcing saveCurrentWebsiteSession...');
    await tracker.saveCurrentWebsiteSession();
    
    console.log('🔄 Forcing saveCurrentSession (old system)...');
    await tracker.saveCurrentSession();
    
    console.log('✅ Manual save test completed');
    
  } catch (error) {
    console.error('❌ Manual save test failed:', error);
  }
}

// Force enable debug logging on background page
async function enableBackgroundLogging() {
  try {
    const bg = chrome.extension.getBackgroundPage();
    if (!bg) {
      console.error('❌ Cannot access background page');
      return;
    }
    
    // Override console methods to make them more visible
    const originalLog = bg.console.log;
    bg.console.log = function(...args) {
      originalLog.apply(bg.console, ['🔥 BACKGROUND:', ...args]);
      console.log('🔥 BACKGROUND:', ...args); // Also log to popup console
    };
    
    console.log('✅ Enhanced background logging enabled');
    
  } catch (error) {
    console.error('❌ Error enabling background logging:', error);
  }
}

// Start monitoring
let monitorInterval;

function startMonitoring() {
  console.log('🚀 Starting real-time session monitoring...');
  
  // Initial checks
  checkBackgroundState();
  enableBackgroundLogging();
  
  // Start monitoring every 3 seconds
  monitorInterval = setInterval(monitorSessions, 3000);
  
  console.log('📡 Monitoring active - will check every 3 seconds');
  console.log('Available commands:');
  console.log('- testManualSave() // Force a manual save cycle');
  console.log('- stopMonitoring() // Stop the monitor');
  console.log('- checkBackgroundState() // Check background state');
}

function stopMonitoring() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    console.log('⏹️ Session monitoring stopped');
  }
}

// Expose functions globally
window.testManualSave = testManualSave;
window.stopMonitoring = stopMonitoring;
window.checkBackgroundState = checkBackgroundState;
window.enableBackgroundLogging = enableBackgroundLogging;

// Auto-start monitoring
startMonitoring();

console.log('=== INITIAL STATE CHECK ===');
monitorSessions();