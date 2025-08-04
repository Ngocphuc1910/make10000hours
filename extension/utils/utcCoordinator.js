/**
 * UTC Coordinator for Chrome Extension
 * Coordinates UTC strategies between web app and extension to prevent data conflicts
 */

class UTCCoordinator {
  constructor() {
    this.isUTCMode = false;
    this.userTimezone = null;
    this.webAppConnection = null;
    this.initialized = false;
    this.conflictResolutionStrategy = 'prefer_webapp'; // or 'prefer_extension', 'merge'
  }

  /**
   * Initialize UTC coordination with web app
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Check if web app has UTC features enabled
      const webAppUTCStatus = await this.queryWebAppUTCStatus();
      
      if (webAppUTCStatus.utcEnabled) {
        console.log('🌍 Web app has UTC features enabled - coordinating strategies');
        await this.enableUTCMode(webAppUTCStatus.userTimezone);
        await this.syncWithWebApp();
      } else {
        console.log('📅 Web app using legacy dates - extension will use local dates');
        await this.enableLocalMode();
      }

      this.initialized = true;
      console.log('✅ UTC Coordinator initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize UTC coordinator:', error);
      // Fallback to local mode
      await this.enableLocalMode();
    }
  }

  /**
   * Enable UTC mode for coordinated timezone handling
   */
  async enableUTCMode(userTimezone) {
    this.isUTCMode = true;
    this.userTimezone = userTimezone || 'UTC';
    
    console.log('🌍 Extension enabled UTC mode with timezone:', this.userTimezone);
    
    // Store UTC mode preference
    await chrome.storage.local.set({
      utcCoordinatorMode: 'utc',
      coordinatedTimezone: this.userTimezone,
      lastUTCSync: Date.now()
    });

    // Stop any ongoing local date migrations
    await this.stopLocalMigration();
  }

  /**
   * Enable local mode for independent timezone handling
   */
  async enableLocalMode() {
    this.isUTCMode = false;
    this.userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    console.log('📅 Extension enabled local mode with timezone:', this.userTimezone);
    
    // Store local mode preference
    await chrome.storage.local.set({
      utcCoordinatorMode: 'local',
      coordinatedTimezone: this.userTimezone,
      lastLocalSync: Date.now()
    });
  }

