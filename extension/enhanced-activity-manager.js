/**
 * Enhanced Activity Manager for Browser Extension
 * Provides robust activity detection and auto-pause functionality
 * Similar to the web app's useActivityDetection hook
 */

class EnhancedActivityManager {
  constructor() {
    this.isUserActive = true;
    this.isTabVisible = true;
    this.lastActivityTime = Date.now();
    this.inactivityThreshold = 300000; // 5 minutes in milliseconds
    this.heartbeatInterval = 30000; // 30 seconds
    this.activityCheckInterval = null;
    this.heartbeatTimer = null;
    
    // Session state
    this.isSessionPaused = false;
    this.pausedAt = null;
    this.totalPausedTime = 0;
    this.autoManagementEnabled = true;
    
    // Activity tracking
    this.currentTabId = null;
    this.currentDomain = null;
    this.sessionStartTime = null;
    
    // Callbacks
    this.onActivityChange = null;
    this.onInactivityTimeout = null;
    this.onSessionPaused = null;
    this.onSessionResumed = null;
    
    this.initialize();
  }

  /**
   * Initialize the activity manager
   */
  async initialize() {
    try {
      console.log('🚀 Enhanced Activity Manager initializing...');
      
      // Load settings
      await this.loadSettings();
      
      // Set up event listeners
      this.setupExtensionEventListeners();
      
      // Start activity monitoring
      this.startActivityMonitoring();
      
      console.log('✅ Enhanced Activity Manager initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Enhanced Activity Manager:', error);
    }
  }

