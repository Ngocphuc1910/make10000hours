/**
 * Popup Script for Make10000hours Extension
 * Handles UI interactions and communication with background script
 * Enhanced with font loading debugging
 */

// Enhanced CSS loading with font detection and debugging
function loadCSS() {
  console.log('🎨 [POPUP] Starting CSS loading (non-blocking)...');
  
  // Load CSS files without blocking - fire and forget
  Promise.all([
    loadSingleCSS('assets/fonts/fonts.css'),
    loadSingleCSS('assets/icons/remixicon.css')
  ]).then(() => {
    console.log('✅ [POPUP] CSS files loaded in background');
    // Don't wait for fonts - let them load in background
    waitForFonts().catch(() => {});
  }).catch(error => {
    console.error('❌ [POPUP] CSS loading failed:', error);
    // Fallback to inline styles
    injectFallbackStyles();
  });
  
  // Return immediately resolved promise
  return Promise.resolve();
}

function loadSingleCSS(path) {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    const url = chrome.runtime.getURL(path);
    link.href = url;
    console.log(`📁 [POPUP] Loading CSS: ${url}`);
    
    link.onload = () => {
      console.log(`✅ [POPUP] CSS loaded: ${path}`);
      
      // Fix RemixIcon font URLs after CSS is loaded
      if (path.includes('remixicon.css')) {
        fixRemixIconFontUrl();
      }
      
      resolve(path);
    };
    link.onerror = () => {
      console.error(`❌ [POPUP] CSS failed: ${path}`);
      reject(new Error(`Failed to load ${path}`));
    };
    
    document.head.appendChild(link);
  });
}

function fixRemixIconFontUrl() {
  console.log('🔧 [POPUP] Fixing RemixIcon font URL...');
  
  // Get the correct font URL for the extension
  const fontUrl = chrome.runtime.getURL('assets/icons/remixicon.woff2');
  console.log('📁 [POPUP] Font URL:', fontUrl);
  
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
  console.log('✅ [POPUP] RemixIcon font URL fixed');
}

function waitForFonts() {
  // Completely non-blocking font loading - just log and continue
  console.log('🎉 [POPUP] Font loading in background (non-blocking)');
  
  // Load fonts in background without blocking UI
  if (document.fonts) {
    document.fonts.ready.then(() => {
      console.log('✅ [POPUP] Fonts loaded in background');
    }).catch(() => {
      console.log('🚨 [POPUP] Font loading failed, using system fallbacks');
    });
  }
  
  return Promise.resolve();
}

function debugFontLoading() {
  if (document.fonts) {
    console.log('📊 [POPUP] Available fonts:', Array.from(document.fonts.values()).map(f => `${f.family} (${f.status})`));
    
    const remixIconLoaded = document.fonts.check('1em remixicon');
    console.log('🔍 [POPUP] RemixIcon check result:', remixIconLoaded);
    
    // Test an actual icon element
    const testIcon = document.createElement('div');
    testIcon.className = 'ri-computer-line';
    testIcon.style.position = 'absolute';
    testIcon.style.left = '-9999px';
    document.body.appendChild(testIcon);
    
    setTimeout(() => {
      const computedStyle = window.getComputedStyle(testIcon);
      console.log('🧪 [POPUP] Test icon font-family:', computedStyle.fontFamily);
      console.log('🧪 [POPUP] Test icon content:', computedStyle.content);
      document.body.removeChild(testIcon);
    }, 100);
  }
}

function injectFallbackStyles() {
  console.log('🆘 [POPUP] Injecting fallback styles for instant display...');
  
  const style = document.createElement('style');
  style.textContent = `
    /* Fallback styles for instant display */
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      visibility: visible !important;
      opacity: 1 !important;
    }
    
    /* Fallback icon styles if RemixIcon fails */
    .ri-computer-line::before { content: '💻'; }
    .ri-focus-3-line::before { content: '🎯'; }
    .ri-time-line::before { content: '⏰'; }
    .ri-bar-chart-2-line::before { content: '📊'; }
    .ri-shield-line::before { content: '🛡️'; }
    .ri-add-line::before { content: '+'; }
    .ri-arrow-right-s-line::before { content: '→'; }
    
    /* Force immediate visibility for all elements */
    .popup-container, .popup-header, .stats-overview, .tab-navigation, .tab-content {
      visibility: visible !important;
      opacity: 1 !important;
      transform: none !important;
    }
  `;
  document.head.appendChild(style);
  console.log('✅ [POPUP] Fallback styles injected for instant display');
  
  // Still check font status in background
  setTimeout(() => {
    checkFontStatus();
  }, 1000);
}

function checkFontStatus() {
  console.log('🔍 [POPUP] Debugging font status...');
  
  // Check if RemixIcon CSS is loaded
  const cssLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
  const remixIconCSS = cssLinks.find(link => link.href.includes('remixicon.css'));
  console.log('📄 [POPUP] RemixIcon CSS link:', remixIconCSS?.href);
  
  // Check computed styles on actual icon elements
  const iconElements = document.querySelectorAll('[class*="ri-"]');
  console.log('🔍 [POPUP] Found', iconElements.length, 'icon elements');
  
  iconElements.forEach((el, index) => {
    const styles = window.getComputedStyle(el, '::before');
    console.log(`🧪 [POPUP] Icon ${index + 1} (${el.className}):`, {
      fontFamily: styles.fontFamily,
      content: styles.content,
      fontSize: styles.fontSize
    });
  });
  
  // Force reload RemixIcon if needed
  if (!document.fonts.check('1em remixicon')) {
    console.log('🔄 [POPUP] RemixIcon not loaded, forcing reload...');
    forceReloadRemixIcon();
  }
}

function forceReloadRemixIcon() {
  // Remove existing RemixIcon CSS
  const existingCSS = document.querySelector('link[href*="remixicon.css"]');
  if (existingCSS) {
    existingCSS.remove();
  }
  
  // Add a small delay then reload
  setTimeout(() => {
    const newLink = document.createElement('link');
    newLink.rel = 'stylesheet';
    newLink.href = chrome.runtime.getURL('assets/icons/remixicon.css') + '?v=' + Date.now();
    newLink.onload = () => {
      console.log('🎉 [POPUP] RemixIcon CSS reloaded!');
      // Wait for font to load
      setTimeout(() => {
        if (document.fonts.check('1em remixicon')) {
          console.log('✅ [POPUP] RemixIcon font now available!');
          document.body.classList.remove('font-fallback');
        } else {
          console.log('❌ [POPUP] RemixIcon still not available after reload');
        }
      }, 500);
    };
    document.head.appendChild(newLink);
  }, 100);
}

// Enhanced initialization - non-blocking
function initializeCSS() {
  console.log('🚀 [POPUP] Initializing CSS loading (non-blocking)...');
  
  // Load CSS in background - don't wait for it
  loadCSS().then(() => {
    console.log('🎉 [POPUP] CSS loaded in background');
  }).catch(error => {
    console.warn('CSS loading failed, using fallbacks');
    injectFallbackStyles();
  });
  
  // Return immediately - don't block UI
  console.log('✅ [POPUP] CSS initialization started (non-blocking)');
}

// Load CSS when DOM is ready with enhanced error handling
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeCSS);
} else {
  initializeCSS();
}

/**
 * Chrome Native Favicon API Helper
 * Replaces FaviconService with Chrome's built-in favicon API
 */
/**
 * Get favicon URL using Chrome extension safe methods
 */
/**
 * Favicon validation and loading (exactly like web app's FaviconImage)
 */
async function validateFaviconUrl(url, timeout = 2000) {
  return new Promise((resolve) => {
    const img = new Image();
    const timeoutId = setTimeout(() => resolve(false), timeout);

    img.onload = () => {
      clearTimeout(timeoutId);
      // Check if it's not a default empty favicon (same as web app)
      if (img.width > 16 || img.height > 16) {
        resolve(true);
      } else {
        resolve(false);
      }
    };

    img.onerror = () => {
      clearTimeout(timeoutId);
      resolve(false);
    };

    img.src = url;
  });
}

/**
 * Get favicon exactly like web app's FaviconImage component
 */
async function getSafeFavicon(domain, size = 32) {
  console.log(`🔍 Getting favicon for ${domain} (size: ${size})`);
  
  try {
    const cleanDomain = domain.replace(/^www\./, '').toLowerCase();
    
    // Force custom icon for app.make10000hours.com
    if (cleanDomain === 'app.make10000hours.com' || cleanDomain === 'make10000hours.com') {
      const customIconUrl = chrome.runtime.getURL('icon/logo4848.png');
      console.log(`🍅 Using custom Make10000Hours icon: ${customIconUrl}`);
      return customIconUrl;
    }
    
    // Use Google's favicon service with 2x size (exactly like web app)
    const googleUrl = `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=${size * 2}`;
    
    // Test if the favicon loads successfully (exactly like web app)
    const isValid = await validateFaviconUrl(googleUrl, 2000);
    
    if (isValid) {
      console.log(`✅ Valid favicon found for ${cleanDomain}: ${googleUrl}`);
      return googleUrl;
    } else {
      console.log(`❌ Invalid favicon for ${cleanDomain}, will use fallback icon`);
      return null; // Will use fallback icon
    }
    
  } catch (error) {
    console.warn(`Favicon loading error for ${domain}:`, error);
    return null;
  }
}

