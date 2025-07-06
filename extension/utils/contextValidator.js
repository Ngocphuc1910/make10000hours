/**
 * Extension Context Validator
 * Lightweight utility for validating Chrome extension context
 * Prevents "Extension context invalidated" errors
 */

class ExtensionContextValidator {
  
  /**
   * Check if Chrome extension APIs are available
   */
  static isExtensionAPIAvailable() {
    return (
      typeof chrome !== 'undefined' && 
      chrome.runtime && 
      typeof chrome.runtime.sendMessage === 'function'
    );
  }

  /**
   * Check if extension context is valid (not invalidated)
   */
  static isContextValid() {
    try {
      // Check if chrome runtime is available
      if (!this.isExtensionAPIAvailable()) {
        return false;
      }

      // Check if extension ID exists (primary indicator of valid context)
      if (!chrome.runtime.id) {
        return false;
      }

      // Additional check: try to access extension URL
      if (chrome.runtime.getURL) {
        const testUrl = chrome.runtime.getURL('manifest.json');
        if (!testUrl || !testUrl.startsWith('chrome-extension://')) {
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if we're in a development environment
   */
  static isDevelopmentMode() {
    try {
      // Check if extension is in development mode
      return !('update_url' in chrome.runtime.getManifest());
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate context before sending message
   */
  static async validateBeforeMessage(throwOnInvalid = false) {
    const isValid = this.isContextValid();
    
    if (!isValid && throwOnInvalid) {
      throw new Error('Extension context is invalidated. Please reload the extension.');
    }
    
    return isValid;
  }

  /**
   * Get extension context status information
   */
  static getContextStatus() {
    return {
      apiAvailable: this.isExtensionAPIAvailable(),
      contextValid: this.isContextValid(),
      extensionId: this.getExtensionId(),
      isDevelopment: this.isDevelopmentMode(),
      timestamp: Date.now()
    };
  }

  /**
   * Get extension ID safely
   */
  static getExtensionId() {
    try {
      return chrome.runtime?.id || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Safe runtime message sender with context validation
   */
  static async sendMessageSafely(message, options = {}) {
    const { timeout = 5000, retries = 1 } = options;
    
    // Validate context first
    if (!this.isContextValid()) {
      throw new Error('Extension context is invalidated');
    }

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
   * Create a wrapper for message sending with validation
   */
  static createValidatedMessageSender() {
    return async (message, options = {}) => {
      const { 
        fallback = null,
        silentFail = false,
        retries = 3,
        timeout = 10000
      } = options;

      let lastError = null;
      
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          // Validate context before each attempt
          if (!this.isContextValid()) {
            throw new Error('Extension context invalidated');
          }

          const response = await this.sendMessageSafely(message, { timeout });
          return response;
          
        } catch (error) {
          lastError = error;
          
          if (silentFail && attempt === retries) {
            console.debug('📨 Message failed silently:', error.message);
            return fallback;
          }
          
          // Wait before retry
          if (attempt < retries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }

      // All attempts failed
      if (fallback !== null) {
        console.warn('🔄 Message sending failed, using fallback:', lastError?.message);
        return fallback;
      }
      
      throw lastError || new Error('Message sending failed after retries');
    };
  }

  /**
   * Check if extension needs reload (context invalidated but API available)
   */
  static needsReload() {
    return this.isExtensionAPIAvailable() && !this.isContextValid();
  }

  /**
   * Get human-readable status message
   */
  static getStatusMessage() {
    if (!this.isExtensionAPIAvailable()) {
      return 'Extension API not available';
    }
    
    if (!this.isContextValid()) {
      return 'Extension context invalidated - reload required';
    }
    
    return 'Extension context is healthy';
  }

  /**
   * Log context status to console
   */
  static logStatus() {
    const status = this.getContextStatus();
    const message = this.getStatusMessage();
    
    console.log('🔍 Extension Context Status:', {
      message,
      ...status
    });
    
    return status;
  }
}

// Static validation functions for quick access
const isExtensionAvailable = () => ExtensionContextValidator.isExtensionAPIAvailable();
const isContextValid = () => ExtensionContextValidator.isContextValid();
const validateContext = (throwOnInvalid = false) => ExtensionContextValidator.validateBeforeMessage(throwOnInvalid);

// Export for use in other files
if (typeof window !== 'undefined') {
  window.ExtensionContextValidator = ExtensionContextValidator;
  window.isExtensionAvailable = isExtensionAvailable;
  window.isContextValid = isContextValid;
  window.validateContext = validateContext;
}

// Also support module export if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ExtensionContextValidator,
    isExtensionAvailable,
    isContextValid,
    validateContext
  };
} 