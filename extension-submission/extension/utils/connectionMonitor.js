/**
 * Extension Connection Monitor
 * Provides visual feedback and debugging for extension connection health
 * Helps monitor and debug context invalidation issues
 */

class ExtensionConnectionMonitor {
  constructor(connectionManager = null, options = {}) {
    this.connectionManager = connectionManager;
    this.options = {
      showDebugPanel: false,
      logLevel: 'info', // 'debug', 'info', 'warn', 'error'
      autoStart: true,
      ...options
    };
    
    this.statusIndicator = null;
    this.debugPanel = null;
    this.isMonitoring = false;
    this.statusHistory = [];
    this.maxHistorySize = 50;
    
    if (this.options.autoStart) {
      this.initialize();
    }
  }

  /**
   * Initialize the connection monitor
   */
  initialize() {
    console.log('🔍 Initializing Extension Connection Monitor...');
    
    if (this.options.showDebugPanel) {
      this.createDebugPanel();
    }
    
    this.createStatusIndicator();
    this.startMonitoring();
    
    console.log('✅ Extension Connection Monitor initialized');
  }

  /**
   * Start monitoring connection status
   */
  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    // Listen for connection state changes if connection manager is available
    if (this.connectionManager) {
      this.connectionManager.addConnectionListener((connected) => {
        this.updateStatus(connected ? 'connected' : 'disconnected');
      });
    }
    
    // Set up periodic health checks
    this.startHealthChecks();
    
    this.log('info', '🔍 Connection monitoring started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    this.isMonitoring = false;
    this.log('info', '⏹️ Connection monitoring stopped');
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks() {
    // Check connection status every 10 seconds
    setInterval(() => {
      this.performHealthCheck();
    }, 10000);
  }

  /**
   * Perform connection health check
   */
  async performHealthCheck() {
    if (!this.isMonitoring) return;
    
    try {
      let status = 'unknown';
      let details = {};
      
      // Check if Chrome extension APIs are available
      if (typeof chrome === 'undefined' || !chrome.runtime) {
        status = 'api_unavailable';
        details.error = 'Chrome extension API not available';
      }
      // Check if extension context is valid
      else if (!chrome.runtime.id) {
        status = 'context_invalidated';
        details.error = 'Extension context invalidated';
      }
      // Try to ping background script
      else {
        try {
          const response = await this.pingBackground();
          if (response && response.success) {
            status = 'connected';
            details.responseTime = Date.now() - response.timestamp;
          } else {
            status = 'background_unreachable';
            details.error = 'Background script not responding';
          }
        } catch (error) {
          status = 'ping_failed';
          details.error = error.message;
        }
      }
      
      this.updateStatus(status, details);
      
    } catch (error) {
      this.updateStatus('health_check_error', { error: error.message });
    }
  }

  /**
   * Ping background script
   */
  async pingBackground() {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Health check timeout'));
      }, 5000);

