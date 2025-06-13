/**
 * Content Script for Focus Time Tracker Extension
 * Detects user activity and communicates with background script
 */

class ActivityDetector {
  constructor() {
    this.isActive = true;
    this.lastActivity = Date.now();
    this.activityThreshold = 30000; // 30 seconds (enhanced from 5 seconds)
    this.reportInterval = null;
    this.focusMode = false;
    
    // Enhanced tracking
    this.isPageVisible = !document.hidden;
    this.isWindowFocused = document.hasFocus();
    this.lastReportTime = Date.now();
    this.reportFrequency = 10000; // Report every 10 seconds
    
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

    // Enhanced page visibility change
    document.addEventListener('visibilitychange', () => {
      this.handleEnhancedVisibilityChange();
    });

    // Enhanced focus/blur events
    window.addEventListener('focus', () => {
      this.handleEnhancedWindowFocus();
    });

    window.addEventListener('blur', () => {
      this.handleEnhancedWindowBlur();
    });

    // Page lifecycle events for sleep detection
    window.addEventListener('beforeunload', () => {
      this.handlePageUnload();
    });

    // Page freeze/resume for system sleep detection
    if ('onfreeze' in window) {
      window.addEventListener('freeze', () => {
        console.log('🧊 Page freeze detected - system likely sleeping');
        this.handlePageFreeze();
      });
    }

    if ('onresume' in window) {
      window.addEventListener('resume', () => {
        console.log('🌅 Page resume detected - system likely waking');
        this.handlePageResume();
      });
    }

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
   * Enhanced visibility change handling
   */
  handleEnhancedVisibilityChange() {
    const wasVisible = this.isPageVisible;
    this.isPageVisible = !document.hidden;
    
    console.log(`👁️ Visibility: ${wasVisible ? 'visible' : 'hidden'} → ${this.isPageVisible ? 'visible' : 'hidden'}`);
    
    if (this.isPageVisible && !wasVisible) {
      this.handleUserReturn();
    } else if (!this.isPageVisible && wasVisible) {
      this.handleUserAway();
    }
    
    this.reportEnhancedActivity('visibility');
  }

  /**
   * Enhanced window focus handling
   */
  handleEnhancedWindowFocus() {
    console.log('🎯 Window gained focus');
    this.isWindowFocused = true;
    this.handleUserReturn();
  }

  /**
   * Enhanced window blur handling
   */
  handleEnhancedWindowBlur() {
    console.log('😴 Window lost focus');
    this.isWindowFocused = false;
    this.handleUserAway();
  }

  /**
   * Handle user returning (focus/visibility)
   */
  handleUserReturn() {
    console.log('👋 User returned');
    this.lastActivity = Date.now();
    this.isActive = true;
    this.reportEnhancedActivity('return');
  }

  /**
   * Handle user going away (blur/hidden)
   */
  handleUserAway() {
    console.log('💤 User went away');
    this.checkActiveStatus();
    this.reportEnhancedActivity('away');
  }

  /**
   * Handle page freeze (system sleep)
   */
  handlePageFreeze() {
    console.log('🧊 Page freeze - system likely sleeping');
    this.isActive = false;
    this.reportEnhancedActivity('freeze');
  }

  /**
   * Handle page resume (system wake)
   */
  handlePageResume() {
    console.log('🌅 Page resume - system likely waking');
    this.lastActivity = Date.now();
    this.isActive = true;
    this.reportEnhancedActivity('resume');
  }

  /**
   * Handle page unload
   */
  handlePageUnload() {
    console.log('👋 Page unloading');
    this.reportEnhancedActivity('unload');
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
   * Enhanced activity status check
   */
  checkActiveStatus() {
    const now = Date.now();
    const timeSinceLastActivity = now - this.lastActivity;
    
    // More strict activity checking
    const wasActive = this.isActive;
    this.isActive = timeSinceLastActivity < this.activityThreshold && 
                   this.isPageVisible && 
                   this.isWindowFocused;
    
    if (wasActive !== this.isActive) {
      console.log(`🔄 Activity status: ${wasActive ? 'active' : 'inactive'} → ${this.isActive ? 'active' : 'inactive'}`);
      console.log(`⏰ Time since activity: ${Math.round(timeSinceLastActivity / 1000)}s`);
    }
  }

  /**
   * Enhanced activity reporting
   */
  async reportEnhancedActivity(eventType = 'periodic') {
    try {
      const now = Date.now();
      const timeSinceLastActivity = now - this.lastActivity;
      
      const activityData = {
        isActive: this.isActive,
        lastActivity: this.lastActivity,
        timeSinceLastActivity: timeSinceLastActivity,
        isVisible: this.isPageVisible,
        isWindowFocused: this.isWindowFocused,
        url: window.location.href,
        domain: window.location.hostname,
        timestamp: now,
        eventType: eventType,
        activityThreshold: this.activityThreshold
      };

      // Send enhanced message to background script
      if (chrome.runtime && chrome.runtime.sendMessage) {
        const response = await chrome.runtime.sendMessage({
          type: 'ENHANCED_ACTIVITY_DETECTED',
          payload: activityData
        });

        if (response?.success) {
          this.lastReportTime = now;
          console.log(`📊 Enhanced activity reported (${eventType}):`, {
            isActive: this.isActive,
            timeSinceActivity: Math.round(timeSinceLastActivity / 1000) + 's',
            isVisible: this.isPageVisible,
            isFocused: this.isWindowFocused
          });
        } else {
          console.warn('⚠️ Failed to report enhanced activity:', response?.error);
        }
      }
    } catch (error) {
      console.debug('Could not report enhanced activity:', error);
    }
  }

  /**
   * Legacy activity reporting (for compatibility)
   */
  async reportActivity(isUnloading = false) {
    // Use enhanced reporting instead
    await this.reportEnhancedActivity(isUnloading ? 'unload' : 'legacy');
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
      
    case 'FOCUS_STATE_CHANGED':
      // Update local state and forward to web app if present
      activityDetector.focusMode = message.payload.isActive;
      if (message.payload.isActive) {
        activityDetector.showFocusIndicator();
      } else {
        activityDetector.hideFocusIndicator();
      }
      
      // Forward to web app
      window.postMessage({
        type: 'EXTENSION_FOCUS_STATE_CHANGED',
        payload: { isActive: message.payload.isActive }
      }, '*');
      
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