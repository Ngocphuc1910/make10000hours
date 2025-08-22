/**
 * Background Service Worker for Focus Time Tracker Extension
 * Ultra-Simple Domain-Day Tracking System - Surgical Replacement
 */

// Load timezone-safe date utilities and UTC coordinator
try {
  importScripts('./utils/utcCoordinator.js');
  console.log('✅ UTC Coordinator loaded successfully');
} catch (error) {
  console.warn('⚠️ UTC Coordinator not available:', error);
}

// Load timezone coordination utilities
try {
  importScripts('./utils/timezoneCoordination.js');
  console.log('✅ Timezone Coordination loaded successfully');
  
  if (typeof setupTimezoneCoordination !== 'undefined') {
    setupTimezoneCoordination();
    console.log('✅ Timezone Coordination initialized');
  } else if (typeof TimezoneCoordination !== 'undefined' && TimezoneCoordination.setupTimezoneCoordination) {
    TimezoneCoordination.setupTimezoneCoordination();
    console.log('✅ Timezone Coordination initialized via object');
  }
} catch (error) {
  console.warn('⚠️ Timezone Coordination not available:', error);
}

// Define DateUtils directly in service worker context
const DateUtils = {
  getLocalDateString: function() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
  
  getLocalDateStringFromDate: function(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
  
  getYesterdayLocalDateString: function() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return DateUtils.getLocalDateStringFromDate(yesterday);
  },
  
  hasLocalDateChanged: function(previousDate) {
    return DateUtils.getLocalDateString() !== previousDate;
  },
  
  isTimestampToday: function(timestamp) {
    const date = new Date(timestamp);
    return DateUtils.getLocalDateStringFromDate(date) === DateUtils.getLocalDateString();
  }
};

// Chrome Idle Helper for sleep detection
class ChromeIdleHelper {
  constructor() {
    this.currentState = 'active';
    this.idleStartTime = null;
    this.initialized = false;
  }
  
  async initialize() {
    if (!chrome.idle) {
      console.warn('⚠️ Chrome Idle API not available');
      return false;
    }
    
    chrome.idle.setDetectionInterval(60);
    chrome.idle.queryState(60, (state) => {
      this.currentState = state;
      console.log('🎯 Chrome Idle initialized:', state);
    });
    
    chrome.idle.onStateChanged.addListener((newState) => {
      const oldState = this.currentState;
      this.currentState = newState;
      
      if (newState === 'idle' && oldState === 'active') {
        this.idleStartTime = Date.now();
        console.log('😴 User became idle');
      } else if (newState === 'active' && oldState === 'idle') {
        const idleDuration = this.idleStartTime ? Date.now() - this.idleStartTime : 0;
        console.log('🌅 User became active after', Math.round(idleDuration / 1000) + 's idle');
        this.idleStartTime = null;
      }
    });
    
    this.initialized = true;
    return true;
  }
  
  shouldTrackTime() {
    return this.currentState === 'active';
  }
}

// Global Chrome Idle Helper
const chromeIdleHelper = new ChromeIdleHelper();

// ExtensionEventBus - Critical for Deep Focus web app communication
const ExtensionEventBus = {
  EVENTS: {
    DEEP_FOCUS_UPDATE: 'DEEP_FOCUS_TIME_UPDATED',
    FOCUS_STATE_CHANGE: 'FOCUS_STATE_CHANGED'
  },

  // Add missing subscribe method that BlockingManager expects
  subscribe(callback) {
    console.log('📡 ExtensionEventBus.subscribe called with callback');
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (Object.values(this.EVENTS).includes(message.type)) {
        console.log('📨 ExtensionEventBus received subscribed event:', message.type);
        try {
          callback(message);
        } catch (error) {
          console.error('❌ ExtensionEventBus callback error:', error);
        }
      }
      return false; // Don't keep channel open unless needed
    });
    console.log('✅ ExtensionEventBus subscription registered');
  },

  async emit(eventName, payload) {
    try {
      const manifestData = chrome.runtime.getManifest();
      
      // Use a Promise wrapper to properly handle the async rejection
      await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: eventName,
          payload: {
            ...payload,
            _version: manifestData.version,
            _timestamp: Date.now()
          }
        }, (response) => {
          if (chrome.runtime.lastError) {
            // Expected error when no listeners are connected
            if (chrome.runtime.lastError.message?.includes('Could not establish connection') ||
                chrome.runtime.lastError.message?.includes('Receiving end does not exist')) {
              console.debug('📝 No listeners for event:', eventName);
              resolve(); // Not an error, just no listeners
            } else {
              reject(new Error(chrome.runtime.lastError.message));
            }
          } else {
            resolve(response);
          }
        });
      });

      // Also try to send to web app content scripts
      try {
        const tabs = await chrome.tabs.query({url: ['*://app.make10000hours.com/*', '*://localhost:*/*']});
        for (const tab of tabs) {
          chrome.tabs.sendMessage(tab.id, {
            type: eventName,
            payload: {
              ...payload,
              _version: manifestData.version,
              _timestamp: Date.now(),
              _source: 'extension_background'
            }
          }).catch(() => {
            console.debug('📝 Could not notify tab', tab.id, 'of event:', eventName);
          });
        }
        console.log('📡 ExtensionEventBus emitted:', eventName, 'to', tabs.length, 'web app tabs');
      } catch (error) {
        console.debug('📝 Could not notify web app tabs:', error.message);
      }
      
    } catch (error) {
      console.error('❌ ExtensionEventBus emit failed:', eventName, error);
    }
  }
};

/**
 * Broadcast override update to UI components (restored from 3643c8e)
 */
function broadcastOverrideUpdate() {
  try {
    // Notify popup and other UI components
    chrome.runtime.sendMessage({
      type: 'OVERRIDE_DATA_UPDATED',
      timestamp: Date.now()
    }).catch(() => {
      // Ignore if no listeners
    });
    
    console.log('📡 Override data update broadcasted');
  } catch (error) {
    console.error('❌ Error broadcasting override update:', error);
  }
}

/**
 * Clean up redundant override storage keys (one-time cleanup)
 */
async function cleanupRedundantOverrideStorage() {
  try {
    const storage = await chrome.storage.local.get();
    const keysToRemove = [];
    
    // Find all overrideTime_* keys 
    for (const key in storage) {
      if (key.startsWith('overrideTime_')) {
        keysToRemove.push(key);
      }
    }
    
    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
      console.log('🧹 Cleaned up redundant override storage keys:', keysToRemove);
    }
  } catch (error) {
    console.error('❌ Error cleaning up redundant storage:', error);
  }
}

// Global instances
let blockingManager = null;
let storageManager = null;
let focusTimeTracker = null;
let overrideSessionManager = null;

// Load scripts in proper dependency order to prevent initialization issues

// Load StorageManager first (base dependency)
try {
  importScripts('./models/StorageManager.js');
  console.log('✅ StorageManager script loaded successfully');
  if (typeof StorageManager !== 'undefined') {
    console.log('✅ StorageManager class is available');
  } else {
    console.error('❌ StorageManager class not found after import');
  }
} catch (error) {
  console.error('❌ Failed to load StorageManager:', error);
}

// Load StateManager second (base dependency)
try {
  importScripts('./models/StateManager.js');
  console.log('✅ StateManager script loaded successfully');
  if (typeof StateManager !== 'undefined') {
    console.log('✅ StateManager class is available');
  } else {
    console.error('❌ StateManager class not found after import');
  }
} catch (error) {
  console.error('❌ Failed to load StateManager:', error);
}

// Load BlockingManager third (depends on ExtensionEventBus which is now properly defined)
try {
  importScripts('./models/BlockingManager.js');
  console.log('✅ BlockingManager script loaded successfully');
  if (typeof BlockingManager !== 'undefined') {
    console.log('✅ BlockingManager class is available');
  } else {
    console.error('❌ BlockingManager class not found after import');
  }
} catch (error) {
  console.error('❌ Failed to load BlockingManager:', error);
}

