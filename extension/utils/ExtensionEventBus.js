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
  }
};

// Support both module and non-module environments
if (typeof exports !== 'undefined') {
  exports.ExtensionEventBus = ExtensionEventBus;
} else if (typeof define === 'function' && define.amd) {
  define([], function() { return ExtensionEventBus; });
} else {
  window.ExtensionEventBus = ExtensionEventBus;
} 