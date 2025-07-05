/**
 * Popup Script for Make10000hours Extension
 * Handles UI interactions and communication with background script
 */

class PopupManager {
  constructor() {
    this.currentState = null;
    this.todayStats = null;
    this.userInfo = null;
    this.sessionTimer = null;
    this.updateInterval = null;
    this.analyticsUI = null;
    this.currentTab = 'site-usage'; // Updated for new 2-tab system
    this.previousStats = null; // Add cache for previous stats
    this.updateTimeout = null; // Add debounce timeout
    this.metricsUnsubscribe = null; // Add unsubscribe function
    
    this.initialize();
  }

  /**
   * Initialize popup manager
   */
  async initialize() {
    try {
      // Show loading state
      this.showLoading();

      // Initialize analytics UI component
      if (window.AnalyticsUI) {
        this.analyticsUI = new window.AnalyticsUI();
      }

      // Get initial state and stats - always get fresh focus state
      const [stateResponse, statsResponse, focusStateResponse, userInfoResponse] = await Promise.all([
        this.sendMessage('GET_CURRENT_STATE'),
        this.sendMessage('GET_TODAY_STATS'),
        this.sendMessage('GET_FOCUS_STATE'),
        this.sendMessage('GET_USER_INFO')
      ]);

      if (stateResponse?.success) {
        this.currentState = stateResponse.data;
      }

      if (statsResponse?.success) {
        this.todayStats = statsResponse.data;
      }

      // Always use the latest focus state to ensure sync
      if (focusStateResponse?.success) {
        if (!this.currentState.focusStats) {
          this.currentState.focusStats = {};
        }
        this.currentState.focusStats.focusMode = focusStateResponse.data.focusMode;
      }

      // Store user info and initialize Firebase metrics if user is logged in
      if (userInfoResponse?.success) {
        this.userInfo = userInfoResponse.data;
        if (this.userInfo?.uid) {
          // Get initial metrics
          try {
            const metrics = await window.firebaseService.getTodayMetrics(this.userInfo.uid);
            this.updateMetrics(metrics);
            
            // Subscribe to real-time updates
            this.metricsUnsubscribe = window.firebaseService.subscribeTodayMetrics(
              this.userInfo.uid,
              (update) => {
                if (update.type === 'deepFocus') {
                  document.getElementById('deep-focus-time').textContent = this.formatTime(update.time * 60000);
                } else if (update.type === 'override') {
                  document.getElementById('override-time').textContent = this.formatTime(update.time * 60000);
                }
              }
            );
          } catch (error) {
            console.error('Error initializing Firebase metrics:', error);
          }
        }
      }

      // Update UI with initial data
      this.updateUI();
      this.hideLoading();

      // Set up tab system
      this.setupTabs();

      // Set up periodic updates with optimized frequency
      this.updateInterval = setInterval(() => {
        // Only refresh if popup is visible and in site-usage tab
        if (document.visibilityState === 'visible' && this.currentTab === 'site-usage') {
          this.refreshState();
        }
      }, 15000); // Check every 15 seconds

      // Set up event listeners
      this.setupEventListeners();

      // Listen for updates from background
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'STATS_UPDATED') {
          this.todayStats = message.payload;
          this.updateUI();
        } else if (message.type === 'FOCUS_STATE_CHANGED') {
          // Update local state and UI without triggering another toggle
          this.currentState.focusStats.focusMode = message.payload.isActive;
          this.updateUI();
        } else if (message.type === 'USER_INFO_UPDATED') {
          this.userInfo = message.payload;
          this.updateUserInfo();
        }
        sendResponse({ success: true });
        return true;
      });
    } catch (error) {
      console.error('Error initializing popup:', error);
      this.hideLoading();
      this.showError('Failed to initialize. Please try again.');
    }
  }

  /**
   * Set up event listeners for UI elements
   */
  setupEventListeners() {
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

    // Block current site button (moved to header)
    const blockCurrentBtn = document.getElementById('block-current-site');
    if (blockCurrentBtn) {
      console.log('🔧 Block current site button found, adding listener');
      blockCurrentBtn.addEventListener('click', () => {
        console.log('🔧 Block current site button clicked');
        this.toggleCurrentSiteBlock();
      });
    } else {
      console.error('❌ Block current site button not found!');
    }

    // Add site to block button
    const addSiteBtn = document.getElementById('add-site-btn');
    if (addSiteBtn) {
      addSiteBtn.addEventListener('click', () => this.showAddSiteModal());
    }

    // Settings button (legacy support)
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => this.openSettings());
    }

    // Export data button (legacy support)
    const exportBtn = document.getElementById('export-data-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportData());
    }

    // View all sites button (now "View progress")
    const viewAllBtn = document.getElementById('view-all-btn');
    if (viewAllBtn) {
      viewAllBtn.addEventListener('click', () => this.viewAllSites());
    }

    // Help and feedback (legacy support)
    const helpBtn = document.getElementById('help-btn');
    if (helpBtn) {
      helpBtn.addEventListener('click', () => this.showHelp());
    }

    const feedbackBtn = document.getElementById('feedback-btn');
    if (feedbackBtn) {
      feedbackBtn.addEventListener('click', () => this.showFeedback());
    }

    // Modal close handlers
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

    // Set up dynamic event listeners for unblock buttons
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="unblock"]')) {
        const domain = e.target.closest('[data-domain]').dataset.domain;
        this.unblockSite(domain);
      }
    });

    // Add click handler for Detail Progress buttons
    ['view-all-btn-logged-in', 'view-all-btn-anonymous'].forEach(btnId => {
      const button = document.getElementById(btnId);
      if (button) {
        button.addEventListener('click', (e) => {
          e.preventDefault(); // Prevent default navigation
          chrome.tabs.create({ url: 'https://make10000hours.com/#/deep-focus' });
        });
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
      // Clear previous interval if switching from site-usage
      if (previousTab === 'site-usage') {
        clearInterval(this.updateInterval);
      }
      
      // Initialize new tab content
      this.initializeTabContent(tabName);
      
      // Set up new interval if switching to site-usage
      if (tabName === 'site-usage') {
        this.updateInterval = setInterval(() => {
          if (document.visibilityState === 'visible') {
            this.refreshState();
          }
        }, 15000);
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
    if (this.currentTab === 'site-usage' && this.todayStats) {
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
      const isFocusModeActive = this.currentState?.focusStats?.focusMode || false;
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
        switchText.textContent = isFocusModeActive ? 'Deep Focus' : 'Focus Off';
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

    if (this.userInfo && this.userInfo.userId) {
      // Show user info
      if (userInfoElement) userInfoElement.classList.remove('hidden');
      if (noUserInfoElement) noUserInfoElement.classList.add('hidden');

      // Update user name
      const displayName = this.userInfo.displayName || this.userInfo.userEmail || 'User';
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
    if (!this.todayStats) return;

    // Total screen time
    const totalTimeEl = document.getElementById('total-time');
    if (totalTimeEl) {
      totalTimeEl.textContent = this.formatTime(this.todayStats.totalTime || 0);
    }

    // Deep focus time
    const deepFocusTimeEl = document.getElementById('deep-focus-time');
    if (deepFocusTimeEl) {
      const focusTime = this.currentState?.focusStats?.focusTime || 0;
      deepFocusTimeEl.textContent = this.formatTime(focusTime);
    }

    // Override time
    const overrideTimeEl = document.getElementById('override-time');
    if (overrideTimeEl) {
      const overrideTime = this.currentState?.focusStats?.overrideTime || 0;
      overrideTimeEl.textContent = this.formatTime(overrideTime);
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
    if (progressFill) progressFill.style.width = `${percentage}%`;
    if (sessionsEl) sessionsEl.textContent = `${siteData.visits} sessions`;
  }

  /**
   * Update top sites list with optimized rendering
   */
  async updateTopSites() {
    const sitesListEl = document.getElementById('top-sites-list');
    if (!sitesListEl) return;

    try {
      const response = await this.sendMessage('GET_TOP_SITES', { limit: 20 });
      
      if (response.success && response.data.length > 0) {
        const currentSites = response.data;
        
        // Check if we need to do a full refresh
        const needsFullRefresh = !this.previousStats || 
                                 !sitesListEl.children.length ||
                                 sitesListEl.querySelector('.loading-state');
        
        if (needsFullRefresh) {
          // Clear all existing content and rebuild
          sitesListEl.innerHTML = '';
          for (const site of currentSites) {
            const siteItem = await this.createSiteItem(site);
            sitesListEl.appendChild(siteItem);
          }
        } else {
          // Update existing cards
          const totalTime = this.todayStats?.totalTime || 0;
          
          // Get current site elements (only real site items, not loading states)
          const siteElements = sitesListEl.querySelectorAll('.site-item');
          const currentDomains = currentSites.map(site => site.domain);
          
          // Update or remove existing elements
          siteElements.forEach(element => {
            const domain = element.querySelector('.site-name')?.textContent;
            const siteData = currentSites.find(site => site.domain === domain);
            
            if (siteData) {
              this.updateSiteCard(element, siteData, totalTime);
            } else {
              element.remove();
            }
          });
          
          // Add new sites that don't exist yet
          for (const site of currentSites) {
            const existingElements = sitesListEl.querySelectorAll('.site-item .site-name');
            const exists = Array.from(existingElements).some(el => el.textContent === site.domain);
            
            if (!exists) {
              const siteItem = await this.createSiteItem(site);
              sitesListEl.appendChild(siteItem);
            }
          }
        }
      } else if (!response.success || response.data.length === 0) {
        sitesListEl.innerHTML = `
          <div class="loading-state">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">📊</div>
            <div style="color: var(--text-muted); font-size: 0.875rem;">No sites tracked today</div>
          </div>
        `;
      }
      
      // Update previous stats
      this.previousStats = this.todayStats;
    } catch (error) {
      console.error('Error updating top sites:', error);
      sitesListEl.innerHTML = `
        <div class="loading-state">
          <div style="color: var(--accent-red);">Failed to load sites</div>
        </div>
      `;
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
      'amazon.com': '#FF9900'
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
   * Create a site card element (new template format)
   */
  async createSiteItem(site) {
    const template = document.getElementById('site-item-template');
    const siteItem = template.content.cloneNode(true);
    
    // Set site icon with new favicon service
    const icon = siteItem.querySelector('.site-icon');
    const fallbackIcon = siteItem.querySelector('.site-icon-fallback');
    const progressFill = siteItem.querySelector('.progress-fill');
    
    try {
      // Add loading state
      icon.classList.add('loading');
      
      // Get favicon URL using our service
      const faviconResult = await FaviconService.getFaviconUrl(site.domain, { size: 32 });
      
      // Try to get brand color first
      let progressColor = this.getBrandColor(site.domain);
      
      if (faviconResult.isDefault) {
        // Show fallback with Remix icon
        icon.classList.add('error');
        fallbackIcon.classList.remove('hidden');
        const iconClass = FaviconService.getDomainIcon(site.domain);
        fallbackIcon.querySelector('i').className = iconClass;
        
        // If no brand color, use the fallback color
        if (!progressColor) {
          progressColor = FaviconService.getColorForDomain(site.domain);
        }
      } else {
        // Show the favicon
        icon.src = faviconResult.url;
        icon.classList.remove('loading');
        fallbackIcon.classList.add('hidden');
        
        // If no brand color, try to extract from favicon
        if (!progressColor) {
          progressColor = await this.getImageColor(faviconResult.url) || FaviconService.getColorForDomain(site.domain);
        }
      }
      
      // Apply the color to progress bar
      progressFill.style.backgroundColor = progressColor;
    } catch (error) {
      console.warn('Failed to load favicon:', error);
      // Show fallback on error
      icon.classList.add('error');
      fallbackIcon.classList.remove('hidden');
      progressFill.style.backgroundColor = FaviconService.getColorForDomain(site.domain);
    }
    
    // Set site info
    siteItem.querySelector('.site-name').textContent = site.domain;
    siteItem.querySelector('.site-sessions').textContent = `${site.visits} sessions`;
    
    // Calculate percentage
    const percentage = this.todayStats?.totalTime ? 
      Math.round((site.timeSpent / this.todayStats.totalTime) * 100) : 0;
    
    // Set site stats
    siteItem.querySelector('.site-duration').textContent = this.formatTime(site.timeSpent);
    siteItem.querySelector('.site-percentage').textContent = `${percentage}%`;
    
    // Set progress bar width
    progressFill.style.width = `${percentage}%`;
    
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
      'make10000hours.com': 'ri-focus-3-line',
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
      'make10000hours.com': 'make10000hours',
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
        blockedSitesListEl.innerHTML = '';
        
        for (const domain of response.data) {
          const blockedSiteItem = await this.createBlockedSiteItem(domain);
          blockedSitesListEl.appendChild(blockedSiteItem);
        }
      } else {
        blockedSitesListEl.innerHTML = `
          <div class="loading-state">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">🛡️</div>
            <div style="color: var(--text-muted); font-size: 0.875rem;">No blocked sites</div>
          </div>
        `;
      }
    } catch (error) {
      console.error('Error updating blocked sites:', error);
      blockedSitesListEl.innerHTML = `
        <div class="loading-state">
          <div style="color: var(--accent-red);">Failed to load blocked sites</div>
        </div>
      `;
    }
  }

  /**
   * Create blocked site item (new template format)
   */
  async createBlockedSiteItem(domain) {
    const item = document.createElement('div');
    item.className = 'blocked-site-item';
    
    try {
      // Get favicon for blocked site
      const faviconResult = await FaviconService.getFaviconUrl(domain, { size: 32 });
      const iconHtml = faviconResult.isDefault ? 
        `<div class="blocked-site-icon"><i class="${FaviconService.getDomainIcon(domain)}"></i></div>` :
        `<div class="blocked-site-icon"><img src="${faviconResult.url}" alt="${domain}" class="site-icon"></div>`;
      
      item.innerHTML = `
        <div class="blocked-site-left">
          ${iconHtml}
          <div class="blocked-site-name">${domain}</div>
        </div>
        <div class="blocked-site-controls">
          <button class="btn-icon" title="Edit">
            <i class="ri-edit-line"></i>
          </button>
          <button class="btn-icon" title="Delete" data-action="unblock" data-domain="${domain}">
            <i class="ri-delete-bin-line"></i>
          </button>
          <label class="custom-switch">
            <input type="checkbox" checked>
            <span class="switch-slider"></span>
          </label>
        </div>
      `;
    } catch (error) {
      console.warn('Failed to create blocked site item:', error);
      // Fallback to simple version without favicon
      item.innerHTML = `
        <div class="blocked-site-left">
          <div class="blocked-site-icon">
            <i class="ri-global-line"></i>
          </div>
          <div class="blocked-site-name">${domain}</div>
        </div>
        <div class="blocked-site-controls">
          <button class="btn-icon" title="Edit">
            <i class="ri-edit-line"></i>
          </button>
          <button class="btn-icon" title="Delete" data-action="unblock" data-domain="${domain}">
            <i class="ri-delete-bin-line"></i>
          </button>
          <label class="custom-switch">
            <input type="checkbox" checked>
            <span class="switch-slider"></span>
          </label>
        </div>
      `;
    }

    return item;
  }

  /**
   * Show add site modal
   */
  showAddSiteModal() {
    this.showModal('Add Site to Block', `
      <div class="add-site-form">
        <input 
          type="text" 
          id="site-input" 
          placeholder="Enter domain (e.g. youtube.com)" 
          class="input-field"
        >
        <button id="add-site-confirm" class="btn primary">Add</button>
      </div>
      <p style="color: var(--text-muted); font-size: 0.875rem; margin-top: 1rem;">
        Enter the domain you want to block. The site will be blocked during focus mode.
      </p>
    `);

    // Add event listeners
    const siteInput = document.getElementById('site-input');
    const addSiteConfirm = document.getElementById('add-site-confirm');

    if (addSiteConfirm) {
      addSiteConfirm.addEventListener('click', async () => {
        const domain = siteInput?.value.trim();
        if (domain) {
          await this.addBlockedSite(domain);
        }
      });
    }

    if (siteInput) {
      siteInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          addSiteConfirm?.click();
        }
      });
      siteInput.focus();
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
        this.showNotification(`${domain} has been blocked`, 'success');
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
      if (this.currentState?.focusStats) {
        this.currentState.focusStats.focusMode = newFocusState;
      } else {
        this.currentState = {
          ...this.currentState,
          focusStats: { focusMode: newFocusState }
        };
      }
      this.updateFocusModeSwitch();
      
      // Send message to background
      const response = await this.sendMessage('TOGGLE_FOCUS_MODE');
      
      if (response.success) {
        this.showNotification(
          response.focusMode 
            ? 'Focus mode activated! Distracting sites are now blocked.' 
            : 'Focus mode deactivated. All sites are accessible.',
          response.focusMode ? 'success' : 'info'
        );
        
        // Refresh state to ensure sync
        await this.refreshState();
      } else {
        // If failed, revert the switch state
        if (this.currentState?.focusStats) {
          this.currentState.focusStats.focusMode = !newFocusState;
        }
        this.updateFocusModeSwitch();
        this.showError('Failed to toggle focus mode: ' + response.error);
      }
    } catch (error) {
      console.error('Error toggling focus mode:', error);
      // Revert switch state on error
      if (this.currentState?.focusStats) {
        this.currentState.focusStats.focusMode = !focusModeSwitch.checked;
      }
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
          `Site ${response.domain} has been blocked`,
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
   * Refresh state with debouncing and diff checking
   */
  async refreshState() {
    this.debounce(async () => {
      try {
        const [stateResponse, statsResponse] = await Promise.all([
          this.sendMessage('GET_CURRENT_STATE'),
          this.sendMessage('GET_TODAY_STATS')
        ]);

        if (statsResponse?.success) {
          const newStats = statsResponse.data;
          
          // Only update if stats have changed
          if (this.haveStatsChanged(newStats, this.todayStats)) {
            this.todayStats = newStats;
            this.updateUI();
          }
        }

        if (stateResponse?.success) {
          this.currentState = stateResponse.data;
        }
      } catch (error) {
        console.error('Error refreshing state:', error);
      }
    }, 200); // 200ms debounce
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
    chrome.tabs.create({ url: 'https://make10000hours.com' });
  }

  /**
   * Show site details modal
   */
  showSiteDetails(site) {
    const percentage = this.todayStats?.totalTime ? 
      Math.round((site.timeSpent / this.todayStats.totalTime) * 100) : 0;

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
        <a href="https://make10000hours.com" style="color: var(--primary-color);">make10000hours.com</a> 
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
      
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type, payload },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('❌ Chrome runtime error:', chrome.runtime.lastError);
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              console.log(`📥 Received response for ${type}:`, response);
              resolve(response);
            }
          }
        );
      });
      
      return response;
    } catch (error) {
      console.error(`❌ Error sending message ${type}:`, error);
      throw error;
    }
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
      top: 20px;
      right: 20px;
      padding: 12px 16px;
      border-radius: 6px;
      color: white;
      font-weight: 600;
      z-index: 10000;
      background: ${type === 'success' ? 'var(--accent-green)' : 
                   type === 'error' ? 'var(--accent-red)' : 
                   'var(--primary-color)'};
      box-shadow: var(--shadow-lg);
      animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;

    // Add animation keyframes
    if (!document.getElementById('notification-styles')) {
      const style = document.createElement('style');
      style.id = 'notification-styles';
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
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
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
    }
    if (this.metricsUnsubscribe) {
      this.metricsUnsubscribe();
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

// Initialize popup manager
const popupManager = new PopupManager();

// Cleanup on window unload
window.addEventListener('unload', () => {
  popupManager.cleanup();
}); 