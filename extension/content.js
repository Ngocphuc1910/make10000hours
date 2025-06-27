/**
 * Content Script for Focus Time Tracker Extension
 * Detects user activity and communicates with background script
 */

// Enhanced Content Script with Activity Detection
console.log('🚀 Content script loading on:', window.location.href);
console.log('🔍 Chrome extension API available:', typeof chrome !== 'undefined' && !!chrome.runtime);
console.log('🔍 Document ready state:', document.readyState);

class ActivityDetector {
  constructor() {
    this.lastActivity = Date.now();
    this.isActive = true;
    this.isPageVisible = !document.hidden;
    this.isWindowFocused = document.hasFocus();
    this.activityCheckInterval = null;
    this.reportingInterval = null;
    this.inactivityThreshold = 30000; // 30 seconds
    this.reportingFrequency = 10000; // 10 seconds
    
    // Add flags to prevent duplicate setup
    this.isInitialized = false;
    this.messageListenersSetup = false;
    this.chromeListenerSetup = false;
    
    this.initialize();
  }

  /**
   * Initialize the activity detector
   */
  initialize() {
    // Prevent duplicate initialization
    if (this.isInitialized) {
      console.log('🔄 ActivityDetector already initialized, skipping...');
      return;
    }

    try {
      console.log('🚀 Initializing Enhanced ActivityDetector...');
      
      // Set up event listeners for activity detection
      this.setupEventListeners();
      
      // Set up web app communication bridge
      this.setupWebAppCommunication();
      
      // Set up Chrome runtime listener
      this.setupChromeListener();
      
      // Start activity monitoring
      this.startReporting();
      
      // Mark as initialized
      this.isInitialized = true;
      
      console.log('✅ Enhanced ActivityDetector initialized successfully');
      
      // Send a test message to verify extension is working
      window.postMessage({
        type: 'EXTENSION_STATUS',
        payload: { status: 'online', timestamp: Date.now() },
        source: 'make10000hours-extension'
      }, '*');
      
    } catch (error) {
      console.error('❌ Failed to initialize ActivityDetector:', error);
      console.error('🔍 Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Set up web app communication bridge
   */
  setupWebAppCommunication() {
    // Prevent duplicate setup
    if (this.messageListenersSetup) {
      console.log('🔄 Web app communication already set up, skipping...');
      return;
    }

    // Check if Chrome extension API is available
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      console.warn('⚠️ Chrome extension API not available in content script');
      return;
    }

    console.log('🔧 Setting up web app communication bridge...');

    // Listen for messages from web app
    window.addEventListener('message', async (event) => {
      // Only accept messages from same origin
      if (event.origin !== window.location.origin) {
        return;
      }

      // Handle EXTENSION_REQUEST messages (new simplified method)
      if (event.data?.type === 'EXTENSION_REQUEST') {
        console.log('🔄 Received EXTENSION_REQUEST from web app');
        
        try {
          const response = await chrome.runtime.sendMessage(event.data.payload);
          
          // Send response back to web app
          window.postMessage({
            extensionResponseId: event.data.messageId,
            response: response
          }, '*');
          
        } catch (error) {
          console.error('❌ Failed to forward request to extension:', error);
          
          // Send error response back to web app
          window.postMessage({
            extensionResponseId: event.data.messageId,
            response: { success: false, error: error.message }
          }, '*');
        }
        return;
      }

      // Handle EXTENSION_PING messages (keep for backward compatibility)
      if (event.data?.type === 'EXTENSION_PING' && event.data?.source?.includes('make10000hours')) {
        console.log('🔄 Received EXTENSION_PING from web app, responding...');
        
        window.postMessage({
          type: 'EXTENSION_PONG',
          messageId: event.data.messageId,
          payload: { status: 'online', timestamp: Date.now() },
          source: 'focus-time-tracker-extension'
        }, '*');
        return;
      }

      // Handle SET_USER_ID messages
      if (event.data?.type === 'SET_USER_ID' && event.data?.source?.includes('make10000hours')) {
        console.log('🔄 Received SET_USER_ID from web app:', event.data.payload);
        
        try {
          const response = await chrome.runtime.sendMessage({
            type: 'SET_USER_ID',
            payload: event.data.payload
          });
          
          window.postMessage({
            type: 'SET_USER_ID_RESPONSE',
            payload: response,
            source: 'make10000hours-extension'
          }, '*');
          
        } catch (error) {
          console.error('❌ Failed to forward SET_USER_ID:', error);
          
          window.postMessage({
            type: 'SET_USER_ID_RESPONSE',
            payload: { success: false, error: error.message },
            source: 'make10000hours-extension'
          }, '*');
        }
      }

      // Handle RECORD_OVERRIDE_SESSION messages from web app
      if (event.data?.type === 'RECORD_OVERRIDE_SESSION' && event.data?.source?.includes('make10000hours')) {
        if (event.data.payload?.source === 'extension') {
          return;
        }
        
        console.log('📝 Forwarding override session from web app to extension');
        
        try {
          const response = await chrome.runtime.sendMessage({
            type: 'RECORD_OVERRIDE_SESSION',
            payload: event.data.payload
          });
          
          window.postMessage({
            type: 'RECORD_OVERRIDE_SESSION_RESPONSE',
            payload: { success: true },
            source: 'make10000hours-extension'
          }, '*');
          
        } catch (error) {
          console.error('❌ Failed to record override session:', error);
          
          window.postMessage({
            type: 'RECORD_OVERRIDE_SESSION_RESPONSE',
            payload: { success: false, error: error.message },
            source: 'make10000hours-extension'
          }, '*');
        }
      }
    });

    this.messageListenersSetup = true;
    console.log('✅ Web app communication bridge set up successfully');
  }

  /**
   * Set up activity detection listeners
   */
  setupEventListeners() {
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
    this.reportingInterval = setInterval(() => {
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
    this.isActive = timeSinceLastActivity < this.inactivityThreshold && 
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
        activityThreshold: this.inactivityThreshold
      };

      // Send enhanced message to background script
      if (chrome.runtime && chrome.runtime.sendMessage) {
        const response = await chrome.runtime.sendMessage({
          type: 'ENHANCED_ACTIVITY_DETECTED',
          payload: activityData
        });

        if (response?.success) {
          this.lastActivity = now;
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
        this.isActive = true;
        this.isPageVisible = true;
        this.isWindowFocused = true;
        this.showFocusIndicator();
      }
    } catch (error) {
      console.debug('Could not check focus mode:', error);
    }
  }

  /**
   * Show focus mode indicator on page - VISUAL BUBBLE DISABLED
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
    const indicator = document.getElementById('focus-time-tracker-indicator');
    if (indicator) {
      indicator.remove();
    }
    this.isActive = false;
    this.isPageVisible = false;
    this.isWindowFocused = false;
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
      focusMode: this.isActive
    };
  }

  /**
   * Clean up listeners and intervals
   */
  cleanup() {
    if (this.reportingInterval) {
      clearInterval(this.reportingInterval);
    }
    
    // Report final activity
    this.reportActivity(true);
  }

  /**
   * Set up Chrome runtime message listener for messages from extension background
   */
  setupChromeListener() {
    // Prevent duplicate setup
    if (this.chromeListenerSetup) {
      console.log('🔄 Chrome runtime listener already set up, skipping...');
      return;
    }

    // Check if Chrome extension API is available
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      console.warn('⚠️ Chrome extension API not available for runtime listener');
      return;
    }

    console.log('🔧 Setting up Chrome runtime message listener...');

    // Set up Chrome runtime message listener for messages from extension background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'RECORD_OVERRIDE_SESSION') {
        console.log('📝 Processing override session from extension');
        
        // Create unique payload with deduplication ID
        const uniquePayload = {
          ...message.payload,
          messageId: `override_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          source: 'extension'
        };
        
        // Forward to web app via window message
        window.postMessage({
          type: 'RECORD_OVERRIDE_SESSION',
          payload: uniquePayload,
          source: 'make10000hours-extension'
        }, '*');
        
        sendResponse({ success: true });
        return true;
      }
      
      return false;
    });

    this.chromeListenerSetup = true;
    console.log('✅ Chrome runtime message listener set up successfully');
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
        activityDetector.isActive = true;
        activityDetector.isPageVisible = true;
        activityDetector.isWindowFocused = true;
        activityDetector.showFocusIndicator();
      } else {
        activityDetector.hideFocusIndicator();
      }
      sendResponse({ success: true });
      break;
      
    case 'FOCUS_STATE_CHANGED':
      // Update local state
      activityDetector.isActive = message.payload.isActive;
      if (message.payload.isActive) {
        activityDetector.showFocusIndicator();
      } else {
        activityDetector.hideFocusIndicator();
      }
      
      // Get current user ID from page to validate if this change applies
      const getCurrentUserId = () => {
        try {
          const userStorage = localStorage.getItem('user-store');
          if (userStorage) {
            const parsed = JSON.parse(userStorage);
            return parsed?.state?.user?.uid || null;
          }
        } catch (error) {
          console.warn('Failed to get current user ID:', error);
        }
        return null;
      };
      
      const currentUserId = getCurrentUserId();
      
      // Forward to web app with extension ID as source and user validation
      window.postMessage({
        type: 'EXTENSION_FOCUS_STATE_CHANGED',
        payload: {
          isActive: message.payload.isActive,
          isVisible: message.payload.isActive,
          isFocused: message.payload.isActive,
          blockedSites: message.payload.blockedSites || [],
          targetUserId: currentUserId // Include current user for validation
        },
        source: chrome.runtime.id,
        extensionId: chrome.runtime.id
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