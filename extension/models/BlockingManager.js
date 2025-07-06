/**
 * BlockingManager class for handling site blocking functionality
 */

export class BlockingManager {
  constructor() {
    this.storageManager = null;
    this.initialized = false;
    this.urlCache = new Map();
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize blocking rules
      await this.updateBlockingRules();
      
      this.initialized = true;
      console.log('✅ BlockingManager initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing BlockingManager:', error);
      throw error;
    }
  }

  setStorageManager(storageManager) {
    this.storageManager = storageManager;
  }

  // ... rest of the BlockingManager methods
} 