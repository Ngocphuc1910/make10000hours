/**
 * Background Service Worker for Focus Time Tracker Extension
 * Handles time tracking, tab management, and extension coordination
 */

// Load timezone-safe date utilities
// importScripts('./utils/dateUtils.js'); // Commented out for service worker compatibility

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
      
      // Ensure storage is initialized
      const storage = await chrome.storage.local.get(['settings', 'stats']);
      if (!storage.settings) {
        await this.saveSettings(this.getDefaultSettings());
      }
      if (!storage.stats) {
        const today = DateUtils.getLocalDateString();
        await chrome.storage.local.set({ 
          stats: {
            [today]: {
              totalTime: 0,
              sitesVisited: 0,
              productivityScore: 0,
              sites: {}
            }
          }
        });
      }
      
      this.initialized = true;
      console.log('✅ Storage Manager initialized');
      
      // Sync with state manager if available
      if (this.stateManager?.isInitialized) {
        const state = this.stateManager.getState();
        if (state.todayStats) {
          // Update state with storage stats
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

  async saveTimeEntry(domain, timeSpent, visits = 1) {
    try {
      const today = DateUtils.getLocalDateString();
      const storage = await chrome.storage.local.get(['stats']);
      
      // Initialize today's stats if not exists
      if (!storage.stats || !storage.stats[today]) {
        storage.stats = {
          ...storage.stats,
          [today]: {
            totalTime: 0,
            sitesVisited: 0,
            productivityScore: 0,
            sites: {}
          }
        };
      }

      const stats = storage.stats[today];

      // Update domain stats
      if (!stats.sites[domain]) {
        stats.sites[domain] = {
          timeSpent: 0,
          visits: 0
        };
      }

      stats.sites[domain].timeSpent += timeSpent;
      stats.sites[domain].visits += visits;

      // Update total stats
      stats.totalTime = (stats.totalTime || 0) + timeSpent;
      stats.sitesVisited = Object.keys(stats.sites).length;

      // Calculate productivity score
      const productiveTime = Object.values(stats.sites)
        .reduce((total, site) => total + (site.timeSpent || 0), 0);
      stats.productivityScore = Math.min(
        Math.round((productiveTime / (6 * 60 * 60 * 1000)) * 100),
        100
      );

      // Save updated stats
      await chrome.storage.local.set({
        stats: {
          ...storage.stats,
          [today]: stats
        }
      });

      // Notify any open popups
      try {
        const message = {
          type: 'STATS_UPDATED',
          payload: stats
        };
        await chrome.runtime.sendMessage(message);
      } catch (error) {
        // Popup might not be open, ignore error
      }

      return stats;
    } catch (error) {
      console.error('Error saving time entry:', error);
      throw error;
    }
  }

  async getTodayStats() {
    const today = DateUtils.getLocalDateString();
    console.log('📅 Getting stats for date (local):', today);
    
    try {
      const storage = await chrome.storage.local.get(['stats']);
      const todayStats = storage.stats?.[today] || {
        totalTime: 0,
        sitesVisited: 0,
        productivityScore: 0,
        sites: {}
      };
      
      console.log('📊 Today stats result:', todayStats);
      return todayStats;
    } catch (error) {
      console.error('❌ Error in getTodayStats:', error);
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
      const storage = await chrome.storage.local.get(['stats']);
      const allStats = storage.stats || {};
      const result = {};
      
      // Filter stats by date range
      Object.keys(allStats).forEach(date => {
        if (date >= startDate && date <= endDate) {
          result[date] = allStats[date];
        }
      });
      
      return result;
    } catch (error) {
      console.error('Failed to get time data:', error);
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
    
    const storedStats = await this.getTodayStats();
    console.log('🔍 DEBUG: storedStats from getTodayStats:', storedStats);
    
    // Clone stored stats to avoid mutation
    const realTimeStats = {
      totalTime: storedStats?.totalTime || 0,
      sitesVisited: storedStats?.sitesVisited || 0,
      sites: { ...(storedStats?.sites || {}) }
    };
    
    console.log('🔍 DEBUG: Initial realTimeStats:', realTimeStats);
    console.log('🔍 DEBUG: focusTimeTracker reference:', !!this.focusTimeTracker);
    
    // Add current session time if actively tracking and we have tracker reference
    if (this.focusTimeTracker && this.focusTimeTracker.currentSession) {
      const currentSession = this.focusTimeTracker.currentSession;
      console.log('🔍 DEBUG: Current session found:', currentSession);
      
      if (currentSession.isActive && currentSession.domain && currentSession.startTime) {
        const currentTime = Date.now();
        const sessionTime = currentTime - currentSession.startTime;
        
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
      }
    } else {
      console.log('🔍 DEBUG: No active session or focusTimeTracker not set');
    }
    
    console.log('🔍 DEBUG: Final realTimeStats:', realTimeStats);
    return realTimeStats;
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
   * Create a new deep focus session
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
      const today = DateUtils.getLocalDateString();
      const sessionId = this.generateSessionId();
      
      const newSession = {
        id: sessionId,
        userId: actualUserId,
        startTime: now.getTime(),
        duration: 0,
        status: 'active',
        createdAt: now.getTime(),
        updatedAt: now.getTime()
      };

      // Get storage and add session
      const storage = await this.getDeepFocusStorage();
      if (!storage[today]) {
        storage[today] = [];
      }
      storage[today].push(newSession);
      await this.saveDeepFocusStorage(storage);
      
      console.log('✅ Created local deep focus session:', sessionId, 'Total sessions today:', storage[today].length);
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
      const today = DateUtils.getLocalDateString();

      console.log('⏱️ Updating session duration:', sessionId, 'to', duration, 'minutes');

      // Get storage and find session
      const storage = await this.getDeepFocusStorage();
      if (storage[today]) {
        const sessionIndex = storage[today].findIndex(s => s.id === sessionId);
        if (sessionIndex !== -1) {
          storage[today][sessionIndex].duration = duration;
          storage[today][sessionIndex].updatedAt = now.getTime();
          await this.saveDeepFocusStorage(storage);
          console.log('✅ Updated local session duration:', sessionId, duration, 'minutes');
          
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
      } else {
        console.warn('⚠️ No sessions found for today during duration update');
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
      const today = DateUtils.getLocalDateString();

      console.log('🏁 Completing deep focus session:', sessionId);

      // Get storage and find session
      const storage = await this.getDeepFocusStorage();
      if (storage[today]) {
        const sessionIndex = storage[today].findIndex(s => s.id === sessionId);
        if (sessionIndex !== -1) {
          storage[today][sessionIndex].status = 'completed';
          storage[today][sessionIndex].endTime = now.getTime();
          storage[today][sessionIndex].updatedAt = now.getTime();
          await this.saveDeepFocusStorage(storage);
          console.log('✅ Completed local deep focus session:', sessionId);
          
          // Get total minutes and emit event
          const totalMinutes = await this.getTodayDeepFocusTime();
          await ExtensionEventBus.emit(
            ExtensionEventBus.EVENTS.DEEP_FOCUS_UPDATE,
            { minutes: totalMinutes }
          );
        } else {
          console.warn('⚠️ Session not found for completion:', sessionId);
        }
      } else {
        console.warn('⚠️ No sessions found for today during completion');
      }
    } catch (error) {
      console.error('❌ Failed to complete session:', error);
      throw error;
    }
  }

  /**
   * Get deep focus sessions for a specific date
   */
  async getDeepFocusSessionsForDate(date) {
    try {
      const dateStr = typeof date === 'string' ? date : DateUtils.getLocalDateStringFromDate(date);
      const storage = await this.getDeepFocusStorage();
      const sessions = storage[dateStr] || [];
      
      console.log('📖 Retrieved local sessions for', dateStr, ':', sessions.length, 'sessions');
      return sessions;
    } catch (error) {
      console.error('❌ Failed to get sessions for date:', error);
      return [];
    }
  }

  /**
   * Get today's deep focus sessions
   */
  async getTodayDeepFocusSessions() {
    const today = new Date();
    return this.getDeepFocusSessionsForDate(today);
  }

  /**
   * Get deep focus sessions for a date range
   */
  async getDeepFocusSessionsForDateRange(startDate, endDate) {
    try {
      const storage = await this.getDeepFocusStorage();
      const sessions = [];
      
      // Convert dates to local date strings
      const startStr = typeof startDate === 'string' ? startDate : DateUtils.getLocalDateStringFromDate(new Date(startDate));
      const endStr = typeof endDate === 'string' ? endDate : DateUtils.getLocalDateStringFromDate(new Date(endDate));
      
      // Iterate through all dates in range
      const currentDate = new Date(startStr);
      const endDateObj = new Date(endStr);
      
      while (currentDate <= endDateObj) {
        const dateStr = DateUtils.getLocalDateStringFromDate(currentDate);
        if (storage[dateStr]) {
          sessions.push(...storage[dateStr]);
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Sort by creation time (newest first)
      sessions.sort((a, b) => b.createdAt - a.createdAt);
      
      console.log('📖 Retrieved sessions for date range', startStr, 'to', endStr, ':', sessions.length, 'sessions');
      return sessions;
    } catch (error) {
      console.error('❌ Failed to get sessions for date range:', error);
      return [];
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
    
    // Focus state tracking
    this.latestFocusState = false;
    
    // User authentication state
    this.currentUserId = null;
    this.userInfo = null;
    
    
    this.initialize();
  }

  async recoverState() {
    if (!this.stateManager?.isInitialized) {
      console.warn('⚠️ Attempting state recovery...');
      this.stateManager = new StateManager();
      await this.stateManager.initialize();
      
      // Notify other managers of recovery
      if (this.storageManager) {
        this.storageManager.setStateManager(this.stateManager);
      }
      console.log('✅ State recovered successfully');
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
    // Tab events
    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.handleTabActivated(activeInfo);
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdated(tabId, changeInfo, tab);
    });

    chrome.tabs.onRemoved.addListener((tabId) => {
      this.handleTabRemoved(tabId);
    });

    // Window events
    chrome.windows.onFocusChanged.addListener((windowId) => {
      this.handleWindowFocusChanged(windowId);
    });

    // Navigation events for URL caching
    chrome.webNavigation.onBeforeNavigate.addListener((details) => {
      if (details.frameId === 0) { // Main frame only
        this.blockingManager.cacheUrl(details.tabId, details.url);
      }
    });

    // Message handling is now handled by the global listener
    // No need for duplicate listener here

    // External message handling from web apps (externally_connectable domains)
    chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
      console.log('📨 External message received from:', sender.origin);
      if (focusTimeTracker && focusTimeTracker.handleMessage) {
        focusTimeTracker.handleMessage(message, sender, sendResponse);
      } else {
        console.error('❌ focusTimeTracker not available for external message');
        sendResponse({ success: false, error: 'Extension not initialized' });
      }
      return true; // Keep message channel open for async responses
    });

    // Timestamp-based sleep detection (more reliable than Chrome idle API)
    this.lastHeartbeat = Date.now();
    this.sleepDetectionInterval = setInterval(() => {
      this.checkForSleep();
    }, 10000); // Check every 10 seconds

    // Set up periodic save every 5 seconds
    this.saveInterval = setInterval(() => {
      if (this.currentSession.isActive) {
        this.saveCurrentSession();
      }
    }, 5000); // Save every 5 seconds for more frequent updates
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
          sendResponse({ success: false, error: 'Firebase integration removed' });
          return true;

        case 'SET_FIREBASE_CONFIG':
          // Firebase removed for Chrome Web Store compliance  
          sendResponse({ success: false, error: 'Firebase integration removed' });
          return true;

        case 'GET_CURRENT_STATE':
          const currentState = await this.getCurrentState();
          const focusStats = this.blockingManager.getFocusStats(); // Add focus stats
          sendResponse({ 
            success: true, 
            data: { ...currentState, focusStats } 
          });
          break;

        case 'GET_TODAY_STATS':
          const stats = await this.storageManager.getTodayStats();
          sendResponse({ success: true, data: stats });
          break;

        case 'GET_REALTIME_STATS':
          console.log('📊 Processing GET_REALTIME_STATS request...');
          const realTimeStats = await this.storageManager.getRealTimeStatsWithSession();
          console.log('📊 Retrieved real-time stats:', realTimeStats);
          sendResponse({ success: true, data: realTimeStats });
          break;

        case 'DEBUG_STORAGE':
          console.log('🔍 Debug storage request received');
          try {
            // Get all storage data
            const allData = await chrome.storage.local.get(null);
            console.log('🔍 All storage data:', allData);
            sendResponse({ success: true, data: allData });
          } catch (error) {
            console.error('❌ Debug storage error:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_TIME_DATA_RANGE':
          try {
            const { startDate, endDate } = message.payload;
            const timeData = await this.storageManager.getTimeData(startDate, endDate);
            sendResponse({ success: true, data: timeData });
          } catch (error) {
            console.error('Error getting time data range:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_SETTINGS':
          const settings = await this.storageManager.getSettings();
          sendResponse({ success: true, data: settings });
          break;

        case 'GET_TOP_SITES':
          const topSites = await this.storageManager.getTopSites(message.payload?.limit || 5);
          sendResponse({ success: true, data: topSites });
          break;

        case 'GET_REALTIME_TOP_SITES':
          try {
            const realTimeTopSites = await this.storageManager.getRealTimeTopSites(message.payload?.limit || 20);
            sendResponse({ success: true, data: realTimeTopSites });
          } catch (error) {
            console.error('❌ Error in GET_REALTIME_TOP_SITES:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_LOCAL_DEEP_FOCUS_TIME':
          try {
            const localDeepFocusTime = await this.storageManager.getTodayDeepFocusTime();
            sendResponse({ success: true, data: { minutes: localDeepFocusTime } });
          } catch (error) {
            console.error('Error getting local deep focus time:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'EXPORT_DATA':
          const exportResult = await this.exportData(message.payload?.format || 'json');
          sendResponse(exportResult);
          break;

        case 'ACTIVITY_DETECTED':
          await this.handleActivityDetected(sender.tab?.id);
          sendResponse({ success: true });
          break;

        case 'ENHANCED_ACTIVITY_DETECTED':
          await this.handleEnhancedActivityDetected(message.payload);
          sendResponse({ success: true });
          break;

        case 'ACTIVITY_HEARTBEAT':
          this.updateActivity(message.payload);
          sendResponse({ success: true });
          break;

        case 'GET_ACTIVITY_STATE':
          const activityState = this.getActivityState();
          sendResponse({ success: true, data: activityState });
          break;

        case 'TOGGLE_AUTO_MANAGEMENT':
          const enabled = message.payload?.enabled ?? true;
          await this.setAutoManagement(enabled);
          sendResponse({ success: true, enabled });
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
                
                sendResponse({ 
                  success: true, 
                  focusMode: newFocusMode,
                  previousMode: currentFocusMode
                });
              } else {
                throw new Error(updateResult.error || 'Failed to update focus mode');
              }
            } else {
              console.log('🔄 Focus mode already in correct state:', newFocusMode);
              sendResponse({ 
                success: true, 
                focusMode: newFocusMode,
                noChange: true
              });
            }
          } catch (error) {
            console.error('❌ Error processing web app focus state change:', error);
            sendResponse({ 
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
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'BLOCK_MULTIPLE_SITES':
          try {
            const domains = message.payload?.domains || [];
            if (!Array.isArray(domains) || domains.length === 0) {
              sendResponse({ success: false, error: 'Invalid domains array' });
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
            sendResponse({ 
              success: true, 
              results,
              summary: { successCount, failureCount, total: domains.length }
            });
          } catch (error) {
            console.error('❌ Batch blocking failed:', error);
            sendResponse({ success: false, error: error.message });
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
            sendResponse({ success: false, error: error.message });
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
                sendResponse({ ...blockResult, domain: currentDomain });
              } else {
                sendResponse({ success: false, error: 'Current site cannot be blocked' });
              }
            } else {
              sendResponse({ success: false, error: 'No active tab found' });
            }
          } catch (error) {
            sendResponse({ success: false, error: 'Failed to get current tab: ' + error.message });
          }
          break;

        case 'GET_BLOCKED_SITES':
          const blockedSites = Array.from(this.blockingManager.blockedSites);
          sendResponse({ success: true, data: blockedSites });
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
            sendResponse({ 
              success: true, 
              synced: successCount,
              failed: failureCount 
            });
          } catch (error) {
            console.error('❌ Failed to sync blocked sites from web app:', error);
            sendResponse({ success: false, error: error.message });
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
              sendResponse({ success: true });
            } else {
              sendResponse({ success: false, error: 'Invalid blocked sites array' });
            }
          } catch (error) {
            console.error('❌ Failed to update settings from web app:', error);
            sendResponse({ success: false, error: error.message });
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
          sendResponse({ success: true, data: focusStatsOnly });
          break;

        case 'RECORD_BLOCKED_ATTEMPT':
          this.blockingManager.recordBlockedAttempt(message.payload?.domain);
          sendResponse({ success: true });
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
            sendResponse({ success: true, message: 'Extension cleared and ready for sync' });
          } catch (error) {
            console.error('❌ Failed to force sync from web app:', error);
            sendResponse({ success: false, error: error.message });
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
              lastUpdated: Date.now()
            };
            
            // Persist user info to storage
            if (this.storageManager) {
              // Save to storage manager
              await this.storageManager.saveSettings({
                userId: this.currentUserId,
                userEmail: message.payload?.userEmail,
                displayName: message.payload?.displayName,
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
            
            sendResponse({ success: true, userId: this.currentUserId });
          } catch (error) {
            console.error('❌ DEBUG: Error setting user ID:', error);
            sendResponse({ success: false, error: error.message });
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
              sendResponse({ 
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
            
            sendResponse({ 
              success: true, 
              payload: enhancedPayload,
              localStorage: localSaveResult
            });
          } catch (error) {
            console.error('❌ Error recording override session:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_SESSION_TIME':
          const sessionTime = this.blockingManager.focusStartTime 
            ? Date.now() - this.blockingManager.focusStartTime 
            : 0;
          sendResponse({ success: true, data: { sessionTime } });
          break;

        case 'GET_DEBUG_INFO':
          const debugInfo = this.blockingManager.getDebugInfo(message.payload?.domain);
          sendResponse({ success: true, data: debugInfo });
          break;

        case 'GET_CACHED_URL':
          const cachedUrl = this.blockingManager.getCachedUrl(sender.tab?.id);
          sendResponse({ success: true, data: { url: cachedUrl } });
          break;

        case 'CLEAR_CACHED_URL':
          this.blockingManager.clearCachedUrl(sender.tab?.id);
          sendResponse({ success: true });
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
            sendResponse({ success: true, data: analyticsData });
          } catch (error) {
            console.error('Error getting analytics data:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_PRODUCTIVITY_GOALS':
          try {
            const goals = await this.storageManager.getProductivityGoals();
            sendResponse({ success: true, data: goals });
          } catch (error) {
            console.error('Error getting productivity goals:', error);
            sendResponse({ success: false, error: error.message });
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
            sendResponse({ success: false, error: error.message });
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
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_SITE_CATEGORY':
          try {
            const category = this.storageManager.getSiteCategory(message.payload?.domain);
            sendResponse({ success: true, data: { category } });
          } catch (error) {
            console.error('Error getting site category:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_CATEGORY_BREAKDOWN':
          try {
            const analyticsData = await this.storageManager.getAnalyticsData('week');
            sendResponse({ 
              success: true, 
              data: { 
                categories: analyticsData.categoryBreakdown,
                totalTime: analyticsData.summary.totalTime
              }
            });
          } catch (error) {
            console.error('Error getting category breakdown:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_WEEKLY_STATS':
          try {
            const weeklyData = await this.storageManager.getAnalyticsData('week');
            sendResponse({ success: true, data: weeklyData });
          } catch (error) {
            console.error('Error getting weekly stats:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_MONTHLY_STATS':
          try {
            const monthlyData = await this.storageManager.getAnalyticsData('month');
            sendResponse({ success: true, data: monthlyData });
          } catch (error) {
            console.error('Error getting monthly stats:', error);
            sendResponse({ success: false, error: error.message });
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
            sendResponse({ success: true, data: { focusMode: true } });
          } catch (error) {
            console.error('Error enabling focus mode:', error);
            sendResponse({ success: false, error: error.message });
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
            sendResponse({ success: true, data: { focusMode: false } });
          } catch (error) {
            console.error('Error disabling focus mode:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_LOCAL_OVERRIDE_TIME':
          try {
            const overrideTimeResult = await this.overrideSessionManager.calculateTodayOverrideTime();
            sendResponse({ 
              success: true, 
              data: { 
                overrideTime: overrideTimeResult.minutes,
                sessions: overrideTimeResult.sessions || 0
              }
            });
          } catch (error) {
            console.error('Error getting local override time:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_LOCAL_OVERRIDE_SESSIONS':
          try {
            const sessionsResult = await this.overrideSessionManager.getTodayOverrideSessions();
            sendResponse({ 
              success: true, 
              data: { 
                sessions: sessionsResult.sessions,
                date: sessionsResult.date
              }
            });
          } catch (error) {
            console.error('Error getting local override sessions:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'CLEANUP_OLD_OVERRIDE_SESSIONS':
          try {
            const daysToKeep = message.payload?.daysToKeep || 30;
            const result = await this.overrideSessionManager.cleanupOldSessions(daysToKeep);
            sendResponse({ 
              success: true, 
              data: { 
                deletedCount: result.deletedCount
              }
            });
          } catch (error) {
            console.error('Error cleaning up old override sessions:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'CLEAR_ALL_OVERRIDE_SESSIONS':
          try {
            const result = await this.overrideSessionManager.clearAllSessions();
            sendResponse({ 
              success: true, 
              data: { cleared: result.success }
            });
          } catch (error) {
            console.error('Error clearing all override sessions:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_OVERRIDE_DEBUG_INFO':
          try {
            const debugInfo = await this.overrideSessionManager.getDebugInfo();
            sendResponse({ 
              success: true, 
              data: debugInfo.debug
            });
          } catch (error) {
            console.error('Error getting override debug info:', error);
            sendResponse({ success: false, error: error.message });
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
            sendResponse({ success: true, data: { focusMode: this.blockingManager.focusMode } });
          } catch (error) {
            console.error('Error getting focus status:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;


        case 'PING':
          // Health check ping from content scripts
          sendResponse({ 
            success: true, 
            timestamp: Date.now(),
            extensionId: chrome.runtime.id 
          });
          break;

        // Deep Focus session data retrieval handlers
        case 'GET_DEEP_FOCUS_SESSIONS_DATE_RANGE':
          try {
            const { startDate, endDate } = message.payload || {};
            const sessions = await this.storageManager.getDeepFocusSessionsForDateRange(startDate, endDate);
            sendResponse({ success: true, data: sessions });
          } catch (error) {
            console.error('Error getting deep focus sessions for date range:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_TODAY_DEEP_FOCUS_SESSIONS':
          try {
            const todaySessions = await this.storageManager.getTodayDeepFocusSessions();
            sendResponse({ success: true, data: todaySessions });
          } catch (error) {
            console.error('Error getting today deep focus sessions:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_ACTIVE_DEEP_FOCUS_SESSION':
          try {
            const activeSession = await this.storageManager.getActiveDeepFocusSession();
            sendResponse({ success: true, data: activeSession });
          } catch (error) {
            console.error('Error getting active deep focus session:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_ALL_DEEP_FOCUS_SESSIONS':
          try {
            const allSessions = await this.storageManager.getAllDeepFocusSessions();
            sendResponse({ success: true, data: allSessions });
          } catch (error) {
            console.error('Error getting all deep focus sessions:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_RECENT_7_DAYS_DEEP_FOCUS_SESSIONS':
          try {
            const recent7DaysSessions = await this.storageManager.getRecent7DaysDeepFocusSessions();
            sendResponse({ success: true, data: recent7DaysSessions });
          } catch (error) {
            console.error('Error getting recent 7 days deep focus sessions:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_LAST_10_DEEP_FOCUS_SESSIONS':
          try {
            const last10Sessions = await this.storageManager.getLast10DeepFocusSessions();
            sendResponse({ success: true, data: last10Sessions });
          } catch (error) {
            console.error('Error getting last 10 deep focus sessions:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        default:
          console.warn('❓ Unknown message type:', type);
          console.log('🔍 DEBUG: Full message object:', message);
          console.log('🔍 DEBUG: Available message types should include GET_TODAY_DEEP_FOCUS_SESSIONS');
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('❌ Error handling message:', error);
      sendResponse({ success: false, error: error.message });
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
      console.log('🎯 startTracking called with tab:', { id: tab.id, url: tab.url });
      
      if (!tab || !tab.url || !this.isTrackableUrl(tab.url)) {
        console.log('⚠️ Tab not trackable:', { 
          hasTab: !!tab, 
          hasUrl: !!tab?.url, 
          isTrackable: tab?.url ? this.isTrackableUrl(tab.url) : false 
        });
        return;
      }

      const domain = this.extractDomain(tab.url);
      const now = Date.now();
      
      // Update heartbeat for user activity
      this.lastHeartbeat = now;

      // Check if we have a paused session for the same domain
      if (!this.currentSession.isActive && this.currentSession.domain === domain) {
        // Resume paused session
        console.log('🔄 Resuming paused session for domain:', domain);
        this.currentSession.tabId = tab.id;
        this.currentSession.startTime = now;
        this.currentSession.isActive = true;
        console.log(`▶️ Resumed tracking: ${domain}, Tab ID: ${tab.id}`);
        return;
      }

      // Save current session if exists and different domain
      if (this.currentSession.isActive) {
        await this.stopCurrentTracking();
      }

      console.log('✨ Starting new tracking session for domain:', domain);

      this.currentSession = {
        tabId: tab.id,
        domain: domain,
        startTime: now,
        savedTime: 0,
        isActive: true
      };

      await this.stateManager.dispatch({
        type: 'START_TRACKING',
        payload: {
          domain: domain,
          startTime: now
        }
      });

      console.log(`✅ Started tracking: ${domain}, Tab ID: ${tab.id}`);
    } catch (error) {
      console.error('❌ Error in startTracking:', error);
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
        await this.storageManager.saveTimeEntry(domain, roundedTime, 1);
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

      // IMPROVEMENT #1: Reduce threshold from 1000ms to 500ms and improve rounding
              if (timeSpent > 500 && domain) {
          const roundedTime = Math.round(timeSpent / 1000) * 1000; // Round instead of floor for better accuracy
          await this.storageManager.saveTimeEntry(domain, roundedTime, 1);
          console.log(`Stopped tracking: ${domain}, Time: ${this.storageManager.formatTime(roundedTime)}`);
        }

      await this.stateManager.dispatch({
        type: 'STOP_TRACKING'
      });
      
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
          await this.storageManager.saveTimeEntry(this.currentSession.domain, timeBeforeSleep, 0);
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
  async saveCurrentSession() {
    try {
      // SAFEGUARD 1: Validate session state
      if (!this.currentSession || !this.currentSession.isActive || !this.currentSession.startTime) {
        return;
      }

      // SAFEGUARD 2: Prevent concurrent execution and sleep processing
      if (this.isSaving || this.isProcessingSleep) {
        console.debug('⏭️ Save already in progress or processing sleep, skipping');
        return;
      }
      this.isSaving = true;

      const now = Date.now();
      
      // SAFEGUARD 3: Validate timestamps and handle undefined lastHeartbeat
      if (!this.lastHeartbeat) {
        console.warn('⚠️ lastHeartbeat undefined, initializing to current time');
        this.lastHeartbeat = now;
        return;
      }
      
      const timeSinceLastHeartbeat = now - this.lastHeartbeat;
      let sessionDuration;
      
      // DEFENSIVE CHECK: Check for sleep BEFORE calculating session duration
      if (timeSinceLastHeartbeat > 300000) { // 5 minutes gap indicates sleep
        console.log('💤 Sleep detected during save - handling sleep condition');
        // Calculate session duration up to last heartbeat (excludes sleep time)
        sessionDuration = Math.max(0, this.lastHeartbeat - this.currentSession.startTime);
        
        // Save time before sleep if any
        if (sessionDuration >= 1000) { // At least 1 second of activity
          await this.storageManager.saveTimeEntry(this.currentSession.domain, sessionDuration, 0);
          console.log('💾 Saved time before sleep:', {
            domain: this.currentSession.domain,
            duration: this.storageManager.formatTime(sessionDuration),
            sleepGap: Math.round(timeSinceLastHeartbeat / 1000) + 's'
          });
        }
        
        this.isProcessingSleep = true;
        try {
          await this.handleSleepDetected();
        } finally {
          this.isProcessingSleep = false;
        }
        return; // Don't continue with normal save logic
      }
      
      // Normal case: Calculate session duration from start to now (no sleep detected)
      sessionDuration = now - this.currentSession.startTime;
      
      // Prevent saving if session duration is unreasonably long (backup safety check)
      if (sessionDuration > 3600000) { // 1 hour max per save cycle
        console.log('⚠️ Session duration too long, likely missed sleep detection. Resetting...');
        this.currentSession.startTime = now;
        return;
      }
      
      // IMPROVEMENT #1: Reduce periodic save threshold from 5 seconds to 2 seconds
      if (sessionDuration >= 2000) {
        await this.storageManager.saveTimeEntry(this.currentSession.domain, sessionDuration, 0);
        
        // Reset tracking for next interval
        this.currentSession.startTime = now;
        
        console.log('💾 Session saved:', {
          domain: this.currentSession.domain,
          duration: this.storageManager.formatTime(sessionDuration)
        });
      }
    } catch (error) {
      console.error('Error saving session:', error);
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
    await this.saveCurrentSession();
    
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

// Consolidated message handling - SINGLE LISTENER ONLY
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Received message:', message.type, 'from:', sender.tab?.url || 'popup');
  console.log('🔍 DEBUG: Extension background script is running and receiving messages');
  
  // Always respond to PING messages immediately
  if (message.type === 'PING') {
    sendResponse({ success: true, initialized: isInitialized });
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
  
  // For other messages, ensure we're initialized
  if (!isInitialized) {
    console.log('⚠️ Extension not initialized, initializing now...');
    initializeExtension().then(() => {
      if (focusTimeTracker && focusTimeTracker.handleMessage) {
        try {
          focusTimeTracker.handleMessage(message, sender, sendResponse);
        } catch (error) {
          console.error('❌ Error in delayed message handler:', error);
          sendResponse({ success: false, error: 'Message handler error' });
        }
      } else {
        sendResponse({ success: false, error: 'Extension initialization failed' });
      }
    }).catch(error => {
      console.error('❌ Extension initialization error:', error);
      sendResponse({ success: false, error: 'Extension initialization failed' });
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
            sendResponse({ success: false, error: error.message });
          } catch (e) {
            console.error('❌ Failed to send error response:', e);
          }
        });
      }
      return true; // Keep channel open for async handlers
    } catch (error) {
      console.error('❌ Message handler error:', error);
      sendResponse({ success: false, error: error.message });
      return false; // Don't keep channel open for sync errors
    }
  }
  
  console.warn('⚠️ FocusTimeTracker not available, message ignored:', message.type);
  sendResponse({ success: false, error: 'Extension not properly initialized' });
  return false; // Don't keep channel open for sync errors
});