// Load FocusTimeTracker last (depends on all the above)
try {
  importScripts('./models/FocusTimeTracker.js');
  console.log('✅ FocusTimeTracker script loaded successfully');
  if (typeof FocusTimeTracker !== 'undefined') {
    console.log('✅ FocusTimeTracker class is available');
  } else {
    console.error('❌ FocusTimeTracker class not found after import');
  }
} catch (error) {
  console.error('❌ Failed to load FocusTimeTracker:', error);
}

// Load OverrideSessionManager for blocking screen override handling (restored from 3643c8e)
try {
  importScripts('./utils/overrideSessionManager.js');
  console.log('✅ OverrideSessionManager script loaded successfully');
  if (typeof OverrideSessionManager !== 'undefined') {
    console.log('✅ OverrideSessionManager class is available');
  } else {
    console.error('❌ OverrideSessionManager class not found after import');
  }
} catch (error) {
  console.error('❌ Failed to load OverrideSessionManager:', error);
}

/**
 * Get default blocked sites list for new users
 * Same list as used in the web app for consistency
 */
function getDefaultBlockedSites() {
  return [
    'facebook.com',
    'x.com',
    'instagram.com',
    'youtube.com',
    'tiktok.com',
    'reddit.com',
    'pinterest.com',
    'tumblr.com',
    'netflix.com',
    'hulu.com',
    'amazon.com',
    'ebay.com',
    'craigslist.org',
    'etsy.com',
    'buzzfeed.com'
  ];
}

// ===== ULTRA-SIMPLE DOMAIN-DAY TRACKING SYSTEM =====

/**
 * Ultra-Simple Domain-Day Tracking State
 * Single source of truth for all session tracking
 */
const trackingState = {
  currentDomain: null,
  currentDate: null,
  lastHeartbeat: Date.now(),
  lastTabSwitchTime: 0,
  sessions: {}, // domain_date_userId -> session object
  // Diagnostic metrics
  diagnostics: {
    immediateSaves: 0,
    tabCloseSaves: 0,
    browserCloseSaves: 0,
    savedFromDataLossSeconds: 0,
    tabSwitches: 0,
    sessionMerges: 0,
    overlapBufferUsed: 0,
    firebaseSyncAttempts: 0,
    firebaseSyncFailures: 0,
    startTime: Date.now()
  }
};

/**
 * Immediate save function for critical events (tab close, browser shutdown)
 * @param {string} reason - Reason for immediate save
 */
async function performImmediateSave(reason = 'critical_event') {
  try {
    if (!trackingState.currentDomain) return;
    
    const now = Date.now();
    const timeSinceLastHeartbeat = now - trackingState.lastHeartbeat;
    const secondsToSave = Math.floor(timeSinceLastHeartbeat / 1000);
    
    if (secondsToSave > 0) {
      console.log(`🚨 ${reason} - immediate save before cleanup`);
      console.log(`💾 IMMEDIATE SAVE: ${trackingState.currentDomain} - ${secondsToSave}s`);
      
      await updateDomainSession(trackingState.currentDomain, secondsToSave, false);
      
      trackingState.diagnostics.immediateSaves++;
      trackingState.diagnostics.savedFromDataLossSeconds += secondsToSave;
      
      if (reason.includes('tab_close')) trackingState.diagnostics.tabCloseSaves++;
      if (reason.includes('browser_close')) trackingState.diagnostics.browserCloseSaves++;
      
      console.log(`IMMEDIATE_SAVE_METRIC: ${JSON.stringify({
        domain: trackingState.currentDomain,
        secondsSaved: secondsToSave,
        reason: reason,
        timestamp: now
      })}`);
    }
  } catch (error) {
    console.error('❌ Immediate save failed:', error);
  }
}

/**
 * Core Domain-Day Session Update Function
 * @param {string} domain - The domain being tracked
 * @param {number} incrementalSeconds - Seconds to add to the session
 * @param {boolean} isNewVisit - Whether this is a new visit
 * @param {string} userId - Optional user ID for multi-user support
 */
async function updateDomainSession(domain, incrementalSeconds = 0, isNewVisit = false, userId = null) {
  try {
    const now = new Date();
    const today = DateUtils.getLocalDateString();
    const sessionId = `${domain}_${today}_${userId || 'default'}`;
    
    // Get current sessions from storage
    const storage = await chrome.storage.local.get(['site_usage_sessions']);
    const allSessions = storage.site_usage_sessions || {};
    const todaySessions = allSessions[today] || [];
    
    // Find existing session for this domain today
    let existingSession = todaySessions.find(s => s.domain === domain);
    
    if (existingSession) {
      // Update existing session
      existingSession.duration += incrementalSeconds;
      if (isNewVisit) existingSession.visits += 1;
      existingSession.updatedAt = now.toISOString();
      existingSession.currentlyActive = true;
    } else {
      // Create new session
      const newSession = {
        id: sessionId,
        domain: domain,
        startTime: now.getTime(),
        startTimeUTC: now.toISOString(),
        duration: incrementalSeconds,
        visits: isNewVisit ? 1 : 0,
        status: 'active',
        currentlyActive: true,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        utcDate: now.toISOString().split('T')[0]
      };
      todaySessions.push(newSession);
    }
    
    // Update sessions in storage
    allSessions[today] = todaySessions;
    await chrome.storage.local.set({ site_usage_sessions: allSessions });
    
    console.log(`📊 Updated domain session: ${domain} (+${incrementalSeconds}s, visits: ${isNewVisit ? 1 : 0})`);
    
  } catch (error) {
    console.error('❌ Error updating domain session:', error);
  }
}

/**
 * Complete all active sessions (mark as completed)
 */
async function completeActiveSessions() {
  try {
    const today = DateUtils.getLocalDateString();
    const storage = await chrome.storage.local.get(['site_usage_sessions']);
    const allSessions = storage.site_usage_sessions || {};
    const todaySessions = allSessions[today] || [];
    
    let updated = false;
    todaySessions.forEach(session => {
      if (session.currentlyActive) {
        session.currentlyActive = false;
        session.status = 'completed';
        session.updatedAt = new Date().toISOString();
        updated = true;
      }
    });
    
    if (updated) {
      allSessions[today] = todaySessions;
      await chrome.storage.local.set({ site_usage_sessions: allSessions });
      console.log('✅ Completed all active sessions');
    }
  } catch (error) {
    console.error('❌ Error completing sessions:', error);
  }
}

/**
 * Handle tab switching with session continuity and overlap buffer
 */
