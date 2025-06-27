/**
 * Background Service Worker for Focus Time Tracker Extension
 * Handles time tracking, tab management, and extension coordination
 */

// Utility Classes - Inline for Service Worker Compatibility

/**
 * Simple Storage Manager for Chrome Extension
 */
class StorageManager {
  constructor() {
    this.initialized = false;
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
  }

  async dispatch(action, payload = {}) {
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

    // Notify listeners
    this.notifyListeners();
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
      }
      
      console.log('🛡️ Blocking Manager initialized', {
        focusMode: this.focusMode,
        blockedSites: Array.from(this.blockedSites),
        focusStartTime: this.focusStartTime
      });
    } catch (error) {
      console.error('Error initializing BlockingManager:', error);
    }
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
        
        // Get current blocked sites list
        const blockedSites = Array.from(this.blockedSites);
        console.log('🔒 Focus mode ENABLED with blocked sites:', blockedSites);
        
        // Broadcast focus state with blocked sites
        if (this.tracker) {
          this.tracker.broadcastFocusStateChange(true);
        }
      } else {
        this.focusStartTime = null;
        await this.clearBlockingRules();
        console.log('🔓 Focus mode DISABLED');
        
        // Broadcast focus state change
        if (this.tracker) {
          this.tracker.broadcastFocusStateChange(false);
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
}

// Main Focus Time Tracker Class
class FocusTimeTracker {
  constructor() {
    this.stateManager = null;
    this.storageManager = null;
    this.blockingManager = null; // Add blocking manager
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
    
    this.initialize();
  }

  /**
   * Initialize the background script
   */
  async initialize() {
    try {
      console.log('🚀 Initializing Focus Time Tracker...');
      
      // Initialize managers
      this.stateManager = new StateManager();
      this.storageManager = new StorageManager();
      await this.storageManager.initialize(); // Initialize storage manager
      this.blockingManager = new BlockingManager(); // Initialize blocking manager
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Start tracking current tab
      await this.startTrackingCurrentTab();
      
      console.log('✅ Focus Time Tracker initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Focus Time Tracker:', error);
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
      console.log('📨 Message received:', message.type);

      switch (message.type) {
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
          // Store user ID for override session attribution
          try {
            console.log('🔍 DEBUG: SET_USER_ID received:', message.payload);
            
            this.currentUserId = message.payload?.userId;
            this.userInfo = {
              userId: message.payload?.userId,
              userEmail: message.payload?.userEmail,
              displayName: message.payload?.displayName
            };
            console.log('✅ User ID set in extension:', this.currentUserId);
            console.log('🔍 DEBUG: Full user info stored:', this.userInfo);
            
            // Notify popup about user info update
            try {
              chrome.runtime.sendMessage({
                type: 'USER_INFO_UPDATED',
                payload: this.userInfo
              });
            } catch (error) {
              // Popup might not be open, ignore error
              console.log('📝 Popup not available for user info update notification');
            }
            
            sendResponse({ success: true, userId: this.currentUserId });
          } catch (error) {
            console.error('❌ DEBUG: Error setting user ID:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'RECORD_OVERRIDE_SESSION':
          // Forward to web app with user ID if available
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
            
            this.forwardToWebApp('RECORD_OVERRIDE_SESSION', enhancedPayload);
            sendResponse({ success: true, payload: enhancedPayload });
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

        case 'GET_USER_INFO':
          try {
            const userInfo = this.userInfo || null;
            console.log('📤 Sending user info to popup:', userInfo);
            sendResponse({ 
              success: true, 
              data: userInfo 
            });
          } catch (error) {
            console.error('❌ Error getting user info:', error);
            sendResponse({ success: false, error: error.message });
          }
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

        case 'GET_FOCUS_STATE':
          try {
            // Get focus mode from BlockingManager (authoritative source)
            const focusStats = this.blockingManager.getFocusStats();
            sendResponse({ 
              success: true, 
              data: { 
                focusMode: this.blockingManager.focusMode,
                ...focusStats 
              } 
            });
          } catch (error) {
            console.error('Error getting focus state:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'GET_FOCUS_STATUS':
          try {
            sendResponse({ success: true, data: { focusMode: this.blockingManager.focusMode } });
          } catch (error) {
            console.error('Error getting focus status:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        default:
          console.warn('❓ Unknown message type:', message.type);
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
      console.error('❌ Error starting tracking:', error);
    }
  }

  /**
   * Stop tracking current website and save data
   */
  async stopCurrentTracking() {
    try {
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
      console.error('Error stopping tracking:', error);
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
      if (this.currentSession.isActive && this.currentSession.startTime && !this.isSessionPaused) {
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
   * Broadcast focus state changes to all listeners
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

    // Send to all tabs with content scripts
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

    // Forward directly to web app for redundancy
    this.forwardToWebApp('EXTENSION_FOCUS_STATE_CHANGED', focusState);
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
}

// Initialize the tracker when the service worker starts
const focusTimeTracker = new FocusTimeTracker(); 