  /**
   * Load settings from storage
   */
  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['activitySettings']);
      const settings = result.activitySettings || {};
      
      this.inactivityThreshold = settings.inactivityThreshold || 300000; // 5 minutes
      this.autoManagementEnabled = settings.autoManagementEnabled !== false; // default true
      this.heartbeatInterval = settings.heartbeatInterval || 30000; // 30 seconds
      
      console.log('📋 Activity settings loaded:', {
        inactivityThreshold: this.inactivityThreshold / 1000 + 's',
        autoManagementEnabled: this.autoManagementEnabled,
        heartbeatInterval: this.heartbeatInterval / 1000 + 's'
      });
    } catch (error) {
      console.error('Error loading activity settings:', error);
    }
  }

  /**
   * Save settings to storage
   */
  async saveSettings() {
    try {
      await chrome.storage.local.set({
        activitySettings: {
          inactivityThreshold: this.inactivityThreshold,
          autoManagementEnabled: this.autoManagementEnabled,
          heartbeatInterval: this.heartbeatInterval
        }
      });
    } catch (error) {
      console.error('Error saving activity settings:', error);
    }
  }

  /**
   * Set up extension-specific event listeners
   */
  setupExtensionEventListeners() {
    // Tab and window events (for visibility detection)
    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.handleTabActivated(activeInfo);
    });

    chrome.windows.onFocusChanged.addListener((windowId) => {
      this.handleWindowFocusChanged(windowId);
    });

    // Listen for system suspend/resume events (chrome.power API if available)
    if (chrome.power && chrome.power.onSuspend) {
      chrome.power.onSuspend.addListener(() => {
        console.log('🛌 System suspend detected');
        this.handleSystemSuspend();
      });
    }

    if (chrome.power && chrome.power.onResume) {
      chrome.power.onResume.addListener(() => {
        console.log('🌅 System resume detected');
        this.handleSystemResume();
      });
    }

    // Listen for runtime suspend/startup events
    chrome.runtime.onSuspend.addListener(() => {
      console.log('⏸️ Extension suspend detected');
      this.handleExtensionSuspend();
    });

    chrome.runtime.onStartup.addListener(() => {
      console.log('🔄 Extension startup detected');
      this.handleExtensionStartup();
    });
  }

  /**
   * Start activity monitoring with heartbeat
   */
  startActivityMonitoring() {
    // Clear existing timers
    this.stopActivityMonitoring();
    
    // Start heartbeat timer
    this.heartbeatTimer = setInterval(() => {
      this.checkActivityStatus();
    }, this.heartbeatInterval);
    
    console.log(`⏰ Activity monitoring started (heartbeat: ${this.heartbeatInterval / 1000}s)`);
  }

  /**
   * Stop activity monitoring
   */
  stopActivityMonitoring() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Check current activity status and handle inactivity
   */
  checkActivityStatus() {
    const now = Date.now();
    const timeSinceLastActivity = now - this.lastActivityTime;
    
    console.log('🔍 Activity check:', {
      timeSinceLastActivity: Math.round(timeSinceLastActivity / 1000) + 's',
      threshold: Math.round(this.inactivityThreshold / 1000) + 's',
      isUserActive: this.isUserActive,
      isSessionPaused: this.isSessionPaused,
      autoManagementEnabled: this.autoManagementEnabled
    });

    // Check if user became inactive
    const wasActive = this.isUserActive;
    this.isUserActive = timeSinceLastActivity < this.inactivityThreshold;

    // Handle state changes
    if (wasActive && !this.isUserActive) {
      console.log('😴 User became inactive');
      this.handleInactivityDetected(timeSinceLastActivity);
    } else if (!wasActive && this.isUserActive) {
      console.log('⚡ User became active');
      this.handleActivityResumed();
    }

    // Trigger inactivity timeout if threshold exceeded and auto-management enabled
    if (!this.isUserActive && this.autoManagementEnabled && !this.isSessionPaused) {
      this.handleInactivityTimeout(timeSinceLastActivity);
    }

    // Call activity change callback
    if (this.onActivityChange) {
      this.onActivityChange({
        isActive: this.isUserActive,
        isVisible: this.isTabVisible,
        lastActivity: new Date(this.lastActivityTime),
        inactivityDuration: Math.round(timeSinceLastActivity / 1000)
      });
    }
  }

  /**
   * Update activity timestamp from content script
   */
  updateActivity(activityData = {}) {
    const now = Date.now();
    this.lastActivityTime = now;
    
    // Update tab visibility if provided
    if (activityData.isVisible !== undefined) {
      this.isTabVisible = activityData.isVisible;
    }
    
    // Resume session if it was paused and user is active
    if (this.isSessionPaused && this.autoManagementEnabled) {
      this.resumeSession();
    }
    
    console.log('🎯 Activity updated from content script');
  }

  /**
   * Handle inactivity detection
   */
  handleInactivityDetected(duration) {
    console.log(`😴 Inactivity detected: ${Math.round(duration / 1000)}s`);
    
    if (this.onInactivityTimeout) {
      this.onInactivityTimeout(duration);
    }
  }

  /**
   * Handle activity resumption
   */
  handleActivityResumed() {
    console.log('⚡ Activity resumed');
    
    // Resume session if it was paused
    if (this.isSessionPaused && this.autoManagementEnabled) {
      this.resumeSession();
    }
  }

  /**
   * Handle inactivity timeout (pause session)
   */
  handleInactivityTimeout(duration) {
    if (!this.autoManagementEnabled || this.isSessionPaused) {
      return;
    }

    console.log(`⏰ Inactivity timeout: ${Math.round(duration / 1000)}s - pausing session`);
    this.pauseSession(duration);
  }

  /**
   * Pause current tracking session
   */
  pauseSession(inactivityDuration = 0) {
    if (this.isSessionPaused) {
      return; // Already paused
    }

    console.log('🛑 Pausing tracking session due to inactivity');
    
    this.isSessionPaused = true;
    this.pausedAt = Date.now();
    
    // Call pause callback
    if (this.onSessionPaused) {
      this.onSessionPaused(inactivityDuration);
    }
    
    console.log('✅ Session paused');
  }

  /**
   * Resume tracking session
   */
  resumeSession() {
    if (!this.isSessionPaused) {
      return; // Not paused
    }

    console.log('▶️ Resuming tracking session after activity detected');
    
    // Calculate paused duration
    const pausedDuration = this.pausedAt ? Date.now() - this.pausedAt : 0;
    this.totalPausedTime += pausedDuration;
    
    this.isSessionPaused = false;
    this.pausedAt = null;
    
    // Call resume callback
    if (this.onSessionResumed) {
      this.onSessionResumed(pausedDuration);
    }
    
    console.log(`✅ Session resumed, paused for: ${Math.round(pausedDuration / 1000)}s`);
  }

  /**
   * Handle tab activation
   */
  handleTabActivated(activeInfo) {
    this.currentTabId = activeInfo.tabId;
    this.updateActivity({ isVisible: true });
    console.log('📝 Tab activated:', activeInfo.tabId);
  }

  /**
   * Handle window focus changes
   */
  handleWindowFocusChanged(windowId) {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      // Browser lost focus
      this.isTabVisible = false;
      console.log('👁️ Browser lost focus');
    } else {
      // Browser gained focus
      this.isTabVisible = true;
      this.updateActivity({ isVisible: true });
      console.log('👁️ Browser gained focus');
    }
  }

  /**
   * Handle system suspend events
   */
  handleSystemSuspend() {
    console.log('🛌 System suspend - pausing all tracking');
    this.pauseSession(0);
    
    // Save current state
    this.saveCurrentState();
  }

  /**
   * Handle system resume events  
   */
  handleSystemResume() {
    console.log('🌅 System resume - checking for activity');
    
    // Update activity timestamp
    this.updateActivity();
    
    // Resume session if auto-management is enabled
    if (this.autoManagementEnabled && this.isSessionPaused) {
      this.resumeSession();
    }
  }

  /**
   * Handle extension suspend
   */
  handleExtensionSuspend() {
    console.log('⏸️ Extension suspending - saving state');
    this.saveCurrentState();
  }

  /**
   * Handle extension startup
   */
  handleExtensionStartup() {
    console.log('🔄 Extension starting - loading state');
    this.loadCurrentState();
  }

  /**
   * Save current activity state
   */
  async saveCurrentState() {
    try {
      const state = {
        isUserActive: this.isUserActive,
        isTabVisible: this.isTabVisible,
        lastActivityTime: this.lastActivityTime,
        isSessionPaused: this.isSessionPaused,
        pausedAt: this.pausedAt,
        totalPausedTime: this.totalPausedTime,
        sessionStartTime: this.sessionStartTime,
        currentDomain: this.currentDomain,
        savedAt: Date.now()
      };

      await chrome.storage.local.set({ activityState: state });
      console.log('💾 Activity state saved');
    } catch (error) {
      console.error('Error saving activity state:', error);
    }
  }

  /**
   * Load saved activity state
   */
  async loadCurrentState() {
    try {
      const result = await chrome.storage.local.get(['activityState']);
      const state = result.activityState;

      if (state) {
        // Check if state is recent (within 1 hour)
        const stateAge = Date.now() - (state.savedAt || 0);
        const maxStateAge = 60 * 60 * 1000; // 1 hour

        if (stateAge < maxStateAge) {
          this.isUserActive = state.isUserActive || false;
          this.isTabVisible = state.isTabVisible || true;
          this.lastActivityTime = state.lastActivityTime || Date.now();
          this.isSessionPaused = state.isSessionPaused || false;
          this.pausedAt = state.pausedAt;
          this.totalPausedTime = state.totalPausedTime || 0;
          this.sessionStartTime = state.sessionStartTime;
          this.currentDomain = state.currentDomain;

          console.log('📂 Activity state loaded:', {
            stateAge: Math.round(stateAge / 1000) + 's',
            isSessionPaused: this.isSessionPaused,
            totalPausedTime: Math.round(this.totalPausedTime / 1000) + 's'
          });
        } else {
          console.log('⏰ Activity state too old, starting fresh');
          this.resetState();
        }
      }
    } catch (error) {
      console.error('Error loading activity state:', error);
      this.resetState();
    }
  }

  /**
   * Reset activity state to defaults
   */
  resetState() {
    this.isUserActive = true;
    this.isTabVisible = true;
    this.lastActivityTime = Date.now();
    this.isSessionPaused = false;
    this.pausedAt = null;
    this.totalPausedTime = 0;
    this.sessionStartTime = null;
    this.currentDomain = null;
  }

  /**
   * Set auto-management enabled/disabled
   */
  async setAutoManagement(enabled) {
    this.autoManagementEnabled = enabled;
    await this.saveSettings();
    
    console.log('🔧 Auto-management:', enabled ? 'enabled' : 'disabled');
    
    // If disabled and session is paused, resume it
    if (!enabled && this.isSessionPaused) {
      this.resumeSession();
    }
  }

  /**
   * Get current activity state
   */
  getActivityState() {
    return {
      isUserActive: this.isUserActive,
      isTabVisible: this.isTabVisible,
      lastActivity: new Date(this.lastActivityTime),
      inactivityDuration: Math.round((Date.now() - this.lastActivityTime) / 1000),
      isSessionPaused: this.isSessionPaused,
      pausedAt: this.pausedAt ? new Date(this.pausedAt) : null,
      totalPausedTime: this.totalPausedTime,
      autoManagementEnabled: this.autoManagementEnabled
    };
  }

  /**
   * Cleanup and stop monitoring
   */
  cleanup() {
    this.stopActivityMonitoring();
    this.saveCurrentState();
    console.log('🧹 Enhanced Activity Manager cleaned up');
  }
}

// Export for use in background script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EnhancedActivityManager;
}

// For direct inclusion in background script
if (typeof window === 'undefined' && typeof self !== 'undefined') {
  self.EnhancedActivityManager = EnhancedActivityManager;
} 