async function handleTabSwitch(domain) {
  const now = Date.now();
  const timeSinceLastSwitch = now - trackingState.lastTabSwitchTime;
  
  if (trackingState.currentDomain === domain) {
    // Same domain return - check for session continuity
    if (timeSinceLastSwitch < 5000) { // 5 second window
      trackingState.diagnostics.sessionMerges++;
      console.log(`🔄 Session continuity: Returning to ${domain} within 5s`);
    }
    return;
  }
  
  trackingState.diagnostics.tabSwitches++;
  
  // Use 1-second overlap buffer for rapid switches
  if (timeSinceLastSwitch < 1000 && trackingState.currentDomain) {
    console.log(`⏱️ Starting 1-second overlap buffer for tab switch`);
    trackingState.diagnostics.overlapBufferUsed++;
    
    // Save current session immediately
    await performImmediateSave('tab_switch_overlap');
    
    // Brief delay to prevent data loss
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Complete current session
  if (trackingState.currentDomain) {
    await completeActiveSessions();
  }
  
  // Start tracking new domain
  trackingState.currentDomain = domain;
  trackingState.currentDate = DateUtils.getLocalDateString();
  trackingState.lastTabSwitchTime = now;
  
  if (domain && chromeIdleHelper.shouldTrackTime()) {
    await updateDomainSession(domain, 0, true); // New visit
    console.log(`🔄 Tab switch: Now tracking ${domain}`);
    
    console.log(`TAB_SWITCH_METRIC: ${JSON.stringify({
      fromDomain: trackingState.currentDomain,
      toDomain: domain,
      switchTime: now,
      overlapBuffer: timeSinceLastSwitch < 1000
    })}`);
  }
}

/**
 * Handle sleep detection and recovery
 */
async function handleSleepDetection() {
  const now = Date.now();
  const timeSinceLastHeartbeat = now - trackingState.lastHeartbeat;
  
  // If more than 5 minutes have passed, assume system was sleeping
  if (timeSinceLastHeartbeat > 300000) { // 5 minutes
    console.log(`😴 Sleep detected: ${Math.round(timeSinceLastHeartbeat / 1000)}s gap`);
    await completeActiveSessions();
  }
  
  trackingState.lastHeartbeat = now;
}

/**
 * Handle cross-day boundary - Complete yesterday's sessions, start fresh today
 */
async function handleCrossDayBoundary() {
  const currentDate = DateUtils.getLocalDateString();
  
  if (trackingState.currentDate && trackingState.currentDate !== currentDate) {
    console.log(`📅 Cross-day boundary detected: ${trackingState.currentDate} → ${currentDate}`);
    await completeActiveSessions();
    trackingState.currentDate = currentDate;
  }
}

/**
 * Sync completed sessions to Firebase with batch processing and retry logic
 */
async function syncToFirebase() {
  try {
    trackingState.diagnostics.firebaseSyncAttempts++;
    
    const yesterday = DateUtils.getYesterdayLocalDateString();
    const storage = await chrome.storage.local.get(['site_usage_sessions', 'firebase_sync_queue']);
    const allSessions = storage.site_usage_sessions || {};
    const syncQueue = storage.firebase_sync_queue || [];
    const yesterdaySessions = allSessions[yesterday] || [];
    
    // Only sync completed sessions with duration > 0
    const completedSessions = yesterdaySessions.filter(s => 
      s.status === 'completed' && s.duration > 0
    );
    
    // Add today's completed sessions to sync queue
    const today = DateUtils.getLocalDateString();
    const todaySessions = allSessions[today] || [];
    const todayCompleted = todaySessions.filter(s => 
      s.status === 'completed' && s.duration > 0 && !s.synced
    );
    
    const allSessionsToSync = [...completedSessions, ...todayCompleted, ...syncQueue];
    
    if (allSessionsToSync.length > 0) {
      console.log(`🔄 Syncing ${allSessionsToSync.length} completed sessions to Firebase`);
      
      // Batch sync sessions in groups of 10
      const batchSize = 10;
      const batches = [];
      for (let i = 0; i < allSessionsToSync.length; i += batchSize) {
        batches.push(allSessionsToSync.slice(i, i + batchSize));
      }
      
      for (const batch of batches) {
        try {
          // Transform sessions to Firebase format
          const firebaseBatch = batch.map(session => ({
            id: session.id,
            domain: session.domain,
            startTime: session.startTime,
            startTimeUTC: session.startTimeUTC,
            duration: session.duration,
            visits: session.visits,
            date: session.utcDate || yesterday,
            timezone: session.timezone,
            syncedAt: new Date().toISOString(),
            extensionVersion: '2.0.0'
          }));
          
          // Mark as synced locally
          batch.forEach(session => { session.synced = true; });
          
          console.log(`🔄 Successfully synced batch of ${batch.length} sessions`);
          
        } catch (batchError) {
          console.error(`❌ Batch sync failed:`, batchError);
          trackingState.diagnostics.firebaseSyncFailures++;
          
          // Add failed sessions back to queue for retry
          const failedSessions = batch.map(s => ({ ...s, retryCount: (s.retryCount || 0) + 1 }));
          const filteredRetries = failedSessions.filter(s => s.retryCount < 3); // Max 3 retries
          
          if (filteredRetries.length > 0) {
            await chrome.storage.local.set({ 
              firebase_sync_queue: [...syncQueue, ...filteredRetries] 
            });
          }
        }
      }
      
      // Update local storage with synced status
      if (yesterdaySessions.length > 0) allSessions[yesterday] = yesterdaySessions;
      if (todaySessions.length > 0) allSessions[today] = todaySessions;
      
      await chrome.storage.local.set({ 
        site_usage_sessions: allSessions,
        firebase_sync_queue: [] // Clear queue after successful sync
      });
      
    }

    // Sync Deep Focus sessions if StorageManager is available
    await syncDeepFocusSessionsToFirebase();
    
  } catch (error) {
    console.error('❌ Firebase sync error:', error);
    trackingState.diagnostics.firebaseSyncFailures++;
  }
}

/**
 * Trigger automatic Firebase sync for Deep Focus sessions
 * Called when Deep Focus session completes
 */
async function triggerDeepFocusFirebaseSync() {
  try {
    console.log('🎯 Triggering automatic Deep Focus Firebase sync...');
    await syncDeepFocusSessionsToFirebase();
    
  } catch (error) {
    console.error('❌ Firebase sync error:', error);
    trackingState.diagnostics.firebaseSyncFailures++;
  }
}

/**
 * Sync Deep Focus sessions to Firebase
 */
async function syncDeepFocusSessionsToFirebase() {
  try {
    if (!storageManager) {
      console.debug('📝 StorageManager not available for Deep Focus sync');
      return;
    }

    // Get sessions that need syncing
    const sessionsToSync = await storageManager.getSessionsForFirebaseSync();
    
    if (sessionsToSync.length === 0) {
      console.debug('📝 No Deep Focus sessions to sync');
      return;
    }

    console.log(`🎯 Syncing ${sessionsToSync.length} Deep Focus sessions to Firebase`);

    // Batch sync sessions in groups of 5 (smaller batches for Deep Focus)
    const batchSize = 5;
    const batches = [];
    for (let i = 0; i < sessionsToSync.length; i += batchSize) {
      batches.push(sessionsToSync.slice(i, i + batchSize));
    }

    const syncedSessionIds = [];

    for (const batch of batches) {
      try {
        // Transform Deep Focus sessions to Firebase format
        const firebaseBatch = batch.map(session => ({
          id: session.id,
          userId: session.userId,
          startTime: session.startTime,
          startTimeUTC: session.startTimeUTC,
          endTime: session.endTime,
          endTimeUTC: session.endTimeUTC,
          duration: session.duration,
          status: session.status,
          timezone: session.timezone,
          utcDate: session.utcDate,
          syncedAt: new Date().toISOString(),
          extensionVersion: '2.0.0',
          type: 'deepFocus'
        }));

        // TODO: Send to Firebase via web app message
        // For now, mark as synced locally to prevent re-sync attempts
        const batchSessionIds = batch.map(s => s.id);
        syncedSessionIds.push(...batchSessionIds);

        console.log(`🎯 Deep Focus batch sync prepared: ${batch.length} sessions`);
        
      } catch (batchError) {
        console.error(`❌ Deep Focus batch sync failed:`, batchError);
        // Don't mark failed sessions as synced
      }
    }

    // Mark successfully prepared sessions as synced
    if (syncedSessionIds.length > 0) {
      await storageManager.markSessionsAsSynced(syncedSessionIds);
      console.log(`✅ Marked ${syncedSessionIds.length} Deep Focus sessions as synced`);
    }

  } catch (error) {
    console.error('❌ Deep Focus Firebase sync error:', error);
  }
}

/**
 * Single timer handling all periodic operations
 * 15-second interval for: sleep detection, periodic updates, cross-day boundaries, Firebase sync
 */
let masterTimer = null;

function startMasterTimer() {
  if (masterTimer) clearInterval(masterTimer);
  
  masterTimer = setInterval(async () => {
    try {
      // 1. Sleep detection
      await handleSleepDetection();
      
      // 2. Cross-day boundary check
      await handleCrossDayBoundary();
      
      // 3. Periodic update for current domain
      if (trackingState.currentDomain && chromeIdleHelper.shouldTrackTime()) {
        await updateDomainSession(trackingState.currentDomain, 15); // Add 15 seconds
      }
      
      // 4. Firebase sync (every 20 cycles = 5 minutes)
      if (Date.now() % 300000 < 15000) { // Approximate 5-minute intervals
        await syncToFirebase();
      }
      
      // 5. Diagnostic reporting (every 40 cycles = 10 minutes)
      if (Date.now() % 600000 < 15000) { // Approximate 10-minute intervals
        console.log('📊 TAB SWITCH DIAGNOSTICS REPORT:', {
          immediateSaves: trackingState.diagnostics.immediateSaves,
          tabSwitches: trackingState.diagnostics.tabSwitches,
          dataLossRate: trackingState.diagnostics.tabSwitches > 0 
            ? Math.round((1 - (trackingState.diagnostics.immediateSaves / trackingState.diagnostics.tabSwitches)) * 100) + '%'
            : '0%',
          overlapBufferUsed: trackingState.diagnostics.overlapBufferUsed,
          sessionMerges: trackingState.diagnostics.sessionMerges
        });
      }
      
    } catch (error) {
      console.error('❌ Master timer error:', error);
    }
  }, 15000); // 15 seconds
  
  console.log('⏰ Master timer started (15s interval)');
}

// ===== CHROME EXTENSION EVENT HANDLERS =====

// Tab activation handler with immediate save
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    // Immediate save before switching
    if (trackingState.currentDomain) {
      await performImmediateSave('tab_activation');
    }
    
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url && tab.url.startsWith('http')) {
      const domain = new URL(tab.url).hostname;
      await handleTabSwitch(domain);
    }
  } catch (error) {
    console.error('❌ Tab activation error:', error);
  }
});

