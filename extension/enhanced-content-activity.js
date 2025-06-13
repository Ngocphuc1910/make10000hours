/**
 * Enhanced Content Script Activity Detector
 * Integrates with Enhanced Activity Manager for robust sleep/inactivity detection
 */

class EnhancedContentActivityDetector {
  constructor() {
    this.isActive = true;
    this.lastActivity = Date.now();
    this.activityThreshold = 30000; // 30 seconds (increased from 5 seconds)
    this.reportInterval = null;
    this.visibilityCheckInterval = null;
    this.focusMode = false;
    
    // Enhanced tracking
    this.isPageVisible = !document.hidden;
    this.isWindowFocused = document.hasFocus();
    this.lastReportTime = Date.now();
    this.reportFrequency = 10000; // Report every 10 seconds
    this.heartbeatFrequency = 30000; // Heartbeat every 30 seconds
    
    // Activity event throttling
    this.activityThrottle = 1000; // 1 second throttle
    this.lastActivityUpdate = 0;
    
    this.initialize();
  }

  /**
   * Initialize enhanced activity detection
   */
  initialize() {
    if (!this.isTrackablePage()) {
      return;
    }

    console.log('🚀 Enhanced Content Activity Detector initializing...');
    
    this.setupEnhancedActivityListeners();
    this.setupVisibilityMonitoring();
    this.setupWebAppCommunication();
    this.startEnhancedReporting();
    this.checkFocusMode();
    
    console.log('✅ Enhanced activity detector initialized for:', window.location.hostname);
  }

  /**
   * Set up enhanced activity listeners with better sleep detection
   */
  setupEnhancedActivityListeners() {
    const activityEvents = [
      'mousedown',
      'mousemove', 
      'keypress',
      'keydown',
      'scroll',
      'touchstart',
      'touchmove',
      'click',
      'focus',
      'wheel'
    ];

    // Add event listeners with throttling
    activityEvents.forEach(eventType => {
      document.addEventListener(eventType, (event) => {
        this.handleActivityEvent(eventType, event);
      }, { passive: true });
    });

    // Enhanced page visibility handling
    document.addEventListener('visibilitychange', () => {
      this.handleVisibilityChange();
    });

    // Enhanced focus/blur handling
    window.addEventListener('focus', () => {
      this.handleWindowFocus();
    });

    window.addEventListener('blur', () => {
      this.handleWindowBlur();
    });

    // Page lifecycle events for better sleep detection
    window.addEventListener('beforeunload', () => {
      this.handlePageUnload();
    });

    window.addEventListener('unload', () => {
      this.handlePageUnload();
    });

    // Handle page freeze/resume (for mobile and modern browsers)
    if ('onfreeze' in window) {
      window.addEventListener('freeze', () => {
        console.log('🧊 Page freeze detected');
        this.handlePageFreeze();
      });
    }

    if ('onresume' in window) {
      window.addEventListener('resume', () => {
        console.log('🔄 Page resume detected');
        this.handlePageResume();
      });
    }

    console.log('🎯 Enhanced activity listeners set up');
  }

  /**
   * Handle activity events with throttling
   */
  handleActivityEvent(eventType, event) {
    const now = Date.now();
    
    // Throttle activity updates
    if (now - this.lastActivityUpdate < this.activityThrottle) {
      return;
    }
    
    this.lastActivity = now;
    this.lastActivityUpdate = now;
    this.isActive = true;
    
    // Report immediately if was inactive
    if (!this.isActive) {
      this.reportActivityImmediate();
    }
    
    console.log(`🎯 Activity detected: ${eventType}`);
  }

  /**
   * Set up enhanced visibility monitoring
   */
  setupVisibilityMonitoring() {
    // Check visibility state every 5 seconds
    this.visibilityCheckInterval = setInterval(() => {
      this.checkVisibilityState();
    }, 5000);
  }

