/**
 * Content Script for Focus Time Tracker Extension
 * Detects user activity and communicates with background script
 * Enhanced with robust extension context handling
 */

// Load required utilities for robust extension communication
(function loadUtilities() {
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.warn('⚠️ Chrome extension API not available, skipping utility loading');
    return;
  }

  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL(src);
      script.onload = () => {
        console.log(`✅ Loaded ${src} successfully`);
        resolve();
      };
      script.onerror = (error) => {
        console.warn(`⚠️ Failed to load ${src}:`, error);
        reject(error);
      };
      (document.head || document.documentElement).appendChild(script);
    });
  };

  // Load utilities in sequence to ensure proper initialization order
  loadScript('utils/contextValidator.js')
    .then(() => loadScript('utils/connectionManager.js'))
    .then(() => loadScript('utils/messageQueue.js'))
    .then(() => {
      console.log('✅ All extension utilities loaded successfully');
      window.dispatchEvent(new CustomEvent('extensionUtilitiesReady', {
        detail: { success: true }
      }));
    })
    .catch(error => {
      console.error('❌ Failed to load extension utilities:', error);
      window.dispatchEvent(new CustomEvent('extensionUtilitiesReady', {
        detail: { success: false, error: error.message }
      }));
    });
})();

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
    this.wasSleeping = false;
    this.sleepStartTime = null;
    
    // Add flags to prevent duplicate setup
    this.isInitialized = false;
    this.messageListenersSetup = false;
    this.chromeListenerSetup = false;
    
    // Enhanced extension communication
    this.connectionManager = null;
    this.messageQueue = null;
    this.utilitiesReady = false;
    
    // Wait for utilities to load before initializing
    this.waitForUtilities();
  }

  /**
   * Wait for extension utilities to be ready
   */
  waitForUtilities() {
    const initializeWhenReady = () => {
      // Initialize utilities if available
      this.initializeUtilities();
      // Initialize the detector
      this.initialize();
    };

    if (window.ExtensionConnectionManager) {
      // Utilities already loaded
      initializeWhenReady();
    } else {
      // Wait for utilities to load
      window.addEventListener('extensionUtilitiesReady', () => {
        initializeWhenReady();
      });
      
      // Fallback: initialize after delay even if utilities don't load
      setTimeout(() => {
        if (!this.isInitialized) {
          console.warn('⚠️ Extension utilities not loaded, initializing without them');
          this.initialize();
        }
      }, 2000);
    }
  }

  /**
   * Initialize extension utilities with exponential backoff
   */
  initializeUtilities(retryCount = 0) {
    const MAX_RETRIES = 5;
    const BASE_DELAY = 1000;

    try {
      console.log('🔄 Initializing extension utilities...');
      
      // Reset state
      this.utilitiesReady = false;
      
      // Initialize message queue first
      if (!this.messageQueue) {
        this.messageQueue = new window.ExtensionMessageQueue();
      }

      // Initialize connection manager
      if (!this.connectionManager) {
        this.connectionManager = new window.ExtensionConnectionManager();
      }

      // Initialize context validator
      if (typeof window.ExtensionContextValidator === 'undefined') {
        window.ExtensionContextValidator = {
          isContextValid: () => {
            try {
              // Check if extension context is still valid
              return chrome.runtime && chrome.runtime.id;
            } catch (e) {
              return false;
            }
          }
        };
      }

      this.utilitiesReady = true;
      console.log('✅ All extension utilities initialized successfully');
      
      // Dispatch event for any waiting operations
      window.dispatchEvent(new CustomEvent('extensionUtilitiesReady', { 
        detail: { success: true } 
      }));
      
    } catch (error) {
      console.error('❌ Failed to initialize extension utilities:', error);
      this.utilitiesReady = false;
      
      // Implement exponential backoff for retries
      if (retryCount < MAX_RETRIES) {
        const delay = BASE_DELAY * Math.pow(2, retryCount);
        console.log(`🔄 Retrying initialization in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        setTimeout(() => this.initializeUtilities(retryCount + 1), delay);
      } else {
        console.error('❌ Max retry attempts reached for utility initialization');
        // Dispatch failure event
        window.dispatchEvent(new CustomEvent('extensionUtilitiesReady', { 
          detail: { success: false, error: error.message } 
        }));
      }
    }
  }

  /**
   * Safe message sending with enhanced error handling and recovery
   */
  async sendMessageSafely(message, options = {}) {
    const { 
      fallback = { success: false, error: 'Extension not available' },
      priority = 'normal',
      shouldQueue = true,
      timeout = 10000,
      maxRetries = 3
    } = options;

    let retryCount = 0;
    const tryMessage = async () => {
      try {
        // Check context validity first
        if (window.ExtensionContextValidator && !window.ExtensionContextValidator.isContextValid()) {
          throw new Error('Extension context invalidated');
        }

        // Validate utilities are ready
        if (!this.utilitiesReady) {
          // Wait for utilities to be ready with timeout
          const ready = await Promise.race([
            new Promise(resolve => {
              const handler = (event) => {
                if (event.detail?.success) {
                  window.removeEventListener('extensionUtilitiesReady', handler);
                  resolve(true);
                }
              };
              window.addEventListener('extensionUtilitiesReady', handler);
            }),
            new Promise(resolve => setTimeout(() => resolve(false), 5000))
          ]);

          if (!ready) {
            throw new Error('Extension utilities not ready');
          }
        }

        // Use message queue if available (preferred method)
        if (this.messageQueue) {
          return await this.messageQueue.sendMessage(message, {
            priority,
            fallback,
            shouldQueue,
            timeout,
            retries: maxRetries,
            onFailure: (error) => {
              console.warn('📨 Message failed:', error.message);
              if (error.message.includes('Extension context invalidated')) {
                this.initializeUtilities();
              }
            }
          });
        }

        // Use connection manager as fallback
        if (this.connectionManager) {
          return await this.connectionManager.sendMessage(message, { 
            fallback,
            timeout,
            retries: maxRetries - 1
          });
        }

        // Last resort: direct Chrome API call
        return await this.sendMessageDirect(message);
        
      } catch (error) {
        console.warn(`📨 Message attempt ${retryCount + 1} failed:`, error.message);
        
        if (error.message.includes('Extension context invalidated')) {
          // Trigger reinitialization
          this.initializeUtilities();
          
          // Retry with backoff if attempts remain
          if (retryCount < maxRetries) {
            retryCount++;
            const delay = 1000 * Math.pow(2, retryCount - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
            return tryMessage();
          }
        }
        
        throw error;
      }
    };

    try {
      return await tryMessage();
    } catch (error) {
      console.error('📨 All message attempts failed:', error.message);
      return fallback;
    }
  }

  /**
   * Direct message sending (fallback method)
   */
  async sendMessageDirect(message) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Message timeout'));
      }, 10000);

      try {
        chrome.runtime.sendMessage(message, (response) => {
          clearTimeout(timeoutId);
          
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
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
   * Set up web app communication bridge with enhanced error handling
   */
  setupWebAppCommunication() {
    if (this.messageListenersSetup) {
      return;
    }
    
    this.messageListenersSetup = true;
    
    // Enhanced message handling for web app communication
    const messageHandler = async (event) => {
      // Validate message origin
      if (!event.data?.source?.includes('make10000hours')) {
        return;
      }

      const { type, messageId, payload } = event.data;
      
      // Helper function to send response back to web app
      const sendResponse = (responseType, responsePayload) => {
        window.postMessage({
          type: responseType,
          messageId,
          payload: responsePayload,
          source: 'focus-time-tracker-extension'
        }, '*');
      };

      try {
        // Validate extension context before processing
        if (window.ExtensionContextValidator && !window.ExtensionContextValidator.isContextValid()) {
          // Attempt recovery
          await new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(false), 5000);
            this.initializeUtilities();
            
            const handler = (event) => {
              if (event.detail?.success) {
                clearTimeout(timeout);
                window.removeEventListener('extensionUtilitiesReady', handler);
                resolve(true);
              }
            };
            
            window.addEventListener('extensionUtilitiesReady', handler);
          });
        }

        // Handle EXTENSION_PING messages
        if (type === 'EXTENSION_PING') {
          console.log('🔄 Received EXTENSION_PING from web app');
          
          // Check extension utilities status
          const status = {
            status: 'online',
            timestamp: Date.now(),
            utilitiesReady: this.utilitiesReady,
            connectionStatus: this.connectionManager?.isConnected ? 'connected' : 'disconnected',
            queueStatus: this.messageQueue?.getStatus() || null,
            contextValid: window.ExtensionContextValidator?.isContextValid() || false
          };
          
          sendResponse('EXTENSION_PONG', status);
          return;
        }

        // Handle SET_USER_ID messages
        if (type === 'SET_USER_ID') {
          console.log('🔄 Received SET_USER_ID from web app:', payload);
          
          // Wait for utilities with timeout
          if (!this.utilitiesReady) {
            const ready = await Promise.race([
              new Promise(resolve => {
                const handler = (event) => {
                  if (event.detail?.success) {
                    window.removeEventListener('extensionUtilitiesReady', handler);
                    resolve(true);
                  }
                };
                window.addEventListener('extensionUtilitiesReady', handler);
              }),
              new Promise(resolve => setTimeout(() => resolve(false), 5000))
            ]);

            if (!ready) {
              throw new Error('Extension utilities not ready after timeout');
            }
          }
          
          const message = {
            type: 'SET_USER_ID',
            payload
          };

          try {
            const response = await this.sendMessageSafely(message, {
              priority: 'high',
              shouldQueue: true,
              timeout: 15000,
              maxRetries: 3,
              fallback: { 
                success: false, 
                error: 'Extension temporarily unavailable - message queued for retry',
                queued: true 
              }
            });
            
            sendResponse('SET_USER_ID_RESPONSE', response);
            
          } catch (error) {
            console.error('❌ Failed to process SET_USER_ID:', error);
            sendResponse('SET_USER_ID_RESPONSE', {
              success: false,
              error: error.message,
              queued: false
            });
          }
        }
        
      } catch (error) {
        console.error('❌ Error processing web app message:', error);
        sendResponse(`${type}_RESPONSE`, {
          success: false,
          error: error.message,
          contextValid: window.ExtensionContextValidator?.isContextValid() || false
        });
      }
    };

    // Add message listener with error boundary
    window.addEventListener('message', (event) => {
      messageHandler(event).catch(error => {
        console.error('❌ Unhandled error in message handler:', error);
      });
    });
    
    console.log('✅ Web app communication handler initialized');
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
    if ('onfreeze' in window) {
      window.addEventListener('freeze', () => {
        console.log('🧊 Page freeze detected - system likely sleeping');
        this.handleSystemSleep();
      });
    }

    if ('onresume' in window) {
      window.addEventListener('resume', () => {
        console.log('🌅 Page resume detected - system likely waking');
        this.handleSystemWake();
      });
    }

    // Handle page visibility for sleep detection
    document.addEventListener('visibilitychange', () => {
      const now = Date.now();
      if (document.hidden) {
        this.sleepStartTime = now;
      } else if (this.sleepStartTime) {
        const sleepDuration = now - this.sleepStartTime;
        // If hidden for more than 2 minutes, consider it as sleep
        if (sleepDuration > 2 * 60 * 1000) {
          this.handleSystemWake(sleepDuration);
        }
        this.sleepStartTime = null;
      }
    });
  }

  /**
   * Handle system sleep detection
   */
  handleSystemSleep() {
    console.log('💤 System sleep detected');
    this.wasSleeping = true;
    this.sleepStartTime = Date.now();
    
    // Report sleep state to background (using safe messaging)
    this.sendMessageSafely({
      type: 'SYSTEM_SLEEP_DETECTED',
      timestamp: this.sleepStartTime
    }, {
      priority: 'low',
      shouldQueue: false,
      fallback: null // Don't care if this fails
    }).catch(() => {
      // Silently ignore failures for sleep detection
    });
  }

  /**
   * Handle system wake detection
   */
  handleSystemWake(sleepDuration) {
    if (!this.wasSleeping && !sleepDuration) return;
    
    const now = Date.now();
    const duration = sleepDuration || (now - (this.sleepStartTime || now));
    
    console.log('🌅 System wake detected, sleep duration:', Math.round(duration / 1000) + 's');
    
    // Reset sleep state
    this.wasSleeping = false;
    this.sleepStartTime = null;
    
    // Update last activity to current time
    this.lastActivity = now;
    
    // Report wake state to background (using safe messaging)
    this.sendMessageSafely({
      type: 'SYSTEM_WAKE_DETECTED',
      timestamp: now,
      sleepDuration: duration
    }, {
      priority: 'low',
      shouldQueue: false,
      fallback: null // Don't care if this fails
    }).catch(() => {
      // Silently ignore failures for wake detection
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
      if (!this.isActive || this.wasSleeping) {
        this.reportActivity();
        this.wasSleeping = false;
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

// Update message handling
async function handleMessage(event) {
  if (event.source !== window || !event.data || event.data.source === 'make10000hours-extension') {
    return;
  }

  const { type, payload } = event.data;
  
  try {
    // Check for user ID requirement for deep focus operations
    if (type.includes('DEEP_FOCUS') && (!payload || !payload.userId)) {
      window.postMessage({
        type: `${type}_RESPONSE`,
        payload: { 
          success: false, 
          error: 'User ID required to create deep focus session',
          recoverable: true
        },
        source: 'make10000hours-extension'
      });
      return;
    }

    const response = await ExtensionEventBus.safeForwardMessage(type, payload);
    
    window.postMessage({
      type: `${type}_RESPONSE`,
      payload: response,
      source: 'make10000hours-extension'
    });
  } catch (error) {
    const errorResponse = {
      success: false,
      error: error.message,
      recoverable: error.message.includes('Extension context invalidated')
    };

    // Only log non-recoverable errors
    if (!errorResponse.recoverable) {
      console.error(`❌ Failed to forward ${type}:`, error);
    }

    window.postMessage({
      type: `${type}_RESPONSE`,
      payload: errorResponse,
      source: 'make10000hours-extension'
    });
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    switch (message.type) {
      case 'FOCUS_STATE_CHANGED':
        try {
          // Get current state for validation
          const currentState = message.payload.isActive;
          const now = Date.now();
          
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
          
          // Forward state change to web app with enhanced metadata
          window.postMessage({
            type: 'EXTENSION_FOCUS_STATE_CHANGED',
            payload: {
              ...message.payload,
              targetUserId: currentUserId,
              timestamp: now,
              messageId: `${chrome.runtime.id}_${currentState}_${now}`,
              source: 'extension-content-script',
              forceSync: true
            },
            source: chrome.runtime.id,
            extensionId: chrome.runtime.id,
            messageTimestamp: now,
            messageSource: 'focus-time-tracker-extension',
            forceSync: true
          }, '*');

          // Ensure state is synchronized by sending a direct message to the web app
          try {
            const appOrigin = window.location.origin;
            ['/pomodoro', '/deep-focus', '/dashboard', '/settings'].forEach(route => {
              window.postMessage({
                type: 'EXTENSION_STATE_SYNC',
                payload: {
                  focusMode: message.payload.isActive,
                  timestamp: now,
                  messageId: `${chrome.runtime.id}_sync_${now}_${route}`,
                  source: 'extension-content-script'
                }
              }, appOrigin);
            });
          } catch (error) {
            console.warn('Failed to send direct state sync:', error);
          }
          
          sendResponse({ success: true });
        } catch (error) {
          console.error('Error handling focus state change:', error);
          sendResponse({ success: false, error: error.message });
        }
        break;

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
        break;
    }
  } catch (error) {
    console.error('Error in message listener:', error);
    sendResponse({ success: false, error: error.message });
  }
});

// Initialize activity detector
const activityDetector = new ActivityDetector();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  activityDetector.cleanup();
}); 