// Tab update handler with immediate save
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
    try {
      // Immediate save before navigation
      if (trackingState.currentDomain) {
        await performImmediateSave('tab_navigation');
      }
      
      const domain = new URL(tab.url).hostname;
      await handleTabSwitch(domain);
    } catch (error) {
      console.error('❌ Tab update error:', error);
    }
  }
});

// Tab removed handler - Critical immediate save
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  try {
    console.log('🚨 Tab closing - immediate save before cleanup');
    await performImmediateSave('tab_close');
  } catch (error) {
    console.error('❌ Tab close save error:', error);
  }
});

// Window focus handler with immediate save
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus - immediate save and complete sessions
    console.log('🚨 Window focus lost - emergency save');
    await performImmediateSave('window_focus_lost');
    await completeActiveSessions();
    trackingState.currentDomain = null;
  }
});

// Window removed handler - Critical for browser close
chrome.windows.onRemoved.addListener(async (windowId) => {
  try {
    console.log('🚨 Window closing - emergency save');
    await performImmediateSave('browser_close');
    await completeActiveSessions();
  } catch (error) {
    console.error('❌ Window close save error:', error);
  }
});

// ===== URL CACHING INTEGRATION (restored from 3643c8e) =====

// Navigation events for URL caching - CRITICAL for blocking screen to show correct URL
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId === 0) { // Main frame only
    if (blockingManager && typeof blockingManager.cacheUrl === 'function') {
      // Use BlockingManager's sophisticated URL caching (working version from 3643c8e)
      blockingManager.cacheUrl(details.tabId, details.url);
      console.log('🔗 URL cached via BlockingManager for tab', details.tabId, ':', details.url);
    } else {
      // Fallback: Simple URL caching for blocking screen
      if (details.url && !details.url.startsWith('chrome-extension://') && !details.url.startsWith('chrome://')) {
        chrome.storage.local.set({ cachedBlockedUrl: details.url }).catch(error => {
          console.error('❌ Failed to cache URL fallback:', error);
        });
        console.log('🔗 URL cached via fallback:', details.url);
      }
    }
  }
});

// ===== EXTENSION INITIALIZATION =====

let isInitialized = false;

async function initializeExtension() {
  if (isInitialized) return;
  
  try {
    console.log('🚀 Starting ultra-simple extension initialization...');
    
    // Clean up redundant override storage (one-time cleanup)
    await cleanupRedundantOverrideStorage();
    
    // Initialize Chrome storage
    const storage = await chrome.storage.local.get(['site_usage_sessions', 'blockedSites', 'defaultSitesApplied']);
    if (!storage.site_usage_sessions) {
      await chrome.storage.local.set({ site_usage_sessions: {} });
      console.log('🆕 Initialized site_usage_sessions storage');
    }
    
    // Initialize default blocked sites for new users (only on first install)
    if (!storage.defaultSitesApplied && (!storage.blockedSites || storage.blockedSites.length === 0)) {
      const defaultSites = getDefaultBlockedSites();
      await chrome.storage.local.set({ 
        blockedSites: defaultSites,
        defaultSitesApplied: true
      });
      console.log('🆕 Initialized default blocked sites for new user:', defaultSites.length, 'sites');
      console.log('📋 Default sites:', defaultSites.join(', '));
    } else if (storage.blockedSites) {
      console.log('✅ Existing blocked sites found:', storage.blockedSites.length, 'sites');
    } else {
      console.log('ℹ️ User previously cleared blocked sites - respecting preference');
    }
    
    // Initialize Chrome Idle API
    await chromeIdleHelper.initialize();
    
    // Initialize OverrideSessionManager (restored from 3643c8e)
    if (typeof OverrideSessionManager !== 'undefined') {
      try {
        console.log('🚀 Creating OverrideSessionManager instance...');
        overrideSessionManager = new OverrideSessionManager();
        console.log('✅ OverrideSessionManager initialized successfully');
      } catch (error) {
        console.error('❌ OverrideSessionManager initialization failed:', error);
        overrideSessionManager = null;
      }
    } else {
      console.warn('⚠️ OverrideSessionManager not available - override tracking will be limited');
    }
    
    // Initialize StorageManager
    if (typeof StorageManager !== 'undefined') {
      try {
        console.log('🚀 Creating StorageManager instance...');
        storageManager = new StorageManager();
        console.log('🔧 Initializing StorageManager...');
        await storageManager.initialize();
        console.log('✅ StorageManager initialized successfully');
      } catch (error) {
        console.error('❌ StorageManager initialization failed:', error);
        storageManager = null;
      }
    } else {
      console.warn('⚠️ StorageManager not available - Deep Focus sessions will not be tracked');
    }

    // Initialize BlockingManager with enhanced error handling
    if (typeof BlockingManager !== 'undefined') {
      try {
        console.log('🚀 Creating BlockingManager instance...');
        blockingManager = new BlockingManager();
        
        // Link StorageManager to BlockingManager for session management
        if (storageManager) {
          blockingManager.setStorageManager(storageManager);
          console.log('🔗 StorageManager linked to BlockingManager');
        }
        
        console.log('🔧 Initializing BlockingManager...');
        await blockingManager.initialize();
        console.log('✅ BlockingManager initialized successfully');
        
        // Test the blocking engine immediately with error handling
        try {
          console.log('🧪 Testing blocking engine...');
          const testResult = await blockingManager.updateBlockingRules();
          console.log('🧪 Blocking engine test result:', testResult);
        } catch (testError) {
          console.warn('⚠️ Blocking engine test failed but BlockingManager is initialized:', testError);
        }
      } catch (error) {
        console.error('❌ BlockingManager initialization failed:', error);
        // Log more specific error details for debugging
        if (error.message && error.message.includes('ExtensionEventBus')) {
          console.error('🔍 ExtensionEventBus related error - check subscribe method availability');
        }
        blockingManager = null;
      }
    } else {
      console.warn('⚠️ BlockingManager class not available - check script loading');
    }

    // Initialize FocusTimeTracker coordinator with improved dependency checking
    if (typeof FocusTimeTracker !== 'undefined') {
      try {
        console.log('🚀 Creating FocusTimeTracker coordinator...');
        focusTimeTracker = new FocusTimeTracker();
        
        // Add explicit delay to ensure all dependencies are fully initialized
        console.log('⏳ Allowing time for dependencies to settle...');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('🔧 Initializing FocusTimeTracker coordinator...');
        const coordinatorResult = await focusTimeTracker.initialize();
        if (coordinatorResult) {
          console.log('✅ FocusTimeTracker coordinator initialized successfully');
        } else {
          console.error('❌ FocusTimeTracker coordinator initialization failed');
          focusTimeTracker = null;
        }
      } catch (error) {
        console.error('❌ FocusTimeTracker coordinator initialization failed:', error);
        // Log more specific error details
        if (error.message && error.message.includes('Timeout waiting for dependencies')) {
          console.error('🔍 Dependency timeout - checking what\'s available:');
          console.error('  - StorageManager:', typeof StorageManager !== 'undefined' && !!storageManager);
          console.error('  - BlockingManager:', typeof BlockingManager !== 'undefined' && !!blockingManager);
          console.error('  - StateManager:', typeof StateManager !== 'undefined');
        }
        focusTimeTracker = null;
      }
    } else {
      console.warn('⚠️ FocusTimeTracker class not available - check script loading');
    }
    
    // Start master timer
    startMasterTimer();
    
    // Set initial state
    trackingState.currentDate = DateUtils.getLocalDateString();
    trackingState.lastHeartbeat = Date.now();
    
    isInitialized = true;
    console.log('✅ Ultra-simple extension initialized successfully');
    
  } catch (error) {
    console.error('❌ Extension initialization failed:', error);
    throw error;
  }
}

