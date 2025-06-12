/**
 * Centralized State Management for Focus Time Tracker Extension
 * Handles state synchronization across background, popup, and content scripts
 */

class StateManager {
  constructor() {
    this.state = {
      currentSession: {
        activeTab: null,
        startTime: null,
        isTracking: false,
        focusMode: false
      },
      todayStats: {
        totalTime: 0,
        sites: {},
        lastUpdated: new Date().toISOString().split('T')[0]
      },
      settings: {
        blockedSites: [],
        trackingEnabled: true,
        activityThreshold: 5000, // 5 seconds
        dataRetentionDays: 30,
        integrationEnabled: false,
        pomodoroApiUrl: '',
        pomodoroApiKey: ''
      },
      uiState: {
        popupOpen: false,
        optionsOpen: false,
        currentView: 'stats'
      }
    };
    
    this.listeners = new Map();
    this.messageHandlers = new Map();
    this.setupMessageHandlers();
  }

  /**
   * Set up Chrome extension message handlers for state synchronization
   */
  setupMessageHandlers() {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        this.handleMessage(message, sender, sendResponse);
        return true; // Keep message channel open for async responses
      });
    }
  }

  /**
   * Handle incoming messages from other extension components
   */
  async handleMessage(message, sender, sendResponse) {
    const { type, payload, requestId } = message;
    
    try {
      let result;

      switch (type) {
        case 'GET_STATE':
          result = await this.getState(payload?.path);
          break;
        case 'SET_STATE':
          result = await this.setState(payload.path, payload.value);
          break;
        case 'DISPATCH_ACTION':
          result = await this.dispatch(payload.action, payload.data);
          break;
        case 'SUBSCRIBE':
          result = this.subscribe(payload.path, sender.tab?.id || 'background');
          break;
        default:
          throw new Error(`Unknown message type: ${type}`);
      }
      
      sendResponse({ success: true, data: result, requestId });
    } catch (error) {
      console.error('State Manager Error:', error);
      sendResponse({ success: false, error: error.message, requestId });
    }
  }

  /**
   * Get state value by path (e.g., 'currentSession.isTracking')
   */
  async getState(path = null) {
    if (!path) {
      return this.state;
    }
    
    const keys = path.split('.');
    let value = this.state;
    
    for (const key of keys) {
      value = value?.[key];
      if (value === undefined) {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * Set state value by path and notify listeners
   */
  async setState(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let target = this.state;
    
    // Navigate to the parent object
    for (const key of keys) {
      if (!target[key]) {
        target[key] = {};
      }
      target = target[key];
    }
    
    // Set the value
    const oldValue = target[lastKey];
    target[lastKey] = value;
    
    // Notify listeners
    await this.notifyListeners(path, value, oldValue);
    
    // Persist to storage if needed
    await this.persistState();
    
    return value;
  }

  /**
   * Dispatch state actions (Redux-style)
   */
  async dispatch(action, data = {}) {
    const { type } = action;
    
    switch (type) {
      case 'START_TRACKING':
        return this.startTracking(data);
      case 'STOP_TRACKING':
        return this.stopTracking(data);
      case 'UPDATE_TIME':
        return this.updateTime(data);
      case 'RESET_SESSION':
        return this.resetSession();
      case 'ENABLE_FOCUS_MODE':
        return this.enableFocusMode();
      case 'DISABLE_FOCUS_MODE':
        return this.disableFocusMode();
      case 'ADD_BLOCKED_SITE':
        return this.addBlockedSite(data.domain);
      case 'REMOVE_BLOCKED_SITE':
        return this.removeBlockedSite(data.domain);
      case 'LOAD_SETTINGS':
        return this.loadSettings();
      case 'SAVE_SETTINGS':
        return this.saveSettings(data);
      default:
        throw new Error(`Unknown action type: ${type}`);
    }
  }

  /**
   * Subscribe to state changes
   */
  subscribe(path, listenerId) {
    if (!this.listeners.has(path)) {
      this.listeners.set(path, new Set());
    }
    this.listeners.get(path).add(listenerId);
    
    return () => {
      const pathListeners = this.listeners.get(path);
      if (pathListeners) {
        pathListeners.delete(listenerId);
        if (pathListeners.size === 0) {
          this.listeners.delete(path);
        }
      }
    };
  }

  /**
   * Notify listeners of state changes
   */
  async notifyListeners(path, newValue, oldValue) {
    const pathListeners = this.listeners.get(path);
    if (!pathListeners) return;
    
    const message = {
      type: 'STATE_CHANGED',
      payload: { path, newValue, oldValue }
    };
    
    // Notify all listeners
    for (const listenerId of pathListeners) {
      try {
        if (listenerId === 'background') {
          // Handle background script notifications
          continue;
        } else {
          // Send to tab
          await chrome.tabs.sendMessage(parseInt(listenerId), message);
        }
      } catch (error) {
        // Remove dead listeners
        pathListeners.delete(listenerId);
      }
    }
  }

  // Action implementations
  async startTracking({ tabId, domain, url }) {
    await this.setState('currentSession.activeTab', { tabId, domain, url });
    await this.setState('currentSession.startTime', Date.now());
    await this.setState('currentSession.isTracking', true);
    
    return this.state.currentSession;
  }

  async stopTracking({ timeSpent = null } = {}) {
    const session = this.state.currentSession;
    
    if (session.isTracking && session.activeTab) {
      const actualTimeSpent = timeSpent || (Date.now() - session.startTime);
      await this.updateTime({
        domain: session.activeTab.domain,
        timeSpent: actualTimeSpent
      });
    }
    
    await this.setState('currentSession.isTracking', false);
    await this.setState('currentSession.activeTab', null);
    await this.setState('currentSession.startTime', null);
    
    return this.state.currentSession;
  }

  async updateTime({ domain, timeSpent, visits = 1 }) {
    const today = new Date().toISOString().split('T')[0];
    const todayStats = this.state.todayStats;
    
    // Initialize today's data if needed
    if (todayStats.lastUpdated !== today) {
      await this.setState('todayStats', {
        totalTime: 0,
        sites: {},
        lastUpdated: today
      });
    }
    
    // Update site statistics
    const currentSiteStats = todayStats.sites[domain] || {
      domain,
      timeSpent: 0,
      visits: 0,
      lastVisit: Date.now()
    };
    
    currentSiteStats.timeSpent += timeSpent;
    currentSiteStats.visits += visits;
    currentSiteStats.lastVisit = Date.now();
    
    await this.setState(`todayStats.sites.${domain}`, currentSiteStats);
    await this.setState('todayStats.totalTime', todayStats.totalTime + timeSpent);
    
    return currentSiteStats;
  }

  async resetSession() {
    await this.setState('currentSession', {
      activeTab: null,
      startTime: null,
      isTracking: false,
      focusMode: this.state.currentSession.focusMode
    });
    
    return this.state.currentSession;
  }

  async enableFocusMode() {
    await this.setState('currentSession.focusMode', true);
    // TODO: Implement blocking rules activation
    return true;
  }

  async disableFocusMode() {
    await this.setState('currentSession.focusMode', false);
    // TODO: Implement blocking rules deactivation
    return false;
  }

  async addBlockedSite(domain) {
    const blockedSites = [...this.state.settings.blockedSites];
    if (!blockedSites.includes(domain)) {
      blockedSites.push(domain);
      await this.setState('settings.blockedSites', blockedSites);
    }
    return blockedSites;
  }

  async removeBlockedSite(domain) {
    const blockedSites = this.state.settings.blockedSites.filter(site => site !== domain);
    await this.setState('settings.blockedSites', blockedSites);
    return blockedSites;
  }

  async loadSettings() {
    // TODO: Load from Chrome storage
    return this.state.settings;
  }

  async saveSettings(newSettings) {
    await this.setState('settings', { ...this.state.settings, ...newSettings });
    // TODO: Persist to Chrome storage
    return this.state.settings;
  }

  /**
   * Persist state to Chrome storage
   */
  async persistState() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        await chrome.storage.local.set({
          focusTrackerState: this.state
        });
      } catch (error) {
        console.error('Failed to persist state:', error);
      }
    }
  }

  /**
   * Load state from Chrome storage
   */
  async loadState() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        const result = await chrome.storage.local.get(['focusTrackerState']);
        if (result.focusTrackerState) {
          this.state = { ...this.state, ...result.focusTrackerState };
        }
      } catch (error) {
        console.error('Failed to load state:', error);
      }
    }
  }

  /**
   * Send message to other extension components
   */
  async sendMessage(type, payload = {}) {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      try {
        return await chrome.runtime.sendMessage({
          type,
          payload,
          requestId: Date.now()
        });
      } catch (error) {
        console.error('Failed to send message:', error);
        throw error;
      }
    }
  }
}

// Export for use in different contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StateManager;
} else if (typeof window !== 'undefined') {
  window.StateManager = StateManager;
}

// Create global instance for background script
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
  window.stateManager = new StateManager();
} 