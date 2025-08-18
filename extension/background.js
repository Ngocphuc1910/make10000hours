/**
 * Background Service Worker for Focus Time Tracker Extension
 * Handles time tracking, tab management, and extension coordination
 */

// Load timezone-safe date utilities and UTC coordinator
// importScripts('./utils/dateUtils.js'); // Commented out for service worker compatibility
// Load UTC Coordinator after defining DateUtils
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
  
  // Explicitly initialize coordination (not automatic anymore)
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
  
  getLocalDateStringDaysAgo: function(daysAgo) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return DateUtils.getLocalDateStringFromDate(date);
  },
  
  generateLocalDateRange: function(days) {
    const dates = [];
    for (let i = 0; i < days; i++) {
      dates.push(DateUtils.getLocalDateStringDaysAgo(i));
    }
    return dates;
  },
  
  hasLocalDateChanged: function(previousDate) {
    return DateUtils.getLocalDateString() !== previousDate;
  },
  
  getLocalDayStart: function() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return startOfDay.getTime();
  },
  
  getLocalDayEnd: function() {
    const now = new Date();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return endOfDay.getTime();
  },
  
  isTimestampToday: function(timestamp) {
    const date = new Date(timestamp);
    return DateUtils.getLocalDateStringFromDate(date) === DateUtils.getLocalDateString();
  }
};

// UTC Filtering Utilities for Extension (based on web app implementation)
const UTCFilteringUtils = {
  /**
   * Convert local date range to UTC timestamps for session filtering
   * This matches the web app's TimezoneFilteringUtils.convertLocalDateRangeToUTC
   */
  convertLocalDateRangeToUTC: function(startDate, endDate, userTimezone) {
    console.log('🌍 Converting local date range to UTC:', {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      userTimezone
    });

    // Create start/end of day in local context
    const startOfDay = new Date(startDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(endDate);  
    endOfDay.setHours(23, 59, 59, 999);
    
    console.log('📅 Local date boundaries:', {
      startOfDay: startOfDay.toString(),
      endOfDay: endOfDay.toString()
    });

    // Convert to UTC using sv-SE locale (same as web app)
    const utcStart = new Date(
      startOfDay.toLocaleString("sv-SE", { timeZone: userTimezone })
    ).toISOString();
    
    const utcEnd = new Date(
      endOfDay.toLocaleString("sv-SE", { timeZone: userTimezone })
    ).toISOString();
    
    console.log('🕐 Converted to UTC:', {
      utcStart,
      utcEnd
    });

    // Validation: Ensure we cover approximately 24 hours
    const hoursDiff = (new Date(utcEnd).getTime() - new Date(utcStart).getTime()) / (1000 * 60 * 60);
    if (hoursDiff < 20 || hoursDiff > 28) {
      console.warn(`⚠️ Unexpected time range: ${hoursDiff.toFixed(2)} hours`, {
        utcStart,
        utcEnd,
        userTimezone
      });
    }

    return { utcStart, utcEnd };
  },

  /**
   * Filter sessions by startTimeUTC within a UTC date range
   */
  filterSessionsByUTCRange: function(sessions, utcStart, utcEnd) {
    const filtered = sessions.filter(session => {
      if (!session.startTimeUTC) {
        console.warn('⚠️ Session missing startTimeUTC, skipping:', session.id);
        return false;
      }
      
      const sessionUTC = session.startTimeUTC;
      const isInRange = sessionUTC >= utcStart && sessionUTC <= utcEnd;
      
      if (isInRange) {
        console.log('✅ Session in range:', {
          id: session.id,
          startTimeUTC: sessionUTC,
          range: `${utcStart} to ${utcEnd}`
        });
      }
      
      return isInRange;
    });
    
    console.log(`📊 Filtered ${filtered.length} sessions from ${sessions.length} total using UTC range`);
    return filtered;
  }
};

// At the top of the file
const ExtensionEventBus = {
  EVENTS: {
    DEEP_FOCUS_UPDATE: 'DEEP_FOCUS_TIME_UPDATED',
    FOCUS_STATE_CHANGE: 'FOCUS_STATE_CHANGED'
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
                chrome.runtime.lastError.message?.includes('receiving end does not exist')) {
              console.debug(`📡 No listeners for event: ${eventName}`);
            } else {
              console.warn(`⚠️ Event emission error: ${eventName}`, chrome.runtime.lastError);
            }
            resolve(); // Don't reject, just resolve to prevent uncaught promise
          } else {
            resolve(response);
          }
        });
      });
    } catch (error) {
      console.warn(`⚠️ Event emission failed: ${eventName}`, error);
    }
  }
};

class ConfigManager {
  constructor() {
    this.storageKey = 'extensionConfig';
    this.version = '1.0.0';
  }

  async initialize() {
    try {
      // Check if config exists
      const result = await chrome.storage.local.get([this.storageKey]);
      if (!result[this.storageKey]) {
        // Set default empty config
        await this.saveConfig({
          version: this.version,
          firebase: null,
          lastUpdated: Date.now()
        });
      }
      return { success: true };
    } catch (error) {
      console.error('❌ Error initializing config:', error);
      return { success: false, error: error.message };
    }
  }

  async getConfig() {
    try {
      const result = await chrome.storage.local.get([this.storageKey]);
      return {
        success: true,
        config: result[this.storageKey] || null
      };
    } catch (error) {
      console.error('❌ Error getting config:', error);
      return { success: false, error: error.message };
    }
  }

  async saveConfig(config) {
    try {
      await chrome.storage.local.set({
        [this.storageKey]: {
          ...config,
          lastUpdated: Date.now()
        }
      });
      return { success: true };
    } catch (error) {
      console.error('❌ Error saving config:', error);
      return { success: false, error: error.message };
    }
  }

  async setFirebaseConfig(firebaseConfig) {
    try {
      const current = await this.getConfig();
      if (!current.success) throw new Error(current.error);
      
      const updatedConfig = {
        ...(current.config || {}),
        firebase: firebaseConfig
      };
      
      await this.saveConfig(updatedConfig);
      return { success: true };
    } catch (error) {
      console.error('❌ Error setting Firebase config:', error);
      return { success: false, error: error.message };
    }
  }

  async getFirebaseConfig() {
    try {
      const result = await this.getConfig();
      if (!result.success) throw new Error(result.error);
      
      return {
        success: true,
        config: result.config?.firebase || null
      };
    } catch (error) {
      console.error('❌ Error getting Firebase config:', error);
      return { success: false, error: error.message };
    }
  }
}

// Utility Classes - Inline for Service Worker Compatibility

/**
 * Override Session Manager for Chrome Extension Local Storage
 * Manages override sessions with date-based organization and consistency with database schema
 */
class OverrideSessionManager {
  constructor() {
    this.storageKey = 'overrideSessions';
    this.version = '1.0.0';
  }

