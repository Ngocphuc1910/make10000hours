/**
 * ExtensionEventBus - Centralized event handling for extension communication
 * Handles message passing between different parts of the extension
 */

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

// Make it available globally
window.ExtensionEventBus = ExtensionEventBus; 