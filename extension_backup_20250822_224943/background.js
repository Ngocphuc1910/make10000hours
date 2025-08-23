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
    
    chrome.idle.setDetectionInterval(600); // 10 minutes
    chrome.idle.queryState(600, (state) => {
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

/**
 * Forward message to web app for Firebase sync (restored from 3643c8e)
 */
async function forwardToWebApp(messageType, payload) {
  try {
    // Find web app tabs (localhost or production)
    const tabs = await chrome.tabs.query({
      url: ['*://app.make10000hours.com/*', '*://localhost:*/*']
    });
    
    if (tabs.length === 0) {
      console.log('📡 No web app tabs found for Firebase sync');
      return { success: false, reason: 'No web app tabs found' };
    }
    
    const enhancedPayload = {
      ...payload,
      timestamp: Date.now(),
      source: 'extension',
      messageType
    };
    
    // Send to all web app tabs
    const results = [];
    for (const tab of tabs) {
      try {
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: messageType,
          payload: enhancedPayload
        });
        results.push({ tabId: tab.id, success: true, response });
        console.log(`📡 Forwarded ${messageType} to web app tab ${tab.id}`);
      } catch (error) {
        console.warn(`⚠️ Failed to forward to tab ${tab.id}:`, error);
        results.push({ tabId: tab.id, success: false, error: error.message });
      }
    }
    
    return { 
      success: results.some(r => r.success), 
      results,
      tabsFound: tabs.length 
    };
  } catch (error) {
    console.error('❌ Error forwarding to web app:', error);
    return { success: false, error: error.message };
  }
}

// Global instances
let blockingManager = null;
let storageManager = null;
let focusTimeTracker = null;
let overrideSessionManager = null;

// Extension initialization state
let isInitialized = false;

// Load scripts in proper dependency order to prevent initialization issues

// Load StorageManager first (optional - core tracking works without it)
try {
  importScripts('./models/StorageManager.js');
  console.log('✅ StorageManager script loaded successfully');
} catch (error) {
  console.warn('⚠️ StorageManager not available (optional):', error.message);
}

// Load StateManager second (optional - core tracking works without it)
try {
  importScripts('./models/StateManager.js');
  console.log('✅ StateManager script loaded successfully');
} catch (error) {
  console.warn('⚠️ StateManager not available (optional):', error.message);
}

// Load BlockingManager third (optional - core tracking works without it)
try {
  importScripts('./models/BlockingManager.js');
  console.log('✅ BlockingManager script loaded successfully');
} catch (error) {
  console.warn('⚠️ BlockingManager not available (optional):', error.message);
}

