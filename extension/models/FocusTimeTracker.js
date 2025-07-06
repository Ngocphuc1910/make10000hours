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
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize managers
      this.storageManager = new StorageManager();
      await this.storageManager.initialize();
      
      this.blockingManager = new BlockingManager();
      await this.blockingManager.initialize();
      
      this.stateManager = new StateManager();
      this.overrideManager = new OverrideSessionManager();
      
      // Setup connections
      this.storageManager.setFocusTimeTracker(this);
      this.blockingManager.setStorageManager(this.storageManager);
      
      // Setup event listeners
      this.setupEventListeners();
      this.setupPeriodicCleanup();
      
      this.initialized = true;
      console.log('✅ FocusTimeTracker initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing FocusTimeTracker:', error);
      throw error;
    }
  }
  
  // ... rest of the FocusTimeTracker class methods
} 