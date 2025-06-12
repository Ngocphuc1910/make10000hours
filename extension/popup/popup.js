/**
 * Popup Script for Focus Time Tracker Extension
 * Handles UI interactions and communication with background script
 */

class PopupManager {
  constructor() {
    this.currentState = null;
    this.todayStats = null;
    this.sessionTimer = null;
    this.updateInterval = null;
    this.analyticsUI = null;
    this.currentTab = 'overview';
    
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
        console.log('✅ Analytics UI initialized successfully');
      } else {
        console.warn('⚠️ Analytics UI component not available - analytics features will be disabled');
      }

      // Get initial state and stats
      const [stateResponse, statsResponse] = await Promise.all([
        this.sendMessage('GET_CURRENT_STATE'),
        this.sendMessage('GET_TODAY_STATS')
      ]);

      if (stateResponse?.success) {
        this.currentState = stateResponse.data;
      }

      if (statsResponse?.success) {
        this.todayStats = statsResponse.data;
      }

      // Update UI with initial data
      this.updateUI();
      this.hideLoading();

      // Set up tab system
      this.setupTabs();

      // Set up periodic updates
      this.updateInterval = setInterval(() => {
        this.refreshState();
      }, 1000);

      // Set up event listeners
      this.setupEventListeners();

      // Listen for stats updates from background
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'STATS_UPDATED') {
          this.todayStats = message.payload;
          this.updateUI();
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
    // Focus mode toggle
    const focusModeBtn = document.getElementById('focus-mode-toggle');
    if (focusModeBtn) {
      console.log('🔧 Focus mode button found, adding listener');
      focusModeBtn.addEventListener('click', () => {
        console.log('🔧 Focus mode button clicked');
        this.toggleFocusMode();
      });
    } else {
      console.error('❌ Focus mode button not found!');
    }

    // Block current site button
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

    // Manage blocked sites
    const manageBlockedBtn = document.getElementById('manageBlockedBtn');
    if (manageBlockedBtn) {
      manageBlockedBtn.addEventListener('click', () => this.showManageBlockedSites());
    }

    // Settings button
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => this.openSettings());
    }

    // Export data button
    const exportBtn = document.getElementById('export-data-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportData());
    }

    // View all sites
    const viewAllBtn = document.getElementById('view-all-btn');
    if (viewAllBtn) {
      viewAllBtn.addEventListener('click', () => this.viewAllSites());
    }

    // View all blocked sites
    const viewAllBlockedBtn = document.getElementById('viewAllBlockedBtn');
    if (viewAllBlockedBtn) {
      viewAllBlockedBtn.addEventListener('click', () => this.showAllBlockedSites());
    }

    // Help and feedback
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
  }

  /**
   * Set up tab system
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
   * Switch to a specific tab
   */
  switchTab(tabName) {
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

    // Initialize tab content if needed
    this.initializeTabContent(tabName);
  }

  /**
   * Initialize specific tab content
   */
  initializeTabContent(tabName) {
    switch (tabName) {
      case 'analytics':
        this.initializeAnalytics();
        break;
      case 'goals':
        this.initializeGoals();
        break;
    }
  }

  /**
   * Initialize analytics dashboard
   */
  initializeAnalytics() {
    if (!this.analyticsUI) return;

    const analyticsContainer = document.getElementById('analytics-dashboard');
    if (analyticsContainer && !analyticsContainer.hasChildNodes()) {
      this.analyticsUI.createAnalyticsDashboard('analytics-dashboard', {
        showPeriodSelector: true,
        showSummaryCards: true,
        showTrends: true,
        showCategoryBreakdown: true,
        showTopSites: true
      });
    }
  }

  /**
   * Initialize productivity goals
   */
  initializeGoals() {
    if (!this.analyticsUI) return;

    const goalsContainer = document.getElementById('productivity-goals-widget');
    if (goalsContainer && !goalsContainer.hasChildNodes()) {
      this.analyticsUI.createProductivityGoals('productivity-goals-widget');
    }
  }

  /**
   * Refresh state from background script
   */
  async refreshState() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_CURRENT_STATE'
      });

      if (response?.success) {
        this.currentState = response.data;
        this.updateUI();
      }
    } catch (error) {
      console.error('Error refreshing state:', error);
    }
  }

  /**
   * Update UI elements with current state
   */
  updateUI() {
    this.updateHeader();
    this.updateStatsOverview();
    this.updateCurrentSession();
    this.updateTopSites();
    this.updateActionButtons();
  }

  /**
   * Update header with tracking status and focus mode
   */
  updateHeader() {
    const header = document.querySelector('.header');
    if (!header) return;

    const trackingStatus = this.currentState?.currentSession?.isActive ? 'Tracking' : 'Idle';
    const focusMode = this.currentState?.focusStats?.focusMode || false;
    
    // Update tracking indicator
    const indicator = header.querySelector('.tracking-indicator');
    if (indicator) {
      indicator.textContent = trackingStatus;
      indicator.className = `tracking-indicator ${this.currentState?.currentSession?.isActive ? 'active' : 'idle'}`;
    }

    // Update focus mode indicator
    let focusIndicator = header.querySelector('.focus-indicator');
    if (!focusIndicator) {
      focusIndicator = document.createElement('div');
      focusIndicator.className = 'focus-indicator';
      header.appendChild(focusIndicator);
    }
    
    if (focusMode) {
      focusIndicator.innerHTML = `
        <span class="focus-icon">🎯</span>
        <span class="focus-text">Focus Mode</span>
      `;
      focusIndicator.className = 'focus-indicator active';
    } else {
      focusIndicator.innerHTML = `
        <span class="focus-icon">⭕</span>
        <span class="focus-text">Distracted</span>
      `;
      focusIndicator.className = 'focus-indicator inactive';
    }
  }

  /**
   * Update stats overview cards
   */
  updateStatsOverview() {
    if (!this.todayStats) return;

    // Total time
    const totalTimeEl = document.getElementById('total-time');
    if (totalTimeEl) {
      totalTimeEl.textContent = this.formatTime(this.todayStats.totalTime || 0);
    }

    // Sites visited
    const sitesVisitedEl = document.getElementById('sites-visited');
    if (sitesVisitedEl) {
      sitesVisitedEl.textContent = this.todayStats.sitesVisited || 0;
    }

    // Productivity score
    const productivityScoreEl = document.getElementById('productivity-score');
    if (productivityScoreEl) {
      const score = this.todayStats.productivityScore || 0;
      productivityScoreEl.textContent = `${score}%`;
      
      // Color code the score
      if (score >= 70) {
        productivityScoreEl.style.color = 'var(--success-color)';
      } else if (score >= 40) {
        productivityScoreEl.style.color = 'var(--warning-color)';
      } else {
        productivityScoreEl.style.color = 'var(--error-color)';
      }
    }
  }

  /**
   * Update current session display
   */
  updateCurrentSession() {
    const currentSite = document.getElementById('current-site');
    const sessionTimer = document.getElementById('session-timer');
    
    if (this.currentState?.tracking && this.currentState?.currentSession?.domain) {
      const { domain, startTime } = this.currentState.currentSession;
      
      // Update site info
      if (currentSite) {
        const siteIcon = currentSite.querySelector('.site-icon');
        const siteName = currentSite.querySelector('.site-name');
        const siteTime = currentSite.querySelector('.site-time');
        
        if (siteIcon) siteIcon.textContent = this.getSiteIcon(domain);
        if (siteName) siteName.textContent = domain;
        if (siteTime && startTime) {
          const elapsed = Date.now() - startTime;
          siteTime.textContent = `Active for ${this.formatTime(elapsed)}`;
        }

        // Remove dashed border when active
        currentSite.style.border = '2px solid var(--primary-color)';
      }

      // Update timer
      if (sessionTimer && startTime) {
        const elapsed = Date.now() - startTime;
        sessionTimer.textContent = this.formatTime(elapsed, 'clock');
      }
    } else {
      // No active session
      if (currentSite) {
        const siteIcon = currentSite.querySelector('.site-icon');
        const siteName = currentSite.querySelector('.site-name');
        const siteTime = currentSite.querySelector('.site-time');
        
        if (siteIcon) siteIcon.textContent = '🌐';
        if (siteName) siteName.textContent = 'No active site';
        if (siteTime) siteTime.textContent = 'Not tracking';

        // Restore dashed border
        currentSite.style.border = '2px dashed var(--gray-300)';
      }

      if (sessionTimer) {
        sessionTimer.textContent = '00:00';
      }
    }
  }

  /**
   * Update top sites list
   */
  async updateTopSites() {
    const sitesListEl = document.getElementById('top-sites-list');
    if (!sitesListEl) return;

    try {
      const response = await this.sendMessage('GET_TOP_SITES', { limit: 5 });
      
      if (response.success && response.data.length > 0) {
        sitesListEl.innerHTML = '';
        
        response.data.forEach(site => {
          const siteCard = this.createSiteCard(site);
          sitesListEl.appendChild(siteCard);
        });
      } else {
        sitesListEl.innerHTML = `
          <div class="empty-state">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">📊</div>
            <div style="color: var(--text-muted); font-size: 0.875rem;">No sites tracked today</div>
          </div>
        `;
      }
    } catch (error) {
      console.error('Error updating top sites:', error);
      sitesListEl.innerHTML = `
        <div class="error-state">
          <div style="color: var(--error-color);">Failed to load sites</div>
        </div>
      `;
    }
  }

  /**
   * Create a site card element
   */
  createSiteCard(site) {
    const percentage = this.todayStats?.totalTime ? 
      Math.round((site.timeSpent / this.todayStats.totalTime) * 100) : 0;

    const card = document.createElement('div');
    card.className = 'site-card';
    card.innerHTML = `
      <div class="site-card-left">
        <div class="site-card-icon">${this.getSiteIcon(site.domain)}</div>
        <div class="site-card-info">
          <div class="site-card-name">${site.domain}</div>
          <div class="site-card-stats">${site.visits} visits</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${percentage}%"></div>
          </div>
        </div>
      </div>
      <div class="site-card-right">
        <div class="site-card-time">${this.formatTime(site.timeSpent)}</div>
        <div class="site-card-percentage">${percentage}%</div>
      </div>
    `;

    // Add click handler for site details
    card.addEventListener('click', () => this.showSiteDetails(site));

    return card;
  }

  /**
   * Update action buttons and focus controls
   */
  updateActionButtons() {
    const container = document.getElementById('actionButtons');
    if (!container) return;

    const focusMode = this.currentState?.focusStats?.focusMode || false;
    const currentDomain = this.currentState?.currentSession?.domain;
    const blockedSites = this.currentState?.focusStats?.blockedSites || [];
    const isCurrentSiteBlocked = currentDomain && blockedSites.includes(currentDomain);

    container.innerHTML = `
      <div class="action-section">
        <h3 class="section-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z"/>
          </svg>
          Focus Controls
        </h3>
        
        <div class="focus-mode-toggle">
          <button id="focus-mode-toggle" class="btn ${focusMode ? 'btn-danger' : 'btn-primary'} btn-large">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              ${focusMode 
                ? '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z"/>'
                : '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>'
              }
            </svg>
            ${focusMode ? 'Stop Focus Session' : 'Start Focus Session'}
          </button>
          
          ${focusMode ? `
            <div class="focus-stats-mini">
              <div class="stat">
                <span class="value">${this.formatTime(this.currentState.focusStats.focusTime || 0, 'clock')}</span>
                <span class="label">Focus Time</span>
              </div>
              <div class="stat">
                <span class="value">${this.currentState.focusStats.blockedAttempts || 0}</span>
                <span class="label">Blocked</span>
              </div>
            </div>
          ` : ''}
        </div>
      </div>

      <div class="action-section">
        <h3 class="section-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          Quick Actions
        </h3>
        
        <div class="action-grid">
          <button id="block-current-site" class="btn ${isCurrentSiteBlocked ? 'btn-secondary' : 'btn-warning'}" 
                  ${!currentDomain ? 'disabled' : ''}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z"/>
            </svg>
            ${isCurrentSiteBlocked ? 'Unblock Site' : 'Block Site'}
          </button>
          
          <button id="manageBlockedBtn" class="btn btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
            Manage Blocked Sites
          </button>
          
          <button id="settings-btn" class="btn btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            Settings
          </button>
          
          <button id="export-data-btn" class="btn btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
            </svg>
            Export Data
          </button>
        </div>
      </div>

      ${blockedSites.length > 0 ? `
        <div class="action-section">
          <h3 class="section-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9C4.63 15.55 4 13.85 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1C19.37 8.45 20 10.15 20 12c0 4.42-3.58 8-8 8z"/>
            </svg>
            Blocked Sites (${blockedSites.length})
          </h3>
          
          <div class="blocked-sites-list">
            ${blockedSites.slice(0, 3).map(site => `
              <div class="blocked-site-item">
                <span class="site-domain">${site}</span>
                <button class="btn-icon btn-danger" data-action="unblock" data-domain="${site}">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              </div>
            `).join('')}
            
            ${blockedSites.length > 3 ? `
              <button class="btn btn-link btn-small" id="viewAllBlockedBtn">
                View all ${blockedSites.length} blocked sites →
              </button>
            ` : ''}
          </div>
        </div>
      ` : ''}
    `;

    // Add event listeners
    this.setupActionButtonListeners();
  }

  /**
   * Toggle focus mode on/off
   */
  async toggleFocusMode() {
    try {
      this.showLoading();
      
      const response = await this.sendMessage('TOGGLE_FOCUS_MODE');
      
      if (response.success) {
        this.showNotification(
          response.focusMode 
            ? 'Focus mode activated! Distracting sites are now blocked.' 
            : 'Focus mode deactivated. All sites are accessible.',
          response.focusMode ? 'success' : 'info'
        );
        
        // Refresh state to update UI
        await this.refreshState();
      } else {
        this.showError('Failed to toggle focus mode: ' + response.error);
      }
    } catch (error) {
      console.error('Error toggling focus mode:', error);
      this.showError('Failed to toggle focus mode');
    } finally {
      this.hideLoading();
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
    // For now, just show a modal with all sites
    // In Phase 3, this would open a comprehensive analytics view
    this.showModal('All Sites Today', `
      <p>Detailed analytics view coming in Phase 3!</p>
      <p>For now, you can see your top 5 sites in the main popup.</p>
    `);
  }

  /**
   * Show site details modal
   */
  showSiteDetails(site) {
    const percentage = this.todayStats?.totalTime ? 
      Math.round((site.timeSpent / this.todayStats.totalTime) * 100) : 0;

    this.showModal(`${site.domain} Details`, `
      <div style="text-align: center;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">${this.getSiteIcon(site.domain)}</div>
        <h4 style="margin-bottom: 1rem;">${site.domain}</h4>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
          <div style="text-align: center; padding: 1rem; background: var(--bg-secondary); border-radius: 0.5rem;">
            <div style="font-size: 1.5rem; font-weight: bold; color: var(--primary-color);">
              ${this.formatTime(site.timeSpent)}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Time Spent</div>
          </div>
          <div style="text-align: center; padding: 1rem; background: var(--bg-secondary); border-radius: 0.5rem;">
            <div style="font-size: 1.5rem; font-weight: bold; color: var(--accent-color);">
              ${site.visits}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Visits</div>
          </div>
        </div>
        
        <div style="text-align: center; margin-bottom: 1rem;">
          <div style="font-size: 1.25rem; font-weight: bold; color: var(--text-primary);">
            ${percentage}% of today's time
          </div>
        </div>
        
        <div style="margin-top: 1rem;">
          <button id="block-site-btn" class="btn secondary" style="width: 100%;">
            🚫 Block This Site
          </button>
        </div>
      </div>
    `);

    // Add block site handler
    document.getElementById('block-site-btn')?.addEventListener('click', async () => {
      try {
        const response = await this.sendMessage('ADD_BLOCKED_SITE', { domain: site.domain });
        if (response.success) {
          this.hideModal();
          this.showNotification(`${site.domain} has been blocked`, 'success');
        }
      } catch (error) {
        this.showNotification('Failed to block site', 'error');
      }
    });
  }

  /**
   * Show help modal
   */
  showHelp() {
    this.showModal('Help & Guide', `
      <h4>How Focus Time Tracker Works</h4>
      <ul style="text-align: left; margin: 1rem 0;">
        <li><strong>Automatic Tracking:</strong> Time is tracked when you're active on a tab</li>
        <li><strong>Focus Mode:</strong> Blocks distracting sites during work sessions</li>
        <li><strong>Site Blocking:</strong> Add sites to your block list</li>
        <li><strong>Statistics:</strong> View detailed analytics of your browsing habits</li>
      </ul>
      
      <h4>Keyboard Shortcuts</h4>
      <ul style="text-align: left; margin: 1rem 0;">
        <li><kbd>Ctrl+Shift+F</kbd> - Toggle Focus Mode</li>
        <li><kbd>Ctrl+Shift+B</kbd> - Block Current Site</li>
      </ul>
      
      <p style="margin-top: 1rem;">
        <strong>Need more help?</strong> Visit our 
        <a href="#" style="color: var(--primary-color);">documentation</a> 
        or <a href="#" style="color: var(--primary-color);">contact support</a>.
      </p>
    `);
  }

  /**
   * Show feedback modal
   */
  showFeedback() {
    this.showModal('Send Feedback', `
      <p>We'd love to hear from you! Help us improve Focus Time Tracker.</p>
      
      <div style="margin: 1rem 0;">
        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">
          Feedback Type:
        </label>
        <select id="feedback-type" style="width: 100%; padding: 0.5rem; border: 1px solid var(--gray-300); border-radius: 0.25rem;">
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
          style="width: 100%; height: 100px; padding: 0.5rem; border: 1px solid var(--gray-300); border-radius: 0.25rem; resize: vertical;">
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

  /**
   * Get emoji icon for a domain
   */
  getSiteIcon(domain) {
    // Simple mapping of domains to icons
    const iconMap = {
      'github.com': '💻',
      'mail.google.com': '📧',
      'youtube.com': '🎥',
      'facebook.com': '👥',
      'twitter.com': '🐦',
      'linkedin.com': '💼',
      'reddit.com': '🗨️',
      'netflix.com': '🎬',
      'amazon.com': '🛒',
      'wikipedia.org': '📚'
    };

    // Check if domain matches any known sites
    for (const [site, icon] of Object.entries(iconMap)) {
      if (domain.includes(site)) {
        return icon;
      }
    }

    // Default icon for unknown sites
    return '🌐';
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
      background: ${type === 'success' ? 'var(--success-color)' : 
                   type === 'error' ? 'var(--error-color)' : 
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
    const topSitesList = document.getElementById('top-sites-list');
    if (topSitesList) {
      topSitesList.innerHTML = `
        <div class="error-state" style="text-align: center; padding: 2rem; color: var(--error-color);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">⚠️</div>
          <div>${message}</div>
        </div>
      `;
    }
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
}

// Initialize popup manager
const popupManager = new PopupManager();

// Cleanup on window unload
window.addEventListener('unload', () => {
  popupManager.cleanup();
}); 