/**
 * Sleep Detection Service
 * Handles system sleep state detection and provides accurate activity tracking
 */

class SleepDetectionService {
  constructor() {
    this.lastActiveTime = Date.now();
    this.lastCheckTime = Date.now();
    this.isSystemSleeping = false;
    this.wakeListeners = new Set();
    this.sleepListeners = new Set();
    this.checkInterval = null;
    this.timeGapThreshold = 2 * 60 * 1000; // 2 minutes - minimum time to consider as sleep
    this.maxAllowedGap = 30 * 60 * 1000;   // 30 minutes - maximum time to consider for tracking
    
    this.initialize();
  }

  initialize() {
    // Set up visibility change detection
    document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
    
    // Set up focus detection
    window.addEventListener('focus', () => this.handleWindowFocus());
    window.addEventListener('blur', () => this.handleWindowBlur());
    
    // Start periodic checks
    this.startChecks();
  }

  startChecks() {
    // Check every 10 seconds
    this.checkInterval = setInterval(() => this.checkTimeGap(), 10000);
  }

  stopChecks() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  checkTimeGap() {
    const now = Date.now();
    const timeSinceLastCheck = now - this.lastCheckTime;

    // If time gap is larger than threshold, system might have been sleeping
    if (timeSinceLastCheck > this.timeGapThreshold) {
      this.handlePotentialWake(timeSinceLastCheck);
    }

    this.lastCheckTime = now;
  }

  handleVisibilityChange() {
    if (document.hidden) {
      this.handlePotentialSleep();
    } else {
      this.checkTimeGap();
    }
  }

  handleWindowFocus() {
    this.checkTimeGap();
  }

  handleWindowBlur() {
    this.handlePotentialSleep();
  }

  handlePotentialSleep() {
    if (!this.isSystemSleeping) {
      this.isSystemSleeping = true;
      this.notifySleepListeners();
    }
  }

  handlePotentialWake(timeGap) {
    const validTimeGap = Math.min(timeGap, this.maxAllowedGap);
    
    if (this.isSystemSleeping) {
      this.isSystemSleeping = false;
      this.notifyWakeListeners(validTimeGap);
    }
  }

  onWake(callback) {
    this.wakeListeners.add(callback);
    return () => this.wakeListeners.delete(callback);
  }

  onSleep(callback) {
    this.sleepListeners.add(callback);
    return () => this.sleepListeners.delete(callback);
  }

  notifyWakeListeners(timeGap) {
    this.wakeListeners.forEach(listener => {
      try {
        listener(timeGap);
      } catch (error) {
        console.error('Error in wake listener:', error);
      }
    });
  }

  notifySleepListeners() {
    this.sleepListeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('Error in sleep listener:', error);
      }
    });
  }

  destroy() {
    this.stopChecks();
    this.wakeListeners.clear();
    this.sleepListeners.clear();
  }
}

export default SleepDetectionService; 