// Load FocusTimeTracker last (optional - core tracking works without it)
try {
  importScripts('./models/FocusTimeTracker.js');
  console.log('✅ FocusTimeTracker script loaded successfully');
} catch (error) {
  console.warn('⚠️ FocusTimeTracker not available (optional):', error.message);
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

// Initialize extension after all components are loaded
async function initializeExtension() {
  try {
    console.log('🔄 Initializing extension components...');
    
    // Initialize StorageManager first
    if (typeof StorageManager !== 'undefined' && !storageManager) {
      storageManager = new StorageManager();
      await storageManager.initialize();
      console.log('✅ StorageManager initialized');
    }
    
    // Initialize BlockingManager second (requires StorageManager)
    if (typeof BlockingManager !== 'undefined' && !blockingManager) {
      blockingManager = new BlockingManager();
      if (storageManager && typeof blockingManager.setStorageManager === 'function') {
        blockingManager.setStorageManager(storageManager);
      }
      await blockingManager.initialize();
      console.log('✅ BlockingManager initialized');
    }
    
    // Initialize FocusTimeTracker last (requires both managers)
    if (typeof FocusTimeTracker !== 'undefined' && !focusTimeTracker) {
      focusTimeTracker = new FocusTimeTracker();
      console.log('✅ FocusTimeTracker instance created');
    }
    
    if (focusTimeTracker && typeof focusTimeTracker.initialize === 'function') {
      await focusTimeTracker.initialize();
      console.log('✅ FocusTimeTracker initialized');
    }
    
    // Mark as initialized
    isInitialized = true;
    console.log('✅ Extension initialization completed');
    
  } catch (error) {
    console.error('❌ Extension initialization failed:', error);
    isInitialized = false;
  }
}

// Initialize as soon as the service worker starts
initializeExtension();

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
  currentDate: DateUtils.getLocalDateString(),
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
    
    // Brief delay to prevent data loss - no emergency save needed with 5-second tracking
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
 * Self-contained time tracking timer - no dependencies on global variables
 * 5-second interval for accurate time tracking
 */
setInterval(async () => {
  try {
    // Get current active tab
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (tabs[0] && tabs[0].url && tabs[0].url.startsWith('http')) {
      const domain = new URL(tabs[0].url).hostname;
      const now = new Date();
      const today = now.toLocaleDateString('en-CA'); // YYYY-MM-DD format
      
      // Check if user is idle (10-minute threshold)
      let isActive = true;
      try {
        if (chrome.idle) {
          await new Promise((resolve) => {
            chrome.idle.queryState(600, (state) => { // 10 minutes
              isActive = (state === 'active');
              resolve();
            });
          });
        }
      } catch (e) {
        // If idle check fails, assume active
        isActive = true;
      }
      
      if (isActive) {
        // Update session storage directly
        const storage = await chrome.storage.local.get(['site_usage_sessions']);
        const allSessions = storage.site_usage_sessions || {};
        const todaySessions = allSessions[today] || [];
        
        // Find existing session for this domain today
        let existingSession = todaySessions.find(s => s.domain === domain);
        
        if (existingSession) {
          // Update existing session
          existingSession.duration += 5; // Add 5 seconds
          existingSession.updatedAt = now.toISOString();
          existingSession.currentlyActive = true;
        } else {
          // Create new session
          const sessionId = `${domain}_${today}_default`;
          const newSession = {
            id: sessionId,
            domain: domain,
            startTime: now.getTime(),
            startTimeUTC: now.toISOString(),
            duration: 5, // Start with 5 seconds
            visits: 0,
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
        
        console.log(`⏰ Added 5s to ${domain} (total: ${existingSession ? existingSession.duration : 5}s)`);
      }
    }
    
  } catch (error) {
    console.error('❌ Timer error:', error);
  }
}, 5000); // 5 seconds

console.log('⏰ Self-contained timer started (5s interval)');

// ===== CHROME EXTENSION EVENT HANDLERS =====

// Tab activation handler with immediate save
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
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
      const domain = new URL(tab.url).hostname;
      await handleTabSwitch(domain);
    } catch (error) {
      console.error('❌ Tab update error:', error);
    }
  }
});

// Tab removed handler - no emergency save needed with 5-second tracking
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  // No action needed - 5-second periodic tracking handles this
});

// Window focus handler - no emergency save needed with 5-second tracking
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus - just complete active sessions
    await completeActiveSessions();
    trackingState.currentDomain = null;
  }
});

