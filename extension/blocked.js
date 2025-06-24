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
      // Get cached URL from background script
      const response = await chrome.runtime.sendMessage({ type: 'GET_CACHED_URL' });
      const cachedUrl = response?.data?.url;
      
      // Fallback to URL params if cache miss
      const urlParams = new URLSearchParams(window.location.search);
      const blockedUrl = cachedUrl || urlParams.get('url') || 'Unknown Site';
      const domain = this.extractDomain(blockedUrl);
      
      // Store for override handler
      this.originalUrl = blockedUrl;
      
      // Check if focus mode is still active - auto-redirect if OFF
      try {
        const focusResponse = await chrome.runtime.sendMessage({ type: 'GET_FOCUS_STATUS' });
        console.log('🔍 Focus status response:', focusResponse);
        
        if (focusResponse?.success && focusResponse.data && !focusResponse.data.focusMode) {
          console.log('🔓 Focus mode is OFF, auto-redirecting to:', this.originalUrl);
          if (this.originalUrl && this.originalUrl !== 'Unknown Site') {
            // Clear cached URL before redirecting
            await chrome.runtime.sendMessage({ type: 'CLEAR_CACHED_URL' });
            window.location.href = this.originalUrl;
            return; // Exit early, redirect in progress
          } else {
            // Fallback - redirect to domain homepage like override button
            const domain = this.extractDomain(blockedUrl);
            if (domain && domain !== 'Unknown Site') {
              await chrome.runtime.sendMessage({ type: 'CLEAR_CACHED_URL' });
              window.location.href = `https://${domain}`;
              return;
            }
          }
        }
      } catch (focusError) {
        console.error('Error checking focus status:', focusError);
        // Continue with normal blocking page if focus check fails
      }
      
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
      // Open deep focus page in a new tab
      window.open('https://make10000hours.com/#/deep-focus', '_blank');
    });

    document.getElementById('overrideBtn').addEventListener('click', () => {
      this.handleOverride();
    });

    // Debug info can be toggled by clicking the timer
    document.getElementById('sessionTimer').addEventListener('click', () => {
      this.toggleDebugInfo();
    });
  }

  toggleDebugInfo() {
    const debugInfo = document.getElementById('debugInfo');
    const currentDisplay = window.getComputedStyle(debugInfo).display;
    debugInfo.style.display = currentDisplay === 'none' ? 'block' : 'none';
  }

  async loadFocusStats() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_FOCUS_STATS' });
      if (response && response.success) {
        const stats = response.data;
        document.getElementById('focusTime').textContent = this.formatTime(stats.focusTime || 0);
        document.getElementById('blockedAttempts').textContent = stats.blockedAttempts || 0;
        document.getElementById('overrideTime').textContent = this.formatTime(stats.overrideTime || 0);
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
      // Prevent multiple rapid clicks
      const overrideBtn = document.getElementById('overrideBtn');
      if (overrideBtn.disabled) {
        return;
      }

      const confirmed = confirm(
        'This will temporarily allow access to this site for 5 minutes. Are you sure?'
      );
      
      if (confirmed) {
        // Disable button and update content
        overrideBtn.disabled = true;
        const originalContent = overrideBtn.innerHTML;
        overrideBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
          </svg>
          Processing...
        `;
        
        const domain = document.getElementById('blockedSite').textContent;
        const response = await chrome.runtime.sendMessage({ 
          type: 'OVERRIDE_BLOCK', 
          payload: { domain, duration: 300000 } // 5 minutes
        });
        
        if (response && response.success) {
          // Record override in web app if connected
          await chrome.runtime.sendMessage({ 
            type: 'RECORD_OVERRIDE_SESSION', 
            payload: { domain, duration: 5 } // 5 minutes
          });
          
          // Clear cached URL before redirecting
          await chrome.runtime.sendMessage({ type: 'CLEAR_CACHED_URL' });
          
          // Redirect to original site using cached URL
          if (this.originalUrl && this.originalUrl !== 'Unknown Site') {
            window.location.href = this.originalUrl;
          } else {
            // Fallback - try to go back or to domain homepage
            const domain = document.getElementById('blockedSite').textContent;
            window.location.href = `https://${domain}`;
          }
        } else {
          // Re-enable button if override failed
          overrideBtn.disabled = false;
          overrideBtn.innerHTML = originalContent;
        }
      }
    } catch (error) {
      console.error('Error handling override:', error);
      // Re-enable button on error
      const overrideBtn = document.getElementById('overrideBtn');
      overrideBtn.disabled = false;
      overrideBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        Override (5 min)
      `;
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

// Initialize the blocked page
new BlockedPage(); 