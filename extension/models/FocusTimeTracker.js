/**
 * FocusTimeTracker class for managing focus time tracking functionality
 */

export class FocusTimeTracker {
  constructor() {
    this.currentTab = null;
    this.startTime = null;
    this.isTracking = false;
    this.storageManager = null;
    this.blockingManager = null;
    this.stateManager = null;
    this.overrideManager = null;
    this.lastActivityTime = Date.now();
    this.activityCheckInterval = null;
    this.inactivityThreshold = 5 * 60 * 1000; // 5 minutes
    this.cleanupInterval = null;
    this.initialized = false;
    this.userSyncInterval = null;
    this.lastUserSync = null;
    this.currentUserId = null;
    this.userInfo = null;
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize state manager first
      this.stateManager = new StateManager();
      await this.stateManager.initialize();
      
      // Initialize storage manager
      this.storageManager = new StorageManager();
      this.storageManager.setStateManager(this.stateManager);
      await this.storageManager.initialize();
      
      // Try to recover user state before proceeding
      const userStateRecovered = await this.storageManager.validateAndRecoverUserState();
      if (!userStateRecovered) {
        console.warn('⚠️ No user state available - some features may be limited');
      } else {
        // Sync the user ID to FocusTimeTracker
        this.currentUserId = this.storageManager.currentUserId;
        console.log('✅ User state recovered:', this.currentUserId);
      }
      
      // Initialize blocking manager after user state is recovered
      this.blockingManager = new BlockingManager();
      this.blockingManager.setStorageManager(this.storageManager);
      await this.blockingManager.initialize();
      
      this.overrideManager = new OverrideSessionManager();
      
      // Setup connections
      this.storageManager.setFocusTimeTracker(this);
      
      // Setup periodic user state sync
      this.setupUserStateSync();
      
      // Setup other event listeners and cleanup
      this.setupEventListeners();
      this.setupPeriodicCleanup();
      
      this.initialized = true;
      console.log('✅ FocusTimeTracker initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing FocusTimeTracker:', error);
      throw error;
    }
  }

  /**
   * Sync user state across storage and memory
   */
  async syncUserState() {
    try {
      const settings = await this.storageManager.getSettings();
      const localData = await chrome.storage.local.get(['userInfo']);
      
      // Use most recently updated source
      const userInfo = settings.lastUpdated > (localData.userInfo?.lastUpdated || 0)
        ? settings
        : localData.userInfo;
        
      if (userInfo?.userId) {
        this.currentUserId = userInfo.userId;
        this.userInfo = userInfo;
        this.storageManager.currentUserId = userInfo.userId;
        this.lastUserSync = Date.now();
        console.log('✅ User state synced:', this.currentUserId);
        return true;
      }
      
      // If no user info found, try to recover from storage manager
      return await this.storageManager.validateAndRecoverUserState();
    } catch (error) {
      console.warn('⚠️ User state sync failed:', error);
      return false;
    }
  }

  /**
   * Setup periodic user state synchronization
   */
  setupUserStateSync() {
    if (this.userSyncInterval) {
      clearInterval(this.userSyncInterval);
    }

    // Sync every 5 minutes
    this.userSyncInterval = setInterval(async () => {
      try {
        await this.syncUserState();
      } catch (error) {
        console.warn('⚠️ Periodic user sync failed:', error);
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Handle user state changes
   */
  async handleUserStateChange(newUserInfo) {
    try {
      // Update all relevant components
      this.currentUserId = newUserInfo.userId;
      this.userInfo = newUserInfo;
      this.storageManager.currentUserId = newUserInfo.userId;
      
      // Save to settings
      const settings = await this.storageManager.getSettings();
      settings.userId = newUserInfo.userId;
      settings.userEmail = newUserInfo.userEmail;
      settings.displayName = newUserInfo.displayName;
      settings.lastUpdated = Date.now();
      await this.storageManager.saveSettings(settings);
      
      // Save to local storage as backup
      await chrome.storage.local.set({
        userInfo: {
          ...newUserInfo,
          lastUpdated: Date.now()
        }
      });
      
      console.log('✅ User state updated:', newUserInfo.userId);
      return true;
    } catch (error) {
      console.error('❌ Failed to handle user state change:', error);
      return false;
    }
  }

  // ... rest of the FocusTimeTracker class methods
} 