      try {
        chrome.runtime.sendMessage(
          { type: 'PING', timestamp: Date.now() },
          (response) => {
            clearTimeout(timeoutId);
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Update connection status
   */
  updateStatus(status, details = {}) {
    const statusEntry = {
      status,
      details,
      timestamp: Date.now()
    };
    
    // Add to history
    this.statusHistory.push(statusEntry);
    if (this.statusHistory.length > this.maxHistorySize) {
      this.statusHistory.shift();
    }
    
    // Update visual indicators
    this.updateStatusIndicator(status, details);
    if (this.debugPanel) {
      this.updateDebugPanel();
    }
    
    // Log status change
    this.logStatusChange(status, details);
  }

  /**
   * Create status indicator
   */
  createStatusIndicator() {
    if (typeof document === 'undefined') return;
    
    // Remove existing indicator
    const existing = document.getElementById('extension-status-indicator');
    if (existing) existing.remove();
    
    this.statusIndicator = document.createElement('div');
    this.statusIndicator.id = 'extension-status-indicator';
    this.statusIndicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background-color: #ccc;
      z-index: 999999;
      border: 2px solid #fff;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      transition: all 0.3s ease;
      cursor: pointer;
    `;
    
    // Click to toggle debug panel
    this.statusIndicator.addEventListener('click', () => {
      this.toggleDebugPanel();
    });
    
    document.body.appendChild(this.statusIndicator);
  }

  /**
   * Update status indicator appearance
   */
  updateStatusIndicator(status, details = {}) {
    if (!this.statusIndicator) return;
    
    const statusColors = {
      connected: '#4CAF50',
      disconnected: '#F44336',
      context_invalidated: '#FF9800',
      api_unavailable: '#9E9E9E',
      background_unreachable: '#FF5722',
      ping_failed: '#E91E63',
      health_check_error: '#673AB7',
      unknown: '#607D8B'
    };
    
    const color = statusColors[status] || statusColors.unknown;
    this.statusIndicator.style.backgroundColor = color;
    
    // Add pulsing animation for errors
    if (['disconnected', 'context_invalidated', 'ping_failed'].includes(status)) {
      this.statusIndicator.style.animation = 'pulse 2s infinite';
    } else {
      this.statusIndicator.style.animation = 'none';
    }
    
    // Update tooltip
    const statusMessages = {
      connected: 'Extension Connected',
      disconnected: 'Extension Disconnected',
      context_invalidated: 'Extension Context Invalid - Reload Required',
      api_unavailable: 'Extension API Unavailable',
      background_unreachable: 'Background Script Unreachable',
      ping_failed: 'Connection Ping Failed',
      health_check_error: 'Health Check Error',
      unknown: 'Connection Status Unknown'
    };
    
    this.statusIndicator.title = statusMessages[status] || 'Extension Status Unknown';
  }

  /**
   * Create debug panel
   */
  createDebugPanel() {
    if (typeof document === 'undefined') return;
    
    this.debugPanel = document.createElement('div');
    this.debugPanel.id = 'extension-debug-panel';
    this.debugPanel.style.cssText = `
      position: fixed;
      top: 40px;
      right: 10px;
      width: 300px;
      max-height: 400px;
      background: #fff;
      border: 1px solid #ccc;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 999998;
      font-family: monospace;
      font-size: 12px;
      overflow: hidden;
      display: none;
    `;
    
    this.debugPanel.innerHTML = `
      <div style="background: #f5f5f5; padding: 8px; border-bottom: 1px solid #ccc; font-weight: bold;">
        Extension Connection Monitor
        <button id="close-debug-panel" style="float: right; background: none; border: none; cursor: pointer;">×</button>
      </div>
      <div id="debug-content" style="padding: 8px; max-height: 350px; overflow-y: auto;">
        <div>Loading...</div>
      </div>
    `;
    
    // Close button
    this.debugPanel.querySelector('#close-debug-panel').addEventListener('click', () => {
      this.hideDebugPanel();
    });
    
    document.body.appendChild(this.debugPanel);
  }

  /**
   * Update debug panel content
   */
  updateDebugPanel() {
    if (!this.debugPanel) return;
    
    const content = this.debugPanel.querySelector('#debug-content');
    if (!content) return;
    
    const currentStatus = this.statusHistory[this.statusHistory.length - 1];
    const connectionManagerStatus = this.connectionManager ? this.connectionManager.getStatus() : null;
    
    content.innerHTML = `
      <div style="margin-bottom: 12px;">
        <strong>Current Status:</strong> 
        <span style="color: ${this.getStatusColor(currentStatus?.status)};">
          ${currentStatus?.status || 'unknown'}
        </span>
        <br>
        <small>${new Date(currentStatus?.timestamp || Date.now()).toLocaleTimeString()}</small>
      </div>
      
      ${connectionManagerStatus ? `
        <div style="margin-bottom: 12px;">
          <strong>Connection Manager:</strong><br>
          Connected: ${connectionManagerStatus.isConnected}<br>
          Last Ping: ${new Date(connectionManagerStatus.lastPingTime).toLocaleTimeString()}<br>
          Reconnect Attempts: ${connectionManagerStatus.reconnectAttempts}
        </div>
      ` : ''}
      
      <div style="margin-bottom: 12px;">
        <strong>Extension Context:</strong><br>
        API Available: ${typeof chrome !== 'undefined' && !!chrome.runtime}<br>
        Extension ID: ${chrome?.runtime?.id || 'N/A'}<br>
        Context Valid: ${!!chrome?.runtime?.id}
      </div>
      
      <div>
        <strong>Recent History:</strong><br>
        <div style="max-height: 150px; overflow-y: auto; background: #f9f9f9; padding: 4px; margin-top: 4px;">
          ${this.statusHistory.slice(-10).reverse().map(entry => `
            <div style="margin-bottom: 4px; padding: 2px; border-bottom: 1px solid #eee;">
              <span style="color: ${this.getStatusColor(entry.status)};">${entry.status}</span>
              <small style="float: right;">${new Date(entry.timestamp).toLocaleTimeString()}</small>
              ${entry.details.error ? `<br><small style="color: #666;">${entry.details.error}</small>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Get color for status
   */
  getStatusColor(status) {
    const colors = {
      connected: '#4CAF50',
      disconnected: '#F44336',
      context_invalidated: '#FF9800',
      api_unavailable: '#9E9E9E',
      background_unreachable: '#FF5722',
      ping_failed: '#E91E63',
      health_check_error: '#673AB7',
      unknown: '#607D8B'
    };
    return colors[status] || colors.unknown;
  }

  /**
   * Toggle debug panel visibility
   */
  toggleDebugPanel() {
    if (!this.debugPanel) {
      this.createDebugPanel();
    }
    
    const isVisible = this.debugPanel.style.display !== 'none';
    if (isVisible) {
      this.hideDebugPanel();
    } else {
      this.showDebugPanel();
    }
  }

  /**
   * Show debug panel
   */
  showDebugPanel() {
    if (!this.debugPanel) return;
    this.debugPanel.style.display = 'block';
    this.updateDebugPanel();
  }

  /**
   * Hide debug panel
   */
  hideDebugPanel() {
    if (!this.debugPanel) return;
    this.debugPanel.style.display = 'none';
  }

  /**
   * Log status change
   */
  logStatusChange(status, details = {}) {
    const message = `🔗 Extension status: ${status}`;
    
    if (status === 'connected') {
      this.log('info', message);
    } else if (['disconnected', 'context_invalidated'].includes(status)) {
      this.log('warn', message, details);
    } else {
      this.log('error', message, details);
    }
  }

  /**
   * Log message based on level
   */
  log(level, message, details = {}) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentLevel = levels[this.options.logLevel] || 1;
    
    if (levels[level] >= currentLevel) {
      const logFn = console[level] || console.log;
      if (Object.keys(details).length > 0) {
        logFn(message, details);
      } else {
        logFn(message);
      }
    }
  }

  /**
   * Get current status summary
   */
  getStatus() {
    const latest = this.statusHistory[this.statusHistory.length - 1];
    return {
      currentStatus: latest?.status || 'unknown',
      lastUpdate: latest?.timestamp || null,
      historyCount: this.statusHistory.length,
      connectionManager: this.connectionManager ? this.connectionManager.getStatus() : null
    };
  }

  /**
   * Enable debug mode
   */
  enableDebugMode() {
    this.options.showDebugPanel = true;
    this.options.logLevel = 'debug';
    if (!this.debugPanel) {
      this.createDebugPanel();
    }
    this.showDebugPanel();
  }

  /**
   * Disable debug mode
   */
  disableDebugMode() {
    this.options.showDebugPanel = false;
    this.hideDebugPanel();
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stopMonitoring();
    
    if (this.statusIndicator) {
      this.statusIndicator.remove();
    }
    
    if (this.debugPanel) {
      this.debugPanel.remove();
    }
    
    console.log('🗑️ Extension Connection Monitor destroyed');
  }
}

// Add CSS for pulse animation
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.5; }
      100% { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

// Export for use in other files
if (typeof window !== 'undefined') {
  window.ExtensionConnectionMonitor = ExtensionConnectionMonitor;
}

// Also support module export if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExtensionConnectionMonitor;
} 