  generateId() {
    return `override_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getCurrentDate() {
    return DateUtils.getLocalDateString();
  }

  validateOverrideData(data) {
    const errors = [];
    
    if (!data.domain || typeof data.domain !== 'string') {
      errors.push('Missing or invalid domain');
    }
    
    if (!data.duration || typeof data.duration !== 'number' || data.duration <= 0) {
      errors.push('Missing or invalid duration');
    }
    
    if (data.userId && typeof data.userId !== 'string') {
      errors.push('Invalid userId');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async saveOverrideSession(data) {
    try {
      const validation = this.validateOverrideData(data);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      const currentDate = this.getCurrentDate();
      const sessionId = this.generateId();
      
      const overrideSession = {
        id: sessionId,
        userId: data.userId || 'anonymous',
        domain: data.domain,
        url: data.url || null,
        duration: data.duration,
        createdAt: Date.now(),
        reason: data.reason || 'manual_override',
        metadata: {
          extensionVersion: this.version,
          source: 'extension',
          ...data.metadata
        }
      };

      const result = await chrome.storage.local.get([this.storageKey]);
      const existingData = result[this.storageKey] || {};
      
      if (!existingData[currentDate]) {
        existingData[currentDate] = [];
      }
      
      existingData[currentDate].push(overrideSession);
      existingData.lastUpdated = Date.now();
      
      await chrome.storage.local.set({
        [this.storageKey]: existingData
      });
      
      console.log('✅ Override session saved to localStorage:', {
        id: sessionId,
        domain: data.domain,
        duration: data.duration + 'min',
        date: currentDate
      });
      
      return {
        success: true,
        id: sessionId,
        session: overrideSession
      };
      
    } catch (error) {
      console.error('❌ Error saving override session to localStorage:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async calculateTodayOverrideTime() {
    try {
      const currentDate = this.getCurrentDate();
      const result = await chrome.storage.local.get([this.storageKey]);
      const data = result[this.storageKey] || {};
      
      const todaySessions = data[currentDate] || [];
      const totalMinutes = todaySessions.reduce((total, session) => {
        return total + (session.duration || 0);
      }, 0);
      
      return {
        success: true,
        minutes: totalMinutes,
        sessions: todaySessions.length
      };
    } catch (error) {
      console.error('❌ Error calculating today override time:', error);
      return {
        success: false,
        minutes: 0
      };
    }
  }

  async getTodayOverrideSessions() {
    try {
      const currentDate = this.getCurrentDate();
      const result = await chrome.storage.local.get([this.storageKey]);
      const data = result[this.storageKey] || {};
      
      return {
        success: true,
        sessions: data[currentDate] || [],
        date: currentDate
      };
    } catch (error) {
      console.error('❌ Error getting today override sessions:', error);
      return {
        success: false,
        error: error.message,
        sessions: []
      };
    }
  }

  async cleanupOldSessions(daysToKeep = 30) {
    try {
      const result = await chrome.storage.local.get([this.storageKey]);
      const data = result[this.storageKey] || {};
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffDateStr = DateUtils.getLocalDateStringFromDate(cutoffDate);
      
      let deletedCount = 0;
      const updatedData = {};
      
      // Keep only recent dates
      Object.keys(data).forEach(dateStr => {
        if (dateStr === 'lastUpdated' || dateStr >= cutoffDateStr) {
          updatedData[dateStr] = data[dateStr];
        } else {
          deletedCount += Array.isArray(data[dateStr]) ? data[dateStr].length : 0;
        }
      });
      
      // Update localStorage
      await chrome.storage.local.set({
        [this.storageKey]: updatedData
      });
      
      return {
        success: true,
        deletedCount
      };
    } catch (error) {
      console.error('❌ Error cleaning up old sessions:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async clearAllSessions() {
    try {
      await chrome.storage.local.remove([this.storageKey]);
      console.log('🗑️ All override sessions cleared from localStorage');
      return { success: true };
    } catch (error) {
      console.error('❌ Error clearing override sessions:', error);
      return { success: false, error: error.message };
    }
  }

  async getDebugInfo() {
    try {
      const result = await chrome.storage.local.get([this.storageKey]);
      const data = result[this.storageKey] || {};
      
      const dates = Object.keys(data).filter(key => key !== 'lastUpdated');
      const totalSessions = dates.reduce((total, date) => {
        return total + (Array.isArray(data[date]) ? data[date].length : 0);
      }, 0);
      
      return {
        success: true,
        debug: {
          totalDates: dates.length,
          totalSessions,
          lastUpdated: data.lastUpdated,
          dates: dates.sort(),
          storageKey: this.storageKey
        }
      };
    } catch (error) {
      console.error('❌ Error getting debug info:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

/**
 * Simple Storage Manager for Chrome Extension
 */
class StorageManager {
  constructor() {
    this.initialized = false;
    this.stateManager = null;
    this.currentUserId = null;
  }

  setStateManager(stateManager) {
    this.stateManager = stateManager;
    console.log('✅ StateManager reference set in StorageManager');
  }

  async initialize() {
    // Check if storage is available and initialize default settings
    try {
      await chrome.storage.local.get(['test']);
      
      // Ensure storage is initialized with site_usage_sessions instead of stats
      const storage = await chrome.storage.local.get(['settings', 'site_usage_sessions']);
      if (!storage.settings) {
        await this.saveSettings(this.getDefaultSettings());
      }
      if (!storage.site_usage_sessions) {
        await chrome.storage.local.set({ 
          site_usage_sessions: {}
        });
        console.log('🆕 Initialized site_usage_sessions storage');
      }
      
      // Migrate from old stats if needed
      await this.migrateFromStatsToSessions();
      
      this.initialized = true;
      console.log('✅ Storage Manager initialized with site_usage_sessions');
      
      // ✅ NEW: Set up periodic sync to Firebase (every 5 minutes)
      setInterval(() => {
        this.syncSessionsToFirebase().catch(error => {
          console.warn('⚠️ Periodic sync failed:', error);
        });
      }, 5 * 60 * 1000); // 5 minutes
      
      // ✅ NEW: Initial sync after 10 seconds
      setTimeout(() => {
        this.syncSessionsToFirebase().catch(error => {
          console.warn('⚠️ Initial sync failed:', error);
        });
      }, 10000);
      
      // Sync with state manager if available
      if (this.stateManager?.isInitialized) {
        const state = this.stateManager.getState();
        if (state.todayStats) {
          // Update state with session-based stats
          await this.stateManager.dispatch({
            type: 'UPDATE_STATS',
            payload: await this.getTodayStats()
          });
        }
      }
    } catch (error) {
      console.error('❌ Storage Manager initialization failed:', error);
    }
  }

  getDefaultSettings() {
    return {
      trackingEnabled: true,
      blockingEnabled: false,
      focusMode: false,
      blockedSites: [],
      categories: this.getDefaultSiteCategories()
    };
  }

  async saveTimeEntry(domain, incrementalTimeSpent, visits = 1, actualStartTime = null, operationType = 'create') {
    try {
      const now = new Date();
      const today = DateUtils.getLocalDateString();
      
      // 🎯 NEW: Reject finalization without valid startTime
      if (operationType === 'finalize' && !actualStartTime) {
        console.error('❌ Finalization rejected - no valid startTime for:', domain);
        return null; // Don't create bogus session
      }
      
      // 🎯 NEW: Enhanced timing validation to prevent sessions created with wrong timestamps
      if (actualStartTime) {
        const timeDiff = now.getTime() - new Date(actualStartTime).getTime();
        // Prevent sessions with start times that are unreasonably far in the future or past
        if (timeDiff < 0) {
          console.warn('⚠️ actualStartTime is in the future, rejecting session creation');
          return null; // Don't create session with future timestamp
        } else if (timeDiff > 86400000) { // 24 hours
          console.warn('⚠️ actualStartTime is more than 24 hours old, rejecting session creation');
          return null; // Don't create session with very old timestamp
        }
        
        // 🎯 NEW: Additional validation for incremental saves (visits = 0)
        if (visits === 0 && timeDiff > 300000) { // 5 minutes
          console.warn('⚠️ Incremental save with old timestamp, possible timing race condition');
          console.log('🔍 Timing details:', {
            domain,
            actualStartTime: new Date(actualStartTime).toISOString(),
            currentTime: now.toISOString(),
            timeDiff: Math.round(timeDiff / 1000) + 's',
            incrementalTimeSpent: Math.round(incrementalTimeSpent / 1000) + 's'
          });
          
          // If the timing looks suspicious for an incremental save, reject it
          if (timeDiff > incrementalTimeSpent + 60000) { // Start time is more than 1 minute older than the duration
            console.error('❌ Rejecting session save due to timing inconsistency');
            return null;
          }
        }
      }
      
      // 🎯 NEW: Additional check for visits=0 (incremental saves) - these should not create new sessions
      if (visits === 0) {
        // Get existing sessions first to check if we have an active session
        const storage = await chrome.storage.local.get(['site_usage_sessions']);
        const sessions = storage.site_usage_sessions || {};
        
        if (!sessions[today]) {
          sessions[today] = [];
        }
        
        // Look for existing active session for this domain
        const existingActiveSession = sessions[today].find(s => 
          s.domain === domain && s.status === 'active'
        );
        
        if (!existingActiveSession) {
          console.warn('⚠️ Incremental save (visits=0) attempted but no active session exists for:', domain);
          console.log('🚫 Rejecting incremental save without active session to prevent orphaned session creation');
          return null;
        }
        
        // 🎯 NEW: Validate that the incremental save makes sense temporally
        const sessionAge = now.getTime() - new Date(existingActiveSession.startTime).getTime();
        if (incrementalTimeSpent > sessionAge + 60000) { // Incremental time is more than session age + 1 minute buffer
          console.error('❌ Incremental time exceeds session age, possible timing issue:', {
            domain,
            sessionAge: Math.round(sessionAge / 1000) + 's',
            incrementalTime: Math.round(incrementalTimeSpent / 1000) + 's'
          });
          return null;
        }
      }
      
      // Get existing sessions
      const storage = await chrome.storage.local.get(['site_usage_sessions']);
      const sessions = storage.site_usage_sessions || {};
      
      if (!sessions[today]) {
        sessions[today] = [];
      }
      
      // 🔥 FIX 1: First close any other active sessions for this domain to prevent duplicates
      sessions[today].forEach(session => {
        if (session.domain === domain && session.status === 'active') {
          // Mark old active sessions as completed
          session.status = 'completed';
          session.endTime = now;
          session.endTimeUTC = now.toISOString();
          console.log('🔄 Closed previous active session:', session.id, 'for domain:', domain);
        }
      });
      
      // Find the most recent session for this domain (active or completed)
      let activeSession = sessions[today]
        .filter(s => s.domain === domain)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
      
      // 🔥 FIX 2: Only create new session if none exists OR the last session is too old (30+ minutes gap)
      const shouldCreateNewSession = !activeSession || 
        (now - new Date(activeSession.updatedAt)) > 1800000; // 30 minutes
      
      if (shouldCreateNewSession && visits > 0) { // Only create new sessions for actual visits (not incremental saves)
        // 🎯 FIX: Use actualStartTime if provided, otherwise use current time
        const sessionStartTime = actualStartTime ? new Date(actualStartTime) : now;
        
        // 🎯 NEW: Additional validation for session creation timing
        const sessionAge = now.getTime() - sessionStartTime.getTime();
        if (sessionAge < 0) {
          console.error('❌ Cannot create session with future start time, aborting');
          return null;
        }
        
        // Create new session
        activeSession = {
          id: this.generateSiteUsageSessionId(),
          domain: domain,
          userId: this.currentUserId || 'anonymous',
          startTime: sessionStartTime, // ✅ FIXED: Use actual start time, not current time
          endTime: null,
          duration: 0,
          status: 'active',
          isActive: true,
          visits: 0,
          createdAt: now, // Created time is still current time
          updatedAt: now,
          startTimeUTC: sessionStartTime.toISOString(),
          endTimeUTC: null,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          utcDate: now.toISOString().split('T')[0]
        };
        sessions[today].push(activeSession);
        
        console.log('✨ Created new site usage session:', activeSession.id, 'for domain:', domain);
        if (actualStartTime) {
          console.log('🕐 Using actual start time:', sessionStartTime.toISOString(), '(provided)');
        } else {
          console.log('🕐 Using current time as start time:', sessionStartTime.toISOString(), '(default)');
        }
      } else if (!activeSession && visits === 0) {
        // 🎯 NEW: Prevent creation of sessions via incremental saves
        console.warn('⚠️ Attempted to create session via incremental save (visits=0), rejecting');
        return null;
      } else if (activeSession) {
        // Resume existing session ONLY if not finalizing
        if (operationType !== 'finalize') {
          activeSession.status = 'active';
          activeSession.isActive = true;
          activeSession.endTime = null;
          activeSession.endTimeUTC = null;
          console.log('🔄 Resumed existing session:', activeSession.id, 'for domain:', domain);
        } else {
          // For finalization, keep the session completed and just update duration
          console.log('🎯 Finalizing completed session:', activeSession.id, 'for domain:', domain);
        }
      }
      
      // 🔥 FIX 3: Add strict duration caps and validation
      const incrementalSeconds = Math.round(incrementalTimeSpent / 1000);
      
      // Cap incremental time to prevent excessive accumulation
      const cappedIncrementalSeconds = Math.min(incrementalSeconds, 300); // Max 5 minutes per save cycle
      
      if (cappedIncrementalSeconds > 0 && activeSession) {
        // 🔥 FIX 4: Add session duration cap (4 hours max per session)
        const maxSessionDuration = 14400; // 4 hours in seconds
        const newTotalDuration = activeSession.duration + cappedIncrementalSeconds;
        
        if (newTotalDuration <= maxSessionDuration) {
          activeSession.duration = newTotalDuration;
          activeSession.visits += visits;
          activeSession.updatedAt = now;
          
          console.log('💾 Added incremental time:', cappedIncrementalSeconds, 'seconds to session:', activeSession.id, 'total now:', activeSession.duration, 'seconds');
        } else {
          // Session has reached max duration, complete it and create a new one
          activeSession.status = 'completed';
          activeSession.endTime = now;
          activeSession.endTimeUTC = now.toISOString();
          activeSession.duration = maxSessionDuration;
          
          console.log('🔚 Session reached max duration, completing:', activeSession.id);
          
          // Only create a fresh session if this is a real visit (not incremental save)
          if (visits > 0) {
            const newSession = {
              id: this.generateSiteUsageSessionId(),
              domain: domain,
              userId: this.currentUserId || 'anonymous',
              startTime: now, // New session starts now
              endTime: null,
              duration: cappedIncrementalSeconds,
              status: 'active',
              isActive: true,
              visits: visits,
              createdAt: now,
              updatedAt: now,
              startTimeUTC: now.toISOString(),
              endTimeUTC: null,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              utcDate: now.toISOString().split('T')[0]
            };
            sessions[today].push(newSession);
            activeSession = newSession;
            
            console.log('✨ Created new session after duration cap:', activeSession.id);
          } else {
            console.log('🚫 Not creating new session for incremental save after duration cap');
          }
        }
      } else if (cappedIncrementalSeconds === 0) {
        console.log('⏭️ Skipping save - no meaningful incremental time to add');
        return activeSession ? this.formatSessionAsStats(activeSession, sessions[today]) : null;
      }
      
      // 🔥 FIX 5: Cleanup old sessions to prevent storage bloat
      const cutoffTime = new Date(now - 86400000 * 7); // Keep only last 7 days
      Object.keys(sessions).forEach(dateKey => {
        if (new Date(dateKey + 'T00:00:00') < cutoffTime) {
          delete sessions[dateKey];
        }
      });
      
      // Save updated sessions
      await chrome.storage.local.set({
        site_usage_sessions: sessions
      });
      
      // Broadcast update
      try {
        await chrome.runtime.sendMessage({
          type: 'SITE_USAGE_UPDATED',
          payload: { domain, duration: activeSession?.duration || 0, sessionId: activeSession?.id }
        });
      } catch (error) {
        // Popup might not be open, ignore error
      }
      
      return activeSession ? this.formatSessionAsStats(activeSession, sessions[today]) : null;
    } catch (error) {
      console.error('❌ Error saving site usage session:', error);
      throw error;
    }
  }

  /**
   * Clean up duplicate and excessive sessions for better tracking accuracy
   */
  async cleanupDuplicateSessions(dateKey = null) {
    try {
      const storage = await chrome.storage.local.get(['site_usage_sessions']);
      const sessions = storage.site_usage_sessions || {};
      
      const today = dateKey || DateUtils.getLocalDateString();
      const todaySessions = sessions[today] || [];
      
      if (todaySessions.length === 0) {
        return { cleaned: 0, kept: 0 };
      }
      
      console.log('🧹 Cleaning up sessions for', today, '- found', todaySessions.length, 'sessions');
      
      // Group sessions by domain
      const sessionsByDomain = {};
      todaySessions.forEach(session => {
        if (!sessionsByDomain[session.domain]) {
          sessionsByDomain[session.domain] = [];
        }
        sessionsByDomain[session.domain].push(session);
      });
      
      const cleanedSessions = [];
      let cleanedCount = 0;
      
      // Process each domain's sessions
      Object.entries(sessionsByDomain).forEach(([domain, domainSessions]) => {
        // Sort by creation time (newest first)
        domainSessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        if (domainSessions.length === 1) {
          // Single session - keep it
          cleanedSessions.push(domainSessions[0]);
        } else {
          // Multiple sessions - consolidate them
          console.log(`🔄 Consolidating ${domainSessions.length} sessions for ${domain}`);
          
          // Keep the most recent session as the primary
          const primarySession = domainSessions[0];
          let totalDuration = 0;
          let totalVisits = 0;
          
          // Sum up durations from all sessions for this domain
          domainSessions.forEach(session => {
            totalDuration += session.duration || 0;
            totalVisits += session.visits || 0;
          });
          
          // Cap total duration to reasonable maximum (6 hours per domain per day)
          const maxDailyDuration = 21600; // 6 hours
          totalDuration = Math.min(totalDuration, maxDailyDuration);
          
          // Update primary session with consolidated data
          primarySession.duration = totalDuration;
          primarySession.visits = totalVisits;
          primarySession.status = 'completed'; // Mark as completed since we're consolidating
          primarySession.updatedAt = new Date();
          
          cleanedSessions.push(primarySession);
          cleanedCount += domainSessions.length - 1;
          
          console.log(`✅ Consolidated ${domain}: ${domainSessions.length} sessions → 1 session (${Math.round(totalDuration/60)}m total)`);
        }
      });
      
      // Update storage with cleaned sessions
      sessions[today] = cleanedSessions;
      await chrome.storage.local.set({
        site_usage_sessions: sessions
      });
      
      console.log(`🧹 Cleanup complete: removed ${cleanedCount} duplicate sessions, kept ${cleanedSessions.length}`);
      
      return {
        cleaned: cleanedCount,
        kept: cleanedSessions.length,
        domains: Object.keys(sessionsByDomain).length
      };
      
    } catch (error) {
      console.error('❌ Error cleaning up duplicate sessions:', error);
      return { error: error.message };
    }
  }

  // Helper method to format session data as stats for compatibility
  formatSessionAsStats(activeSession, allTodaySessions) {
    return {
      totalTime: activeSession.duration * 1000, // Convert back to ms for compatibility
      sitesVisited: allTodaySessions.length,
      productivityScore: Math.min(Math.round((activeSession.duration * 1000 / (6 * 60 * 60 * 1000)) * 100), 100),
      sites: { [activeSession.domain]: { timeSpent: activeSession.duration * 1000, visits: activeSession.visits } }
    };
  }

  /**
   * Generate session ID for site usage sessions
   */
  generateSiteUsageSessionId() {
    return `sus_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Complete a site usage session
   */
  async completeSiteUsageSession(domain) {
    try {
      const now = new Date();
      const today = DateUtils.getLocalDateString();
      
      const storage = await chrome.storage.local.get(['site_usage_sessions']);
      const sessions = storage.site_usage_sessions || {};
      
      if (sessions[today]) {
        const activeSession = sessions[today].find(s => 
          s.domain === domain && s.status === 'active'
        );
        
        if (activeSession) {
          activeSession.status = 'completed';
          activeSession.isActive = false;
          activeSession.endTime = now;
          activeSession.endTimeUTC = now.toISOString();
          activeSession.updatedAt = now;
          
          await chrome.storage.local.set({
            site_usage_sessions: sessions
          });
          
          console.log('✅ Completed site usage session:', activeSession.id, 'for domain:', domain, 'duration:', activeSession.duration, 'seconds');
          
          // ✅ NEW: Auto-sync completed sessions to Firebase (async)
          setTimeout(() => {
            this.syncSessionsToFirebase().catch(error => {
              console.warn('⚠️ Auto-sync failed:', error);
            });
          }, 1000); // 1 second delay to avoid blocking
          
          return activeSession;
        }
      }
      
      console.log('⚠️ No active session found to complete for domain:', domain);
      return null;
    } catch (error) {
      console.error('❌ Error completing site usage session:', error);
      throw error;
    }
  }

  /**
   * Get site usage sessions for a specific date
   */
  async getSiteUsageSessionsForDate(date) {
    try {
      const dateStr = typeof date === 'string' ? date : DateUtils.getLocalDateStringFromDate(date);
      const storage = await chrome.storage.local.get(['site_usage_sessions']);
      const sessions = storage.site_usage_sessions || {};
      
      return sessions[dateStr] || [];
    } catch (error) {
      console.error('❌ Error getting site usage sessions for date:', error);
      return [];
    }
  }

  /**
   * Migrate old stats data cleanup
   */
  async migrateFromStatsToSessions() {
    try {
      const storage = await chrome.storage.local.get(['stats', 'site_usage_sessions']);
      
      if (storage.stats) {
        console.log('🔄 Cleaning up old stats data...');
        await chrome.storage.local.remove(['stats']);
        console.log('✅ Old stats data removed - now using site_usage_sessions exclusively');
      }
    } catch (error) {
      console.error('❌ Error migrating from stats:', error);
    }
  }

  /**
   * Sync site usage sessions to Firebase for web app
   */
  async syncSessionsToFirebase() {
    try {
      console.log('🔄 Starting sync of site usage sessions to Firebase...');
      
      // Get user info
      const { userInfo } = await chrome.storage.local.get(['userInfo']);
      if (!userInfo?.userId) {
        console.warn('⚠️ No user info available, cannot sync sessions to Firebase');
        return;
      }
      
      // Get all site usage sessions
      const { site_usage_sessions } = await chrome.storage.local.get(['site_usage_sessions']);
      if (!site_usage_sessions) {
        console.log('ℹ️ No site usage sessions to sync');
        return;
      }
      
      // Collect all sessions from all dates
      const allSessions = [];
      Object.keys(site_usage_sessions).forEach(date => {
        const daySessions = site_usage_sessions[date] || [];
        daySessions.forEach(session => {
          // Only sync completed sessions
          if (session.status === 'completed' && session.duration > 0) {
            allSessions.push({
              ...session,
              userId: userInfo.userId, // Ensure correct user ID
              // Convert timestamps to proper Date objects
              startTime: new Date(session.startTime),
              endTime: session.endTime ? new Date(session.endTime) : null,
              createdAt: new Date(session.createdAt),
              updatedAt: new Date(session.updatedAt)
            });
          }
        });
      });
      
      if (allSessions.length === 0) {
        console.log('ℹ️ No completed sessions to sync');
        return;
      }
      
      console.log(`📊 Found ${allSessions.length} sessions to sync to Firebase`);
      
      // Send sessions to web app for Firebase sync
      try {
        // Try to send message to web app content script
        const tabs = await chrome.tabs.query({ url: '*://app.make10000hours.com/*' });
        if (tabs.length > 0) {
          console.log('📨 Sending sessions to web app via content script');
          await chrome.tabs.sendMessage(tabs[0].id, {
            type: 'EXTENSION_SITE_USAGE_SESSION_BATCH',
            payload: { sessions: allSessions }
          });
        } else {
          console.log('📨 No web app tab found, trying runtime message');
          await chrome.runtime.sendMessage({
            type: 'EXTENSION_SITE_USAGE_SESSION_BATCH',
            payload: { sessions: allSessions }
          });
        }
        
        console.log('✅ Successfully sent sessions to web app for Firebase sync');
      } catch (error) {
        console.warn('⚠️ Could not send sessions to web app:', error);
        
        // Fallback: try postMessage to any web app window
        try {
          const tabs = await chrome.tabs.query({ url: '*://app.make10000hours.com/*' });
          if (tabs.length > 0) {
            await chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              func: (sessions) => {
                window.postMessage({
                  type: 'EXTENSION_SITE_USAGE_SESSION_BATCH',
                  payload: { sessions },
                  source: 'extension'
                }, '*');
              },
              args: [allSessions]
            });
            console.log('✅ Sent sessions via postMessage fallback');
          }
        } catch (postMessageError) {
          console.error('❌ All sync methods failed:', postMessageError);
        }
      }
      
    } catch (error) {
      console.error('❌ Error syncing sessions to Firebase:', error);
    }
  }

  async getTodayStats() {
    const today = DateUtils.getLocalDateString();
    console.log('📅 Getting stats from sessions for date:', today);
    
    try {
      const storage = await chrome.storage.local.get(['site_usage_sessions']);
      const sessions = storage.site_usage_sessions?.[today] || [];
      
      // Aggregate sessions into stats format
      const stats = {
        totalTime: 0,
        sitesVisited: 0,
        productivityScore: 0,
        sites: {}
      };
      
      let validSessions = 0;
      let corruptedSessions = 0;
      
      sessions.forEach((session, index) => {
        // Validate session structure
        if (!session || typeof session !== 'object') {
          console.warn(`⚠️ Skipping invalid session at index ${index}:`, session);
          corruptedSessions++;
          return;
        }
        
        const domain = session.domain;
        
        // Validate domain
        if (!domain || typeof domain !== 'string') {
          console.warn(`⚠️ Skipping session with invalid domain at index ${index}:`, session);
          corruptedSessions++;
          return;
        }
        
        // Validate duration - this is the critical fix
        const duration = session.duration;
        if (typeof duration !== 'number' || isNaN(duration) || duration < 0) {
          console.warn(`⚠️ Skipping session with invalid duration at index ${index}: ${duration} (${typeof duration})`, session);
          corruptedSessions++;
          return;
        }
        
        // Initialize site stats if not exists
        if (!stats.sites[domain]) {
          stats.sites[domain] = {
            timeSpent: 0,
            visits: 0
          };
        }
        
        // Safely convert and add duration
        const durationMs = duration * 1000; // Convert seconds to ms
        stats.sites[domain].timeSpent += durationMs;
        stats.sites[domain].visits += (typeof session.visits === 'number' && session.visits > 0) ? session.visits : 1;
        stats.totalTime += durationMs;
        
        validSessions++;
      });
      
      stats.sitesVisited = Object.keys(stats.sites).length;
      
      // Calculate productivity score
      const productiveTime = Object.values(stats.sites)
        .reduce((total, site) => total + (site.timeSpent || 0), 0);
      stats.productivityScore = Math.min(
        Math.round((productiveTime / (6 * 60 * 60 * 1000)) * 100),
        100
      );
      
      // Log diagnostic information
      console.log(`📊 Today stats from sessions: ${validSessions} valid, ${corruptedSessions} corrupted, total: ${sessions.length}`);
      console.log('📊 Final stats:', { 
        totalTime: stats.totalTime, 
        totalTimeFormatted: this.formatTime ? this.formatTime(stats.totalTime) : `${Math.round(stats.totalTime / 60000)}m`,
        sitesVisited: stats.sitesVisited,
        sitesCount: Object.keys(stats.sites).length 
      });
      
      // Alert if we have sites data but zero total time (should be impossible now)
      if (stats.totalTime === 0 && Object.keys(stats.sites).length > 0) {
        console.error('🚨 CRITICAL: totalTime is 0 but sites have data - this should not happen after validation fix!');
      }
      
      return stats;
    } catch (error) {
      console.error('❌ Error getting today stats from sessions:', error);
      return {
        totalTime: 0,
        sitesVisited: 0,
        productivityScore: 0,
        sites: {}
      };
    }
  }

  async getTimeData(startDate, endDate = null) {
    if (!endDate) {
      endDate = startDate;
    }
    
    try {
      const storage = await chrome.storage.local.get(['site_usage_sessions']);
      const allSessions = storage.site_usage_sessions || {};
      const result = {};
      
      // Filter sessions by date range
      Object.keys(allSessions).forEach(date => {
        if (date >= startDate && date <= endDate) {
          // Convert sessions to stats format for this date
          const sessions = allSessions[date] || [];
          const dayStats = {
            totalTime: 0,
            sitesVisited: 0,
            productivityScore: 0,
            sites: {}
          };
          
          sessions.forEach(session => {
            const domain = session.domain;
            if (!dayStats.sites[domain]) {
              dayStats.sites[domain] = { timeSpent: 0, visits: 0 };
            }
            dayStats.sites[domain].timeSpent += (session.duration * 1000); // Convert to ms
            dayStats.sites[domain].visits += session.visits || 1;
            dayStats.totalTime += (session.duration * 1000);
          });
          
          dayStats.sitesVisited = Object.keys(dayStats.sites).length;
          
          // Calculate productivity score
          const productiveTime = Object.values(dayStats.sites)
            .reduce((total, site) => total + (site.timeSpent || 0), 0);
          dayStats.productivityScore = Math.min(
            Math.round((productiveTime / (6 * 60 * 60 * 1000)) * 100),
            100
          );
          
          result[date] = dayStats;
        }
      });
      
      console.log('📈 Retrieved time data from sessions for date range:', startDate, 'to', endDate);
      return result;
    } catch (error) {
      console.error('❌ Failed to get time data from sessions:', error);
      throw error;
    }
  }

  async getTopSites(limit = 5) {
    const stats = await this.getTodayStats();
    if (!stats.sites) return [];

    return Object.entries(stats.sites)
      .map(([domain, data]) => ({
        domain,
        ...data
      }))
      .sort((a, b) => b.timeSpent - a.timeSpent)
      .slice(0, limit);
  }

  /**
   * Get real-time stats by combining stored data with current session
   */
  async getRealTimeStats() {
    const storedStats = await this.getTodayStats();
    
    // Clone stored stats to avoid mutation
    const realTimeStats = {
      ...storedStats,
      sites: { ...storedStats.sites }
    };
    
    return realTimeStats;
  }

  /**
   * Set reference to FocusTimeTracker for real-time data access
   */
  setFocusTimeTracker(tracker) {
    this.focusTimeTracker = tracker;
  }

  /**
   * Get real-time stats with current session data
   */
  async getRealTimeStatsWithSession() {
    console.log('🔍 DEBUG: getRealTimeStatsWithSession called');
    
    try {
      const storedStats = await this.getTodayStats();
      console.log('🔍 DEBUG: storedStats from getTodayStats:', storedStats);
      
      // Validate stored stats structure
      if (!storedStats || typeof storedStats !== 'object') {
        console.warn('⚠️ Invalid storedStats, using defaults');
        storedStats = { totalTime: 0, sitesVisited: 0, sites: {} };
      }
      
      // Clone stored stats to avoid mutation with defensive programming
      const realTimeStats = {
        totalTime: (typeof storedStats.totalTime === 'number' && !isNaN(storedStats.totalTime)) ? storedStats.totalTime : 0,
        sitesVisited: (typeof storedStats.sitesVisited === 'number' && !isNaN(storedStats.sitesVisited)) ? storedStats.sitesVisited : 0,
        sites: (storedStats.sites && typeof storedStats.sites === 'object') ? { ...storedStats.sites } : {}
      };
      
      console.log('🔍 DEBUG: Initial realTimeStats:', realTimeStats);
      console.log('🔍 DEBUG: focusTimeTracker reference:', !!this.focusTimeTracker);
      
      // Add current session time if actively tracking and we have tracker reference
      if (this.focusTimeTracker && this.focusTimeTracker.currentSession) {
        const currentSession = this.focusTimeTracker.currentSession;
        console.log('🔍 DEBUG: Current session found:', currentSession);
        
        // Validate current session data
        if (currentSession.isActive && 
            currentSession.domain && 
            typeof currentSession.domain === 'string' &&
            currentSession.startTime && 
            typeof currentSession.startTime === 'number') {
          
          const currentTime = Date.now();
          const sessionTime = currentTime - currentSession.startTime;
          
          // Validate calculated session time
          if (sessionTime >= 0 && sessionTime < (24 * 60 * 60 * 1000)) { // Less than 24 hours
            console.log('🔍 DEBUG: Adding session time:', sessionTime, 'for domain:', currentSession.domain);
            
            // Update current domain stats
            if (!realTimeStats.sites[currentSession.domain]) {
              realTimeStats.sites[currentSession.domain] = {
                timeSpent: 0,
                visits: 0
              };
            }
            
            realTimeStats.sites[currentSession.domain].timeSpent += sessionTime;
            realTimeStats.totalTime += sessionTime;
            
            // Recalculate sites visited
            realTimeStats.sitesVisited = Object.keys(realTimeStats.sites).length;
          } else {
            console.warn('⚠️ Invalid session time calculated:', sessionTime, 'ms');
          }
        } else {
          console.log('🔍 DEBUG: Current session invalid or inactive:', {
            isActive: currentSession.isActive,
            hasDomain: !!currentSession.domain,
            hasStartTime: !!currentSession.startTime
          });
        }
      } else {
        console.log('🔍 DEBUG: No active session or focusTimeTracker not set');
      }
      
      // Final validation before returning
      if (typeof realTimeStats.totalTime !== 'number' || isNaN(realTimeStats.totalTime)) {
        console.warn('⚠️ Final totalTime is invalid, resetting to 0');
        realTimeStats.totalTime = 0;
      }
      
      console.log('🔍 DEBUG: Final realTimeStats:', {
        totalTime: realTimeStats.totalTime,
        totalTimeFormatted: this.formatTime ? this.formatTime(realTimeStats.totalTime) : `${Math.round(realTimeStats.totalTime / 60000)}m`,
        sitesVisited: realTimeStats.sitesVisited,
        sitesCount: Object.keys(realTimeStats.sites).length
      });
      
      return realTimeStats;
      
    } catch (error) {
      console.error('❌ Error in getRealTimeStatsWithSession:', error);
      
      // Return safe fallback
      return {
        totalTime: 0,
        sitesVisited: 0,
        sites: {}
      };
    }
  }

  /**
   * Get real-time top sites with current session data
   * This provides the same real-time data as getRealTimeStatsWithSession but formatted for site list
   */
  async getRealTimeTopSites(limit = 20) {
    try {
      const realTimeStats = await this.getRealTimeStatsWithSession();
      
      if (!realTimeStats || !realTimeStats.sites || Object.keys(realTimeStats.sites).length === 0) {
        console.log('📊 No site data available for top sites');
        return [];
      }

      // Create a map to ensure no duplicate domains
      const uniqueDomains = new Map();
      
      Object.entries(realTimeStats.sites).forEach(([domain, data]) => {
        const timeSpent = data.timeSpent || 0;
        const visits = data.visits || 0;
        
        if (timeSpent > 0) {
          if (!uniqueDomains.has(domain)) {
            uniqueDomains.set(domain, { domain, timeSpent, visits });
          } else {
            // If domain already exists, combine the data
            const existing = uniqueDomains.get(domain);
            existing.timeSpent += timeSpent;
            existing.visits += visits;
          }
        }
      });
      
      const topSites = Array.from(uniqueDomains.values())
        .sort((a, b) => b.timeSpent - a.timeSpent)
        .slice(0, limit);
      
      console.log('📊 Returning', topSites.length, 'top sites');
      return topSites;
    } catch (error) {
      console.error('❌ Error in getRealTimeTopSites:', error);
      return [];
    }
  }

  async getSettings() {
    const result = await chrome.storage.local.get(['settings']);
    return result.settings || this.getDefaultSettings();
  }

  async saveSettings(settings) {
    await chrome.storage.local.set({ settings });
    return settings;
  }

  formatTime(ms) {
    if (ms < 1000) return '0s';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m`;
    return `${s}s`;
  }

  /**
   * Get default site categories for categorization
   */
  getDefaultSiteCategories() {
    return {
      // Productive sites
      'github.com': 'productive',
      'stackoverflow.com': 'productive',
      'developer.mozilla.org': 'productive',
      'docs.google.com': 'productive',
      'notion.so': 'productive',
      'figma.com': 'productive',
      'codepen.io': 'productive',
      'jsfiddle.net': 'productive',
      'repl.it': 'productive',
      'codesandbox.io': 'productive',
      'medium.com': 'productive',
      'dev.to': 'productive',
      'hackernews.com': 'productive',
      'atlassian.com': 'productive',
      'slack.com': 'productive',
      'discord.com': 'productive',
      'zoom.us': 'productive',
      'teams.microsoft.com': 'productive',
      'google.com': 'productive',
      'wikipedia.org': 'productive',

      // Social Media
      'facebook.com': 'social',
      'twitter.com': 'social',
      'instagram.com': 'social',
      'linkedin.com': 'social',
      'reddit.com': 'social',
      'pinterest.com': 'social',
      'snapchat.com': 'social',
      'whatsapp.com': 'social',
      'telegram.org': 'social',
      'messenger.com': 'social',

      // Entertainment
      'youtube.com': 'entertainment',
      'netflix.com': 'entertainment',
      'spotify.com': 'entertainment',
      'twitch.tv': 'entertainment',
      'hulu.com': 'entertainment',
      'prime.amazon.com': 'entertainment',
      'disney.com': 'entertainment',
      'hbo.com': 'entertainment',
      'tiktok.com': 'entertainment',
      'gaming.com': 'entertainment',

      // News
      'cnn.com': 'news',
      'bbc.com': 'news',
      'nytimes.com': 'news',
      'reuters.com': 'news',
      'techcrunch.com': 'news',
      'theverge.com': 'news',
      'ars-technica.com': 'news',
      'wired.com': 'news',

      // Shopping
      'amazon.com': 'shopping',
      'ebay.com': 'shopping',
      'shopify.com': 'shopping',
      'etsy.com': 'shopping'
    };
  }

  /**
   * Generate productivity goals with current progress
   */
  generateProductivityGoals() {
    return {
      daily: {
        id: 'daily-productive-time',
        title: 'Daily Productive Time',
        description: 'Spend 4+ hours on productive websites',
        target: 4 * 60 * 60 * 1000, // 4 hours in ms
        current: Math.floor(Math.random() * 5 * 60 * 60 * 1000), // Random progress
        period: 'daily',
        icon: '🎯'
      },
      weekly: {
        id: 'weekly-focus-sessions',
        title: 'Weekly Focus Sessions',
        description: 'Complete 15 focus mode sessions this week',
        target: 15,
        current: Math.floor(Math.random() * 18), // Random progress
        period: 'weekly',
        icon: '🔥'
      },
      monthly: {
        id: 'monthly-productivity-score',
        title: 'Monthly Productivity Score',
        description: 'Maintain 80%+ average productivity score',
        target: 80,
        current: Math.floor(Math.random() * 20) + 75, // 75-95
        period: 'monthly',
        icon: '📈'
      }
    };
  }

  /**
   * Get comprehensive analytics data for dashboard
   */
  async getAnalyticsData(period = 'week') {
    try {
      const endDate = new Date();
      let startDate;
      
      switch (period) {
        case 'week':
          startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'quarter':
          startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      }

      // For now, use mock data until we have enough real tracking data
      return this.generateMockAnalyticsData(period);

    } catch (error) {
      console.error('Error getting analytics data:', error);
      return this.generateMockAnalyticsData(period);
    }
  }

  /**
   * Generate mock analytics data for development
   */
  generateMockAnalyticsData(period) {
    const days = period === 'week' ? 7 : (period === 'month' ? 30 : 90);
    const today = new Date();
    
    const dailyData = [];
    const categoryTotals = {
      productive: 0,
      social: 0,
      entertainment: 0,
      news: 0,
      other: 0
    };

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = DateUtils.getLocalDateStringFromDate(date);
      
      const dayData = {
        date: dateStr,
        totalTime: Math.floor(Math.random() * 18000000) + 3600000, // 1-5 hours
        productivityScore: Math.floor(Math.random() * 40) + 60, // 60-100
        focusSessionCount: Math.floor(Math.random() * 8) + 1,
        categories: {
          productive: Math.floor(Math.random() * 14400000), // 0-4 hours
          social: Math.floor(Math.random() * 5400000),
          entertainment: Math.floor(Math.random() * 7200000),
          news: Math.floor(Math.random() * 3600000),
          other: Math.floor(Math.random() * 1800000)
        }
      };

      // Add to category totals
      Object.keys(categoryTotals).forEach(category => {
        categoryTotals[category] += dayData.categories[category];
      });

      dailyData.push(dayData);
    }

    const totalTime = dailyData.reduce((sum, day) => sum + day.totalTime, 0);
    const avgProductivityScore = Math.round(
      dailyData.reduce((sum, day) => sum + day.productivityScore, 0) / dailyData.length
    );

    return {
      period,
      startDate: dailyData[0].date,
      endDate: dailyData[dailyData.length - 1].date,
      summary: {
        totalTime,
        avgProductivityScore,
        totalFocusSessions: dailyData.reduce((sum, day) => sum + day.focusSessionCount, 0),
        mostProductiveDay: dailyData.reduce((max, day) => 
          day.productivityScore > max.productivityScore ? day : max
        )
      },
      dailyData,
      categoryBreakdown: categoryTotals,
      topSites: this.generateTopSitesForPeriod(period),
      trends: this.calculateTrends(dailyData)
    };
  }

  /**
   * Generate top sites for analytics period
   */
  generateTopSitesForPeriod(period) {
    const sites = [
      { domain: 'github.com', timeSpent: 25200000, visits: 156, category: 'productive' },
      { domain: 'stackoverflow.com', timeSpent: 18000000, visits: 89, category: 'productive' },
      { domain: 'youtube.com', timeSpent: 14400000, visits: 67, category: 'entertainment' },
      { domain: 'twitter.com', timeSpent: 10800000, visits: 234, category: 'social' },
      { domain: 'docs.google.com', timeSpent: 9000000, visits: 45, category: 'productive' },
      { domain: 'reddit.com', timeSpent: 7200000, visits: 78, category: 'social' },
      { domain: 'figma.com', timeSpent: 5400000, visits: 23, category: 'productive' },
      { domain: 'netflix.com', timeSpent: 3600000, visits: 12, category: 'entertainment' }
    ];

    return sites.map(site => ({
      ...site,
      percentage: Math.round((site.timeSpent / sites.reduce((sum, s) => sum + s.timeSpent, 0)) * 100)
    }));
  }

  /**
   * Calculate trends from daily data
   */
  calculateTrends(dailyData) {
    if (dailyData.length < 2) return { productivity: 'stable', totalTime: 'stable' };

    const recent = dailyData.slice(-3); // Last 3 days
    const previous = dailyData.slice(-6, -3); // Previous 3 days

    const recentAvgProductivity = recent.reduce((sum, day) => sum + day.productivityScore, 0) / recent.length;
    const previousAvgProductivity = previous.reduce((sum, day) => sum + day.productivityScore, 0) / previous.length;

    const recentAvgTime = recent.reduce((sum, day) => sum + day.totalTime, 0) / recent.length;
    const previousAvgTime = previous.reduce((sum, day) => sum + day.totalTime, 0) / previous.length;

    const productivityTrend = recentAvgProductivity > previousAvgProductivity * 1.05 ? 'improving' :
                            recentAvgProductivity < previousAvgProductivity * 0.95 ? 'declining' : 'stable';

    const timeTrend = recentAvgTime > previousAvgTime * 1.1 ? 'increasing' :
                     recentAvgTime < previousAvgTime * 0.9 ? 'decreasing' : 'stable';

    return {
      productivity: productivityTrend,
      totalTime: timeTrend,
      productivityChange: Math.round(((recentAvgProductivity - previousAvgProductivity) / previousAvgProductivity) * 100),
      timeChange: Math.round(((recentAvgTime - previousAvgTime) / previousAvgTime) * 100)
    };
  }

  /**
   * Get site category with fallback to domain-based guess
   */
  getSiteCategory(domain) {
    const categories = this.getDefaultSiteCategories();
    if (categories[domain]) {
      return categories[domain];
    }

    // Simple domain-based categorization
    if (domain.includes('social') || ['facebook.com', 'twitter.com', 'instagram.com'].includes(domain)) {
      return 'social';
    }
    if (domain.includes('news') || ['cnn.com', 'bbc.com'].includes(domain)) {
      return 'news';
    }
    if (['youtube.com', 'netflix.com', 'spotify.com'].includes(domain)) {
      return 'entertainment';
    }
    if (['github.com', 'stackoverflow.com', 'docs.google.com'].includes(domain)) {
      return 'productive';
    }

    return 'other';
  }

  /**
   * Update site category
   */
  async updateSiteCategory(domain, category) {
    try {
      const settings = await this.getSettings();
      if (!settings.categories) {
        settings.categories = {};
      }
      settings.categories[domain] = category;
      
      await this.saveSettings(settings);
      return { success: true };
    } catch (error) {
      console.error('Error updating site category:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get productivity goals with current progress
   */
  async getProductivityGoals() {
    try {
      const result = await chrome.storage.local.get(['productivityGoals']);
      return result.productivityGoals || this.generateProductivityGoals();
    } catch (error) {
      console.error('Error getting productivity goals:', error);
      return this.generateProductivityGoals();
    }
  }

  /**
   * Update productivity goal progress
   */
  async updateGoalProgress(goalId, progress) {
    try {
      const goals = await this.getProductivityGoals();
      if (goals[goalId]) {
        goals[goalId].current = progress;
        await chrome.storage.local.set({ productivityGoals: goals });
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error updating goal progress:', error);
      return { success: false, error: error.message };
    }
  }

  // ===========================================
  // DEEP FOCUS SESSION MANAGEMENT METHODS
  // ===========================================

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `dfs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get all deep focus sessions from unified storage
   */
  async getDeepFocusStorage() {
    try {
      const result = await chrome.storage.local.get(['deepFocusSession']);
      return result.deepFocusSession || {};
    } catch (error) {
      console.error('❌ Failed to get deep focus storage:', error);
      return {};
    }
  }

  /**
   * Save deep focus sessions to unified storage
   */
  async saveDeepFocusStorage(sessionData) {
    try {
      await chrome.storage.local.set({ deepFocusSession: sessionData });
      console.log('💾 Saved deep focus session data');
    } catch (error) {
      console.error('❌ Failed to save deep focus storage:', error);
      throw error;
    }
  }

  /**
   * Create a new deep focus session with proper timezone handling
   */
  async createDeepFocusSession(userId = null) {
    try {
      // Try to get user ID from parameter, settings, or use fallback
      let actualUserId = userId;
      
      if (!actualUserId) {
        // Try to get from settings first
        try {
          const settings = await this.getSettings();
          actualUserId = settings.userId;
        } catch (error) {
          console.warn('⚠️ Could not get userId from settings:', error);
        }
      }
      
      if (!actualUserId) {
        // Try to get from local storage
        try {
          const localData = await chrome.storage.local.get(['userInfo']);
          actualUserId = localData.userInfo?.userId;
        } catch (error) {
          console.warn('⚠️ Could not get userId from local storage:', error);
        }
      }
      
      if (!actualUserId) {
        // Use a fallback user ID for anonymous sessions
        actualUserId = 'anonymous-user-' + Date.now();
        console.warn('⚠️ No user ID available, using fallback:', actualUserId);
      }

      const now = new Date();
      const sessionId = this.generateSessionId();
      
      // Get coordinated timezone between extension and web app using TimezoneManager
      let userTimezone;
      try {
        console.log('📍 Getting user timezone for session creation...');
        userTimezone = await timezoneManager.getEffectiveTimezone();
        console.log('✅ Using timezone for session:', userTimezone);
      } catch (error) {
        console.warn('⚠️ Timezone coordination failed, using browser default:', error);
        userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      }
      
      const newSession = {
        id: sessionId,
        userId: actualUserId,
        
        // Keep existing field for backward compatibility
        startTime: now.getTime(),
        
        // NEW: Proper UTC timestamp and timezone context
        startTimeUTC: now.toISOString(), // "2025-08-06T21:30:00.000Z"
        timezone: userTimezone, // "America/Los_Angeles"
        utcDate: now.toISOString().split('T')[0], // "2025-08-06"
        
        duration: 0,
        status: 'active',
        createdAt: now.getTime(),
        updatedAt: now.getTime()
      };

      // Use UTC date for storage key instead of local date
      const utcDate = newSession.utcDate;
      const storage = await this.getDeepFocusStorage();
      
      if (!storage[utcDate]) {
        storage[utcDate] = [];
      }
      storage[utcDate].push(newSession);
      await this.saveDeepFocusStorage(storage);
      
      console.log('✅ Created local deep focus session:', sessionId, 'Total sessions today:', storage[utcDate].length);
      console.log('📦 Session data:', newSession);
      return sessionId;
    } catch (error) {
      console.error('❌ Failed to create deep focus session:', error);
      throw error;
    }
  }

  /**
   * Update deep focus session duration
   */
  async updateDeepFocusSessionDuration(sessionId, duration) {
    try {
      const now = new Date();
      const utcDate = now.toISOString().split('T')[0];

      console.log('⏱️ Updating session duration:', sessionId, 'to', duration, 'minutes');

      // Get storage and find session
      const storage = await this.getDeepFocusStorage();
      let sessionFound = false;
      
      // Check UTC date first
      if (storage[utcDate]) {
        const sessionIndex = storage[utcDate].findIndex(s => s.id === sessionId);
        if (sessionIndex !== -1) {
          storage[utcDate][sessionIndex].duration = duration;
          storage[utcDate][sessionIndex].updatedAt = now.getTime();
          await this.saveDeepFocusStorage(storage);
          console.log('✅ Updated session duration (UTC):', sessionId, duration, 'minutes');
          sessionFound = true;
        }
      }
      
      // If not found in UTC date, check legacy local date storage
      if (!sessionFound) {
        const legacyToday = DateUtils.getLocalDateString();
        if (storage[legacyToday]) {
          const sessionIndex = storage[legacyToday].findIndex(s => s.id === sessionId);
          if (sessionIndex !== -1) {
            storage[legacyToday][sessionIndex].duration = duration;
            storage[legacyToday][sessionIndex].updatedAt = now.getTime();
            await this.saveDeepFocusStorage(storage);
            console.log('✅ Updated session duration (legacy):', sessionId, duration, 'minutes');
            sessionFound = true;
          }
        }
      }
      
      if (sessionFound) {
        // Get total minutes and emit event
        const totalMinutes = await this.getTodayDeepFocusTime();
        await ExtensionEventBus.emit(
          ExtensionEventBus.EVENTS.DEEP_FOCUS_UPDATE,
          { minutes: totalMinutes }
        );
        return true;
      } else {
        console.warn('⚠️ Session not found for duration update:', sessionId);
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to update session duration:', error);
      throw error;
    }
  }

  /**
   * Complete a deep focus session
   */
  async completeDeepFocusSession(sessionId) {
    try {
      const now = new Date();
      const utcDate = now.toISOString().split('T')[0];

      console.log('🏁 Completing deep focus session:', sessionId);

      // Get storage and find session (check both today's UTC date and any recent dates)
      const storage = await this.getDeepFocusStorage();
      let sessionFound = false;
      
      // Check today's UTC date first
      if (storage[utcDate]) {
        const sessionIndex = storage[utcDate].findIndex(s => s.id === sessionId);
        if (sessionIndex !== -1) {
          storage[utcDate][sessionIndex].status = 'completed';
          storage[utcDate][sessionIndex].endTime = now.getTime();
          storage[utcDate][sessionIndex].endTimeUTC = now.toISOString(); // NEW: UTC end time
          storage[utcDate][sessionIndex].updatedAt = now.getTime();
          await this.saveDeepFocusStorage(storage);
          console.log('✅ Completed local deep focus session:', sessionId);
          sessionFound = true;
          
          // Get total minutes and emit event
          const totalMinutes = await this.getTodayDeepFocusTime();
          await ExtensionEventBus.emit(
            ExtensionEventBus.EVENTS.DEEP_FOCUS_UPDATE,
            { minutes: totalMinutes }
          );
        }
      }
      
      // If not found in UTC date, check legacy local date storage (for backward compatibility)
      if (!sessionFound) {
        const legacyToday = DateUtils.getLocalDateString();
        if (storage[legacyToday]) {
          const sessionIndex = storage[legacyToday].findIndex(s => s.id === sessionId);
          if (sessionIndex !== -1) {
            storage[legacyToday][sessionIndex].status = 'completed';
            storage[legacyToday][sessionIndex].endTime = now.getTime();
            storage[legacyToday][sessionIndex].endTimeUTC = now.toISOString();
            storage[legacyToday][sessionIndex].updatedAt = now.getTime();
            await this.saveDeepFocusStorage(storage);
            console.log('✅ Completed legacy session:', sessionId);
            sessionFound = true;
            
            // Get total minutes and emit event
            const totalMinutes = await this.getTodayDeepFocusTime();
            await ExtensionEventBus.emit(
              ExtensionEventBus.EVENTS.DEEP_FOCUS_UPDATE,
              { minutes: totalMinutes }
            );
          }
        }
      }
      
      if (!sessionFound) {
        console.warn('⚠️ Session not found for completion:', sessionId);
      }
    } catch (error) {
      console.error('❌ Failed to complete session:', error);
      throw error;
    }
  }

  /**
   * Migrate existing sessions to include startTimeUTC field
   */
  async migrateSessionsToUTC() {
    try {
      console.log('🔄 Starting session migration to add startTimeUTC fields...');
      
      const storage = await this.getDeepFocusStorage();
      let migratedCount = 0;
      let totalSessions = 0;
      
      // Migrate sessions in each date key
      Object.keys(storage).forEach(dateKey => {
        if (Array.isArray(storage[dateKey])) {
          const sessions = storage[dateKey];
          totalSessions += sessions.length;
          
          sessions.forEach(session => {
            // Add missing startTimeUTC field
            if (!session.startTimeUTC && session.startTime) {
              session.startTimeUTC = new Date(session.startTime).toISOString();
              migratedCount++;
              console.log('✅ Added startTimeUTC to session:', session.id);
            }
            
            // Add missing timezone (use browser timezone as fallback)
            if (!session.timezone) {
              session.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            }
            
            // Add missing utcDate
            if (!session.utcDate && session.startTimeUTC) {
              session.utcDate = session.startTimeUTC.split('T')[0];
            }
          });
        }
      });
      
      // Save migrated sessions back to storage
      if (migratedCount > 0) {
        await chrome.storage.local.set({
          [this.getDeepFocusStorageKey()]: storage
        });
        
        console.log('✅ Migration completed:', {
          totalSessions,
          migratedSessions: migratedCount,
          alreadyMigrated: totalSessions - migratedCount
        });
      } else {
        console.log('ℹ️ No sessions needed migration');
      }
      
      return { totalSessions, migratedCount };
    } catch (error) {
      console.error('❌ Session migration failed:', error);
      return { totalSessions: 0, migratedCount: 0 };
    }
  }

  /**
   * Get all deep focus sessions from storage (for UTC filtering)
   */
  async getAllDeepFocusSessions() {
    try {
      // First, ensure sessions are migrated
      console.log('🔄 Ensuring sessions are migrated before filtering...');
      await this.migrateSessionsToUTC();
      
      const storage = await this.getDeepFocusStorage();
      const allSessions = [];
      
      // Collect all sessions from all date keys
      Object.keys(storage).forEach(dateKey => {
        if (Array.isArray(storage[dateKey])) {
          allSessions.push(...storage[dateKey]);
        }
      });
      
      console.log('📚 Retrieved all sessions from storage:', allSessions.length, 'total sessions');
      
      // Verify sessions have startTimeUTC
      const sessionsWithUTC = allSessions.filter(s => s.startTimeUTC);
      const sessionsWithoutUTC = allSessions.filter(s => !s.startTimeUTC);
      
      console.log('📊 Session UTC status after migration:', {
        withStartTimeUTC: sessionsWithUTC.length,
        missingStartTimeUTC: sessionsWithoutUTC.length
      });
      
      if (sessionsWithoutUTC.length > 0) {
        console.error('❌ Critical: Sessions still missing startTimeUTC after migration:', 
          sessionsWithoutUTC.map(s => ({ id: s.id, startTime: s.startTime })).slice(0, 3));
        
        // Force immediate migration of these sessions
        console.log('🔧 Force-migrating remaining sessions...');
        sessionsWithoutUTC.forEach(session => {
          if (session.startTime) {
            session.startTimeUTC = new Date(session.startTime).toISOString();
            session.timezone = session.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
            session.utcDate = session.startTimeUTC.split('T')[0];
            console.log('✅ Force-migrated session:', session.id);
          }
        });
        
        // Save the force-migrated sessions
        try {
          await chrome.storage.local.set({
            [this.getDeepFocusStorageKey()]: storage
          });
          console.log('💾 Saved force-migrated sessions');
        } catch (saveError) {
          console.error('❌ Failed to save force-migrated sessions:', saveError);
        }
      }
      
      return allSessions;
    } catch (error) {
      console.error('❌ Failed to get all sessions:', error);
      return [];
    }
  }

  /**
   * Get deep focus sessions for a specific date using UTC-based filtering (like web app)
   */
  async getDeepFocusSessionsForDate(date) {
    try {
      // Get user timezone
      const userTimezone = await timezoneManager.getEffectiveTimezone();
      console.log('🌍 Using timezone for UTC filtering:', userTimezone);
      
      // Convert date to start/end of day in user timezone
      const startDate = new Date(date);
      const endDate = new Date(date);
      
      console.log('📅 Filtering sessions for date:', {
        inputDate: date instanceof Date ? date.toISOString() : date,
        userTimezone
      });
      
      // Convert to UTC range using same logic as web app
      const { utcStart, utcEnd } = UTCFilteringUtils.convertLocalDateRangeToUTC(
        startDate,
        endDate,
        userTimezone
      );
      
      // Get all sessions and filter by startTimeUTC
      const allSessions = await this.getAllDeepFocusSessions();
      const filteredSessions = UTCFilteringUtils.filterSessionsByUTCRange(
        allSessions,
        utcStart,
        utcEnd
      );
      
      console.log('✅ UTC-filtered sessions for date:', {
        date: startDate.toISOString().split('T')[0],
        timezone: userTimezone,
        utcRange: `${utcStart} to ${utcEnd}`,
        sessionsFound: filteredSessions.length
      });
      
      return filteredSessions;
      
    } catch (error) {
      console.error('❌ UTC filtering failed, falling back to legacy method:', error);
      
      // Fallback to old date-key method
      try {
        let dateStr;
        if (typeof date === 'string') {
          dateStr = date;
        } else {
          const userTimezone = await timezoneManager.getEffectiveTimezone();
          const timeInUserTz = new Date(date.toLocaleString("en-US", { timeZone: userTimezone }));
          dateStr = timeInUserTz.getFullYear() + '-' + 
                   String(timeInUserTz.getMonth() + 1).padStart(2, '0') + '-' +
                   String(timeInUserTz.getDate()).padStart(2, '0');
        }
        
        const storage = await this.getDeepFocusStorage();
        const sessions = storage[dateStr] || [];
        
        console.log('📖 Fallback: Retrieved sessions for', dateStr, ':', sessions.length, 'sessions');
        return sessions;
      } catch (fallbackError) {
        console.error('❌ Fallback method also failed:', fallbackError);
        return [];
      }
    }
  }

  /**
   * Get today's deep focus sessions using UTC-based filtering (like web app)
   */
  async getTodayDeepFocusSessions() {
    try {
      // Get user timezone
      const userTimezone = await timezoneManager.getEffectiveTimezone();
      console.log('🌍 Getting today sessions using UTC filtering for timezone:', userTimezone);
      
      // Create "today" date in user timezone
      const now = new Date();
      const todayInUserTz = new Date(now.toLocaleString("en-US", { timeZone: userTimezone }));
      
      console.log('📅 Today in user timezone:', {
        userTimezone,
        browserNow: now.toISOString(),
        todayInUserTz: todayInUserTz.toISOString(),
        todayDate: todayInUserTz.toDateString()
      });
      
      // Use UTC-based filtering (same as getDeepFocusSessionsForDate)
      return this.getDeepFocusSessionsForDate(todayInUserTz);
    } catch (error) {
      console.warn('⚠️ UTC-based today filtering failed, using fallback:', error);
      const today = new Date();
      return this.getDeepFocusSessionsForDate(today);
    }
  }

  /**
   * Get deep focus sessions for a date range using UTC-based filtering (like web app)
   */
  async getDeepFocusSessionsForDateRange(startDate, endDate) {
    try {
      // Get user timezone
      const userTimezone = await timezoneManager.getEffectiveTimezone();
      console.log('🌍 Getting date range sessions using UTC filtering:', {
        startDate: typeof startDate === 'string' ? startDate : startDate.toISOString(),
        endDate: typeof endDate === 'string' ? endDate : endDate.toISOString(),
        userTimezone
      });
      
      // Convert inputs to Date objects if needed
      const startDateObj = typeof startDate === 'string' ? new Date(startDate) : startDate;
      const endDateObj = typeof endDate === 'string' ? new Date(endDate) : endDate;
      
      // Convert to UTC range using same logic as web app
      const { utcStart, utcEnd } = UTCFilteringUtils.convertLocalDateRangeToUTC(
        startDateObj,
        endDateObj,
        userTimezone
      );
      
      // Get all sessions and filter by startTimeUTC
      const allSessions = await this.getAllDeepFocusSessions();
      const filteredSessions = UTCFilteringUtils.filterSessionsByUTCRange(
        allSessions,
        utcStart,
        utcEnd
      );
      
      console.log('✅ UTC-filtered sessions for date range:', {
        dateRange: `${startDateObj.toISOString().split('T')[0]} to ${endDateObj.toISOString().split('T')[0]}`,
        timezone: userTimezone,
        utcRange: `${utcStart} to ${utcEnd}`,
        sessionsFound: filteredSessions.length
      });
      
      return filteredSessions;
      
    } catch (error) {
      console.error('❌ UTC date range filtering failed, falling back to legacy method:', error);
      
      // Fallback to old method
      try {
        const storage = await this.getDeepFocusStorage();
        const sessions = [];
        
        // Convert dates to UTC date strings (YYYY-MM-DD format) 
        const startStr = typeof startDate === 'string' ? startDate : new Date(startDate).toISOString().split('T')[0];
        const endStr = typeof endDate === 'string' ? endDate : new Date(endDate).toISOString().split('T')[0];
        
        // Iterate through all UTC dates in range
        const currentDate = new Date(startStr + 'T00:00:00.000Z');
        const endDateObj = new Date(endStr + 'T23:59:59.999Z');
        
        while (currentDate <= endDateObj) {
          const utcDateStr = currentDate.toISOString().split('T')[0];
          if (storage[utcDateStr]) {
            console.log(`📅 Fallback: Found ${storage[utcDateStr].length} sessions for UTC date:`, utcDateStr);
            sessions.push(...storage[utcDateStr]);
          }
          currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }
        
        // Sort by creation time (newest first)
        sessions.sort((a, b) => b.createdAt - a.createdAt);
        
        console.log('📖 Fallback: Retrieved', sessions.length, 'sessions for date range');
        return sessions;
        
      } catch (fallbackError) {
        console.error('❌ Fallback method also failed:', fallbackError);
        return [];
      }
    }
  }

  /**
   * Get all deep focus sessions
   */
  async getAllDeepFocusSessions() {
    try {
      const storage = await this.getDeepFocusStorage();
      const sessions = [];
      
      // Flatten all sessions from all dates
      Object.values(storage).forEach(daySessions => {
        if (Array.isArray(daySessions)) {
          sessions.push(...daySessions);
        }
      });
      
      // Sort by creation time (newest first)
      sessions.sort((a, b) => b.createdAt - a.createdAt);
      
      console.log('📖 Retrieved all sessions:', sessions.length, 'sessions');
      return sessions;
    } catch (error) {
      console.error('❌ Failed to get all sessions:', error);
      return [];
    }
  }

  /**
   * Calculate total deep focus time for today
   */
  async getTodayDeepFocusTime() {
    try {
      const sessions = await this.getTodayDeepFocusSessions();
      
      // Calculate total from completed sessions
      const completedSessions = sessions.filter(s => s.status === 'completed');
      const completedMinutes = completedSessions.reduce((total, session) => total + (session.duration || 0), 0);
      
      // Calculate total from active sessions
      const activeSession = sessions.find(s => s.status === 'active');
      let activeMinutes = 0;
      if (activeSession) {
        const elapsedMs = Date.now() - activeSession.startTime;
        activeMinutes = Math.floor(elapsedMs / (60 * 1000));
      }
      
      const totalMinutes = completedMinutes + activeMinutes;
      
      console.log('📊 Today\'s deep focus time:', totalMinutes, 'minutes');
      console.log('- Completed sessions:', completedMinutes, 'minutes from', completedSessions.length, 'sessions');
      if (activeSession) {
        console.log('- Active session:', activeMinutes, 'minutes');
      }
      
      return totalMinutes;
    } catch (error) {
      console.error('❌ Failed to calculate today\'s deep focus time:', error);
      return 0;
    }
  }

  /**
   * Find active deep focus session
   */
  async getActiveDeepFocusSession() {
    try {
      const sessions = await this.getTodayDeepFocusSessions();
      const activeSession = sessions.find(s => s.status === 'active');
      
      if (activeSession) {
        console.log('🎯 Found active session:', activeSession.id, 'Duration so far:', activeSession.duration, 'minutes');
      } else {
        console.log('🔍 No active deep focus session found');
      }
      
      return activeSession || null;
    } catch (error) {
      console.error('❌ Failed to get active session:', error);
      return null;
    }
  }

  /**
   * Clean up old deep focus sessions (keep last 30 days)
   */
  async cleanOldDeepFocusSessions() {
    try {
      const retentionDays = 30;
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      const cutoffDateStr = DateUtils.getLocalDateStringFromDate(cutoffDate);

      const storage = await this.getDeepFocusStorage();
      const updatedStorage = {};
      let cleanedCount = 0;

      // Keep only dates within retention period
      Object.keys(storage).forEach(dateStr => {
        if (dateStr >= cutoffDateStr) {
          updatedStorage[dateStr] = storage[dateStr];
        } else {
          cleanedCount++;
        }
      });

      if (cleanedCount > 0) {
        await this.saveDeepFocusStorage(updatedStorage);
        console.log('🧹 Cleaned up', cleanedCount, 'old deep focus session dates');
      }
    } catch (error) {
      console.error('❌ Failed to clean old deep focus sessions:', error);
    }
  }

  /**
   * Get deep focus sessions for recent 7 days (including today)
   */
  async getRecent7DaysDeepFocusSessions() {
    try {
      const storage = await this.getDeepFocusStorage();
      const sessions = [];
      
      // Generate last 7 days including today
      const recent7Days = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        recent7Days.push(DateUtils.getLocalDateStringFromDate(date));
      }
      
      // Collect sessions from recent 7 days
      recent7Days.forEach(dateStr => {
        if (storage[dateStr] && Array.isArray(storage[dateStr])) {
          sessions.push(...storage[dateStr]);
        }
      });
      
      console.log('📅 Retrieved', sessions.length, 'deep focus sessions from recent 7 days');
      return sessions;
    } catch (error) {
      console.error('❌ Failed to get recent 7 days deep focus sessions:', error);
      return [];
    }
  }

  /**
   * Get last 10 deep focus sessions (most recent across all dates)
   */
  async getLast10DeepFocusSessions() {
    try {
      const storage = await this.getDeepFocusStorage();
      const allSessions = [];
      
      // Collect all sessions from all dates
      Object.keys(storage).forEach(dateStr => {
        if (Array.isArray(storage[dateStr])) {
          storage[dateStr].forEach(session => {
            allSessions.push({
              ...session,
              localDate: dateStr // Add date info for sorting
            });
          });
        }
      });
      
      // Sort by start time (most recent first) and take last 10
      const sortedSessions = allSessions.sort((a, b) => {
        const timeA = new Date(a.startTime).getTime();
        const timeB = new Date(b.startTime).getTime();
        return timeB - timeA; // Descending order (newest first)
      });
      
      const last10Sessions = sortedSessions.slice(0, 10);
      
      console.log('🔟 Retrieved last', last10Sessions.length, 'deep focus sessions');
      return last10Sessions;
    } catch (error) {
      console.error('❌ Failed to get last 10 deep focus sessions:', error);
      return [];
    }
  }
}