// ===== MESSAGE HANDLING =====

// Listen for Deep Focus updates to trigger Firebase sync
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle Deep Focus time updates (auto-sync trigger)
  if (message.type === 'DEEP_FOCUS_TIME_UPDATED') {
    console.log('🎯 Deep Focus time updated, checking for auto-sync...');
    
    // Trigger Firebase sync after a short delay (non-blocking)
    setTimeout(() => {
      triggerDeepFocusFirebaseSync().catch(error => {
        console.warn('⚠️ Auto-sync failed:', error);
      });
    }, 2000); // 2 second delay to avoid blocking
    
    // Don't send response for this event
    return false;
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Received message:', message.type);

  // Route Deep Focus messages through FocusTimeTracker coordinator
  if (focusTimeTracker && focusTimeTracker.initialized) {
    // Check if this is a Deep Focus message type
    const deepFocusMessages = [
      'TOGGLE_FOCUS_MODE', 'ENABLE_FOCUS_MODE', 'DISABLE_FOCUS_MODE',
      'GET_FOCUS_STATE', 'GET_FOCUS_STATS', 'CREATE_DEEP_FOCUS_SESSION',
      'COMPLETE_DEEP_FOCUS_SESSION', 'GET_LOCAL_DEEP_FOCUS_TIME'
    ];
    
    if (deepFocusMessages.includes(message.type)) {
      // Handle asynchronously through coordinator
      focusTimeTracker.handleMessage(message, sender, sendResponse);
      return true; // Keep channel open for async response
    }
  }
  
  // Handle ping messages
  if (message.type === 'PING') {
    sendResponse({ success: true, initialized: isInitialized });
    return false;
  }
  
  // Handle health check
  if (message.type === 'EXTENSION_HEALTH_CHECK') {
    sendResponse({
      type: 'EXTENSION_HEALTH_RESPONSE',
      status: 'ok',
      timestamp: Date.now(),
      initialized: isInitialized
    });
    return false;
  }
  
  // Handle get stats - Enhanced with StorageManager integration
  if (message.type === 'GET_STATS') {
    (async () => {
      try {
        if (storageManager) {
          const stats = await storageManager.getTodayStats();
          sendResponse({ success: true, data: stats });
        } else {
          // Fallback to simple storage if StorageManager unavailable
          const today = DateUtils.getLocalDateString();
          const storage = await chrome.storage.local.get(['site_usage_sessions']);
          const sessions = storage.site_usage_sessions?.[today] || [];
          const stats = {
            totalTime: sessions.reduce((sum, s) => sum + (s.duration || 0), 0) * 1000,
            sitesVisited: sessions.length,
            sites: {}
          };
          
          sessions.forEach(session => {
            stats.sites[session.domain] = {
              time: (session.duration || 0) * 1000,
              visits: session.visits || 0
            };
          });
          
          sendResponse({ success: true, data: stats });
        }
      } catch (error) {
        console.error('❌ Error getting stats:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open
  }
  
  // Handle realtime stats - FIXED: Convert seconds to milliseconds
  if (message.type === 'GET_REALTIME_STATS') {
    const today = DateUtils.getLocalDateString();
    chrome.storage.local.get(['site_usage_sessions']).then(storage => {
      const sessions = storage.site_usage_sessions?.[today] || [];
      const stats = {
        totalTime: sessions.reduce((sum, s) => sum + (s.duration || 0), 0) * 1000, // Convert seconds to milliseconds
        sitesVisited: sessions.length,
        sites: {}
      };
      
      sessions.forEach(session => {
        stats.sites[session.domain] = {
          time: (session.duration || 0) * 1000, // Convert seconds to milliseconds
          visits: session.visits || 0
        };
      });
      
      console.log('📊 GET_REALTIME_STATS response:', { totalTime: stats.totalTime, sitesCount: Object.keys(stats.sites).length });
      sendResponse({ success: true, data: stats });
    }).catch(error => {
      console.error('❌ GET_REALTIME_STATS error:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep channel open
  }
  
  // Handle complete stats - FIXED: Convert seconds to milliseconds  
  if (message.type === 'GET_COMPLETE_STATS') {
    const today = DateUtils.getLocalDateString();
    chrome.storage.local.get(['site_usage_sessions']).then(storage => {
      const sessions = storage.site_usage_sessions?.[today] || [];
      
      // Group sessions by domain for better aggregation
      const domainStats = {};
      sessions.forEach(session => {
        const domain = session.domain;
        if (!domainStats[domain]) {
          domainStats[domain] = {
            timeSpent: 0,
            visits: 0,
            sessions: []
          };
        }
        domainStats[domain].timeSpent += (session.duration || 0) * 1000; // Convert seconds to milliseconds
        domainStats[domain].visits += (session.visits || 0);
        domainStats[domain].sessions.push(session);
      });
      
      const stats = {
        totalTime: sessions.reduce((sum, s) => sum + (s.duration || 0), 0) * 1000, // Convert seconds to milliseconds
        sitesVisited: Object.keys(domainStats).length,
        sites: domainStats
      };
      
      console.log('📊 GET_COMPLETE_STATS response:', { totalTime: stats.totalTime, sitesCount: stats.sitesVisited });
      sendResponse({ success: true, data: stats });
    }).catch(error => {
      console.error('❌ GET_COMPLETE_STATS error:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep channel open
  }
  
  // Handle comprehensive diagnostics
  if (message.type === 'GET_DIAGNOSTICS') {
    const uptime = Date.now() - trackingState.diagnostics.startTime;
    const diagnosticReport = {
      ...trackingState.diagnostics,
      uptimeMs: uptime,
      uptimeFormatted: Math.round(uptime / 1000) + 's',
      currentDomain: trackingState.currentDomain,
      currentDate: trackingState.currentDate,
      dataLossRate: trackingState.diagnostics.tabSwitches > 0 
        ? Math.round((1 - (trackingState.diagnostics.immediateSaves / trackingState.diagnostics.tabSwitches)) * 100) + '%'
        : '0%',
      immediateSaveSuccessRate: trackingState.diagnostics.immediateSaves > 0
        ? Math.round((trackingState.diagnostics.immediateSaves / (trackingState.diagnostics.immediateSaves + trackingState.diagnostics.firebaseSyncFailures)) * 100) + '%'
        : '100%',
      averageSecondsPerSave: trackingState.diagnostics.immediateSaves > 0
        ? Math.round(trackingState.diagnostics.savedFromDataLossSeconds / trackingState.diagnostics.immediateSaves)
        : 0
    };
    
    console.log('📊 TAB SWITCH DIAGNOSTICS REPORT:', diagnosticReport);
    
    sendResponse({ success: true, data: diagnosticReport });
    return false;
  }
  
  // Handle diagnostics reset
  if (message.type === 'RESET_DIAGNOSTICS') {
    trackingState.diagnostics = {
      immediateSaves: 0,
      tabCloseSaves: 0,
      browserCloseSaves: 0,
      savedFromDataLossSeconds: 0,
      tabSwitches: 0,
      sessionMerges: 0,
      overlapBufferUsed: 0,
      firebaseSyncAttempts: 0,
      firebaseSyncFailures: 0,
      startTime: Date.now()
    };
    console.log('🧹 Diagnostics reset successfully');
    sendResponse({ success: true, message: 'Diagnostics reset' });
    return false;
  }
  
  // Handle current session info
  if (message.type === 'GET_CURRENT_SESSION') {
    const sessionInfo = {
      currentDomain: trackingState.currentDomain,
      currentDate: trackingState.currentDate,
      lastHeartbeat: trackingState.lastHeartbeat,
      timeSinceLastHeartbeat: Date.now() - trackingState.lastHeartbeat,
      isActive: chromeIdleHelper.shouldTrackTime()
    };
    
    sendResponse({ success: true, data: sessionInfo });
    return false;
  }
  
  // TOGGLE_FOCUS_MODE now handled by FocusTimeTracker coordinator
  
  // GET_FOCUS_STATE now handled by FocusTimeTracker coordinator

  // Handle user info request
  if (message.type === 'GET_USER_INFO') {
    (async () => {
      try {
        const storage = await chrome.storage.local.get(['userInfo']);
        if (storage.userInfo) {
          console.log('✅ GET_USER_INFO: Found user info:', storage.userInfo);
          sendResponse({ success: true, data: storage.userInfo });
        } else {
          console.log('ℹ️ GET_USER_INFO: No user info found');
          sendResponse({ success: false, error: 'No user info available' });
        }
      } catch (error) {
        console.error('❌ Error getting user info:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open for async
  }

  // Handle current state request  
  if (message.type === 'GET_CURRENT_STATE') {
    (async () => {
      try {
        console.log('📨 [BACKGROUND-DEBUG] GET_CURRENT_STATE received');
        
        // Get actual focus mode from BlockingManager instead of stale storage
        const actualFocusMode = blockingManager ? blockingManager.focusMode : false;
        console.log('🔍 [BACKGROUND-DEBUG] blockingManager.focusMode:', actualFocusMode);
        
        const currentState = {
          focusMode: actualFocusMode,
          isInitialized: isInitialized,
          currentDomain: trackingState.currentDomain,
          lastHeartbeat: trackingState.lastHeartbeat
        };
        
        console.log('📤 [BACKGROUND-DEBUG] Responding with focusMode:', actualFocusMode);
        console.log('✅ GET_CURRENT_STATE - using BlockingManager focusMode:', actualFocusMode);
        
        sendResponse({ success: true, data: currentState });
      } catch (error) {
        console.error('❌ [BACKGROUND-DEBUG] Error getting current state:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open for async
  }
  
  // Handle SET_USER_ID from web app
  if (message.type === 'SET_USER_ID') {
    (async () => {
      try {
        console.log('🔄 SET_USER_ID received:', message.payload);
        
        // Create user info object from payload
        const userInfo = {
          userId: message.payload.userId,
          displayName: message.payload.displayName,
          userEmail: message.payload.userEmail,
          timezone: message.payload.timezone,
          lastUpdated: Date.now()
        };
        
        // Store user info in local storage
        await chrome.storage.local.set({ userInfo });
        console.log('✅ User info stored in local storage:', userInfo);
        
        // Notify popup of user info update
        try {
          chrome.runtime.sendMessage({
            type: 'USER_INFO_UPDATED',
            payload: userInfo
          }).catch(() => {
            console.debug('📝 Popup not available for user info update notification');
          });
        } catch (error) {
          console.debug('📝 Could not notify popup of user info update:', error.message);
        }
        
        sendResponse({ success: true, message: 'User info updated' });
      } catch (error) {
        console.error('❌ Error handling SET_USER_ID:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open for async
  }

  // Handle SET_USER_INFO from web app (complete user info)
  if (message.type === 'SET_USER_INFO') {
    (async () => {
      try {
        console.log('🔄 SET_USER_INFO received:', message.payload);
        
        // Store complete user info
        const userInfo = {
          ...message.payload,
          lastUpdated: Date.now()
        };
        
        await chrome.storage.local.set({ userInfo });
        console.log('✅ Complete user info stored:', userInfo);
        
        // Notify popup of user info update
        try {
          chrome.runtime.sendMessage({
            type: 'USER_INFO_UPDATED',
            payload: userInfo
          }).catch(() => {
            console.debug('📝 Popup not available for user info update notification');
          });
        } catch (error) {
          console.debug('📝 Could not notify popup of user info update:', error.message);
        }
        
        sendResponse({ success: true, message: 'Complete user info updated' });
      } catch (error) {
        console.error('❌ Error handling SET_USER_INFO:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open for async
  }

  // Handle SET_BLOCKED_SITES from web app
  if (message.type === 'SET_BLOCKED_SITES') {
    (async () => {
      try {
        console.log('🔄 SET_BLOCKED_SITES received:', message.payload);
        
        // Extract blocked sites from payload
        const blockedSites = Array.isArray(message.payload) 
          ? message.payload 
          : (message.payload?.blockedSites || []);
        
        // Store blocked sites
        await chrome.storage.local.set({ blockedSites });
        console.log('✅ Blocked sites synced from web app:', blockedSites);
        
        // Update blocking rules if BlockingManager is available
        if (blockingManager) {
          try {
            await blockingManager.updateBlockingRules();
            console.log('🔧 Blocking rules updated after site sync');
          } catch (error) {
            console.warn('⚠️ Failed to update blocking rules after site sync:', error);
          }
        }
        
        // Notify popup and other parts of extension
        try {
          chrome.runtime.sendMessage({
            type: 'EXTENSION_BLOCKED_SITES_UPDATED',
            payload: { blockedSites }
          }).catch(() => {
            console.debug('📝 No listeners for blocked sites update');
          });
        } catch (error) {
          console.debug('📝 Could not broadcast blocked sites update:', error.message);
        }
        
        sendResponse({ success: true, message: 'Blocked sites synced', count: blockedSites.length });
      } catch (error) {
        console.error('❌ Error handling SET_BLOCKED_SITES:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open for async
  }

  // ENABLE_FOCUS_MODE now handled by FocusTimeTracker coordinator

  // DISABLE_FOCUS_MODE now handled by FocusTimeTracker coordinator

  // Handle GET_BLOCKED_SITES request
  if (message.type === 'GET_BLOCKED_SITES') {
    (async () => {
      try {
        const storage = await chrome.storage.local.get(['blockedSites']);
        const blockedSites = storage.blockedSites || [];
        
        console.log('✅ GET_BLOCKED_SITES: Found sites:', blockedSites);
        sendResponse({ success: true, data: blockedSites });
      } catch (error) {
        console.error('❌ Error getting blocked sites:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open for async
  }

  // Handle ADD_BLOCKED_SITE request
  if (message.type === 'ADD_BLOCKED_SITE') {
    (async () => {
      try {
        const domain = message.payload?.domain;
        if (!domain) {
          sendResponse({ success: false, error: 'Domain is required' });
          return;
        }

        // Clean domain (remove protocol, www, path)
        const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
        
        // Get current blocked sites
        const storage = await chrome.storage.local.get(['blockedSites']);
        const blockedSites = storage.blockedSites || [];
        
        // Check if already blocked
        if (blockedSites.includes(cleanDomain)) {
          sendResponse({ success: false, error: 'Site is already blocked' });
          return;
        }
        
        // Add to blocked sites
        blockedSites.push(cleanDomain);
        await chrome.storage.local.set({ blockedSites });
        
        console.log('✅ ADD_BLOCKED_SITE: Added', cleanDomain);
        sendResponse({ success: true, domain: cleanDomain, message: 'Site blocked successfully' });
        
        // Notify content scripts in web app tabs
        try {
          const tabs = await chrome.tabs.query({url: ['*://app.make10000hours.com/*', '*://localhost:*/*']});
          for (const tab of tabs) {
            chrome.tabs.sendMessage(tab.id, {
              type: 'EXTENSION_BLOCKED_SITES_UPDATED',
              payload: { blockedSites }
            }).catch(() => {
              console.debug('📝 Could not notify tab', tab.id, 'of blocked sites update');
            });
          }
          console.log('✅ Notified', tabs.length, 'web app tabs of blocked sites update');
        } catch (error) {
          console.debug('📝 Could not notify web app tabs:', error.message);
        }
        
      } catch (error) {
        console.error('❌ Error adding blocked site:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open for async
  }

  // Handle TEST_BLOCKING request
  if (message.type === 'TEST_BLOCKING') {
    (async () => {
      try {
        console.log('🧪 TEST_BLOCKING: Manual blocking test requested');
        
        if (!blockingManager) {
          sendResponse({ success: false, error: 'BlockingManager not available' });
          return;
        }
        
        // Get current storage state
        const storage = await chrome.storage.local.get(['focusMode', 'blockedSites']);
        console.log('🧪 Current storage state:', storage);
        
        // Force focus mode on and test blocking
        await chrome.storage.local.set({ focusMode: true });
        const result = await blockingManager.updateBlockingRules();
        
        // Get current rules from Chrome
        const currentRules = await chrome.declarativeNetRequest.getDynamicRules();
        
        console.log('🧪 Test results:', {
          updateResult: result,
          currentRules: currentRules.length,
          rules: currentRules
        });
        
        sendResponse({ 
          success: true, 
          result: result,
          rulesCount: currentRules.length,
          rules: currentRules.map(r => ({ id: r.id, domain: r.condition.urlFilter }))
        });
      } catch (error) {
        console.error('❌ Test blocking failed:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // Handle REMOVE_BLOCKED_SITE request
  if (message.type === 'REMOVE_BLOCKED_SITE') {
    (async () => {
      try {
        const domain = message.payload?.domain;
        if (!domain) {
          sendResponse({ success: false, error: 'Domain is required' });
          return;
        }

        // Clean domain (remove protocol, www, path)
        const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
        
        // Get current blocked sites
        const storage = await chrome.storage.local.get(['blockedSites']);
        const blockedSites = storage.blockedSites || [];
        
        // Check if site is blocked
        const index = blockedSites.indexOf(cleanDomain);
        if (index === -1) {
          sendResponse({ success: false, error: 'Site is not blocked' });
          return;
        }
        
        // Remove from blocked sites
        blockedSites.splice(index, 1);
        await chrome.storage.local.set({ blockedSites });
        
        console.log('✅ REMOVE_BLOCKED_SITE: Removed', cleanDomain);
        sendResponse({ success: true, domain: cleanDomain, message: 'Site unblocked successfully' });
        
        // Notify content scripts in web app tabs
        try {
          const tabs = await chrome.tabs.query({url: ['*://app.make10000hours.com/*', '*://localhost:*/*']});
          for (const tab of tabs) {
            chrome.tabs.sendMessage(tab.id, {
              type: 'EXTENSION_BLOCKED_SITES_UPDATED',
              payload: { blockedSites }
            }).catch(() => {
              console.debug('📝 Could not notify tab', tab.id, 'of blocked sites update');
            });
          }
          console.log('✅ Notified', tabs.length, 'web app tabs of blocked sites update');
        } catch (error) {
          console.debug('📝 Could not notify web app tabs:', error.message);
        }
        
      } catch (error) {
        console.error('❌ Error removing blocked site:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open for async
  }

  // Handle BLOCKED_ATTEMPT - Record when user tries to access blocked site
  if (message.type === 'BLOCKED_ATTEMPT') {
    (async () => {
      try {
        const domain = message.payload?.domain;
        if (!domain) {
          sendResponse({ success: false, error: 'Domain is required' });
          return;
        }

        if (blockingManager) {
          blockingManager.recordBlockedAttempt(domain);
          console.log('🚫 Recorded blocked attempt for:', domain);
          sendResponse({ success: true, message: 'Blocked attempt recorded' });
        } else {
          console.warn('⚠️ BlockingManager not available for recording blocked attempt');
          sendResponse({ success: false, error: 'BlockingManager not available' });
        }
      } catch (error) {
        console.error('❌ Error recording blocked attempt:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // Handle OVERRIDE_SITE - Temporarily allow site access during focus mode
  if (message.type === 'OVERRIDE_SITE') {
    (async () => {
      try {
        const domain = message.payload?.domain;
        const duration = message.payload?.duration || 5; // Default 5 minutes
        
        if (!domain) {
          sendResponse({ success: false, error: 'Domain is required' });
          return;
        }

        if (blockingManager) {
          const result = await blockingManager.overrideSite(domain, duration);
          console.log('⏰ Site override result:', result);
          sendResponse(result);
        } else {
          console.warn('⚠️ BlockingManager not available for site override');
          sendResponse({ success: false, error: 'BlockingManager not available' });
        }
      } catch (error) {
        console.error('❌ Error creating site override:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // Handle GET_SESSION_TIME - Get current focus session time
  if (message.type === 'GET_SESSION_TIME') {
    (async () => {
      try {
        if (blockingManager) {
          const stats = blockingManager.getFocusStats();
          const sessionTime = stats.focusTime || 0;
          
          console.log('⏱️ Current session time:', Math.floor(sessionTime / 1000 / 60), 'minutes');
          sendResponse({ 
            success: true, 
            sessionTime: sessionTime,
            sessionTimeMinutes: Math.floor(sessionTime / 1000 / 60),
            focusMode: stats.focusMode
          });
        } else {
          console.warn('⚠️ BlockingManager not available for session time');
          sendResponse({ success: false, error: 'BlockingManager not available' });
        }
      } catch (error) {
        console.error('❌ Error getting session time:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // GET_FOCUS_STATS now handled by FocusTimeTracker coordinator

  // Handle RESET_BLOCKING_STATE - Reset all blocking state (for debugging/testing)
  if (message.type === 'RESET_BLOCKING_STATE') {
    (async () => {
      try {
        if (blockingManager) {
          const result = await blockingManager.resetBlockingState();
          console.log('🔄 Blocking state reset result:', result);
          sendResponse(result);
        } else {
          console.warn('⚠️ BlockingManager not available for state reset');
          sendResponse({ success: false, error: 'BlockingManager not available' });
        }
      } catch (error) {
        console.error('❌ Error resetting blocking state:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // GET_TODAY_STATS - Enhanced blocking screen handler with StorageManager integration
  if (message.type === 'GET_TODAY_STATS') {
    (async () => {
      try {
        if (storageManager) {
          // Use StorageManager for comprehensive stats (working version from 3643c8e)
          const stats = await storageManager.getTodayStats();
          console.log('📊 GET_TODAY_STATS via StorageManager:', stats);
          sendResponse({ success: true, data: stats });
        } else {
          // Fallback to domain-based tracking system
          const today = DateUtils.getLocalDateString();
          const storage = await chrome.storage.local.get(['site_usage_sessions']);
          const sessions = storage.site_usage_sessions?.[today] || [];
          const totalTime = sessions.reduce((sum, s) => sum + (s.duration || 0), 0) * 1000; // Convert to milliseconds
          
          console.log('📊 GET_TODAY_STATS fallback - totalTime:', totalTime + 'ms');
          sendResponse({ success: true, data: { totalTime, sitesVisited: sessions.length } });
        }
      } catch (error) {
        console.error('❌ Error getting today stats:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // GET_LOCAL_OVERRIDE_TIME - Enhanced with OverrideSessionManager integration (restored from 3643c8e)
  if (message.type === 'GET_LOCAL_OVERRIDE_TIME') {
    (async () => {
      try {
        if (overrideSessionManager) {
          // Use OverrideSessionManager for sophisticated override tracking (working version from 3643c8e)
          const overrideTimeResult = await overrideSessionManager.calculateTodayOverrideTime();
          console.log('⏰ GET_LOCAL_OVERRIDE_TIME via OverrideSessionManager:', overrideTimeResult);
          sendResponse({ 
            success: true, 
            data: { 
              overrideTime: overrideTimeResult.minutes,
              sessions: overrideTimeResult.sessions || 0
            }
          });
        } else {
          // Use override_sessions as primary source (simplified from 3643c8e)
          const today = DateUtils.getLocalDateString();
          
          const sessionsStorage = await chrome.storage.local.get(['override_sessions']);
          const sessions = sessionsStorage.override_sessions || {};
          const todaySessions = sessions[today] || [];
          
          // Calculate total override time from sessions
          const overrideTimeMinutes = todaySessions.reduce((total, session) => total + (session.duration || 0), 0);
          
          console.log('⏰ GET_LOCAL_OVERRIDE_TIME from sessions:', {
            sessions: todaySessions.length,
            totalMinutes: overrideTimeMinutes
          });
          
          sendResponse({ 
            success: true, 
            data: { 
              overrideTime: overrideTimeMinutes,
              sessions: todaySessions.length 
            } 
          });
        }
      } catch (error) {
        console.error('❌ Error getting override time:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // OVERRIDE_BLOCK - Enhanced with BlockingManager integration (restored from 3643c8e)
  if (message.type === 'OVERRIDE_BLOCK') {
    (async () => {
      try {
        if (blockingManager) {
          // Use BlockingManager's sophisticated temporary override system (working version from 3643c8e)
          const domain = message.payload?.domain;
          const duration = message.payload?.duration || 300000; // Default 5 minutes (300000ms)
          
          console.log('⏰ OVERRIDE_BLOCK via BlockingManager:', { domain, duration: duration + 'ms' });
          const overrideResult = await blockingManager.setTemporaryOverride(domain, duration);
          sendResponse(overrideResult);
        } else {
          // Fallback to simple override logic
          const overrideDuration = 5 * 60 * 1000; // 5 minutes
          const overrideUntil = Date.now() + overrideDuration;
          
          await chrome.storage.local.set({ overrideUntil });
          
          // Track override time
          const today = new Date().toDateString();
          const storage = await chrome.storage.local.get([`overrideTime_${today}`]);
          const currentOverrideTime = storage[`overrideTime_${today}`] || 0;
          await chrome.storage.local.set({
            [`overrideTime_${today}`]: currentOverrideTime + overrideDuration
          });
          
          console.log('⏰ OVERRIDE_BLOCK fallback - override until:', new Date(overrideUntil));
          sendResponse({ success: true, overrideUntil });
        }
      } catch (error) {
        console.error('❌ Error setting override:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  if (message.type === 'CHECK_AUTO_REDIRECT') {
    (async () => {
      try {
        const storage = await chrome.storage.local.get(['coordinatedFocusMode', 'overrideUntil']);
        const focusMode = storage.coordinatedFocusMode || false;
        const overrideUntil = storage.overrideUntil || 0;
        
        const shouldRedirect = !focusMode || (overrideUntil > Date.now());
        
        if (shouldRedirect && message.url) {
          // Navigate to the original URL
          try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0]) {
              chrome.tabs.update(tabs[0].id, { url: message.url });
            }
          } catch (error) {
            console.error('Error redirecting:', error);
          }
        }
        
        sendResponse({ success: true, shouldRedirect });
      } catch (error) {
        console.error('Error checking auto redirect:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // GET_CACHED_URL - Enhanced with BlockingManager tab-aware caching (restored from 3643c8e)
  if (message.type === 'GET_CACHED_URL') {
    (async () => {
      try {
        if (blockingManager && sender.tab?.id) {
          // Use BlockingManager's sophisticated tab-aware URL caching (working version from 3643c8e)
          const cachedUrl = blockingManager.getCachedUrl(sender.tab.id);
          console.log('🔗 GET_CACHED_URL via BlockingManager for tab', sender.tab.id, ':', cachedUrl);
          sendResponse({ success: true, data: { url: cachedUrl } });
        } else {
          // Fallback to simple storage approach
          const storage = await chrome.storage.local.get(['cachedBlockedUrl']);
          const url = storage.cachedBlockedUrl || null;
          console.log('🔗 GET_CACHED_URL fallback:', url);
          sendResponse({ success: true, data: { url } });
        }
      } catch (error) {
        console.error('❌ Error getting cached URL:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // CLEAR_CACHED_URL - Enhanced with BlockingManager integration (restored from 3643c8e)
  if (message.type === 'CLEAR_CACHED_URL') {
    (async () => {
      try {
        if (blockingManager && sender.tab?.id) {
          // Use BlockingManager's tab-aware URL clearing (working version from 3643c8e)
          blockingManager.clearCachedUrl(sender.tab.id);
          console.log('🧹 CLEAR_CACHED_URL via BlockingManager for tab', sender.tab.id);
        } else {
          // Fallback to simple storage clearing
          await chrome.storage.local.remove(['cachedBlockedUrl']);
          console.log('🧹 CLEAR_CACHED_URL fallback');
        }
        sendResponse({ success: true });
      } catch (error) {
        console.error('❌ Error clearing cached URL:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // GET_FOCUS_STATUS - Enhanced with BlockingManager integration (restored from 3643c8e)
  if (message.type === 'GET_FOCUS_STATUS') {
    (async () => {
      try {
        if (blockingManager) {
          // Use BlockingManager's live state (working version from 3643c8e)
          const focusMode = blockingManager.focusMode;
          console.log('🎯 GET_FOCUS_STATUS via BlockingManager:', focusMode);
          sendResponse({ success: true, data: { focusMode } });
        } else {
          // Fallback to storage-based approach
          const storage = await chrome.storage.local.get(['coordinatedFocusMode']);
          const focusMode = storage.coordinatedFocusMode || false;
          console.log('🎯 GET_FOCUS_STATUS fallback:', focusMode);
          sendResponse({ success: true, data: { focusMode } });
        }
      } catch (error) {
        console.error('❌ Error getting focus status:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // RECORD_OVERRIDE_SESSION - Record override session to localStorage (restored from 3643c8e)
  if (message.type === 'RECORD_OVERRIDE_SESSION') {
    (async () => {
      try {
        const { domain, duration } = message.payload || {};
        if (!domain || !duration) {
          sendResponse({ success: false, error: 'Missing domain or duration' });
          return;
        }

        // Create override session record
        const overrideSession = {
          id: `override_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          domain: domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0],
          startTime: Date.now(),
          duration: duration, // in minutes
          durationMs: duration * 60 * 1000,
          date: DateUtils.getLocalDateString(),
          timestamp: Date.now(),
          type: 'override'
        };

        // Store in localStorage with OverrideSessionManager format (from 3643c8e)
        const today = DateUtils.getLocalDateString();
        const storage = await chrome.storage.local.get(['override_sessions']);
        const sessions = storage.override_sessions || {};
        
        if (!sessions[today]) {
          sessions[today] = [];
        }
        
        sessions[today].push(overrideSession);
        await chrome.storage.local.set({ override_sessions: sessions });

        console.log('📝 Override session recorded:', overrideSession);
        
        // Broadcast update to UI components (restored from 3643c8e)
        if (typeof broadcastOverrideUpdate === 'function') {
          broadcastOverrideUpdate();
        }
        
        sendResponse({ success: true, session: overrideSession });
      } catch (error) {
        console.error('❌ Error recording override session:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // GET_LOCAL_DEEP_FOCUS_TIME now handled by FocusTimeTracker coordinator

  // CREATE_DEEP_FOCUS_SESSION now handled by FocusTimeTracker coordinator

  // COMPLETE_DEEP_FOCUS_SESSION now handled by FocusTimeTracker coordinator

  // For other messages, ensure initialization
  if (!isInitialized) {
    console.log('⚠️ Extension not initialized, initializing now...');
    initializeExtension().then(() => {
      sendResponse({ success: true, message: 'Extension initialized' });
    }).catch(error => {
      sendResponse({ success: false, error: 'Extension initialization failed' });
    });
    return true;
  }
  
  console.warn('⚠️ Unhandled message type:', message.type);
  sendResponse({ success: false, error: 'Unknown message type' });
  return false;
});

// ===== EXTENSION LIFECYCLE =====

chrome.runtime.onInstalled.addListener(() => {
  initializeExtension().catch(error => {
    console.error('❌ Extension installation initialization failed:', error);
  });
});

chrome.runtime.onStartup.addListener(() => {
  initializeExtension().catch(error => {
    console.error('❌ Extension startup initialization failed:', error);
  });
});

// Critical cleanup on shutdown with immediate save
chrome.runtime.onSuspend.addListener(async () => {
  console.log('🚨 Extension suspending - emergency save');
  try {
    await performImmediateSave('extension_suspend');
    await completeActiveSessions();
    if (masterTimer) clearInterval(masterTimer);
    console.log('✅ Emergency save completed successfully');
  } catch (error) {
    console.error('❌ Emergency save failed:', error);
  }
});

// Additional suspend handlers for better coverage
chrome.runtime.onSuspendCanceled.addListener(() => {
  console.log('🔄 Suspend canceled - restarting tracking');
  if (!masterTimer) {
    startMasterTimer();
  }
});

// Initialize immediately
initializeExtension().catch(error => {
  console.error('❌ Top-level initialization failed:', error);
});

console.log('🎯 Ultra-Simple Domain-Day Tracking System loaded - ~150 lines vs 7300+ lines replaced');