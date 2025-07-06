/**
 * Extension Message Queue
 * Handles queuing and retrying failed messages when extension context is invalidated
 * Works with ExtensionConnectionManager for robust message handling
 */

class ExtensionMessageQueue {
  constructor(connectionManager = null) {
    this.queue = new Map(); // messageId -> messageInfo
    this.connectionManager = connectionManager;
    this.maxQueueSize = 100;
    this.maxRetries = 5;
    this.retryDelay = 1000;
    this.maxRetryDelay = 30000;
    this.processingInterval = null;
    this.isProcessing = false;
    
    // Message types that should be queued vs discarded
    this.queueableMessageTypes = new Set([
      'SET_USER_ID',
      'RECORD_OVERRIDE_SESSION',
      'SAVE_SESSION_DATA',
      'UPDATE_USER_INFO',
      'SYNC_DATA'
    ]);

    this.initialize();
  }

  /**
   * Initialize the message queue
   */
  initialize() {
    console.log('📬 Initializing Extension Message Queue...');
    
    // Start processing queued messages
    this.startProcessing();
    
    // Listen for connection state changes
    if (this.connectionManager) {
      this.connectionManager.addConnectionListener((connected) => {
        if (connected) {
          console.log('🔄 Extension reconnected, processing queued messages...');
          this.processQueue();
        }
      });
    }
    
    console.log('✅ Extension Message Queue initialized');
  }

  /**
   * Add message to queue
   */
  enqueue(message, options = {}) {
    const messageId = this.generateMessageId();
    const messageInfo = {
      id: messageId,
      message,
      options,
      attempts: 0,
      lastAttempt: null,
      createdAt: Date.now(),
      ...options
    };

    // Check if queue is full
    if (this.queue.size >= this.maxQueueSize) {
      // Remove oldest message
      const oldestId = Array.from(this.queue.keys())[0];
      this.queue.delete(oldestId);
      console.warn('⚠️ Message queue full, removed oldest message');
    }

    this.queue.set(messageId, messageInfo);
    console.log(`📝 Queued message ${messageId}:`, message.type);
    
    return messageId;
  }

  /**
   * Send message with automatic queuing on failure
   */
  async sendMessage(message, options = {}) {
    const {
      priority = 'normal',
      timeout = 10000,
      retries = this.maxRetries,
      fallback = null,
      shouldQueue = this.shouldQueueMessage(message),
      onSuccess = null,
      onFailure = null
    } = options;

    try {
      // Try to send immediately if connection manager says we're connected
      if (this.connectionManager && this.connectionManager.isConnected) {
        const response = await this.connectionManager.sendMessage(message, { 
          timeout, 
          retries: 1,
          fallback: null 
        });
        
        if (onSuccess) onSuccess(response);
        return response;
      }
      
      // If not connected but we have connection manager, try once
      if (this.connectionManager) {
        try {
          const response = await this.connectionManager.sendMessage(message, { 
            timeout: timeout / 2, 
            retries: 1,
            fallback: null 
          });
          
          if (onSuccess) onSuccess(response);
          return response;
        } catch (error) {
          // Fall through to queuing logic
        }
      }
      
      // Connection failed, queue if appropriate
      if (shouldQueue) {
        const messageId = this.enqueue(message, {
          priority,
          timeout,
          retries,
          fallback,
          onSuccess,
          onFailure
        });
        
        console.log(`📬 Message queued due to connection failure: ${messageId}`);
        
        // Return a pending response
        return {
          success: false,
          queued: true,
          messageId,
          message: 'Message queued for retry when extension reconnects'
        };
      }
      
      // Not queueable, use fallback or throw
      if (fallback !== null) {
        console.warn('🔄 Message not queueable, using fallback');
        if (onFailure) onFailure(new Error('Extension unavailable'));
        return fallback;
      }
      
      const error = new Error('Extension context not available and message not queueable');
      if (onFailure) onFailure(error);
      throw error;
      
    } catch (error) {
      // Queue critical messages even on unexpected errors
      if (shouldQueue && this.isConnectionError(error)) {
        const messageId = this.enqueue(message, {
          priority,
          timeout,
          retries,
          fallback,
          onSuccess,
          onFailure
        });
        
        console.log(`📬 Message queued due to error: ${messageId}`, error.message);
        
        return {
          success: false,
          queued: true,
          messageId,
          error: error.message
        };
      }
      
      if (onFailure) onFailure(error);
      throw error;
    }
  }