/**
 * Simple State Manager for Extension State
 */
class StateManager {
  constructor() {
    this.state = {
      currentSession: {
        domain: null,
        startTime: null,
        focusMode: false,
        isTracking: false
      },
      todayStats: {
        totalTime: 0,
        sitesVisited: 0,
        productivityScore: 0
      }
    };
    this.listeners = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    try {
      // Load persisted state from storage
      const stored = await chrome.storage.local.get(['stateManagerState']);
      if (stored.stateManagerState) {
        this.state = stored.stateManagerState;
      }
      this.isInitialized = true;
      console.log('✅ StateManager initialized with state:', this.state);
    } catch (error) {
      console.error('❌ StateManager initialization failed:', error);
      throw error;
    }
  }

  async persistState() {
    if (this.isInitialized) {
      await chrome.storage.local.set({
        stateManagerState: this.state
      });
    }
  }

  async dispatch(action, payload = {}) {
    if (!this.isInitialized) {
      console.warn('⚠️ StateManager not initialized');
      return;
    }

    switch (action.type) {
      case 'START_TRACKING':
        this.state.currentSession = {
          domain: payload.domain,
          startTime: payload.startTime,
          isTracking: true
        };
        break;

      case 'STOP_TRACKING':
        this.state.currentSession = {
          domain: null,
          startTime: null,
          isTracking: false
        };
        break;

      case 'SET_FOCUS_MODE':
        this.state.currentSession.focusMode = payload.enabled;
        break;
    }

    // Notify listeners and persist state
    this.notifyListeners();
    await this.persistState();
    return this.state;
  }

