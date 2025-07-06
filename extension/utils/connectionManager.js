/**
 * Extension Connection Manager
 * Handles extension context validation, reconnection logic, and connection state management
 * Prevents "Extension context invalidated" errors in Manifest V3
 */

class ExtensionConnectionManager {
  constructor() {
    this.isConnected = false;
    this.lastPingTime = 0;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000; // Start with 1 second
    this.maxReconnectDelay = 30000; // Max 30 seconds
    this.pingInterval = 30000; // Ping every 30 seconds
    this.connectionListeners = new Set();
    this.healthCheckTimer = null;
    
    // Initialize connection state
    this.initialize();
  }

  /**
   * Initialize the connection manager
   */
  async initialize() {
    console.log('🔧 Initializing Extension Connection Manager...');
    
    // Check initial connection state
    await this.checkConnection();
    
    // Start periodic health checks
    this.startHealthChecks();
    
    // Set up extension lifecycle listeners
    this.setupLifecycleListeners();
    
    console.log('✅ Extension Connection Manager initialized');
  }

  /**
   * Check if extension context is valid and responsive
   */
  async checkConnection() {
    try {
      // Check if chrome runtime is available
      if (typeof chrome === 'undefined' || !chrome.runtime) {
        this.setConnectionState(false);
        return false;
      }

      // Check if extension ID is available (context not invalidated)
      if (!chrome.runtime.id) {
        this.setConnectionState(false);
        return false;
      }

      // Send ping to background script to verify responsiveness
      const response = await this.sendPing();
      
      if (response && response.success) {
        this.setConnectionState(true);
        this.resetReconnectAttempts();
        return true;
      } else {
        this.setConnectionState(false);
        return false;
      }
      
    } catch (error) {
      console.debug('🔍 Connection check failed:', error.message);
      this.setConnectionState(false);
      return false;
    }
  }

  /**
   * Send ping message to background script
   */
  async sendPing() {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve(null);
      }, 5000); // 5 second timeout

      try {
        chrome.runtime.sendMessage(
          { type: 'PING', timestamp: Date.now() },
          (response) => {
            clearTimeout(timeoutId);
            if (chrome.runtime.lastError) {
              resolve(null);
            } else {
              resolve(response);
            }
          }
        );
      } catch (error) {
        clearTimeout(timeoutId);
        resolve(null);
      }
    });
  }

  /**
   * Set connection state and notify listeners
   */
  setConnectionState(connected) {
    const wasConnected = this.isConnected;
    this.isConnected = connected;
    this.lastPingTime = Date.now();

    // Notify listeners if state changed
    if (wasConnected !== connected) {
      console.log(`🔗 Extension connection: ${connected ? 'CONNECTED' : 'DISCONNECTED'}`);
      this.notifyConnectionListeners(connected);
    }
  }

  /**
   * Add connection state listener
   */
  addConnectionListener(callback) {
    this.connectionListeners.add(callback);
    
    // Immediately notify with current state
    callback(this.isConnected);
    
    return () => this.connectionListeners.delete(callback);
  }

  /**
   * Notify all connection listeners
   */
  notifyConnectionListeners(connected) {
    this.connectionListeners.forEach(callback => {
      try {
        callback(connected);
      } catch (error) {
        console.error('❌ Connection listener error:', error);
      }
    });
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      const isConnected = await this.checkConnection();
      
      if (!isConnected && this.reconnectAttempts < this.maxReconnectAttempts) {
        await this.attemptReconnect();
      }
    }, this.pingInterval);
  }

  /**
   * Stop health checks
   */
  stopHealthChecks() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Attempt to reconnect to extension
   */
  async attemptReconnect() {
    this.reconnectAttempts++;
    console.log(`🔄 Attempting reconnection (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    // Wait before attempting reconnection
    await this.delay(this.getReconnectDelay());

    const isConnected = await this.checkConnection();
    
    if (isConnected) {
      console.log('✅ Reconnection successful!');
      return true;
    } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('⚠️ Max reconnection attempts reached. Extension may need manual reload.');
      return false;
    }

    return false;
  }

  /**
   * Get reconnect delay with exponential backoff
   */
  getReconnectDelay() {
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );
    return delay + Math.random() * 1000; // Add jitter
  }

  /**
   * Reset reconnect attempts counter
   */
  resetReconnectAttempts() {
    this.reconnectAttempts = 0;
  }

  /**
   * Setup extension lifecycle listeners
   */
  setupLifecycleListeners() {
    // Listen for page visibility changes (useful for detecting app state)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          // Page became visible, check connection
          this.checkConnection();
        }
      });
    }

    // Listen for window focus (user returned to browser)
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        this.checkConnection();
      });
    }
  }

  /**
   * Safe message sending with connection validation
   */
  async sendMessage(message, options = {}) {
    const { 
      retries = 3, 
      timeout = 10000,
      fallback = null 
    } = options;

    // Check connection first
    if (!this.isConnected) {
      const connectionRestored = await this.checkConnection();
      if (!connectionRestored) {
        if (fallback) {
          console.warn('🔄 Extension unavailable, using fallback');
          return fallback;
        }
        throw new Error('Extension context not available');
      }
    }

    let lastError = null;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await this.sendMessageWithTimeout(message, timeout);
        
        // Mark as connected on successful response
        this.setConnectionState(true);
        return response;
        
      } catch (error) {
        lastError = error;
        console.debug(`📨 Message attempt ${attempt}/${retries} failed:`, error.message);
        
        // Mark as disconnected
        this.setConnectionState(false);
        
        // Try to reconnect before next attempt
        if (attempt < retries) {
          await this.delay(1000 * attempt); // Progressive delay
          await this.checkConnection();
        }
      }
    }

    // All attempts failed
    if (fallback) {
      console.warn('🔄 All message attempts failed, using fallback');
      return fallback;
    }
    
    throw lastError || new Error('Message sending failed after retries');
  }

  /**
   * Send message with timeout
   */
  async sendMessageWithTimeout(message, timeout) {
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
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get connection status info
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      lastPingTime: this.lastPingTime,
      reconnectAttempts: this.reconnectAttempts,
      timeSinceLastPing: Date.now() - this.lastPingTime
    };
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stopHealthChecks();
    this.connectionListeners.clear();
    console.log('🗑️ Extension Connection Manager destroyed');
  }
}

// Export for use in other files
if (typeof window !== 'undefined') {
  window.ExtensionConnectionManager = ExtensionConnectionManager;
}

// Also support module export if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExtensionConnectionManager;
} 