function getDomainFallbackIcon(domain) {
  console.log(`🎯 Getting fallback icon for ${domain}`);
  
  // Comprehensive icon mapping with better coverage
  const iconMap = {
    // Social Media
    'facebook.com': 'ri-facebook-fill',
    'messenger.com': 'ri-messenger-line',
    'instagram.com': 'ri-instagram-fill',
    'twitter.com': 'ri-twitter-fill',
    'x.com': 'ri-twitter-fill',
    'linkedin.com': 'ri-linkedin-fill',
    'youtube.com': 'ri-youtube-fill',
    'reddit.com': 'ri-reddit-fill',
    'pinterest.com': 'ri-pinterest-line',
    'snapchat.com': 'ri-snapchat-line',
    'tiktok.com': 'ri-music-line',
    'discord.com': 'ri-discord-line',
    'slack.com': 'ri-slack-line',
    'whatsapp.com': 'ri-whatsapp-line',
    'telegram.org': 'ri-telegram-line',
    
    // Google Services  
    'google.com': 'ri-google-fill',
    'gmail.com': 'ri-mail-line',
    'mail.google.com': 'ri-mail-line',
    'docs.google.com': 'ri-google-line',
    'sheets.google.com': 'ri-google-line',
    'slides.google.com': 'ri-google-line',
    'drive.google.com': 'ri-google-line',
    
    // Development & Tools
    'github.com': 'ri-github-fill',
    'gitlab.com': 'ri-git-branch-line',
    'stackoverflow.com': 'ri-stack-line',
    'stackexchange.com': 'ri-stack-line',
    'codepen.io': 'ri-codepen-line',
    'jsfiddle.net': 'ri-code-line',
    'replit.com': 'ri-terminal-line',
    'dev.to': 'ri-code-line',
    
    // Design & Creative
    'figma.com': 'ri-shape-line',
    'sketch.com': 'ri-pencil-line',
    'dribbble.com': 'ri-dribbble-line',
    'behance.net': 'ri-behance-line',
    'canva.com': 'ri-palette-line',
    'adobe.com': 'ri-brush-line',
    
    // Productivity
    'notion.so': 'ri-file-text-line',
    'notion.com': 'ri-file-text-line',
    'trello.com': 'ri-trello-line',
    'asana.com': 'ri-task-line',
    'todoist.com': 'ri-todo-line',
    'monday.com': 'ri-calendar-line',
    'airtable.com': 'ri-table-line',
    
    // Cloud Storage
    'dropbox.com': 'ri-dropbox-line',
    'onedrive.live.com': 'ri-microsoft-line',
    'box.com': 'ri-folder-cloud-line',
    'icloud.com': 'ri-cloud-line',
    
    // Entertainment
    'netflix.com': 'ri-netflix-fill',
    'spotify.com': 'ri-spotify-line',
    'soundcloud.com': 'ri-soundcloud-line',
    'twitch.tv': 'ri-twitch-line',
    'vimeo.com': 'ri-vimeo-line',
    'disney.com': 'ri-film-line',
    'hulu.com': 'ri-tv-line',
    
    // E-commerce
    'amazon.com': 'ri-shopping-cart-line',
    'ebay.com': 'ri-auction-line',
    'etsy.com': 'ri-store-line',
    'shopify.com': 'ri-shopping-bag-line',
    
    // Business & Analytics
    'salesforce.com': 'ri-line-chart-line',
    'hubspot.com': 'ri-pie-chart-line',
    'mailchimp.com': 'ri-mail-send-line',
    'zendesk.com': 'ri-customer-service-line',
    
    // News & Media
    'medium.com': 'ri-medium-line',
    'wordpress.com': 'ri-wordpress-line',
    'blogger.com': 'ri-edit-line',
    'substack.com': 'ri-newsletter-line',
    
    // AI & Tech
    'claude.ai': 'ri-robot-line',
    'openai.com': 'ri-brain-line',
    'chatgpt.com': 'ri-chat-3-line',
    
    // My App
    'app.make10000hours.com': 'ri-focus-3-line',
    
    // Cloud Services
    'firebase.google.com': 'ri-fire-line',
    'console.firebase.google.com': 'ri-fire-line',
    'aws.amazon.com': 'ri-cloud-line',
    'azure.microsoft.com': 'ri-cloud-line',
    
    // Communication
    'zoom.us': 'ri-video-line',
    'teams.microsoft.com': 'ri-team-line',
    'meet.google.com': 'ri-video-chat-line'
  };
  
  // Check exact domain match first
  if (iconMap[domain]) {
    console.log(`✅ Exact fallback icon found for ${domain}: ${iconMap[domain]}`);
    return iconMap[domain];
  }
  
  // Check partial matches
  for (const [site, icon] of Object.entries(iconMap)) {
    if (domain.includes(site.replace('.com', '').replace('.org', '').replace('.net', ''))) {
      console.log(`✅ Partial fallback icon found for ${domain}: ${icon}`);
      return icon;
    }
  }
  
  console.log(`❌ No fallback icon found for ${domain}, using default`);
  return 'ri-global-line';
}

class PopupManager {
  constructor() {
    // Core state that must exist
    this.coreState = {
      focusMode: false,
      isTracking: false
    };
    
    // Enhanced state that can load later
    this.enhancedState = {
      todayStats: null,
      userInfo: null,
      deepFocusStats: null
    };

    this.currentTab = 'site-usage';
    this.updateInterval = null;
    this.analyticsUI = null;
    this.previousStats = null;
    this.updateTimeout = null;
    
    this.initialize();

    // Subscribe to deep focus updates using global ExtensionEventBus
    if (window.ExtensionEventBus) {
      window.ExtensionEventBus.subscribe((message) => {
        if (message.type === window.ExtensionEventBus.EVENTS.DEEP_FOCUS_UPDATE) {
          this.updateDeepFocusTimeDisplay(message.payload.minutes);
        }
      });
    }
  }

  /**
   * Initialize core functionality
   */
  async initializeCore() {
    try {
      // Only get critical state first with shorter timeout
      const stateResult = await this.sendMessageWithRetry(
        'GET_CURRENT_STATE',
        {},
        1, // Reduced retries for faster core load
        { timeout: 1500 } // Reduced from 5000ms to 1500ms for faster popup
      );

      if (stateResult?.success) {
        this.coreState = {
          ...this.coreState,
          ...stateResult.data
        };
        console.log('🔄 Popup initialized with focus mode:', this.coreState.focusMode, 'at', new Date().toISOString());
      }

      // Initialize analytics UI if available
      if (window.AnalyticsUI) {
        this.analyticsUI = new window.AnalyticsUI();
      }

      // Show basic UI immediately
      this.updateCoreUI();
      
      return true;
    } catch (error) {
      console.error('Core initialization failed:', error);
      this.showError('Basic functionality unavailable');
      return false;
    }
  }

  /**
   * Initialize enhanced features progressively - moved to background for faster popup
   */
  async initializeEnhanced() {
    // Load data in background with small delay to let UI render first
    setTimeout(() => {
      if (!this.coreState) return;

      try {
        // Load enhanced features in parallel but handle independently
        const enhancedLoads = [
          this.loadStats(),
          this.loadUserInfo(),
          this.loadFocusState()
        ];

        // Update UI as each feature becomes available
        Promise.all(enhancedLoads).then(results => {
          results.forEach(result => {
            if (result?.success) {
              this.updateEnhancedUI(result.type);
            }
          });
        }).catch(console.warn);
        
      } catch (error) {
        console.warn('Enhanced initialization partial failure:', error);
      }
    }, 50); // Small delay to let UI render first
  }

  /**
   * Load stats with retry
   */
  async loadStats() {
    try {
      console.log('📤 Popup requesting GET_REALTIME_STATS...');
      const result = await this.sendMessageWithRetry('GET_REALTIME_STATS', {}, 3);
      console.log('📥 Popup received stats response:', result);
      if (result?.success) {
        this.enhancedState.todayStats = result.data;
        console.log('✅ Stats loaded successfully:', result.data);
        return { success: true, type: 'stats', data: result.data };
      } else {
        console.error('❌ Stats request failed:', result);
      }
    } catch (error) {
      console.warn('Failed to load stats:', error);
    }
    return { success: false, type: 'stats' };
  }

  /**
   * Load user info with retry
   */
  async loadUserInfo() {
    try {
      const result = await this.sendMessageWithRetry('GET_USER_INFO', {}, 3);
      if (result?.success) {
        this.enhancedState.userInfo = result.data;
        return { success: true, type: 'user', data: result.data };
      }
      
      // Fallback to local storage
      const localData = await chrome.storage.local.get(['userInfo']);
      if (localData.userInfo) {
        this.enhancedState.userInfo = localData.userInfo;
        return { success: true, type: 'user', data: localData.userInfo };
      }
    } catch (error) {
      console.warn('Failed to load user info:', error);
    }
    return { success: false, type: 'user' };
  }

  /**
   * Load focus state with retry
   */
  async loadFocusState() {
    try {
      const result = await this.sendMessageWithRetry('GET_FOCUS_STATE', {}, 3);
      if (result?.success) {
        this.enhancedState.deepFocusStats = result.data;
        return { success: true, type: 'focus', data: result.data };
      }
    } catch (error) {
      console.warn('Failed to load focus state:', error);
    }
    return { success: false, type: 'focus' };
  }

