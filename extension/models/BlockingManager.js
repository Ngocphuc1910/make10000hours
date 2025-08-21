/**
 * BlockingManager class for handling site blocking functionality
 * Service Worker Compatible Version
 */

// ExtensionEventBus is loaded by background.js - no inline definition needed

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
    
    // Enhanced Deep Focus properties
    this.blockedSites = new Set();
    this.temporaryOverrides = new Map(); // domain -> expiry timestamp
    this.focusStartTime = null;
    this.blockedAttempts = 0;
    this.focusStats = {
      totalFocusTime: 0,
      sessionsToday: 0,
      blockedAttemptsToday: 0
    };

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
      // Strict validation: StorageManager is required for Deep Focus
      if (!this.storageManager) {
        throw new Error('StorageManager is required for Deep Focus functionality');
      }

      // If turning on focus mode, strictly validate user state
      if (!this.focusMode) {
        const userStateValid = await this.storageManager.validateAndRecoverUserState();
        if (!userStateValid) {
          throw new Error('Valid user state is required to enable Deep Focus mode');
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
        
        // Coordinate with StateManager if available
        if (this.stateManager) {
          await this.stateManager.dispatch({
            type: 'FOCUS_MODE_CHANGED',
            payload: { 
              focusMode: true, 
              sessionId: this.currentLocalSessionId,
              focusStartTime: Date.now()
            }
          });
        }
      } else {
        console.log('⏹️ Completing deep focus session...');
        await this.completeLocalDeepFocusSession();
        // Disable blocking rules
        await this.updateBlockingRules();
        
        // Coordinate with StateManager if available
        if (this.stateManager) {
          await this.stateManager.dispatch({
            type: 'FOCUS_MODE_CHANGED',
            payload: { focusMode: false }
          });
        }
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
      // Complete any existing session first
      await this.completeLocalDeepFocusSession();

      if (this.storageManager) {
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
          console.log('✅ Deep focus session created:', this.currentLocalSessionId);
        } else {
          throw new Error('Failed to create deep focus session after retries');
        }
      } else {
        // Fallback to basic session tracking without StorageManager
        console.log('⚠️ Using basic session tracking without StorageManager');
        this.focusStartTime = Date.now();
        this.focusStats.sessionsToday++;
        this.startSessionTimer();
      }
    } catch (error) {
      console.error('❌ Failed to start local deep focus session:', error);
      // Fallback to basic tracking
      this.focusStartTime = Date.now();
      this.focusStats.sessionsToday++;
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
        if (this.storageManager && this.currentLocalSessionId) {
          // Calculate elapsed time from session start
          const activeSession = await this.storageManager.getActiveDeepFocusSession();
          if (activeSession) {
            const elapsedMs = Date.now() - activeSession.startTime;
            const elapsedMinutes = Math.floor(elapsedMs / (60 * 1000));
            
            // Update session duration with retry
            await this.retryOperation(
              () => this.storageManager.updateDeepFocusSessionDuration(
                this.currentLocalSessionId, 
                elapsedMinutes
              ),
              'Update session duration'
            );
            
            console.log(`📈 Focus session progress: ${elapsedMinutes} minutes`);
            
            // Emit deep focus update event
            await ExtensionEventBus.emit(ExtensionEventBus.EVENTS.DEEP_FOCUS_UPDATE, {
              minutes: elapsedMinutes,
              sessionId: this.currentLocalSessionId
            });
          }
        } else if (this.focusStartTime && this.focusMode) {
          // Fallback to basic tracking
          const elapsedMs = Date.now() - this.focusStartTime;
          const elapsedMinutes = Math.floor(elapsedMs / (60 * 1000));
          
          console.log(`📈 Basic focus session progress: ${elapsedMinutes} minutes`);
          
          // Update internal stats
          this.focusStats.totalFocusTime = elapsedMs;
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
      // Stop the session timer
      if (this.sessionTimer) {
        clearInterval(this.sessionTimer);
        this.sessionTimer = null;
        console.log('⏱️ Session timer stopped');
      }
      
      if (this.storageManager && this.currentLocalSessionId) {
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
          
          // Broadcast completion to web app
          await this.broadcastDeepFocusTimeUpdate();
        }
      } else if (this.focusStartTime) {
        // Fallback to basic session completion
        const sessionDuration = Date.now() - this.focusStartTime;
        this.focusStats.totalFocusTime += sessionDuration;
        const minutes = Math.floor(sessionDuration / (60 * 1000));
        console.log(`✅ Basic focus session completed: ${minutes} minutes`);
        this.focusStartTime = null;
      } else {
        console.log('🔍 No active deep focus session to complete');
      }

      // Clear the current session ID
      this.currentLocalSessionId = null;
      
    } catch (error) {
      console.error('❌ Failed to complete local deep focus session:', error);
      // Don't throw error to prevent blocking the toggle operation
      // Still clear session ID to prevent stuck state
      this.currentLocalSessionId = null;
    }
  }

  /**
   * Save the current blocking manager state (Enhanced with Deep Focus properties)
   */
  async saveState() {
    try {
      const state = {
        focusMode: this.focusMode,
        currentLocalSessionId: this.currentLocalSessionId,
        lastUpdated: Date.now()
      };
      
      // Convert Sets and Maps to serializable formats
      const blockedSitesArray = Array.from(this.blockedSites);
      const temporaryOverridesObj = Object.fromEntries(this.temporaryOverrides);
      
      // Save all state including enhanced Deep Focus properties
      await chrome.storage.local.set({ 
        blockingManagerState: state,
        focusMode: this.focusMode,
        blockedSites: blockedSitesArray,
        focusStartTime: this.focusStartTime,
        blockedAttempts: this.blockedAttempts,
        focusStats: this.focusStats,
        temporaryOverrides: temporaryOverridesObj
      });
      console.log('💾 Blocking manager state saved (internal + main keys + Deep Focus state)');
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
      // Load both the internal state and the main storage keys + enhanced Deep Focus state
      const result = await chrome.storage.local.get([
        'blockingManagerState', 'focusMode', 'blockedSites',
        'focusStartTime', 'blockedAttempts', 'focusStats', 'temporaryOverrides'
      ]);
      
      if (result.blockingManagerState) {
        const state = result.blockingManagerState;
        this.focusMode = state.focusMode || false;
        this.currentLocalSessionId = state.currentLocalSessionId || null;
        
        console.log('📂 Blocking manager internal state loaded:', state);
      }
      
      // Load main storage keys and ensure consistency
      this.focusMode = result.focusMode !== undefined ? result.focusMode : this.focusMode;
      
      // Load blocked sites and convert to Set
      const blockedSitesArray = result.blockedSites || [];
      this.blockedSites = new Set(blockedSitesArray);
      
      // Load enhanced Deep Focus state
      this.focusStartTime = result.focusStartTime || null;
      this.blockedAttempts = result.blockedAttempts || 0;
      this.focusStats = result.focusStats || {
        totalFocusTime: 0,
        sessionsToday: 0,
        blockedAttemptsToday: 0
      };
      
      // Load temporary overrides
      const overrides = result.temporaryOverrides || {};
      this.temporaryOverrides = new Map(Object.entries(overrides));
      
      console.log('🔍 Final loaded state - Focus mode:', this.focusMode, 'Blocked sites:', this.blockedSites.size, 'Focus session active:', !!this.focusStartTime);
      
      // If focus mode is active, restart the timer
      if (this.focusMode && this.focusStartTime) {
        try {
          this.startSessionTimer();
          console.log('🔄 Restored session timer for active deep focus session');
        } catch (error) {
          console.warn('⚠️ Error starting session timer during state load:', error);
        }
      }
    } catch (error) {
      console.error('❌ Failed to load blocking manager state:', error);
    }
  }

  /**
   * Broadcast deep focus time update to all listeners
   */
  async broadcastDeepFocusTimeUpdate() {
    try {
      if (!this.storageManager) {
        console.warn('⚠️ StorageManager not available for time broadcast');
        return;
      }

      const sessionData = await this.storageManager.getLocalDeepFocusTime();
      
      // Send via chrome.runtime.sendMessage (for popup and other extension parts)
      chrome.runtime.sendMessage({
        type: 'DEEP_FOCUS_TIME_UPDATED',
        payload: { minutes: sessionData.minutes }
      }).catch(() => {
        // Ignore errors when no listeners are connected
        console.debug('📝 No listeners for deep focus time update');
      });

      // Send via ExtensionEventBus (for web app)
      if (typeof ExtensionEventBus !== 'undefined') {
        await ExtensionEventBus.emit(
          ExtensionEventBus.EVENTS.DEEP_FOCUS_UPDATE,
          { minutes: sessionData.minutes }
        );
      }

      console.log('📢 Broadcasted deep focus time update:', sessionData.minutes, 'minutes');
    } catch (error) {
      console.error('❌ Failed to broadcast deep focus time:', error);
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
      
      // Strict validation: StorageManager is required for Deep Focus
      if (!this.storageManager) {
        throw new Error('StorageManager is required for Deep Focus functionality');
      }

      // Validate user state when enabling focus mode
      if (newFocusMode && !this.focusMode) {
        const userStateValid = await this.storageManager.validateAndRecoverUserState();
        if (!userStateValid) {
          throw new Error('Valid user state is required to enable Deep Focus mode');
        }
      }
      
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
        
        // Coordinate with StateManager if available
        if (this.stateManager) {
          await this.stateManager.dispatch({
            type: 'FOCUS_MODE_CHANGED',
            payload: { 
              focusMode: true, 
              sessionId: this.currentLocalSessionId,
              focusStartTime: Date.now()
            }
          });
        }
      } else if (!this.focusMode && previousMode) {
        // Turning off focus mode - complete session and disable blocking
        console.log('🏁 Completing local deep focus session...');
        await this.completeLocalDeepFocusSession();
        await this.updateBlockingRules();
        
        // Coordinate with StateManager if available
        if (this.stateManager) {
          await this.stateManager.dispatch({
            type: 'FOCUS_MODE_CHANGED',
            payload: { focusMode: false }
          });
        }
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
      const storage = await chrome.storage.local.get(['blockedSites']);
      const blockedSites = storage.blockedSites || [];
      
      // Use the instance focusMode (this.focusMode) rather than storage 
      // because StateManager uses coordinatedFocusMode key to avoid conflicts
      const focusMode = this.focusMode;
      
      console.log('🔍 Current blocking state:', {
        blockedSites: blockedSites,
        blockedSitesLength: blockedSites.length,
        focusMode: focusMode,
        instanceFocusMode: this.focusMode
      });
      
      // Get existing rules to clean up - ONLY remove rules in our range (1000-9999)
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const ourRuleIds = existingRules.filter(rule => rule.id >= 1000 && rule.id < 10000).map(rule => rule.id);
      
      // Remove only our existing blocking rules
      if (ourRuleIds.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: ourRuleIds
        });
        console.log('🧹 Removed', ourRuleIds.length, 'existing Deep Focus blocking rules');
      }
      
      // Only add blocking rules if focus mode is active and we have sites to block
      if (focusMode && blockedSites.length > 0) {
        // Generate collision-resistant IDs by checking existing rules
        const existingIds = new Set(existingRules.map(rule => rule.id));
        let nextRuleId = 2000; // Start from 2000 to avoid conflicts
        
        const newRules = blockedSites.map((domain, index) => {
          // Find next available ID
          while (existingIds.has(nextRuleId)) {
            nextRuleId++;
          }
          
          const rule = {
            id: nextRuleId,
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
          };
          
          existingIds.add(nextRuleId); // Mark this ID as used
          nextRuleId++; // Increment for next rule
          return rule;
        });
        
        console.log('📋 Creating rules with IDs:', newRules.map(r => r.id));
        
        await chrome.declarativeNetRequest.updateDynamicRules({
          addRules: newRules
        });
        
        console.log('✅ Added', newRules.length, 'blocking rules for focus mode');
        return { success: true, rulesAdded: newRules.length, ruleIds: newRules.map(r => r.id) };
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
   * Add a site to the blocked list
   */
  async addBlockedSite(domain) {
    try {
      if (!domain) {
        return { success: false, error: 'Domain is required' };
      }
      
      // Clean domain (remove protocol, www, path)
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      
      if (this.blockedSites.has(cleanDomain)) {
        return { success: false, error: 'Site is already blocked' };
      }
      
      this.blockedSites.add(cleanDomain);
      await this.saveState();
      
      // Update blocking rules if focus mode is active
      if (this.focusMode) {
        await this.updateBlockingRules();
      }
      
      console.log('➕ Added blocked site:', cleanDomain);
      return { success: true, domain: cleanDomain, message: 'Site blocked successfully' };
    } catch (error) {
      console.error('❌ Error adding blocked site:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove a site from the blocked list
   */
  async removeBlockedSite(domain) {
    try {
      if (!domain) {
        return { success: false, error: 'Domain is required' };
      }
      
      // Clean domain (remove protocol, www, path)
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      
      if (!this.blockedSites.has(cleanDomain)) {
        return { success: false, error: 'Site is not blocked' };
      }
      
      this.blockedSites.delete(cleanDomain);
      await this.saveState();
      
      // Update blocking rules if focus mode is active
      if (this.focusMode) {
        await this.updateBlockingRules();
      }
      
      console.log('➖ Removed blocked site:', cleanDomain);
      return { success: true, domain: cleanDomain, message: 'Site unblocked successfully' };
    } catch (error) {
      console.error('❌ Error removing blocked site:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Record a blocked attempt when user tries to access blocked site
   */
  recordBlockedAttempt(domain) {
    this.blockedAttempts++;
    this.focusStats.blockedAttemptsToday++;
    this.saveState();
    console.log(`🚫 Blocked attempt to access: ${domain} (Total: ${this.blockedAttempts})`);
  }

  /**
   * Temporarily override blocking for a site (allow access during focus mode)
   */
  async overrideSite(domain, durationMinutes = 5) {
    try {
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      const expiryTime = Date.now() + (durationMinutes * 60 * 1000);
      
      this.temporaryOverrides.set(cleanDomain, expiryTime);
      await this.saveState();
      
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
      }, durationMinutes * 60 * 1000);
      
      console.log(`⏰ Temporary override for ${cleanDomain}: ${durationMinutes} minutes`);
      return { 
        success: true, 
        domain: cleanDomain, 
        expiryTime: expiryTime,
        message: `Temporary access granted for ${durationMinutes} minutes` 
      };
    } catch (error) {
      console.error('❌ Error creating site override:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get comprehensive focus statistics
   */
  getFocusStats() {
    const focusTime = this.focusStartTime ? Date.now() - this.focusStartTime : 0;
    
    return {
      focusMode: this.focusMode,
      focusTime: focusTime,
      focusStartTime: this.focusStartTime,
      blockedAttempts: this.blockedAttempts,
      blockedSites: Array.from(this.blockedSites),
      blockedSitesCount: this.blockedSites.size,
      temporaryOverrides: Object.fromEntries(this.temporaryOverrides),
      activeOverrides: Array.from(this.temporaryOverrides.entries()).filter(([domain, expiry]) => expiry > Date.now()),
      focusStats: this.focusStats
    };
  }

  /**
   * Clear all blocking rules (separate from updateBlockingRules for explicit clearing)
   */
  async clearBlockingRules() {
    try {
      // Get existing rules - ONLY clear rules in our range (1000-9999)
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const ourRuleIds = existingRules.filter(rule => rule.id >= 1000 && rule.id < 10000).map(rule => rule.id);
      
      if (ourRuleIds.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: ourRuleIds
        });
        
        console.log(`🧹 Cleared ${ourRuleIds.length} Deep Focus blocking rules`);
      }
      return { success: true, rulesRemoved: ourRuleIds.length };
    } catch (error) {
      console.error('❌ Error clearing blocking rules:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Reset all blocking state (for debugging/testing)
   */
  async resetBlockingState() {
    try {
      this.focusMode = false;
      this.focusStartTime = null;
      this.blockedAttempts = 0;
      this.temporaryOverrides.clear();
      this.focusStats = {
        totalFocusTime: 0,
        sessionsToday: 0,
        blockedAttemptsToday: 0
      };
      
      await this.clearBlockingRules();
      await this.saveState();
      
      console.log('🔄 Blocking state reset successfully');
      return { success: true, message: 'Blocking state reset' };
    } catch (error) {
      console.error('❌ Error resetting blocking state:', error);
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

  /**
   * Set StateManager reference for coordination
   */
  setStateManager(stateManager) {
    this.stateManager = stateManager;
    console.log('✅ StateManager reference set in BlockingManager');
  }
}

// Make BlockingManager globally available for service worker
self.BlockingManager = BlockingManager; 