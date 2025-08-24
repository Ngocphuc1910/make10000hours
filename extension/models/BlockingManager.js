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
    
    // DEBUG: Log both storage locations before toggle
    const preFocusStorage = await this.atomicRead(['blockedSites', 'blockingManagerState']);
    console.log('🔍 [DEBUG-PRE] Storage state before focus toggle:', {
      legacy_blockedSites: preFocusStorage.blockedSites || [],
      unified_blockedSites: preFocusStorage.blockingManagerState?.blockedSites || [],
      instance_blockedSites: Array.from(this.blockedSites),
      currentFocusMode: this.focusMode
    });
    
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

      // DEBUG: Log state right before the toggle
      console.log('🔍 [DEBUG-TOGGLE] About to toggle focus mode:', {
        fromFocusMode: originalFocusMode,
        toFocusMode: !this.focusMode,
        instanceBlockedSites: Array.from(this.blockedSites),
        instanceBlockedSitesLength: this.blockedSites.size
      });

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
      
      // DEBUG: Log both storage locations after saveState
      const postFocusStorage = await this.atomicRead(['blockedSites', 'blockingManagerState']);
      console.log('🔍 [DEBUG-POST] Storage state after focus toggle and saveState:', {
        legacy_blockedSites: postFocusStorage.blockedSites || [],
        unified_blockedSites: postFocusStorage.blockingManagerState?.blockedSites || [],
        instance_blockedSites: Array.from(this.blockedSites),
        newFocusMode: this.focusMode
      });
      
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
      console.log('💾 [BLOCKING-DEBUG] saveState() called at', new Date().toISOString());
      console.log('🔍 [BLOCKING-DEBUG] Current BlockingManager properties before save:');
      console.log('  - this.focusMode:', this.focusMode);
      console.log('  - this.currentLocalSessionId:', this.currentLocalSessionId);
      console.log('  - this.focusStartTime:', this.focusStartTime);
      
      // Phase 4: Unified storage - save everything in blockingManagerState
      const blockedSitesArray = Array.from(this.blockedSites);
      const temporaryOverridesObj = Object.fromEntries(this.temporaryOverrides);
      
      const unifiedState = {
        focusMode: this.focusMode,
        currentLocalSessionId: this.currentLocalSessionId,
        blockedSites: blockedSitesArray,
        focusStartTime: this.focusStartTime,
        blockedAttempts: this.blockedAttempts,
        focusStats: this.focusStats,
        temporaryOverrides: temporaryOverridesObj,
        lastUpdated: Date.now()
      };
      
      console.log('📦 [PHASE-4] Unified state object to save:', JSON.stringify({
        focusMode: unifiedState.focusMode,
        blockedSitesCount: unifiedState.blockedSites.length,
        hasSession: !!unifiedState.currentLocalSessionId
      }));
      
      const storageData = { 
        blockingManagerState: unifiedState,
        blockedSites: Array.from(this.blockedSites)  // ADD: Maintain backward compatibility
        // Phase 4: No longer saving individual keys - everything unified
      };
      
      console.log('💾 [DUAL-STORAGE] Storage data to save:');
      console.log('  - blockingManagerState: unified storage');
      console.log('  - blockedSites: legacy compatibility');
      console.log('  - unified focusMode:', unifiedState.focusMode);
      console.log('  - dual blockedSites count:', unifiedState.blockedSites.length);
      
      // DEBUG: Log exactly what values we're writing to both storage locations
      console.log('🔍 [DEBUG-SAVE] Exact values being written to storage:', {
        legacy_blockedSites: storageData.blockedSites,
        unified_blockedSites: storageData.blockingManagerState.blockedSites,
        instance_before_save: Array.from(this.blockedSites),
        unified_focusMode: unifiedState.focusMode
      });
      
      // Phase 5: Use atomic write for consistency  
      await this.atomicWrite(storageData);
      console.log('✅ [PHASE-5] Unified blocking manager state saved atomically');
      
      // Phase 5: Verify using atomic read
      const verifyResult = await this.atomicRead(['blockingManagerState', 'blockedSites']);
      console.log('🔍 [PHASE-5] Verification - unified state saved:');
      console.log('  - blockingManagerState saved successfully:', !!verifyResult.blockingManagerState);
      
      // DEBUG: Verify what was actually written to both storage locations
      console.log('🔍 [DEBUG-SAVE-VERIFY] Values actually written to storage:', {
        legacy_blockedSites_verify: verifyResult.blockedSites || [],
        unified_blockedSites_verify: verifyResult.blockingManagerState?.blockedSites || [],
        unified_focusMode_verify: verifyResult.blockingManagerState?.focusMode
      });
      
    } catch (error) {
      console.error('❌ [BLOCKING-DEBUG] Failed to save blocking manager state:', error);
      // Don't throw error to prevent blocking other operations
    }
  }

  /**
   * Load the blocking manager state
   */
  async loadState() {
    try {
      console.log('📂 [LOAD-STATE-DEBUG] loadState() called at', new Date().toISOString());
      console.log('📂 [LOAD-STATE-DEBUG] Call stack:', new Error().stack);
      console.log('🔍 [BLOCKING-DEBUG] Current BlockingManager properties before load:');
      console.log('  - this.focusMode:', this.focusMode);
      console.log('  - this.currentLocalSessionId:', this.currentLocalSessionId);
      
      // Phase 5: Use atomic read for consistency
      const result = await this.atomicRead([
        'blockingManagerState', 'focusMode', 'blockedSites',
        'focusStartTime', 'blockedAttempts', 'focusStats', 'temporaryOverrides'
      ]);
      
      console.log('📥 [BLOCKING-DEBUG] Raw storage result:', JSON.stringify({
        blockingManagerState: result.blockingManagerState,
        focusMode: result.focusMode,
        blockedSitesLength: result.blockedSites ? result.blockedSites.length : 0
      }));
      
      if (result.blockingManagerState) {
        const state = result.blockingManagerState;
        console.log('🔄 [PHASE-4] Loading from unified blockingManagerState:');
        console.log('  - state.focusMode:', state.focusMode);
        console.log('  - state.currentLocalSessionId:', state.currentLocalSessionId);
        
        // Load all properties from unified state
        this.focusMode = state.focusMode || false;
        this.currentLocalSessionId = state.currentLocalSessionId || null;
        this.focusStartTime = state.focusStartTime || null;
        this.blockedAttempts = state.blockedAttempts || 0;
        this.focusStats = state.focusStats || {
          totalFocusTime: 0,
          sessionsToday: 0,
          blockedAttemptsToday: 0
        };
        
        // Load blocked sites from unified state
        let blockedSitesArray = state.blockedSites || [];
        
        // BUGFIX: Only initialize defaults if this is a fresh install
        // Check if unified state was ever populated (has lastUpdated) to prevent overwriting user data
        const isFreshInstall = !state.lastUpdated && blockedSitesArray.length === 0;
        
        if (isFreshInstall) {
          console.log('🔧 [PHASE-2] Fresh install detected, initializing with default sites...');
          try {
            const defaultSites = await this.getDefaultSites();
            blockedSitesArray = defaultSites;
            console.log('✅ [PHASE-2] Default sites prepared for fresh install:', defaultSites.length);
          } catch (error) {
            console.error('❌ [PHASE-2] Error initializing default sites:', error);
            blockedSitesArray = ['facebook.com', 'x.com', 'instagram.com', 'youtube.com', 'tiktok.com'];
          }
        } else if (blockedSitesArray.length === 0) {
          console.log('🚨 [PHASE-2-FIX] Preventing default initialization - unified state exists but empty sites');
          console.log('🚨 [PHASE-2-FIX] This suggests user may have manually cleared sites or there is a bug');
          console.log('🚨 [PHASE-2-FIX] state.lastUpdated:', state.lastUpdated);
          console.log('🚨 [PHASE-2-FIX] Not overwriting with defaults to preserve user choice');
        } else {
          console.log('✅ [PHASE-2] Found existing sites in unified state:', blockedSitesArray.length);
        }
        
        this.blockedSites = new Set(blockedSitesArray);
        
        // DEBUG: Log instance state after loadState sets blockedSites
        console.log('🔍 [DEBUG-LOAD] Instance blockedSites set during loadState:', {
          loaded_sites: Array.from(this.blockedSites),
          loaded_count: this.blockedSites.size,
          source: 'unified_state',
          timestamp: new Date().toISOString()
        });
        
        // Load temporary overrides from unified state
        const overrides = state.temporaryOverrides || {};
        this.temporaryOverrides = new Map(Object.entries(overrides));
        
        console.log('✅ [PHASE-4] Unified state loaded successfully');
      } else {
        console.log('⚠️ [PHASE-4] No unified state found - migrating from legacy keys...');
        
        // Migration: Load from individual keys and create unified state
        this.focusMode = result.focusMode || false;
        this.currentLocalSessionId = null; // Legacy didn't track this
        this.focusStartTime = result.focusStartTime || null;
        this.blockedAttempts = result.blockedAttempts || 0;
        this.focusStats = result.focusStats || {
          totalFocusTime: 0,
          sessionsToday: 0,
          blockedAttemptsToday: 0
        };
        
        // Load blocked sites from legacy key
        let blockedSitesArray = result.blockedSites || [];
        
        // Phase 1 Fix: Check webAppHasSynced flag instead of focus data
        const webAppHasSynced = result.webAppHasSynced || false;
        const isTrueFreshInstall = blockedSitesArray.length === 0 && !webAppHasSynced;
        
        if (isTrueFreshInstall) {
          console.log('🔧 [PHASE-2] True fresh install during migration, initializing with defaults...');
          try {
            const defaultSites = await this.getDefaultSites();
            blockedSitesArray = defaultSites;
            console.log('✅ [PHASE-2] Default sites initialized for fresh install:', defaultSites.length);
          } catch (error) {
            console.error('❌ [PHASE-2] Error initializing default sites:', error);
            blockedSitesArray = ['facebook.com', 'x.com', 'instagram.com', 'youtube.com', 'tiktok.com'];
          }
        } else if (blockedSitesArray.length === 0) {
          console.log('🚨 [PHASE-1-FIX] Preventing default initialization - webAppHasSynced:', webAppHasSynced);
          console.log('🚨 [PHASE-1-FIX] Not overwriting with defaults to preserve user choice');
        } else {
          console.log('✅ [PHASE-2] Found existing sites during migration:', blockedSitesArray.length);
        }
        
        this.blockedSites = new Set(blockedSitesArray);
        
        // DEBUG: Log instance state after loadState sets blockedSites
        console.log('🔍 [DEBUG-LOAD] Instance blockedSites set during loadState:', {
          loaded_sites: Array.from(this.blockedSites),
          loaded_count: this.blockedSites.size,
          source: 'unified_state',
          timestamp: new Date().toISOString()
        });
        
        // Load temporary overrides from legacy key  
        const overrides = result.temporaryOverrides || {};
        this.temporaryOverrides = new Map(Object.entries(overrides));
        
        console.log('🔄 [PHASE-4] Migration complete - will save unified state immediately');
        
        // Save unified state immediately to prevent race conditions with focus mode toggle
        await this.saveState();
      }
      
      console.log('🔍 [BLOCKING-DEBUG] Final loaded state:');
      console.log('  - Focus mode:', this.focusMode);
      console.log('  - Blocked sites:', this.blockedSites.size);
      console.log('  - Focus session active:', !!this.focusStartTime);
      console.log('  - currentLocalSessionId:', this.currentLocalSessionId);
      
      // If focus mode is active, restart the timer
      if (this.focusMode && this.focusStartTime) {
        try {
          this.startSessionTimer();
          console.log('🔄 [BLOCKING-DEBUG] Restored session timer for active deep focus session');
        } catch (error) {
          console.warn('⚠️ [BLOCKING-DEBUG] Error starting session timer during state load:', error);
        }
      }
    } catch (error) {
      console.error('❌ [BLOCKING-DEBUG] Failed to load blocking manager state:', error);
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
   * Cache URL for blocking screen (restored from 3643c8e)
   */
  cacheUrl(tabId, url) {
    if (!this.cachedUrls) {
      this.cachedUrls = new Map();
    }
    this.cachedUrls.set(tabId, url);
    
    // Also cache in simple storage as fallback
    chrome.storage.local.set({ cachedBlockedUrl: url }).catch(error => {
      console.error('Failed to cache URL in storage:', error);
    });
  }

  /**
   * Get cached URL for blocking screen (restored from 3643c8e)  
   */
  getCachedUrl(tabId) {
    if (!this.cachedUrls) {
      this.cachedUrls = new Map();
    }
    return this.cachedUrls.get(tabId) || null;
  }

  /**
   * Clear cached URL for blocking screen (restored from 3643c8e)
   */
  clearCachedUrl(tabId) {
    if (!this.cachedUrls) {
      this.cachedUrls = new Map();
    }
    this.cachedUrls.delete(tabId);
  }

  /**
   * Set temporary override for a domain (working version from 3643c8e)
   * This method expects duration in milliseconds to maintain compatibility with blocked.js
   */
  async setTemporaryOverride(domain, duration = 300000) { // 5 minutes default
    try {
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      const expiryTime = Date.now() + duration;
      
      this.temporaryOverrides.set(cleanDomain, expiryTime);
      await this.saveState();
      
      // Update blocking rules to exclude this domain temporarily
      if (this.focusMode) {
        await this.updateBlockingRules();
      }
      
      // Set timeout to remove override
      setTimeout(async () => {
        this.temporaryOverrides.delete(cleanDomain);
        if (this.focusMode) {
          await this.updateBlockingRules();
        }
      }, duration);
      
      console.log(`⏱️ Temporary override set for ${cleanDomain} for ${duration/1000}s`);
      return { success: true, domain: cleanDomain, expiryTime };
    } catch (error) {
      console.error('❌ Error setting temporary override:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if a domain should be blocked (working version from 3643c8e)
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
   * Update blocking rules using chrome.declarativeNetRequest (ATOMIC VERSION)
   * Prevents race conditions and rule ID collisions
   */
  async updateBlockingRules() {
    // Delegate to atomic version to prevent race conditions
    return this.atomicUpdateBlockingRules();
  }

  /**
   * DEPRECATED: Legacy updateBlockingRules implementation 
   * Replaced with atomic version to prevent race conditions
   */
  async updateBlockingRulesLegacy() {
    try {
      console.log('🔧 Updating blocking rules...');
      
      // Phase 5: Get current blocked sites using atomic read
      const storage = await this.atomicRead(['blockedSites']);
      const storageSites = storage.blockedSites || [];
      
      // Use instance blockedSites if available, otherwise use storage
      const blockedSites = this.blockedSites.size > 0 ? Array.from(this.blockedSites) : storageSites;
      
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
        
        // Wait a moment for Chrome to process the removal
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Only add blocking rules if focus mode is active and we have sites to block
      if (focusMode && blockedSites.length > 0) {
        // Filter out domains with active temporary overrides
        const now = Date.now();
        const activeDomains = blockedSites.filter(domain => {
          const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
          
          // Check if there's an active temporary override
          if (this.temporaryOverrides.has(cleanDomain)) {
            const expiryTime = this.temporaryOverrides.get(cleanDomain);
            if (now < expiryTime) {
              console.log(`⏰ Skipping blocking rule for ${cleanDomain} (temporary override active until ${new Date(expiryTime).toLocaleTimeString()})`);
              return false; // Skip this domain
            } else {
              // Remove expired override
              this.temporaryOverrides.delete(cleanDomain);
            }
          }
          return true;
        });
        
        console.log(`🔍 Domains to block: ${activeDomains.length}/${blockedSites.length} (${blockedSites.length - activeDomains.length} temporarily overridden)`);
        
        if (activeDomains.length > 0) {
          // Generate collision-resistant IDs by checking existing rules
          const remainingRules = await chrome.declarativeNetRequest.getDynamicRules();
          const existingIds = new Set(remainingRules.map(rule => rule.id));
          let nextRuleId = 2000 + Math.floor(Math.random() * 1000); // Start from random point to avoid conflicts
          
          const newRules = activeDomains.map((domain, index) => {
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
          console.log('ℹ️ All domains have temporary overrides - no blocking rules added');
          return { success: true, rulesAdded: 0 };
        }
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
      
      // DEBUG: Log current instance state before enableBlocking overwrites it
      console.log('🔍 [DEBUG-ENABLE-PRE] Instance state before enableBlocking:', {
        current_instance_sites: Array.from(this.blockedSites),
        current_instance_count: this.blockedSites.size,
        incoming_sites: sites,
        incoming_count: sites.length,
        timestamp: new Date().toISOString()
      });
      
      // BUGFIX: Update internal state and use unified saveState instead of direct write
      this.focusMode = true;
      this.blockedSites = new Set(sites);
      
      // DEBUG: Log instance state after enableBlocking sets it
      console.log('🔍 [DEBUG-ENABLE-POST] Instance state after enableBlocking:', {
        new_instance_sites: Array.from(this.blockedSites),
        new_instance_count: this.blockedSites.size,
        timestamp: new Date().toISOString()
      });
      
      // Save via unified state system
      await this.saveState();
      
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
      
      // BUGFIX: Update internal state and use unified saveState instead of direct write
      this.focusMode = false;
      
      // Save via unified state system (preserves blockedSites)
      await this.saveState();
      
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
      setTimeout(async () => {
        this.temporaryOverrides.delete(cleanDomain);
        if (this.focusMode) {
          await this.updateBlockingRules();
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
   * Set temporary override for a domain (working version from 3643c8e)
   * This method expects duration in milliseconds to maintain compatibility with blocked.js
   */
  async setTemporaryOverride(domain, duration = 300000) { // 5 minutes default
    try {
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      const expiryTime = Date.now() + duration;
      
      this.temporaryOverrides.set(cleanDomain, expiryTime);
      await this.saveState();
      
      // Update blocking rules to exclude this domain temporarily
      if (this.focusMode) {
        await this.updateBlockingRules();
      }
      
      // Set timeout to remove override
      setTimeout(async () => {
        this.temporaryOverrides.delete(cleanDomain);
        if (this.focusMode) {
          await this.updateBlockingRules();
        }
      }, duration);
      
      console.log(`⏱️ Temporary override set for ${cleanDomain} for ${duration/1000}s`);
      return { success: true, domain: cleanDomain, expiryTime };
    } catch (error) {
      console.error('❌ Error setting temporary override:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if a domain should be blocked (working version from 3643c8e)
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

  /**
   * Get default blocked sites from background.js
   * Phase 2: Default sites initialization
   */
  async getDefaultSites() {
    return new Promise((resolve) => {
      try {
        // Send message to background script to get default sites
        chrome.runtime.sendMessage({ type: 'GET_DEFAULT_BLOCKED_SITES' }, (response) => {
          if (response && response.sites) {
            resolve(response.sites);
          } else {
            // Fallback to hardcoded defaults
            resolve(['facebook.com', 'x.com', 'instagram.com', 'youtube.com', 'tiktok.com', 'reddit.com']);
          }
        });
      } catch (error) {
        console.error('❌ Error getting default sites:', error);
        // Fallback to hardcoded defaults
        resolve(['facebook.com', 'x.com', 'instagram.com', 'youtube.com', 'tiktok.com', 'reddit.com']);
      }
    });
  }

  /**
   * Phase 4: Sync external blockedSites key changes into unified state
   * Called when background.js updates blockedSites directly
   */
  async syncExternalBlockedSitesChange() {
    try {
      console.log('🔄 [PHASE-4] Syncing external blockedSites changes...');
      
      // DEBUG: Log current instance state before sync
      console.log('🔍 [DEBUG-SYNC-PRE] Instance state before external sync:', {
        current_instance_sites: Array.from(this.blockedSites),
        current_instance_count: this.blockedSites.size,
        timestamp: new Date().toISOString()
      });
      
      // Phase 5: Use atomic read for consistency
      const storage = await this.atomicRead(['blockedSites']);
      const externalSites = storage.blockedSites || [];
      
      // DEBUG: Log what we read from external storage
      console.log('🔍 [DEBUG-SYNC-READ] External storage data:', {
        external_sites: externalSites,
        external_count: externalSites.length,
        timestamp: new Date().toISOString()
      });
      
      // Update internal state
      this.blockedSites = new Set(externalSites);
      
      // DEBUG: Log instance state after sync
      console.log('🔍 [DEBUG-SYNC-POST] Instance state after external sync:', {
        new_instance_sites: Array.from(this.blockedSites),
        new_instance_count: this.blockedSites.size,
        timestamp: new Date().toISOString()
      });
      
      // Save to unified state to maintain consistency
      await this.saveState();
      
      console.log('✅ [PHASE-4] External blockedSites synced to unified state:', externalSites.length);
    } catch (error) {
      console.error('❌ [PHASE-4] Error syncing external blockedSites:', error);
    }
  }

  /**
   * Phase 5: Atomic storage operations to prevent race conditions
   */
  
  // Storage operation queue and lock
  storageQueue = [];
  storageInProgress = false;
  
  // Rules update queue and lock (prevent race conditions)
  rulesUpdateQueue = [];
  rulesUpdateInProgress = false;
  
  /**
   * Atomic storage read with retry logic
   */
  async atomicRead(keys, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔒 [PHASE-5] Atomic read attempt ${attempt}:`, keys);
        const result = await chrome.storage.local.get(keys);
        console.log(`✅ [PHASE-5] Atomic read successful:`, Object.keys(result));
        return result;
      } catch (error) {
        console.warn(`⚠️ [PHASE-5] Atomic read attempt ${attempt} failed:`, error);
        if (attempt === maxRetries) throw error;
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
      }
    }
  }

  /**
   * Atomic storage write with queue management
   */
  async atomicWrite(data, maxRetries = 3) {
    return new Promise((resolve, reject) => {
      this.storageQueue.push({ data, resolve, reject, maxRetries });
      this.processStorageQueue();
    });
  }

  /**
   * Process storage operation queue to prevent race conditions
   */
  async processStorageQueue() {
    if (this.storageInProgress || this.storageQueue.length === 0) {
      return;
    }

    this.storageInProgress = true;
    console.log(`🔒 [PHASE-5] Processing storage queue: ${this.storageQueue.length} operations`);

    while (this.storageQueue.length > 0) {
      const operation = this.storageQueue.shift();
      const { data, resolve, reject, maxRetries } = operation;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`💾 [PHASE-5] Atomic write attempt ${attempt}:`, Object.keys(data));
          await chrome.storage.local.set(data);
          console.log(`✅ [PHASE-5] Atomic write successful`);
          resolve();
          break;
        } catch (error) {
          console.warn(`⚠️ [PHASE-5] Atomic write attempt ${attempt} failed:`, error);
          if (attempt === maxRetries) {
            reject(error);
          } else {
            // Exponential backoff
            await new Promise(r => setTimeout(r, 100 * attempt));
          }
        }
      }
    }

    this.storageInProgress = false;
    console.log(`🔓 [PHASE-5] Storage queue processing complete`);
  }

  /**
   * Atomic rules update with queue management to prevent race conditions
   */
  async atomicUpdateBlockingRules() {
    return new Promise((resolve, reject) => {
      this.rulesUpdateQueue.push({ resolve, reject, timestamp: Date.now() });
      this.processRulesUpdateQueue();
    });
  }

  /**
   * Process rules update queue to prevent race conditions and rule ID collisions
   */
  async processRulesUpdateQueue() {
    if (this.rulesUpdateInProgress || this.rulesUpdateQueue.length === 0) {
      return;
    }

    this.rulesUpdateInProgress = true;
    console.log(`🔒 [RULES-QUEUE] Processing rules update queue: ${this.rulesUpdateQueue.length} operations`);

    // Process all queued requests as a single batch operation
    const operations = [...this.rulesUpdateQueue];
    this.rulesUpdateQueue = []; // Clear queue

    try {
      const result = await this.updateBlockingRulesInternal();
      
      // Resolve all queued promises with the same result
      operations.forEach(({ resolve }) => resolve(result));
      console.log(`✅ [RULES-QUEUE] Batch rules update completed successfully`);
    } catch (error) {
      // Reject all queued promises with the same error
      operations.forEach(({ reject }) => reject(error));
      console.error(`❌ [RULES-QUEUE] Batch rules update failed:`, error);
    }

    this.rulesUpdateInProgress = false;
    console.log(`🔓 [RULES-QUEUE] Rules update queue processing complete`);
    
    // Process any new requests that came in while we were working
    if (this.rulesUpdateQueue.length > 0) {
      setTimeout(() => this.processRulesUpdateQueue(), 10);
    }
  }

  /**
   * Internal rules update implementation with collision-resistant ID generation
   */
  async updateBlockingRulesInternal() {
    try {
      console.log('🔧 [ATOMIC] Updating blocking rules (collision-resistant)...');
      
      // DEBUG: Check storage state before processing rules
      const ruleUpdateStorage = await this.atomicRead(['blockedSites', 'blockingManagerState']);
      console.log('🔍 [DEBUG-RULES-PRE] Storage state during rules update:', {
        legacy_blockedSites: ruleUpdateStorage.blockedSites || [],
        unified_blockedSites: ruleUpdateStorage.blockingManagerState?.blockedSites || [],
        instance_blockedSites: Array.from(this.blockedSites),
        instance_focusMode: this.focusMode
      });
      
      // Always use the instance blockedSites (from unified state) to prevent fallback to old storage
      // The unified state is the authoritative source for blocked sites
      const blockedSites = Array.from(this.blockedSites);
      
      // Use the instance focusMode (this.focusMode) rather than storage 
      const focusMode = this.focusMode;
      
      console.log('🔍 [ATOMIC] Current blocking state:', {
        blockedSites: blockedSites,
        blockedSitesLength: blockedSites.length,
        focusMode: focusMode,
        instanceFocusMode: this.focusMode
      });
      
      // Get existing rules to clean up - ONLY remove rules in our range (2000-9999)
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const ourRuleIds = existingRules.filter(rule => rule.id >= 2000 && rule.id < 10000).map(rule => rule.id);
      
      // Remove only our existing blocking rules
      if (ourRuleIds.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: ourRuleIds
        });
        console.log('🧹 [ATOMIC] Removed', ourRuleIds.length, 'existing Deep Focus blocking rules');
      }
      
      // Only add blocking rules if focus mode is active and we have sites to block
      if (focusMode && blockedSites.length > 0) {
        // Filter out domains with active temporary overrides
        const now = Date.now();
        const activeDomains = blockedSites.filter(domain => {
          const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
          
          // Check if there's an active temporary override
          if (this.temporaryOverrides.has(cleanDomain)) {
            const expiryTime = this.temporaryOverrides.get(cleanDomain);
            if (now < expiryTime) {
              console.log(`⏰ [ATOMIC] Skipping blocking rule for ${cleanDomain} (temporary override active)`);
              return false; // Skip this domain
            } else {
              // Remove expired override
              this.temporaryOverrides.delete(cleanDomain);
            }
          }
          return true;
        });
        
        console.log(`🔍 [ATOMIC] Domains to block: ${activeDomains.length}/${blockedSites.length}`);
        
        if (activeDomains.length > 0) {
          // Enhanced collision-resistant ID generation
          const allExistingRules = await chrome.declarativeNetRequest.getDynamicRules();
          const existingIds = new Set(allExistingRules.map(rule => rule.id));
          
          // Use timestamp + index for collision resistance
          const baseId = 2000 + (Date.now() % 1000); // Base ID with timestamp component
          let nextRuleId = baseId;
          
          const newRules = activeDomains.map((domain, index) => {
            // Find next available ID with collision resistance
            while (existingIds.has(nextRuleId)) {
              nextRuleId += 1;
              // If we've wrapped around too far, jump to a new range
              if (nextRuleId >= 9999) {
                nextRuleId = 3000 + Math.floor(Math.random() * 1000);
              }
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
          
          console.log('📋 [ATOMIC] Creating collision-resistant rules with IDs:', newRules.map(r => r.id));
          
          await chrome.declarativeNetRequest.updateDynamicRules({
            addRules: newRules
          });
          
          console.log('✅ [ATOMIC] Added', newRules.length, 'blocking rules for focus mode');
          return { success: true, rulesAdded: newRules.length, ruleIds: newRules.map(r => r.id) };
        } else {
          console.log('ℹ️ [ATOMIC] All domains have temporary overrides - no blocking rules added');
          return { success: true, rulesAdded: 0 };
        }
      } else {
        console.log('ℹ️ [ATOMIC] No blocking rules needed (focus mode:', focusMode, ', sites:', blockedSites.length, ')');
        return { success: true, rulesAdded: 0 };
      }
      
    } catch (error) {
      console.error('❌ [ATOMIC] Failed to update blocking rules:', error);
      return { success: false, error: error.message };
    }
  }
}

// Make BlockingManager globally available for service worker
self.BlockingManager = BlockingManager; 