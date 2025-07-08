/**
 * Content Script for Focus Time Tracker Extension
 * Detects user activity and communicates with background script
 * Enhanced with robust extension context handling
 */

// Remove the import statement and use the class directly since it will be loaded before this file
class ExtensionCommunicator {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 1000;
    this.messageTimeout = 10000;
    this.lastValidationTime = 0;
    this.validationCacheTime = 5000;
    this.connectionState = {
      valid: true,
      lastCheck: Date.now()
    };
    this.initializationDelay = 500; // Wait for extension to initialize
    this.initialized = false;
    this.isShuttingDown = false;
    
    // Create message queue manager instance
    this.messageQueue = new MessageQueueManager();
    
    // Initialize connection state
    this.initializeConnection();
  }

  async initializeConnection() {
    // Wait for extension to be ready
    await this.delay(this.initializationDelay);
    
    try {
      // Attempt initial connection
      const isValid = await this.validateContext();
      this.initialized = true;
      this.connectionState.valid = isValid;
    } catch (e) {
      console.warn('Initial connection validation failed, will retry on next message');
      this.connectionState.valid = false;
    }
  }
  
  async validateContext() {
    const now = Date.now();
    
    // If extension is shutting down, don't even try to validate
    if (this.isShuttingDown) {
      return false;
    }
    
    // During initialization phase, wait a bit
    if (!this.initialized) {
      await this.delay(100); // Small delay to let extension initialize
    }
    
    // Use cached result if within cache time
    if (now - this.lastValidationTime < this.validationCacheTime) {
      return this.connectionState.valid;
    }
    
    // Update validation time
    this.lastValidationTime = now;
    
    try {
      // Ensure runtime is available
      if (!chrome?.runtime?.id) {
        console.debug('🔌 Chrome runtime not available');
        this.connectionState.valid = false;
        return false;
      }
      
      // Check if extension is still valid
      const extensionCheck = new Promise((resolve) => {
        let resolved = false;
        
        try {
          chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
            if (!resolved) {
              resolved = true;
              if (chrome.runtime.lastError) {
                console.debug('🔌 PING validation failed:', chrome.runtime.lastError.message);
                resolve(false);
              } else {
                const valid = response?.success === true;
                resolve(valid);
              }
            }
          });
          
          // Set a reasonable timeout
          setTimeout(() => {
            if (!resolved) {
              resolved = true;
              console.debug('🔌 PING validation timeout');
              resolve(false);
            }
          }, 2000); // Increased from 1000ms to 2000ms
        } catch (e) {
          if (!resolved) {
            resolved = true;
            console.debug('🔌 PING validation exception:', e.message);
            resolve(false);
          }
        }
      });
      
      const isValid = await extensionCheck;
      this.connectionState.valid = isValid;
      
      if (!isValid) {
        console.debug('🔌 Extension context validation failed');
      }
      
      return isValid;
    } catch (e) {
      console.debug('🔌 validateContext error:', e.message);
      this.connectionState.valid = false;
      return false;
    }
  }

  /**
   * Synchronously check if the extension context is currently valid
   * Uses cached validation state to avoid excessive checks
   * @returns {boolean} Whether the extension context is currently valid
   */
  isExtensionContextValid() {
    // If we haven't initialized yet, assume invalid
    if (!this.initialized) {
      return false;
    }
    
    // Use cached state if within cache time
    const now = Date.now();
    if (now - this.lastValidationTime < this.validationCacheTime) {
      return this.connectionState.valid;
    }
    
    // If cache expired, trigger a new validation but return current state
    this.validateContext().catch(() => {}); // Silent catch - state will be updated by validateContext
    return this.connectionState.valid;
  }

  /**
   * Handle extension context invalidation gracefully
   */
  handleContextInvalidation() {
    console.debug('🔌 Extension context invalidated - stopping all message attempts');
    this.connectionState.valid = false;
    this.isShuttingDown = true;
    this.lastValidationTime = Date.now();
    
    // Clear the message queue to prevent further attempts
    if (this.messageQueue && this.messageQueue.clearQueue) {
      this.messageQueue.clearQueue();
    }
  }
  
  /**
   * Enhanced message sending with queue management
   */
  async sendMessage(message, options = {}) {
    // Don't send messages if extension is shutting down
    if (this.isShuttingDown) {
      console.debug('🔌 Extension shutting down, not sending message:', message.type);
      return options.fallback || { success: false, error: 'Extension shutting down' };
    }
    
    // Wait for initialization on first message
    if (!this.initialized) {
      await this.initializeConnection();
    }
    
    const { timeout = this.messageTimeout, retries = this.maxRetries, fallback = null } = options;
    
    // Pre-check: Don't even attempt to send if extension context is invalid
    if (!await this.validateContext()) {
      console.debug('🔌 Extension context invalid, not sending message:', message.type);
      return fallback || { success: false, error: 'Extension context invalid' };
    }
    
    try {
      // Use queue manager for reliable delivery
      const response = await this.messageQueue.enqueue(message, {
        timeout,
        retries,
        fallback
      });
      
      // Reset connection state on successful send
      this.connectionState.valid = true;
      return response;
    } catch (error) {
      console.error('❌ Message failed after all retries:', error.message);
      
      // If extension context was invalidated, stop trying
      if (error.message && (error.message.includes('Extension context invalidated') || 
                           error.message.includes('Could not establish connection') ||
                           error.message.includes('receiving end does not exist'))) {
        this.handleContextInvalidation();
      }
      
      return fallback || { success: false, error: error.message };
    }
  }
  
  async sendDirectMessage(message, timeout) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Message timeout'));
      }, timeout);

      try {
        chrome.runtime.sendMessage(message, (response) => {
          clearTimeout(timeoutId);
          
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response || { success: true });
          }
        });
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Extension Initialization Manager
class ExtensionInitializationManager {
  constructor() {
    this.isBackgroundReady = false;
    this.initializationAttempts = 0;
    this.maxInitializationAttempts = 10;
    this.initializationDelay = 500; // Start with 500ms
    this.pendingMessages = [];
    this.isShuttingDown = false;
  }

