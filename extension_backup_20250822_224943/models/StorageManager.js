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
}

// Make StorageManager globally available for service worker
self.StorageManager = StorageManager;