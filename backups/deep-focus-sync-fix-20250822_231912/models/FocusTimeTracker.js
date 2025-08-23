/**
 * FocusTimeTracker - Central Coordinator for Deep Focus Functionality
 * Orchestrates all Deep Focus components and ensures proper coordination
 * Based on commit 3643c8e architecture
 */

class FocusTimeTracker {
  constructor() {
    this.initialized = false;
    this.stateManager = null;
    this.storageManager = null;
    this.blockingManager = null;
    
    // Site usage tracking properties (used by current tracking system)
    this.currentTab = null;
    this.startTime = null;
    this.isTracking = false;
    this.overrideManager = null;
    this.lastActivityTime = Date.now();
    this.activityCheckInterval = null;
    this.inactivityThreshold = 5 * 60 * 1000; // 5 minutes
    this.cleanupInterval = null;
    this.userSyncInterval = null;
    this.lastUserSync = null;
    this.currentUserId = null;
    this.userInfo = null;
    
    // Set global reference for other components
    self.focusTimeTracker = this;
    
    console.log('🚀 FocusTimeTracker coordinator created');
  }

  /**
   * Initialize the FocusTimeTracker with all dependencies
   */
  async initialize() {
    try {
      console.log('🔄 Initializing FocusTimeTracker coordinator...');
      
      // Wait for dependencies to be available (up to 5 seconds)
      await this.waitForDependencies();
      
      // Initialize StateManager first
      if (typeof StateManager !== 'undefined') {
        this.stateManager = new StateManager();
        await this.stateManager.initialize();
        console.log('✅ StateManager integrated with FocusTimeTracker');
      } else {
        throw new Error('StateManager not available');
      }

      // Integrate existing StorageManager
      if (typeof storageManager !== 'undefined' && storageManager) {
        this.storageManager = storageManager;
        console.log('✅ StorageManager integrated with FocusTimeTracker');
      } else {
        throw new Error('StorageManager not available');
      }

      // Integrate existing BlockingManager
      if (typeof blockingManager !== 'undefined' && blockingManager) {
        this.blockingManager = blockingManager;
        console.log('✅ BlockingManager integrated with FocusTimeTracker');
      } else {
        throw new Error('BlockingManager not available');
      }

      // Set up cross-component references
      if (this.blockingManager && this.blockingManager.setStateManager) {
        this.blockingManager.setStateManager(this.stateManager);
        console.log('✅ StateManager reference set in BlockingManager');
      }

      this.initialized = true;
      console.log('✅ FocusTimeTracker coordinator fully initialized');
      
      return true;
      
    } catch (error) {
      console.error('❌ FocusTimeTracker initialization failed:', error);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Wait for dependencies to be available
   */
  async waitForDependencies(maxWaitMs = 5000) {
    const startTime = Date.now();
    const checkInterval = 100; // Check every 100ms
    
    while (Date.now() - startTime < maxWaitMs) {
      // Check for classes being defined and global instances being available
      const stateManagerAvailable = typeof StateManager !== 'undefined';
      const storageManagerAvailable = (typeof storageManager !== 'undefined' && storageManager !== null);
      const blockingManagerAvailable = (typeof blockingManager !== 'undefined' && blockingManager !== null);
      
      console.log(`🔍 Dependencies check - StateManager: ${stateManagerAvailable}, StorageManager: ${storageManagerAvailable}, BlockingManager: ${blockingManagerAvailable}`);
      
      if (stateManagerAvailable && storageManagerAvailable && blockingManagerAvailable) {
        console.log('✅ All dependencies available');
        return true;
      }
      
      console.log('⏳ Waiting for dependencies...');
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    throw new Error('Timeout waiting for dependencies');
  }

  /**
   * Central message handler - coordinates all Deep Focus messages
   */
  async handleMessage(message, sender, sendResponse) {
    try {
      console.log('📨 FocusTimeTracker handling message:', message.type);

      // Ensure we're initialized
      if (!this.initialized) {
        console.error('❌ FocusTimeTracker not initialized');
        sendResponse({ success: false, error: 'FocusTimeTracker not initialized' });
        return;
      }

      switch (message.type) {
        case 'TOGGLE_FOCUS_MODE':
          await this.handleToggleFocusMode(message, sendResponse);
          break;

        case 'ENABLE_FOCUS_MODE':
          await this.handleEnableFocusMode(message, sendResponse);
          break;

        case 'DISABLE_FOCUS_MODE':
          await this.handleDisableFocusMode(message, sendResponse);
          break;

        case 'GET_FOCUS_STATE':
          await this.handleGetFocusState(message, sendResponse);
          break;

        case 'GET_FOCUS_STATS':
          await this.handleGetFocusStats(message, sendResponse);
          break;

        case 'CREATE_DEEP_FOCUS_SESSION':
          await this.handleCreateDeepFocusSession(message, sendResponse);
          break;

        case 'COMPLETE_DEEP_FOCUS_SESSION':
          await this.handleCompleteDeepFocusSession(message, sendResponse);
          break;

        case 'GET_LOCAL_DEEP_FOCUS_TIME':
          await this.handleGetLocalDeepFocusTime(message, sendResponse);
          break;

        case 'UPDATE_DEEP_FOCUS_SESSION':
          await this.handleUpdateDeepFocusSession(message, sendResponse);
          break;

        case 'GET_DEEP_FOCUS_SESSIONS':
          await this.handleGetDeepFocusSessions(message, sendResponse);
          break;

        case 'DELETE_DEEP_FOCUS_SESSION':
          await this.handleDeleteDeepFocusSession(message, sendResponse);
          break;

        default:
          // Not a Deep Focus message, ignore
          return false;
      }
      
      return true;

    } catch (error) {
      console.error('❌ FocusTimeTracker message handling error:', error);
      sendResponse({ success: false, error: error.message });
      return true;
    }
  }

  /**
   * Handle focus mode toggle with full coordination
   */
  async handleToggleFocusMode(message, sendResponse) {
    try {
      console.log('🔄 Coordinated focus mode toggle...');
      
      const toggleResult = await this.blockingManager.toggleFocusMode();
      
      // Update central state
      await this.stateManager.dispatch({
        type: 'FOCUS_MODE_CHANGED',
        payload: { 
          focusMode: toggleResult.focusMode,
          sessionId: toggleResult.sessionId,
          focusStartTime: toggleResult.focusStartTime
        }
      });

      // Broadcast state change with proper timing
      setTimeout(() => {
        this.broadcastFocusStateChange(toggleResult.focusMode, {
          sessionId: toggleResult.sessionId,
          source: 'toggle'
        });
      }, 50);

      console.log('✅ Coordinated focus mode toggle completed:', toggleResult.focusMode);
      sendResponse({
        success: true,
        focusMode: toggleResult.focusMode,
        sessionId: toggleResult.sessionId,
        message: toggleResult.focusMode ? 'Deep Focus mode activated' : 'Deep Focus mode deactivated'
      });

    } catch (error) {
      console.error('❌ Focus mode toggle error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle enable focus mode with coordination
   */
  async handleEnableFocusMode(message, sendResponse) {
    try {
      if (!this.blockingManager.focusMode) {
        const result = await this.blockingManager.setFocusMode(true);
        await this.stateManager.dispatch({
          type: 'FOCUS_MODE_CHANGED',
          payload: { focusMode: true, sessionId: result.sessionId }
        });

        this.broadcastFocusStateChange(true, { sessionId: result.sessionId });
        sendResponse({ success: true, focusMode: true, sessionId: result.sessionId });
      } else {
        sendResponse({ success: true, focusMode: true, message: 'Already enabled' });
      }
    } catch (error) {
      console.error('❌ Enable focus mode error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle disable focus mode with coordination
   */
  async handleDisableFocusMode(message, sendResponse) {
    try {
      if (this.blockingManager.focusMode) {
        const result = await this.blockingManager.setFocusMode(false);
        await this.stateManager.dispatch({
          type: 'FOCUS_MODE_CHANGED',
          payload: { focusMode: false }
        });

        this.broadcastFocusStateChange(false);
        sendResponse({ success: true, focusMode: false });
      } else {
        sendResponse({ success: true, focusMode: false, message: 'Already disabled' });
      }
    } catch (error) {
      console.error('❌ Disable focus mode error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle get focus state with coordination
   */
  async handleGetFocusState(message, sendResponse) {
    try {
      const state = this.stateManager.getState();
      const blockingState = this.blockingManager.getFocusStats();
      
      // Use BlockingManager as the source of truth for focusMode
      const actualFocusMode = this.blockingManager.focusMode;
      
      console.log('🔍 GET_FOCUS_STATE - State comparison:', {
        stateManagerFocusMode: state.focusMode,
        blockingManagerFocusMode: actualFocusMode,
        usingActualFocusMode: actualFocusMode
      });
      
      sendResponse({
        success: true,
        focusMode: actualFocusMode,
        data: {
          focusMode: actualFocusMode,  // Popup expects this field
          isActive: actualFocusMode,   // Keep for compatibility
          sessionId: state.currentSessionId,
          focusStartTime: state.focusStartTime,
          focusTime: blockingState.focusTime || 0
        }
      });
    } catch (error) {
      console.error('❌ Get focus state error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle get focus stats with coordination
   */
  async handleGetFocusStats(message, sendResponse) {
    try {
      const stats = this.blockingManager.getFocusStats();
      sendResponse({ success: true, data: stats });
    } catch (error) {
      console.error('❌ Get focus stats error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle create deep focus session with coordination
   */
  async handleCreateDeepFocusSession(message, sendResponse) {
    try {
      const sessionId = await this.storageManager.createDeepFocusSession();
      
      await this.stateManager.dispatch({
        type: 'SESSION_CREATED',
        payload: { sessionId, startTime: Date.now() }
      });

      sendResponse({
        success: true,
        sessionId: sessionId,
        data: { sessionId },
        message: 'Deep focus session created'
      });
    } catch (error) {
      console.error('❌ Create session error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle complete deep focus session with coordination
   */
  async handleCompleteDeepFocusSession(message, sendResponse) {
    try {
      const sessionData = message.payload || {};
      const result = await this.storageManager.completeDeepFocusSession(
        this.stateManager.getStateProperty('currentSessionId'),
        sessionData.duration
      );

      await this.stateManager.dispatch({
        type: 'SESSION_COMPLETED',
        payload: {}
      });

      sendResponse({
        success: true,
        completed: result,
        data: { completed: result },
        message: 'Deep focus session completed'
      });
    } catch (error) {
      console.error('❌ Complete session error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle get local deep focus time with coordination
   */
  async handleGetLocalDeepFocusTime(message, sendResponse) {
    try {
      const sessionData = await this.storageManager.getLocalDeepFocusTime();
      const timeMs = sessionData.minutes * 60 * 1000;
      
      sendResponse({
        success: true,
        time: timeMs,
        timeMinutes: sessionData.minutes,
        data: { 
          minutes: sessionData.minutes,
          sessions: sessionData.sessions,
          date: sessionData.date 
        },
        message: 'Local deep focus time retrieved successfully'
      });
    } catch (error) {
      console.error('❌ Get local deep focus time error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle UPDATE_DEEP_FOCUS_SESSION - Update session duration in real-time
   */
  async handleUpdateDeepFocusSession(message, sendResponse) {
    try {
      const { sessionId, duration } = message.payload || {};
      
      // Validate input
      if (!sessionId) {
        return sendResponse({ success: false, error: 'Session ID is required' });
      }
      
      if (typeof duration !== 'number' || duration < 0) {
        return sendResponse({ success: false, error: 'Duration must be a non-negative number' });
      }
      
      // Update the session duration
      const updated = await this.storageManager.updateDeepFocusSessionDuration(sessionId, Math.floor(duration));
      
      if (updated) {
        // Update central state
        await this.stateManager.dispatch({
          type: 'SESSION_UPDATED',
          payload: { sessionId, duration }
        });
        
        sendResponse({
          success: true,
          sessionId: sessionId,
          duration: Math.floor(duration),
          message: 'Deep focus session updated successfully'
        });
      } else {
        sendResponse({ success: false, error: 'Session not found or update failed' });
      }
      
    } catch (error) {
      console.error('❌ Update deep focus session error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle GET_DEEP_FOCUS_SESSIONS - Retrieve sessions by date range
   */
  async handleGetDeepFocusSessions(message, sendResponse) {
    try {
      const { startDate, endDate, includeActive = false } = message.payload || {};
      
      let sessions = [];
      
      if (startDate && endDate) {
        // Get sessions by date range
        sessions = await this.storageManager.getSessionsByDateRange(startDate, endDate);
      } else if (startDate) {
        // Get sessions for a specific date
        sessions = await this.storageManager.getDeepFocusSessionsForDate(startDate);
      } else {
        // Get today's sessions by default
        const today = new Date().toISOString().split('T')[0];
        sessions = await this.storageManager.getDeepFocusSessionsForDate(today);
      }
      
      // Filter active sessions if requested
      if (includeActive) {
        const activeSessions = await this.storageManager.getAllActiveSessions();
        // Merge and deduplicate
        const allSessions = [...sessions];
        activeSessions.forEach(activeSession => {
          if (!allSessions.find(s => s.id === activeSession.id)) {
            allSessions.push(activeSession);
          }
        });
        sessions = allSessions;
      }
      
      // Calculate summary statistics
      const totalDuration = sessions.reduce((sum, session) => sum + (session.duration || 0), 0);
      const completedSessions = sessions.filter(s => s.status === 'completed');
      const activeSessions = sessions.filter(s => s.status === 'active');
      
      sendResponse({
        success: true,
        sessions: sessions,
        totalSessions: sessions.length,
        totalDuration: totalDuration,
        completedSessions: completedSessions.length,
        activeSessions: activeSessions.length,
        dateRange: startDate && endDate ? { start: startDate, end: endDate } : null,
        message: `Retrieved ${sessions.length} deep focus sessions`
      });
      
    } catch (error) {
      console.error('❌ Get deep focus sessions error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle DELETE_DEEP_FOCUS_SESSION - Remove invalid/test sessions
   */
  async handleDeleteDeepFocusSession(message, sendResponse) {
    try {
      const { sessionId, reason = 'manual_deletion' } = message.payload || {};
      
      // Validate input
      if (!sessionId) {
        return sendResponse({ success: false, error: 'Session ID is required' });
      }
      
      // Security check - only allow deletion of certain types of sessions
      const validReasons = ['test_session', 'corrupted_data', 'manual_deletion', 'admin_cleanup'];
      if (!validReasons.includes(reason)) {
        return sendResponse({ success: false, error: 'Invalid deletion reason' });
      }
      
      // Get current sessions to find the target session
      const storage = await chrome.storage.local.get(['deepFocusSession']);
      const allSessions = storage.deepFocusSession || {};
      
      let sessionFound = false;
      let deletedSession = null;
      
      // Find and remove the session
      for (const date in allSessions) {
        const sessions = allSessions[date];
        const sessionIndex = sessions.findIndex(s => s.id === sessionId);
        
        if (sessionIndex !== -1) {
          deletedSession = sessions[sessionIndex];
          
          // Additional security checks
          if (deletedSession.status === 'active' && reason !== 'admin_cleanup') {
            return sendResponse({ success: false, error: 'Cannot delete active sessions without admin privileges' });
          }
          
          // Remove the session
          sessions.splice(sessionIndex, 1);
          
          // Remove the date entry if no sessions remain
          if (sessions.length === 0) {
            delete allSessions[date];
          }
          
          sessionFound = true;
          break;
        }
      }
      
      if (!sessionFound) {
        return sendResponse({ success: false, error: 'Session not found' });
      }
      
      // Save updated sessions
      await chrome.storage.local.set({ deepFocusSession: allSessions });
      
      // Update central state
      await this.stateManager.dispatch({
        type: 'SESSION_DELETED',
        payload: { sessionId, reason }
      });
      
      console.log(`🗑️ Deleted deep focus session ${sessionId} (reason: ${reason})`);
      
      sendResponse({
        success: true,
        sessionId: sessionId,
        deletedSession: {
          id: deletedSession.id,
          duration: deletedSession.duration,
          status: deletedSession.status,
          startTime: deletedSession.startTime
        },
        reason: reason,
        message: 'Deep focus session deleted successfully'
      });
      
    } catch (error) {
      console.error('❌ Delete deep focus session error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Broadcast focus state change to all listeners with proper timing
   */
  broadcastFocusStateChange(isActive, options = {}) {
    try {
      console.log('📡 Broadcasting focus state change:', isActive, options);

      // Send to web app content scripts with proper timing
      setTimeout(async () => {
        try {
          const tabs = await chrome.tabs.query({url: ['*://app.make10000hours.com/*', '*://localhost:*/*']});
          for (const tab of tabs) {
            chrome.tabs.sendMessage(tab.id, {
              type: 'EXTENSION_FOCUS_STATE_CHANGED',
              payload: {
                isActive: isActive,
                sessionId: options.sessionId,
                source: options.source || 'coordinator',
                timestamp: Date.now()
              }
            }).catch(() => {
              console.debug('📝 Could not notify tab', tab.id, 'of focus state change');
            });
          }
          console.log('📡 Broadcasted focus state to', tabs.length, 'web app tabs');
        } catch (error) {
          console.warn('⚠️ Broadcasting error:', error);
        }
      }, 50); // 50ms delay for proper timing

      // Also emit via ExtensionEventBus
      if (typeof ExtensionEventBus !== 'undefined') {
        ExtensionEventBus.emit(ExtensionEventBus.EVENTS.FOCUS_STATE_CHANGE, {
          isActive: isActive,
          sessionId: options.sessionId
        }).catch(error => {
          console.warn('⚠️ ExtensionEventBus broadcasting error:', error);
        });
      }

    } catch (error) {
      console.error('❌ Broadcasting error:', error);
    }
  }

  /**
   * Get current user ID from state or property
   */
  getCurrentUserId() {
    // First check if we have it as a direct property
    if (this.currentUserId) {
      return this.currentUserId;
    }
    // Fallback to StateManager if available
    const userInfo = this.stateManager?.getStateProperty('userInfo');
    return userInfo?.userId || null;
  }
}

// Make FocusTimeTracker globally available for service worker
self.FocusTimeTracker = FocusTimeTracker; 