// Window removed handler - Critical for browser close
chrome.windows.onRemoved.addListener(async (windowId) => {
  try {
    console.log('Browser closing - saving data');
    await performImmediateSave('browser_close');
    await completeActiveSessions();
  } catch (error) {
    console.error('❌ Browser close save error:', error);
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

// ===== SIMPLE EXTENSION SETUP =====

// Initialize Chrome Idle API for activity detection
chromeIdleHelper.initialize();

// Initialize storage structure
chrome.storage.local.get(['site_usage_sessions']).then(storage => {
  if (!storage.site_usage_sessions) {
    chrome.storage.local.set({ site_usage_sessions: {} });
    console.log('🆕 Initialized site_usage_sessions storage');
  }
});

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
  
  // Handle ping messages with enhanced context information
  if (message.type === 'PING') {
    sendResponse({ 
      success: true, 
      initialized: isInitialized,
      timestamp: Date.now(),
      ready: isInitialized && !!trackingState,
      contextInfo: {
        canReceiveMessages: true,
        initializationComplete: isInitialized,
        backgroundReady: true
      }
    });
    return false;
  }
  
  // Handle enhanced activity detection from content script
  if (message.type === 'ENHANCED_ACTIVITY_DETECTED') {
    try {
      const { payload } = message;
      if (payload && payload.domain && payload.url) {
        // Update current domain for tracking
        const domain = payload.domain;
        const currentDomain = trackingState.currentDomain;
        
        // If domain changed, handle tab switch
        if (currentDomain !== domain) {
          console.log(`🔄 Domain change detected: ${currentDomain} → ${domain}`);
          handleTabSwitch(domain);
        }
        
        // Update heartbeat
        trackingState.lastHeartbeat = Date.now();
        
        console.log(`📊 Activity detected on ${domain}`);
      }
      
      sendResponse({ success: true });
    } catch (error) {
      console.error('❌ Error handling activity detection:', error);
      sendResponse({ success: false, error: error.message });
    }
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
        // FIXED: Always use override_sessions storage format for consistency
        // OverrideSessionManager uses different storage key ('overrideSessions' vs 'override_sessions')
        if (false) { // Disable OverrideSessionManager temporarily due to storage key mismatch
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
            todayKey: today,
            sessions: todaySessions.length,
            totalMinutes: overrideTimeMinutes,
            sessionDetails: todaySessions,
            allStoredSessions: sessions
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

        // Get user context for Firebase sync (restored from 3643c8e)
        const userStorage = await chrome.storage.local.get(['userInfo']);
        const userInfo = userStorage.userInfo || {};
        const currentUserId = userInfo.uid || null;

        // Create override session record
        const overrideSession = {
          id: `override_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          domain: domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0],
          startTime: Date.now(),
          duration: duration, // in minutes
          durationMs: duration * 60 * 1000,
          date: DateUtils.getLocalDateString(),
          timestamp: Date.now(),
          type: 'override',
          userId: currentUserId // Add user context for Firebase
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

        console.log('📝 Override session recorded:', {
          session: overrideSession,
          todayKey: today,
          totalSessions: sessions[today].length,
          allSessions: sessions
        });
        
        // Broadcast update to UI components (restored from 3643c8e)
        if (typeof broadcastOverrideUpdate === 'function') {
          broadcastOverrideUpdate();
        }
        
        // Forward to web app for Firebase sync (restored from 3643c8e)
        const enhancedPayload = {
          ...message.payload,
          session: overrideSession,
          userId: currentUserId,
          timestamp: Date.now(),
          source: 'extension'
        };
        
        try {
          const forwardResult = await forwardToWebApp('RECORD_OVERRIDE_SESSION', enhancedPayload);
          console.log('📡 Override session forwarded to web app:', forwardResult);
        } catch (error) {
          console.warn('⚠️ Failed to forward override session to web app:', error);
          // Don't fail the whole operation if Firebase sync fails
        }
        
        sendResponse({ 
          success: true, 
          session: overrideSession,
          localStorage: true,
          firebaseSync: true // Indicates sync was attempted
        });
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

  // Handle SYNC_USER_AUTH - Sync user authentication from web app to extension
  if (message.type === 'SYNC_USER_AUTH') {
    (async () => {
      try {
        console.log('🔄 SYNC_USER_AUTH received:', message.payload);
        
        // Store user authentication info
        const userInfo = {
          uid: message.payload.userId,
          userId: message.payload.userId,
          email: message.payload.email,
          lastSynced: Date.now(),
          syncSource: 'web_app'
        };
        
        await chrome.storage.local.set({ userInfo });
        console.log('✅ User authentication synced to extension:', userInfo);
        
        sendResponse({ 
          success: true, 
          message: 'User authentication synced successfully',
          userId: userInfo.userId
        });
      } catch (error) {
        console.error('❌ Error syncing user authentication:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open for async
  }

  // Handle ADD_TEST_OVERRIDE_SESSIONS - Add test sessions for debugging
  if (message.type === 'ADD_TEST_OVERRIDE_SESSIONS') {
    (async () => {
      try {
        console.log('📝 ADD_TEST_OVERRIDE_SESSIONS received:', message.payload);
        
        const { sessions, userId, today } = message.payload;
        
        // Add sessions to override_sessions storage
        const storage = await chrome.storage.local.get(['override_sessions']);
        const allOverrideSessions = storage.override_sessions || {};
        
        if (!allOverrideSessions[today]) {
          allOverrideSessions[today] = [];
        }
        
        // Add test sessions
        allOverrideSessions[today].push(...sessions);
        
        await chrome.storage.local.set({ override_sessions: allOverrideSessions });
        
        console.log('✅ Added test override sessions:', {
          date: today,
          sessionsAdded: sessions.length,
          totalForToday: allOverrideSessions[today].length,
          allDates: Object.keys(allOverrideSessions)
        });
        
        sendResponse({ 
          success: true, 
          message: 'Test sessions added',
          sessionsAdded: sessions.length,
          totalSessions: allOverrideSessions[today].length
        });
      } catch (error) {
        console.error('❌ Error adding test sessions:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open for async
  }

  // Handle ANALYZE_SESSION_STORAGE - Debug storage contents
  if (message.type === 'ANALYZE_SESSION_STORAGE') {
    (async () => {
      try {
        console.log('🔍 ANALYZE_SESSION_STORAGE received:', message.payload);
        
        const { userId, today } = message.payload;
        
        // Get all storage data
        const storage = await chrome.storage.local.get(['site_usage_sessions', 'override_sessions', 'userInfo']);
        
        console.log('📊 [STORAGE-ANALYSIS] Complete storage contents:', {
          hasSiteUsage: !!storage.site_usage_sessions,
          hasOverrideSessions: !!storage.override_sessions,
          hasUserInfo: !!storage.userInfo,
          siteUsageKeys: Object.keys(storage.site_usage_sessions || {}),
          overrideKeys: Object.keys(storage.override_sessions || {}),
          userInfo: storage.userInfo,
          todayOverrideSessions: storage.override_sessions?.[today] || [],
          todaySiteUsage: storage.site_usage_sessions?.[today] || []
        });
        
        // Detailed filtering analysis
        const overrideSessions = storage.override_sessions || {};
        const todaySessions = overrideSessions[today] || [];
        
        console.log('📊 [FILTERING-ANALYSIS] Override session analysis:', {
          totalStorageDays: Object.keys(overrideSessions).length,
          todayKey: today,
          todaySessionsCount: todaySessions.length,
          todaySessionsDetails: todaySessions.map(s => ({
            id: s.id,
            domain: s.domain,
            duration: s.duration,
            userId: s.userId,
            type: s.type,
            passesFilter: s.duration > 0
          })),
          filteredSessions: todaySessions.filter(s => s.duration > 0)
        });
        
        sendResponse({ 
          success: true, 
          analysis: 'Complete storage analysis logged'
        });
      } catch (error) {
        console.error('❌ Error analyzing storage:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open for async
  }

  // Handle REQUEST_SITE_USAGE_SESSIONS - Send session data to web app for Firebase sync
  if (message.type === 'REQUEST_SITE_USAGE_SESSIONS') {
    (async () => {
      try {
        console.log('🔄 REQUEST_SITE_USAGE_SESSIONS received from web app');
        
        // Get user context with enhanced debugging
        const userStorage = await chrome.storage.local.get(['userInfo']);
        const userInfo = userStorage.userInfo || {};
        console.log('🔍 REQUEST_SITE_USAGE_SESSIONS - User storage debug:', {
          hasUserInfo: !!userStorage.userInfo,
          userInfoKeys: Object.keys(userInfo),
          userInfo: userInfo
        });
        
        const currentUserId = userInfo.uid || userInfo.userId || null;
        
        if (!currentUserId) {
          console.warn('⚠️ No user ID available for session sync');
          console.warn('🔍 Available userInfo:', userInfo);
          sendResponse({ success: false, error: 'No user ID available' });
          return;
        }
        
        console.log('✅ Found user ID:', currentUserId);
        
        // Get all session data from storage
        const storage = await chrome.storage.local.get(['site_usage_sessions', 'override_sessions']);
        const siteUsageSessions = storage.site_usage_sessions || {};
        const overrideSessions = storage.override_sessions || {};
        
        console.log('🔍 SESSION STORAGE DEBUG:', {
          hasSiteUsage: !!storage.site_usage_sessions,
          hasOverrideSessions: !!storage.override_sessions,
          siteUsageDays: Object.keys(siteUsageSessions).length,
          overrideDays: Object.keys(overrideSessions).length,
          siteUsageKeys: Object.keys(siteUsageSessions),
          overrideKeys: Object.keys(overrideSessions)
        });
        
        // Convert site usage sessions to extension format
        const allSessions = [];
        
        // Add site usage sessions
        Object.keys(siteUsageSessions).forEach(date => {
          const daySessions = siteUsageSessions[date] || [];
          daySessions.forEach(session => {
            if (session.duration > 0) { // Only include sessions with actual time
              allSessions.push({
                id: session.id || `${session.domain}_${date}_${currentUserId}`,
                userId: currentUserId,
                type: 'site_usage',
                domain: session.domain,
                url: session.domain, // Use domain as URL for compatibility
                startTimeUTC: session.startTimeUTC || new Date(session.startTime).toISOString(),
                endTimeUTC: session.endTimeUTC,
                duration: session.duration, // In seconds
                visits: session.visits || 1,
                utcDate: session.utcDate || date,
                status: session.status || 'completed',
                timezone: session.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
                createdAt: session.createdAt || session.startTimeUTC,
                updatedAt: session.updatedAt || session.startTimeUTC
              });
            }
          });
        });
        
        // Add override sessions
        console.log('🎯 Processing override sessions:');
        const overrideDates = Object.keys(overrideSessions);
        console.log(`  - Found ${overrideDates.length} override dates: ${overrideDates.join(', ')}`);
        
        Object.keys(overrideSessions).forEach(date => {
          const daySessions = overrideSessions[date] || [];
          console.log(`  - Processing ${daySessions.length} override sessions for ${date}`);
          
          daySessions.forEach((session, index) => {
            console.log(`    ${index + 1}. ${session.domain}: ${session.duration} minutes (stored format)`);
            
            if (session.duration > 0) { // Only include sessions with actual time
              const convertedSession = {
                id: session.id || `override_${session.domain}_${date}_${currentUserId}`,
                userId: currentUserId,
                type: 'override',
                domain: session.domain,
                url: session.domain, // Use domain as URL for compatibility
                startTimeUTC: new Date(session.startTime || session.timestamp).toISOString(),
                endTimeUTC: undefined, // Override sessions don't have end times
                duration: session.duration * 60, // Convert minutes to seconds for consistency
                visits: 1, // Override sessions are always single visits
                utcDate: session.date,
                status: 'completed',
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                createdAt: new Date(session.startTime || session.timestamp).toISOString(),
                updatedAt: new Date(session.startTime || session.timestamp).toISOString()
              };
              
              console.log(`       -> Converted: ${convertedSession.domain}, ${convertedSession.duration}s, type: ${convertedSession.type}`);
              allSessions.push(convertedSession);
            } else {
              console.log(`       -> Skipped (0 duration): ${session.domain}`);
            }
          });
        });
        
        console.log(`🎯 Total override sessions added: ${allSessions.filter(s => s.type === 'override').length}`);
        
        console.log(`📤 Sending ${allSessions.length} sessions to web app (${siteUsageSessions ? Object.keys(siteUsageSessions).length : 0} site usage days, ${overrideSessions ? Object.keys(overrideSessions).length : 0} override days)`);
        
        // Final session breakdown for debugging
        const sessionTypeBreakdown = {};
        allSessions.forEach(session => {
          sessionTypeBreakdown[session.type] = (sessionTypeBreakdown[session.type] || 0) + 1;
        });
        console.log('📊 Final session type breakdown:', sessionTypeBreakdown);
        console.log('🎯 Override sessions in final payload:', allSessions.filter(s => s.type === 'override').map(s => ({ domain: s.domain, duration: s.duration, id: s.id })));
        
        // Send sessions to web app via postMessage
        try {
          const tabs = await chrome.tabs.query({url: ['*://app.make10000hours.com/*', '*://localhost:*/*']});
          let messageSent = false;
          
          for (const tab of tabs) {
            try {
              // Send via content script postMessage
              await chrome.tabs.sendMessage(tab.id, {
                type: 'EXTENSION_SITE_USAGE_SESSION_BATCH',
                payload: {
                  sessions: allSessions,
                  timestamp: Date.now(),
                  source: 'extension',
                  userId: currentUserId
                }
              });
              messageSent = true;
              console.log(`📤 Sessions sent to web app tab ${tab.id}`);
            } catch (tabError) {
              console.warn(`⚠️ Failed to send to tab ${tab.id}:`, tabError.message);
            }
          }
          
          if (messageSent) {
            sendResponse({ 
              success: true, 
              sessionCount: allSessions.length,
              message: 'Sessions sent to web app'
            });
          } else {
            console.warn('⚠️ No web app tabs available to receive sessions');
            sendResponse({ 
              success: false, 
              error: 'No web app tabs found',
              sessionCount: allSessions.length
            });
          }
        } catch (error) {
          console.error('❌ Failed to send sessions to web app:', error);
          sendResponse({ success: false, error: error.message });
        }
        
      } catch (error) {
        console.error('❌ Error handling REQUEST_SITE_USAGE_SESSIONS:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open for async
  }

  // Handle test messages for debugging with enhanced context
  if (message.type === 'PING_EXTENSION') {
    console.log('🏓 PING_EXTENSION received');
    sendResponse({ 
      type: 'PONG_EXTENSION', 
      success: true, 
      timestamp: Date.now(),
      initialized: isInitialized,
      ready: isInitialized && !!trackingState,
      contextInfo: {
        canReceiveMessages: true,
        initializationComplete: isInitialized,
        backgroundReady: true,
        extensionId: chrome.runtime.id
      }
    });
    return false;
  }
  
  if (message.type === 'SYNC_USER_DATA') {
    (async () => {
      try {
        console.log('🧪 SYNC_USER_DATA test message received:', message.payload);
        
        const userInfo = {
          uid: message.payload.userId,
          userId: message.payload.userId,
          email: message.payload.email,
          lastUpdated: Date.now()
        };
        
        await chrome.storage.local.set({ userInfo });
        console.log('✅ Test user data synced to extension storage:', userInfo);
        
        sendResponse({ success: true, message: 'User data synced' });
      } catch (error) {
        console.error('❌ Error syncing test user data:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  
  if (message.type === 'INJECT_TEST_SESSIONS') {
    (async () => {
      try {
        console.log('🧪 INJECT_TEST_SESSIONS received:', message.payload);
        
        const { sessions, userId } = message.payload;
        const today = DateUtils.getLocalDateString();
        
        // Separate sessions by type - CRITICAL FIX
        const siteUsageSessions = sessions.filter(s => s.type !== 'override');
        const overrideSessions = sessions.filter(s => s.type === 'override');
        
        console.log(`🔧 Injecting ${siteUsageSessions.length} site usage sessions and ${overrideSessions.length} override sessions`);
        
        // Handle site usage sessions
        if (siteUsageSessions.length > 0) {
          const storage = await chrome.storage.local.get(['site_usage_sessions']);
          const existingSessions = storage.site_usage_sessions || {};
          
          if (!existingSessions[today]) {
            existingSessions[today] = [];
          }
          
          for (const session of siteUsageSessions) {
            console.log(`💉 Injecting site usage session: ${session.domain}`);
            existingSessions[today].push(session);
          }
          
          await chrome.storage.local.set({ site_usage_sessions: existingSessions });
        }
        
        // Handle override sessions - Store in separate override_sessions storage
        if (overrideSessions.length > 0) {
          const overrideStorage = await chrome.storage.local.get(['override_sessions']);
          const existingOverrides = overrideStorage.override_sessions || {};
          
          if (!existingOverrides[today]) {
            existingOverrides[today] = [];
          }
          
          for (const session of overrideSessions) {
            console.log(`💉 Injecting override session: ${session.domain} (${Math.round(session.duration/60)} min)`);
            
            // Convert to override session format expected by extension
            const overrideSession = {
              id: session.id,
              domain: session.domain,
              duration: Math.round(session.duration / 60), // Convert seconds to minutes
              startTime: session.startTimeUTC,
              timestamp: session.startTimeUTC,
              date: today,
              visits: 1
            };
            
            existingOverrides[today].push(overrideSession);
          }
          
          await chrome.storage.local.set({ override_sessions: existingOverrides });
        }
        
        console.log(`✅ Injected ${sessions.length} test sessions into extension storage`);
        sendResponse({ success: true, count: sessions.length });
        
      } catch (error) {
        console.error('❌ Error injecting test sessions:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  
  if (message.type === 'CHECK_STORAGE_DIRECT') {
    (async () => {
      try {
        console.log('🧪 CHECK_STORAGE_DIRECT received for userId:', message.payload?.userId);
        
        const today = DateUtils.getLocalDateString();
        const allStorage = await chrome.storage.local.get(null);
        
        console.log('📊 Complete extension storage:', {
          keys: Object.keys(allStorage),
          userInfo: allStorage.userInfo,
          hasSiteUsageSessions: !!allStorage.site_usage_sessions,
          todaySessions: allStorage.site_usage_sessions?.[today]?.length || 0
        });
        
        const todaySessions = allStorage.site_usage_sessions?.[today] || [];
        const todayOverrideSessions = allStorage.override_sessions?.[today] || [];
        
        console.log('🔍 Storage structure analysis:', {
          hasSiteUsageSessions: !!allStorage.site_usage_sessions,
          hasOverrideSessions: !!allStorage.override_sessions,
          todaySiteUsageCount: todaySessions.length,
          todayOverrideCount: todayOverrideSessions.length,
          overrideStorageKeys: allStorage.override_sessions ? Object.keys(allStorage.override_sessions) : []
        });
        
        // Look for override sessions in the correct location
        const overrideSessions = todayOverrideSessions;
        
        console.log(`🔍 Found ${overrideSessions.length} override sessions for today in override_sessions storage`);
        overrideSessions.forEach(session => {
          console.log(`  - ${session.domain}: ${session.duration}min (stored as minutes)`);
        });
        
        sendResponse({ 
          success: true, 
          storage: allStorage,
          todaySessionCount: todaySessions.length,
          overrideSessionCount: overrideSessions.length,
          overrideSessions
        });
        
      } catch (error) {
        console.error('❌ Error checking storage:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // Extension is always ready with self-contained timer
  
  console.warn('⚠️ Unhandled message type:', message.type);
  sendResponse({ success: false, error: 'Unknown message type' });
  return false;
});

// ===== EXTENSION LIFECYCLE =====

// Simple lifecycle handlers - no complex initialization needed
chrome.runtime.onInstalled.addListener(() => {
  console.log('✅ Extension installed - self-contained timer handles everything');
});

chrome.runtime.onStartup.addListener(() => {
  console.log('✅ Extension started - self-contained timer handles everything');
});

// Critical cleanup on shutdown
chrome.runtime.onSuspend.addListener(async () => {
  console.log('Extension suspending - saving data');
  try {
    await performImmediateSave('extension_suspend');
    await completeActiveSessions();
    console.log('✅ Shutdown save completed');
  } catch (error) {
    console.error('❌ Shutdown save failed:', error);
  }
});

console.log('🎯 Ultra-Simple Domain-Day Tracking System loaded - ~150 lines vs 7300+ lines replaced');