/**
 * Blocked Page Script - External file to avoid CSP issues
 * Enhanced with debugging to identify blocking source
 */

class BlockedPage {
  constructor() {
    this.initialize();
  }

  async initialize() {
    try {
      // Get blocked site info from URL
      const urlParams = new URLSearchParams(window.location.search);
      const blockedUrl = urlParams.get('url') || window.location.href;
      const domain = this.extractDomain(blockedUrl);
      
      document.getElementById('blockedSite').textContent = domain;
      
      // Load focus stats and debug info
      await this.loadFocusStats();
      await this.loadDebugInfo(domain, blockedUrl);
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Start timer update
      this.startTimer();
      
      // Record blocked attempt
      this.recordBlockedAttempt(domain);
    } catch (error) {
      console.error('Error initializing blocked page:', error);
    }
  }

  async loadDebugInfo(domain, originalUrl) {
    try {
      // Get comprehensive debug information
      const debugResponse = await chrome.runtime.sendMessage({ 
        type: 'GET_DEBUG_INFO',
        payload: { domain, originalUrl }
      });
      
      if (debugResponse && debugResponse.success) {
        const debug = debugResponse.data;
        document.getElementById('debugUrl').textContent = originalUrl;
        document.getElementById('debugFocusMode').textContent = debug.focusMode ? 'ON' : 'OFF';
        document.getElementById('debugBlockedCount').textContent = debug.blockedSites ? debug.blockedSites.length : 0;
        document.getElementById('debugBlockedSites').textContent = debug.blockedSites ? 
          (debug.blockedSites.length > 0 ? debug.blockedSites.join(', ') : 'None') : 'Error loading';
        
        // Log to console for further debugging
        console.log('🐛 Debug Info:', debug);
      }
    } catch (error) {
      console.error('Error loading debug info:', error);
    }
  }

  setupEventListeners() {
    document.getElementById('backBtn').addEventListener('click', () => {
      history.back();
    });

    document.getElementById('openPopupBtn').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
    });

    document.getElementById('overrideBtn').addEventListener('click', () => {
      this.handleOverride();
    });

    document.getElementById('debugBtn').addEventListener('click', () => {
      this.toggleDebugInfo();
    });
  }

  toggleDebugInfo() {
    const debugInfo = document.getElementById('debugInfo');
    if (debugInfo.style.display === 'none') {
      debugInfo.style.display = 'block';
    } else {
      debugInfo.style.display = 'none';
    }
  }

  async loadFocusStats() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_FOCUS_STATS' });
      if (response && response.success) {
        const stats = response.data;
        document.getElementById('focusTime').textContent = this.formatTime(stats.focusTime || 0);
        document.getElementById('blockedAttempts').textContent = stats.blockedAttempts || 0;
      }
    } catch (error) {
      console.error('Error loading focus stats:', error);
    }
  }

  async recordBlockedAttempt(domain) {
    try {
      await chrome.runtime.sendMessage({ 
        type: 'RECORD_BLOCKED_ATTEMPT', 
        payload: { domain } 
      });
    } catch (error) {
      console.error('Error recording blocked attempt:', error);
    }
  }

  async handleOverride() {
    try {
      const confirmed = confirm(
        'This will temporarily allow access to this site for 5 minutes. Are you sure?'
      );
      
      if (confirmed) {
        const domain = document.getElementById('blockedSite').textContent;
        const response = await chrome.runtime.sendMessage({ 
          type: 'OVERRIDE_BLOCK', 
          payload: { domain, duration: 300000 } // 5 minutes
        });
        
        if (response && response.success) {
          // Redirect to original site
          const urlParams = new URLSearchParams(window.location.search);
          const originalUrl = urlParams.get('url') || 'about:blank';
          window.location.href = originalUrl;
        }
      }
    } catch (error) {
      console.error('Error handling override:', error);
    }
  }

  startTimer() {
    setInterval(async () => {
      try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_SESSION_TIME' });
        if (response && response.success) {
          const sessionTime = response.data.sessionTime || 0;
          document.getElementById('sessionTimer').textContent = 
            `Focus session: ${this.formatTime(sessionTime, 'clock')}`;
        }
      } catch (error) {
        // Silently handle errors to avoid spam
      }
    }, 1000);
  }

  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch (error) {
      return url;
    }
  }

  formatTime(milliseconds, format = 'short') {
    if (!milliseconds || milliseconds < 0) return '0s';

    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    switch (format) {
      case 'clock':
        if (hours > 0) {
          return `${hours.toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
        } else {
          return `${minutes.toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
        }
      case 'short':
      default:
        if (hours > 0) {
          return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
          return `${minutes}m`;
        } else {
          return `${seconds}s`;
        }
    }
  }
}

// Initialize blocked page
new BlockedPage(); 