  /**
   * Query web app for UTC status
   */
  async queryWebAppUTCStatus() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'UTC_STATUS_QUERY',
        source: 'extension'
      });

      if (response && response.success) {
        return {
          utcEnabled: response.data.utcEnabled,
          userTimezone: response.data.userTimezone,
          transitionMode: response.data.transitionMode
        };
      }
    } catch (error) {
      console.warn('⚠️ Could not query web app UTC status:', error);
    }

    return {
      utcEnabled: false,
      userTimezone: null,
      transitionMode: 'disabled'
    };
  }

  /**
   * Get storage key based on current mode
   */
  getStorageKey(baseKey, date) {
    if (this.isUTCMode) {
      // Use UTC date for storage key
      const utcDate = typeof date === 'string' ? date : this.getUTCDateString(date);
      return `${baseKey}_utc_${utcDate}`;
    } else {
      // Use local date for storage key
      const localDate = typeof date === 'string' ? date : DateUtils.getLocalDateStringFromDate(date);
      return `${baseKey}_${localDate}`;
    }
  }

  /**
   * Get current date string based on mode
   */
  getCurrentDateString() {
    if (this.isUTCMode) {
      return this.getUTCDateString();
    } else {
      return DateUtils.getLocalDateString();
    }
  }

  /**
   * Get UTC date string
   */
  getUTCDateString(date = new Date()) {
    return date.toISOString().split('T')[0];
  }

  /**
   * Convert timestamp to appropriate timezone
   */
  convertTimestamp(timestamp, targetFormat = 'local') {
    const date = new Date(timestamp);
    
    if (this.isUTCMode) {
      if (targetFormat === 'utc') {
        return date.toISOString();
      } else {
        // Convert UTC to user's timezone for display
        return this.formatInUserTimezone(date);
      }
    } else {
      // Local mode - timestamps are already in local time
      return targetFormat === 'utc' ? date.toISOString() : date.toLocaleString();
    }
  }

  /**
   * Format date in user's timezone
   */
  formatInUserTimezone(date) {
    if (!this.userTimezone) return date.toLocaleString();
    
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: this.userTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).format(date);
    } catch (error) {
      console.warn('Failed to format in user timezone:', error);
      return date.toLocaleString();
    }
  }

  /**
   * Migrate data when switching between modes
   */
  async migrateDataMode(fromMode, toMode) {
    console.log(`🔄 Migrating data from ${fromMode} to ${toMode} mode`);
    
    try {
      if (fromMode === 'local' && toMode === 'utc') {
        await this.migrateLocalToUTC();
      } else if (fromMode === 'utc' && toMode === 'local') {
        await this.migrateUTCToLocal();
      }
      
      console.log('✅ Data migration completed');
    } catch (error) {
      console.error('❌ Data migration failed:', error);
      throw error;
    }
  }

  /**
   * Migrate local data to UTC format
   */
  async migrateLocalToUTC() {
    const allData = await chrome.storage.local.get(null);
    const migrationMap = new Map();

    // Find all local date keys and convert to UTC
    Object.keys(allData).forEach(key => {
      const match = key.match(/^(dailyStats|deepFocusSessions)_(\d{4}-\d{2}-\d{2})$/);
      if (match) {
        const [, baseKey, localDate] = match;
        const utcDate = this.convertLocalDateToUTC(localDate);
        const newKey = `${baseKey}_utc_${utcDate}`;
        
        migrationMap.set(newKey, {
          ...allData[key],
          migratedFromLocal: true,
          migrationTimestamp: Date.now()
        });
      }
    });

    // Save migrated data
    if (migrationMap.size > 0) {
      const migrationData = Object.fromEntries(migrationMap);
      await chrome.storage.local.set(migrationData);
      console.log('📊 Migrated', migrationMap.size, 'local data entries to UTC format');
    }
  }

  /**
   * Migrate UTC data to local format
   */
  async migrateUTCToLocal() {
    const allData = await chrome.storage.local.get(null);
    const migrationMap = new Map();

    // Find all UTC date keys and convert to local
    Object.keys(allData).forEach(key => {
      const match = key.match(/^(dailyStats|deepFocusSessions)_utc_(\d{4}-\d{2}-\d{2})$/);
      if (match) {
        const [, baseKey, utcDate] = match;
        const localDate = this.convertUTCDateToLocal(utcDate);
        const newKey = `${baseKey}_${localDate}`;
        
        migrationMap.set(newKey, {
          ...allData[key],
          migratedFromUTC: true,
          migrationTimestamp: Date.now()
        });
      }
    });

    // Save migrated data
    if (migrationMap.size > 0) {
      const migrationData = Object.fromEntries(migrationMap);
      await chrome.storage.local.set(migrationData);
      console.log('📊 Migrated', migrationMap.size, 'UTC data entries to local format');
    }
  }

  /**
   * Convert local date to UTC date (considering timezone offset)
   */
  convertLocalDateToUTC(localDateString) {
    const localDate = new Date(localDateString + 'T12:00:00'); // Noon local time
    return localDate.toISOString().split('T')[0];
  }

  /**
   * Convert UTC date to local date (considering timezone offset)
   */
  convertUTCDateToLocal(utcDateString) {
    const utcDate = new Date(utcDateString + 'T12:00:00Z'); // Noon UTC
    return DateUtils.getLocalDateStringFromDate(utcDate);
  }

  /**
   * Sync with web app to ensure consistency
   */
  async syncWithWebApp() {
    if (!this.isUTCMode) return;

    try {
      // Get recent data from extension
      const recentData = await this.getRecentDataForSync();
      
      // Send to web app for synchronization
      const syncResponse = await chrome.runtime.sendMessage({
        type: 'UTC_DATA_SYNC',
        data: {
          extensionData: recentData,
          timezone: this.userTimezone,
          mode: 'utc'
        },
        source: 'extension'
      });

      if (syncResponse && syncResponse.success) {
        console.log('🔄 Extension data synced with web app');
        await this.handleSyncResponse(syncResponse.data);
      }
      
    } catch (error) {
      console.error('❌ Failed to sync with web app:', error);
    }
  }

  /**
   * Get recent data for sync with web app
   */
  async getRecentDataForSync() {
    const keys = [];
    const today = this.getCurrentDateString();
    
    // Get last 7 days of data
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = this.isUTCMode ? this.getUTCDateString(date) : DateUtils.getLocalDateStringFromDate(date);
      
      keys.push(this.getStorageKey('dailyStats', dateStr));
      keys.push(this.getStorageKey('deepFocusSessions', dateStr));
    }

    const data = await chrome.storage.local.get(keys);
    return data;
  }

  /**
   * Handle sync response from web app
   */
  async handleSyncResponse(syncData) {
    if (syncData.conflicts && syncData.conflicts.length > 0) {
      console.log('⚠️ Data conflicts detected:', syncData.conflicts.length);
      await this.resolveConflicts(syncData.conflicts);
    }

    if (syncData.updates) {
      await chrome.storage.local.set(syncData.updates);
      console.log('✅ Applied updates from web app');
    }
  }

  /**
   * Resolve data conflicts between extension and web app
   */
  async resolveConflicts(conflicts) {
    const resolutions = [];

    for (const conflict of conflicts) {
      let resolution;
      
      switch (this.conflictResolutionStrategy) {
        case 'prefer_webapp':
          resolution = conflict.webAppData;
          break;
        case 'prefer_extension':
          resolution = conflict.extensionData;
          break;
        case 'merge':
          resolution = this.mergeConflictData(conflict.extensionData, conflict.webAppData);
          break;
        default:
          resolution = conflict.webAppData; // Default to web app
      }

      resolutions.push({
        key: conflict.key,
        data: resolution
      });
    }

    // Apply resolutions
    const updates = {};
    resolutions.forEach(res => {
      updates[res.key] = res.data;
    });

    await chrome.storage.local.set(updates);
    console.log('🔧 Resolved', resolutions.length, 'data conflicts');
  }

  /**
   * Merge conflicting data intelligently
   */
  mergeConflictData(extensionData, webAppData) {
    // Simple merge strategy - combine unique entries and prefer newer timestamps
    if (Array.isArray(extensionData) && Array.isArray(webAppData)) {
      const merged = [...extensionData];
      const existingIds = new Set(extensionData.map(item => item.id));
      
      webAppData.forEach(item => {
        if (!existingIds.has(item.id)) {
          merged.push(item);
        }
      });
      
      return merged.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    // For objects, merge properties preferring newer updatedAt
    if (typeof extensionData === 'object' && typeof webAppData === 'object') {
      const extTime = new Date(extensionData.updatedAt || 0).getTime();
      const webTime = new Date(webAppData.updatedAt || 0).getTime();
      
      return webTime > extTime ? webAppData : extensionData;
    }

    return webAppData; // Default fallback
  }

  /**
   * Stop local date migration to prevent conflicts
   */
  async stopLocalMigration() {
    await chrome.storage.local.set({
      dateMigrationCompleted: true,
      skipLocalMigration: true,
      utcModeEnabled: true
    });
    console.log('🛑 Stopped local date migration to prevent UTC conflicts');
  }

  /**
   * Handle timezone changes from web app
   */
  async handleTimezoneChange(oldTimezone, newTimezone) {
    if (this.isUTCMode) {
      this.userTimezone = newTimezone;
      
      await chrome.storage.local.set({
        coordinatedTimezone: newTimezone,
        timezoneChangeTimestamp: Date.now()
      });

      console.log('🌍 Extension timezone updated:', oldTimezone, '->', newTimezone);
      
      // Sync with web app after timezone change
      await this.syncWithWebApp();
    }
  }

  /**
   * Get coordinated deep focus session key
   */
  getDeepFocusStorageKey(date) {
    return this.getStorageKey('deepFocusSessions', date);
  }

  /**
   * Get coordinated daily stats key
   */
  getDailyStatsStorageKey(date) {
    return this.getStorageKey('dailyStats', date);
  }

  /**
   * Check if coordinator is ready
   */
  isReady() {
    return this.initialized;
  }

  /**
   * Get current mode info
   */
  getStatus() {
    return {
      mode: this.isUTCMode ? 'utc' : 'local',
      timezone: this.userTimezone,
      initialized: this.initialized,
      conflictStrategy: this.conflictResolutionStrategy
    };
  }
}

// Create global instance
if (typeof window !== 'undefined') {
  window.UTCCoordinator = new UTCCoordinator();
} else if (typeof globalThis !== 'undefined') {
  globalThis.UTCCoordinator = new UTCCoordinator();
} else {
  self.UTCCoordinator = new UTCCoordinator();
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UTCCoordinator;
}