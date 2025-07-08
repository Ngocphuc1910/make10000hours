/**
 * BlockingManager class for handling site blocking functionality
 */

import { ExtensionEventBus } from '../utils/ExtensionEventBus.js';

export class BlockingManager {
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
      
      // Initialize blocking rules
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
      } else {
        console.log('⏹️ Completing deep focus session...');
        await this.completeLocalDeepFocusSession();
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
      
      await chrome.storage.local.set({ blockingManagerState: state });
      console.log('💾 Blocking manager state saved');
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
      const result = await chrome.storage.local.get(['blockingManagerState']);
      if (result.blockingManagerState) {
        const state = result.blockingManagerState;
        this.focusMode = state.focusMode || false;
        this.currentLocalSessionId = state.currentLocalSessionId || null;
        this.blockedSites = state.blockedSites || [];
        
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
        
        console.log('📂 Blocking manager state loaded:', state);
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