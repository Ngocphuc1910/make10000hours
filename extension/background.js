/**
 * Background Service Worker for Focus Time Tracker Extension
 * Handles time tracking, tab management, and extension coordination
 */

// At the top of the file
const ExtensionEventBus = {
  EVENTS: {
    DEEP_FOCUS_UPDATE: 'DEEP_FOCUS_TIME_UPDATED',
    FOCUS_STATE_CHANGE: 'FOCUS_STATE_CHANGED'
  },

  async emit(eventName, payload) {
    try {
      const manifestData = chrome.runtime.getManifest();
      await chrome.runtime.sendMessage({
        type: eventName,
        payload: {
          ...payload,
          _version: manifestData.version,
          _timestamp: Date.now()
        }
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
    return new Date().toISOString().split('T')[0];
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
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
      
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
        const today = new Date().toISOString().split('T')[0];
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
      const today = new Date().toISOString().split('T')[0];
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
    const today = new Date().toISOString().split('T')[0];
    const storage = await chrome.storage.local.get(['stats']);
    return storage.stats?.[today] || {
      totalTime: 0,
      sitesVisited: 0,
      productivityScore: 0,
      sites: {}
    };
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
    const storedStats = await this.getTodayStats();
    
    // Clone stored stats to avoid mutation
    const realTimeStats = {
      totalTime: storedStats?.totalTime || 0,
      sitesVisited: storedStats?.sitesVisited || 0,
      sites: { ...(storedStats?.sites || {}) }
    };
    
    // Add current session time if actively tracking and we have tracker reference
    if (this.focusTimeTracker && this.focusTimeTracker.currentSession) {
      const currentSession = this.focusTimeTracker.currentSession;
      
      if (currentSession.isActive && currentSession.domain && currentSession.startTime) {
        const currentTime = Date.now();
        const sessionTime = currentTime - currentSession.startTime;
        
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
    }
    
    return realTimeStats;
  }

  /**
   * Get real-time top sites with current session data
   * This provides the same real-time data as getRealTimeStatsWithSession but formatted for site list
   */
  async getRealTimeTopSites(limit = 20) {
    const realTimeStats = await this.getRealTimeStatsWithSession();
    
    if (!realTimeStats || !realTimeStats.sites || Object.keys(realTimeStats.sites).length === 0) {
      return [];
    }

    const topSites = Object.entries(realTimeStats.sites)
      .map(([domain, data]) => ({
        domain,
        timeSpent: data.timeSpent || 0,
        visits: data.visits || 0
      }))
      .filter(site => site.timeSpent > 0) // Only include sites with actual time
      .sort((a, b) => b.timeSpent - a.timeSpent)
      .slice(0, limit);
    
    return topSites;
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
      const dateStr = date.toISOString().split('T')[0];
      
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
  async createDeepFocusSession(userId) {
    if (!userId) {
      throw new Error('User ID required to create deep focus session');
    }

    try {
      // Existing session creation logic
      const sessionId = await this.saveDeepFocusStorage(storage);
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
      const today = now.toISOString().split('T')[0];

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
      const today = now.toISOString().split('T')[0];

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
      const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
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
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

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
    this.blockedSites = new Set();
    this.temporaryOverrides = new Map(); // domain -> expiry timestamp
    this.urlCache = new Map(); // tabId -> original URL
    this.focusStartTime = null;
    this.blockedAttempts = 0;
    
    // Deep focus session tracking
    this.currentLocalSessionId = null;
    this.sessionTimer = null;
    this.storageManager = null;
    
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
   * Update Chrome declarativeNetRequest rules
   */
  async updateBlockingRules() {
    try {
      // First, get and remove all existing dynamic rules
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const existingRuleIds = existingRules.map(rule => rule.id);
      
      if (existingRuleIds.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: existingRuleIds
        });
        console.log(`🧹 Removed ${existingRuleIds.length} existing blocking rules`);
      }
      
      // If focus mode is off or no sites to block, we're done
      if (!this.focusMode || this.blockedSites.size === 0) {
        console.log('🔓 Focus mode disabled or no sites to block');
        return;
      }
      
      // Create new rules for blocked sites
      const rules = [];
      let ruleId = 1;
      
      // Add rules for each blocked site (skip those with temporary override)
      for (const domain of this.blockedSites) {
        // Skip if domain has temporary override
        if (this.temporaryOverrides.has(domain)) {
          const expiryTime = this.temporaryOverrides.get(domain);
          if (Date.now() < expiryTime) {
            console.log(`⏭️ Skipping ${domain} due to active override`);
            continue;
          } else {
            // Clean up expired override
            this.temporaryOverrides.delete(domain);
          }
        }
        
        // Add blocking rule for this domain
        rules.push({
          id: ruleId++,
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
        
        // Also block the domain without www
        rules.push({
          id: ruleId++,
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
      // Get existing rules
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const ruleIds = existingRules.map(rule => rule.id);
      
      if (ruleIds.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: ruleIds
        });
        
        console.log(`🧹 Cleared ${ruleIds.length} blocking rules`);
      }
    } catch (error) {
      console.error('Error clearing blocking rules:', error);
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

      // Create new session
      this.currentLocalSessionId = await this.storageManager.createDeepFocusSession();
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
          const today = new Date().toISOString().split('T')[0];
          
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
      
      const today = new Date().toISOString().split('T')[0];
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
    this.inactivityThreshold = 300000; // 5 minutes
    this.lastActivityTime = Date.now();
    this.autoManagementEnabled = true;
    
    // Focus state tracking
    this.latestFocusState = false;
    
    // User authentication state
    this.currentUserId = null;
    this.userInfo = null;
    
    // Add sleep tracking state
    this.systemSleepState = {
      isSleeping: false,
      sleepStartTime: null,
      lastWakeTime: null,
      totalSleepTime: 0
    };
    
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
      await this.storageManager.initialize();
      
      // Continue with other initialization
      this.blockingManager = new BlockingManager();
      this.blockingManager.setStorageManager(this.storageManager);
      await this.blockingManager.initialize();
      
      // Set initial Firebase config if not already set
      const configResult = await this.configManager.getFirebaseConfig();
      if (!configResult.config) {
        await this.configManager.setFirebaseConfig({
          // Your default Firebase config here
          // This should be replaced with your actual config
          projectId: "your-project-id",
          apiKey: "your-api-key",
          // ... other required Firebase config fields
        });
      }

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

    // Message handling from popup and content scripts
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });

    // External message handling from web apps (externally_connectable domains)
    chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
      console.log('📨 External message received from:', sender.origin);
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });

    // Set up periodic save every 30 seconds
    this.saveInterval = setInterval(() => {
      if (this.currentSession.isActive) {
        this.saveCurrentSession();
      }
    }, 30000); // Save every 30 seconds for more frequent updates
  }

  /**
   * Handle tab activation (user switches to different tab)
   */
  async handleTabActivated(activeInfo) {
    try {
      console.log('🔄 Tab activated:', activeInfo.tabId);
      
      // Stop tracking current tab
      await this.stopCurrentTracking();
      
      // Get new tab info
      const tab = await chrome.tabs.get(activeInfo.tabId);
      console.log('📍 New tab URL:', tab.url);
      
      // Start tracking new tab
      await this.startTracking(tab);
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
        // Browser lost focus
        await this.pauseTracking();
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

      switch (type) {
        case 'GET_FIREBASE_CONFIG':
          const configResult = await this.configManager.getFirebaseConfig();
          sendResponse(configResult);
          return true;

        case 'SET_FIREBASE_CONFIG':
          if (!payload) {
            sendResponse({ success: false, error: 'No config provided' });
            return true;
          }
          const saveResult = await this.configManager.setFirebaseConfig(payload);
          sendResponse(saveResult);
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
          const realTimeStats = await this.storageManager.getRealTimeStatsWithSession();
          sendResponse({ success: true, data: realTimeStats });
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
          const realTimeTopSites = await this.storageManager.getRealTimeTopSites(message.payload?.limit || 20);
          sendResponse({ success: true, data: realTimeTopSites });
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

        case 'ADD_BLOCKED_SITE':
          const addResult = await this.blockingManager.addBlockedSite(message.payload?.domain);
          sendResponse(addResult);
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
          const removeResult = await this.blockingManager.removeBlockedSite(message.payload?.domain);
          sendResponse(removeResult);
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
              });
            } catch (error) {
              console.log('📝 Popup not available for user info update notification');
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
              // Broadcast state change to all listeners
              this.broadcastFocusStateChange(true);
              sendResponse({ success: true, data: { focusMode: true } });
            } else {
              sendResponse({ success: true, data: { focusMode: true } });
            }
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
              // Broadcast state change to all listeners
              this.broadcastFocusStateChange(false);
              sendResponse({ success: true, data: { focusMode: false } });
            } else {
              sendResponse({ success: true, data: { focusMode: false } });
            }
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

        case 'SYSTEM_SLEEP_DETECTED':
          this.handleSystemSleep(message.timestamp);
          break;

        case 'SYSTEM_WAKE_DETECTED':
          this.handleSystemWake(message.timestamp, message.sleepDuration);
          break;

        case 'PING':
          // Health check ping from content scripts
          sendResponse({ 
            success: true, 
            timestamp: Date.now(),
            extensionId: chrome.runtime.id 
          });
          break;

        default:
          console.warn('❓ Unknown message type:', type);
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('❌ Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
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

      // Save current session if exists
      if (this.currentSession.isActive) {
        await this.stopCurrentTracking();
      }

      const domain = this.extractDomain(tab.url);
      const now = Date.now();

      console.log('✨ Starting tracking for domain:', domain);

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
   * Stop tracking current website and save data
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
      const timeSpent = now - this.currentSession.startTime + (this.currentSession.savedTime || 0);
      const domain = this.currentSession.domain;

      // Only save if spent more than 1 second and round down to nearest second
              if (timeSpent > 1000 && domain) {
          const roundedTime = Math.floor(timeSpent / 1000) * 1000; // Round to nearest second
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
      const activeDuration = Date.now() - this.currentSession.startTime;
      const totalDuration = (this.currentSession.savedTime || 0) + activeDuration;
      if (totalDuration > 1000) {
        await this.storageManager.saveTimeEntry(this.currentSession.domain, totalDuration, 0);
      }
      // Reset savedTime since we've persisted it
      this.currentSession.savedTime = 0;
      this.currentSession.isActive = false;
      this.currentSession.startTime = null;
    }
  }

  /**
   * Resume tracking (browser gained focus)
   */
  async resumeTracking(tab) {
    if (!this.currentSession.isActive && tab && this.isTrackableUrl(tab.url)) {
      this.currentSession.startTime = Date.now();
      this.currentSession.isActive = true;
    }
  }

  /**
   * Get current extension state
   */
  async getCurrentState() {
    return {
      currentSession: this.currentSession,
      tracking: this.currentSession.isActive,
      focusMode: (await this.storageManager.getSettings()).focusMode,
      todayStats: await this.storageManager.getTodayStats()
    };
  }

  /**
   * Save current session progress (enhanced with pause tracking)
   */
  async saveCurrentSession() {
    try {
      if (this.currentSession.isActive && this.currentSession.startTime && !this.systemSleepState.isSleeping) {
        const now = Date.now();
        const grossTimeSpent = now - this.currentSession.startTime;
        const netTimeSpent = grossTimeSpent - this.totalPausedTime;
        
        // Only save if we have at least 1 minute of activity
        if (netTimeSpent >= 60000) {
          const minutesToSave = Math.floor(netTimeSpent / 60000) * 60000;
          await this.storageManager.saveTimeEntry(this.currentSession.domain, minutesToSave, 0);
          
          // Update accumulated savedTime and reset counters
          this.currentSession.savedTime = (this.currentSession.savedTime || 0) + minutesToSave;
          const remainder = netTimeSpent - minutesToSave;
          
          // Preserve remainder for continuous counting
          this.currentSession.startTime = now - remainder;
          this.totalPausedTime = 0;
          
          console.log('💾 Session saved:', {
            domain: this.currentSession.domain,
            savedMinutes: this.storageManager.formatTime(this.currentSession.savedTime),
            remainingTime: this.storageManager.formatTime(netTimeSpent - minutesToSave)
          });
        }
      }
    } catch (error) {
      console.error('Error saving session:', error);
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
    this.lastActivityTime = Date.now();
    
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
  broadcastFocusStateChange(isActive) {
    console.log(`🔄 Broadcasting focus state change: ${isActive}`);
    
    // Get current blocked sites from BlockingManager
    const blockedSites = Array.from(this.blockingManager.blockedSites || new Set());
    console.log('📋 Current blocked sites in extension:', blockedSites);
    
    const focusState = {
      isActive,
      isVisible: isActive,
      isFocused: isActive,
      blockedSites // Include blocked sites list
    };

    console.log('📤 Broadcasting full focus state:', focusState);

    // Use ONLY content script forwarding to prevent duplicate messages
    // Remove direct web app forwarding to avoid race conditions
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id && this.isTrackableUrl(tab.url)) {
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
        "https://make10000hours.com/*",
        "https://www.make10000hours.com/*",
        "http://make10000hours.com/*",
        "http://www.make10000hours.com/*"
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
   * Handle system sleep detection
   */
  handleSystemSleep(timestamp) {
    console.log('💤 System sleep detected at:', new Date(timestamp).toISOString());
    
    this.systemSleepState.isSleeping = true;
    this.systemSleepState.sleepStartTime = timestamp;
    
    // Pause tracking
    this.pauseTracking();
  }

  /**
   * Handle system wake detection
   */
  async handleSystemWake(timestamp, sleepDuration) {
    console.log('🌅 System wake detected:', {
      timestamp: new Date(timestamp).toISOString(),
      sleepDuration: Math.round(sleepDuration / 1000) + 's'
    });
    
    // Update sleep state
    this.systemSleepState.isSleeping = false;
    this.systemSleepState.lastWakeTime = timestamp;
    this.systemSleepState.totalSleepTime += sleepDuration;
    
    // Adjust current session if needed
    if (this.currentSession.isActive) {
      // Add sleep time to total paused time
      this.totalPausedTime += sleepDuration;
      
      // Update session start time to account for sleep
      this.currentSession.startTime = timestamp;
      
      // Save current progress
      await this.saveCurrentSession();
    }
  }
}

// Initialize the tracker when the service worker starts
const focusTimeTracker = new FocusTimeTracker(); 

// Add ping handler for context validation
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ success: true });
    return true; // Keep channel open for async response
  }
  // ... existing message handlers ...
});

// Add initialization state tracking
let isInitialized = false;

// Initialize as soon as possible
async function initializeExtension() {
  if (isInitialized) return;
  
  try {
    // Initialize the tracker when the service worker starts
    const focusTimeTracker = new FocusTimeTracker();
    isInitialized = true;
    
    // Notify any waiting content scripts
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        try {
          chrome.tabs.sendMessage(tab.id, { type: 'EXTENSION_READY' });
        } catch (e) {
          // Tab may not have content script, ignore
        }
      });
    });
  } catch (e) {
    console.error('Failed to initialize extension:', e);
  }
}

// Handle extension lifecycle events
chrome.runtime.onInstalled.addListener(initializeExtension);
chrome.runtime.onStartup.addListener(initializeExtension);

// Enhanced message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Always respond to PING messages immediately
  if (message.type === 'PING') {
    sendResponse({ success: true, initialized: isInitialized });
    return true;
  }
  
  // For other messages, ensure we're initialized
  if (!isInitialized) {
    initializeExtension().then(() => {
      // Handle the message after initialization
      handleMessage(message, sender, sendResponse);
    });
    return true; // Keep channel open
  }
  
  // Normal message handling
  return handleMessage(message, sender, sendResponse);
});

function handleMessage(message, sender, sendResponse) {
  // ... existing message handling logic ...
}