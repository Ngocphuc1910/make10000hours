/**
 * Content Script for Focus Time Tracker Extension
 * Detects user activity and communicates with background script
 */

class ActivityDetector {
  constructor() {
    this.isActive = true;
    this.lastActivity = Date.now();
    this.activityThreshold = 5000; // 5 seconds
    this.reportInterval = null;
    this.focusMode = false;
    
    this.initialize();
  }

  /**
   * Initialize the activity detector
   */
  initialize() {
    // Only run on trackable pages
    if (!this.isTrackablePage()) {
      return;
    }

    this.setupActivityListeners();
    this.setupWebAppCommunication();
    this.startReporting();
    this.checkFocusMode();
    
    console.log('Activity detector initialized for:', window.location.hostname);
  }

  /**
   * Set up web app communication bridge
   */
  setupWebAppCommunication() {
    window.addEventListener('message', async (event) => {
      // Only accept messages from same origin and with correct type
      if (event.source !== window || event.data?.type !== 'EXTENSION_REQUEST') {
        return;
      }

      const { messageId, payload } = event.data;
      
      try {
        // Forward message to extension background script
        const response = await chrome.runtime.sendMessage(payload);
        
        // Send response back to web app
        window.postMessage({
          extensionResponseId: messageId,
          response: response
        }, '*');
      } catch (error) {
        // Send error response back to web app
        window.postMessage({
          extensionResponseId: messageId,
          response: { success: false, error: error.message }
        }, '*');
      }
    });

    console.log('Web app communication bridge established');
  }

  /**
   * Set up activity detection listeners
   */
  setupActivityListeners() {
    const activityEvents = [
      'mousedown',
      'mousemove', 
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ];

    // Add event listeners for activity detection
    activityEvents.forEach(eventType => {
      document.addEventListener(eventType, () => {
        this.updateActivity();
      }, { passive: true });
    });

    // Page visibility change
    document.addEventListener('visibilitychange', () => {
      this.handleVisibilityChange();
    });

    // Focus/blur events
    window.addEventListener('focus', () => {
      this.handleWindowFocus();
    });

    window.addEventListener('blur', () => {
      this.handleWindowBlur();
    });

    // Beforeunload to report final activity
    window.addEventListener('beforeunload', () => {
      this.reportActivity(true);
    });
  }

  /**
   * Update last activity timestamp
   */
  updateActivity() {
    const now = Date.now();
    const timeSinceLastActivity = now - this.lastActivity;
    
    // Only update if enough time has passed to avoid spam
    if (timeSinceLastActivity > 1000) { // 1 second throttle
      this.lastActivity = now;
      this.isActive = true;
      
      // Report activity immediately if it was inactive
      if (!this.isActive) {
        this.reportActivity();
      }
    }
  }

  /**
   * Handle page visibility changes
   */
  handleVisibilityChange() {
    if (document.hidden) {
      this.isActive = false;
      this.reportActivity();
    } else {
      this.isActive = true;
      this.lastActivity = Date.now();
      this.reportActivity();
    }
  }

  /**
   * Handle window focus
   */
  handleWindowFocus() {
    this.isActive = true;
    this.lastActivity = Date.now();
    this.reportActivity();
  }

  /**
   * Handle window blur
   */
  handleWindowBlur() {
    this.isActive = false;
    this.reportActivity();
  }

  /**
   * Start periodic activity reporting
   */
  startReporting() {
    // Report activity every 10 seconds
    this.reportInterval = setInterval(() => {
      this.checkActiveStatus();
      this.reportActivity();
    }, 10000);
  }

  /**
   * Check if user is still active
   */
  checkActiveStatus() {
    const timeSinceLastActivity = Date.now() - this.lastActivity;
    
    if (timeSinceLastActivity > this.activityThreshold) {
      this.isActive = false;
    }
  }

  /**
   * Report activity to background script
   */
  async reportActivity(isUnloading = false) {
    try {
      const activityData = {
        isActive: this.isActive,
        lastActivity: this.lastActivity,
        url: window.location.href,
        domain: window.location.hostname,
        timestamp: Date.now(),
        isUnloading: isUnloading
      };

      // Send message to background script
      if (chrome.runtime && chrome.runtime.sendMessage) {
        const response = await chrome.runtime.sendMessage({
          type: 'ACTIVITY_DETECTED',
          payload: activityData
        });

        if (!response?.success) {
          console.warn('Failed to report activity:', response?.error);
        }
      }
    } catch (error) {
      // Extension might be reloading or unavailable
      console.debug('Could not report activity:', error);
    }
  }

  /**
   * Check if focus mode is active and show indicators
   */
  async checkFocusMode() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_CURRENT_STATE'
      });

      if (response?.success && response.data?.focusMode) {
        this.focusMode = true;
        this.showFocusIndicator();
      }
    } catch (error) {
      console.debug('Could not check focus mode:', error);
    }
  }

  /**
   * Show focus mode indicator on page
   */
  showFocusIndicator() {
    // Create a subtle focus mode indicator
    const indicator = document.createElement('div');
    indicator.id = 'focus-time-tracker-indicator';
    indicator.innerHTML = `
      <div style="
        position: fixed;
        top: 10px;
        right: 10px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        opacity: 0.9;
        cursor: pointer;
      ">
        🎯 Focus Mode
      </div>
    `;

    // Add click handler to toggle focus mode
    indicator.addEventListener('click', async () => {
      try {
        await chrome.runtime.sendMessage({
          type: 'TOGGLE_FOCUS_MODE'
        });
        this.hideFocusIndicator();
      } catch (error) {
        console.error('Error toggling focus mode:', error);
      }
    });

    document.body.appendChild(indicator);

    // Auto-hide after 5 seconds
    setTimeout(() => {
      const elem = document.getElementById('focus-time-tracker-indicator');
      if (elem) {
        elem.style.opacity = '0.3';
      }
    }, 5000);
  }

  /**
   * Hide focus mode indicator
   */
  hideFocusIndicator() {
    const indicator = document.getElementById('focus-time-tracker-indicator');
    if (indicator) {
      indicator.remove();
    }
    this.focusMode = false;
  }

  /**
   * Check if current page should be tracked
   */
  isTrackablePage() {
    const url = window.location.href;
    const nonTrackableProtocols = ['chrome:', 'chrome-extension:', 'moz-extension:', 'about:', 'file:'];
    
    return !nonTrackableProtocols.some(protocol => url.startsWith(protocol));
  }

  /**
   * Get current activity status
   */
  getActivityStatus() {
    return {
      isActive: this.isActive,
      lastActivity: this.lastActivity,
      timeSinceLastActivity: Date.now() - this.lastActivity,
      focusMode: this.focusMode
    };
  }

  /**
   * Clean up listeners and intervals
   */
  cleanup() {
    if (this.reportInterval) {
      clearInterval(this.reportInterval);
    }
    
    // Report final activity
    this.reportActivity(true);
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_ACTIVITY_STATUS':
      sendResponse({
        success: true,
        data: activityDetector.getActivityStatus()
      });
      break;
      
    case 'FOCUS_MODE_CHANGED':
      if (message.payload.enabled) {
        activityDetector.focusMode = true;
        activityDetector.showFocusIndicator();
      } else {
        activityDetector.hideFocusIndicator();
      }
      sendResponse({ success: true });
      break;
      
    case 'PING':
      sendResponse({ success: true, pong: true });
      break;
      
    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }
  
  return true; // Keep message channel open
});

// Initialize activity detector
const activityDetector = new ActivityDetector();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  activityDetector.cleanup();
}); 