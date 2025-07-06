/**
 * BlockingManager class for handling site blocking functionality
 */

import { ExtensionEventBus } from '../utils/ExtensionEventBus.js';

export class BlockingManager {
  constructor() {
    this.storageManager = null;
    this.initialized = false;
    this.urlCache = new Map();

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
   * Start the session timer that increments duration every minute
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
            
            // Update session duration
            await this.storageManager.updateDeepFocusSessionDuration(
              this.currentLocalSessionId, 
              elapsedMinutes
            );
            // Note: updateDeepFocusSessionDuration now handles the broadcast
          }
        }
      } catch (error) {
        console.error('❌ Error in session timer:', error);
      }
    }, 60 * 1000); // Update every minute
  }

  // ... rest of the BlockingManager methods
} 