  /**
   * Process all queued messages
   */
  async processQueue() {
    if (this.isProcessing) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      const messages = Array.from(this.queue.values())
        .sort((a, b) => {
          // Sort by priority and age
          const priorityOrder = { high: 3, normal: 2, low: 1 };
          const aPriority = priorityOrder[a.priority] || 2;
          const bPriority = priorityOrder[b.priority] || 2;
          
          if (aPriority !== bPriority) {
            return bPriority - aPriority; // Higher priority first
          }
          
          return a.createdAt - b.createdAt; // Older first
        });

      for (const messageInfo of messages) {
        if (!this.connectionManager || !this.connectionManager.isConnected) {
          console.log('⏸️ Connection lost during queue processing, stopping...');
          break;
        }
        
        await this.processMessage(messageInfo);
      }
      
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single queued message
   */
  async processMessage(messageInfo) {
    const { id, message, options } = messageInfo;
    
    try {
      messageInfo.attempts++;
      messageInfo.lastAttempt = Date.now();
      
      console.log(`📤 Processing queued message ${id} (attempt ${messageInfo.attempts})`);
      
      const response = await this.connectionManager.sendMessage(message, {
        timeout: options.timeout || 10000,
        retries: 1,
        fallback: null
      });
      
      // Success! Remove from queue
      this.queue.delete(id);
      console.log(`✅ Queued message ${id} sent successfully`);
      
      if (options.onSuccess) {
        options.onSuccess(response);
      }
      
      return response;
      
    } catch (error) {
      console.debug(`❌ Failed to send queued message ${id}:`, error.message);
      
      // Check if we should retry
      if (messageInfo.attempts >= (options.retries || this.maxRetries)) {
        // Max retries reached, remove from queue
        this.queue.delete(id);
        console.warn(`⚠️ Message ${id} exceeded max retries, removing from queue`);
        
        if (options.onFailure) {
          options.onFailure(error);
        }
        
        return options.fallback || null;
      }
      
      // Schedule retry with exponential backoff
      const delay = Math.min(
        this.retryDelay * Math.pow(2, messageInfo.attempts - 1),
        this.maxRetryDelay
      );
      
      console.log(`🔄 Will retry message ${id} in ${delay}ms`);
    }
  }

  /**
   * Start processing queue periodically
   */
  startProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    this.processingInterval = setInterval(() => {
      if (!this.isProcessing && this.queue.size > 0) {
        this.processQueue();
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Stop processing queue
   */
  stopProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  /**
   * Check if message should be queued
   */
  shouldQueueMessage(message) {
    return this.queueableMessageTypes.has(message.type);
  }

  /**
   * Check if error is connection-related
   */
  isConnectionError(error) {
    const connectionErrorMessages = [
      'Extension context invalidated',
      'Extension context not available',
      'Could not establish connection',
      'The message port closed before a response was received',
      'Message timeout'
    ];
    
    return connectionErrorMessages.some(msg => 
      error.message && error.message.includes(msg)
    );
  }

  /**
   * Generate unique message ID
   */
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get queue status
   */
  getStatus() {
    const messages = Array.from(this.queue.values());
    
    return {
      queueSize: this.queue.size,
      isProcessing: this.isProcessing,
      messagesByType: this.getMessageCountsByType(),
      messagesByPriority: this.getMessageCountsByPriority(),
      oldestMessage: messages.length > 0 ? 
        Math.min(...messages.map(m => m.createdAt)) : null,
      connectionManager: this.connectionManager ? 
        this.connectionManager.getStatus() : null
    };
  }

  /**
   * Get message counts by type
   */
  getMessageCountsByType() {
    const counts = {};
    for (const messageInfo of this.queue.values()) {
      const type = messageInfo.message.type;
      counts[type] = (counts[type] || 0) + 1;
    }
    return counts;
  }

  /**
   * Get message counts by priority
   */
  getMessageCountsByPriority() {
    const counts = {};
    for (const messageInfo of this.queue.values()) {
      const priority = messageInfo.priority || 'normal';
      counts[priority] = (counts[priority] || 0) + 1;
    }
    return counts;
  }

  /**
   * Clear all queued messages
   */
  clear() {
    const count = this.queue.size;
    this.queue.clear();
    console.log(`🗑️ Cleared ${count} queued messages`);
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stopProcessing();
    this.clear();
    console.log('🗑️ Extension Message Queue destroyed');
  }
}

// Export for use in other files
if (typeof window !== 'undefined') {
  window.ExtensionMessageQueue = ExtensionMessageQueue;
}

// Also support module export if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExtensionMessageQueue;
} 