  subscribe(callback) {
    const id = Date.now().toString();
    this.listeners.set(id, callback);
    return id;
  }

  unsubscribe(id) {
    this.listeners.delete(id);
  }

  notifyListeners() {
    this.listeners.forEach(callback => callback(this.state));
  }

  getState() {
    return this.state;
  }
}

/**
 * Website Blocking Manager
 * Handles focus mode and site blocking using declarativeNetRequest API
 */
class BlockingManager {
  constructor() {
    this.focusMode = false;
    
    // Start with empty blocked sites - will be populated by web app sync
    this.blockedSites = new Set();
    
    this.temporaryOverrides = new Map(); // domain -> expiry timestamp
    this.urlCache = new Map(); // tabId -> original URL
    this.focusStartTime = null;
    this.blockedAttempts = 0;
    
    // Deep focus session tracking
    this.currentLocalSessionId = null;
    this.sessionTimer = null;
    this.storageManager = null;
    this.focusTimeTracker = null;
    
    this.initialize();
  }

  async initialize() {
    try {
      // Load settings from storage
      const settings = await chrome.storage.local.get([
        'focusMode', 
        'blockedSites', 
        'focusStartTime',
        'blockedAttempts'
      ]);
      
      console.log('🔍 Loaded storage settings:', settings);
      
      this.focusMode = settings.focusMode || false;
      
      // Load blocked sites from storage (populated by web app sync)
      this.blockedSites = new Set(settings.blockedSites || []);
      
      this.focusStartTime = settings.focusStartTime || null;
      this.blockedAttempts = settings.blockedAttempts || 0;
      
      // IMPORTANT: Clear any existing blocking rules on initialization
      // This prevents orphaned rules from previous sessions
      await this.clearBlockingRules();
      
      // Update blocking rules if focus mode is active
      if (this.focusMode) {
        await this.updateBlockingRules();
        
        // If focus mode was active, check if we need to resume local session tracking
        if (this.storageManager) {
          await this.resumeLocalSessionIfNeeded();
        }
      }
      
      console.log('🛡️ Blocking Manager initialized', {
        focusMode: this.focusMode,
        blockedSites: Array.from(this.blockedSites),
        focusStartTime: this.focusStartTime,
        hasStorageManager: !!this.storageManager
      });
    } catch (error) {
      console.error('Error initializing BlockingManager:', error);
    }
  }

  /**
   * Set reference to StorageManager
   */
  setStorageManager(storageManager) {
    this.storageManager = storageManager;
    console.log('📦 StorageManager reference set in BlockingManager');
  }

  /**
   * Set reference to FocusTimeTracker
   */
  setFocusTimeTracker(focusTimeTracker) {
    this.focusTimeTracker = focusTimeTracker;
    console.log('🎯 FocusTimeTracker reference set in BlockingManager');
  }

