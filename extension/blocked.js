/**
 * Blocked Page Script - External file to avoid CSP issues
 * Enhanced with debugging to identify blocking source and font loading
 */

// Enhanced CSS loading with font detection and debugging
function loadCSS() {
  console.log('🎨 Starting CSS loading...');
  
  return Promise.all([
    loadSingleCSS('assets/fonts/fonts.css'),
    loadSingleCSS('assets/icons/remixicon.css')
  ]).then(() => {
    console.log('✅ CSS files loaded, waiting for fonts...');
    return waitForFonts();
  }).catch(error => {
    console.error('❌ CSS loading failed:', error);
    // Fallback to inline styles
    injectFallbackStyles();
  });
}

function loadSingleCSS(path) {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    const url = chrome.runtime.getURL(path);
    link.href = url;
    console.log(`📁 Loading CSS: ${url}`);
    
    link.onload = () => {
      console.log(`✅ CSS loaded: ${path}`);
      
      // Fix RemixIcon font URLs after CSS is loaded
      if (path.includes('remixicon.css')) {
        fixRemixIconFontUrl();
      }
      
      resolve(path);
    };
    link.onerror = () => {
      console.error(`❌ CSS failed: ${path}`);
      reject(new Error(`Failed to load ${path}`));
    };
    
    document.head.appendChild(link);
  });
}

function fixRemixIconFontUrl() {
  console.log('🔧 Fixing RemixIcon font URL...');
  
  // Get the correct font URL for the extension
  const fontUrl = chrome.runtime.getURL('assets/icons/remixicon.woff2');
  console.log('📁 Font URL:', fontUrl);
  
  // Create a new style element with the correct font face
  const style = document.createElement('style');
  style.textContent = `
    @font-face {
      font-family: remixicon;
      src: url('${fontUrl}') format("woff2");
      font-display: swap;
    }
  `;
  
  // Add to head
  document.head.appendChild(style);
  console.log('✅ RemixIcon font URL fixed');
}

