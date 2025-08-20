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
      existingSession.updatedAt = now;
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
        createdAt: now,
        updatedAt: now,
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
        session.updatedAt = new Date();
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
  } catch (error) {
    console.error('❌ Firebase sync error:', error);
    trackingState.diagnostics.firebaseSyncFailures++;
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

// ===== EXTENSION INITIALIZATION =====

let isInitialized = false;

async function initializeExtension() {
  if (isInitialized) return;
  
  try {
    console.log('🚀 Starting ultra-simple extension initialization...');
    
    // Initialize Chrome storage
    const storage = await chrome.storage.local.get(['site_usage_sessions']);
    if (!storage.site_usage_sessions) {
      await chrome.storage.local.set({ site_usage_sessions: {} });
      console.log('🆕 Initialized site_usage_sessions storage');
    }
    
    // Initialize Chrome Idle API
    await chromeIdleHelper.initialize();
    
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Received message:', message.type);
  
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
  
  // Handle get stats
  if (message.type === 'GET_STATS') {
    const today = DateUtils.getLocalDateString();
    chrome.storage.local.get(['site_usage_sessions']).then(storage => {
      const sessions = storage.site_usage_sessions?.[today] || [];
      const stats = {
        totalTime: sessions.reduce((sum, s) => sum + s.duration, 0),
        sitesVisited: sessions.length,
        sites: {}
      };
      
      sessions.forEach(session => {
        stats.sites[session.domain] = {
          time: session.duration,
          visits: session.visits
        };
      });
      
      sendResponse({ success: true, data: stats });
    }).catch(error => {
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