  /**
   * Update core UI elements
   */
  updateCoreUI() {
    // Get current UI state for comparison
    const focusToggle = document.querySelector('#focus-mode-toggle');
    const currentUIState = {
      focusMode: focusToggle ? focusToggle.checked : false
    };
    
    // Compare with desired state to prevent unnecessary updates
    const needsUpdate = (
      !this.lastCoreUIState ||
      currentUIState.focusMode !== this.coreState.focusMode
    );
    
    if (needsUpdate) {
      console.log('🔄 Updating core UI - state changed');
      
      // Update focus mode toggle
      if (focusToggle) {
        focusToggle.checked = this.coreState.focusMode;
        this.updateFocusModeSwitch();
      }

      // Setup tabs (core functionality)
      this.setupTabs();
      
      // Store current state for next comparison
      this.lastCoreUIState = { ...currentUIState };
    } else {
      console.log('📱 Core UI unchanged, skipping update');
    }
  }

  /**
   * Update enhanced UI elements based on type
   */
  updateEnhancedUI(type) {
    switch(type) {
      case 'stats':
        if (this.enhancedState.todayStats) {
          this.updateStatsOverview();
          // Always update top sites when stats are loaded, regardless of container state
          if (this.currentTab === 'site-usage') {
            this.updateTopSites();
          }
        }
        break;
      case 'user':
        if (this.enhancedState.userInfo) {
          this.updateUserInfo();
        }
        break;
      case 'focus':
        if (this.enhancedState.deepFocusStats) {
          this.updateDeepFocusTimeDisplay(this.enhancedState.deepFocusStats.minutes || 0);
        }
        break;
    }
  }

  /**
   * Main initialization method - Show UI immediately, load content progressively
   */
  async initialize() {
    try {
      // FORCE IMMEDIATE UI DISPLAY - Remove any delays
      document.body.style.visibility = 'visible';
      document.body.style.opacity = '1';
      
      // Show static UI elements immediately without waiting for data
      this.updateCoreUI();
      this.setupEventListeners();
      
      // Initialize core data loading WITHOUT blocking the UI (fire and forget)
      this.initializeCore().then(coreSuccess => {
        if (coreSuccess) {
          // Update UI with real data when available
          this.updateCoreUI();
        }
      }).catch(console.warn);
      
      // Load enhanced features in background (fire and forget)
      this.initializeEnhanced().catch(console.warn);

      // Set up update system in background (non-blocking)
      setTimeout(() => {
        this.setupUpdateSystem();
      }, 50); // Reduced from 100ms to 50ms
      
    } catch (error) {
      console.error('Initialization error:', error);
      // Show basic UI even if initialization fails
      document.body.style.visibility = 'visible';
      document.body.style.opacity = '1';
      this.showError('Failed to initialize');
    }
  }

