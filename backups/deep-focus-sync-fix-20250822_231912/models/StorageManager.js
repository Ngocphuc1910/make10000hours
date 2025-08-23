/**
 * StorageManager for Deep Focus Sessions
 * Handles local storage operations for Deep Focus session tracking
 * Service Worker Compatible Version
 */

class StorageManager {
  constructor() {
    this.initialized = false;
    this.currentUserId = null;
    this.userTimezone = null;
  }

  /**
   * Initialize the StorageManager
   */
  async initialize() {
    try {
      // Get user info from storage
      const storage = await chrome.storage.local.get(['userInfo']);
      if (storage.userInfo) {
        this.currentUserId = storage.userInfo.userId;
        this.userTimezone = storage.userInfo.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        console.log('✅ StorageManager initialized with user:', this.currentUserId);
      } else {
        console.log('ℹ️ StorageManager initialized without user info');
      }
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('❌ StorageManager initialization failed:', error);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Validate and recover user state
   */
  async validateAndRecoverUserState() {
    try {
      if (!this.currentUserId) {
        const storage = await chrome.storage.local.get(['userInfo']);
        if (storage.userInfo && storage.userInfo.userId) {
          this.currentUserId = storage.userInfo.userId;
          this.userTimezone = storage.userInfo.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
          console.log('✅ Recovered user state:', this.currentUserId);
          return true;
        } else {
          console.warn('⚠️ No user ID available for Deep Focus session');
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error('❌ Error validating user state:', error);
      return false;
    }
  }

  /**
   * Create a new Deep Focus session
   */
  async createDeepFocusSession() {
    try {
      if (!this.currentUserId) {
        const isValid = await this.validateAndRecoverUserState();
        if (!isValid) {
          throw new Error('User ID required to create Deep Focus session');
        }
      }

      const now = new Date();
      const sessionId = `dfs_${now.getTime()}_${this.currentUserId}`;
      const utcDate = now.toISOString().split('T')[0];

      const newSession = {
        id: sessionId,
        userId: this.currentUserId,
        startTime: now.getTime(),
        startTimeUTC: now.toISOString(),
        timezone: this.userTimezone,
        utcDate: utcDate,
        duration: 0,
        status: 'active',
        createdAt: now.getTime(),
        updatedAt: now.getTime()
      };

      // Get existing Deep Focus sessions
      const storage = await chrome.storage.local.get(['deepFocusSession']);
      const allSessions = storage.deepFocusSession || {};
      
      // Initialize date array if needed
      if (!allSessions[utcDate]) {
        allSessions[utcDate] = [];
      }

      // Add new session
      allSessions[utcDate].push(newSession);

      // Save to storage
      await chrome.storage.local.set({ deepFocusSession: allSessions });

      console.log('✅ Created Deep Focus session:', sessionId);
      
      // Broadcast session creation via ExtensionEventBus (if available)
      if (typeof ExtensionEventBus !== 'undefined') {
        try {
          const totalMinutes = await this.getLocalDeepFocusTime();
          await ExtensionEventBus.emit(
            ExtensionEventBus.EVENTS.DEEP_FOCUS_UPDATE,
            { minutes: totalMinutes.minutes }
          );
        } catch (error) {
          console.warn('⚠️ Failed to broadcast session creation:', error);
        }
      }
      
      return sessionId;
    } catch (error) {
      console.error('❌ Error creating Deep Focus session:', error);
      throw error;
    }
  }

  /**
   * Update Deep Focus session duration
   */
  async updateDeepFocusSessionDuration(sessionId, minutes) {
    try {
      if (!sessionId) {
        throw new Error('Session ID required');
      }

      const storage = await chrome.storage.local.get(['deepFocusSession']);
      const allSessions = storage.deepFocusSession || {};
      
      // Find the session across all dates
      let sessionFound = false;
      for (const date in allSessions) {
        const sessions = allSessions[date];
        const sessionIndex = sessions.findIndex(s => s.id === sessionId);
        
        if (sessionIndex !== -1) {
          // Update the session
          sessions[sessionIndex].duration = minutes;
          sessions[sessionIndex].updatedAt = Date.now();
          sessionFound = true;
          
          // Save updated sessions
          await chrome.storage.local.set({ deepFocusSession: allSessions });
          
          console.log(`📊 Updated Deep Focus session ${sessionId}: ${minutes} minutes`);
          
          // Broadcast session update via ExtensionEventBus (if available)
          if (typeof ExtensionEventBus !== 'undefined') {
            try {
              const totalMinutes = await this.getLocalDeepFocusTime();
              await ExtensionEventBus.emit(
                ExtensionEventBus.EVENTS.DEEP_FOCUS_UPDATE,
                { minutes: totalMinutes.minutes }
              );
            } catch (error) {
              console.warn('⚠️ Failed to broadcast session update:', error);
            }
          }
          
          break;
        }
      }

      if (!sessionFound) {
        console.warn('⚠️ Deep Focus session not found for update:', sessionId);
      }

      return sessionFound;
    } catch (error) {
      console.error('❌ Error updating Deep Focus session duration:', error);
      throw error;
    }
  }

  /**
   * Complete a Deep Focus session
   */
  async completeDeepFocusSession(sessionId, finalMinutes = null) {
    try {
      if (!sessionId) {
        throw new Error('Session ID required');
      }

      const storage = await chrome.storage.local.get(['deepFocusSession']);
      const allSessions = storage.deepFocusSession || {};
      
      // Find the session across all dates
      let sessionFound = false;
      for (const date in allSessions) {
        const sessions = allSessions[date];
        const sessionIndex = sessions.findIndex(s => s.id === sessionId);
        
        if (sessionIndex !== -1) {
          const session = sessions[sessionIndex];
          const now = Date.now();
          
          // Update the session
          session.status = 'completed';
          session.endTime = now;
          session.endTimeUTC = new Date(now).toISOString();
          session.updatedAt = now;
          
          // Set final duration if provided
          if (finalMinutes !== null) {
            session.duration = finalMinutes;
          } else if (session.duration === 0) {
            // Calculate duration from start time if not set
            const elapsedMs = now - session.startTime;
            session.duration = Math.floor(elapsedMs / (60 * 1000));
          }
          
          sessionFound = true;
          
          // Save updated sessions
          await chrome.storage.local.set({ deepFocusSession: allSessions });
          
          console.log(`✅ Completed Deep Focus session ${sessionId}: ${session.duration} minutes`);
          
          // Broadcast session completion via ExtensionEventBus (if available)
          if (typeof ExtensionEventBus !== 'undefined') {
            try {
              const totalMinutes = await this.getLocalDeepFocusTime();
              await ExtensionEventBus.emit(
                ExtensionEventBus.EVENTS.DEEP_FOCUS_UPDATE,
                { minutes: totalMinutes.minutes }
              );
            } catch (error) {
              console.warn('⚠️ Failed to broadcast session completion:', error);
            }
          }
          
          break;
        }
      }

      if (!sessionFound) {
        console.warn('⚠️ Deep Focus session not found for completion:', sessionId);
      }

      return sessionFound;
    } catch (error) {
      console.error('❌ Error completing Deep Focus session:', error);
      throw error;
    }
  }

  /**
   * Get the currently active Deep Focus session
   */
  async getActiveDeepFocusSession() {
    try {
      const storage = await chrome.storage.local.get(['deepFocusSession']);
      const allSessions = storage.deepFocusSession || {};
      
      // Look for active sessions across all dates
      for (const date in allSessions) {
        const sessions = allSessions[date];
        const activeSession = sessions.find(s => s.status === 'active');
        if (activeSession) {
          return activeSession;
        }
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error getting active Deep Focus session:', error);
      return null;
    }
  }

  /**
   * Get Deep Focus sessions for a specific date
   */
  async getDeepFocusSessionsForDate(date) {
    try {
      const storage = await chrome.storage.local.get(['deepFocusSession']);
      const allSessions = storage.deepFocusSession || {};
      return allSessions[date] || [];
    } catch (error) {
      console.error('❌ Error getting Deep Focus sessions for date:', error);
      return [];
    }
  }

  /**
   * Get total Deep Focus time for today
   */
  async getLocalDeepFocusTime() {
    const today = new Date().toISOString().split('T')[0];
    try {
      const sessions = await this.getDeepFocusSessionsForDate(today);
      
      const totalMinutes = sessions.reduce((total, session) => {
        return total + (session.duration || 0);
      }, 0);
      
      return {
        minutes: totalMinutes,
        sessions: sessions.length,
        date: today
      };
    } catch (error) {
      console.error('❌ Error getting local Deep Focus time:', error);
      return { minutes: 0, sessions: 0, date: today };
    }
  }

  /**
   * Get sessions that need Firebase sync
   */
  async getSessionsForFirebaseSync() {
    try {
      const storage = await chrome.storage.local.get(['deepFocusSession']);
      const allSessions = storage.deepFocusSession || {};
      
      const sessionsToSync = [];
      
      for (const date in allSessions) {
        const sessions = allSessions[date];
        // Get completed sessions that haven't been synced
        const completedSessions = sessions.filter(s => 
          s.status === 'completed' && 
          s.duration > 0 && 
          !s.synced
        );
        sessionsToSync.push(...completedSessions);
      }
      
      return sessionsToSync;
    } catch (error) {
      console.error('❌ Error getting sessions for Firebase sync:', error);
      return [];
    }
  }

  /**
   * Mark sessions as synced to Firebase
   */
  async markSessionsAsSynced(sessionIds) {
    try {
      const storage = await chrome.storage.local.get(['deepFocusSession']);
      const allSessions = storage.deepFocusSession || {};
      
      let updated = false;
      
      for (const date in allSessions) {
        const sessions = allSessions[date];
        sessions.forEach(session => {
          if (sessionIds.includes(session.id)) {
            session.synced = true;
            session.syncedAt = Date.now();
            updated = true;
          }
        });
      }
      
      if (updated) {
        await chrome.storage.local.set({ deepFocusSession: allSessions });
        console.log('✅ Marked sessions as synced:', sessionIds.length);
      }
      
      return updated;
    } catch (error) {
      console.error('❌ Error marking sessions as synced:', error);
      return false;
    }
  }

  /**
   * Validate session data structure and content
   */
  validateSession(sessionData) {
    try {
      if (!sessionData || typeof sessionData !== 'object') {
        return { valid: false, error: 'Session data must be an object' };
      }

      // Required fields validation
      const requiredFields = ['id', 'userId', 'startTime', 'startTimeUTC', 'status'];
      for (const field of requiredFields) {
        if (!(field in sessionData)) {
          return { valid: false, error: `Missing required field: ${field}` };
        }
      }

      // Data type validation
      if (typeof sessionData.id !== 'string' || sessionData.id.length === 0) {
        return { valid: false, error: 'Session ID must be a non-empty string' };
      }

      if (typeof sessionData.userId !== 'string' || sessionData.userId.length === 0) {
        return { valid: false, error: 'User ID must be a non-empty string' };
      }

      if (!Number.isInteger(sessionData.startTime) || sessionData.startTime <= 0) {
        return { valid: false, error: 'Start time must be a positive integer timestamp' };
      }

      if (typeof sessionData.startTimeUTC !== 'string') {
        return { valid: false, error: 'Start time UTC must be a string' };
      }

      // Validate UTC timestamp format
      try {
        const utcDate = new Date(sessionData.startTimeUTC);
        if (isNaN(utcDate.getTime())) {
          return { valid: false, error: 'Start time UTC must be a valid ISO timestamp' };
        }
      } catch (error) {
        return { valid: false, error: 'Invalid UTC timestamp format' };
      }

      // Status validation
      const validStatuses = ['active', 'completed', 'cancelled'];
      if (!validStatuses.includes(sessionData.status)) {
        return { valid: false, error: `Status must be one of: ${validStatuses.join(', ')}` };
      }

      // Duration validation (if present)
      if ('duration' in sessionData) {
        if (!Number.isInteger(sessionData.duration) || sessionData.duration < 0) {
          return { valid: false, error: 'Duration must be a non-negative integer' };
        }
      }

      // End time validation (if present)
      if ('endTime' in sessionData) {
        if (!Number.isInteger(sessionData.endTime) || sessionData.endTime <= sessionData.startTime) {
          return { valid: false, error: 'End time must be after start time' };
        }
      }

      return { valid: true, sanitized: sessionData };

    } catch (error) {
      console.error('❌ Session validation error:', error);
      return { valid: false, error: 'Validation failed due to internal error' };
    }
  }

  /**
   * Sanitize and clean potentially corrupted session data
   */
  sanitizeSessionData(data) {
    try {
      if (!data || typeof data !== 'object') {
        return null;
      }

      const sanitized = {};

      // Sanitize required string fields
      if (typeof data.id === 'string' && data.id.trim().length > 0) {
        sanitized.id = data.id.trim();
      } else {
        return null; // Can't sanitize missing ID
      }

      if (typeof data.userId === 'string' && data.userId.trim().length > 0) {
        sanitized.userId = data.userId.trim();
      } else {
        return null; // Can't sanitize missing user ID
      }

      // Sanitize timestamps
      if (typeof data.startTime === 'number' && data.startTime > 0) {
        sanitized.startTime = Math.floor(data.startTime);
      } else if (typeof data.startTime === 'string') {
        const parsedTime = parseInt(data.startTime, 10);
        if (!isNaN(parsedTime) && parsedTime > 0) {
          sanitized.startTime = parsedTime;
        } else {
          return null;
        }
      } else {
        return null;
      }

      // Sanitize UTC timestamp
      if (typeof data.startTimeUTC === 'string') {
        try {
          const utcDate = new Date(data.startTimeUTC);
          if (!isNaN(utcDate.getTime())) {
            sanitized.startTimeUTC = utcDate.toISOString();
          } else {
            // Try to reconstruct from startTime
            sanitized.startTimeUTC = new Date(sanitized.startTime).toISOString();
          }
        } catch (error) {
          sanitized.startTimeUTC = new Date(sanitized.startTime).toISOString();
        }
      } else {
        sanitized.startTimeUTC = new Date(sanitized.startTime).toISOString();
      }

      // Sanitize status
      const validStatuses = ['active', 'completed', 'cancelled'];
      if (validStatuses.includes(data.status)) {
        sanitized.status = data.status;
      } else {
        sanitized.status = 'active'; // Default to active for unknown status
      }

      // Sanitize optional fields
      if ('duration' in data) {
        if (typeof data.duration === 'number' && data.duration >= 0) {
          sanitized.duration = Math.floor(data.duration);
        } else if (typeof data.duration === 'string') {
          const parsedDuration = parseInt(data.duration, 10);
          if (!isNaN(parsedDuration) && parsedDuration >= 0) {
            sanitized.duration = parsedDuration;
          } else {
            sanitized.duration = 0;
          }
        } else {
          sanitized.duration = 0;
        }
      }

      if ('endTime' in data) {
        if (typeof data.endTime === 'number' && data.endTime > sanitized.startTime) {
          sanitized.endTime = Math.floor(data.endTime);
        } else {
          delete data.endTime; // Remove invalid end time
        }
      }

      // Add missing required fields with defaults
      if (!('createdAt' in data)) {
        sanitized.createdAt = sanitized.startTime;
      } else if (typeof data.createdAt === 'number') {
        sanitized.createdAt = Math.floor(data.createdAt);
      } else {
        sanitized.createdAt = sanitized.startTime;
      }

      if (!('updatedAt' in data)) {
        sanitized.updatedAt = Date.now();
      } else if (typeof data.updatedAt === 'number') {
        sanitized.updatedAt = Math.floor(data.updatedAt);
      } else {
        sanitized.updatedAt = Date.now();
      }

      // Set UTC date if missing
      if (!('utcDate' in data)) {
        sanitized.utcDate = sanitized.startTimeUTC.split('T')[0];
      } else {
        sanitized.utcDate = data.utcDate;
      }

      // Set timezone if missing
      if (!('timezone' in data)) {
        sanitized.timezone = this.userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
      } else {
        sanitized.timezone = data.timezone;
      }

      return sanitized;

    } catch (error) {
      console.error('❌ Session sanitization error:', error);
      return null;
    }
  }

  /**
   * Get all active Deep Focus sessions across all dates
   */
  async getAllActiveSessions() {
    try {
      const storage = await chrome.storage.local.get(['deepFocusSession']);
      const allSessions = storage.deepFocusSession || {};
      
      const activeSessions = [];
      
      for (const date in allSessions) {
        const sessions = allSessions[date];
        const activeInDate = sessions.filter(s => s.status === 'active');
        activeSessions.push(...activeInDate);
      }
      
      // Sort by start time (newest first)
      activeSessions.sort((a, b) => b.startTime - a.startTime);
      
      console.log(`📊 Found ${activeSessions.length} active sessions across all dates`);
      return activeSessions;
      
    } catch (error) {
      console.error('❌ Error getting all active sessions:', error);
      return [];
    }
  }

  /**
   * Get Deep Focus sessions within a specific date range
   */
  async getSessionsByDateRange(startDate, endDate) {
    try {
      // Validate input dates
      if (!startDate || !endDate) {
        throw new Error('Start date and end date are required');
      }

      // Ensure dates are in YYYY-MM-DD format
      const startDateStr = typeof startDate === 'string' ? startDate : startDate.toISOString().split('T')[0];
      const endDateStr = typeof endDate === 'string' ? endDate : endDate.toISOString().split('T')[0];
      
      if (startDateStr > endDateStr) {
        throw new Error('Start date must be before or equal to end date');
      }

      const storage = await chrome.storage.local.get(['deepFocusSession']);
      const allSessions = storage.deepFocusSession || {};
      
      const rangeSessions = [];
      
      // Iterate through date range
      const currentDate = new Date(startDateStr);
      const endDateTime = new Date(endDateStr);
      
      while (currentDate <= endDateTime) {
        const dateKey = currentDate.toISOString().split('T')[0];
        
        if (allSessions[dateKey]) {
          const sessions = allSessions[dateKey];
          // Validate and sanitize sessions
          const validSessions = sessions
            .map(session => this.sanitizeSessionData(session))
            .filter(session => session !== null);
          
          rangeSessions.push(...validSessions);
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Sort by start time (newest first)
      rangeSessions.sort((a, b) => b.startTime - a.startTime);
      
      console.log(`📊 Found ${rangeSessions.length} sessions in range ${startDateStr} to ${endDateStr}`);
      return rangeSessions;
      
    } catch (error) {
      console.error('❌ Error getting sessions by date range:', error);
      throw error;
    }
  }

  /**
   * Clean up stale, corrupted, or old session data
   */
  async cleanupStaleData() {
    try {
      const storage = await chrome.storage.local.get(['deepFocusSession']);
      const allSessions = storage.deepFocusSession || {};
      
      let totalSessions = 0;
      let cleanedSessions = 0;
      let removedSessions = 0;
      const cleanedData = {};
      
      // Define cleanup thresholds
      const OLD_DATA_THRESHOLD = 90 * 24 * 60 * 60 * 1000; // 90 days
      const now = Date.now();
      
      for (const date in allSessions) {
        const sessions = allSessions[date];
        totalSessions += sessions.length;
        
        const validSessions = [];
        
        for (const session of sessions) {
          // Check if session is too old
          if (session.startTime && (now - session.startTime) > OLD_DATA_THRESHOLD) {
            removedSessions++;
            console.log(`🗑️ Removing old session from ${date}:`, session.id);
            continue;
          }
          
          // Try to sanitize the session
          const sanitized = this.sanitizeSessionData(session);
          if (sanitized !== null) {
            // Further validate the sanitized session
            const validation = this.validateSession(sanitized);
            if (validation.valid) {
              validSessions.push(sanitized);
              if (JSON.stringify(sanitized) !== JSON.stringify(session)) {
                cleanedSessions++;
                console.log(`🧹 Cleaned corrupted session:`, session.id);
              }
            } else {
              removedSessions++;
              console.log(`🗑️ Removing invalid session:`, session.id, validation.error);
            }
          } else {
            removedSessions++;
            console.log(`🗑️ Removing corrupted session from ${date}`);
          }
        }
        
        // Only keep the date if it has valid sessions
        if (validSessions.length > 0) {
          cleanedData[date] = validSessions;
        }
      }
      
      // Save cleaned data
      await chrome.storage.local.set({ deepFocusSession: cleanedData });
      
      const summary = {
        total: totalSessions,
        cleaned: cleanedSessions,
        removed: removedSessions,
        remaining: totalSessions - removedSessions
      };
      
      console.log('🧹 Data cleanup completed:', summary);
      return summary;
      
    } catch (error) {
      console.error('❌ Error during data cleanup:', error);
      throw error;
    }
  }

  /**
   * Export sessions optimized for Firebase sync operations
   */
  async exportSessionsForSync() {
    try {
      const unsynced = await this.getSessionsForFirebaseSync();
      
      if (unsynced.length === 0) {
        return {
          sessions: [],
          totalCount: 0,
          totalDuration: 0,
          dateRange: null
        };
      }
      
      // Process sessions for optimal sync
      const processedSessions = [];
      let totalDuration = 0;
      let minDate = null;
      let maxDate = null;
      
      for (const session of unsynced) {
        // Validate session before export
        const validation = this.validateSession(session);
        if (!validation.valid) {
          console.warn('⚠️ Skipping invalid session for sync:', session.id, validation.error);
          continue;
        }
        
        // Prepare session for Firebase
        const exportSession = {
          id: session.id,
          userId: session.userId,
          startTime: session.startTime,
          startTimeUTC: session.startTimeUTC,
          endTime: session.endTime || session.startTime,
          endTimeUTC: session.endTimeUTC || session.startTimeUTC,
          duration: session.duration || 0,
          timezone: session.timezone,
          utcDate: session.utcDate,
          status: session.status,
          createdAt: session.createdAt || session.startTime,
          // Add sync metadata
          syncBatch: Date.now(),
          extensionVersion: chrome.runtime.getManifest()?.version || 'unknown'
        };
        
        processedSessions.push(exportSession);
        totalDuration += exportSession.duration;
        
        // Track date range
        const sessionDate = exportSession.utcDate;
        if (!minDate || sessionDate < minDate) minDate = sessionDate;
        if (!maxDate || sessionDate > maxDate) maxDate = sessionDate;
      }
      
      const exportData = {
        sessions: processedSessions,
        totalCount: processedSessions.length,
        totalDuration: totalDuration,
        dateRange: minDate && maxDate ? { start: minDate, end: maxDate } : null,
        metadata: {
          exportTime: Date.now(),
          exportTimeUTC: new Date().toISOString(),
          userId: this.currentUserId,
          timezone: this.userTimezone
        }
      };
      
      console.log(`📤 Prepared ${exportData.totalCount} sessions for Firebase sync`);
      return exportData;
      
    } catch (error) {
      console.error('❌ Error exporting sessions for sync:', error);
      throw error;
    }
  }
}

// Make StorageManager globally available for service worker
self.StorageManager = StorageManager;