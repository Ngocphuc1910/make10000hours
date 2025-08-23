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
   * VALIDATE_DEEP_FOCUS_DATA - Comprehensive data validation
   * Validates all deep focus data structures and integrity
   */
  async validateDeepFocusData() {
    try {
      console.log('🔍 Starting comprehensive deep focus data validation...');
      
      const validation = {
        valid: true,
        errors: [],
        warnings: [],
        stats: {
          totalSessions: 0,
          validSessions: 0,
          invalidSessions: 0,
          corruptedSessions: 0,
          orphanedSessions: 0,
          duplicateSessions: 0
        },
        corrections: []
      };

      // Get all storage data
      const storage = await chrome.storage.local.get([
        'deepFocusSession', 'userInfo', 'override_sessions'
      ]);

      // Validate user info first
      if (!storage.userInfo || !storage.userInfo.uid) {
        validation.errors.push('Missing or invalid user information');
        validation.valid = false;
      }

      // Validate deep focus sessions structure
      const allSessions = storage.deepFocusSession || {};
      const seenSessionIds = new Set();
      
      for (const [dateKey, sessions] of Object.entries(allSessions)) {
        // Validate date key format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
          validation.errors.push(`Invalid date key format: ${dateKey}`);
          validation.valid = false;
        }

        if (!Array.isArray(sessions)) {
          validation.errors.push(`Sessions for ${dateKey} is not an array`);
          validation.valid = false;
          continue;
        }

        for (const session of sessions) {
          validation.stats.totalSessions++;
          
          // Check for duplicates
          if (seenSessionIds.has(session.id)) {
            validation.stats.duplicateSessions++;
            validation.errors.push(`Duplicate session ID: ${session.id}`);
            validation.valid = false;
          } else {
            seenSessionIds.add(session.id);
          }

          // Validate session structure
          const sessionValidation = this.validateSession(session);
          if (sessionValidation.valid) {
            validation.stats.validSessions++;
          } else {
            validation.stats.invalidSessions++;
            validation.errors.push(`Session ${session.id}: ${sessionValidation.error}`);
            
            // Try to determine if corrupted or just invalid
            if (session.id && session.userId) {
              validation.stats.orphanedSessions++;
            } else {
              validation.stats.corruptedSessions++;
            }
          }
        }
      }

      // Validate override sessions if they exist
      if (storage.override_sessions) {
        const overrideSessions = storage.override_sessions;
        for (const [dateKey, sessions] of Object.entries(overrideSessions)) {
          if (!Array.isArray(sessions)) {
            validation.warnings.push(`Override sessions for ${dateKey} is not an array`);
          }
        }
      }

      // Generate recommendations
      if (validation.stats.duplicateSessions > 0) {
        validation.corrections.push('Remove duplicate session entries');
      }
      if (validation.stats.corruptedSessions > 0) {
        validation.corrections.push('Clean up corrupted session data');
      }
      if (validation.stats.orphanedSessions > 0) {
        validation.corrections.push('Repair orphaned sessions or remove them');
      }

      console.log('✅ Deep focus data validation complete:', validation.stats);
      return { success: true, validation };

    } catch (error) {
      console.error('❌ Deep focus data validation failed:', error);
      return { 
        success: false, 
        error: error.message,
        validation: { valid: false, errors: [error.message] }
      };
    }
  }

  /**
   * BACKUP_DEEP_FOCUS_DATA - Create comprehensive backup
   * Creates a complete backup of all deep focus related data
   */
  async backupDeepFocusData() {
    try {
      console.log('💾 Creating deep focus data backup...');

      // Get all deep focus related data
      const storage = await chrome.storage.local.get([
        'deepFocusSession', 
        'userInfo', 
        'override_sessions',
        'focusState',
        'deepFocusStats'
      ]);

      const backup = {
        timestamp: Date.now(),
        utcTimestamp: new Date().toISOString(),
        userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        backupVersion: '1.0',
        data: storage,
        metadata: {
          totalSessions: 0,
          dateRange: { earliest: null, latest: null },
          userInfo: !!storage.userInfo
        }
      };

      // Calculate metadata
      if (storage.deepFocusSession) {
        const dates = Object.keys(storage.deepFocusSession).sort();
        backup.metadata.dateRange.earliest = dates[0] || null;
        backup.metadata.dateRange.latest = dates[dates.length - 1] || null;
        
        backup.metadata.totalSessions = Object.values(storage.deepFocusSession)
          .flat().length;
      }

      // Store backup with timestamp
      const backupKey = `deepFocusBackup_${backup.timestamp}`;
      await chrome.storage.local.set({ [backupKey]: backup });

      // Keep only last 5 backups to prevent storage bloat
      const allStorage = await chrome.storage.local.get(null);
      const backupKeys = Object.keys(allStorage)
        .filter(key => key.startsWith('deepFocusBackup_'))
        .sort()
        .reverse();

      if (backupKeys.length > 5) {
        const keysToRemove = backupKeys.slice(5);
        for (const key of keysToRemove) {
          await chrome.storage.local.remove(key);
        }
        console.log('🗑️ Cleaned up old backups:', keysToRemove.length);
      }

      console.log('✅ Deep focus data backup created:', backupKey);
      return { 
        success: true, 
        backupKey,
        metadata: backup.metadata,
        timestamp: backup.timestamp
      };

    } catch (error) {
      console.error('❌ Deep focus data backup failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * RESTORE_DEEP_FOCUS_DATA - Restore from backup
   * Restores deep focus data from a specified backup
   */
  async restoreDeepFocusData(backupKey = null) {
    try {
      console.log('🔄 Restoring deep focus data from backup...');

      let targetBackupKey = backupKey;
      
      // If no specific backup specified, use the most recent
      if (!targetBackupKey) {
        const allStorage = await chrome.storage.local.get(null);
        const backupKeys = Object.keys(allStorage)
          .filter(key => key.startsWith('deepFocusBackup_'))
          .sort()
          .reverse();
        
        if (backupKeys.length === 0) {
          throw new Error('No backups available for restoration');
        }
        
        targetBackupKey = backupKeys[0];
        console.log('📋 Using most recent backup:', targetBackupKey);
      }

      // Get the backup
      const backupStorage = await chrome.storage.local.get([targetBackupKey]);
      const backup = backupStorage[targetBackupKey];
      
      if (!backup) {
        throw new Error(`Backup not found: ${targetBackupKey}`);
      }

      // Validate backup structure
      if (!backup.data || !backup.timestamp) {
        throw new Error('Invalid backup structure');
      }

      // Create current state backup before restoration
      const preRestoreBackup = await this.backupDeepFocusData();
      console.log('💾 Pre-restoration backup created:', preRestoreBackup.backupKey);

      // Restore the data
      const dataToRestore = {
        deepFocusSession: backup.data.deepFocusSession || {},
        userInfo: backup.data.userInfo || null,
        override_sessions: backup.data.override_sessions || {},
        focusState: backup.data.focusState || null,
        deepFocusStats: backup.data.deepFocusStats || null
      };

      await chrome.storage.local.set(dataToRestore);

      // Verify restoration
      const verification = await this.validateDeepFocusData();
      
      console.log('✅ Deep focus data restored from backup:', {
        backupKey: targetBackupKey,
        backupDate: new Date(backup.timestamp).toISOString(),
        verification: verification.success
      });

      return { 
        success: true, 
        restoredFrom: targetBackupKey,
        backupTimestamp: backup.timestamp,
        preRestoreBackup: preRestoreBackup.backupKey,
        verification: verification
      };

    } catch (error) {
      console.error('❌ Deep focus data restoration failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * SYNC_DEEP_FOCUS_STATUS - Get comprehensive sync status
   * Returns detailed information about sync state and requirements
   */
  async getSyncDeepFocusStatus() {
    try {
      console.log('📊 Getting deep focus sync status...');

      const storage = await chrome.storage.local.get([
        'deepFocusSession', 'userInfo', 'lastSyncTimestamp'
      ]);

      const status = {
        ready: false,
        userAuthenticated: false,
        pendingSessions: 0,
        syncedSessions: 0,
        lastSync: storage.lastSyncTimestamp || null,
        timeSinceLastSync: null,
        errors: [],
        recommendations: []
      };

      // Check user authentication
      if (storage.userInfo && storage.userInfo.uid) {
        status.userAuthenticated = true;
        status.userId = storage.userInfo.uid;
      } else {
        status.errors.push('User not authenticated');
        status.recommendations.push('Sign in to enable sync');
      }

      // Analyze sessions
      const allSessions = storage.deepFocusSession || {};
      for (const sessions of Object.values(allSessions)) {
        for (const session of sessions) {
          if (session.synced) {
            status.syncedSessions++;
          } else {
            status.pendingSessions++;
          }
        }
      }

      // Calculate time since last sync
      if (status.lastSync) {
        status.timeSinceLastSync = Date.now() - status.lastSync;
      }

      // Determine if ready for sync
      status.ready = status.userAuthenticated && status.pendingSessions > 0;

      // Generate recommendations
      if (status.pendingSessions > 10) {
        status.recommendations.push('Large number of pending sessions - consider manual sync');
      }
      if (status.timeSinceLastSync && status.timeSinceLastSync > 24 * 60 * 60 * 1000) {
        status.recommendations.push('Last sync was over 24 hours ago');
      }

      console.log('✅ Deep focus sync status:', {
        ready: status.ready,
        pending: status.pendingSessions,
        synced: status.syncedSessions
      });

      return { success: true, status };

    } catch (error) {
      console.error('❌ Get sync status failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * RESET_DEEP_FOCUS_STORAGE - Comprehensive storage reset
   * Safely resets deep focus storage with backup options
   */
  async resetDeepFocusStorage(options = {}) {
    try {
      console.log('🔄 Resetting deep focus storage...', options);

      const {
        createBackup = true,
        resetUserInfo = false,
        resetOverrideSessions = false,
        confirmationKey = null
      } = options;

      // Safety check - require confirmation key for destructive operation
      const expectedKey = 'RESET_DEEP_FOCUS_' + new Date().toISOString().split('T')[0];
      if (confirmationKey !== expectedKey) {
        throw new Error(`Reset requires confirmation key: ${expectedKey}`);
      }

      let preResetBackup = null;
      
      // Create backup before reset if requested
      if (createBackup) {
        preResetBackup = await this.backupDeepFocusData();
        console.log('💾 Pre-reset backup created:', preResetBackup.backupKey);
      }

      // Get current storage to see what we're resetting
      const currentStorage = await chrome.storage.local.get([
        'deepFocusSession', 'userInfo', 'override_sessions', 'focusState', 'deepFocusStats'
      ]);

      const resetStats = {
        sessionDatesReset: Object.keys(currentStorage.deepFocusSession || {}).length,
        totalSessionsReset: Object.values(currentStorage.deepFocusSession || {}).flat().length,
        userInfoReset: resetUserInfo && !!currentStorage.userInfo,
        overrideSessionsReset: resetOverrideSessions
      };

      // Perform the reset
      const keysToRemove = ['deepFocusSession', 'focusState', 'deepFocusStats'];
      
      if (resetUserInfo) {
        keysToRemove.push('userInfo');
      }
      
      if (resetOverrideSessions) {
        keysToRemove.push('override_sessions');
      }

      await chrome.storage.local.remove(keysToRemove);

      // Initialize fresh storage structures
      await chrome.storage.local.set({
        deepFocusSession: {},
        focusState: null,
        deepFocusStats: null
      });

      console.log('✅ Deep focus storage reset complete:', resetStats);

      return { 
        success: true, 
        resetStats,
        preResetBackup: preResetBackup?.backupKey || null,
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('❌ Deep focus storage reset failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * GET_DEEP_FOCUS_DIAGNOSTICS - Comprehensive diagnostic information
   * Returns detailed diagnostics for troubleshooting and monitoring
   */
  async getDeepFocusDiagnostics() {
    try {
      console.log('🔧 Generating deep focus diagnostics...');

      const storage = await chrome.storage.local.get(null);
      const startTime = performance.now();

      const diagnostics = {
        timestamp: Date.now(),
        utcTimestamp: new Date().toISOString(),
        performance: {},
        storage: {
          total: Object.keys(storage).length,
          deepFocusKeys: 0,
          backupKeys: 0,
          totalSize: 0
        },
        sessions: {
          total: 0,
          byDate: {},
          byStatus: { active: 0, completed: 0, synced: 0 },
          dateRange: { earliest: null, latest: null }
        },
        user: {
          authenticated: false,
          userId: null,
          timezone: null
        },
        validation: null,
        sync: null,
        system: {
          userAgent: navigator.userAgent,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: navigator.language,
          onLine: navigator.onLine
        }
      };

      // Analyze storage
      for (const [key, value] of Object.entries(storage)) {
        if (key.startsWith('deepFocus') || key === 'focusState') {
          diagnostics.storage.deepFocusKeys++;
        }
        if (key.startsWith('deepFocusBackup_')) {
          diagnostics.storage.backupKeys++;
        }
        
        // Estimate size (rough approximation)
        diagnostics.storage.totalSize += JSON.stringify(value).length;
      }

      // Analyze user info
      if (storage.userInfo) {
        diagnostics.user.authenticated = !!storage.userInfo.uid;
        diagnostics.user.userId = storage.userInfo.uid || null;
        diagnostics.user.timezone = storage.userInfo.timezone || null;
      }

      // Analyze sessions
      const allSessions = storage.deepFocusSession || {};
      const dates = Object.keys(allSessions).sort();
      
      diagnostics.sessions.dateRange.earliest = dates[0] || null;
      diagnostics.sessions.dateRange.latest = dates[dates.length - 1] || null;

      for (const [date, sessions] of Object.entries(allSessions)) {
        diagnostics.sessions.byDate[date] = sessions.length;
        diagnostics.sessions.total += sessions.length;
        
        for (const session of sessions) {
          if (session.status === 'active') {
            diagnostics.sessions.byStatus.active++;
          } else if (session.status === 'completed') {
            diagnostics.sessions.byStatus.completed++;
          }
          
          if (session.synced) {
            diagnostics.sessions.byStatus.synced++;
          }
        }
      }

      // Run validation
      const validationResult = await this.validateDeepFocusData();
      diagnostics.validation = validationResult.validation;

      // Get sync status
      const syncResult = await this.getSyncDeepFocusStatus();
      diagnostics.sync = syncResult.status;

      // Performance measurement
      diagnostics.performance.diagnosticsGenerationTime = performance.now() - startTime;
      
      // Test storage performance
      const storageTestStart = performance.now();
      await chrome.storage.local.get(['deepFocusSession']);
      diagnostics.performance.storageReadTime = performance.now() - storageTestStart;

      console.log('✅ Deep focus diagnostics generated:', {
        totalSessions: diagnostics.sessions.total,
        validationErrors: diagnostics.validation?.errors?.length || 0,
        performanceMs: Math.round(diagnostics.performance.diagnosticsGenerationTime)
      });

      return { success: true, diagnostics };

    } catch (error) {
      console.error('❌ Deep focus diagnostics failed:', error);
      return { 
        success: false, 
        error: error.message,
        partialDiagnostics: { timestamp: Date.now(), error: error.message }
      };
    }
  }

  /**
   * Get Deep Focus sessions for a date range (SURGICAL FIX for integration bug)
   */
  async getSessionsByDateRange(startDate, endDate) {
    try {
      console.log(`🔍 Getting sessions for date range: ${startDate} to ${endDate}`);
      
      const storage = await chrome.storage.local.get(['deepFocusSession']);
      const allSessions = storage.deepFocusSession || {};
      
      const rangeStart = new Date(startDate);
      const rangeEnd = new Date(endDate);
      rangeEnd.setHours(23, 59, 59, 999); // Include full end date
      
      const sessionsInRange = [];
      
      for (const [date, sessions] of Object.entries(allSessions)) {
        const dateObj = new Date(date);
        if (dateObj >= rangeStart && dateObj <= rangeEnd) {
          sessionsInRange.push(...sessions.map(session => ({ ...session, date })));
        }
      }
      
      // Sort by date and start time (most recent first)
      sessionsInRange.sort((a, b) => {
        const aTime = new Date(a.date).getTime() + (a.startTime || 0);
        const bTime = new Date(b.date).getTime() + (b.startTime || 0);
        return bTime - aTime;
      });
      
      console.log(`✅ Found ${sessionsInRange.length} sessions in date range`);
      return sessionsInRange;
      
    } catch (error) {
      console.error('❌ Error getting sessions by date range:', error);
      return [];
    }
  }

  /**
   * Get last N Deep Focus sessions (SURGICAL FIX for integration bug)
   */
  async getLast10Sessions() {
    try {
      console.log('🔍 Getting last 10 deep focus sessions');
      
      const storage = await chrome.storage.local.get(['deepFocusSession']);
      const allSessions = storage.deepFocusSession || {};
      
      const allSessionsWithDate = [];
      
      // Flatten all sessions with their dates
      for (const [date, sessions] of Object.entries(allSessions)) {
        sessions.forEach(session => {
          allSessionsWithDate.push({
            ...session,
            date,
            sortKey: new Date(date).getTime() + (session.startTime || 0)
          });
        });
      }
      
      // Sort by date and start time (most recent first) and take last 10
      const last10Sessions = allSessionsWithDate
        .sort((a, b) => b.sortKey - a.sortKey)
        .slice(0, 10)
        .map(({ sortKey, ...session }) => session); // Remove sortKey from response
      
      console.log(`✅ Retrieved ${last10Sessions.length} of last 10 sessions`);
      return last10Sessions;
      
    } catch (error) {
      console.error('❌ Error getting last 10 sessions:', error);
      return [];
    }
  }

  /**
   * Get recent 7 days Deep Focus sessions (SURGICAL FIX for integration bug)
   */
  async getRecent7DaysSessions() {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 7);
      
      console.log(`🔍 Getting sessions for recent 7 days: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
      
      return await this.getSessionsByDateRange(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );
      
    } catch (error) {
      console.error('❌ Error getting recent 7 days sessions:', error);
      return [];
    }
  }

  /**
   * Get all Deep Focus sessions (SURGICAL FIX for integration bug)
   */
  async getAllSessions() {
    try {
      console.log('🔍 Getting all deep focus sessions');
      
      const storage = await chrome.storage.local.get(['deepFocusSession']);
      const allSessions = storage.deepFocusSession || {};
      
      const allSessionsFlat = [];
      
      for (const [date, sessions] of Object.entries(allSessions)) {
        sessions.forEach(session => {
          allSessionsFlat.push({ ...session, date });
        });
      }
      
      // Sort by date and start time (most recent first)
      allSessionsFlat.sort((a, b) => {
        const aTime = new Date(a.date).getTime() + (a.startTime || 0);
        const bTime = new Date(b.date).getTime() + (b.startTime || 0);
        return bTime - aTime;
      });
      
      console.log(`✅ Retrieved ${allSessionsFlat.length} total sessions`);
      return allSessionsFlat;
      
    } catch (error) {
      console.error('❌ Error getting all sessions:', error);
      return [];
    }
  }

  /**
   * Get today's Deep Focus sessions (SURGICAL FIX for integration bug)
   */
  async getTodaySessions() {
    try {
      const today = new Date().toISOString().split('T')[0];
      console.log(`🔍 Getting today's sessions for: ${today}`);
      
      return await this.getDeepFocusSessionsForDate(today);
      
    } catch (error) {
      console.error('❌ Error getting today sessions:', error);
      return [];
    }
  }

  /**
   * Get today's stats (for getTodayStats handler)
   * Aggregates site usage sessions into stats format
   */
  async getTodayStats() {
    try {
      console.log('📊 Getting today stats...');
      const today = new Date().toISOString().split('T')[0];
      
      const storage = await chrome.storage.local.get(['siteUsageSession']);
      const sessions = storage.siteUsageSession || {};
      
      const todayData = sessions[today] || [];
      
      // Calculate basic stats
      const totalSessions = todayData.length;
      const totalTime = todayData.reduce((acc, session) => acc + (session.duration || 0), 0);
      const uniqueDomains = new Set(todayData.map(session => session.domain)).size;
      
      const stats = {
        totalSessions,
        totalTimeSeconds: totalTime,
        totalTimeMinutes: Math.round(totalTime / 60),
        uniqueDomains,
        sessionsToday: todayData
      };
      
      console.log('✅ Today stats calculated:', stats);
      return stats;
      
    } catch (error) {
      console.error('❌ Error getting today stats:', error);
      return {
        totalSessions: 0,
        totalTimeSeconds: 0,
        totalTimeMinutes: 0,
        uniqueDomains: 0,
        sessionsToday: []
      };
    }
  }

  /**
   * Get last 10 deep focus sessions
   */
  async getLast10DeepFocusSessions() {
    try {
      console.log('🔍 Getting last 10 deep focus sessions...');
      
      const storage = await chrome.storage.local.get(['deepFocusSession']);
      const allSessions = storage.deepFocusSession || {};
      
      // Flatten all sessions with date information
      const allSessionsFlat = [];
      for (const [date, sessions] of Object.entries(allSessions)) {
        sessions.forEach(session => {
          allSessionsFlat.push({ 
            ...session, 
            utcDate: date,
            createdAt: session.createdAt || session.startTimeUTC
          });
        });
      }
      
      // Sort by creation time (most recent first)
      allSessionsFlat.sort((a, b) => {
        const aTime = new Date(a.createdAt || a.startTimeUTC).getTime();
        const bTime = new Date(b.createdAt || b.startTimeUTC).getTime();
        return bTime - aTime;
      });
      
      // Take the last 10 sessions
      const last10Sessions = allSessionsFlat.slice(0, 10);
      
      console.log(`✅ Retrieved ${last10Sessions.length} recent sessions`);
      return last10Sessions;
      
    } catch (error) {
      console.error('❌ Error getting last 10 deep focus sessions:', error);
      return [];
    }
  }

  /**
   * Get all deep focus sessions
   */
  async getAllDeepFocusSessions() {
    try {
      console.log('🔍 Getting all deep focus sessions...');
      
      const storage = await chrome.storage.local.get(['deepFocusSession']);
      const allSessions = storage.deepFocusSession || {};
      
      // Flatten all sessions with date information
      const allSessionsFlat = [];
      for (const [date, sessions] of Object.entries(allSessions)) {
        sessions.forEach(session => {
          allSessionsFlat.push({ 
            ...session, 
            utcDate: date,
            createdAt: session.createdAt || session.startTimeUTC
          });
        });
      }
      
      // Sort by creation time (most recent first)
      allSessionsFlat.sort((a, b) => {
        const aTime = new Date(a.createdAt || a.startTimeUTC).getTime();
        const bTime = new Date(b.createdAt || b.startTimeUTC).getTime();
        return bTime - aTime;
      });
      
      console.log(`✅ Retrieved ${allSessionsFlat.length} total sessions`);
      return allSessionsFlat;
      
    } catch (error) {
      console.error('❌ Error getting all deep focus sessions:', error);
      return [];
    }
  }

  /**
   * Get today's deep focus sessions
   */
  async getTodayDeepFocusSessions() {
    try {
      console.log('🔍 Getting today deep focus sessions...');
      const today = new Date().toISOString().split('T')[0];
      
      const storage = await chrome.storage.local.get(['deepFocusSession']);
      const allSessions = storage.deepFocusSession || {};
      
      const todaySessions = allSessions[today] || [];
      
      console.log(`✅ Retrieved ${todaySessions.length} sessions for ${today}`);
      return todaySessions;
      
    } catch (error) {
      console.error('❌ Error getting today deep focus sessions:', error);
      return [];
    }
  }

  /**
   * Get recent 7 days deep focus sessions
   */
  async getRecent7DaysDeepFocusSessions() {
    try {
      console.log('🔍 Getting recent 7 days deep focus sessions...');
      
      const storage = await chrome.storage.local.get(['deepFocusSession']);
      const allSessions = storage.deepFocusSession || {};
      
      // Calculate date range (last 7 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 7);
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      const recentSessions = [];
      for (const [date, sessions] of Object.entries(allSessions)) {
        if (date >= startDateStr && date <= endDateStr) {
          sessions.forEach(session => {
            recentSessions.push({ ...session, utcDate: date });
          });
        }
      }
      
      // Sort by date and start time (most recent first)
      recentSessions.sort((a, b) => {
        const aTime = new Date(a.createdAt || a.startTimeUTC).getTime();
        const bTime = new Date(b.createdAt || b.startTimeUTC).getTime();
        return bTime - aTime;
      });
      
      console.log(`✅ Retrieved ${recentSessions.length} sessions from last 7 days`);
      return recentSessions;
      
    } catch (error) {
      console.error('❌ Error getting recent 7 days sessions:', error);
      return [];
    }
  }

  /**
   * Get deep focus sessions for date range
   */
  async getDeepFocusSessionsForDateRange(startDate, endDate) {
    try {
      console.log(`🔍 Getting deep focus sessions for range: ${startDate} to ${endDate}`);
      
      const storage = await chrome.storage.local.get(['deepFocusSession']);
      const allSessions = storage.deepFocusSession || {};
      
      const rangeSessions = [];
      for (const [date, sessions] of Object.entries(allSessions)) {
        if (date >= startDate && date <= endDate) {
          sessions.forEach(session => {
            rangeSessions.push({ ...session, utcDate: date });
          });
        }
      }
      
      // Sort by date and start time (most recent first)
      rangeSessions.sort((a, b) => {
        const aTime = new Date(a.createdAt || a.startTimeUTC).getTime();
        const bTime = new Date(b.createdAt || b.startTimeUTC).getTime();
        return bTime - aTime;
      });
      
      console.log(`✅ Retrieved ${rangeSessions.length} sessions for date range`);
      return rangeSessions;
      
    } catch (error) {
      console.error('❌ Error getting sessions for date range:', error);
      return [];
    }
  }
}

// Make StorageManager globally available for service worker
self.StorageManager = StorageManager;