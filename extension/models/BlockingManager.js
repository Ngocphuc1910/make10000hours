/**
 * BlockingManager class for handling site blocking functionality
 * Service Worker Compatible Version
 */

// Inline ExtensionEventBus functionality for service worker compatibility
const ExtensionEventBus = {
  EVENTS: {
    DEEP_FOCUS_UPDATE: 'DEEP_FOCUS_TIME_UPDATED',
    FOCUS_STATE_CHANGE: 'FOCUS_STATE_CHANGED'
  },

  async emit(eventName, payload) {
    try {
      const manifestData = chrome.runtime.getManifest();
      const start = performance.now();
      
      await chrome.runtime.sendMessage({
        type: eventName,
        payload: {
          ...payload,
          _version: manifestData.version,
          _timestamp: Date.now()
        }
      });

      const duration = performance.now() - start;
      console.log(`📊 Event ${eventName} emission took:`, duration, 'ms');
    } catch (error) {
      console.warn(`⚠️ Event emission failed: ${eventName}`, error);
      // Don't throw - follow existing pattern of catching runtime errors
    }
  },

  subscribe(callback) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (Object.values(this.EVENTS).includes(message.type)) {
        callback(message);
      }
      return true; // Keep message channel open
    });
  },

  isExtensionContextValid: function() {
    try {
      return Boolean(chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  },

  safeForwardMessage: async function(type, payload) {
    if (!this.isExtensionContextValid()) {
      return { success: false, error: 'Extension context invalid', recoverable: true };
    }

    try {
      return await chrome.runtime.sendMessage({
        type,
        payload,
        source: 'make10000hours-extension'
      });
    } catch (error) {
      if (!error.message.includes('Extension context invalidated')) {
        console.error(`Failed to forward ${type}:`, error);
      }
      return { 
        success: false, 
        error: error.message,
        recoverable: error.message.includes('Extension context invalidated')
      };
    }
  }
};

class BlockingManager {
  constructor() {
    this.storageManager = null;
    this.initialized = false;
    this.urlCache = new Map();
    this.currentLocalSessionId = null;
    this.sessionTimer = null;
    this.retryAttempts = 0;
    this.maxRetries = 3;
    this.focusMode = false;

    // Subscribe to deep focus updates
    ExtensionEventBus.subscribe((message) => {
      if (message.type === ExtensionEventBus.EVENTS.DEEP_FOCUS_UPDATE) {
        this.handleDeepFocusUpdate(message.payload);
      }
    });
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Load saved state first
      await this.loadState();
      
      // Initialize blocking rules based on current state
      console.log('🔧 Initializing blocking rules on startup...');
      await this.updateBlockingRules();
      
      this.initialized = true;
      console.log('✅ BlockingManager initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing BlockingManager:', error);
      throw error;
    }
  }

  setStorageManager(storageManager) {
    this.storageManager = storageManager;
  }

  /**
   * Handle deep focus time updates and broadcast to all listeners
   */
  async handleDeepFocusUpdate(payload) {
    try {
      // Broadcast to all extension components using proper error handling
      chrome.runtime.sendMessage({
        type: ExtensionEventBus.EVENTS.DEEP_FOCUS_UPDATE,
        payload
      }, (response) => {
        if (chrome.runtime.lastError) {
          // Expected error when no listeners are connected - don't log as error
          if (chrome.runtime.lastError.message?.includes('Could not establish connection') ||
              chrome.runtime.lastError.message?.includes('receiving end does not exist')) {
            console.debug('📡 No listeners for deep focus update');
          } else {
            console.warn('⚠️ Deep focus broadcast error:', chrome.runtime.lastError);
          }
        }
      });
      console.log('📢 Broadcasted deep focus time update:', payload.minutes, 'minutes');
    } catch (error) {
      console.error('❌ Failed to broadcast deep focus time:', error);
    }
  }

  /**
   * Toggle focus mode on/off with enhanced error handling
   */
  async toggleFocusMode() {
    const originalFocusMode = this.focusMode;
    
    try {
      // Validate storage manager availability
      if (!this.storageManager) {
        throw new Error('StorageManager not available');
      }

      // If turning on focus mode, verify user state first
      if (!this.focusMode) {
        const userStateValid = await this.storageManager.validateAndRecoverUserState();
        if (!userStateValid) {
          throw new Error('User ID required to enable focus mode');
        }
      }

      // Toggle the focus mode
      this.focusMode = !this.focusMode;
      console.log(`🔄 Toggling focus mode: ${originalFocusMode} -> ${this.focusMode}`);
      
      // Handle session based on new state
      if (this.focusMode) {
        console.log('🎯 Starting deep focus session...');
        await this.startLocalDeepFocusSession();
        // Enable blocking rules
        await this.updateBlockingRules();
      } else {
        console.log('⏹️ Completing deep focus session...');
        await this.completeLocalDeepFocusSession();
        // Disable blocking rules
        await this.updateBlockingRules();
      }

      // Save state
      await this.saveState();
      
      console.log(`✅ Focus mode toggle successful: ${this.focusMode}`);
      return {
        success: true,
        focusMode: this.focusMode,
        sessionId: this.currentLocalSessionId
      };
    } catch (error) {
      console.error('❌ Error toggling focus mode:', error);
      
      // Revert focus mode if error occurs
      this.focusMode = originalFocusMode;
      console.log(`🔄 Reverted focus mode back to: ${this.focusMode}`);
      
      return { 
        success: false, 
        error: error.message,
        focusMode: this.focusMode 
      };
    }
  }

  /**
   * Start a local deep focus session with enhanced error handling
   */
  async startLocalDeepFocusSession() {
    try {
      if (!this.storageManager) {
        throw new Error('StorageManager not available');
      }

      // Verify user state before starting session
      const userStateValid = await this.storageManager.validateAndRecoverUserState();
      if (!userStateValid) {
        throw new Error('User ID required to create deep focus session');
      }

      // Complete any existing session first
      await this.completeLocalDeepFocusSession();

      // Create new session with retries
      for (let i = 0; i < this.maxRetries; i++) {
        try {
          this.currentLocalSessionId = await this.storageManager.createDeepFocusSession();
          this.retryAttempts = 0; // Reset on success
          break;
        } catch (error) {
          this.retryAttempts++;
          if (i === this.maxRetries - 1) {
            throw error;
          }
          const backoffMs = Math.pow(2, i) * 1000;
          console.log(`⏳ Retry attempt ${i + 1}/${this.maxRetries} in ${backoffMs}ms`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }

      // Start timer only if session created successfully
      if (this.currentLocalSessionId) {
        this.startSessionTimer();
        console.log('✅ Local deep focus session setup complete:', this.currentLocalSessionId);
      } else {
        throw new Error('Failed to create deep focus session after retries');
      }
    } catch (error) {
      console.error('❌ Failed to start local deep focus session:', error);
      throw error;
    }
  }

  /**
   * Start the session timer with error handling
   */
  startSessionTimer() {
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
    }

    console.log('⏱️ Starting session timer...');
    this.sessionTimer = setInterval(async () => {
      try {
        if (this.currentLocalSessionId) {
          // Calculate elapsed time
          const activeSession = await this.storageManager.getActiveDeepFocusSession();
          if (activeSession) {
            const elapsedMs = Date.now() - new Date(activeSession.startTime).getTime();
            const elapsedMinutes = Math.floor(elapsedMs / (60 * 1000));
            
            // Update session duration with retry
            await this.retryOperation(
              () => this.storageManager.updateDeepFocusSessionDuration(
                this.currentLocalSessionId, 
                elapsedMinutes
              ),
              'Update session duration'
            );
          }
        }
      } catch (error) {
        console.error('❌ Error in session timer:', error);
        // Don't throw here to keep timer running
      }
    }, 60 * 1000); // Update every minute
  }

  /**
   * Complete the current local deep focus session
   */
  async completeLocalDeepFocusSession() {
    try {
      if (!this.currentLocalSessionId) {
        console.log('🔍 No active deep focus session to complete');
        return;
      }

      if (!this.storageManager) {
        throw new Error('StorageManager not available');
      }

      // Stop the session timer
      if (this.sessionTimer) {
        clearInterval(this.sessionTimer);
        this.sessionTimer = null;
        console.log('⏱️ Session timer stopped');
      }

      // Get the active session to calculate final duration
      const activeSession = await this.storageManager.getActiveDeepFocusSession();
      if (activeSession) {
        const elapsedMs = Date.now() - activeSession.startTime;
        const elapsedMinutes = Math.floor(elapsedMs / (60 * 1000));
        
        // Complete the session with retry logic
        await this.retryOperation(
          () => this.storageManager.completeDeepFocusSession(
            this.currentLocalSessionId, 
            elapsedMinutes
          ),
          'Complete deep focus session'
        );

        console.log(`✅ Deep focus session completed: ${elapsedMinutes} minutes`);
      }

      // Clear the current session ID
      this.currentLocalSessionId = null;
      
    } catch (error) {
      console.error('❌ Failed to complete local deep focus session:', error);
      // Don't throw error to prevent blocking the toggle operation
    }
  }

  /**
   * Save the current blocking manager state
   */
  async saveState() {
    try {
      const state = {
        focusMode: this.focusMode,
        currentLocalSessionId: this.currentLocalSessionId,
        blockedSites: this.blockedSites || [],
        lastUpdated: Date.now()
      };
      
      // Save both the internal state and the main storage keys that updateBlockingRules() uses
      await chrome.storage.local.set({ 
        blockingManagerState: state,
        focusMode: this.focusMode,
        blockedSites: this.blockedSites || []
      });
      console.log('💾 Blocking manager state saved (internal + main keys)');
    } catch (error) {
      console.error('❌ Failed to save blocking manager state:', error);
      // Don't throw error to prevent blocking other operations
    }
  }

  /**
   * Load the blocking manager state
   */
  async loadState() {
    try {
      // Load both the internal state and the main storage keys
      const result = await chrome.storage.local.get(['blockingManagerState', 'focusMode', 'blockedSites']);
      
      if (result.blockingManagerState) {
        const state = result.blockingManagerState;
        this.focusMode = state.focusMode || false;
        this.currentLocalSessionId = state.currentLocalSessionId || null;
        this.blockedSites = state.blockedSites || [];
        
        console.log('📂 Blocking manager internal state loaded:', state);
      }
      
      // Also load from main storage keys and ensure consistency
      this.focusMode = result.focusMode !== undefined ? result.focusMode : this.focusMode;
      this.blockedSites = result.blockedSites || this.blockedSites || [];
      
      console.log('🔍 Final loaded state - Focus mode:', this.focusMode, 'Blocked sites:', this.blockedSites.length);
      
      // If focus mode is active and we have a session ID, restart the timer
      if (this.focusMode && this.currentLocalSessionId && this.storageManager) {
        try {
          const activeSession = await this.storageManager.getActiveDeepFocusSession();
          if (activeSession) {
            this.startSessionTimer();
            console.log('🔄 Restored session timer for active deep focus session');
          } else {
            // Session doesn't exist anymore, clear the ID
            this.currentLocalSessionId = null;
            console.log('🔍 No active session found, cleared session ID');
          }
        } catch (error) {
          console.warn('⚠️ Error checking active session during state load:', error);
        }
      }
    } catch (error) {
      console.error('❌ Failed to load blocking manager state:', error);
    }
  }

  /**
   * Get current focus statistics
   */
  getFocusStats() {
    return {
      focusMode: this.focusMode,
      currentSessionId: this.currentLocalSessionId,
      blockedSitesCount: this.blockedSites ? this.blockedSites.length : 0,
      lastUpdated: Date.now()
    };
  }

  /**
   * Set focus mode directly (for web app sync)
   */
  async setFocusMode(newFocusMode) {
    try {
      console.log(`🔄 BlockingManager.setFocusMode called with: ${newFocusMode} at ${new Date().toISOString()}`);
      
      const previousMode = this.focusMode;
      console.log(`🔍 Current focus mode before change: ${previousMode}`);
      
      this.focusMode = newFocusMode;
      console.log(`✅ Focus mode property updated to: ${this.focusMode}`);
      
      // Handle session management based on the new state
      if (this.focusMode && !previousMode) {
        // Turning on focus mode - start session and enable blocking
        console.log('🚀 Starting local deep focus session...');
        await this.startLocalDeepFocusSession();
        await this.updateBlockingRules();
      } else if (!this.focusMode && previousMode) {
        // Turning off focus mode - complete session and disable blocking
        console.log('🏁 Completing local deep focus session...');
        await this.completeLocalDeepFocusSession();
        await this.updateBlockingRules();
      }
      
      // Save the updated state
      console.log('💾 Saving BlockingManager state...');
      await this.saveState();
      
      console.log(`✅ Focus mode fully updated: ${previousMode} → ${this.focusMode} at ${new Date().toISOString()}`);
      return {
        success: true,
        focusMode: this.focusMode,
        sessionId: this.currentLocalSessionId,
        previousMode
      };
    } catch (error) {
      console.error('❌ Error setting focus mode:', error);
      // Revert on error
      this.focusMode = !newFocusMode;
      return {
        success: false,
        error: error.message,
        focusMode: this.focusMode
      };
    }
  }

  /**
   * Update blocking rules using chrome.declarativeNetRequest
   * This is the core blocking engine that was missing
   */
  async updateBlockingRules() {
    try {
      console.log('🔧 Updating blocking rules...');
      
      // Get current blocked sites from storage
      const storage = await chrome.storage.local.get(['blockedSites', 'focusMode']);
      const blockedSites = storage.blockedSites || [];
      const focusMode = storage.focusMode || false;
      
      console.log('🔍 Current storage state:', {
        blockedSites: blockedSites,
        blockedSitesLength: blockedSites.length,
        focusMode: focusMode,
        internalFocusMode: this.focusMode
      });
      
      // Get existing rules to clean up
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const existingRuleIds = existingRules.map(rule => rule.id);
      
      // Remove all existing blocking rules
      if (existingRuleIds.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: existingRuleIds
        });
        console.log('🧹 Removed', existingRuleIds.length, 'existing blocking rules');
      }
      
      // Only add blocking rules if focus mode is active and we have sites to block
      if (focusMode && blockedSites.length > 0) {
        const newRules = blockedSites.map((domain, index) => ({
          id: index + 1, // Rule IDs must be > 0
          priority: 1,
          action: {
            type: 'redirect',
            redirect: {
              url: chrome.runtime.getURL('blocked.html') + '?domain=' + encodeURIComponent(domain)
            }
          },
          condition: {
            urlFilter: `*://*.${domain}/*`,
            resourceTypes: ['main_frame']
          }
        }));
        
        await chrome.declarativeNetRequest.updateDynamicRules({
          addRules: newRules
        });
        
        console.log('✅ Added', newRules.length, 'blocking rules for focus mode');
        return { success: true, rulesAdded: newRules.length };
      } else {
        console.log('ℹ️ No blocking rules needed (focus mode:', focusMode, ', sites:', blockedSites.length, ')');
        return { success: true, rulesAdded: 0 };
      }
      
    } catch (error) {
      console.error('❌ Failed to update blocking rules:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Enable blocking for specific sites
   */
  async enableBlocking(sites = []) {
    try {
      console.log('🛡️ Enabling blocking for sites:', sites);
      
      // Update storage
      await chrome.storage.local.set({ 
        blockedSites: sites, 
        focusMode: true 
      });
      
      this.focusMode = true;
      this.blockedSites = sites;
      
      // Update blocking rules
      const result = await this.updateBlockingRules();
      
      if (result.success) {
        console.log('✅ Blocking enabled successfully');
        return { success: true, blockedSites: sites.length };
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('❌ Failed to enable blocking:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Disable all blocking
   */
  async disableBlocking() {
    try {
      console.log('🔓 Disabling all blocking...');
      
      // Update storage
      await chrome.storage.local.set({ focusMode: false });
      this.focusMode = false;
      
      // Update blocking rules (will remove all rules since focusMode is false)
      const result = await this.updateBlockingRules();
      
      if (result.success) {
        console.log('✅ Blocking disabled successfully');
        return { success: true };
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('❌ Failed to disable blocking:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Helper method to retry operations with backoff
   */
  async retryOperation(operation, operationName, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        const backoffMs = Math.pow(2, i) * 1000;
        console.log(`⏳ Retrying ${operationName} attempt ${i + 1}/${maxRetries} in ${backoffMs}ms`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }
}

// Make BlockingManager globally available for service worker
self.BlockingManager = BlockingManager; 