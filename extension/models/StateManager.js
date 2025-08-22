/**
 * StateManager class for managing extension state
 */

class StateManager {
  constructor() {
    this.initialized = false;
    this.state = {
      focusMode: false,
      currentSessionId: null,
      focusStartTime: null,
      blockedSites: [],
      userInfo: null
    };
  }

  /**
   * Initialize the StateManager
   */
  async initialize() {
    try {
      await this.loadState();
      this.initialized = true;
      console.log('✅ StateManager initialized');
      return true;
    } catch (error) {
      console.error('❌ StateManager initialization failed:', error);
      return false;
    }
  }

  /**
   * Load state from chrome storage
   */
  async loadState() {
    try {
      const storage = await chrome.storage.local.get([
        'coordinatedFocusMode', 
        'currentSessionId',
        'focusStartTime',
        'blockedSites',
        'userInfo'
      ]);

      this.state = {
        focusMode: storage.coordinatedFocusMode || false,
        currentSessionId: storage.currentSessionId || null,
        focusStartTime: storage.focusStartTime || null,
        blockedSites: storage.blockedSites || [],
        userInfo: storage.userInfo || null
      };

      console.log('🔄 StateManager loaded state:', this.state);
    } catch (error) {
      console.error('❌ Error loading state:', error);
      throw error;
    }
  }

  /**
   * Dispatch state changes with coordination
   */
  async dispatch(action, payload = {}) {
    try {
      console.log('🔄 StateManager dispatch:', action.type, payload);

      switch (action.type) {
        case 'FOCUS_MODE_CHANGED':
          this.state.focusMode = payload.focusMode;
          this.state.currentSessionId = payload.sessionId || this.state.currentSessionId;
          if (payload.focusMode) {
            this.state.focusStartTime = payload.focusStartTime || Date.now();
          } else {
            this.state.focusStartTime = null;
            this.state.currentSessionId = null;
          }
          break;

        case 'SESSION_CREATED':
          this.state.currentSessionId = payload.sessionId;
          this.state.focusStartTime = payload.startTime || Date.now();
          break;

        case 'SESSION_COMPLETED':
          this.state.currentSessionId = null;
          this.state.focusStartTime = null;
          break;

        case 'BLOCKED_SITES_UPDATED':
          this.state.blockedSites = payload.blockedSites || [];
          break;

        case 'USER_INFO_UPDATED':
          this.state.userInfo = payload.userInfo;
          break;

        default:
          console.warn('⚠️ Unknown state action:', action.type);
          return;
      }

      // Persist state changes
      await this.persistState();
      console.log('✅ StateManager state updated:', action.type);

    } catch (error) {
      console.error('❌ StateManager dispatch error:', error);
      throw error;
    }
  }

  /**
   * Persist state to chrome storage
   */
  async persistState() {
    try {
      await chrome.storage.local.set({
        // Use coordinated prefix to avoid conflicts with BlockingManager
        coordinatedFocusMode: this.state.focusMode,
        currentSessionId: this.state.currentSessionId,
        focusStartTime: this.state.focusStartTime,
        blockedSites: this.state.blockedSites,
        userInfo: this.state.userInfo
      });
    } catch (error) {
      console.error('❌ Error persisting state:', error);
      throw error;
    }
  }

  /**
   * Get current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Get specific state property
   */
  getStateProperty(key) {
    return this.state[key];
  }
}

// Make StateManager globally available for service worker
self.StateManager = StateManager; 