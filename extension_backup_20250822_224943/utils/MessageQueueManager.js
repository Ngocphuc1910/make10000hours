/**
 * MessageQueueManager
 * Handles reliable message delivery with queuing, retries, and chunking
 * for Chrome extension messaging.
 */

// Make MessageQueueManager available globally
(function(global) {
  class MessageQueueManager {
    constructor() {
      this.queue = new Map();
      this.processing = false;
      this.retryDelay = 2000; // Increased from 1000
      this.maxRetries = 2;    // Reduced from 5 to 2 for faster popup
      this.chunkSize = 32 * 1024 * 1024; // 32MB chunk size
      this.validationCache = {
        isValid: true,
        lastChecked: Date.now(),
        cacheTime: 3000 // Reduced to 3 seconds for faster detection
      };
      
      // Context recovery state
      this.recoveryState = {
        state: 'HEALTHY', // HEALTHY, RECOVERING, FAILED
        attempts: 0,
        maxAttempts: 10,
        lastRecoveryAttempt: 0,
        recoveryTimeout: 3000, // Start with 3s timeout during recovery
        normalTimeout: 800 // Normal operation timeout
      };
      this.stats = {
        totalMessages: 0,
        successfulMessages: 0,
        failedMessages: 0,
        totalRetries: 0
      };
    }

    /**
     * Clears the message queue and rejects all pending messages
     */
    clearQueue(reason = 'Extension context invalidated') {
      console.log(`🧹 Clearing message queue: ${reason}`);
      for (const [messageId, item] of this.queue) {
        item.reject(new Error(reason));
      }
      this.queue.clear();
      this.processing = false;
      this.recoveryState.state = 'FAILED';
    }
    
    /**
     * Initiates context recovery process
     */
    async initiateContextRecovery() {
      if (this.recoveryState.state === 'RECOVERING') {
        return false; // Already recovering
      }
      
      console.log('🔄 Initiating extension context recovery...');
      this.recoveryState.state = 'RECOVERING';
      this.recoveryState.attempts = 0;
      this.recoveryState.lastRecoveryAttempt = Date.now();
      
      // Invalidate validation cache to force fresh validation
      this.validationCache.isValid = false;
      this.validationCache.lastChecked = 0;
      
      return this.attemptContextRecovery();
    }
    
    /**
     * Attempts to recover extension context with progressive retry
     */
    async attemptContextRecovery() {
      if (this.recoveryState.attempts >= this.recoveryState.maxAttempts) {
        console.error('❌ Context recovery failed after max attempts');
        this.clearQueue('Context recovery failed - extension may be disabled');
        return false;
      }
      
      this.recoveryState.attempts++;
      const backoffTime = Math.min(1000 * Math.pow(2, this.recoveryState.attempts - 1), 10000);
      
      console.log(`🔄 Context recovery attempt ${this.recoveryState.attempts}/${this.recoveryState.maxAttempts}`);
      
      // Wait before attempting recovery
      if (this.recoveryState.attempts > 1) {
        await new Promise(r => setTimeout(r, backoffTime));
      }
      
      // Use longer timeout during recovery
      const isValid = await this.validateContextWithTimeout(this.recoveryState.recoveryTimeout);
      
      if (isValid) {
        console.log('✅ Extension context recovered successfully!');
        this.recoveryState.state = 'HEALTHY';
        this.recoveryState.attempts = 0;
        return true;
      }
      
      // Retry recovery
      return this.attemptContextRecovery();
    }

    /**
     * Enqueues a message for reliable delivery
     */
    async enqueue(message, options = {}) {
      const messageId = crypto.randomUUID();
      this.stats.totalMessages++;
      
      return new Promise((resolve, reject) => {
        this.queue.set(messageId, {
          message,
          options,
          resolve,
          reject,
          attempts: 0,
          timestamp: Date.now()
        });
        
        // Start processing if not already running
        if (!this.processing) {
          this.processQueue().catch(console.error);
        }
      });
    }

    /**
     * Processes queued messages with retries
     */
    async processQueue() {
      if (this.processing) return;
      this.processing = true;

      try {
        while (this.queue.size > 0) {
          // Process oldest message first
          const [messageId, item] = Array.from(this.queue.entries())
            .sort(([,a], [,b]) => a.timestamp - b.timestamp)[0];

          try {
            // Validate context before sending
            if (!await this.validateContext()) {
              // If context invalid, delay and retry
              await new Promise(r => setTimeout(r, this.retryDelay));
              continue;
            }

            const result = await this.sendWithRetry(item.message, item.options);
            this.stats.successfulMessages++;
            item.resolve(result);
            this.queue.delete(messageId);
          } catch (error) {
            // Check if this is a context invalidation error
            if (error.message && (error.message.includes('Extension context invalidated') || 
                                 error.message.includes('receiving end does not exist') ||
                                 error.message.includes('Could not establish connection'))) {
              
              // Try context recovery instead of immediately clearing queue
              if (this.recoveryState.state === 'HEALTHY') {
                console.warn('🔄 Extension context invalidated - attempting recovery...');
                
                try {
                  const recovered = await this.initiateContextRecovery();
                  if (recovered) {
                    console.log('✅ Context recovered, continuing with queue processing');
                    continue; // Continue processing the queue
                  }
                } catch (recoveryError) {
                  console.error('❌ Context recovery failed:', recoveryError);
                }
                
                // If recovery failed, clear the queue
                this.clearQueue('Context recovery failed');
                return;
              } else if (this.recoveryState.state === 'RECOVERING') {
                // Already recovering, wait a bit and continue
                console.log('⏳ Context recovery in progress, waiting...');
                await new Promise(r => setTimeout(r, 2000));
                continue;
              } else {
                // Recovery already failed, clear queue
                console.warn('❌ Context permanently invalid, clearing queue');
                this.clearQueue('Extension context permanently invalid');
                return;
              }
            }
            
            console.warn(`Message retry attempt ${item.attempts + 1} failed:`, error);
            
            if (item.attempts >= this.maxRetries) {
              console.error('Message failed after max retries:', error);
              this.stats.failedMessages++;
              item.reject(error);
              this.queue.delete(messageId);
            } else {
              item.attempts++;
              this.stats.totalRetries++;
              
              // Exponential backoff with jitter to prevent thundering herd
              const backoffTime = this.retryDelay * Math.pow(2, item.attempts) + Math.random() * 1000;
              console.log(`🔄 Retrying message in ${Math.round(backoffTime)}ms (attempt ${item.attempts}/${this.maxRetries})`);
              await new Promise(r => setTimeout(r, backoffTime));
              
              // Double-check context is still valid before continuing
              if (!chrome.runtime || !chrome.runtime.id) {
                console.warn('🔄 Extension context no longer valid - clearing queue');
                this.clearQueue();
                return;
              }
              
              // Additional check: if too many consecutive failures, clear cache
              if (item.attempts >= 3) {
                this.validationCache.isValid = false;
                this.validationCache.lastChecked = 0;
              }
            }
          }
        }
      } finally {
        this.processing = false;
      }
    }

    /**
     * Validates extension context with caching
     */
    async validateContext() {
      // Use appropriate timeout based on recovery state
      const timeout = this.recoveryState.state === 'RECOVERING' ? 
        this.recoveryState.recoveryTimeout : this.recoveryState.normalTimeout;
      return this.validateContextWithTimeout(timeout);
    }
    
    /**
     * Validates extension context with custom timeout
     */
    async validateContextWithTimeout(timeoutMs) {
      const now = Date.now();
      
      // Use cached result if within cache time
      if (now - this.validationCache.lastChecked < this.validationCache.cacheTime) {
        return this.validationCache.isValid;
      }
      
      try {
        // Ensure runtime is available
        if (!chrome?.runtime?.id) {
          this.validationCache.isValid = false;
          this.validationCache.lastChecked = now;
          return false;
        }
        
        // Check if extension is still valid with proper timeout handling
        const response = await new Promise((resolve) => {
          let resolved = false;
          
          try {
            chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
              if (!resolved) {
                resolved = true;
                if (chrome.runtime.lastError) {
                  const errorMsg = chrome.runtime.lastError.message;
                  console.debug('🔌 PING validation failed:', errorMsg);
                  
                  // Check if error indicates context invalidation vs temporary issue
                  if (errorMsg && (errorMsg.includes('Extension context invalidated') ||
                      errorMsg.includes('Could not establish connection'))) {
                    // Trigger recovery if we're not already recovering
                    if (this.recoveryState.state === 'HEALTHY') {
                      console.log('🔄 Context invalidation detected during PING, will attempt recovery');
                    }
                  }
                  resolve(false);
                } else {
                  const valid = response?.success === true;
                  
                  // Additional validation - check if response has expected structure
                  if (valid && response?.contextInfo?.canReceiveMessages) {
                    console.debug('✅ PING validation successful with full context info');
                  } else if (valid) {
                    console.debug('✅ PING validation successful (basic response)');
                  } else {
                    console.debug('⚠️ PING response received but not valid:', response);
                  }
                  
                  resolve(valid);
                }
              }
            });
            
            // Set timeout based on current state - longer during recovery
            setTimeout(() => {
              if (!resolved) {
                resolved = true;
                const contextInfo = this.recoveryState.state === 'RECOVERING' ? 
                  `(recovery attempt ${this.recoveryState.attempts})` : '';
                console.warn(`PING validation timeout ${contextInfo}`);
                resolve(false);
              }
            }, timeoutMs);
          } catch (e) {
            if (!resolved) {
              resolved = true;
              console.warn('PING validation exception:', e);
              resolve(false);
            }
          }
        });

        this.validationCache.isValid = response;
        this.validationCache.lastChecked = now;
        
        // Update recovery state if validation successful
        if (response && this.recoveryState.state === 'RECOVERING') {
          console.log('✅ Context validation successful during recovery');
          this.recoveryState.state = 'HEALTHY';
          this.recoveryState.attempts = 0;
        }
        
        return response;
      } catch (e) {
        console.warn('validateContext error:', e);
        this.validationCache.isValid = false;
        this.validationCache.lastChecked = now;
        return false;
      }
    }

    /**
     * Sends a message with retry logic
     */
    async sendWithRetry(message, options = {}) {
      const serializedMessage = JSON.stringify(message);
      
      // Handle large messages
      if (serializedMessage.length > this.chunkSize) {
        return this.sendChunkedMessage(message, options);
      }

      return new Promise((resolve, reject) => {
        let resolved = false;
        const timeoutDuration = options.timeout || 10000; // Increased to 10000ms for better reliability
        
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            reject(new Error(`Message timeout after ${timeoutDuration}ms`));
          }
        }, timeoutDuration);

        try {
          chrome.runtime.sendMessage(message, (response) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              
              if (chrome.runtime.lastError) {
                const error = chrome.runtime.lastError;
                console.warn('Runtime error in sendWithRetry:', error);
                reject(new Error(error.message || 'Runtime error'));
              } else {
                resolve(response);
              }
            }
          });
        } catch (error) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            console.warn('Exception in sendWithRetry:', error);
            reject(error);
          }
        }
      });
    }

    /**
     * Handles large messages by splitting into chunks
     */
    async sendChunkedMessage(message, options = {}) {
      const messageId = crypto.randomUUID();
      const serializedMessage = JSON.stringify(message);
      const chunks = [];
      
      // Split message into chunks
      for (let i = 0; i < serializedMessage.length; i += this.chunkSize) {
        chunks.push(serializedMessage.slice(i, i + this.chunkSize));
      }

      // Send chunks
      for (let i = 0; i < chunks.length; i++) {
        await this.sendWithRetry({
          type: 'CHUNKED_MESSAGE',
          messageId,
          chunkIndex: i,
          totalChunks: chunks.length,
          chunk: chunks[i],
          isLast: i === chunks.length - 1
        }, options);
      }

      // Wait for final acknowledgment
      return this.sendWithRetry({
        type: 'CHUNKED_MESSAGE_COMPLETE',
        messageId
      }, options);
    }

    /**
     * Get statistics and debug information
     */
    getStats() {
      return {
        ...this.stats,
        queueSize: this.queue.size,
        processing: this.processing,
        validationCache: this.validationCache,
        recoveryState: this.recoveryState,
        successRate: this.stats.totalMessages > 0 ? 
          (this.stats.successfulMessages / this.stats.totalMessages * 100).toFixed(1) + '%' : '0%'
      };
    }

    /**
     * Log current queue status for debugging
     */
    logStatus() {
      const stats = this.getStats();
      console.log('📊 MessageQueueManager Status:', stats);
      if (this.queue.size > 0) {
        console.log('📋 Queued messages:', Array.from(this.queue.entries()).map(([id, item]) => ({
          id,
          type: item.message.type,
          attempts: item.attempts,
          age: Date.now() - item.timestamp
        })));
      }
    }
  }

  // Make it available globally
  global.MessageQueueManager = MessageQueueManager;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {}); 