/**
 * Override Session Manager for Chrome Extension Local Storage
 * Manages override sessions with date-based organization and consistency with database schema
 */

// DateUtils will be available globally
class OverrideSessionManager {
  constructor() {
    this.storageKey = 'overrideSessions';
    this.version = '1.0.0';
  }

  /**
   * Generate unique ID for override session
   */
  generateId() {
    return `override_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current date in YYYY-MM-DD format (local timezone)
   */
  getCurrentDate() {
    return DateUtils.getLocalDateString();
  }

  /**
   * Validate override session data
   */
  validateOverrideData(data) {
    const errors = [];
    
    if (!data.domain || typeof data.domain !== 'string') {
      errors.push('Missing or invalid domain');
    }
    
    if (!data.duration || typeof data.duration !== 'number' || data.duration <= 0) {
      errors.push('Missing or invalid duration');
    }
    
    if (data.userId && typeof data.userId !== 'string') {
      errors.push('Invalid userId');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Save override session to localStorage
   */
  async saveOverrideSession(data) {
    try {
      const validation = this.validateOverrideData(data);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      const currentDate = this.getCurrentDate();
      const sessionId = this.generateId();
      
      // Create override session object
      const overrideSession = {
        id: sessionId,
        userId: data.userId || 'anonymous',
        domain: data.domain,
        url: data.url || null,
        duration: data.duration, // in minutes
        createdAt: Date.now(),
        reason: data.reason || 'manual_override',
        metadata: {
          extensionVersion: this.version,
          source: 'extension',
          ...data.metadata
        }
      };

      // Get existing data
      const result = await chrome.storage.local.get([this.storageKey]);
      const existingData = result[this.storageKey] || {};
      
      // Initialize date array if not exists
      if (!existingData[currentDate]) {
        existingData[currentDate] = [];
      }
      
      // Add new session
      existingData[currentDate].push(overrideSession);
      existingData.lastUpdated = Date.now();
      
      // Save back to localStorage
      await chrome.storage.local.set({
        [this.storageKey]: existingData
      });
      
      console.log('✅ Override session saved to localStorage:', {
        id: sessionId,
        domain: data.domain,
        duration: data.duration + 'min',
        date: currentDate
      });
      
      return {
        success: true,
        id: sessionId,
        session: overrideSession
      };
      
    } catch (error) {
      console.error('❌ Error saving override session to localStorage:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get override sessions for a specific date
   */
  async getOverrideSessionsByDate(date) {
    try {
      const result = await chrome.storage.local.get([this.storageKey]);
      const data = result[this.storageKey] || {};
      
      return {
        success: true,
        sessions: data[date] || [],
        date
      };
    } catch (error) {
      console.error('❌ Error getting override sessions by date:', error);
      return {
        success: false,
        error: error.message,
        sessions: []
      };
    }
  }

  /**
   * Get today's override sessions
   */
  async getTodayOverrideSessions() {
    return this.getOverrideSessionsByDate(this.getCurrentDate());
  }

  /**
   * Calculate total override time for a specific date
   */
  async calculateOverrideTimeByDate(date) {
    try {
      const result = await this.getOverrideSessionsByDate(date);
      if (!result.success) {
        return { success: false, minutes: 0 };
      }
      
      const totalMinutes = result.sessions.reduce((total, session) => {
        return total + (session.duration || 0);
      }, 0);
      
      return {
        success: true,
        minutes: totalMinutes,
        sessions: result.sessions.length
      };
    } catch (error) {
      console.error('❌ Error calculating override time:', error);
      return {
        success: false,
        minutes: 0
      };
    }
  }

  /**
   * Calculate today's total override time
   */
  async calculateTodayOverrideTime() {
    return this.calculateOverrideTimeByDate(this.getCurrentDate());
  }

  /**
   * Get override sessions within date range
   */
  async getOverrideSessionsByDateRange(startDate, endDate) {
    try {
      const result = await chrome.storage.local.get([this.storageKey]);
      const data = result[this.storageKey] || {};
      
      const sessions = [];
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // Iterate through date range
      for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        const dateStr = DateUtils.getLocalDateStringFromDate(date);
        if (data[dateStr]) {
          sessions.push(...data[dateStr]);
        }
      }
      
      return {
        success: true,
        sessions,
        startDate,
        endDate
      };
    } catch (error) {
      console.error('❌ Error getting override sessions by date range:', error);
      return {
        success: false,
        error: error.message,
        sessions: []
      };
    }
  }

  /**
   * Clean up old override sessions (older than specified days)
   */
  async cleanupOldSessions(daysToKeep = 30) {
    try {
      const result = await chrome.storage.local.get([this.storageKey]);
      const data = result[this.storageKey] || {};
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffDateStr = DateUtils.getLocalDateStringFromDate(cutoffDate);
      
      let deletedCount = 0;
      const updatedData = {};
      
      // Keep only recent dates
      Object.keys(data).forEach(dateStr => {
        if (dateStr === 'lastUpdated' || dateStr >= cutoffDateStr) {
          updatedData[dateStr] = data[dateStr];
        } else {
          deletedCount += Array.isArray(data[dateStr]) ? data[dateStr].length : 0;
        }
      });
      
      // Update localStorage
      await chrome.storage.local.set({
        [this.storageKey]: updatedData
      });
      
      console.log(`🧹 Cleaned up ${deletedCount} old override sessions (older than ${daysToKeep} days)`);
      
      return {
        success: true,
        deletedCount
      };
    } catch (error) {
      console.error('❌ Error cleaning up old sessions:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get debug information about stored override sessions
   */
  async getDebugInfo() {
    try {
      const result = await chrome.storage.local.get([this.storageKey]);
      const data = result[this.storageKey] || {};
      
      const dates = Object.keys(data).filter(key => key !== 'lastUpdated');
      const totalSessions = dates.reduce((total, date) => {
        return total + (Array.isArray(data[date]) ? data[date].length : 0);
      }, 0);
      
      return {
        success: true,
        debug: {
          totalDates: dates.length,
          totalSessions,
          lastUpdated: data.lastUpdated,
          dates: dates.sort(),
          storageKey: this.storageKey
        }
      };
    } catch (error) {
      console.error('❌ Error getting debug info:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Clear all override sessions (for testing/reset)
   */
  async clearAllSessions() {
    try {
      await chrome.storage.local.remove([this.storageKey]);
      console.log('🗑️ All override sessions cleared from localStorage');
      return { success: true };
    } catch (error) {
      console.error('❌ Error clearing override sessions:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OverrideSessionManager;
} else if (typeof window !== 'undefined') {
  window.OverrideSessionManager = OverrideSessionManager;
} 