function waitForFonts() {
  if (!document.fonts) {
    console.warn('⚠️ CSS Font Loading API not supported, using timeout');
    return new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('🔍 Checking for RemixIcon font...');
  
  return Promise.race([
    document.fonts.load('1em remixicon').then(() => {
      console.log('🎉 RemixIcon font loaded successfully!');
      debugFontLoading();
      return true;
    }),
    new Promise(resolve => {
      setTimeout(() => {
        console.warn('⏰ Font loading timeout, checking manually...');
        const isLoaded = document.fonts.check('1em remixicon');
        console.log('Manual font check result:', isLoaded);
        if (!isLoaded) {
          console.error('❌ RemixIcon font not available, using fallback');
          document.body.classList.add('font-fallback');
        }
        resolve(isLoaded);
      }, 3000);
    })
  ]);
}

function debugFontLoading() {
  if (document.fonts) {
    console.log('📊 Available fonts:', Array.from(document.fonts.values()).map(f => `${f.family} (${f.status})`));
    
    const remixIconLoaded = document.fonts.check('1em remixicon');
    console.log('🔍 RemixIcon check result:', remixIconLoaded);
    
    // Test an actual icon element
    const testIcon = document.createElement('div');
    testIcon.className = 'ri-focus-2-line';
    testIcon.style.position = 'absolute';
    testIcon.style.left = '-9999px';
    document.body.appendChild(testIcon);
    
    setTimeout(() => {
      const computedStyle = window.getComputedStyle(testIcon);
      console.log('🧪 Test icon font-family:', computedStyle.fontFamily);
      console.log('🧪 Test icon content:', computedStyle.content);
      document.body.removeChild(testIcon);
    }, 100);
  }
}

function injectFallbackStyles() {
  console.log('🆘 Injecting fallback styles...');
  
  const style = document.createElement('style');
  style.textContent = `
    /* Fallback icon styles */
    .font-fallback [class*=" ri-"]:before,
    .font-fallback [class^="ri-"]:before {
      content: "⚬" !important;
      font-family: system-ui, sans-serif !important;
    }
    
    /* Specific fallbacks for key icons */
    .font-fallback .ri-focus-2-line:before { content: "🎯" !important; }
    .font-fallback .ri-global-line:before { content: "🌐" !important; }
    .font-fallback .ri-list-settings-line:before { content: "⚙️" !important; }
    .font-fallback .ri-bar-chart-line:before { content: "📊" !important; }
    .font-fallback .ri-time-line:before { content: "⏰" !important; }
  `;
  
  document.head.appendChild(style);
  document.body.classList.add('font-fallback');
}

// Enhanced initialization
function initializeCSS() {
  console.log('🚀 Initializing CSS loading...');
  
  loadCSS().then(() => {
    console.log('🎉 CSS initialization complete!');
  }).catch(error => {
    console.error('💥 CSS initialization failed:', error);
  });
}

// Load CSS when DOM is ready with enhanced error handling
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeCSS);
} else {
  initializeCSS();
}


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
      // Navigate to deep focus page in the same tab
      window.location.href = 'https://make10000hours.com/#/deep-focus';
    });

    document.getElementById('openPopupBtn').addEventListener('click', () => {
      // Navigate to deep focus page in the same tab
      window.location.href = 'https://make10000hours.com/#/deep-focus';
    });

    document.getElementById('overrideBtn').addEventListener('click', () => {
      this.handleOverride();
    });

    // Debug info can be toggled by clicking the timer
    document.getElementById('sessionTimer')?.addEventListener('click', () => {
      this.toggleDebugInfo();
    });

    // Listen for override data updates from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'OVERRIDE_DATA_UPDATED') {
        console.log('🔄 Override data updated, refreshing display');
        this.loadLocalOverrideTime();
      }
    });
  }

  toggleDebugInfo() {
    const debugInfo = document.getElementById('debugInfo');
    const currentDisplay = window.getComputedStyle(debugInfo).display;
    debugInfo.style.display = currentDisplay === 'none' ? 'block' : 'none';
  }

  async loadFocusStats() {
    try {
      // Load all three metrics: On Screen Time, Deep Focus Time, and Override Time
      await this.loadOnScreenTime();
      await this.loadLocalDeepFocusTime();
      await this.loadLocalOverrideTime();
    } catch (error) {
      console.error('Error loading focus stats:', error);
    }
  }

  async loadOnScreenTime() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_TODAY_STATS' });
      if (response && response.success) {
        const totalTime = response.data.totalTime || 0;
        document.getElementById('screenTime').textContent = this.formatTime(totalTime);
        console.log('✅ Loaded on screen time:', totalTime + 'ms');
      } else {
        document.getElementById('screenTime').textContent = this.formatTime(0);
      }
    } catch (error) {
      console.error('Error loading on screen time:', error);
      document.getElementById('screenTime').textContent = this.formatTime(0);
    }
  }

  async loadLocalDeepFocusTime() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_LOCAL_DEEP_FOCUS_TIME' });
      if (response && response.success) {
        const focusMinutes = response.data.minutes || 0;
        const focusMilliseconds = focusMinutes * 60 * 1000;
        document.getElementById('focusTime').textContent = this.formatTime(focusMilliseconds);
        console.log('✅ Loaded deep focus time:', focusMinutes + ' minutes');
      } else {
        document.getElementById('focusTime').textContent = this.formatTime(0);
      }
    } catch (error) {
      console.error('Error loading deep focus time:', error);
      document.getElementById('focusTime').textContent = this.formatTime(0);
    }
  }

  async loadLocalOverrideTime() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_LOCAL_OVERRIDE_TIME' });
      if (response && response.success) {
        const overrideMinutes = response.data.overrideTime || 0;
        const overrideMilliseconds = overrideMinutes * 60 * 1000;
        document.getElementById('overrideTime').textContent = this.formatTime(overrideMilliseconds);
        
        console.log('✅ Loaded override time from localStorage:', overrideMinutes + ' minutes');
      } else {
        // Fallback to web app data
        document.getElementById('overrideTime').textContent = this.formatTime(0);
      }
    } catch (error) {
      console.error('Error loading local override time:', error);
      document.getElementById('overrideTime').textContent = this.formatTime(0);
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

document.addEventListener('DOMContentLoaded', function() {
  // Get DOM elements
  const backBtn = document.getElementById('backBtn');
  const openPopupBtn = document.getElementById('openPopupBtn');
  const overrideBtn = document.getElementById('overrideBtn');
  const modal = document.getElementById('actionModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalContent = document.getElementById('modalContent');
  const modalClose = document.getElementById('modalClose');

  const DASHBOARD_URL = 'https://make10000hours.com/#/deep-focus';

  // Button click handlers for navigation
  function navigateToDashboard(e) {
    e.preventDefault();
    e.stopPropagation();
    window.location.replace(DASHBOARD_URL);
  }

  // Attach navigation handlers
  backBtn.addEventListener('click', navigateToDashboard);
  openPopupBtn.addEventListener('click', navigateToDashboard);

  // Override button handler
  overrideBtn.addEventListener('click', function() {
    showModal('Override Session', 'Are you sure you want to override for 5 minutes?');
  });

  // Modal functions
  function showModal(title, content) {
    modalTitle.textContent = title;
    modalContent.textContent = content;
    modal.classList.add('visible');
  }

  function hideModal() {
    modal.classList.remove('visible');
  }

  // Close modal when clicking close button
  modalClose.addEventListener('click', hideModal);

  // Close modal when clicking outside
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      hideModal();
    }
  });

  // Initialize debug panel if needed
  initializeDebugPanel();
});

function initializeDebugPanel() {
  const debugPanel = document.getElementById('debugInfo');
  if (debugPanel) {
    // Add your debug panel logic here
  }
} 