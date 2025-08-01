/**
 * StorageManager class for handling extension storage operations
 */

export class StorageManager {
  constructor() {
    this.focusTimeTracker = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize storage with default settings if needed
      const settings = await this.getSettings();
      if (!settings) {
        await this.saveSettings(this.getDefaultSettings());
      }
      
      this.initialized = true;
      console.log('✅ StorageManager initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing StorageManager:', error);
      throw error;
    }
  }

  setFocusTimeTracker(tracker) {
    this.focusTimeTracker = tracker;
  }

  getDefaultSettings() {
    return {
      inactivityThreshold: 5 * 60 * 1000, // 5 minutes
      autoManageInactivity: true,
      notifyOnInactivity: true
    };
  }

  // ... rest of the StorageManager methods
} 