  /**
   * Enhanced visibility change handling
   */
  handleVisibilityChange() {
    const wasVisible = this.isPageVisible;
    this.isPageVisible = !document.hidden;
    
    console.log(`👁️ Visibility changed: ${wasVisible ? 'visible' : 'hidden'} → ${this.isPageVisible ? 'visible' : 'hidden'}`);
    
    if (this.isPageVisible && !wasVisible) {
      // Page became visible - user returned
      this.handleUserReturn();
    } else if (!this.isPageVisible && wasVisible) {
      // Page became hidden - potential sleep/away
      this.handleUserAway();
    }
    
    this.reportActivityImmediate();
  }

  /**
   * Handle window focus events
   */
  handleWindowFocus() {
    console.log('🎯 Window gained focus');
    this.isWindowFocused = true;
    this.handleUserReturn();
  }

  /**
   * Handle window blur events
   */
  handleWindowBlur() {
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
    this.reportActivityImmediate();
  }

  /**
   * Handle user going away (blur/hidden)
   */
  handleUserAway() {
    console.log('💤 User went away');
    this.checkActiveStatus(); // Immediate activity check
    this.reportActivityImmediate();
  }

  /**
   * Handle page freeze (system sleep/suspend)
   */
  handlePageFreeze() {
    console.log('🧊 Page freeze - system likely sleeping');
    this.isActive = false;
    this.reportActivityImmediate('freeze');
  }

  /**
   * Handle page resume (system wake)
   */
  handlePageResume() {
    console.log('🌅 Page resume - system likely waking');
    this.lastActivity = Date.now();
    this.isActive = true;
    this.reportActivityImmediate('resume');
  }

  /**
   * Handle page unload
   */
  handlePageUnload() {
    console.log('👋 Page unloading');
    this.reportActivityImmediate('unload');
  }

  /**
   * Check visibility state for long-term hidden detection
   */
  checkVisibilityState() {
    const now = Date.now();
    const timeSinceLastReport = now - this.lastReportTime;
    
    // If page has been hidden for a while, report as inactive
    if (!this.isPageVisible && timeSinceLastReport > 60000) { // 1 minute
      console.log('📴 Page hidden for extended period, marking inactive');
      this.isActive = false;
      this.reportActivityImmediate();
    }
  }