  async waitForBackgroundScript() {
    return new Promise((resolve) => {
      const checkBackground = async () => {
        this.initializationAttempts++;
        
        try {
          // Check if chrome runtime is available
          if (!chrome?.runtime?.id) {
            if (this.initializationAttempts < this.maxInitializationAttempts) {
              setTimeout(checkBackground, this.initializationDelay);
              return;
            } else {
              console.warn('⚠️ Chrome runtime not available after max attempts');
              resolve(false);
              return;
            }
          }

          // Try to ping the background script
          chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
            if (chrome.runtime.lastError) {
              if (this.initializationAttempts < this.maxInitializationAttempts) {
                // Exponential backoff
                this.initializationDelay = Math.min(this.initializationDelay * 1.5, 3000);
                setTimeout(checkBackground, this.initializationDelay);
              } else {
                console.warn('⚠️ Background script not responding after max attempts');
                resolve(false);
              }
            } else if (response?.success) {
              // Check if background script is fully initialized
              if (response.initialized !== false) {
                console.log('✅ Background script is ready and initialized');
                this.isBackgroundReady = true;
                resolve(true);
              } else {
                console.log('⏳ Background script responding but not fully initialized yet');
                if (this.initializationAttempts < this.maxInitializationAttempts) {
                  setTimeout(checkBackground, this.initializationDelay);
                } else {
                  resolve(false);
                }
              }
            } else {
              if (this.initializationAttempts < this.maxInitializationAttempts) {
                setTimeout(checkBackground, this.initializationDelay);
              } else {
                resolve(false);
              }
            }
          });
        } catch (error) {
          if (this.initializationAttempts < this.maxInitializationAttempts) {
            setTimeout(checkBackground, this.initializationDelay);
          } else {
            console.warn('⚠️ Error checking background script:', error);
            resolve(false);
          }
        }
      };

      checkBackground();
    });
  }

  async safeMessageSend(message, options = {}) {
    if (this.isShuttingDown) {
      return { success: false, error: 'Extension shutting down' };
    }

    if (!this.isBackgroundReady) {
      // Queue the message
      return new Promise((resolve) => {
        this.pendingMessages.push({ message, options, resolve });
      });
    }

    try {
      return await extensionCommunicator.sendMessage(message, options);
    } catch (error) {
      if (error.message && (error.message.includes('Extension context invalidated') ||
                           error.message.includes('Could not establish connection') ||
                           error.message.includes('receiving end does not exist'))) {
        this.handleContextInvalidation();
        return { success: false, error: 'Extension context invalidated' };
      }
      throw error;
    }
  }

  async processPendingMessages() {
    if (!this.isBackgroundReady || this.pendingMessages.length === 0) {
      return;
    }

    console.log(`📨 Processing ${this.pendingMessages.length} pending messages`);
    const messages = [...this.pendingMessages];
    this.pendingMessages = [];

    for (const { message, options, resolve } of messages) {
      try {
        const result = await this.safeMessageSend(message, options);
        resolve(result);
      } catch (error) {
        resolve({ success: false, error: error.message });
      }
    }
  }

  handleContextInvalidation() {
    console.debug('🔌 Extension context invalidated');
    this.isBackgroundReady = false;
    this.isShuttingDown = true;
    
    // Reject all pending messages
    for (const { resolve } of this.pendingMessages) {
      resolve({ success: false, error: 'Extension context invalidated' });
    }
    this.pendingMessages = [];
  }
}