  /**
   * Toggle focus mode on/off
   */
  async toggleFocusMode() {
    try {
      this.focusMode = !this.focusMode;
      
      if (this.focusMode) {
        this.focusStartTime = Date.now();
        this.blockedAttempts = 0;
        await this.updateBlockingRules();
        
        // Create local deep focus session
        await this.startLocalDeepFocusSession();
        
        // Get current blocked sites list
        const blockedSites = Array.from(this.blockedSites);
        console.log('🔒 Focus mode ENABLED with blocked sites:', blockedSites);
        
        // Broadcast focus state with blocked sites
        if (this.focusTimeTracker) {
          this.focusTimeTracker.broadcastFocusStateChange(true);
        }
      } else {
        this.focusStartTime = null;
        await this.clearBlockingRules();
        
        // Complete local deep focus session
        await this.completeLocalDeepFocusSession();
        
        console.log('🔓 Focus mode DISABLED');
        
        // Broadcast focus state change
        if (this.focusTimeTracker) {
          this.focusTimeTracker.broadcastFocusStateChange(false);
        }
      }
      
      // Save state
      await this.saveState();
      
      return {
        success: true,
        focusMode: this.focusMode,
        focusStartTime: this.focusStartTime,
        blockedSites: Array.from(this.blockedSites)
      };
    } catch (error) {
      console.error('Error toggling focus mode:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Add a site to the blocked list
   */
  async addBlockedSite(domain) {
    try {
      if (!domain) return { success: false, error: 'Invalid domain' };
      
      // Clean domain
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      
      this.blockedSites.add(cleanDomain);
      await this.saveState();
      
      // Update rules if focus mode is active
      if (this.focusMode) {
        await this.updateBlockingRules();
      }
      
      console.log('➕ Added blocked site:', cleanDomain);
      return { success: true, domain: cleanDomain };
    } catch (error) {
      console.error('Error adding blocked site:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove a site from the blocked list
   */
  async removeBlockedSite(domain) {
    try {
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      
      this.blockedSites.delete(cleanDomain);
      await this.saveState();
      
      // Update rules if focus mode is active
      if (this.focusMode) {
        await this.updateBlockingRules();
      }
      
      console.log('➖ Removed blocked site:', cleanDomain);
      return { success: true, domain: cleanDomain };
    } catch (error) {
      console.error('Error removing blocked site:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Set temporary override for a domain
   */
  async setTemporaryOverride(domain, duration = 300000) { // 5 minutes default
    try {
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      const expiryTime = Date.now() + duration;
      
      this.temporaryOverrides.set(cleanDomain, expiryTime);
      
      // Update blocking rules to exclude this domain temporarily
      if (this.focusMode) {
        await this.updateBlockingRules();
      }
      
      // Set timeout to remove override
      setTimeout(() => {
        this.temporaryOverrides.delete(cleanDomain);
        if (this.focusMode) {
          this.updateBlockingRules();
        }
      }, duration);
      
      console.log(`⏱️ Temporary override set for ${cleanDomain} for ${duration/1000}s`);
      return { success: true, domain: cleanDomain, expiryTime };
    } catch (error) {
      console.error('Error setting temporary override:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if a domain should be blocked
   */
  shouldBlockDomain(domain) {
    if (!this.focusMode) return false;
    
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    
    // Check if there's a temporary override
    if (this.temporaryOverrides.has(cleanDomain)) {
      const expiryTime = this.temporaryOverrides.get(cleanDomain);
      if (Date.now() < expiryTime) {
        return false; // Override still active
      } else {
        this.temporaryOverrides.delete(cleanDomain); // Expired override
      }
    }
    
    return this.blockedSites.has(cleanDomain);
  }

  /**
   * Get current dynamic rules
   */
  async getCurrentRules() {
    try {
      const rules = await chrome.declarativeNetRequest.getDynamicRules();
      console.log('📊 Current rules:', rules);
      return rules;
    } catch (error) {
      console.error('❌ Error getting rules:', error);
      return [];
    }
  }

  /**
   * Generate a unique rule ID that doesn't conflict with existing rules
   */
  generateUniqueRuleId(existingRules) {
    const usedIds = new Set(existingRules.map(rule => rule.id));
    let ruleId = Math.floor(Math.random() * 100000) + 1000; // Start from 1000
    while (usedIds.has(ruleId)) {
      ruleId = Math.floor(Math.random() * 100000) + 1000;
    }
    return ruleId;
  }

  /**
   * Update Chrome declarativeNetRequest rules
   */
  async updateBlockingRules() {
    try {
      // First, get and remove all existing rules
      const existingRules = await this.getCurrentRules();
      
      if (existingRules.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: existingRules.map(rule => rule.id)
        });
        
        // Add safety delay to ensure rules are cleared
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log(`🧹 Removed ${existingRules.length} existing blocking rules`);
      }

      // If focus mode is off or no sites to block, we're done (rules already cleared above)
      if (!this.focusMode || this.blockedSites.size === 0) {
        console.log('🔓 Focus mode disabled or no sites to block');
        return;
      }

      // Create new rules with unique IDs
      const rules = [];
      
      for (const domain of this.blockedSites) {
        // Skip domains with active overrides
        if (this.temporaryOverrides.has(domain)) {
          const expiryTime = this.temporaryOverrides.get(domain);
          if (Date.now() < expiryTime) {
            console.log(`⏭️ Skipping ${domain} due to active override`);
            continue;
          }
          this.temporaryOverrides.delete(domain);
        }

        // Generate unique IDs for each rule
        const ruleId1 = this.generateUniqueRuleId(rules);
        const ruleId2 = this.generateUniqueRuleId([...rules, { id: ruleId1 }]);

        // Add rules for domain with www and without www
        rules.push({
          id: ruleId1,
          priority: 1,
          action: {
            type: "redirect",
            redirect: { extensionPath: "/blocked.html" }
          },
          condition: {
            urlFilter: `*://*.${domain}/*`,
            resourceTypes: ["main_frame"]
          }
        });

        rules.push({
          id: ruleId2,
          priority: 1,
          action: {
            type: "redirect",
            redirect: { extensionPath: "/blocked.html" }
          },
          condition: {
            urlFilter: `*://${domain}/*`,
            resourceTypes: ["main_frame"]
          }
        });
      }

      if (rules.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          addRules: rules
        });
        
        console.log(`🛡️ Added ${rules.length} blocking rules for ${this.blockedSites.size} domains:`, 
          Array.from(this.blockedSites));
      } else {
        console.log('⚠️ No rules to add (all sites have overrides)');
      }
    } catch (error) {
      console.error('❌ Error updating blocking rules:', error);
      throw error;
    }
  }

  /**
   * Clear all blocking rules
   */
  async clearBlockingRules() {
    try {
      // Get all existing dynamic rules
      const existingRules = await this.getCurrentRules();
      
      if (existingRules.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: existingRules.map(rule => rule.id)
        });
        
        console.log(`🧹 Cleared ${existingRules.length} blocking rules`);
        
        // Add safety delay to ensure rules are cleared
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        console.log('📝 No blocking rules to clear');
      }
    } catch (error) {
      console.error('❌ Error clearing blocking rules:', error);
    }
  }

  /**
   * Record a blocked attempt
   */
  recordBlockedAttempt(domain) {
    this.blockedAttempts++;
    this.saveState();
    console.log(`🚫 Blocked attempt to access: ${domain} (Total: ${this.blockedAttempts})`);
  }

  /**
   * Cache URL before potential blocking
   */
  cacheUrl(tabId, url) {
    if (this.focusMode && url && !url.startsWith('chrome-extension://') && !url.startsWith('chrome://')) {
      const domain = url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      if (this.blockedSites.has(domain) && !this.temporaryOverrides.has(domain)) {
        this.urlCache.set(tabId, url);
        console.log(`🔗 Cached URL for tab ${tabId}: ${url}`);
      }
    }
  }

  /**
   * Get cached URL for tab
   */
  getCachedUrl(tabId) {
    const url = this.urlCache.get(tabId);
    // Don't delete immediately - keep for auto-redirect on reload
    return url;
  }

  /**
   * Clear cached URL for tab (call when actually navigating)
   */
  clearCachedUrl(tabId) {
    this.urlCache.delete(tabId);
    console.log(`🧹 Cleared cached URL for tab ${tabId}`);
  }

  /**
   * Get focus session stats
   */
  getFocusStats() {
    const focusTime = this.focusStartTime ? Date.now() - this.focusStartTime : 0;
    
    return {
      focusMode: this.focusMode,
      focusTime: focusTime,
      focusStartTime: this.focusStartTime,
      blockedAttempts: this.blockedAttempts,
      blockedSites: Array.from(this.blockedSites),
      temporaryOverrides: Object.fromEntries(this.temporaryOverrides)
    };
  }

  /**
   * Save state to storage
   */
  async saveState() {
    try {
      await chrome.storage.local.set({
        focusMode: this.focusMode,
        blockedSites: Array.from(this.blockedSites),
        focusStartTime: this.focusStartTime,
        blockedAttempts: this.blockedAttempts
      });
    } catch (error) {
      console.error('Error saving blocking state:', error);
    }
  }

  /**
   * Get debug information for troubleshooting
   */
  getDebugInfo(domain) {
    const debugInfo = {
      domain,
      focusMode: this.focusMode,
      blockedSites: Array.from(this.blockedSites),
      blockedSitesCount: this.blockedSites.size,
      temporaryOverrides: Object.fromEntries(this.temporaryOverrides),
      shouldBeBlocked: this.shouldBlockDomain(domain),
      focusStartTime: this.focusStartTime,
      blockedAttempts: this.blockedAttempts
    };
    
    console.log('🐛 Debug Info for', domain, ':', debugInfo);
    return debugInfo;
  }

  /**
   * Reset blocking manager to clean state - useful for debugging
   */
  async resetBlockingState() {
    try {
      console.log('🧹 Resetting blocking state...');
      
      // Clear all blocking rules
      await this.clearBlockingRules();
      
      // Reset internal state
      this.focusMode = false;
      this.blockedSites.clear();
      this.temporaryOverrides.clear();
      this.focusStartTime = null;
      this.blockedAttempts = 0;
      
      // Clear storage
      await chrome.storage.local.remove(['focusMode', 'blockedSites', 'focusStartTime', 'blockedAttempts']);
      
      // Save clean state
      await this.saveState();
      
      console.log('✅ Blocking state reset successfully');
      return { success: true, message: 'Blocking state reset' };
    } catch (error) {
      console.error('❌ Error resetting blocking state:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all blocked sites
   */
  getBlockedSites() {
    return Array.from(this.blockedSites);
  }

  // ===========================================
  // LOCAL DEEP FOCUS SESSION METHODS
  // ===========================================

  /**
   * Start a local deep focus session
   */
  async startLocalDeepFocusSession() {
    try {
      console.log('🚀 Starting local deep focus session...');
      
      if (!this.storageManager) {
        console.error('❌ StorageManager not available, cannot create local session');
        return;
      }

      // Complete any existing active session first
      await this.completeLocalDeepFocusSession();

      // Create new session - try to pass user ID if available
      const userId = this.focusTimeTracker?.currentUserId || null;
      this.currentLocalSessionId = await this.storageManager.createDeepFocusSession(userId);
      console.log('🎯 Successfully started local deep focus session:', this.currentLocalSessionId);

      // Start the 1-minute timer
      this.startSessionTimer();
      
      console.log('✅ Local deep focus session setup complete');
    } catch (error) {
      console.error('❌ Failed to start local deep focus session:', error);
    }
  }

  /**
   * Complete current local deep focus session
   */
  async completeLocalDeepFocusSession() {
    try {
      if (!this.storageManager || !this.currentLocalSessionId) {
        return;
      }

      // Stop the timer
      this.stopSessionTimer();

      // Complete the session
      await this.storageManager.completeDeepFocusSession(this.currentLocalSessionId);
      console.log('✅ Completed local deep focus session:', this.currentLocalSessionId);

      this.currentLocalSessionId = null;
    } catch (error) {
      console.error('❌ Failed to complete local deep focus session:', error);
    }
  }

  /**
   * Start session timer for local deep focus
   */
  startSessionTimer() {
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
    }

    this.sessionTimer = setInterval(async () => {
      try {
        if (this.currentLocalSessionId) {
          const storage = await this.storageManager.getDeepFocusStorage();
          const today = DateUtils.getLocalDateString();
          
          if (storage[today]) {
            const session = storage[today].find(s => s.id === this.currentLocalSessionId);
            if (session) {
              const elapsedMs = Date.now() - session.startTime;
              const elapsedMinutes = Math.floor(elapsedMs / (60 * 1000));
              
              await this.storageManager.updateDeepFocusSessionDuration(
                this.currentLocalSessionId,
                elapsedMinutes
              );
              
              // Get total minutes and emit event
              const totalMinutes = await this.storageManager.getTodayDeepFocusTime();
              await ExtensionEventBus.emit(
                ExtensionEventBus.EVENTS.DEEP_FOCUS_UPDATE,
                { minutes: totalMinutes }
              );
            }
          }
        }
      } catch (error) {
        console.error('❌ Error in session timer:', error);
      }
    }, 60000); // Update every minute
  }

  /**
   * Stop the session timer
   */
  stopSessionTimer() {
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
      this.sessionTimer = null;
      console.log('⏹️ Session timer stopped');
    }
    
    if (this.sleepDetectionInterval) {
      clearInterval(this.sleepDetectionInterval);
      this.sleepDetectionInterval = null;
      console.log('⏹️ Sleep detection timer stopped');
    }
  }

  /**
   * Resume local session if needed (called during initialization)
   */
  async resumeLocalSessionIfNeeded() {
    try {
      if (!this.storageManager) {
        return;
      }

      // Check if there's an active session from previous run
      const activeSession = await this.storageManager.getActiveDeepFocusSession();
      
      if (activeSession) {
        this.currentLocalSessionId = activeSession.id;
        console.log('🔄 Resuming local deep focus session:', this.currentLocalSessionId);
        
        // Restart the timer (it will continue from where it left off)
        this.startSessionTimer();
      }
    } catch (error) {
      console.error('❌ Failed to resume local session:', error);
    }
  }

  /**
   * Get current local deep focus session info
   */
  getCurrentLocalSession() {
    return {
      sessionId: this.currentLocalSessionId,
      isActive: !!this.currentLocalSessionId,
      hasTimer: !!this.sessionTimer
    };
  }

  /**
   * Debug function to inspect deep focus storage
   */
  async debugDeepFocusStorage() {
    try {
      const storage = await this.storageManager.getDeepFocusStorage();
      console.log('🔍 Deep Focus Storage Debug:', storage);
      
      const today = DateUtils.getLocalDateString();
      const todaySessions = storage[today] || [];
      
      console.log('📅 Today\'s Sessions:', todaySessions);
      console.log('📊 Active Sessions:', todaySessions.filter(s => s.status === 'active'));
      console.log('✅ Completed Sessions:', todaySessions.filter(s => s.status === 'completed'));
      
      const totalTime = await this.storageManager.getTodayDeepFocusTime();
      console.log('⏱️ Total Deep Focus Time Today:', totalTime, 'minutes');
      
      return { storage, todaySessions, totalTime };
    } catch (error) {
      console.error('❌ Error debugging deep focus storage:', error);
      return null;
    }
  }

  /**
   * Broadcast deep focus time update to all listeners
   */
  async broadcastDeepFocusTimeUpdate() {
    try {
      const totalMinutes = await this.storageManager.getTodayDeepFocusTime();
      chrome.runtime.sendMessage({
        type: 'DEEP_FOCUS_TIME_UPDATED',
        payload: { minutes: totalMinutes }
      }).catch(() => {
        // Ignore errors when no listeners are connected
      });
      console.log('📢 Broadcasted deep focus time update:', totalMinutes, 'minutes');
    } catch (error) {
      console.error('❌ Failed to broadcast deep focus time:', error);
    }
  }
}

// Main Focus Time Tracker Class
/**
 * Tab Event Coordinator - Handles race conditions and timing issues
 * 
 * This class implements Chrome extension best practices for reliable tab event handling:
 * - Debounces competing events to prevent race conditions
 * - Validates tab/window existence before processing
 * - Provides fallback mechanisms for Chrome API failures
 * - Implements retry logic with exponential backoff
 */
class TabEventCoordinator {
  constructor(focusTimeTracker) {
    this.focusTimeTracker = focusTimeTracker;
    this.pendingEvents = new Map();
    this.debounceTime = 200; // 200ms debounce for tab events
    this.maxRetries = 3;
    this.retryDelay = 1000; // Initial retry delay in ms
    
    // Heartbeat to keep service worker alive during critical operations
    this.setupHeartbeat();
    
    console.log('🎯 TabEventCoordinator initialized with 200ms debounce');
  }

  /**
   * Keep service worker alive during critical operations
   */
  setupHeartbeat() {
    this.heartbeatInterval = setInterval(async () => {
      try {
        // Reset service worker timeout by calling Chrome API
        await chrome.runtime.getPlatformInfo();
        await chrome.storage.local.set({ 
          'tab-coordinator-heartbeat': Date.now() 
        });
      } catch (error) {
        // Ignore heartbeat errors
      }
    }, 20000); // Every 20 seconds

    // Clean up on service worker termination
    if (chrome.runtime.onSuspend) {
      chrome.runtime.onSuspend.addListener(() => {
        clearInterval(this.heartbeatInterval);
      });
    }
  }

  /**
   * Schedule a debounced event to prevent race conditions
   */
  scheduleEvent(eventType, eventData, priority = 'normal') {
    const eventKey = this.generateEventKey(eventType, eventData);
    
    // 🎯 NEW: Cancel stale events when active tab changes
    if (eventType === 'tab_activated') {
      // Cancel ALL pending tab-related events when a new tab is activated
      const staleEvents = [];
      this.pendingEvents.forEach((event, key) => {
        if (key.startsWith('tab_activated_') && key !== eventKey) {
          clearTimeout(event.timeoutId);
          staleEvents.push(key);
          console.debug(`🚫 Cancelled stale tab_activated event: ${key}`);
        }
      });
      
      // Remove stale events
      staleEvents.forEach(key => this.pendingEvents.delete(key));
    }
    
    // Cancel any existing pending event of the same type
    if (this.pendingEvents.has(eventKey)) {
      clearTimeout(this.pendingEvents.get(eventKey).timeoutId);
      console.debug(`🔄 Cancelled pending ${eventType} event for debouncing`);
    }

    // Calculate debounce time based on priority
    const debounceDelay = priority === 'high' ? 100 : this.debounceTime;

    // Schedule new event
    const timeoutId = setTimeout(() => {
      this.processEvent(eventType, eventData, 0);
      this.pendingEvents.delete(eventKey);
    }, debounceDelay);

    this.pendingEvents.set(eventKey, {
      timeoutId,
      eventType,
      eventData,
      scheduledAt: Date.now()
    });

    console.debug(`📅 Scheduled ${eventType} event with ${debounceDelay}ms debounce`);
  }

  /**
   * Generate unique key for event deduplication
   */
  generateEventKey(eventType, eventData) {
    const identifier = eventData.tabId || eventData.windowId || 'global';
    return `${eventType}_${identifier}`;
  }

  /**
   * Process event with retry logic and validation
   */
  async processEvent(eventType, eventData, retryCount = 0) {
    try {
      console.log(`🎯 Processing ${eventType} event (attempt ${retryCount + 1})`);

      // Validate tab/window existence before processing
      const validatedData = await this.validateEventData(eventType, eventData);
      
      if (!validatedData) {
        console.debug(`⏭️ Skipping ${eventType} - data no longer valid`);
        return;
      }

      // Process the validated event
      await this.handleValidatedEvent(eventType, validatedData);
      console.log(`✅ Successfully processed ${eventType} event`);

    } catch (error) {
      console.warn(`⚠️ Error processing ${eventType} event:`, error.message);

      // Retry with exponential backoff
      if (retryCount < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, retryCount);
        console.log(`🔄 Retrying ${eventType} in ${delay}ms (attempt ${retryCount + 2})`);
        
        setTimeout(() => {
          this.processEvent(eventType, eventData, retryCount + 1);
        }, delay);
      } else {
        console.error(`❌ Failed to process ${eventType} after ${this.maxRetries} retries:`, error);
      }
    }
  }

  /**
   * Validate that tab/window data is still valid before processing
   */
  async validateEventData(eventType, eventData) {
    try {
      switch (eventType) {
        case 'tab_activated':
        case 'tab_updated':
          if (eventData.tabId) {
            // Try to get current tab info
            const tab = await chrome.tabs.get(eventData.tabId);
            
            // 🎯 NEW: Additional validation for tab_activated events
            if (eventType === 'tab_activated') {
              // Verify this tab is still the currently active tab
              const activeTabs = await chrome.tabs.query({ active: true, windowId: tab.windowId });
              const currentlyActiveTab = activeTabs[0];
              
              if (!currentlyActiveTab || currentlyActiveTab.id !== eventData.tabId) {
                console.debug(`🚫 Tab ${eventData.tabId} is no longer active (current: ${currentlyActiveTab?.id}), cancelling event`);
                return null;
              }
            }
            
            return {
              ...eventData,
              tab: tab,
              url: tab.url,
              title: tab.title,
              status: tab.status,
              isCurrentlyActive: tab.active
            };
          }
          break;

        case 'window_focus_changed':
          if (eventData.windowId && eventData.windowId !== chrome.windows.WINDOW_ID_NONE) {
            const window = await chrome.windows.get(eventData.windowId, { populate: true });
            const activeTab = window.tabs?.find(tab => tab.active);
            
            return {
              ...eventData,
              window: window,
              activeTab: activeTab
            };
          } else if (eventData.windowId === chrome.windows.WINDOW_ID_NONE) {
            // Focus lost - always valid
            return eventData;
          }
          break;

        default:
          return eventData;
      }
    } catch (error) {
      // Tab/window no longer exists
      console.debug(`Tab/window validation failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Handle validated events by delegating to FocusTimeTracker
   */
  async handleValidatedEvent(eventType, validatedData) {
    switch (eventType) {
      case 'tab_activated':
        await this.focusTimeTracker.handleTabActivatedCoordinated(validatedData);
        break;

      case 'tab_updated':
        await this.focusTimeTracker.handleTabUpdatedCoordinated(validatedData);
        break;

      case 'window_focus_changed':
        await this.focusTimeTracker.handleWindowFocusCoordinated(validatedData);
        break;

      default:
        console.warn(`Unknown event type: ${eventType}`);
    }
  }

  /**
   * Handle tab activation with coordination
   */
  onTabActivated(activeInfo) {
    this.scheduleEvent('tab_activated', {
      tabId: activeInfo.tabId,
      windowId: activeInfo.windowId,
      timestamp: Date.now()
    });
  }

  /**
   * Handle tab updates with coordination
   */
  onTabUpdated(tabId, changeInfo, tab) {
    // Only process meaningful updates
    if (changeInfo.status === 'complete' || changeInfo.url) {
      this.scheduleEvent('tab_updated', {
        tabId: tabId,
        changeInfo: changeInfo,
        tab: tab,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle window focus changes with coordination
   */
  onWindowFocusChanged(windowId) {
    this.scheduleEvent('window_focus_changed', {
      windowId: windowId,
      timestamp: Date.now()
    }, 'high'); // Higher priority for focus events
  }

  /**
   * Cleanup coordinator resources
   */
  destroy() {
    // Clear all pending events
    this.pendingEvents.forEach(({ timeoutId }) => {
      clearTimeout(timeoutId);
    });
    this.pendingEvents.clear();

    // Clear heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    console.log('🧹 TabEventCoordinator cleaned up');
  }
}

class FocusTimeTracker {
  constructor() {
    // Add ConfigManager
    this.configManager = new ConfigManager();
    
    this.stateManager = null;
    this.storageManager = null;
    this.blockingManager = null;
    this.overrideSessionManager = new OverrideSessionManager();
    
    this.currentSession = {
      tabId: null,
      domain: null,
      startTime: null,
      savedTime: 0,
      isActive: false
    };
    this.saveInterval = null;
    
    // Enhanced activity management
    this.isSessionPaused = false;
    this.pausedAt = null;
    this.totalPausedTime = 0;
    this.inactivityThreshold = 480000; // 8 minutes (conservative increase, stays within sleep detection safety margin)
    this.lastActivityTime = Date.now();
    this.autoManagementEnabled = true;
    
    // SAFEGUARD: Prevent concurrent saves and sleep processing
    this.isSaving = false;
    this.isProcessingSleep = false;
    
    // IMPROVEMENT #2: Tab Switching Grace Period
    this.graceTimer = null;
    this.gracePeriod = 3000; // 3 seconds grace period (reduced from 15s to minimize tracking gaps)
    this.pendingSessionData = null;
    
    // 🎯 NEW: Tab switch tracking to prevent timing race conditions
    this.lastTabSwitchTime = null;
    this.tabSwitchCooldown = 5000; // 5 seconds cooldown after tab switch
    this.previousTabId = null;
    
    // Focus state tracking
    this.latestFocusState = false;
    
    // User authentication state
    this.currentUserId = null;
    this.userInfo = null;
    
    // 🎯 NEW: Initialize TabEventCoordinator for reliable tab detection
    this.tabEventCoordinator = new TabEventCoordinator(this);
    
    this.initialize();
  }

  async recoverState() {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        if (!this.stateManager?.isInitialized) {
          console.warn(`⚠️ Attempting StateManager recovery... (attempt ${retryCount + 1})`);
          
          // Create fresh StateManager instance
          this.stateManager = new StateManager();
          await this.stateManager.initialize();
          
          // Verify initialization succeeded
          if (!this.stateManager?.isInitialized) {
            throw new Error('StateManager initialization returned false');
          }
          
          // Update other managers with recovered state
          if (this.storageManager) {
            this.storageManager.setStateManager(this.stateManager);
          }
          
          console.log(`✅ StateManager recovery successful (attempt ${retryCount + 1})`);
          return; // Success - exit retry loop
          
        } else {
          // StateManager is already initialized
          console.debug('✅ StateManager already initialized');
          return;
        }
        
      } catch (error) {
        retryCount++;
        console.error(`❌ StateManager recovery attempt ${retryCount} failed:`, error.message);
        
        if (retryCount < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = 1000 * Math.pow(2, retryCount - 1);
          console.log(`⏰ Retrying StateManager recovery in ${delay}ms...`);
          
          // Wait before next retry
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // All retries exhausted
          console.error(`💥 StateManager recovery failed after ${maxRetries} attempts. Tab detection may be unreliable.`);
          
          // Store failure info for debugging
          await chrome.storage.local.set({
            'statemanager-recovery-failed': {
              timestamp: Date.now(),
              error: error.message,
              attempts: maxRetries
            }
          });
          
          throw new Error(`StateManager recovery failed after ${maxRetries} attempts: ${error.message}`);
        }
      }
    }
  }

  async initialize() {
    try {
      // Initialize config manager first
      await this.configManager.initialize();
      
      // Initialize state manager early
      console.log('🔄 Initializing StateManager...');
      this.stateManager = new StateManager();
      await this.stateManager.initialize();
      
      // Initialize storage manager with state reference
      console.log('🔄 Initializing StorageManager...');
      this.storageManager = new StorageManager();
      this.storageManager.setStateManager(this.stateManager);
      this.storageManager.setFocusTimeTracker(this); // Connect to this tracker instance
      await this.storageManager.initialize();
      
      // Continue with other initialization
      this.blockingManager = new BlockingManager();
      this.blockingManager.setStorageManager(this.storageManager);
      this.blockingManager.setFocusTimeTracker(this);
      await this.blockingManager.initialize();
      
      // Skip Firebase initialization for now - extension works with local storage only
      console.log('ℹ️ Firebase integration disabled - using local storage only');

      console.log('🚀 Initializing Focus Time Tracker...');
      
      // Restore user info from storage
      try {
        const settings = await this.storageManager.getSettings();
        const localData = await chrome.storage.local.get(['userInfo']);
        
        // Use most recently updated user info
        let userInfo = settings.lastUpdated > (localData.userInfo?.lastUpdated || 0) 
          ? settings 
          : localData.userInfo;
          
        if (userInfo?.userId) {
          this.currentUserId = userInfo.userId;
          this.userInfo = userInfo;
          this.storageManager.currentUserId = userInfo.userId;
          console.log('✅ Restored user info on initialization:', userInfo.userId);
        } else {
          console.log('ℹ️ No user info found during initialization - sessions will use fallback user ID');
        }
      } catch (error) {
        console.warn('⚠️ Could not restore user info:', error);
      }
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Set up periodic cleanup
      this.setupPeriodicCleanup();
      
      console.log('✅ Focus Time Tracker initialized successfully');
      
      // Start tracking current tab if active
      await this.startTrackingCurrentTab();
      
    } catch (error) {
      console.error('❌ Error initializing Focus Time Tracker:', error);
      throw error;
    }
  }

  /**
   * Set up Chrome extension event listeners
   */
  setupEventListeners() {
    // 🆕 NEW: Use TabEventCoordinator for reliable tab detection
    // This replaces the previous direct event handlers to fix race conditions
    
    // Tab events - coordinated through TabEventCoordinator
    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.tabEventCoordinator.onTabActivated(activeInfo);
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.tabEventCoordinator.onTabUpdated(tabId, changeInfo, tab);
    });

    chrome.tabs.onRemoved.addListener((tabId) => {
      this.handleTabRemoved(tabId);
    });

    // Window events - coordinated through TabEventCoordinator
    chrome.windows.onFocusChanged.addListener((windowId) => {
      this.tabEventCoordinator.onWindowFocusChanged(windowId);
    });

    // Navigation events for URL caching (unchanged)
    chrome.webNavigation.onBeforeNavigate.addListener((details) => {
      if (details.frameId === 0) { // Main frame only
        this.blockingManager.cacheUrl(details.tabId, details.url);
      }
    });

    // External message handling from web apps (unchanged)
    chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
      console.log('📨 External message received from:', sender.origin);
      if (focusTimeTracker && focusTimeTracker.handleMessage) {
        focusTimeTracker.handleMessage(message, sender, sendResponse);
      } else {
        console.error('❌ focusTimeTracker not available for external message');
        console.log('📤 [BACKGROUND] Sending error response'); sendResponse({ success: false, error: 'Extension not initialized' });
      }
      return true; // Keep message channel open for async responses
    });

    // Timestamp-based sleep detection (unchanged)
    this.lastHeartbeat = Date.now();
    this.sleepDetectionInterval = setInterval(() => {
      this.checkForSleep();
    }, 10000); // Check every 10 seconds

    // ✅ IMPROVED: More frequent saves for better accuracy
    this.saveInterval = setInterval(() => {
      if (this.currentSession.isActive) {
        this.saveCurrentSession('incremental');
      }
    }, 3000); // Save every 3 seconds for better tracking
    
    console.log('✅ Event listeners set up with TabEventCoordinator - save interval: 3 seconds, sleep detection: 10 seconds');
  }

  /**
   * Capture valid session snapshot with validation
   * Used to prevent race conditions during tab switches
   */
  captureValidSnapshot() {
    if (!this.currentSession || !this.currentSession.isActive || !this.currentSession.startTime) {
      return null;
    }
    
    const duration = Date.now() - this.currentSession.startTime;
    if (duration < 500) { // Skip very short sessions
      return null;
    }
    
    return Object.freeze({
      domain: this.currentSession.domain,
      startTime: this.currentSession.startTime,
      duration: duration,
      capturedAt: Date.now()
    });
  }

  /**
   * Finalize session from snapshot with logging
   * Ensures consistent finalization across all paths
   */
  async finalizeFromSnapshot(snapshot) {
    if (!snapshot) {
      console.warn('⚠️ Cannot finalize - invalid snapshot provided');
      return null;
    }

    console.log(`🎯 Finalizing session: ${snapshot.domain}, startTime: ${new Date(snapshot.startTime).toISOString()}, duration: ${snapshot.duration}ms`);
    
    // 🔥 FIX: Complete the site usage session first (mark as completed)
    if (snapshot.domain) {
      await this.storageManager.completeSiteUsageSession(snapshot.domain);
    }
    
    // Then save final session data with the snapshot timing
    return await this.storageManager.saveTimeEntry(
      snapshot.domain,
      snapshot.duration,
      1,
      new Date(snapshot.startTime),
      'finalize'
    );
  }

  /**
   * Handle tab activation (user switches to different tab)
   */
  async handleTabActivated(activeInfo) {
    try {
      console.log('🔄 Tab activated:', activeInfo.tabId);
      
      // IMPROVEMENT #2: Cancel any pending grace timer
      if (this.graceTimer) {
        clearTimeout(this.graceTimer);
        this.graceTimer = null;
        console.log('⏱️ Grace period cancelled - user returned quickly');
      }
      
      // Get new tab info
      const tab = await chrome.tabs.get(activeInfo.tabId);
      console.log('📍 New tab URL:', tab.url);
      
      const newDomain = this.extractDomain(tab.url);
      
      // Check if we're returning to the same domain within grace period
      if (this.pendingSessionData && this.pendingSessionData.domain === newDomain) {
        console.log('🎯 Returning to same domain within grace period - continuing session');
        // Restore the pending session
        this.currentSession = this.pendingSessionData;
        this.pendingSessionData = null;
      } else {
        // Different domain - stop current tracking with grace period
        await this.stopCurrentTrackingWithGrace();
        // Start tracking new tab
        await this.startTracking(tab);
      }
    } catch (error) {
      console.error('❌ Error handling tab activation:', error);
    }
  }

  /**
   * Handle tab updates (URL changes, loading states)
   */
  async handleTabUpdated(tabId, changeInfo, tab) {
    try {
      // Only log when status changes or URL changes
      if (changeInfo.status || changeInfo.url) {
        console.log('📝 Tab updated:', { tabId, status: changeInfo.status, url: tab.url });
      }
      
      // Only track when tab is complete and is the active tab
      if (changeInfo.status === 'complete' && tab.active && tab.url) {
        const domain = this.extractDomain(tab.url);
        
        // If domain changed, restart tracking
        if (this.currentSession.tabId === tabId && this.currentSession.domain !== domain) {
          console.log('🔄 Domain changed, restarting tracking');
          await this.stopCurrentTracking();
          await this.startTracking(tab);
        }
      }
    } catch (error) {
      console.error('❌ Error handling tab update:', error);
    }
  }

  /**
   * Handle tab removal
   */
  async handleTabRemoved(tabId) {
    try {
      if (this.currentSession.tabId === tabId) {
        await this.stopCurrentTracking();
      }
      // Clean up cached URL
      this.blockingManager.urlCache.delete(tabId);
    } catch (error) {
      console.error('Error handling tab removal:', error);
    }
  }

  /**
   * Handle window focus changes
   */
  async handleWindowFocusChanged(windowId) {
    try {
      if (windowId === chrome.windows.WINDOW_ID_NONE) {
        // Browser lost focus - DON'T pause tracking to allow multitasking
        // await this.pauseTracking(); // DISABLED: Causes 15-20% time loss for normal multitasking
        console.log('👁️ Browser lost focus - continuing tracking (multitasking mode)');
      } else {
        // Browser gained focus
        const tabs = await chrome.tabs.query({ active: true, windowId: windowId });
        if (tabs.length > 0) {
          await this.resumeTracking(tabs[0]);
        }
      }
    } catch (error) {
      console.error('Error handling window focus change:', error);
    }
  }

  /**
   * NEW: Coordinated tab activation handler (called by TabEventCoordinator)
   * Replaces the race-condition prone handleTabActivated method
   */
  async handleTabActivatedCoordinated(validatedData) {
    try {
      console.log('🎯 Coordinated tab activated:', validatedData.tabId, validatedData.url);
      
      // We already have validated tab data, no need to fetch again
      const tab = validatedData.tab;
      const newDomain = this.extractDomain(tab.url);
      
      // 🎯 NEW: Track tab switch immediately to prevent timing race conditions
      const now = Date.now();
      const previousTabId = this.currentSession.tabId;
      
      if (previousTabId && previousTabId !== tab.id) {
        console.log(`🔄 Tab switch detected: ${previousTabId} → ${tab.id}`);
        this.lastTabSwitchTime = now;
        this.previousTabId = previousTabId;
        
        // 🎯 FIXED: Capture snapshot BEFORE any state changes
        const sessionSnapshot = this.captureValidSnapshot();
        
        // Clear session state immediately (prevent further races)
        if (this.currentSession.isActive) {
          console.log(`🚫 Immediately stopping session for tab switch: ${this.currentSession.domain}`);
          this.currentSession = {
            tabId: null,
            domain: null,
            startTime: null,
            savedTime: 0,
            isActive: false
          };
        }
        
        // Finalize using snapshot (single save, no duplicates)
        if (sessionSnapshot) {
          await this.finalizeFromSnapshot(sessionSnapshot);
        }
      }
      
      // Update heartbeat for user activity
      this.lastHeartbeat = validatedData.timestamp;

      // Cancel any pending grace timer
      if (this.graceTimer) {
        clearTimeout(this.graceTimer);
        this.graceTimer = null;
        console.log('⏰ Grace period cancelled - user returned quickly');
      }
      
      // Check if we're returning to the same domain within grace period
      if (this.pendingSessionData && this.pendingSessionData.domain === newDomain) {
        console.log('🔄 Returning to same domain within grace period - continuing session');
        // Restore the pending session
        this.currentSession = this.pendingSessionData;
        this.currentSession.tabId = tab.id; // Update tab ID
        this.pendingSessionData = null;
        return;
      }
      
      // Different domain - handle session transition
      if (this.currentSession.isActive && this.currentSession.domain !== newDomain) {
        console.log('🔄 Domain changed, transitioning sessions');
        await this.stopCurrentTrackingWithGrace();
      }
      
      // Start tracking new tab (with StateManager retry logic)
      await this.startTrackingWithRetry(tab);
      
    } catch (error) {
      console.error('❌ Error in coordinated tab activation:', error);
      // Don't throw - let coordinator handle retries
    }
  }

  /**
   * NEW: Coordinated tab update handler  
   */
  async handleTabUpdatedCoordinated(validatedData) {
    try {
      const { tabId, changeInfo, tab } = validatedData;
      
      console.log('🎯 Coordinated tab updated:', tabId, changeInfo.status, tab.url);
      
      // Only process if this is the currently tracked tab
      if (this.currentSession.tabId !== tabId) {
        return;
      }
      
      const newDomain = this.extractDomain(tab.url);
      
      // If domain changed on current tab, restart tracking
      if (this.currentSession.domain !== newDomain) {
        console.log('🔄 URL changed on current tab, restarting tracking');
        await this.stopCurrentTracking();
        await this.startTrackingWithRetry(tab);
      } else {
        // Same domain, just update heartbeat
        this.lastHeartbeat = validatedData.timestamp;
      }
      
    } catch (error) {
      console.error('❌ Error in coordinated tab update:', error);
    }
  }

  /**
   * NEW: Coordinated window focus handler
   */
  async handleWindowFocusCoordinated(validatedData) {
    try {
      const { windowId, activeTab } = validatedData;
      
      if (windowId === chrome.windows.WINDOW_ID_NONE) {
        // Browser lost focus - continue tracking (don't pause for multitasking)
        console.log('👁️ Browser lost focus - continuing tracking (multitasking mode)');
        return;
      }
      
      // Browser gained focus
      if (activeTab) {
        console.log('🎯 Browser gained focus, active tab:', activeTab.url);
        await this.resumeTrackingWithRetry(activeTab);
      }
      
    } catch (error) {
      console.error('❌ Error in coordinated window focus:', error);
    }
  }

  /**
   * NEW: Start tracking with StateManager retry logic
   */
  async startTrackingWithRetry(tab, retryCount = 0) {
    try {
      // Ensure StateManager is ready with retry logic
      await this.ensureStateManagerReady();
      
      // Proceed with normal tracking
      await this.startTracking(tab);
      
    } catch (error) {
      const maxRetries = 3;
      if (retryCount < maxRetries) {
        const delay = 1000 * Math.pow(2, retryCount); // Exponential backoff
        console.log(`🔄 Retrying startTracking in ${delay}ms (attempt ${retryCount + 2})`);
        
        setTimeout(() => {
          this.startTrackingWithRetry(tab, retryCount + 1);
        }, delay);
      } else {
        console.error(`❌ Failed to start tracking after ${maxRetries} retries:`, error);
      }
    }
  }

  /**
   * NEW: Resume tracking with retry logic
   */
  async resumeTrackingWithRetry(tab, retryCount = 0) {
    try {
      await this.ensureStateManagerReady();
      await this.resumeTracking(tab);
      
    } catch (error) {
      const maxRetries = 2; // Fewer retries for resume
      if (retryCount < maxRetries) {
        const delay = 500 * Math.pow(2, retryCount);
        console.log(`🔄 Retrying resumeTracking in ${delay}ms`);
        
        setTimeout(() => {
          this.resumeTrackingWithRetry(tab, retryCount + 1);
        }, delay);
      } else {
        console.error(`❌ Failed to resume tracking after retries:`, error);
      }
    }
  }

  /**
   * NEW: Ensure StateManager is ready with retry logic
   */
  async ensureStateManagerReady() {
    if (!this.stateManager?.isInitialized) {
      console.log('🔄 StateManager not ready, attempting recovery...');
      
      try {
        await this.recoverState();
        
        // Double-check initialization
        if (!this.stateManager?.isInitialized) {
          throw new Error('StateManager failed to initialize after recovery');
        }
        
        console.log('✅ StateManager recovery successful');
        
      } catch (error) {
        console.error('❌ StateManager recovery failed:', error);
        throw error;
      }
    }
  }

  /**
   * Handle messages from other extension components
   */
  async handleMessage(message, sender, sendResponse) {
    try {
      const { type, payload } = message;
      console.log('🔍 DEBUG: handleMessage called with type:', type, 'payload:', payload);
      console.log('🔍 DEBUG: Extension version with Deep Focus handlers - Build:', new Date().toISOString());

      switch (type) {
        case 'GET_FIREBASE_CONFIG':
          // Firebase removed for Chrome Web Store compliance
          console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: 'Firebase integration removed' });
          return true;

        case 'SET_FIREBASE_CONFIG':
          // Firebase removed for Chrome Web Store compliance  
          console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: 'Firebase integration removed' });
          return true;

        case 'GET_CURRENT_STATE':
          const currentState = await this.getCurrentState();
          const focusStats = this.blockingManager.getFocusStats(); // Add focus stats
          console.log('📤 [BACKGROUND] Sending response'); sendResponse({ 
            success: true, 
            data: { ...currentState, focusStats } 
          });
          break;

        case 'GET_TODAY_STATS':
          try {
            const stats = await this.storageManager.getTodayStats();
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, data: stats });
          } catch (error) {
            console.error('Error getting today stats from sessions:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'FORCE_SYNC_SESSIONS':
          try {
            console.log('🔄 Received FORCE_SYNC_SESSIONS request from web app');
            await this.storageManager.syncSessionsToFirebase();
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, message: 'Sessions sync initiated' });
          } catch (error) {
            console.error('❌ Error syncing sessions:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_REALTIME_STATS':
          console.log('📊 Processing GET_REALTIME_STATS request...');
          const realTimeStats = await this.storageManager.getRealTimeStatsWithSession();
          console.log('📊 Retrieved real-time stats:', realTimeStats);
          console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, data: realTimeStats });
          break;

        case 'GET_COMPLETE_STATS':
          console.log('📊 Processing GET_COMPLETE_STATS request (single-call approach)...');
          try {
            const completeStats = await this.storageManager.getTodayStats();
            console.log('📊 Retrieved complete stats:', {
              totalTime: completeStats.totalTime,
              sitesCount: Object.keys(completeStats.sites || {}).length,
              sitesVisited: completeStats.sitesVisited
            });
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ 
              success: true, 
              data: {
                totalTime: completeStats.totalTime,
                sites: completeStats.sites,
                sitesVisited: completeStats.sitesVisited,
                productivityScore: completeStats.productivityScore,
                timestamp: Date.now()
              }
            });
          } catch (error) {
            console.error('❌ Error getting complete stats:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ 
              success: false, 
              error: error.message,
              data: {
                totalTime: 0,
                sites: {},
                sitesVisited: 0,
                productivityScore: 0,
                timestamp: Date.now()
              }
            });
          }
          break;

        case 'DEBUG_STORAGE':
          console.log('🔍 Debug storage request received');
          try {
            // Get all storage data
            const allData = await chrome.storage.local.get(null);
            console.log('🔍 All storage data:', allData);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, data: allData });
          } catch (error) {
            console.error('❌ Debug storage error:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_TIME_DATA_RANGE':
          try {
            const { startDate, endDate } = message.payload;
            const timeData = await this.storageManager.getTimeData(startDate, endDate);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, data: timeData });
          } catch (error) {
            console.error('Error getting time data range:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_SETTINGS':
          const settings = await this.storageManager.getSettings();
          console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, data: settings });
          break;

        case 'GET_TOP_SITES':
          const topSites = await this.storageManager.getTopSites(message.payload?.limit || 5);
          console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, data: topSites });
          break;

        case 'GET_REALTIME_TOP_SITES':
          try {
            const realTimeTopSites = await this.storageManager.getRealTimeTopSites(message.payload?.limit || 20);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, data: realTimeTopSites });
          } catch (error) {
            console.error('❌ Error in GET_REALTIME_TOP_SITES:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_LOCAL_DEEP_FOCUS_TIME':
          try {
            const localDeepFocusTime = await this.storageManager.getTodayDeepFocusTime();
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, data: { minutes: localDeepFocusTime } });
          } catch (error) {
            console.error('Error getting local deep focus time:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'EXPORT_DATA':
          const exportResult = await this.exportData(message.payload?.format || 'json');
          sendResponse(exportResult);
          break;

        case 'ACTIVITY_DETECTED':
          await this.handleActivityDetected(sender.tab?.id);
          console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true });
          break;

        case 'ENHANCED_ACTIVITY_DETECTED':
          await this.handleEnhancedActivityDetected(message.payload);
          console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true });
          break;

        case 'ACTIVITY_HEARTBEAT':
          this.updateActivity(message.payload);
          console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true });
          break;

        case 'GET_ACTIVITY_STATE':
          const activityState = this.getActivityState();
          console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, data: activityState });
          break;

        case 'TOGGLE_AUTO_MANAGEMENT':
          const enabled = message.payload?.enabled ?? true;
          await this.setAutoManagement(enabled);
          console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, enabled });
          break;

        // Blocking system messages
        case 'TOGGLE_FOCUS_MODE':
          const toggleResult = await this.blockingManager.toggleFocusMode();
          await this.stateManager.dispatch({
            type: 'FOCUS_MODE_CHANGED',
            payload: { focusMode: toggleResult.focusMode }
          });
          // Broadcast state change to all listeners
          this.broadcastFocusStateChange(toggleResult.focusMode);
          sendResponse(toggleResult);
          break;

        case 'WEB_APP_FOCUS_STATE_CHANGED':
          try {
            console.log('🔄 Received focus state change from web app:', message.payload);
            
            const newFocusMode = message.payload?.focusMode;
            if (typeof newFocusMode !== 'boolean') {
              throw new Error('Invalid focus mode value');
            }

            // Get current focus mode from blocking manager
            const currentFocusMode = this.blockingManager.getFocusStats().focusMode;
            
            // Only update if the state is different
            if (currentFocusMode !== newFocusMode) {
              console.log(`🔄 Updating focus mode: ${currentFocusMode} → ${newFocusMode}`);
              
              // Update the blocking manager state directly
              const updateResult = await this.blockingManager.setFocusMode(newFocusMode);
              
              if (updateResult.success) {
                // Dispatch state change
                await this.stateManager.dispatch({
                  type: 'FOCUS_MODE_CHANGED',
                  payload: { 
                    focusMode: newFocusMode,
                    source: 'web-app'
                  }
                });
                
                // Broadcast to other extension components (but not back to web app to avoid loop)
                this.broadcastFocusStateChange(newFocusMode, { excludeWebApp: true });
                
                // Force immediate popup state refresh with a slight delay to ensure state is fully updated
                setTimeout(() => {
                  chrome.runtime.sendMessage({
                    type: 'FORCE_STATE_REFRESH',
                    payload: { 
                      focusMode: this.blockingManager.getFocusStats().focusMode,
                      timestamp: Date.now(),
                      source: 'web-app-sync'
                    }
                  }).catch(() => {
                    console.debug('📱 Popup not open for forced refresh');
                  });
                }, 100);
                
                console.log('📤 [BACKGROUND] Sending response'); sendResponse({ 
                  success: true, 
                  focusMode: newFocusMode,
                  previousMode: currentFocusMode
                });
              } else {
                throw new Error(updateResult.error || 'Failed to update focus mode');
              }
            } else {
              console.log('🔄 Focus mode already in correct state:', newFocusMode);
              console.log('📤 [BACKGROUND] Sending response'); sendResponse({ 
                success: true, 
                focusMode: newFocusMode,
                noChange: true
              });
            }
          } catch (error) {
            console.error('❌ Error processing web app focus state change:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ 
              success: false, 
              error: error.message,
              focusMode: this.blockingManager.getFocusStats().focusMode
            });
          }
          break;

        case 'ADD_BLOCKED_SITE':
          try {
            const addResult = await this.blockingManager.addBlockedSite(message.payload?.domain);
            sendResponse(addResult);
            
            // Sync back to web app after adding site
            if (addResult.success) {
              await this.syncBlockedSitesToWebApp();
            }
          } catch (error) {
            console.error('❌ Error adding blocked site:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'BLOCK_MULTIPLE_SITES':
          try {
            const domains = message.payload?.domains || [];
            if (!Array.isArray(domains) || domains.length === 0) {
              console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: 'Invalid domains array' });
              break;
            }
            
            console.log('📦 Batch blocking multiple sites:', domains);
            const results = [];
            let successCount = 0;
            let failureCount = 0;
            
            // Block all sites in batch
            for (const domain of domains) {
              try {
                const result = await this.blockingManager.addBlockedSite(domain);
                results.push({ domain, success: result.success, error: result.error });
                if (result.success) {
                  successCount++;
                } else {
                  failureCount++;
                }
              } catch (error) {
                results.push({ domain, success: false, error: error.message });
                failureCount++;
              }
            }
            
            console.log(`✅ Batch blocking completed: ${successCount} success, ${failureCount} failed`);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ 
              success: true, 
              results,
              summary: { successCount, failureCount, total: domains.length }
            });
          } catch (error) {
            console.error('❌ Batch blocking failed:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'REMOVE_BLOCKED_SITE':
          try {
            const removeResult = await this.blockingManager.removeBlockedSite(message.payload?.domain);
            sendResponse(removeResult);
            
            // Sync back to web app after removing site
            if (removeResult.success) {
              await this.syncBlockedSitesToWebApp();
            }
          } catch (error) {
            console.error('❌ Error removing blocked site:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'BLOCK_CURRENT_SITE':
        case 'BLOCK_SITE': // Add alias for backward compatibility
          try {
            // Get the current active tab
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length > 0 && tabs[0].url) {
              const currentDomain = this.extractDomain(tabs[0].url);
              if (currentDomain && this.isTrackableUrl(tabs[0].url)) {
                const blockResult = await this.blockingManager.addBlockedSite(currentDomain);
                console.log('📤 [BACKGROUND] Sending response'); sendResponse({ ...blockResult, domain: currentDomain });
              } else {
                console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: 'Current site cannot be blocked' });
              }
            } else {
              console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: 'No active tab found' });
            }
          } catch (error) {
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: 'Failed to get current tab: ' + error.message });
          }
          break;

        case 'GET_BLOCKED_SITES':
          const blockedSites = Array.from(this.blockingManager.blockedSites);
          console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, data: blockedSites });
          break;

        case 'SYNC_BLOCKED_SITES_FROM_WEBAPP':
          try {
            const sites = message.payload?.sites || [];
            console.log('🔄 Syncing blocked sites from web app:', sites.length);
            
            // Direct manipulation of blocked sites for efficiency
            this.blockingManager.blockedSites = new Set();
            
            // Add new sites from web app directly to the Set
            let successCount = 0;
            let failureCount = 0;
            for (const site of sites) {
              try {
                this.blockingManager.blockedSites.add(site);
                successCount++;
              } catch (error) {
                console.warn('⚠️ Failed to add site to blocked set:', site, error);
                failureCount++;
              }
            }
            
            // Update Chrome blocking rules to reflect the new state
            try {
              await this.blockingManager.updateBlockingRules();
              console.log('✅ Updated Chrome blocking rules after sync');
            } catch (error) {
              console.error('❌ Failed to update blocking rules after sync:', error);
              // Continue anyway - the Set is updated even if rules fail
            }
            
            // Save the new state to storage
            try {
              await this.blockingManager.saveState();
              console.log('💾 Saved blocking manager state after sync');
            } catch (error) {
              console.warn('⚠️ Failed to save state after sync:', error);
            }
            
            console.log(`✅ Sync completed: ${successCount} success, ${failureCount} failed`);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ 
              success: true, 
              synced: successCount,
              failed: failureCount 
            });
          } catch (error) {
            console.error('❌ Failed to sync blocked sites from web app:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'UPDATE_SETTINGS_FROM_WEBAPP':
          try {
            const { blockedSites } = message.payload || {};
            if (blockedSites && Array.isArray(blockedSites)) {
              // Update extension settings with new blocked sites
              const settings = await this.storageManager.getSettings();
              settings.blockedSites = blockedSites;
              await this.storageManager.updateSettings(settings);
              
              console.log('🔄 Updated extension settings from web app:', blockedSites.length, 'sites');
              console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true });
            } else {
              console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: 'Invalid blocked sites array' });
            }
          } catch (error) {
            console.error('❌ Failed to update settings from web app:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'OVERRIDE_BLOCK':
          const overrideResult = await this.blockingManager.setTemporaryOverride(
            message.payload?.domain, 
            message.payload?.duration
          );
          sendResponse(overrideResult);
          break;

        case 'GET_FOCUS_STATS':
          const focusStatsOnly = this.blockingManager.getFocusStats();
          console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, data: focusStatsOnly });
          break;

        case 'RECORD_BLOCKED_ATTEMPT':
          this.blockingManager.recordBlockedAttempt(message.payload?.domain);
          console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true });
          break;

        case 'FORCE_SYNC_FROM_WEBAPP':
          try {
            // Force sync blocked sites from web app to clear any default/stale sites
            console.log('🔄 Force syncing blocked sites from web app...');
            
            // Send empty array to clear all sites first
            this.blockingManager.blockedSites = new Set();
            await this.blockingManager.updateBlockingRules();
            await this.blockingManager.saveState();
            
            console.log('✅ Extension blocked sites cleared and ready for sync');
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, message: 'Extension cleared and ready for sync' });
          } catch (error) {
            console.error('❌ Failed to force sync from web app:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'SET_USER_ID':
          try {
            console.log('🔍 DEBUG: SET_USER_ID received:', message.payload);
            
            // Store user info in memory for quick access
            this.currentUserId = message.payload?.userId;
            this.userInfo = {
              userId: message.payload?.userId,
              userEmail: message.payload?.userEmail,
              displayName: message.payload?.displayName,
              timezone: message.payload?.timezone,
              lastUpdated: Date.now()
            };
            
            // Store timezone in extension local storage for persistence
            if (message.payload?.timezone) {
              console.log('📍 Storing user timezone in extension:', message.payload.timezone);
              await chrome.storage.local.set({
                userTimezone: message.payload.timezone,
                timezoneLastUpdated: Date.now(),
                timezoneSource: 'web_app_sync'
              });
              
              // Clear timezone manager cache to force refresh
              if (typeof timezoneManager !== 'undefined') {
                timezoneManager.clearCache();
                console.log('🗑️ Cleared timezone cache to use new web app setting');
              }
            }
            
            // Persist user info to storage
            if (this.storageManager) {
              // Save to storage manager
              await this.storageManager.saveSettings({
                userId: this.currentUserId,
                userEmail: message.payload?.userEmail,
                displayName: message.payload?.displayName,
                timezone: message.payload?.timezone,
                lastUpdated: Date.now()
              });
              
              // Update StorageManager's current user reference
              this.storageManager.currentUserId = this.currentUserId;
              console.log('✅ User info persisted to storage:', this.currentUserId);
            }
            
            // Save to local storage as backup
            await chrome.storage.local.set({
              userInfo: this.userInfo
            });
            
            console.log('✅ User info saved to local storage');
            
            // Notify popup about user info update
            try {
              chrome.runtime.sendMessage({
                type: 'USER_INFO_UPDATED',
                payload: this.userInfo
              }).catch(() => {
                // Popup might not be open, ignore error
                console.debug('📝 Popup not available for user info update notification');
              });
            } catch (error) {
              console.debug('📝 Failed to send user info update notification');
            }
            
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, userId: this.currentUserId });
          } catch (error) {
            console.error('❌ DEBUG: Error setting user ID:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_USER_INFO':
          try {
            // First try to get from storage manager
            const settings = await this.storageManager.getSettings();
            let userInfo = {
              userId: settings.userId,
              displayName: settings.displayName,
              userEmail: settings.userEmail,
              lastUpdated: settings.lastUpdated
            };

            // If not found in storage manager, try local storage
            if (!userInfo.userId) {
              const localData = await chrome.storage.local.get(['userInfo']);
              if (localData.userInfo) {
                userInfo = localData.userInfo;
                
                // Sync back to storage manager
                if (this.storageManager) {
                  await this.storageManager.saveSettings(userInfo);
                }
              }
            }

            // Update memory references
            this.currentUserId = userInfo.userId;
            this.userInfo = userInfo;

            sendResponse({
              success: true,
              data: {
                userId: userInfo.userId || 'anonymous',
                displayName: userInfo.displayName || 'Anonymous',
                userEmail: userInfo.userEmail,
                isLoggedIn: !!userInfo.userId,
                lastUpdated: userInfo.lastUpdated || Date.now()
              }
            });
          } catch (error) {
            console.error('Error getting user info:', error);
            sendResponse({
              success: true,
              data: {
                userId: 'anonymous',
                displayName: 'Anonymous',
                isLoggedIn: false,
                lastUpdated: Date.now()
              }
            });
          }
          return true;

        case 'RECORD_OVERRIDE_SESSION':
          // Forward to web app with user ID if available AND save to localStorage
          try {
            if (!this.currentUserId) {
              console.warn('⚠️ No user ID available for override session');
              console.log('📤 [BACKGROUND] Sending response'); sendResponse({ 
                success: false, 
                error: 'No user ID available. Please ensure you are logged in to the web app.' 
              });
              return;
            }

            const enhancedPayload = {
              ...message.payload,
              userId: this.currentUserId,
              timestamp: Date.now(),
              source: 'extension'
            };
            
            console.log('📤 Recording override session:', enhancedPayload);
            console.log('🔍 Current user ID:', this.currentUserId);
            
            // Save to localStorage using OverrideSessionManager
            const localSaveResult = await this.overrideSessionManager.saveOverrideSession({
              domain: enhancedPayload.domain,
              url: enhancedPayload.url,
              duration: enhancedPayload.duration,
              userId: this.currentUserId,
              reason: enhancedPayload.reason || 'manual_override',
              metadata: {
                timestamp: enhancedPayload.timestamp,
                source: 'extension'
              }
            });
            
            if (localSaveResult.success) {
              console.log('✅ Override session saved to localStorage:', localSaveResult.id);
              // Broadcast local storage update to popup/blocked pages
              this.broadcastOverrideUpdate();
            } else {
              console.error('❌ Failed to save override session to localStorage:', localSaveResult.error);
            }
            
            // Forward to web app for database storage
            this.forwardToWebApp('RECORD_OVERRIDE_SESSION', enhancedPayload);
            
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ 
              success: true, 
              payload: enhancedPayload,
              localStorage: localSaveResult
            });
          } catch (error) {
            console.error('❌ Error recording override session:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_SESSION_TIME':
          const sessionTime = this.blockingManager.focusStartTime 
            ? Date.now() - this.blockingManager.focusStartTime 
            : 0;
          console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, data: { sessionTime } });
          break;

        case 'GET_DEBUG_INFO':
          const debugInfo = this.blockingManager.getDebugInfo(message.payload?.domain);
          console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, data: debugInfo });
          break;

        case 'GET_CACHED_URL':
          const cachedUrl = this.blockingManager.getCachedUrl(sender.tab?.id);
          console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, data: { url: cachedUrl } });
          break;

        case 'CLEAR_CACHED_URL':
          this.blockingManager.clearCachedUrl(sender.tab?.id);
          console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true });
          break;

        case 'RESET_BLOCKING_STATE':
          const resetResult = await this.blockingManager.resetBlockingState();
          sendResponse(resetResult);
          break;

        // Enhanced Analytics Messages
        case 'GET_ANALYTICS_DATA':
          try {
            const period = message.payload?.period || 'week';
            const analyticsData = await this.storageManager.getAnalyticsData(period);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, data: analyticsData });
          } catch (error) {
            console.error('Error getting analytics data:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_PRODUCTIVITY_GOALS':
          try {
            const goals = await this.storageManager.getProductivityGoals();
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, data: goals });
          } catch (error) {
            console.error('Error getting productivity goals:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'UPDATE_GOAL_PROGRESS':
          try {
            const updateResult = await this.storageManager.updateGoalProgress(
              message.payload?.goalId,
              message.payload?.progress
            );
            sendResponse(updateResult);
          } catch (error) {
            console.error('Error updating goal progress:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'UPDATE_SITE_CATEGORY':
          try {
            const categoryResult = await this.storageManager.updateSiteCategory(
              message.payload?.domain,
              message.payload?.category
            );
            sendResponse(categoryResult);
          } catch (error) {
            console.error('Error updating site category:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_SITE_CATEGORY':
          try {
            const category = this.storageManager.getSiteCategory(message.payload?.domain);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, data: { category } });
          } catch (error) {
            console.error('Error getting site category:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_CATEGORY_BREAKDOWN':
          try {
            const analyticsData = await this.storageManager.getAnalyticsData('week');
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ 
              success: true, 
              data: { 
                categories: analyticsData.categoryBreakdown,
                totalTime: analyticsData.summary.totalTime
              }
            });
          } catch (error) {
            console.error('Error getting category breakdown:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_WEEKLY_STATS':
          try {
            const weeklyData = await this.storageManager.getAnalyticsData('week');
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, data: weeklyData });
          } catch (error) {
            console.error('Error getting weekly stats:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_MONTHLY_STATS':
          try {
            const monthlyData = await this.storageManager.getAnalyticsData('month');
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, data: monthlyData });
          } catch (error) {
            console.error('Error getting monthly stats:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'ENABLE_FOCUS_MODE':
          try {
            // Enable focus mode if not already enabled
            if (!this.blockingManager.focusMode) {
              const result = await this.blockingManager.toggleFocusMode();
              await this.stateManager.dispatch({
                type: 'FOCUS_MODE_CHANGED',
                payload: { focusMode: true }
              });
            }
            // Always broadcast state change to sync popup UI (with small delay to ensure proper timing)
            setTimeout(() => {
              this.broadcastFocusStateChange(true);
            }, 50);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, data: { focusMode: true } });
          } catch (error) {
            console.error('Error enabling focus mode:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'DISABLE_FOCUS_MODE':
          try {
            // Disable focus mode if currently enabled
            if (this.blockingManager.focusMode) {
              const result = await this.blockingManager.toggleFocusMode();
              await this.stateManager.dispatch({
                type: 'FOCUS_MODE_CHANGED',
                payload: { focusMode: false }
              });
            }
            // Always broadcast state change to sync popup UI (with small delay to ensure proper timing)
            setTimeout(() => {
              this.broadcastFocusStateChange(false);
            }, 50);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, data: { focusMode: false } });
          } catch (error) {
            console.error('Error disabling focus mode:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_LOCAL_OVERRIDE_TIME':
          try {
            const overrideTimeResult = await this.overrideSessionManager.calculateTodayOverrideTime();
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ 
              success: true, 
              data: { 
                overrideTime: overrideTimeResult.minutes,
                sessions: overrideTimeResult.sessions || 0
              }
            });
          } catch (error) {
            console.error('Error getting local override time:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_LOCAL_OVERRIDE_SESSIONS':
          try {
            const sessionsResult = await this.overrideSessionManager.getTodayOverrideSessions();
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ 
              success: true, 
              data: { 
                sessions: sessionsResult.sessions,
                date: sessionsResult.date
              }
            });
          } catch (error) {
            console.error('Error getting local override sessions:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'CLEANUP_OLD_OVERRIDE_SESSIONS':
          try {
            const daysToKeep = message.payload?.daysToKeep || 30;
            const result = await this.overrideSessionManager.cleanupOldSessions(daysToKeep);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ 
              success: true, 
              data: { 
                deletedCount: result.deletedCount
              }
            });
          } catch (error) {
            console.error('Error cleaning up old override sessions:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'CLEAR_ALL_OVERRIDE_SESSIONS':
          try {
            const result = await this.overrideSessionManager.clearAllSessions();
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ 
              success: true, 
              data: { cleared: result.success }
            });
          } catch (error) {
            console.error('Error clearing all override sessions:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_OVERRIDE_DEBUG_INFO':
          try {
            const debugInfo = await this.overrideSessionManager.getDebugInfo();
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ 
              success: true, 
              data: debugInfo.debug
            });
          } catch (error) {
            console.error('Error getting override debug info:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_FOCUS_STATE':
          sendResponse({
            success: true,
            data: {
              focusMode: this.blockingManager.getFocusStats().focusMode,
              lastUpdated: Date.now()
            }
          });
          return true;

        case 'GET_FOCUS_STATUS':
          try {
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, data: { focusMode: this.blockingManager.focusMode } });
          } catch (error) {
            console.error('Error getting focus status:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;


        case 'PING':
          // Health check ping from content scripts
          console.log('📤 [BACKGROUND] Sending response'); sendResponse({ 
            success: true, 
            timestamp: Date.now(),
            extensionId: chrome.runtime.id 
          });
          break;

        // Deep Focus session data retrieval handlers
        case 'GET_USER_TIMEZONE':
          try {
            const userTimezone = await timezoneManager.getEffectiveTimezone();
            console.log('📍 Returning user timezone:', userTimezone);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, timezone: userTimezone });
          } catch (error) {
            console.error('Error getting user timezone:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'MIGRATE_SESSIONS_TO_UTC':
          try {
            const migrationResult = await this.storageManager.migrateSessionsToUTC();
            console.log('🔄 Session migration completed:', migrationResult);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, data: migrationResult });
          } catch (error) {
            console.error('Error migrating sessions to UTC:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_DEEP_FOCUS_SESSIONS_DATE_RANGE':
          try {
            const { startDate, endDate } = message.payload || {};
            const sessions = await this.storageManager.getDeepFocusSessionsForDateRange(startDate, endDate);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, data: sessions });
          } catch (error) {
            console.error('Error getting deep focus sessions for date range:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_TODAY_DEEP_FOCUS_SESSIONS':
          try {
            const todaySessions = await this.storageManager.getTodayDeepFocusSessions();
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, data: todaySessions });
          } catch (error) {
            console.error('Error getting today deep focus sessions:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_ACTIVE_DEEP_FOCUS_SESSION':
          try {
            const activeSession = await this.storageManager.getActiveDeepFocusSession();
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, data: activeSession });
          } catch (error) {
            console.error('Error getting active deep focus session:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_ALL_DEEP_FOCUS_SESSIONS':
          try {
            const allSessions = await this.storageManager.getAllDeepFocusSessions();
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, data: allSessions });
          } catch (error) {
            console.error('Error getting all deep focus sessions:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_RECENT_7_DAYS_DEEP_FOCUS_SESSIONS':
          try {
            const recent7DaysSessions = await this.storageManager.getRecent7DaysDeepFocusSessions();
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, data: recent7DaysSessions });
          } catch (error) {
            console.error('Error getting recent 7 days deep focus sessions:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_LAST_10_DEEP_FOCUS_SESSIONS':
          try {
            const last10Sessions = await this.storageManager.getLast10DeepFocusSessions();
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, data: last10Sessions });
          } catch (error) {
            console.error('Error getting last 10 deep focus sessions:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          }
          break;

        case 'REQUEST_SITE_USAGE_SESSIONS':
          try {
            console.log('🔄 [BACKGROUND] Received REQUEST_SITE_USAGE_SESSIONS from content script', { hasPayload: !!message.payload, timestamp: new Date().toISOString() });
            
            const payload = message.payload || {};
            const incremental = payload.incremental !== false; // Default to true for performance
            const daysBack = payload.daysBack || 7; // Default to last 7 days for incremental sync
            
            // Get all site usage sessions from storage
            const storage = await chrome.storage.local.get(['site_usage_sessions', 'last_sync_timestamp']);
            const allSessions = storage.site_usage_sessions || {};
            const lastSyncTime = storage.last_sync_timestamp || 0;
            
            let sessionsList = [];
            let syncStrategy = 'full';
            
            if (incremental && lastSyncTime > 0) {
              // INCREMENTAL SYNC: Only sessions modified since last sync
              syncStrategy = 'incremental';
              console.log(`📊 Incremental sync: checking sessions modified since ${new Date(lastSyncTime).toISOString()}`);
              
              Object.keys(allSessions).forEach(date => {
                const daySessions = allSessions[date] || [];
                if (Array.isArray(daySessions)) {
                  daySessions.forEach(session => {
                    // Include sessions that are:
                    // 1. New (created after last sync)
                    // 2. Modified (if they have a lastModified timestamp after last sync)
                    // 3. Active (still ongoing)
                    const sessionTime = new Date(session.startTimeUTC).getTime();
                    const sessionModified = session.lastModified ? new Date(session.lastModified).getTime() : sessionTime;
                    
                    if (sessionModified > lastSyncTime || 
                        session.status === 'active' ||
                        sessionTime > lastSyncTime) {
                      sessionsList.push({
                        ...session,
                        utcDate: date
                      });
                    }
                  });
                }
              });
            } else if (incremental) {
              // RECENT SYNC: Last N days only (when no previous sync timestamp)
              syncStrategy = 'recent';
              console.log(`📊 Recent sync: syncing last ${daysBack} days`);
              
              const cutoffDate = new Date();
              cutoffDate.setDate(cutoffDate.getDate() - daysBack);
              const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
              
              Object.keys(allSessions).forEach(date => {
                if (date >= cutoffDateStr) {
                  const daySessions = allSessions[date] || [];
                  if (Array.isArray(daySessions)) {
                    daySessions.forEach(session => {
                      sessionsList.push({
                        ...session,
                        utcDate: date
                      });
                    });
                  }
                }
              });
            } else {
              // FULL SYNC: All sessions (fallback or explicitly requested)
              syncStrategy = 'full';
              console.log('📊 Full sync: retrieving all sessions');
              
              Object.keys(allSessions).forEach(date => {
                const daySessions = allSessions[date] || [];
                if (Array.isArray(daySessions)) {
                  daySessions.forEach(session => {
                    sessionsList.push({
                      ...session,
                      utcDate: date
                    });
                  });
                }
              });
            }
            
            // Sort by date and time for consistent processing
            sessionsList.sort((a, b) => {
              const dateCompare = b.utcDate.localeCompare(a.utcDate);
              if (dateCompare !== 0) return dateCompare;
              return new Date(b.startTimeUTC).getTime() - new Date(a.startTimeUTC).getTime();
            });
            
            // Deduplicate by session ID to prevent downstream complexity
            const beforeDedup = sessionsList.length;
            const sessionMap = new Map();
            sessionsList.forEach(session => {
              if (session.id) {
                sessionMap.set(session.id, session);
              }
            });
            sessionsList = Array.from(sessionMap.values());
            
            if (beforeDedup !== sessionsList.length) {
              console.log(`🔍 Extension deduplication: ${beforeDedup} → ${sessionsList.length} sessions (removed ${beforeDedup - sessionsList.length} duplicates)`);
            }
            
            console.log(`📊 ${syncStrategy.toUpperCase()} sync found ${sessionsList.length} sessions`);
            console.log('📋 Session dates available:', Object.keys(allSessions));
            console.log('📋 Sync details:', {
              strategy: syncStrategy,
              lastSyncTime: lastSyncTime ? new Date(lastSyncTime).toISOString() : 'never',
              daysBack,
              totalAvailable: Object.values(allSessions).flat().length
            });
            
            // Update last sync timestamp for future incremental syncs
            if (sessionsList.length > 0) {
              await chrome.storage.local.set({
                'last_sync_timestamp': Date.now()
              });
              console.log('✅ Updated last sync timestamp for future incremental syncs');
            }
            
            // Respond with sessions in the expected format
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ 
              success: true, 
              sessions: sessionsList,
              totalSessions: sessionsList.length,
              syncStrategy,
              datesAvailable: Object.keys(allSessions).length,
              lastSyncTime: lastSyncTime ? new Date(lastSyncTime).toISOString() : null
            });
            
          } catch (error) {
            console.error('❌ Error retrieving site usage sessions:', error);
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ 
              success: false, 
              error: error.message,
              sessions: []
            });
          }
          break;

        default:
          console.warn('❓ Unknown message type:', type);
          console.log('🔍 DEBUG: Full message object:', message);
          console.log('🔍 DEBUG: Available message types should include GET_TODAY_DEEP_FOCUS_SESSIONS');
          console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('❌ Error handling message:', error);
      console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
    }
    
    // Return true to keep the message channel open for async responses
    return true;
  }

  /**
   * Handle activity detected from content script
   */
  async handleActivityDetected(tabId) {
    try {
      // If tracking was paused, resume it
      if (!this.currentSession.isActive && this.currentSession.tabId === tabId) {
        const tab = await chrome.tabs.get(tabId);
        await this.resumeTracking(tab);
      }
    } catch (error) {
      console.error('Error handling activity:', error);
    }
  }

  /**
   * Start tracking a website
   */
  async startTracking(tab) {
    try {
      await this.recoverState();
      if (!this.stateManager?.isInitialized) {
        throw new Error('StateManager not available');
      }
      
      // 🎯 IMPROVED: Enhanced tab validation with fallbacks
      if (!this.validateTabForTracking(tab)) {
        return;
      }

      // 🎯 NEW: Verify this tab is currently active before starting tracking
      const isCurrentlyActive = await this.isTabCurrentlyActive(tab.id);
      if (!isCurrentlyActive) {
        console.log(`🚫 Tab ${tab.id} is no longer active, skipping tracking start for:`, this.extractDomain(tab.url));
        return;
      }

      const domain = this.extractDomain(tab.url);
      const now = Date.now();
      
      console.log('🎯 Starting tracking for domain:', domain, 'Tab ID:', tab.id);
      
      // Update heartbeat for user activity
      this.lastHeartbeat = now;

      // Check if we have a paused session for the same domain
      if (!this.currentSession.isActive && this.currentSession.domain === domain) {
        // Resume paused session
        console.log('🔄 Resuming paused session for domain:', domain);
        this.currentSession.tabId = tab.id;
        this.currentSession.startTime = now;
        this.currentSession.lastSaveTime = now;
        this.currentSession.isActive = true;
        console.log(`▶️ Resumed tracking: ${domain}, Tab ID: ${tab.id}`);
        return;
      }

      // Save current session if exists and different domain
      if (this.currentSession.isActive && this.currentSession.domain !== domain) {
        console.log('🔄 Switching from', this.currentSession.domain, 'to', domain);
        await this.stopCurrentTracking();
      }

      // Only create new session if not already tracking this domain
      if (!this.currentSession.isActive || this.currentSession.domain !== domain) {
        console.log('✨ Starting new tracking session for domain:', domain);

        // 🎯 NEW: Double-check tab is still active before creating session
        const stillActive = await this.isTabCurrentlyActive(tab.id);
        if (!stillActive) {
          console.log(`🚫 Tab ${tab.id} became inactive during session creation, aborting`);
          return;
        }

        // Initialize session with proper timing fields
        this.currentSession = {
          tabId: tab.id,
          domain: domain,
          startTime: now,
          lastSaveTime: now,
          savedTime: 0,
          isActive: true
        };

        // 🎯 IMPROVED: Create session in storage with error handling and timing validation
        try {
          await this.storageManager.saveTimeEntry(domain, 0, 1, now, 'create'); // Pass startTime explicitly
          console.log('💾 Session initialized in storage for:', domain);
        } catch (storageError) {
          console.error('⚠️ Failed to initialize session in storage:', storageError);
          // Continue anyway - the session will be created on first save
        }

        // 🎯 IMPROVED: StateManager dispatch with error handling  
        try {
          await this.stateManager.dispatch({
            type: 'START_TRACKING',
            payload: {
              domain: domain,
              startTime: now
            }
          });
        } catch (stateError) {
          console.error('⚠️ StateManager dispatch failed:', stateError);
          // Continue anyway - tracking will work without state dispatch
        }

        console.log(`✅ Started tracking: ${domain}, Tab ID: ${tab.id}`);
      }
      
    } catch (error) {
      console.error('❌ Error in startTracking:', error);
      // Don't re-throw - let the coordinator handle retries
    }
  }

  /**
   * 🆕 NEW: Enhanced tab validation with detailed logging
   */
  validateTabForTracking(tab) {
    if (!tab) {
      console.log('⚠️ Tab validation failed: tab is null/undefined');
      return false;
    }
    
    if (!tab.url) {
      console.log('⚠️ Tab validation failed: no URL available');
      return false;
    }
    
    if (!this.isTrackableUrl(tab.url)) {
      console.log('⚠️ Tab validation failed: URL not trackable:', tab.url);
      return false;
    }
    
    if (!tab.id || tab.id < 0) {
      console.log('⚠️ Tab validation failed: invalid tab ID:', tab.id);
      return false;
    }
    
    console.debug('✅ Tab validation passed:', { id: tab.id, url: tab.url });
    return true;
  }

  /**
   * 🎯 NEW: Check if a tab is currently the active tab
   */
  async isTabCurrentlyActive(tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (!tab.active) {
        return false;
      }
      
      // Double-check by querying active tabs in the tab's window
      const activeTabs = await chrome.tabs.query({ active: true, windowId: tab.windowId });
      return activeTabs.length > 0 && activeTabs[0].id === tabId;
    } catch (error) {
      console.debug(`Tab ${tabId} validation failed:`, error.message);
      return false;
    }
  }

  /**
   * 🆕 NEW: Cleanup method for proper resource management
   */
  destroy() {
    try {
      // Stop tracking
      if (this.currentSession.isActive) {
        this.stopCurrentTracking();
      }
      
      // Clear intervals
      if (this.saveInterval) {
        clearInterval(this.saveInterval);
        this.saveInterval = null;
      }
      
      if (this.sleepDetectionInterval) {
        clearInterval(this.sleepDetectionInterval);
        this.sleepDetectionInterval = null;
      }
      
      // Clear grace timer
      if (this.graceTimer) {
        clearTimeout(this.graceTimer);
        this.graceTimer = null;
      }
      
      // Cleanup coordinator
      if (this.tabEventCoordinator) {
        this.tabEventCoordinator.destroy();
        this.tabEventCoordinator = null;
      }
      
      console.log('🧹 FocusTimeTracker cleanup completed');
      
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }

  /**
   * IMPROVEMENT #2: Stop current tracking with grace period for tab switching
   */
  async stopCurrentTrackingWithGrace() {
    try {
      if (!this.currentSession.isActive || !this.currentSession.startTime) {
        return;
      }

      console.log('⏱️ Starting grace period for tab switch');
      
      // Store current session data for potential restoration
      this.pendingSessionData = { ...this.currentSession };
      
      // Set grace timer
      this.graceTimer = setTimeout(async () => {
        console.log('⏰ Grace period expired - finalizing session stop');
        await this.finalizeSessionStop();
        this.graceTimer = null;
        this.pendingSessionData = null;
      }, this.gracePeriod);
      
    } catch (error) {
      console.error('❌ Error in stopCurrentTrackingWithGrace:', error);
    }
  }

  /**
   * Finalize stopping the session after grace period expires
   */
  async finalizeSessionStop() {
    try {
      if (!this.pendingSessionData) {
        return;
      }

      const now = Date.now();
      const timeSpent = now - this.pendingSessionData.startTime;
      const domain = this.pendingSessionData.domain;

      // IMPROVEMENT #1: Reduce threshold from 1000ms to 500ms and improve rounding
      if (timeSpent > 500 && domain) {
        const roundedTime = Math.round(timeSpent / 1000) * 1000;
        // ✅ FIXED: Pass actual start time to fix timing bug in grace period finalization
        await this.storageManager.saveTimeEntry(domain, roundedTime, 1, this.pendingSessionData.startTime, 'finalize');
        console.log(`Stopped tracking (after grace): ${domain}, Time: ${this.storageManager.formatTime(roundedTime)}`);
      }

      await this.stateManager.dispatch({
        type: 'STOP_TRACKING'
      });
      
      // Reset session
      this.currentSession = {
        tabId: null,
        domain: null,
        startTime: null,
        savedTime: 0,
        isActive: false
      };
      
    } catch (error) {
      console.error('❌ Error in finalizeSessionStop:', error);
    }
  }

  /**
   * Stop tracking current website and save data (immediate, no grace period)
   */
  async stopCurrentTracking() {
    try {
      await this.recoverState();
      if (!this.stateManager?.isInitialized) {
        throw new Error('StateManager not available');
      }
      if (!this.currentSession.isActive || !this.currentSession.startTime) {
        return;
      }

      const now = Date.now();
      const timeSpent = now - this.currentSession.startTime;
      const domain = this.currentSession.domain;

      // Complete the site usage session first
      if (domain) {
        await this.storageManager.completeSiteUsageSession(domain);
      }

      // Save final session data if significant time spent
      if (timeSpent > 500 && domain) {
        const roundedTime = Math.round(timeSpent / 1000) * 1000; // Round for better accuracy
        // ✅ FIXED: Pass actual start time to fix timing bug
        await this.storageManager.saveTimeEntry(domain, roundedTime, 1, this.currentSession.startTime, 'finalize');
        console.log(`✅ Stopped tracking and completed session: ${domain}, Time: ${this.storageManager.formatTime(roundedTime)}`);
      }

      await this.stateManager.dispatch({
        type: 'STOP_TRACKING'
      });
      
      // Reset current session
      this.currentSession = {
        tabId: null,
        domain: null,
        startTime: null,
        savedTime: 0,
        isActive: false
      };
    } catch (error) {
      console.error('❌ Error in stopCurrentTracking:', error);
    }
  }

  /**
   * Pause tracking (browser lost focus)
   */
  async pauseTracking() {
    if (this.currentSession.isActive) {
      // Just pause, don't save yet - let saveCurrentSession handle it
      this.currentSession.isActive = false;
      console.log('⏸️ Tracking paused for:', this.currentSession.domain);
    }
  }

  /**
   * Resume tracking (browser gained focus)
   */
  async resumeTracking(tab) {
    if (!this.currentSession.isActive && tab && this.isTrackableUrl(tab.url)) {
      const domain = this.extractDomain(tab.url);
      const now = Date.now();
      
      // Update heartbeat for user activity
      this.lastHeartbeat = now;
      
      // Only resume if we have a paused session for the same domain
      if (this.currentSession.domain === domain) {
        this.currentSession.tabId = tab.id;
        this.currentSession.startTime = now;
        this.currentSession.isActive = true;
        console.log(`▶️ Resumed tracking from activity: ${domain}`);
      } else {
        // Different domain, start new tracking
        await this.startTracking(tab);
      }
    }
  }

  /**
   * Check for system sleep based on timestamp gaps
   */
  async checkForSleep() {
    const now = Date.now();
    const timeSinceLastHeartbeat = now - this.lastHeartbeat;
    
    // If more than 5 minutes have passed, assume system was sleeping
    if (timeSinceLastHeartbeat > 300000) { // 5 minutes (more sensitive detection)
      console.log('💤 Sleep detected in periodic check - time gap:', Math.round(timeSinceLastHeartbeat / 1000) + 's');
      
      // If we have an active session, save time before sleep and pause
      if (this.currentSession.isActive && this.currentSession.startTime) {
        // Calculate session duration up to last heartbeat (excludes sleep time)
        const timeBeforeSleep = Math.max(0, this.lastHeartbeat - this.currentSession.startTime);
        
        // Save accumulated time before sleep
        if (timeBeforeSleep >= 1000) { // At least 1 second of activity
          await this.storageManager.saveTimeEntry(this.currentSession.domain, timeBeforeSleep, 0, null, 'incremental');
          console.log('💾 Saved time before sleep (periodic check):', {
            domain: this.currentSession.domain,
            duration: this.storageManager.formatTime(timeBeforeSleep),
            sleepGap: Math.round(timeSinceLastHeartbeat / 1000) + 's'
          });
        }
        
        // Handle sleep detection (pause session)
        await this.handleSleepDetected();
      }
    }
    
    // DON'T update heartbeat here - let user activity drive heartbeat updates
    // this.lastHeartbeat = now; // REMOVED: This prevented sleep detection
  }

  /**
   * Handle sleep detected condition (extracted to prevent recursion)
   */
  async handleSleepDetected() {
    // If we have an active session, pause it (saving is handled by caller)
    if (this.currentSession.isActive && this.currentSession.startTime) {
      // PAUSE session instead of reset - preserve domain and accumulated time
      this.currentSession.isActive = false;
      this.currentSession.startTime = null;
      // Keep domain and savedTime intact for resume
      console.log(`⏸️ Session paused for ${this.currentSession.domain} due to sleep detection`);
    }
  }

  /**
   * Get the currently active tab
   */
  async getActiveTab() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      return tabs[0] || null;
    } catch (error) {
      console.error('Error getting active tab:', error);
      return null;
    }
  }

  /**
   * Get current extension state
   */
  async getCurrentState() {
    const focusStats = this.blockingManager.getFocusStats();
    const state = {
      currentSession: this.currentSession,
      tracking: this.currentSession.isActive,
      focusMode: focusStats.focusMode,
      todayStats: await this.storageManager.getTodayStats()
    };
    
    console.log('🔍 getCurrentState called - returning focus mode:', focusStats.focusMode, 'at', new Date().toISOString());
    return state;
  }

  /**
   * Save current session progress (enhanced with pause tracking)
   */
  async saveCurrentSession(operationType = 'incremental') {
    try {
      // SAFEGUARD 1: Validate session state
      if (!this.currentSession || !this.currentSession.isActive || !this.currentSession.startTime) {
        return;
      }

      // 🎯 NEW: Prevent saves immediately after tab switches to avoid timing race conditions
      const now = Date.now();
      if (this.lastTabSwitchTime && (now - this.lastTabSwitchTime) < this.tabSwitchCooldown && operationType === 'finalize') {
        const cooldownRemaining = Math.round((this.tabSwitchCooldown - (now - this.lastTabSwitchTime)) / 1000);
        console.debug(`🚫 Preventing finalization save due to recent tab switch (${cooldownRemaining}s cooldown remaining)`);
        return;
      }

      // 🎯 ENHANCED: Verify the session's tab is still active before saving
      if (this.currentSession.tabId) {
        const isStillActive = await this.isTabCurrentlyActive(this.currentSession.tabId);
        if (!isStillActive) {
          console.log(`🚫 Session tab ${this.currentSession.tabId} for ${this.currentSession.domain} is no longer active, stopping session`);
          
          // Clear session immediately to prevent further saves
          this.currentSession = {
            tabId: null,
            domain: null,
            startTime: null,
            savedTime: 0,
            isActive: false
          };
          return;
        }
        
        // 🎯 NEW: Double-check that current active tab matches our session
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const currentActiveTab = tabs[0];
        if (currentActiveTab && currentActiveTab.id !== this.currentSession.tabId) {
          console.log(`🚫 Active tab mismatch: session for ${this.currentSession.tabId}, but active tab is ${currentActiveTab.id}`);
          
          // Clear session to prevent saving for wrong tab
          this.currentSession = {
            tabId: null,
            domain: null,
            startTime: null,
            savedTime: 0,
            isActive: false
          };
          return;
        }
      }

      // SAFEGUARD 2: Prevent concurrent execution and sleep processing
      if (this.isSaving || this.isProcessingSleep) {
        console.debug('⏭️ Save already in progress or processing sleep, skipping');
        return;
      }
      this.isSaving = true;
      
      // SAFEGUARD 3: Validate timestamps and handle undefined lastHeartbeat
      if (!this.lastHeartbeat) {
        console.warn('⚠️ lastHeartbeat undefined, initializing to current time');
        this.lastHeartbeat = now;
        this.currentSession.lastSaveTime = now; // Initialize last save time
        return;
      }
      
      const timeSinceLastHeartbeat = now - this.lastHeartbeat;
      
      // DEFENSIVE CHECK: Check for sleep BEFORE calculating session duration
      if (timeSinceLastHeartbeat > 300000) { // 5 minutes gap indicates sleep
        console.log('💤 Sleep detected during save - handling sleep condition');
        
        // ✅ FIX: Calculate incremental time up to last heartbeat
        const lastSaveTime = this.currentSession.lastSaveTime || this.currentSession.startTime;
        const incrementalDuration = Math.max(0, this.lastHeartbeat - lastSaveTime);
        
        // Save incremental time before sleep if any - but NOT if recent tab switch
        if (incrementalDuration >= 1000 && (!this.lastTabSwitchTime || (this.lastHeartbeat - this.lastTabSwitchTime) > this.tabSwitchCooldown)) {
          await this.storageManager.saveTimeEntry(this.currentSession.domain, incrementalDuration, 0, lastSaveTime, 'incremental');
          this.currentSession.lastSaveTime = this.lastHeartbeat; // Update last save time
          console.log('💾 Saved incremental time before sleep:', {
            domain: this.currentSession.domain,
            incrementalDuration: this.storageManager.formatTime(incrementalDuration),
            sleepGap: Math.round(timeSinceLastHeartbeat / 1000) + 's'
          });
        } else if (this.lastTabSwitchTime && (this.lastHeartbeat - this.lastTabSwitchTime) <= this.tabSwitchCooldown) {
          console.log('🚫 Skipping save before sleep due to recent tab switch');
        }
        
        this.isProcessingSleep = true;
        try {
          await this.handleSleepDetected();
        } finally {
          this.isProcessingSleep = false;
        }
        return;
      }
      
      // ✅ FIX: Calculate INCREMENTAL duration since last save, not total duration
      const lastSaveTime = this.currentSession.lastSaveTime || this.currentSession.startTime;
      const incrementalDuration = now - lastSaveTime;
      
      // 🔥 NEW: Additional safeguards against duration inflation
      
      // Prevent saving if incremental duration is unreasonably long
      if (incrementalDuration > 600000) { // 10 minutes max per save cycle (reduced from 1 hour)
        console.warn('⚠️ Incremental duration excessive:', Math.round(incrementalDuration/1000) + 's - possible missed sleep. Resetting...');
        this.currentSession.lastSaveTime = now;
        return;
      }
      
      // Prevent tiny increments that could accumulate incorrectly
      if (incrementalDuration < 1000) { // Less than 1 second
        console.debug('⏭️ Skipping save - incremental duration too small:', incrementalDuration, 'ms');
        return;
      }
      
      // 🔥 NEW: Check for session lifetime reasonableness
      const totalSessionLifetime = now - this.currentSession.startTime;
      if (totalSessionLifetime > 14400000) { // 4 hours max session lifetime
        console.warn('⚠️ Session lifetime exceeded 4 hours, forcing session end');
        await this.stopCurrentTracking();
        return;
      }
      
      // ✅ IMPROVEMENT: Only save meaningful incremental time with stricter validation
      if (incrementalDuration >= 2000 && incrementalDuration <= 300000) { // 2 seconds to 5 minutes range
        // 🎯 NEW: Final check - ensure this save is not happening due to a timing race
        const timeSinceTabSwitch = this.lastTabSwitchTime ? (now - this.lastTabSwitchTime) : Number.MAX_SAFE_INTEGER;
        if (timeSinceTabSwitch < this.tabSwitchCooldown) {
          console.log(`🚫 Preventing save due to recent tab switch (${Math.round(timeSinceTabSwitch/1000)}s ago)`);
          return;
        }
        
        await this.storageManager.saveTimeEntry(this.currentSession.domain, incrementalDuration, 0, lastSaveTime, 'incremental');
        
        // ✅ FIX: Update last save time to current time (not start time!)
        this.currentSession.lastSaveTime = now;
        
        console.log('💾 Session updated (incremental):', {
          domain: this.currentSession.domain,
          incrementalDuration: this.storageManager.formatTime(incrementalDuration),
          totalSessionTime: this.storageManager.formatTime(totalSessionLifetime)
        });
      } else {
        console.debug('⏭️ Skipping save - duration outside valid range:', Math.round(incrementalDuration/1000) + 's');
      }
    } catch (error) {
      console.error('❌ Error saving session:', error);
    } finally {
      // SAFEGUARD: Always reset the saving flag
      this.isSaving = false;
    }
  }

  /**
   * Extract domain from URL
   */
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Check if URL should be tracked
   */
  isTrackableUrl(url) {
    const nonTrackableProtocols = ['chrome:', 'chrome-extension:', 'moz-extension:', 'about:', 'file:'];
    return !nonTrackableProtocols.some(protocol => url.startsWith(protocol));
  }

  /**
   * Check if URL is a web app URL that should be excluded from tracking
   */
  isWebAppUrl(url) {
    if (!url) return false;
    
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const port = parseInt(urlObj.port);
      
      // Check for localhost development URLs with common dev server ports
      if (hostname === 'localhost' && port >= 3000 && port <= 9000) {
        return true;
      }
      
      // Check for production web app URLs
      const productionDomains = [
        'app.make10000hours.com',
        'www.app.make10000hours.com'
      ];
      
      return productionDomains.includes(hostname);
    } catch (error) {
      console.warn('Error parsing URL in isWebAppUrl:', error);
      return false;
    }
  }

  /**
   * Export tracking data
   */
  async exportData(format = 'json') {
    try {
      const result = await chrome.storage.local.get(['timeData', 'settings']);
      const data = {
        timeData: result.timeData || {},
        settings: result.settings || {},
        exportDate: new Date().toISOString()
      };

      if (format === 'json') {
        return JSON.stringify(data, null, 2);
      }
      
      return data;
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }

  /**
   * Start tracking the currently active tab
   */
  async startTrackingCurrentTab() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0) {
        console.log('🎯 Found active tab:', tabs[0].url);
        await this.startTracking(tabs[0]);
      } else {
        console.log('⚠️ No active tab found');
      }
    } catch (error) {
      console.error('❌ Error getting current tab:', error);
    }
  }

  /**
   * Enhanced activity detection handler
   */
  async handleEnhancedActivityDetected(activityData) {
    try {
      console.log('🎯 Enhanced activity detected:', {
        isActive: activityData.isActive,
        timeSinceActivity: Math.round(activityData.timeSinceLastActivity / 1000) + 's',
        isVisible: activityData.isVisible,
        eventType: activityData.eventType
      });

      this.updateActivity(activityData);

      // Handle inactivity-based auto-pause
      if (!activityData.isActive && this.autoManagementEnabled && !this.isSessionPaused) {
        if (activityData.timeSinceLastActivity > this.inactivityThreshold) {
          await this.pauseSession(activityData.timeSinceLastActivity);
        }
      }
      
      // Handle activity-based auto-resume
      if (activityData.isActive && this.isSessionPaused && this.autoManagementEnabled) {
        await this.resumeSession();
      }
    } catch (error) {
      console.error('Error handling enhanced activity:', error);
    }
  }

  /**
   * Update activity timestamp and state
   */
  updateActivity(activityData = {}) {
    const now = Date.now();
    this.lastActivityTime = now;
    this.lastHeartbeat = now; // Sync heartbeat with real user activity for accurate sleep detection
    
    if (activityData.isActive) {
      // Resume session if it was paused and activity is detected
      if (this.isSessionPaused && this.autoManagementEnabled) {
        this.resumeSession();
      }
    }
  }

  /**
   * Pause session due to inactivity
   */
  async pauseSession(inactivityDuration = 0) {
    if (this.isSessionPaused || !this.currentSession.isActive) {
      return;
    }

    console.log(`🛑 Pausing session due to inactivity: ${Math.round(inactivityDuration / 1000)}s`);
    
    // Save current progress before pausing
    await this.saveCurrentSession('finalize');
    
    this.isSessionPaused = true;
    this.pausedAt = Date.now();
    
    // Reset total paused time for new session
    this.totalPausedTime = 0;
  }

  /**
   * Resume session after activity detected
   */
  async resumeSession() {
    if (!this.isSessionPaused) {
      return;
    }

    const pausedDuration = this.pausedAt ? Date.now() - this.pausedAt : 0;
    this.totalPausedTime += pausedDuration;
    
    console.log(`▶️ Resuming session, paused for: ${Math.round(pausedDuration / 1000)}s`);
    
    this.isSessionPaused = false;
    this.pausedAt = null;
    this.lastActivityTime = Date.now();
  }

  /**
   * Get current activity state
   */
  getActivityState() {
    return {
      isUserActive: Date.now() - this.lastActivityTime < this.inactivityThreshold,
      lastActivity: new Date(this.lastActivityTime),
      inactivityDuration: Math.round((Date.now() - this.lastActivityTime) / 1000),
      isSessionPaused: this.isSessionPaused,
      pausedAt: this.pausedAt ? new Date(this.pausedAt) : null,
      totalPausedTime: this.totalPausedTime,
      autoManagementEnabled: this.autoManagementEnabled,
      inactivityThreshold: this.inactivityThreshold
    };
  }

  /**
   * Toggle auto-management of sessions
   */
  async setAutoManagement(enabled) {
    this.autoManagementEnabled = enabled;
    
    // Save setting to storage
    const settings = await this.storageManager.getSettings();
    settings.autoSessionManagement = enabled;
    await this.storageManager.saveSettings(settings);
    
    console.log('🔧 Auto-management:', enabled ? 'enabled' : 'disabled');
    
    // If disabled and session is paused, resume it
    if (!enabled && this.isSessionPaused) {
      await this.resumeSession();
    }
  }

  /**
   * Broadcast focus state changes to all listeners (single channel to prevent duplicates)
   */
  broadcastFocusStateChange(isActive, options = {}) {
    console.log(`🔄 Broadcasting focus state change: ${isActive} at ${new Date().toISOString()}`, options);
    
    // Get current blocked sites from BlockingManager
    const blockedSites = Array.from(this.blockingManager.blockedSites || new Set());
    console.log('📋 Current blocked sites in extension:', blockedSites.length);
    
    // Verify the current focus mode from BlockingManager
    const currentFocusFromBM = this.blockingManager.getFocusStats().focusMode;
    console.log('🔍 Current focus mode from BlockingManager:', currentFocusFromBM);
    
    const focusState = {
      isActive,
      isVisible: isActive,
      isFocused: isActive,
      blockedSites // Include blocked sites list
    };

    console.log('📤 Broadcasting full focus state:', focusState);

    // 1. Send to popup context (if open)
    chrome.runtime.sendMessage({
      type: 'FOCUS_STATE_CHANGED',
      payload: focusState
    }).then(() => {
      console.log('✅ FOCUS_STATE_CHANGED message sent to popup successfully');
    }).catch(() => {
      // Ignore errors when popup is not open
      console.debug('📱 Popup not open, focus state update skipped');
    });

    // 2. Send to content scripts in tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id && this.isTrackableUrl(tab.url)) {
          // Skip web app tabs if excludeWebApp option is enabled (prevents feedback loops)
          if (options.excludeWebApp && this.isWebAppUrl(tab.url)) {
            console.log('🚫 Skipping web app tab to prevent feedback loop:', tab.url);
            return;
          }
          
          chrome.tabs.sendMessage(tab.id, {
            type: 'FOCUS_STATE_CHANGED',
            payload: focusState
          }).catch(() => {
            // Ignore errors for tabs without content scripts
          });
        }
      });
    });

    // REMOVED: Direct web app forwarding to prevent duplicate session creation
    // this.forwardToWebApp('EXTENSION_FOCUS_STATE_CHANGED', focusState);
  }

  /**
   * Set up periodic cleanup for override sessions
   */
  setupPeriodicCleanup() {
    try {
      // Run cleanup immediately
      this.cleanupOldOverrideSessions();
      
      // Set up daily cleanup (24 hours)
      this.cleanupInterval = setInterval(() => {
        this.cleanupOldOverrideSessions();
      }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds
      
      console.log('✅ Periodic cleanup scheduled for override sessions');
    } catch (error) {
      console.error('❌ Error setting up periodic cleanup:', error);
    }
  }

  /**
   * Clean up old override sessions (keep last 30 days)
   */
  async cleanupOldOverrideSessions() {
    try {
      const result = await this.overrideSessionManager.cleanupOldSessions(30);
      if (result.success && result.deletedCount > 0) {
        console.log(`🧹 Cleaned up ${result.deletedCount} old override sessions`);
      }
    } catch (error) {
      console.error('❌ Error cleaning up old override sessions:', error);
    }
  }

  /**
   * Broadcast override update to popup and blocked pages
   */
  broadcastOverrideUpdate() {
    try {
      console.log('📢 Broadcasting override update to extension components');
      
      // Send message to popup if open
      chrome.runtime.sendMessage({
        type: 'OVERRIDE_DATA_UPDATED',
        payload: { timestamp: Date.now() }
      }).catch(() => {
        // Popup might not be open, ignore error
      });
      
      // Send message to all blocked pages
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.url && tab.url.includes('blocked.html')) {
            chrome.tabs.sendMessage(tab.id, {
              type: 'OVERRIDE_DATA_UPDATED',
              payload: { timestamp: Date.now() }
            }).catch(() => {
              // Tab might be closed, ignore error
            });
          }
        });
      });
      
    } catch (error) {
      console.error('❌ Error broadcasting override update:', error);
    }
  }

  /**
   * Forward messages to web app if available
   */
  forwardToWebApp(type, payload) {
    try {
      console.log('📤 Forwarding message to web app:', type);
      
      // Find the most recent/active tab running the web app
      chrome.tabs.query({ url: "*://localhost:*/*" }, (tabs) => {
        if (tabs.length > 0) {
          // Filter for likely dev server ports and get the most recently accessed
          const appTabs = tabs.filter(tab => {
            const url = new URL(tab.url);
            const port = parseInt(url.port);
            return port >= 3000 && port <= 9000; // Common dev server ports
          });
          
          if (appTabs.length > 0) {
            // Send to the first active tab only to prevent broadcast
            const targetTab = appTabs[0];
            console.log('✅ Sending to web app tab:', targetTab.url);
            
            chrome.tabs.sendMessage(targetTab.id, { type, payload })
              .then(response => {
                console.log('✅ Message delivered successfully');
              })
              .catch(error => {
                console.warn('⚠️ Message delivery failed:', error.message);
              });
          }
        }
      });
      
      // Try production domain with both HTTP and HTTPS, with and without www
      const productionUrls = [
        "https://app.make10000hours.com/*",
        "https://www.app.make10000hours.com/*",
        "http://app.make10000hours.com/*",
        "http://www.app.make10000hours.com/*"
      ];
      
      productionUrls.forEach(urlPattern => {
        chrome.tabs.query({ url: urlPattern }, (tabs) => {
          if (tabs.length > 0) {
            const targetTab = tabs[0];
            console.log('✅ Found production tab:', targetTab.url);
            chrome.tabs.sendMessage(targetTab.id, { type, payload })
              .then(response => {
                console.log('✅ Production message delivered successfully');
              })
              .catch(error => {
                console.warn('⚠️ Production message failed:', error.message);
              });
          }
        });
      });
      
    } catch (error) {
      console.error('❌ Error in forwardToWebApp:', error);
    }
  }


  /**
   * Sync blocked sites from extension back to web app
   */
  async syncBlockedSitesToWebApp() {
    try {
      console.log('🚀 syncBlockedSitesToWebApp() called - starting sync process');
      
      // Get current blocked sites from extension
      const blockedSitesArray = Array.from(this.blockingManager.blockedSites || []);
      
      console.log('🔄 Syncing blocked sites from extension to web app:', blockedSitesArray.length, 'sites:', blockedSitesArray);
      
      // Send message to web app (if it's open) - support both localhost and production
      chrome.tabs.query({ url: ['*://localhost:*/*', 'https://app.make10000hours.com/*', '*://app.make10000hours.com/*'] }, (tabs) => {
        console.log('🔍 Found tabs for sync:', tabs.length, tabs.map(t => t.url));
        
        if (tabs.length === 0) {
          console.warn('⚠️ No web app tabs found for sync');
          return;
        }
        
        tabs.forEach(tab => {
          console.log('📡 Sending sync message to tab:', tab.id, tab.url);
          chrome.tabs.sendMessage(tab.id, {
            type: 'EXTENSION_BLOCKED_SITES_UPDATED',
            payload: { sites: blockedSitesArray }
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.debug('📡 Web app not listening for extension sync:', chrome.runtime.lastError.message);
            } else {
              console.log('✅ Synced blocked sites to web app:', tab.url);
            }
          });
        });
      });
      
      // Also try to sync via runtime message (for extension-to-extension communication)
      try {
        chrome.runtime.sendMessage({
          type: 'EXTENSION_BLOCKED_SITES_UPDATED',
          payload: { sites: blockedSitesArray }
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.debug('📡 No runtime listeners for blocked sites sync');
          }
        });
      } catch (error) {
        console.debug('📡 Runtime message failed (normal if no listeners)');
      }
      
    } catch (error) {
      console.error('❌ Failed to sync blocked sites to web app:', error);
    }
  }
}

// Initialize the tracker when the service worker starts
const focusTimeTracker = new FocusTimeTracker(); 

// Add initialization state tracking
let isInitialized = false;

// Initialize as soon as possible
async function initializeExtension() {
  if (isInitialized) return;
  
  try {
    console.log('🚀 Starting extension initialization...');
console.log('📋 EXTENSION VERSION CHECK: Deep Focus handlers should be available');
console.log('📋 BUILD TIMESTAMP:', new Date().toISOString());

    // Initialize UTC coordinator first if available
    if (typeof UTCCoordinator !== 'undefined') {
      try {
        // Check if global instance already exists from utcCoordinator.js
        if (typeof globalThis.UTCCoordinator !== 'undefined' && globalThis.UTCCoordinator) {
          // Use the existing global instance
          globalThis.utcCoordinator = globalThis.UTCCoordinator;
          console.log('🔗 Using existing global UTCCoordinator instance');
        } else if (typeof globalThis.utcCoordinator === 'undefined') {
          // Create new instance if none exists
          globalThis.utcCoordinator = new UTCCoordinator();
          console.log('🆕 Created new UTCCoordinator instance');
        }
        
        await globalThis.utcCoordinator.initialize();
        console.log('🤝 UTC coordinator initialized:', globalThis.utcCoordinator.getStatus());
      } catch (error) {
        console.error('❌ UTC coordinator initialization failed:', error);
        console.log('📅 Falling back to local date strategy');
      }
    } else {
      console.log('📅 UTC coordinator not available - using local date strategy');
    }

    // Initialize the tracker when the service worker starts
    await focusTimeTracker.initialize();
    isInitialized = true;
    console.log('✅ Extension initialized successfully');
    
    // Notify any waiting content scripts
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        try {
          chrome.tabs.sendMessage(tab.id, { type: 'EXTENSION_READY' }).catch(() => {
            // Tab may not have content script, ignore error
          });
        } catch (e) {
          // Tab may not have content script, ignore
        }
      });
    });
  } catch (e) {
    console.error('❌ Failed to initialize extension:', e);
  }
}

// Handle extension lifecycle events with proper error handling
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

// Initialize immediately with proper error handling
initializeExtension().catch(error => {
  console.error('❌ Top-level initialization failed:', error);
});

// Handle external messages from web app directly (bypass content script)
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  console.log('📨 Received external message from web app:', message.type, 'from:', sender.url);
  
  if (message.type === 'SET_USER_ID' && message.source === 'web_app_direct') {
    console.log('🔍 Processing direct SET_USER_ID from web app:', message.payload);
    
    // Forward to the main message handler
    chrome.runtime.sendMessage({
      type: 'SET_USER_ID',
      payload: message.payload
    }).then(response => {
      console.log('✅ Forwarded SET_USER_ID response:', response);
      sendResponse(response);
    }).catch(error => {
      console.error('❌ Failed to forward SET_USER_ID:', error);
      console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
    });
    
    return true; // Keep message channel open for async response
  }
});

// Consolidated message handling - SINGLE LISTENER ONLY

/**
 * Timezone Manager for Extension-Web App Synchronization
 * Handles getting and caching user's timezone setting from the web app
 */
class TimezoneManager {
  constructor() {
    this.cachedTimezone = null;
    this.cacheExpiry = 0;
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
    this.fallbackTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  /**
   * Get user's timezone setting - prioritizes web app sync, then storage, then browser
   */
  async getUserTimezone() {
    try {
      // Return cached timezone if still valid
      if (this.cachedTimezone && Date.now() < this.cacheExpiry) {
        console.log('📍 Using cached timezone:', this.cachedTimezone);
        return this.cachedTimezone;
      }

      console.log('📍 Getting user timezone (prioritizing web app sync)...');
      let userTimezone = null;

      // PRIORITY 1: Check storage for timezone from web app sync
      try {
        const stored = await chrome.storage.local.get(['userTimezone', 'timezoneSource', 'timezoneLastUpdated']);
        if (stored.userTimezone && stored.timezoneSource === 'web_app_sync') {
          // Check if sync data is recent (within 24 hours)
          const isRecent = stored.timezoneLastUpdated && 
                          (Date.now() - stored.timezoneLastUpdated) < (24 * 60 * 60 * 1000);
          
          if (isRecent) {
            userTimezone = stored.userTimezone;
            console.log('✅ Using timezone from web app sync:', userTimezone);
          } else {
            console.log('⚠️ Stored timezone from web app sync is old, will try other methods');
          }
        }
      } catch (storageError) {
        console.warn('⚠️ Failed to get stored timezone:', storageError);
      }

      // PRIORITY 2: Try requesting from web app tabs (fallback)
      if (!userTimezone) {
        console.log('📡 Requesting user timezone from web app tabs...');
        
        const tabs = await new Promise(resolve => {
          chrome.tabs.query({}, resolve);
        });

        // Look for web app tabs and request timezone
        for (const tab of tabs) {
          if (tab.url && (tab.url.includes('localhost') || tab.url.includes('make10000hours.com') || tab.url.includes('make10000hours'))) {
            try {
              console.log('📡 Found web app tab, requesting timezone from:', tab.url);
              
              const response = await new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => reject(new Error('Timeout')), 5000);
                
                chrome.tabs.sendMessage(tab.id, {
                  action: 'getUserTimezoneSetting'
                }, (response) => {
                  clearTimeout(timeoutId);
                  if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                  } else {
                    resolve(response);
                  }
                });
              });

              if (response?.success && response.data) {
                userTimezone = response.data;
                console.log('✅ Got timezone from web app tab:', userTimezone);
                break; // Found valid timezone, stop searching
              }
            } catch (error) {
              console.log('⚠️ Failed to get timezone from tab:', tab.url, error.message);
              // Continue to next tab
            }
          }
        }
      }

      // PRIORITY 3: Check any stored timezone (backup)
      if (!userTimezone) {
        try {
          const stored = await chrome.storage.local.get(['userTimezone', 'timezoneSource']);
          if (stored.userTimezone) {
            userTimezone = stored.userTimezone;
            console.log('📦 Using stored timezone:', userTimezone, `(source: ${stored.timezoneSource || 'unknown'})`);
          } else {
            console.log('📦 No timezone found in local storage, will use browser fallback');
          }
        } catch (storageError) {
          console.error('❌ Failed to get any stored timezone:', storageError);
          console.log('📦 Storage error, will use browser fallback');
        }
      }

      // PRIORITY 4: Browser fallback
      if (!userTimezone) {
        userTimezone = this.fallbackTimezone;
        console.log('📍 Using browser fallback timezone:', userTimezone);
        
        // Store browser timezone as fallback so we don't keep requesting
        await chrome.storage.local.set({
          userTimezone: userTimezone,
          timezoneLastUpdated: Date.now(),
          timezoneSource: 'browser_fallback'
        });
        console.log('💾 Stored browser timezone as fallback in local storage');
      }

      // Cache the result
      this.cachedTimezone = userTimezone;
      this.cacheExpiry = Date.now() + this.cacheTTL;

      // Store result if it came from tab request (don't overwrite web app sync)
      if (userTimezone && userTimezone === this.fallbackTimezone) {
        // Already stored above in browser fallback case
      } else if (userTimezone) {
        const stored = await chrome.storage.local.get(['timezoneSource']);
        if (stored.timezoneSource !== 'web_app_sync') {
          await chrome.storage.local.set({
            userTimezone: userTimezone,
            timezoneLastUpdated: Date.now(),
            timezoneSource: 'tab_request'
          });
        }
      }

      return userTimezone;

    } catch (error) {
      console.error('❌ TimezoneManager: Failed to get user timezone:', error);
      
      // Ultimate fallback
      console.log('📍 Using ultimate fallback timezone:', this.fallbackTimezone);
      return this.fallbackTimezone;
    }
  }

  /**
   * Clear timezone cache (useful when user changes timezone)
   */
  clearCache() {
    console.log('🗑️ Clearing timezone cache');
    this.cachedTimezone = null;
    this.cacheExpiry = 0;
  }

  /**
   * Get timezone for UTC conversion operations
   * This is the main method other parts of extension should use
   */
  async getEffectiveTimezone() {
    return await this.getUserTimezone();
  }
}

// Create global timezone manager instance
const timezoneManager = new TimezoneManager();

/**
 * Migration utility: Convert local-date storage keys to UTC-date keys
 */
async function migrateStorageKeysToUTC() {
  try {
    const migrationKey = 'storageKeysMigrated_v2';
    const migrationStatus = await chrome.storage.local.get([migrationKey]);
    
    if (migrationStatus[migrationKey]) {
      console.log('✅ Storage keys already migrated to UTC');
      return;
    }
    
    console.log('🔄 Starting storage key migration to UTC...');
    const allStorage = await chrome.storage.local.get(null);
    const migrationsNeeded = [];
    
    // Find old local-date-based keys (format: YYYY-MM-DD with array of sessions)
    Object.keys(allStorage).forEach(key => {
      if (key.match(/^\d{4}-\d{2}-\d{2}$/) && Array.isArray(allStorage[key])) {
        const sessions = allStorage[key];
        console.log(`📝 Found legacy storage key: ${key} with ${sessions.length} sessions`);
        
        // Group sessions by their actual UTC date
        const sessionsByUTCDate = {};
        sessions.forEach(session => {
          // Calculate UTC date from session timestamp
          let utcDate;
          if (session.startTimeUTC) {
            // Already has UTC timestamp
            utcDate = session.startTimeUTC.split('T')[0];
          } else if (session.startTime) {
            // Convert local timestamp to UTC date
            utcDate = new Date(session.startTime).toISOString().split('T')[0];
          } else {
            // Fallback to key date
            utcDate = key;
          }
          
          // Ensure session has timezone info
          if (!session.timezone) {
            session.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          }
          if (!session.startTimeUTC && session.startTime) {
            session.startTimeUTC = new Date(session.startTime).toISOString();
          }
          if (!session.utcDate) {
            session.utcDate = utcDate;
          }
          
          if (!sessionsByUTCDate[utcDate]) {
            sessionsByUTCDate[utcDate] = [];
          }
          sessionsByUTCDate[utcDate].push(session);
        });
        
        migrationsNeeded.push({
          oldKey: key,
          newKeys: sessionsByUTCDate
        });
      }
    });
    
    // Apply migrations
    for (const migration of migrationsNeeded) {
      console.log(`🔄 Migrating ${migration.oldKey}...`);
      
      // Add sessions to UTC-date-based keys
      for (const [utcDate, sessions] of Object.entries(migration.newKeys)) {
        const existingSessions = allStorage[utcDate] || [];
        const mergedSessions = [...existingSessions, ...sessions];
        
        // Remove duplicates by session ID
        const uniqueSessions = mergedSessions.filter((session, index, arr) => 
          arr.findIndex(s => s.id === session.id) === index
        );
        
        await chrome.storage.local.set({
          [utcDate]: uniqueSessions
        });
        
        console.log(`✅ Migrated ${sessions.length} sessions to UTC date: ${utcDate}`);
      }
      
      // Remove old key
      await chrome.storage.local.remove(migration.oldKey);
      console.log(`🗑️ Removed legacy key: ${migration.oldKey}`);
    }
    
    // Mark migration as completed
    await chrome.storage.local.set({ [migrationKey]: true });
    
    if (migrationsNeeded.length > 0) {
      console.log('✅ Storage key migration completed:', migrationsNeeded.length, 'keys migrated');
    } else {
      console.log('ℹ️ No legacy storage keys found to migrate');
    }
  } catch (error) {
    console.error('❌ Storage key migration failed:', error);
  }
}

// Run migration on extension startup
chrome.runtime.onStartup.addListener(migrateStorageKeysToUTC);
chrome.runtime.onInstalled.addListener((details) => {
  console.log('🚀 Extension installed/updated:', details.reason);
  migrateStorageKeysToUTC();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Received message:', message.type, 'from:', sender.tab?.url || 'popup');
  console.log('🔍 DEBUG: Extension background script is running and receiving messages');
  
  // Always respond to PING messages immediately
  if (message.type === 'PING') {
    console.log('📤 [BACKGROUND] Sending PING response'); sendResponse({ success: true, initialized: isInitialized });
    return false; // Don't keep channel open for sync response
  }
  
  // Handle health check messages immediately
  if (message.type === 'EXTENSION_HEALTH_CHECK') {
    sendResponse({
      type: 'EXTENSION_HEALTH_RESPONSE',
      status: 'ok',
      timestamp: Date.now(),
      initialized: isInitialized
    });
    return false; // Don't keep channel open for sync response
  }

  // Handle UTC coordination messages immediately
  if (message.type === 'UTC_STATUS_QUERY') {
    const utcStatus = {
      utcEnabled: UTCCoordinator?.isReady() || false,
      mode: UTCCoordinator?.getStatus()?.mode || 'local',
      timezone: UTCCoordinator?.getStatus()?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      initialized: UTCCoordinator?.isReady() || false
    };
    console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, data: utcStatus });
    return false;
  }

  if (message.type === 'UTC_COORDINATOR_INIT') {
    // Handle initialization from web app
    if (globalThis.utcCoordinator && message.data) {
      if (message.data.utcEnabled) {
        globalThis.utcCoordinator.enableUTCMode(message.data.userTimezone).then(() => {
          console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, message: 'UTC mode enabled' });
        }).catch(error => {
          console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
        });
      } else {
        globalThis.utcCoordinator.enableLocalMode().then(() => {
          console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, message: 'Local mode enabled' });
        }).catch(error => {
          console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
        });
      }
      return true; // Keep channel open for async response
    }
    console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: 'UTC Coordinator not available' });
    return false;
  }

  if (message.type === 'TIMEZONE_CHANGE_COORDINATION') {
    // Handle timezone change from web app
    if (globalThis.utcCoordinator && message.data) {
      globalThis.utcCoordinator.handleTimezoneChange(
        message.data.oldTimezone, 
        message.data.newTimezone
      ).then(() => {
        console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: true, message: 'Timezone change handled' });
      }).catch(error => {
        console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
      });
      return true; // Keep channel open for async response
    }
    console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: 'UTC Coordinator not available' });
    return false;
  }

  if (message.type === 'UTC_DATA_SYNC_REQUEST') {
    // Handle data sync request from web app
    if (globalThis.utcCoordinator && message.data) {
      globalThis.utcCoordinator.getRecentDataForSync().then(recentData => {
        console.log('📤 [BACKGROUND] Sending response'); sendResponse({ 
          success: true, 
          data: { 
            extensionData: recentData,
            mode: globalThis.utcCoordinator.getStatus().mode,
            timezone: globalThis.utcCoordinator.getStatus().timezone
          }
        });
      }).catch(error => {
        console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
      });
      return true; // Keep channel open for async response
    }
    console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: 'UTC Coordinator not available' });
    return false;
  }
  
  // For other messages, ensure we're initialized
  if (!isInitialized) {
    console.log('⚠️ Extension not initialized, initializing now...');
    initializeExtension().then(() => {
      if (focusTimeTracker && focusTimeTracker.handleMessage) {
        try {
          focusTimeTracker.handleMessage(message, sender, sendResponse);
        } catch (error) {
          console.error('❌ Error in delayed message handler:', error);
          console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: 'Message handler error' });
        }
      } else {
        console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: 'Extension initialization failed' });
      }
    }).catch(error => {
      console.error('❌ Extension initialization error:', error);
      console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: 'Extension initialization failed' });
    });
    return true; // Keep channel open for async response
  }
  
  // Route messages to the FocusTimeTracker instance
  if (focusTimeTracker && focusTimeTracker.handleMessage) {
    try {
      const result = focusTimeTracker.handleMessage(message, sender, sendResponse);
      // If handler returns a promise, handle it properly
      if (result && typeof result.then === 'function') {
        result.catch(error => {
          console.error('❌ Async message handler error:', error);
          try {
            console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
          } catch (e) {
            console.error('❌ Failed to send error response:', e);
          }
        });
      }
      return true; // Keep channel open for async handlers
    } catch (error) {
      console.error('❌ Message handler error:', error);
      console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: error.message });
      return false; // Don't keep channel open for sync errors
    }
  }
  
  console.warn('⚠️ FocusTimeTracker not available, message ignored:', message.type);
  console.log('📤 [BACKGROUND] Sending response'); sendResponse({ success: false, error: 'Extension not properly initialized' });
  return false; // Don't keep channel open for sync errors
});