  /**
   * Enhanced reporting with heartbeat
   */
  startEnhancedReporting() {
    // Regular activity reporting
    this.reportInterval = setInterval(() => {
      this.checkActiveStatus();
      this.reportActivity();
    }, this.reportFrequency);

    // Heartbeat for long-term monitoring
    setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatFrequency);
  }

  /**
   * Check if user is still active with enhanced logic
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
      console.log(`🔄 Activity status changed: ${wasActive ? 'active' : 'inactive'} → ${this.isActive ? 'active' : 'inactive'}`);
      console.log(`⏰ Time since last activity: ${Math.round(timeSinceLastActivity / 1000)}s`);
    }
  }

  /**
   * Report activity immediately (for important events)
   */
  async reportActivityImmediate(eventType = 'activity') {
    await this.reportActivity(false, eventType);
  }

  /**
   * Enhanced activity reporting
   */
  async reportActivity(isUnloading = false, eventType = 'periodic') {
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
        isUnloading: isUnloading,
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
          console.log(`📊 Activity reported (${eventType}):`, {
            isActive: this.isActive,
            timeSinceActivity: Math.round(timeSinceLastActivity / 1000) + 's',
            isVisible: this.isPageVisible,
            isFocused: this.isWindowFocused
          });
        } else {
          console.warn('⚠️ Failed to report activity:', response?.error);
        }
      }
    } catch (error) {
      console.debug('Could not report activity:', error);
    }
  }

  /**
   * Send heartbeat to maintain connection
   */
  async sendHeartbeat() {
    try {
      await chrome.runtime.sendMessage({
        type: 'ACTIVITY_HEARTBEAT',
        payload: {
          domain: window.location.hostname,
          timestamp: Date.now(),
          isActive: this.isActive,
          isVisible: this.isPageVisible
        }
      });
    } catch (error) {
      console.debug('Heartbeat failed:', error);
    }
  }

  /**
   * Set up web app communication bridge
   */
  setupWebAppCommunication() {
    window.addEventListener('message', async (event) => {
      if (event.source !== window || event.data?.type !== 'EXTENSION_REQUEST') {
        return;
      }

      const { messageId, payload } = event.data;
      
      try {
        const response = await chrome.runtime.sendMessage(payload);
        
        window.postMessage({
          extensionResponseId: messageId,
          response: response
        }, '*');
      } catch (error) {
        window.postMessage({
          extensionResponseId: messageId,
          response: { success: false, error: error.message }
        }, '*');
      }
    });

    console.log('🌉 Web app communication bridge established');
  }

  /**
   * Check focus mode status
   */
  async checkFocusMode() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_CURRENT_STATE'
      });

      if (response?.success && response.data?.focusStats?.focusMode) {
        this.focusMode = true;
        this.showFocusIndicator();
      }
    } catch (error) {
      console.debug('Could not check focus mode:', error);
    }
  }

  /**
   * Show focus mode indicator - VISUAL BUBBLE DISABLED
   */
  showFocusIndicator() {
    // Remove existing indicator (cleanup)
    this.hideFocusIndicator();
    
    // Keep all the important logic but remove the visual bubble
    // The focus mode state is still tracked, just no bubble shown
    console.log('Focus mode enabled - bubble display disabled');
  }

  /**
   * Hide focus mode indicator
   */
  hideFocusIndicator() {
    const indicator = document.getElementById('enhanced-focus-indicator');
    if (indicator) {
      indicator.remove();
    }
    this.focusMode = false;
  }

  /**
   * Check if page should be tracked
   */
  isTrackablePage() {
    const url = window.location.href;
    const nonTrackableProtocols = ['chrome:', 'chrome-extension:', 'moz-extension:', 'about:', 'file:'];
    
    return !nonTrackableProtocols.some(protocol => url.startsWith(protocol));
  }

  /**
   * Get enhanced activity status
   */
  getActivityStatus() {
    return {
      isActive: this.isActive,
      lastActivity: this.lastActivity,
      timeSinceLastActivity: Date.now() - this.lastActivity,
      isVisible: this.isPageVisible,
      isWindowFocused: this.isWindowFocused,
      focusMode: this.focusMode,
      activityThreshold: this.activityThreshold,
      domain: window.location.hostname
    };
  }

  /**
   * Cleanup
   */
  cleanup() {
    if (this.reportInterval) {
      clearInterval(this.reportInterval);
    }
    
    if (this.visibilityCheckInterval) {
      clearInterval(this.visibilityCheckInterval);
    }
    
    this.reportActivityImmediate('cleanup');
    console.log('🧹 Enhanced content activity detector cleaned up');
  }
}

// Initialize the enhanced detector
const enhancedActivityDetector = new EnhancedContentActivityDetector();

// Enhanced message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_ENHANCED_ACTIVITY_STATUS':
      sendResponse({
        success: true,
        data: enhancedActivityDetector.getActivityStatus()
      });
      break;
      
    case 'FOCUS_MODE_CHANGED':
      if (message.payload.enabled) {
        enhancedActivityDetector.focusMode = true;
        enhancedActivityDetector.showFocusIndicator();
      } else {
        enhancedActivityDetector.hideFocusIndicator();
      }
      sendResponse({ success: true });
      break;
      
    case 'FORCE_ACTIVITY_UPDATE':
      enhancedActivityDetector.handleUserReturn();
      sendResponse({ success: true });
      break;
      
    case 'PING':
      sendResponse({ 
        success: true, 
        pong: true,
        activityStatus: enhancedActivityDetector.getActivityStatus()
      });
      break;
      
    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  enhancedActivityDetector.cleanup();
});

console.log('🚀 Enhanced Content Activity Detector loaded'); 