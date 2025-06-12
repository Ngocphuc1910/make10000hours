/**
 * Options Page Script - Blocked Sites Management
 * Full implementation of blocked sites management interface
 */

class BlockedSitesManager {
  constructor() {
    this.blockedSites = new Set();
    this.searchTerm = '';
    this.focusStats = null;
    
    this.initialize();
  }

  async initialize() {
    try {
      console.log('🚀 Initializing Blocked Sites Manager...');
      
      // Load initial data
      await this.loadBlockedSites();
      await this.loadFocusStats();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Render initial UI
      this.renderBlockedSites();
      this.updateFocusStatus();
      
      console.log('✅ Blocked Sites Manager initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Blocked Sites Manager:', error);
      this.showToast('Failed to initialize settings page', 'error');
    }
  }

  setupEventListeners() {
    // Add site form
    const addBtn = document.getElementById('add-site-btn');
    const newSiteInput = document.getElementById('new-site-input');
    
    addBtn?.addEventListener('click', () => this.handleAddSite());
    newSiteInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleAddSite();
      }
    });

    // Search functionality
    const searchInput = document.getElementById('search-sites');
    searchInput?.addEventListener('input', (e) => {
      this.searchTerm = e.target.value.toLowerCase();
      this.renderBlockedSites();
    });

    // Focus mode toggle
    const toggleFocusBtn = document.getElementById('toggle-focus-btn');
    toggleFocusBtn?.addEventListener('click', () => this.toggleFocusMode());

    // Quick actions
    const clearAllBtn = document.getElementById('clear-all-sites-btn');
    const exportBtn = document.getElementById('export-sites-btn');
    const importBtn = document.getElementById('import-sites-btn');
    const importFileInput = document.getElementById('import-file-input');

    clearAllBtn?.addEventListener('click', () => this.clearAllSites());
    exportBtn?.addEventListener('click', () => this.exportSites());
    importBtn?.addEventListener('click', () => importFileInput?.click());
    importFileInput?.addEventListener('change', (e) => this.importSites(e));

    // Auto-refresh stats every 30 seconds
    setInterval(() => {
      this.loadFocusStats();
      this.updateFocusStatus();
    }, 30000);
  }

  async loadBlockedSites() {
    try {
      const response = await this.sendMessage('GET_BLOCKED_SITES');
      if (response && response.success && Array.isArray(response.data)) {
        this.blockedSites = new Set(response.data);
        console.log('📝 Loaded blocked sites:', this.blockedSites);
      } else {
        console.warn('⚠️ Failed to load blocked sites:', response);
        this.blockedSites = new Set();
      }
    } catch (error) {
      console.error('❌ Error loading blocked sites:', error);
      this.blockedSites = new Set();
    }
  }

  async loadFocusStats() {
    try {
      const response = await this.sendMessage('GET_FOCUS_STATS');
      if (response && response.success && response.data) {
        this.focusStats = response.data;
        console.log('📊 Loaded focus stats:', this.focusStats);
      } else {
        console.warn('⚠️ Failed to load focus stats:', response);
      }
    } catch (error) {
      console.error('❌ Error loading focus stats:', error);
    }
  }

  async handleAddSite() {
    const input = document.getElementById('new-site-input');
    const domain = input?.value?.trim();

    if (!domain) {
      this.showToast('Please enter a domain', 'warning');
      return;
    }

    if (this.blockedSites.has(domain)) {
      this.showToast('Site is already blocked', 'warning');
      return;
    }

    // Validate domain format
    if (!this.isValidDomain(domain)) {
      this.showToast('Please enter a valid domain (e.g., facebook.com)', 'error');
      return;
    }

    try {
      const response = await this.sendMessage('ADD_BLOCKED_SITE', { domain });
      
      if (response && response.success) {
        this.blockedSites.add(response.domain);
        input.value = '';
        this.renderBlockedSites();
        this.showToast(`Site "${response.domain}" has been blocked`, 'success');
        console.log('✅ Added blocked site:', response.domain);
      } else {
        this.showToast(`Failed to block site: ${response?.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('❌ Error adding blocked site:', error);
      this.showToast('Failed to add blocked site', 'error');
    }
  }

  async handleRemoveSite(domain) {
    console.log('🗑️ Attempting to remove site:', domain);
    
    if (!domain) {
      console.error('❌ No domain provided to remove');
      this.showToast('Error: No domain specified', 'error');
      return;
    }

    if (!confirm(`Are you sure you want to unblock "${domain}"?`)) {
      console.log('🚫 User cancelled removal of:', domain);
      return;
    }

    try {
      console.log('📤 Sending remove request for:', domain);
      const response = await this.sendMessage('REMOVE_BLOCKED_SITE', { domain });
      
      console.log('📥 Received response:', response);
      
      if (response && response.success) {
        this.blockedSites.delete(domain);
        this.renderBlockedSites();
        this.showToast(`Site "${domain}" has been unblocked`, 'success');
        console.log('✅ Successfully removed blocked site:', domain);
      } else {
        console.error('❌ Failed to remove site:', response);
        this.showToast(`Failed to unblock site: ${response?.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('❌ Error removing blocked site:', error);
      this.showToast('Failed to remove blocked site', 'error');
    }
  }

  async toggleFocusMode() {
    try {
      const response = await this.sendMessage('TOGGLE_FOCUS_MODE');
      
      if (response && response.success) {
        // Reload focus stats to get updated status
        await this.loadFocusStats();
        this.updateFocusStatus();
        
        this.showToast(
          `Focus mode ${response.focusMode ? 'enabled' : 'disabled'}`,
          response.focusMode ? 'success' : 'warning'
        );
      } else {
        this.showToast(`Failed to toggle focus mode: ${response?.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('❌ Error toggling focus mode:', error);
      this.showToast('Failed to toggle focus mode', 'error');
    }
  }

  async clearAllSites() {
    if (!confirm(`Are you sure you want to remove all ${this.blockedSites.size} blocked sites? This action cannot be undone.`)) {
      return;
    }

    try {
      const sitesToRemove = Array.from(this.blockedSites);
      let successCount = 0;

      for (const domain of sitesToRemove) {
        const response = await this.sendMessage('REMOVE_BLOCKED_SITE', { domain });
        if (response && response.success) {
          successCount++;
          this.blockedSites.delete(domain);
        }
      }

      this.renderBlockedSites();
      
      if (successCount === sitesToRemove.length) {
        this.showToast('All blocked sites have been removed', 'success');
      } else {
        this.showToast(`Removed ${successCount}/${sitesToRemove.length} sites. Some sites may have failed to remove.`, 'warning');
      }
    } catch (error) {
      console.error('❌ Error clearing all sites:', error);
      this.showToast('Failed to clear all sites', 'error');
    }
  }

  exportSites() {
    const sites = Array.from(this.blockedSites);
    const exportData = {
      version: '2.0.0',
      exportDate: new Date().toISOString(),
      blockedSites: sites,
      totalSites: sites.length
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `focus-tracker-blocked-sites-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    this.showToast(`Exported ${sites.length} blocked sites`, 'success');
  }

  async importSites(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      
      if (!importData.blockedSites || !Array.isArray(importData.blockedSites)) {
        throw new Error('Invalid file format. Expected "blockedSites" array.');
      }

      let addedCount = 0;
      let skippedCount = 0;

      for (const domain of importData.blockedSites) {
        if (this.blockedSites.has(domain)) {
          skippedCount++;
          continue;
        }

        if (!this.isValidDomain(domain)) {
          skippedCount++;
          continue;
        }

        const response = await this.sendMessage('ADD_BLOCKED_SITE', { domain });
        if (response && response.success) {
          this.blockedSites.add(response.domain);
          addedCount++;
        } else {
          skippedCount++;
        }
      }

      this.renderBlockedSites();
      
      if (addedCount > 0) {
        this.showToast(`Imported ${addedCount} sites${skippedCount > 0 ? `, skipped ${skippedCount}` : ''}`, 'success');
      } else {
        this.showToast('No new sites were imported', 'warning');
      }

    } catch (error) {
      console.error('❌ Error importing sites:', error);
      this.showToast('Failed to import sites. Please check the file format.', 'error');
    }

    // Clear the file input
    event.target.value = '';
  }

  renderBlockedSites() {
    const container = document.getElementById('sites-container');
    const countElement = document.getElementById('blocked-count');
    const emptyState = document.getElementById('empty-state');

    if (!container || !countElement || !emptyState) return;

    // Filter sites based on search term
    const filteredSites = Array.from(this.blockedSites).filter(site =>
      site.toLowerCase().includes(this.searchTerm)
    );

    // Update count
    countElement.textContent = this.blockedSites.size;

    // Clear container
    container.innerHTML = '';

    if (filteredSites.length === 0) {
      emptyState.style.display = 'block';
      if (this.blockedSites.size === 0) {
        emptyState.querySelector('h4').textContent = 'No blocked sites yet';
        emptyState.querySelector('p').textContent = 'Add some sites above to start blocking them during focus mode.';
      } else {
        emptyState.querySelector('h4').textContent = 'No sites match your search';
        emptyState.querySelector('p').textContent = 'Try adjusting your search terms.';
      }
      return;
    }

    emptyState.style.display = 'none';

    // Render site cards
    filteredSites.sort().forEach(domain => {
      const card = this.createSiteCard(domain);
      container.appendChild(card);
    });
  }

  createSiteCard(domain) {
    const card = document.createElement('div');
    card.className = 'site-card';
    card.dataset.domain = domain; // Store domain for reference
    
    card.innerHTML = `
      <div class="site-info">
        <div class="site-domain">${domain}</div>
        <div class="site-meta">Blocked since today</div>
      </div>
      <div class="site-actions">
        <button class="btn danger small remove-site-btn" data-domain="${domain}">
          🗑️ Remove
        </button>
      </div>
    `;

    // Add event listener to the remove button (CSP compliant)
    const removeBtn = card.querySelector('.remove-site-btn');
    removeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const domainToRemove = e.target.getAttribute('data-domain');
      this.handleRemoveSite(domainToRemove);
    });

    return card;
  }

  updateFocusStatus() {
    const statusText = document.getElementById('focus-status-text');
    const statusDot = document.querySelector('.status-dot');
    const sessionTime = document.getElementById('session-time');
    const blockedAttempts = document.getElementById('blocked-attempts');
    const toggleBtn = document.getElementById('toggle-focus-btn');

    if (!this.focusStats) return;

    // Update status indicator
    if (this.focusStats.focusMode) {
      statusText.textContent = 'Focus Mode Active';
      statusDot.classList.add('active');
      toggleBtn.textContent = 'Disable Focus Mode';
      toggleBtn.className = 'btn danger';
    } else {
      statusText.textContent = 'Focus Mode Inactive';
      statusDot.classList.remove('active');
      toggleBtn.textContent = 'Enable Focus Mode';
      toggleBtn.className = 'btn secondary';
    }

    // Update session time
    if (this.focusStats.focusTime > 0) {
      sessionTime.textContent = this.formatTime(this.focusStats.focusTime);
    } else {
      sessionTime.textContent = '--';
    }

    // Update blocked attempts
    blockedAttempts.textContent = this.focusStats.blockedAttempts || 0;
  }

  formatTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  isValidDomain(domain) {
    // Basic domain validation
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.([a-zA-Z]{2,}\.?)+$/;
    return domainRegex.test(domain) || /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/.test(domain);
  }

  async sendMessage(type, payload = {}) {
    try {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type, payload }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
    } catch (error) {
      console.error(`❌ Error sending message ${type}:`, error);
      throw error;
    }
  }

  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');

    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎯 Focus Time Tracker Options - Phase 2 with Blocked Sites Management');
  window.blockedSitesManager = new BlockedSitesManager();
}); 