  /**
   * Setup update system - moved to separate method for cleaner initialization
   */
  setupUpdateSystem() {
    // Feature flag for hybrid updates (set to false to revert to original behavior)
    const USE_HYBRID_UPDATES = true;
    
    if (USE_HYBRID_UPDATES) {
      // Hybrid approach: Event-driven for critical updates + periodic for stats
      console.log('🔄 Initializing hybrid update system');
      
      // Critical state fallback - very infrequent backup for event failures
      this.criticalInterval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          this.refreshCriticalState();
        }
      }, 60000); // 1 minute fallback for critical state
      
      // Statistics updates - periodic for time-sensitive but not critical data
      this.statsInterval = setInterval(() => {
        if (document.visibilityState === 'visible' && this.currentTab === 'site-usage') {
          this.refreshStatistics();
        }
      }, 30000); // 30 seconds for statistics
      
      // Enhanced visibility handler - rely more on events
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          setTimeout(() => {
            // Only refresh statistics when popup becomes visible
            // Critical state updates come via events
            this.refreshStatistics();
            // User info is handled by events, but refresh as backup
            this.loadUserInfo().then(response => {
              if (response?.success) {
                this.updateEnhancedUI('user');
              }
            });
          }, 100);
        }
      });
    } else {
      // Original approach - fallback for troubleshooting
      console.log('🔄 Using original update system');
      this.updateInterval = setInterval(() => {
        if (document.visibilityState === 'visible' && this.currentTab === 'site-usage') {
          this.refreshState_backup();
        }
      }, 5000);

      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          setTimeout(() => {
            this.refreshState_backup();
            this.loadUserInfo().then(response => {
              if (response?.success) {
                this.updateEnhancedUI('user');
              }
            });
          }, 100);
        }
      });
    }
  }

  /**
   * Set up event listeners for UI elements
   */
  setupEventListeners() {
    // Listen for updates from background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'STATS_UPDATED') {
        this.enhancedState.todayStats = message.payload;
        this.updateEnhancedUI('stats');
      } else if (message.type === 'FOCUS_STATE_CHANGED') {
        console.log('📱 Popup received FOCUS_STATE_CHANGED:', message.payload, 'at', new Date().toISOString());
        const previousFocusMode = this.coreState.focusMode;
        this.coreState.focusMode = message.payload.isActive;
        console.log(`📱 Popup focus mode updated: ${previousFocusMode} → ${this.coreState.focusMode}`);
        this.updateCoreUI();
        console.log('📱 Popup UI updated after focus state change');
      } else if (message.type === 'USER_INFO_UPDATED') {
        console.log('📱 Received user info update:', message.payload);
        this.enhancedState.userInfo = message.payload;
        // Save to local storage as backup
        chrome.storage.local.set({ userInfo: message.payload });
        this.updateEnhancedUI('user');
      } else if (message.type === 'OVERRIDE_DATA_UPDATED') {
        console.log('🔄 Override data updated, refreshing display');
        this.updateLocalOverrideTime();
      } else if (message.type === 'FORCE_STATE_REFRESH') {
        console.log('🔄 Forced state refresh received:', message.payload);
        // Force refresh the current state from background
        this.refreshState().then(() => {
          console.log('✅ Forced state refresh completed');
        }).catch(error => {
          console.error('❌ Forced state refresh failed:', error);
        });
      }
      sendResponse({ success: true });
      return true;
    });

    // Focus mode toggle (new switch in header)
    const focusModeSwitch = document.querySelector('#focus-mode-toggle');
    if (focusModeSwitch) {
      console.log('🔧 Focus mode switch found, adding listener');
      focusModeSwitch.addEventListener('change', () => {
        console.log('🔧 Focus mode switch toggled');
        this.toggleFocusMode();
      });
    } else {
      console.error('❌ Focus mode switch not found!');
    }

    // Block current site button
    const blockCurrentBtn = document.getElementById('block-current-site');
    if (blockCurrentBtn) {
      console.log('🔧 Block current site button found, adding listener');
      blockCurrentBtn.addEventListener('click', () => {
        console.log('🔧 Block current site button clicked');
        this.toggleCurrentSiteBlock();
      });
    }

    // Add site to block button
    const addSiteBtn = document.getElementById('add-site-btn');
    if (addSiteBtn) {
      addSiteBtn.addEventListener('click', () => this.showAddSiteModal());
    }

    // View all buttons
    const viewAllBtnLoggedIn = document.getElementById('view-all-btn-logged-in');
    const viewAllBtnAnonymous = document.getElementById('view-all-btn-anonymous');
    
    if (viewAllBtnLoggedIn) {
      viewAllBtnLoggedIn.addEventListener('click', () => this.viewAllSites());
    }
    if (viewAllBtnAnonymous) {
      viewAllBtnAnonymous.addEventListener('click', () => this.viewAllSites());
    }

    // Modal handlers
    const modalOverlay = document.getElementById('modal-overlay');
    const modalClose = document.getElementById('modal-close');
    const modalCancel = document.getElementById('modal-cancel');

    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) this.hideModal();
      });
    }
    if (modalClose) {
      modalClose.addEventListener('click', () => this.hideModal());
    }
    if (modalCancel) {
      modalCancel.addEventListener('click', () => this.hideModal());
    }

    // Event delegation for dynamically created delete buttons
    document.addEventListener('click', (e) => {
      if (e.target.closest('.btn-icon[data-action="unblock"]')) {
        const button = e.target.closest('.btn-icon[data-action="unblock"]');
        const domain = button.getAttribute('data-domain');
        if (domain) {
          console.log('🗑️ Delete button clicked for domain:', domain);
          this.unblockSite(domain);
        }
      }
    });
  }

  /**
   * Set up tab system (updated for 2 tabs)
   */
  setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    if (tabButtons.length === 0) {
      console.warn('⚠️ No tab buttons found - tabbed interface disabled');
      return;
    }

    if (tabPanes.length === 0) {
      console.warn('⚠️ No tab panes found - tabbed interface disabled');
      return;
    }

    console.log(`✅ Setting up ${tabButtons.length} tabs`);

    tabButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const targetTab = e.currentTarget.dataset.tab;
        console.log(`🔄 Switching to tab: ${targetTab}`);
        this.switchTab(targetTab);
      });
    });
  }

  /**
   * Switch to a specific tab with optimized updates
   */
  switchTab(tabName) {
    const previousTab = this.currentTab;
    
    // Update current tab
    this.currentTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === `${tabName}-tab`);
    });

    // Handle tab-specific updates
    if (previousTab !== tabName) {
      // Clear previous intervals if switching from site-usage
      if (previousTab === 'site-usage') {
        clearInterval(this.updateInterval);
        clearInterval(this.statsInterval);
      }
      
      // Initialize new tab content
      this.initializeTabContent(tabName);
      
      // Set up new intervals if switching to site-usage
      if (tabName === 'site-usage') {
        // Check if we're using hybrid updates
        const USE_HYBRID_UPDATES = true; // Should match the flag in initialize()
        
        if (USE_HYBRID_UPDATES) {
          // Statistics updates for site-usage tab
          this.statsInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
              this.refreshStatistics();
            }
          }, 30000); // 30 seconds for statistics
        } else {
          // Original approach fallback
          this.updateInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
              this.refreshState_backup();
            }
          }, 5000);
        }
      }
    }
  }

  /**
   * Initialize specific tab content
   */
  initializeTabContent(tabName) {
    switch (tabName) {
      case 'site-usage':
        this.updateTopSites();
        break;
      case 'blocking-sites':
        this.updateBlockedSitesList();
        break;
    }
  }

  /**
   * Update UI elements with current state
   */
  updateUI() {
    // Update user info section
    this.updateUserInfo();
    
    // Update stats overview (new 3-card layout)
    this.updateStatsOverview();
    
    // Update focus mode switch state
    this.updateFocusModeSwitch();
    
    // Only update tab content if it's the site-usage tab and we have valid data
    // Don't reinitialize tab content automatically to prevent duplication
    if (this.currentTab === 'site-usage' && this.enhancedState.todayStats) {
      this.updateTopSites();
    }
  }

  /**
   * Update focus mode switch and title to reflect current state (Web App Style)
   */
  updateFocusModeSwitch() {
    const focusModeSwitch = document.querySelector('#focus-mode-toggle');
    const switchContainer = document.querySelector('.switch-container');
    const switchToggle = document.querySelector('.switch-toggle');
    const switchText = document.querySelector('.switch-text');
    const animatedTitle = document.querySelector('.animated-title');

    if (focusModeSwitch) {
      const isFocusModeActive = this.coreState?.focusMode || false;
      focusModeSwitch.checked = isFocusModeActive;

      // Update container classes
      if (switchContainer) {
        switchContainer.className = `switch-container ${isFocusModeActive ? 'active' : 'inactive'}`;
      }

      // Update toggle classes
      if (switchToggle) {
        switchToggle.className = `switch-toggle ${isFocusModeActive ? 'active' : 'inactive'}`;
      }

      // Update text content and classes
      if (switchText) {
        switchText.textContent = isFocusModeActive ? 'Deep Focus' : 'Deep Focus';
        switchText.className = `switch-text ${isFocusModeActive ? 'active' : 'inactive'}`;
      }
      
      // Update Make10000hours title animation (Web App Style)
      if (animatedTitle) {
        if (isFocusModeActive) {
          animatedTitle.classList.add('active');
        } else {
          animatedTitle.classList.remove('active');
        }
      }

      console.log('🔧 Focus switch and Make10000hours title updated:', isFocusModeActive);
    }
  }

  /**
   * Update user info display (simplified for new design)
   */
  updateUserInfo() {
    const userInfoElement = document.getElementById('user-info');
    const noUserInfoElement = document.getElementById('no-user-info');
    const userNameElement = document.getElementById('user-name');

    if (this.enhancedState.userInfo && this.enhancedState.userInfo.userId) {
      // Show user info
      if (userInfoElement) userInfoElement.classList.remove('hidden');
      if (noUserInfoElement) noUserInfoElement.classList.add('hidden');

      // Update user name (truncate to 14 characters to prevent UI overflow)
      const fullDisplayName = this.enhancedState.userInfo.displayName || this.enhancedState.userInfo.userEmail || 'User';
      const displayName = fullDisplayName.length > 14 ? fullDisplayName.substring(0, 14) + '...' : fullDisplayName;
      if (userNameElement) userNameElement.textContent = displayName;

      console.log('👤 User info displayed:', { displayName });
    } else {
      // Show anonymous info
      if (userInfoElement) userInfoElement.classList.add('hidden');
      if (noUserInfoElement) noUserInfoElement.classList.remove('hidden');

      console.log('👤 Anonymous user');
    }
  }

  /**
   * Update stats overview cards (new 3-card design)
   */
  updateStatsOverview() {
    if (!this.enhancedState.todayStats) return;

    // Total screen time
    const totalTimeEl = document.getElementById('total-time');
    if (totalTimeEl) {
      totalTimeEl.textContent = this.formatTime(this.enhancedState.todayStats.totalTime || 0);
    }

    // Deep focus time - fetch from local storage
    this.updateLocalDeepFocusTime();

    // Override time - fetch from localStorage
    this.updateLocalOverrideTime();
  }

  /**
   * Update deep focus time from local storage
   */
  async updateLocalDeepFocusTime() {
    try {
      const response = await this.sendMessage('GET_LOCAL_DEEP_FOCUS_TIME');
      
      if (response.success) {
        const deepFocusTimeEl = document.getElementById('deep-focus-time');
        if (deepFocusTimeEl) {
          // Convert minutes to milliseconds for formatting
          const focusTimeMs = response.data.minutes * 60 * 1000;
          deepFocusTimeEl.textContent = this.formatTime(focusTimeMs);
          console.log('📊 Updated local deep focus time:', response.data.minutes, 'minutes');
        }
      }
    } catch (error) {
      console.error('❌ Error updating local deep focus time:', error);
      // Fallback to default display
      const deepFocusTimeEl = document.getElementById('deep-focus-time');
      if (deepFocusTimeEl) {
        deepFocusTimeEl.textContent = '0m';
      }
    }
  }

  /**
   * Update deep focus time display
   */
  updateDeepFocusTimeDisplay(minutes) {
    const deepFocusTimeElement = document.querySelector('.deep-focus-time');
    if (deepFocusTimeElement) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      const timeText = hours > 0 ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
      deepFocusTimeElement.textContent = timeText;
      console.log('🔄 Updated deep focus time display:', timeText);
    }
  }

  /**
   * Update override time display from localStorage
   */
  async updateLocalOverrideTime() {
    try {
      const response = await this.sendMessage('GET_LOCAL_OVERRIDE_TIME');
      if (response?.success) {
        const overrideMinutes = response.data.overrideTime || 0;
        const overrideTimeEl = document.getElementById('override-time');
        if (overrideTimeEl) {
          const overrideTimeMs = overrideMinutes * 60 * 1000;
          overrideTimeEl.textContent = this.formatTime(overrideTimeMs);
          console.log('✅ Updated override time from localStorage:', overrideMinutes, 'minutes');
        }
      }
    } catch (error) {
      console.error('Error updating local override time:', error);
    }
  }

  /**
   * Debounce function to prevent rapid updates
   */
  debounce(func, wait) {
    clearTimeout(this.updateTimeout);
    this.updateTimeout = setTimeout(() => func(), wait);
  }

  /**
   * Compare stats to detect changes
   */
  haveStatsChanged(newStats, oldStats) {
    if (!oldStats) return true;
    
    // Compare total time
    if (newStats.totalTime !== oldStats.totalTime) return true;
    
    // Compare sites
    const newSites = newStats.sites || {};
    const oldSites = oldStats.sites || {};
    
    // Check if sites list changed
    const newDomains = Object.keys(newSites);
    const oldDomains = Object.keys(oldSites);
    
    if (newDomains.length !== oldDomains.length) return true;
    
    // Check if any site's data changed
    return newDomains.some(domain => {
      const newSite = newSites[domain] || {};
      const oldSite = oldSites[domain] || {};
      return newSite.timeSpent !== oldSite.timeSpent || 
             newSite.visits !== oldSite.visits;
    });
  }

  /**
   * Update specific site card without rebuilding
   */
  updateSiteCard(siteElement, siteData, totalTime) {
    if (!siteElement || !siteData) return;

    const percentage = totalTime ? 
      Math.round((siteData.timeSpent / totalTime) * 100) : 0;

    // Update only text content and progress bar
    const durationEl = siteElement.querySelector('.site-duration');
    const percentageEl = siteElement.querySelector('.site-percentage');
    const progressFill = siteElement.querySelector('.progress-fill');
    const sessionsEl = siteElement.querySelector('.site-sessions');

    if (durationEl) durationEl.textContent = this.formatTime(siteData.timeSpent);
    if (percentageEl) percentageEl.textContent = `${percentage}%`;
    if (progressFill) {
      progressFill.style.width = `${percentage}%`;
      // Update color using the same logic as web app (in case domain changed)
      progressFill.style.backgroundColor = this.getProgressBarColor(siteData.domain || siteData.url);
    }
    if (sessionsEl) sessionsEl.textContent = `${siteData.visits} sessions`;
  }

  /**
   * Update top sites list with optimized rendering using real-time data
   */
  async updateTopSites() {
    const sitesListEl = document.getElementById('top-sites-list');
    if (!sitesListEl) return;

    // Prevent multiple simultaneous updates
    if (this.updatingTopSites) {
      console.log('🔄 Top sites update already in progress, skipping...');
      return;
    }
    
    this.updatingTopSites = true;

    try {
      const response = await this.sendMessage('GET_REALTIME_TOP_SITES', { limit: 20 });
      
      if (response.success && response.data && response.data.length > 0) {
        const currentSites = response.data;
        
        // Always do a full refresh to prevent duplicates
        while (sitesListEl.firstChild) {
          sitesListEl.removeChild(sitesListEl.firstChild);
        }
        
        // Create unique sites map to prevent duplicates
        const uniqueSites = new Map();
        currentSites.forEach(site => {
          if (!uniqueSites.has(site.domain) || 
              uniqueSites.get(site.domain).timeSpent < site.timeSpent) {
            uniqueSites.set(site.domain, site);
          }
        });
        
        // Convert back to array and sort by time spent
        const sitesToRender = Array.from(uniqueSites.values())
          .sort((a, b) => b.timeSpent - a.timeSpent);
        
        // Create site items
        for (const site of sitesToRender) {
          const siteItem = await this.createSiteItem(site);
          if (siteItem) {
            sitesListEl.appendChild(siteItem);
          }
        }
        
        // Store current sites for reference
        this.previousStats = sitesToRender;
      } else {
        // Clear and add empty state safely
        while (sitesListEl.firstChild) {
          sitesListEl.removeChild(sitesListEl.firstChild);
        }
        const emptyState = document.createElement('div');
        emptyState.className = 'loading-state';
        
        const icon = document.createElement('div');
        icon.style.fontSize = '2rem';
        icon.style.marginBottom = '0.5rem';
        icon.textContent = '📊';
        
        const text = document.createElement('div');
        text.style.color = 'var(--text-muted)';
        text.style.fontSize = '0.875rem';
        text.textContent = 'No sites tracked today';
        
        emptyState.appendChild(icon);
        emptyState.appendChild(text);
        sitesListEl.appendChild(emptyState);
      }
      
    } catch (error) {
      console.error('Error updating top sites:', error);
      // Clear and add error state safely
      while (sitesListEl.firstChild) {
        sitesListEl.removeChild(sitesListEl.firstChild);
      }
      const errorState = document.createElement('div');
      errorState.className = 'loading-state';
      
      const icon = document.createElement('div');
      icon.style.fontSize = '2rem';
      icon.style.marginBottom = '0.5rem';
      icon.textContent = '⚠️';
      
      const text = document.createElement('div');
      text.style.color = 'var(--text-muted)';
      text.style.fontSize = '0.875rem';
      text.textContent = 'Error loading sites';
      
      errorState.appendChild(icon);
      errorState.appendChild(text);
      sitesListEl.appendChild(errorState);
    } finally {
      this.updatingTopSites = false;
    }
  }

  /**
   * Get dominant color from an image
   */
  async getImageColor(imgUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        
        ctx.drawImage(img, 0, 0);
        
        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          const colors = {};
          
          // Sample pixels at regular intervals
          for (let i = 0; i < imageData.length; i += 16) {
            const r = imageData[i];
            const g = imageData[i + 1];
            const b = imageData[i + 2];
            const a = imageData[i + 3];
            
            if (a < 128) continue; // Skip transparent pixels
            
            const rgb = `${r},${g},${b}`;
            colors[rgb] = (colors[rgb] || 0) + 1;
          }
          
          // Find the most common color
          let maxCount = 0;
          let dominantColor = '66,133,244'; // Default blue
          
          for (const [rgb, count] of Object.entries(colors)) {
            if (count > maxCount) {
              maxCount = count;
              dominantColor = rgb;
            }
          }
          
          resolve(`rgb(${dominantColor})`);
        } catch (error) {
          console.warn('Error getting image color:', error);
          resolve(null);
        }
      };
      
      img.onerror = () => {
        resolve(null);
      };
      
      img.src = imgUrl;
    });
  }

  /**
   * Get brand color for known domains
   */
  getBrandColor(domain) {
    const brandColors = {
      'linkedin.com': '#0A66C2',
      'facebook.com': '#1877F2',
      'twitter.com': '#1DA1F2',
      'github.com': '#24292F',
      'youtube.com': '#FF0000',
      'instagram.com': '#E4405F',
      'google.com': '#4285F4',
      'microsoft.com': '#00A4EF',
      'apple.com': '#000000',
      'amazon.com': '#FF9900',
      'app.make10000hours.com': '#FF6B6B',
      'ycombinator.com': '#FF6600',
      'copilot.microsoft.com': '#0078D4',
      'readdy.ai': '#7C3AED',
      'substack.com': '#FF6719',
      'cursor.com': '#000000',
      'news.ycombinator.com': '#FF6600',
      'console.firebase.google.com': '#FFA000',
      'firebase.google.com': '#FFA000',
      'reddit.com': '#FF4500',
      'netflix.com': '#E50914',
      'spotify.com': '#1ED760',
      'twitch.tv': '#9146FF',
      'pinterest.com': '#E60023',
      'discord.com': '#5865F2',
      'slack.com': '#4A154B',
      'zoom.us': '#2D8CFF',
      'notion.so': '#000000',
      'figma.com': '#F24E1E',
      'dribbble.com': '#EA4C89',
      'behance.net': '#1769FF',
      'medium.com': '#00ab6c',
      'dev.to': '#0A0A0A',
      'stackoverflow.com': '#F58025',
      'gitlab.com': '#FC6D26',
      'bitbucket.org': '#0052CC',
      'dropbox.com': '#0061FF',
      'drive.google.com': '#4285F4',
      'onedrive.live.com': '#0078D4',
      'icloud.com': '#007AFF',
      'trello.com': '#0079BF',
      'asana.com': '#273347',
      'monday.com': '#FF3D71',
      'airtable.com': '#18BFFF',
      'canva.com': '#00C4CC',
      'adobe.com': '#FF0000',
      'stripe.com': '#635BFF',
      'paypal.com': '#00457C',
      'shopify.com': '#7AB55C',
      'wordpress.com': '#21759B',
      'squarespace.com': '#000000',
      'wix.com': '#0C6EBD',
      'webflow.com': '#4353FF',
      'vercel.com': '#000000',
      'netlify.com': '#00C7B7',
      'heroku.com': '#430098',
      'aws.amazon.com': '#FF9900',
      'azure.microsoft.com': '#0078D4',
      'cloud.google.com': '#4285F4',
      'digitalocean.com': '#0080FF',
      'linode.com': '#00A95C',
      'vultr.com': '#007BFC'
    };

    // Check exact match first
    if (brandColors[domain]) {
      return brandColors[domain];
    }

    // Check partial matches
    for (const [site, color] of Object.entries(brandColors)) {
      if (domain.includes(site.split('.')[0])) {
        return color;
      }
    }

    return null;
  }

  /**
   * Get progress bar color like web app (with fallback system)
   */
  getProgressBarColor(domain, fallbackColor) {
    const brandColor = this.getBrandColor(domain);
    if (brandColor) {
      return brandColor;
    }
    
    // Use fallback color if provided
    if (fallbackColor) {
      return fallbackColor;
    }
    
    // Default fallback colors (same as web app default system)
    const defaultColors = [
      '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de',
      '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc', '#2ba8f0'
    ];
    
    // Generate a consistent color based on domain hash
    const hash = domain.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return defaultColors[hash % defaultColors.length];
  }

  /**
   * Create a site card element (new template format)
   */
  async createSiteItem(site) {
    const template = document.getElementById('site-item-template');
    if (!template) {
      console.error('Template element not found:', 'site-item-template');
      return null;
    }
    
    const siteItem = template.content.cloneNode(true);
    
    // Set site icon with new favicon service
    const icon = siteItem.querySelector('.site-icon');
    const fallbackIcon = siteItem.querySelector('.site-icon-fallback');
    const progressFill = siteItem.querySelector('.progress-fill');
    
    // Use Chrome extension safe favicon service  
    // Calculate percentage first to determine fallback colors like web app
    const percentage = this.enhancedState.todayStats?.totalTime ? 
      Math.round((site.timeSpent / this.enhancedState.todayStats.totalTime) * 100) : 0;
    
    try {
      const faviconUrl = await getSafeFavicon(site.domain, 32);
      
      if (faviconUrl) {
        // Successfully got favicon using safe methods
        icon.src = faviconUrl;
        icon.style.display = 'block';
        icon.onload = () => {
          fallbackIcon.classList.add('hidden');
        };
        icon.onerror = () => {
          // If image fails to load, show fallback
          icon.style.display = 'none';
          fallbackIcon.classList.remove('hidden');
          fallbackIcon.querySelector('i').className = getDomainFallbackIcon(site.domain);
        };
        fallbackIcon.classList.add('hidden');
      } else {
        // Google service didn't return valid favicon, use fallback
        icon.style.display = 'none';
        fallbackIcon.classList.remove('hidden');
        fallbackIcon.querySelector('i').className = getDomainFallbackIcon(site.domain);
      }
    } catch (error) {
      // Error getting favicon, use fallback
      console.warn('Error loading favicon for', site.domain, error);
      icon.style.display = 'none';
      fallbackIcon.classList.remove('hidden');
      fallbackIcon.querySelector('i').className = getDomainFallbackIcon(site.domain);
    }
    
    // Get progress bar color using the same logic as web app (brand color + fallbacks)
    const progressColor = this.getProgressBarColor(site.domain);
    
    // Apply progress bar color and width
    progressFill.style.backgroundColor = progressColor;
    progressFill.style.width = `${percentage}%`;
    
    // Set site info
    siteItem.querySelector('.site-name').textContent = site.domain;
    siteItem.querySelector('.site-sessions').textContent = `${site.visits} sessions`;
    
    // Set site stats
    siteItem.querySelector('.site-duration').textContent = this.formatTime(site.timeSpent);
    siteItem.querySelector('.site-percentage').textContent = `${percentage}%`;
    
    return siteItem;
  }

  /**
   * Get site icon and color info for consistent styling
   */
  getDomainIcon(domain) {
    // Enhanced mapping with Remix Icons and colors
    const iconMap = {
      'github.com': 'ri-github-fill',
      'gmail.com': 'ri-mail-line',
      'mail.google.com': 'ri-mail-line',
      'youtube.com': 'ri-youtube-fill',
      'facebook.com': 'ri-facebook-fill',
      'twitter.com': 'ri-twitter-fill',
      'linkedin.com': 'ri-linkedin-fill',
      'reddit.com': 'ri-reddit-fill',
      'netflix.com': 'ri-netflix-fill',
      'amazon.com': 'ri-shopping-cart-line',
      'wikipedia.org': 'ri-book-line',
      'google.com': 'ri-google-fill',
      'instagram.com': 'ri-instagram-fill',
      'figma.com': 'ri-shape-line',
      'claude.ai': 'ri-robot-line',
      'app.make10000hours.com': 'ri-focus-3-line',
      'firebase.google.com': 'ri-fire-line',
      'console.firebase.google.com': 'ri-fire-line'
    };

    // Check for domain matches
    for (const [site, icon] of Object.entries(iconMap)) {
      if (domain.includes(site)) {
        return icon;
      }
    }

    // Default icon and color
    return 'ri-global-line';
  }

  /**
   * Get site class for consistent styling
   */
  getDomainClass(domain) {
    const domainMap = {
      'linkedin.com': 'linkedin',
      'app.make10000hours.com': 'make10000hours',
      'ycombinator.com': 'ycombinator',
      'copilot.microsoft.com': 'copilot',
      'readdy.ai': 'readdy',
      'facebook.com': 'facebook'
    };
    return domainMap[domain] || 'default';
  }

  /**
   * Update blocked sites list
   */
  async updateBlockedSitesList() {
    const blockedSitesListEl = document.getElementById('blocked-sites-list');
    if (!blockedSitesListEl) return;

    try {
      const response = await this.sendMessage('GET_BLOCKED_SITES');
      
      if (response.success && response.data.length > 0) {
        while (blockedSitesListEl.firstChild) {
          blockedSitesListEl.removeChild(blockedSitesListEl.firstChild);
        }
        
        for (const domain of response.data) {
          const blockedSiteItem = await this.createBlockedSiteItem(domain);
          blockedSitesListEl.appendChild(blockedSiteItem);
        }
      } else {
        // Clear and add empty state safely
        while (blockedSitesListEl.firstChild) {
          blockedSitesListEl.removeChild(blockedSitesListEl.firstChild);
        }
        const emptyState = document.createElement('div');
        emptyState.className = 'loading-state';
        
        const icon = document.createElement('div');
        icon.style.fontSize = '2rem';
        icon.style.marginBottom = '0.5rem';
        icon.textContent = '🛡️';
        
        const text = document.createElement('div');
        text.style.color = 'var(--text-muted)';
        text.style.fontSize = '0.875rem';
        text.textContent = 'No blocked sites';
        
        emptyState.appendChild(icon);
        emptyState.appendChild(text);
        blockedSitesListEl.appendChild(emptyState);
      }
    } catch (error) {
      console.error('Error updating blocked sites:', error);
      // Clear and add error state safely
      while (blockedSitesListEl.firstChild) {
        blockedSitesListEl.removeChild(blockedSitesListEl.firstChild);
      }
      const errorState = document.createElement('div');
      errorState.className = 'loading-state';
      
      const text = document.createElement('div');
      text.style.color = 'var(--accent-red)';
      text.textContent = 'Failed to load blocked sites';
      
      errorState.appendChild(text);
      blockedSitesListEl.appendChild(errorState);
    }
  }

  /**
   * Create blocked site item (new template format)
   */
  async createBlockedSiteItem(domain) {
    const item = document.createElement('div');
    item.className = 'blocked-site-item';
    
    // Create left section
    const leftSection = document.createElement('div');
    leftSection.className = 'blocked-site-left';
    
    // Create icon container
    const iconContainer = document.createElement('div');
    iconContainer.className = 'blocked-site-icon';
    
    // Try to get favicon using safe methods, fallback to icon
    try {
      const faviconUrl = await getSafeFavicon(domain, 32);
      if (faviconUrl) {
        const img = document.createElement('img');
        img.src = faviconUrl;
        img.alt = domain;
        img.className = 'site-icon';
        
        const fallback = document.createElement('div');
        fallback.className = 'fallback-icon';
        fallback.style.display = 'none';
        fallback.style.alignItems = 'center';
        fallback.style.justifyContent = 'center';
        fallback.style.width = '32px';
        fallback.style.height = '32px';
        
        const fallbackIcon = document.createElement('i');
        fallbackIcon.className = getDomainFallbackIcon(domain);
        fallback.appendChild(fallbackIcon);
        
        img.onerror = () => {
          img.style.display = 'none';
          fallback.style.display = 'flex';
        };
        
        iconContainer.appendChild(img);
        iconContainer.appendChild(fallback);
      } else {
        const fallbackIcon = document.createElement('i');
        fallbackIcon.className = getDomainFallbackIcon(domain);
        iconContainer.appendChild(fallbackIcon);
      }
    } catch (error) {
      const fallbackIcon = document.createElement('i');
      fallbackIcon.className = getDomainFallbackIcon(domain);
      iconContainer.appendChild(fallbackIcon);
    }
    
    // Create domain name
    const domainName = document.createElement('div');
    domainName.className = 'blocked-site-name';
    domainName.textContent = domain;
    
    leftSection.appendChild(iconContainer);
    leftSection.appendChild(domainName);
    
    // Create controls section
    const controls = document.createElement('div');
    controls.className = 'blocked-site-controls';
    
    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-icon';
    deleteBtn.title = 'Delete';
    deleteBtn.setAttribute('data-action', 'unblock');
    deleteBtn.setAttribute('data-domain', domain);
    const deleteIcon = document.createElement('i');
    deleteIcon.className = 'ri-delete-bin-line';
    deleteBtn.appendChild(deleteIcon);
    
    // Switch
    const switchLabel = document.createElement('label');
    switchLabel.className = 'custom-switch';
    const switchInput = document.createElement('input');
    switchInput.type = 'checkbox';
    switchInput.checked = true;
    const switchSlider = document.createElement('span');
    switchSlider.className = 'switch-slider';
    
    switchLabel.appendChild(switchInput);
    switchLabel.appendChild(switchSlider);
    
    controls.appendChild(deleteBtn);
    controls.appendChild(switchLabel);
    
    // Assemble the item
    item.appendChild(leftSection);
    item.appendChild(controls);

    return item;
  }

  /**
   * Show add site modal
   */
  async showAddSiteModal() {
    // Get current tab's domain as default value
    let currentDomain = '';
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.url) {
        const url = new URL(activeTab.url);
        currentDomain = url.hostname.replace(/^www\./, ''); // Remove www. prefix
      }
    } catch (error) {
      console.warn('Could not get current tab domain:', error);
    }

    // Show modal with proper structure matching web app design
    const modalOverlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    const modalConfirm = document.getElementById('modal-confirm');
    const modalCancel = document.getElementById('modal-cancel');

    if (modalTitle) modalTitle.textContent = 'Add to Blocking Sites';
    if (modalContent) {
      modalContent.innerHTML = `
        <div class="add-site-form">
          <div class="input-container">
            <input 
              type="text" 
              id="site-input" 
              placeholder="Enter domain (e.g. youtube.com)" 
              class="form-input"
              value="${currentDomain}"
            >
            <button type="button" id="input-clear-btn" class="input-clear-btn${currentDomain ? ' visible' : ''}">
              <i class="ri-close-line"></i>
            </button>
          </div>
          <p style="color: var(--text-secondary); font-size: 14px; margin: 8px 0 0 0;">
            Enter the domain you want to block. The site will be blocked during focus mode.
          </p>
        </div>
      `;
    }
    
    // Update modal buttons
    if (modalConfirm) {
      modalConfirm.textContent = 'Add Site';
      modalConfirm.className = 'btn primary';
    }
    if (modalCancel) {
      modalCancel.textContent = 'Cancel';
      modalCancel.className = 'btn secondary';
    }
    
    if (modalOverlay) modalOverlay.classList.remove('hidden');

    // Add event listeners
    const siteInput = document.getElementById('site-input');
    const clearBtn = document.getElementById('input-clear-btn');

    // Just focus the input without selecting text
    if (siteInput) {
      setTimeout(() => {
        siteInput.focus();
        // Move cursor to end of text instead of selecting all
        if (currentDomain) {
          siteInput.setSelectionRange(siteInput.value.length, siteInput.value.length);
        }
      }, 100);
    }

    // Handle clear button visibility and functionality
    const updateClearButton = () => {
      if (clearBtn && siteInput) {
        if (siteInput.value.trim()) {
          clearBtn.classList.add('visible');
        } else {
          clearBtn.classList.remove('visible');
        }
      }
    };

    // Clear button click handler
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (siteInput) {
          siteInput.value = '';
          siteInput.focus();
          updateClearButton();
        }
      });
    }

    // Handle confirm button
    const handleAddSite = async () => {
      const domain = siteInput?.value.trim();
      if (domain) {
        await this.addBlockedSite(domain);
      }
    };

    // Remove existing listeners and add new ones
    if (modalConfirm) {
      modalConfirm.replaceWith(modalConfirm.cloneNode(true));
      const newConfirm = document.getElementById('modal-confirm');
      newConfirm?.addEventListener('click', handleAddSite);
    }

    if (siteInput) {
      // Input change listener to show/hide clear button
      siteInput.addEventListener('input', updateClearButton);
      
      // Enter key handler
      siteInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          handleAddSite();
        }
      });
    }
  }

  /**
   * Add site to blocked list
   */
  async addBlockedSite(domain) {
    try {
      const response = await this.sendMessage('ADD_BLOCKED_SITE', { domain });
      
      if (response.success) {
        this.hideModal();
        this.showNotification(`${domain} has been added to blocking sites`, 'success');
        // Refresh blocked sites list if on that tab
        if (this.currentTab === 'blocking-sites') {
          this.updateBlockedSitesList();
        }
      } else {
        this.showNotification('Failed to block site: ' + response.error, 'error');
      }
    } catch (error) {
      console.error('Error adding blocked site:', error);
      this.showNotification('Failed to block site', 'error');
    }
  }

  /**
   * Unblock a site
   */
  async unblockSite(domain) {
    try {
      const response = await this.sendMessage('REMOVE_BLOCKED_SITE', { domain });
      
      if (response.success) {
        this.showNotification(`${domain} has been unblocked`, 'success');
        // Refresh blocked sites list
        this.updateBlockedSitesList();
      } else {
        this.showNotification('Failed to unblock site: ' + response.error, 'error');
      }
    } catch (error) {
      console.error('Error unblocking site:', error);
      this.showNotification('Failed to unblock site', 'error');
    }
  }

  /**
   * Toggle focus mode on/off
   */
  async toggleFocusMode() {
    try {
      this.showLoading();
      
      // Get the current switch state
      const focusModeSwitch = document.querySelector('#focus-mode-toggle');
      const newFocusState = focusModeSwitch.checked;
      
      // Update UI immediately
      this.coreState.focusMode = newFocusState;
      this.updateFocusModeSwitch();
      
      // Send message to background
      const response = await this.sendMessage('TOGGLE_FOCUS_MODE');
      
      if (response.success) {
        this.showNotification(
          response.focusMode 
            ? 'Deep Focus mode is ON!' 
            : 'Deep Focus mode is OFF!',
          response.focusMode ? 'success' : 'info'
        );
        
        // Refresh state to ensure sync
        await this.refreshState();
      } else {
        // If failed, revert the switch state
        this.coreState.focusMode = !newFocusState;
        this.updateFocusModeSwitch();
        this.showError('Failed to toggle focus mode: ' + response.error);
      }
    } catch (error) {
      console.error('Error toggling focus mode:', error);
      // Revert switch state on error
      this.coreState.focusMode = !focusModeSwitch.checked;
      this.updateFocusModeSwitch();
      this.showError('Failed to toggle focus mode');
    } finally {
      this.hideLoading();
    }
  }

  /**
   * Toggle blocking for the current site
   */
  async toggleCurrentSiteBlock() {
    try {
      this.showLoading();
      
      const response = await this.sendMessage('BLOCK_CURRENT_SITE');
      
      if (response.success) {
        this.showNotification(
          `${response.domain} has been added to blocking sites`,
          'success'
        );
        
        // Refresh state to update UI
        await this.refreshState();
      } else {
        this.showError('Failed to block site: ' + response.error);
      }
    } catch (error) {
      console.error('Error toggling site block:', error);
      this.showError('Failed to block site');
    } finally {
      this.hideLoading();
    }
  }

  /**
   * Refresh state and update UI
   */
  async refreshState() {
    try {
      console.log('🔄 PopupManager.refreshState() called at', new Date().toISOString());
      
      // Refresh core state
      const stateResult = await this.sendMessageWithRetry('GET_CURRENT_STATE', {}, 2);
      console.log('📥 Received state from background:', stateResult);
      
      if (stateResult?.success) {
        const previousFocusMode = this.coreState.focusMode;
        this.coreState = {
          ...this.coreState,
          ...stateResult.data
        };
        console.log(`📱 Core state updated - focus mode: ${previousFocusMode} → ${this.coreState.focusMode}`);
        this.updateCoreUI();
        console.log('📱 Core UI updated after state refresh');
      }

      // Refresh enhanced state in parallel
      const enhancedUpdates = [
        this.loadStats(),
        this.loadUserInfo(),
        this.loadFocusState()
      ];

      // Update UI as each feature refreshes
      for (const update of enhancedUpdates) {
        update.then(result => {
          if (result?.success) {
            this.updateEnhancedUI(result.type);
          }
        }).catch(console.warn);
      }

      // Update override time
      await this.updateLocalOverrideTime();
      console.log('✅ RefreshState completed successfully');
    } catch (error) {
      console.warn('Failed to refresh state:', error);
    }
  }

  /**
   * Refresh only critical state that needs immediate updates
   * Used as fallback when events fail
   */
  async refreshCriticalState() {
    try {
      console.log('🔄 PopupManager.refreshCriticalState() called at', new Date().toISOString());
      
      // Only refresh core state for immediate needs
      const stateResult = await this.sendMessageWithRetry('GET_CURRENT_STATE', {}, 2);
      console.log('📥 Received critical state from background:', stateResult);
      
      if (stateResult?.success) {
        const previousFocusMode = this.coreState.focusMode;
        const newState = {
          ...this.coreState,
          ...stateResult.data
        };
        
        // Only update if state actually changed
        if (this.hasStateChanged(newState, this.coreState)) {
          this.coreState = newState;
          console.log(`📱 Critical state updated - focus mode: ${previousFocusMode} → ${this.coreState.focusMode}`);
          this.updateCoreUI();
          console.log('📱 Core UI updated after critical state refresh');
        } else {
          console.log('📱 Critical state unchanged, skipping UI update');
        }
      }
      
      console.log('✅ RefreshCriticalState completed successfully');
    } catch (error) {
      console.warn('Failed to refresh critical state:', error);
    }
  }

  /**
   * Refresh only statistics that can tolerate delays
   * Used for periodic updates every 30 seconds
   */
  async refreshStatistics() {
    try {
      console.log('📊 PopupManager.refreshStatistics() called at', new Date().toISOString());
      
      // Refresh statistics in parallel
      const statsUpdates = [
        this.loadStats(),
        this.loadFocusState()
      ];

      // Update UI as each statistic refreshes
      for (const update of statsUpdates) {
        update.then(result => {
          if (result?.success) {
            this.updateEnhancedUI(result.type);
          }
        }).catch(console.warn);
      }

      // Update override time
      await this.updateLocalOverrideTime();
      console.log('✅ RefreshStatistics completed successfully');
    } catch (error) {
      console.warn('Failed to refresh statistics:', error);
    }
  }

  /**
   * Check if state has actually changed to prevent unnecessary UI updates
   */
  hasStateChanged(newState, oldState) {
    if (!oldState) return true;
    
    // Compare critical state properties
    const criticalProps = ['focusMode', 'isTracking', 'currentDomain'];
    for (const prop of criticalProps) {
      if (newState[prop] !== oldState[prop]) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Backup of original refreshState method for fallback
   */
  async refreshState_backup() {
    try {
      console.log('🔄 PopupManager.refreshState_backup() called at', new Date().toISOString());
      
      // Refresh core state
      const stateResult = await this.sendMessageWithRetry('GET_CURRENT_STATE', {}, 2);
      console.log('📥 Received state from background:', stateResult);
      
      if (stateResult?.success) {
        const previousFocusMode = this.coreState.focusMode;
        this.coreState = {
          ...this.coreState,
          ...stateResult.data
        };
        console.log(`📱 Core state updated - focus mode: ${previousFocusMode} → ${this.coreState.focusMode}`);
        this.updateCoreUI();
        console.log('📱 Core UI updated after state refresh');
      }

      // Refresh enhanced state in parallel
      const enhancedUpdates = [
        this.loadStats(),
        this.loadUserInfo(),
        this.loadFocusState()
      ];

      // Update UI as each feature refreshes
      for (const update of enhancedUpdates) {
        update.then(result => {
          if (result?.success) {
            this.updateEnhancedUI(result.type);
          }
        }).catch(console.warn);
      }

      // Update override time
      await this.updateLocalOverrideTime();
      console.log('✅ RefreshState_backup completed successfully');
    } catch (error) {
      console.warn('Failed to refresh state (backup):', error);
    }
  }

  /**
   * Open settings page
   */
  openSettings() {
    chrome.runtime.openOptionsPage();
  }

  /**
   * Export data
   */
  async exportData() {
    try {
      this.showModal('Export Data', `
        <p>Choose export format:</p>
        <div style="display: flex; gap: 1rem; margin-top: 1rem;">
          <button id="export-json" class="btn secondary">JSON</button>
          <button id="export-csv" class="btn secondary">CSV</button>
        </div>
      `);

      // Add export handlers
      document.getElementById('export-json')?.addEventListener('click', () => {
        this.performExport('json');
      });
      
      document.getElementById('export-csv')?.addEventListener('click', () => {
        this.performExport('csv');
      });
    } catch (error) {
      console.error('Error exporting data:', error);
      this.showNotification('Failed to export data', 'error');
    }
  }

  /**
   * Perform actual data export
   */
  async performExport(format) {
    try {
      const response = await this.sendMessage('EXPORT_DATA', { format });
      
      if (response.success) {
        // Create download link
        const blob = new Blob([response.data], { 
          type: format === 'json' ? 'application/json' : 'text/csv' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `focus-tracker-data.${format}`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.hideModal();
        this.showNotification('Data exported successfully', 'success');
      } else {
        throw new Error(response.error || 'Export failed');
      }
    } catch (error) {
      console.error('Error performing export:', error);
      this.showNotification('Failed to export data', 'error');
    }
  }

  /**
   * View all sites (opens detailed view)
   */
  viewAllSites() {
    // Open the main web app
    chrome.tabs.create({ url: 'https://app.make10000hours.com' });
  }

  /**
   * Show site details modal
   */
  showSiteDetails(site) {
        const percentage = this.enhancedState.todayStats?.totalTime ?
      Math.round((site.timeSpent / this.enhancedState.todayStats.totalTime) * 100) : 0;

    const iconInfo = this.getSiteIconInfo(site.domain);

    this.showModal(`${site.domain} Details`, `
      <div style="text-align: center;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">
          <i class="${iconInfo.icon}" style="color: var(--accent-${iconInfo.color});"></i>
        </div>
        <h4 style="margin-bottom: 1rem;">${site.domain}</h4>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
          <div style="text-align: center; padding: 1rem; background: var(--bg-secondary); border-radius: 0.5rem;">
            <div style="font-size: 1.5rem; font-weight: bold; color: var(--primary-color);">
              ${this.formatTime(site.timeSpent)}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Time Spent</div>
          </div>
          <div style="text-align: center; padding: 1rem; background: var(--bg-secondary); border-radius: 0.5rem;">
            <div style="font-size: 1.5rem; font-weight: bold; color: var(--accent-blue);">
              ${site.visits}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Sessions</div>
          </div>
        </div>
        
        <div style="text-align: center; margin-bottom: 1rem;">
          <div style="font-size: 1.25rem; font-weight: bold; color: var(--text-primary);">
            ${percentage}% of today's time
          </div>
        </div>
        
        <div style="margin-top: 1rem;">
          <button id="block-site-btn" class="btn primary" style="width: 100%;">
            🚫 Block This Site
          </button>
        </div>
      </div>
    `);

    // Add block site handler
    document.getElementById('block-site-btn')?.addEventListener('click', async () => {
      await this.addBlockedSite(site.domain);
    });
  }

  /**
   * Show help modal
   */
  showHelp() {
    this.showModal('Help & Guide', `
      <h4>How Make10000hours Focus Tracker Works</h4>
      <ul style="text-align: left; margin: 1rem 0;">
        <li><strong>Automatic Tracking:</strong> Time is tracked when you're active on a tab</li>
        <li><strong>Deep Focus Mode:</strong> Blocks distracting sites during work sessions</li>
        <li><strong>Site Blocking:</strong> Add sites to your block list</li>
        <li><strong>Web App Sync:</strong> Data syncs with your Make10000hours account</li>
      </ul>
      
      <h4>Features</h4>
      <ul style="text-align: left; margin: 1rem 0;">
        <li><strong>Site Usage:</strong> Track where you spend your time</li>
        <li><strong>Blocking Sites:</strong> Manage your distraction blocklist</li>
        <li><strong>Progress Tracking:</strong> View detailed analytics on the web app</li>
      </ul>
      
      <p style="margin-top: 1rem;">
        <strong>Need more help?</strong> Visit 
        <a href="https://app.make10000hours.com" style="color: var(--primary-color);">app.make10000hours.com</a> 
        for detailed analytics and progress tracking.
      </p>
    `);
  }

  /**
   * Show feedback modal
   */
  showFeedback() {
    this.showModal('Send Feedback', `
      <p>We'd love to hear from you! Help us improve Make10000hours Focus Tracker.</p>
      
      <div style="margin: 1rem 0;">
        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">
          Feedback Type:
        </label>
        <select id="feedback-type" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 0.25rem;">
          <option value="bug">Bug Report</option>
          <option value="feature">Feature Request</option>
          <option value="general">General Feedback</option>
        </select>
      </div>
      
      <div style="margin: 1rem 0;">
        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">
          Your Message:
        </label>
        <textarea id="feedback-message" 
          placeholder="Tell us what you think..." 
          style="width: 100%; height: 100px; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 0.25rem; resize: vertical;">
        </textarea>
      </div>
      
      <button id="send-feedback-btn" class="btn primary" style="width: 100%;">
        Send Feedback
      </button>
    `);

    // Add send feedback handler
    document.getElementById('send-feedback-btn')?.addEventListener('click', () => {
      const type = document.getElementById('feedback-type')?.value;
      const message = document.getElementById('feedback-message')?.value;
      
      if (message.trim()) {
        // In a real implementation, this would send to your feedback system
        console.log('Feedback:', { type, message });
        this.hideModal();
        this.showNotification('Thank you for your feedback!', 'success');
      } else {
        this.showNotification('Please enter your feedback message', 'error');
      }
    });
  }

  /**
   * Format time in milliseconds to human readable string
   */
  formatTime(ms, format = 'compact') {
    if (!ms) return '0m';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (format === 'clock') {
      return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    }
    
    // For times less than 1 minute, show 0m (not seconds)
    if (minutes < 1) {
      return '0m';
    }
    
    // For times less than 1 hour, show minutes
    if (hours < 1) {
      return `${minutes}m`;
    }
    
    // For times over 1 hour
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }

  /**
   * Send message to background script
   */
  async sendMessage(type, payload = {}) {
    try {
      console.log(`📤 Sending message: ${type}`, payload);
      
      // Use MessageQueueManager for reliable message delivery
      const messageQueue = new MessageQueueManager();
      const response = await messageQueue.enqueue({ type, payload });
      
      console.log(`📥 Received response for ${type}:`, response);
      return response;
    } catch (error) {
      console.error(`❌ Error sending message ${type}:`, error);
      throw error;
    }
  }

  /**
   * Send message with retry logic
   */
  async sendMessageWithRetry(type, payload = {}, maxRetries = 2) {
    try {
      // MessageQueueManager handles retries internally
      return await this.sendMessage(type, payload);
    } catch (error) {
      console.error('Failed to send message after retries:', error);
      throw error;
    }
  }

  /**
   * Get default state for fallback
   */
  getDefaultState() {
    return {
      isTracking: false,
      currentSite: null,
      focusStats: {
        focusMode: false
      }
    };
  }

  /**
   * Get default stats for fallback
   */
  getDefaultStats() {
    return {
      totalTime: 0,
      sitesVisited: 0,
      topSites: []
    };
  }

  /**
   * Get default user info for fallback
   */
  getDefaultUserInfo() {
    return {
      userId: 'anonymous',
      displayName: 'Anonymous',
      isLoggedIn: false
    };
  }

  /**
   * Show modal dialog
   */
  showModal(title, content) {
    const modalOverlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');

    if (modalTitle) modalTitle.textContent = title;
    if (modalContent) modalContent.innerHTML = content;
    if (modalOverlay) modalOverlay.classList.remove('hidden');
  }

  /**
   * Hide modal dialog
   */
  hideModal() {
    const modalOverlay = document.getElementById('modal-overlay');
    if (modalOverlay) modalOverlay.classList.add('hidden');
  }

  /**
   * Show loading overlay
   */
  showLoading() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) loadingOverlay.classList.remove('hidden');
  }

  /**
   * Hide loading overlay
   */
  hideLoading() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
  }

  /**
   * Show notification (simple implementation)
   */
  showNotification(message, type = 'info') {
    // Create temporary notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 65px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 16px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      font-size: 14px;
      z-index: 10000;
      background: ${type === 'success' ? 'var(--accent-green)' : 
                   type === 'error' ? 'var(--accent-red)' : 
                   'var(--primary-color)'};
      box-shadow: var(--shadow-lg);
      max-width: calc(100% - 40px);
      white-space: nowrap;
      animation: slideDown 0.3s ease;
    `;
    notification.textContent = message;

    // Add animation keyframes
    if (!document.getElementById('notification-styles')) {
      const style = document.createElement('style');
      style.id = 'notification-styles';
      style.textContent = `
        @keyframes slideDown {
          from { 
            transform: translateX(-50%) translateY(-20px); 
            opacity: 0; 
          }
          to { 
            transform: translateX(-50%) translateY(0); 
            opacity: 1; 
          }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  /**
   * Show error message
   */
  showError(message) {
    this.showNotification(message, 'error');
  }

  /**
   * Cleanup when popup closes
   */
  cleanup() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    if (this.criticalInterval) {
      clearInterval(this.criticalInterval);
    }
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
    }
  }

  // Add new method to update metrics
  updateMetrics(metrics) {
    if (metrics.deepFocusTime !== undefined) {
      document.getElementById('deep-focus-time').textContent = this.formatTime(metrics.deepFocusTime * 60000);
    }
    if (metrics.overrideTime !== undefined) {
      document.getElementById('override-time').textContent = this.formatTime(metrics.overrideTime * 60000);
    }
  }
}

// Initialize popup manager after DOM is ready
let popupManager = null;

// Wait for DOM to be fully loaded before initializing
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    popupManager = new PopupManager();
  });
} else {
  // DOM already loaded
  popupManager = new PopupManager();
}

// Cleanup on window unload
window.addEventListener('unload', () => {
  if (popupManager) {
    popupManager.cleanup();
  }
}); 