// Initialize global communicator and initialization manager
const extensionInitManager = new ExtensionInitializationManager();
const extensionCommunicator = new ExtensionCommunicator();
console.log('✅ Extension communicator initialized');

// Handle unhandled promise rejections to prevent console spam
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;
  if (error && error.message) {
    // If it's an extension context error, handle it gracefully
    if (error.message.includes('Extension context invalidated') || 
        error.message.includes('Could not establish connection') ||
        error.message.includes('receiving end does not exist')) {
      console.debug('⚠️ Unhandled extension context error (handled):', error.message);
      extensionInitManager.handleContextInvalidation();
      event.preventDefault(); // Prevent the error from appearing in console
    }
  }
});

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
    this.contextInvalidationLogged = false; // Track context invalidation logging
    
    // Wait for background script before initializing
    this.initializeWhenReady();
  }

  /**
   * Initialize when background script is ready
   */
  async initializeWhenReady() {
    try {
      console.log('⏳ Waiting for background script to be ready...');
      const isReady = await extensionInitManager.waitForBackgroundScript();
      
      if (isReady) {
        await extensionInitManager.processPendingMessages();
        this.initialize();
      } else {
        console.warn('⚠️ Background script not ready, running in limited mode');
        // Initialize with limited functionality
        this.initializeLimitedMode();
      }
    } catch (error) {
      console.error('❌ Error during initialization:', error);
      this.initializeLimitedMode();
    }
  }

  /**
   * Initialize with limited functionality when background script is not available
   */
  initializeLimitedMode() {
    console.log('📱 Initializing ActivityDetector in limited mode');
    // Only set up web app communication, no extension messaging
    this.setupWebAppBridge();
    this.isInitialized = true;
  }

  /**
   * Set up only web app communication bridge (limited mode)
   */
  setupWebAppBridge() {
    if (this.messageListenersSetup) {
      return;
    }

    try {
      // Set up message listener for web app communication only
      window.addEventListener('message', this.createWebAppMessageHandler());
      this.messageListenersSetup = true;
      console.log('🌉 Web app communication bridge set up (limited mode)');
    } catch (error) {
      console.error('❌ Failed to set up web app bridge:', error);
    }
  }

  /**
   * Safe message sending using the initialization manager
   */
  async sendMessageSafely(message, options = {}) {
    const { 
      fallback = { success: false, error: 'Extension not available' },
      timeout = 10000,
      maxRetries = 3
    } = options;

    return await extensionInitManager.safeMessageSend(message, {
      timeout,
      retries: maxRetries,
      fallback
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
      if (!event.data?.source?.includes('make10000hours') && event.data?.type !== 'EXTENSION_REQUEST') {
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
        // Handle EXTENSION_PING messages
        if (type === 'EXTENSION_PING') {
          console.log('🔄 Received EXTENSION_PING from web app');
          
          // Simple status check
          const status = {
            status: 'online',
            timestamp: Date.now(),
            contextValid: extensionCommunicator.isExtensionContextValid()
          };
          
          sendResponse('EXTENSION_PONG', status);
          return;
        }

        // Handle SET_USER_ID messages
        if (type === 'SET_USER_ID') {
          console.log('🔄 Received SET_USER_ID from web app:', payload);
          
          const message = {
            type: 'SET_USER_ID',
            payload
          };

          try {
            const response = await this.sendMessageSafely(message, {
              timeout: 15000,
              maxRetries: 3,
              fallback: { 
                success: false, 
                error: 'Extension temporarily unavailable',
                queued: false 
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

        // Handle WEB_APP_FOCUS_STATE_CHANGED messages
        if (type === 'WEB_APP_FOCUS_STATE_CHANGED') {
          console.log('🔄 Received focus state change from web app:', payload);
          
          const message = {
            type: 'WEB_APP_FOCUS_STATE_CHANGED',
            payload: {
              focusMode: payload.focusMode,
              timestamp: payload.timestamp || Date.now(),
              source: 'web-app'
            }
          };

          try {
            const response = await this.sendMessageSafely(message, {
              timeout: 10000,
              maxRetries: 2,
              fallback: { 
                success: false, 
                error: 'Extension temporarily unavailable',
                queued: false 
              }
            });
            
            console.log('✅ Forwarded focus state change to extension:', response);
            sendResponse('WEB_APP_FOCUS_STATE_CHANGED_RESPONSE', response);
            
          } catch (error) {
            console.error('❌ Failed to process focus state change:', error);
            sendResponse('WEB_APP_FOCUS_STATE_CHANGED_RESPONSE', {
              success: false,
              error: error.message,
              queued: false
            });
          }
        }

        // Handle EXTENSION_REQUEST messages (general extension communication)
        if (type === 'EXTENSION_REQUEST') {
          console.log('🔄 Received EXTENSION_REQUEST from web app:', payload);
          
          try {
            const response = await this.sendMessageSafely(payload, {
              timeout: 10000,
              maxRetries: 2,
              fallback: { 
                success: false, 
                error: 'Extension temporarily unavailable',
                queued: false 
              }
            });
            
            console.log('✅ Forwarded extension request to background:', response);
            
            // Send response back to web app with expected structure
            window.postMessage({
              extensionResponseId: messageId,
              response: response
            }, '*');
            
          } catch (error) {
            console.error('❌ Failed to process extension request:', error);
            
            // Send error response back to web app
            window.postMessage({
              extensionResponseId: messageId,
              response: {
                success: false,
                error: error.message,
                queued: false
              }
            }, '*');
          }
          return; // Early return since we handle the response differently
        }
        
      } catch (error) {
        console.error('❌ Error processing web app message:', error);
        sendResponse(`${type}_RESPONSE`, {
          success: false,
          error: error.message,
          contextValid: extensionCommunicator.isExtensionContextValid()
        });
      }
    };

    // Add message listener with error boundary
    window.addEventListener('message', (event) => {
      messageHandler(event).catch(error => {
        console.error('❌ Unhandled error in message handler:', error);
      });
    });

    // Listen for messages from extension background script (for extension → web app sync)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      try {
        if (message.type === 'EXTENSION_BLOCKED_SITES_UPDATED') {
          console.log('📨 Received blocked sites update from extension:', message.payload);
          
          // Forward to web app
          window.postMessage({
            type: 'EXTENSION_BLOCKED_SITES_UPDATED',
            payload: message.payload
          }, '*');
          
          sendResponse({ success: true });
        }
      } catch (error) {
        console.error('❌ Error handling extension message:', error);
        sendResponse({ success: false, error: error.message });
      }
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
      // Check if extension context is valid before proceeding
      if (!chrome.runtime || !chrome.runtime.id) {
        // Context invalidated, stop reporting
        if (!this.contextInvalidationLogged) {
          console.debug('Extension context invalidated - stopping activity reporting');
          this.contextInvalidationLogged = true;
        }
        return;
      }

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

      // Send enhanced message to background script using safe method
      try {
        const response = await this.sendMessageSafely({
          type: 'ENHANCED_ACTIVITY_DETECTED',
          payload: activityData
        }, {
          timeout: 5000,
          maxRetries: 1,
          fallback: { success: false, error: 'Extension not available' }
        });

        if (response?.success) {
          this.lastActivity = now;
          console.log(`📊 Enhanced activity reported (${eventType}):`, {
            isActive: this.isActive,
            timeSinceActivity: Math.round(timeSinceLastActivity / 1000) + 's',
            isVisible: this.isPageVisible,
            isFocused: this.isWindowFocused
          });
        } else if (response?.error !== 'Extension not available') {
          console.debug('⚠️ Failed to report enhanced activity:', response?.error);
        }
      } catch (error) {
        // Silently handle - this is expected during extension reload
        console.debug('Enhanced activity reporting failed:', error.message);
      }
    } catch (error) {
      // Handle context invalidation errors gracefully
      if (error.message && (error.message.includes('Extension context invalidated') || 
                           error.message.includes('receiving end does not exist'))) {
        if (!this.contextInvalidationLogged) {
          console.debug('Extension context invalidated - stopping activity reporting');
          this.contextInvalidationLogged = true;
        }
      } else {
        console.debug('Could not report enhanced activity:', error);
      }
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
      const response = await this.sendMessageSafely({
        type: 'GET_CURRENT_STATE'
      }, {
        timeout: 3000,
        maxRetries: 1,
        fallback: { success: false, error: 'Extension not available' }
      });

      if (response?.success && response.data?.focusMode) {
        this.isActive = true;
        this.isPageVisible = true;
        this.isWindowFocused = true;
        this.showFocusIndicator();
      }
    } catch (error) {
      console.debug('Could not check focus mode:', error.message);
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

// Initialize activity detector with proper timing
const activityDetector = new ActivityDetector();
window.activityDetector = activityDetector; // Make available for testing

// Global error handler for extension-related errors
window.addEventListener('error', (event) => {
  if (event.error && event.error.message && 
      (event.error.message.includes('Extension context invalidated') ||
       event.error.message.includes('Could not establish connection') ||
       event.error.message.includes('receiving end does not exist'))) {
    console.debug('🔄 Extension connection error handled:', event.error.message);
    extensionInitManager.handleContextInvalidation();
    event.preventDefault();
  }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  extensionInitManager.handleContextInvalidation();
  activityDetector.cleanup();
}); 