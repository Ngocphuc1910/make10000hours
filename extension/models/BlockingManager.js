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
      // Broadcast to all extension components
      chrome.runtime.sendMessage({
        type: ExtensionEventBus.EVENTS.DEEP_FOCUS_UPDATE,
        payload
      }).catch(() => {
        // Ignore errors when no listeners are connected
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

      this.focusMode = !this.focusMode;
      
      if (this.focusMode) {
        await this.startLocalDeepFocusSession();
      } else {
        await this.completeLocalDeepFocusSession();
      }

      // Save state
      await this.saveState();
      
      return {
        success: true,
        focusMode: this.focusMode,
        sessionId: this.currentLocalSessionId
      };
    } catch (error) {
      console.error('❌ Error toggling focus mode:', error);
      // Revert focus mode if error occurs
      this.focusMode = !this.focusMode;
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

  // ... rest of the BlockingManager methods
} 