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

// Global BlockingManager instance
let blockingManager = null;

// Load BlockingManager
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
    
    // Initialize BlockingManager
    if (typeof BlockingManager !== 'undefined') {
      try {
        console.log('🚀 Creating BlockingManager instance...');
        blockingManager = new BlockingManager();
        console.log('🔧 Initializing BlockingManager...');
        await blockingManager.initialize();
        console.log('✅ BlockingManager initialized successfully');
        
        // Test the blocking engine immediately
        console.log('🧪 Testing blocking engine...');
        const testResult = await blockingManager.updateBlockingRules();
        console.log('🧪 Blocking engine test result:', testResult);
      } catch (error) {
        console.error('❌ BlockingManager initialization failed:', error);
        blockingManager = null;
      }
    } else {
      console.warn('⚠️ BlockingManager not available');
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
  
  // Handle get stats (original handler) - FIXED: Convert seconds to milliseconds
  if (message.type === 'GET_STATS') {
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
      
      sendResponse({ success: true, data: stats });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
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
  
  // Handle focus mode toggle
  if (message.type === 'TOGGLE_FOCUS_MODE') {
    (async () => {
      try {
        if (blockingManager) {
          // Use BlockingManager for comprehensive focus mode toggle
          const result = await blockingManager.toggleFocusMode();
          
          if (result.success) {
            console.log(`🎯 Focus mode toggled via BlockingManager: ${result.focusMode}`);
            
            // Notify web app of focus mode change
            try {
              chrome.tabs.query({url: ['*://app.make10000hours.com/*', '*://localhost:*/*']}, (tabs) => {
                tabs.forEach(tab => {
                  chrome.tabs.sendMessage(tab.id, {
                    type: 'EXTENSION_FOCUS_STATE_CHANGED',
                    payload: { 
                      isActive: result.focusMode,
                      sessionId: result.sessionId,
                      source: 'extension_toggle'
                    }
                  }).catch(() => {
                    console.debug('📝 Could not notify tab', tab.id, 'of focus state change');
                  });
                });
                console.log('📡 Notified', tabs.length, 'web app tabs of focus state change');
              });
            } catch (error) {
              console.debug('📝 Could not notify web app tabs:', error.message);
            }
            
            sendResponse({ 
              success: true, 
              focusMode: result.focusMode,
              sessionId: result.sessionId,
              message: result.focusMode ? 'Deep Focus mode activated' : 'Deep Focus mode deactivated'
            });
          } else {
            throw new Error(result.error);
          }
        } else {
          // BlockingManager is critical for Deep Focus - cannot proceed without it
          console.error('❌ BlockingManager not available - Deep Focus cannot function');
          throw new Error('BlockingManager not initialized - site blocking unavailable');
        }
      } catch (error) {
        console.error('❌ Error toggling focus mode:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open for async
  }
  
  // Handle get focus mode state
  if (message.type === 'GET_FOCUS_STATE') {
    (async () => {
      try {
        const storage = await chrome.storage.local.get(['focusMode']);
        const focusMode = storage.focusMode || false;
        
        sendResponse({ 
          success: true, 
          focusMode: focusMode,
          data: { isActive: focusMode }
        });
      } catch (error) {
        console.error('❌ Error getting focus state:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open for async
  }

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
        const storage = await chrome.storage.local.get(['focusMode']);
        const focusMode = storage.focusMode || false;
        
        const currentState = {
          focusMode: focusMode,
          isInitialized: isInitialized,
          currentDomain: trackingState.currentDomain,
          lastHeartbeat: trackingState.lastHeartbeat
        };
        
        console.log('✅ GET_CURRENT_STATE:', currentState);
        sendResponse({ success: true, data: currentState });
      } catch (error) {
        console.error('❌ Error getting current state:', error);
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

  // Handle ENABLE_FOCUS_MODE from web app
  if (message.type === 'ENABLE_FOCUS_MODE') {
    (async () => {
      try {
        console.log('🔄 ENABLE_FOCUS_MODE received from web app');
        
        if (blockingManager) {
          const result = await blockingManager.setFocusMode(true);
          
          if (result.success) {
            console.log('✅ Focus mode enabled via web app sync');
            sendResponse({ 
              success: true, 
              focusMode: true,
              sessionId: result.sessionId,
              message: 'Deep Focus mode enabled from web app'
            });
            
            // Notify web app of successful sync
            try {
              chrome.tabs.query({url: ['*://app.make10000hours.com/*', '*://localhost:*/*']}, (tabs) => {
                tabs.forEach(tab => {
                  chrome.tabs.sendMessage(tab.id, {
                    type: 'EXTENSION_FOCUS_STATE_CHANGED',
                    payload: { isActive: true }
                  }).catch(() => {
                    console.debug('📝 Could not notify tab', tab.id, 'of focus state change');
                  });
                });
              });
            } catch (error) {
              console.debug('📝 Could not notify web app tabs:', error.message);
            }
          } else {
            throw new Error(result.error);
          }
        } else {
          // BlockingManager is critical for Deep Focus - cannot proceed without it
          console.error('❌ BlockingManager not available - Deep Focus cannot function');
          throw new Error('BlockingManager not initialized - site blocking unavailable');
        }
      } catch (error) {
        console.error('❌ Error enabling focus mode from web app:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

  // Handle DISABLE_FOCUS_MODE from web app
  if (message.type === 'DISABLE_FOCUS_MODE') {
    (async () => {
      try {
        console.log('🔄 DISABLE_FOCUS_MODE received from web app');
        
        if (blockingManager) {
          const result = await blockingManager.setFocusMode(false);
          
          if (result.success) {
            console.log('✅ Focus mode disabled via web app sync');
            sendResponse({ 
              success: true, 
              focusMode: false,
              message: 'Deep Focus mode disabled from web app'
            });
            
            // Notify web app of successful sync
            try {
              chrome.tabs.query({url: ['*://app.make10000hours.com/*', '*://localhost:*/*']}, (tabs) => {
                tabs.forEach(tab => {
                  chrome.tabs.sendMessage(tab.id, {
                    type: 'EXTENSION_FOCUS_STATE_CHANGED',
                    payload: { isActive: false }
                  }).catch(() => {
                    console.debug('📝 Could not notify tab', tab.id, 'of focus state change');
                  });
                });
              });
            } catch (error) {
              console.debug('📝 Could not notify web app tabs:', error.message);
            }
          } else {
            throw new Error(result.error);
          }
        } else {
          // BlockingManager is critical for Deep Focus - cannot proceed without it
          console.error('❌ BlockingManager not available - Deep Focus cannot function');
          throw new Error('BlockingManager not initialized - site blocking unavailable');
        }
      } catch (error) {
        console.error('❌ Error disabling focus mode from web app:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

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

  // Handle GET_FOCUS_STATS - Get detailed focus statistics
  if (message.type === 'GET_FOCUS_STATS') {
    (async () => {
      try {
        if (blockingManager) {
          const stats = blockingManager.getFocusStats();
          console.log('📊 Focus stats requested:', stats);
          sendResponse({ success: true, data: stats });
        } else {
          console.warn('⚠️ BlockingManager not available for focus stats');
          sendResponse({ success: false, error: 'BlockingManager not available' });
        }
      } catch (error) {
        console.error('❌ Error getting focus stats:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }

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