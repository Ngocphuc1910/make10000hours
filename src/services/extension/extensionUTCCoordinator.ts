import { utcMonitoring } from '../monitoring';
import { utcFeatureFlags } from '../featureFlags';
import { timezoneUtils } from '../../utils/timezoneUtils';
import { transitionQueryService } from '../transitionService';
import type { ExtensionMessage } from '../../types/extension';

interface ExtensionDataConflict {
  key: string;
  extensionData: any;
  webAppData: any;
  conflictType: 'timestamp' | 'content' | 'structure';
  severity: 'low' | 'medium' | 'high';
}

interface SyncResponse {
  success: boolean;
  conflicts?: ExtensionDataConflict[];
  updates?: Record<string, any>;
  message?: string;
}

export class ExtensionUTCCoordinator {
  private extensionConnected: boolean = false;
  private userTimezone: string = 'UTC';
  private userId: string | null = null;
  private conflictResolutionStrategy: 'prefer_webapp' | 'prefer_extension' | 'merge' = 'prefer_webapp';

  constructor() {
    try {
      this.setupMessageHandlers();
    } catch (error) {
      console.warn('Failed to setup extension message handlers:', error);
    }
  }

  /**
   * Initialize coordinator with user context
   */
  async initialize(userId: string, userTimezone: string): Promise<void> {
    this.userId = userId;
    this.userTimezone = userTimezone;

    // Check if UTC extension features are enabled
    const utcEnabled = utcFeatureFlags.isFeatureEnabled('utcExtensionIntegration', userId);
    
    if (utcEnabled) {
      await this.establishExtensionConnection();
      console.log('🤝 Extension UTC coordinator initialized for user:', userId);
    } else {
      console.log('📄 Extension UTC coordination disabled for user:', userId);
    }

    utcMonitoring.trackOperation('extension_coordinator_initialize', utcEnabled);
  }

  /**
   * Establish connection with extension
   */
  private async establishExtensionConnection(): Promise<void> {
    try {
      if (!chrome?.runtime) {
        console.warn('Chrome runtime not available');
        return;
      }

      // Send initialization message to extension
      const response = await this.sendMessageToExtension({
        type: 'UTC_COORDINATOR_INIT',
        data: {
          userId: this.userId,
          userTimezone: this.userTimezone,
          utcEnabled: true,
          transitionMode: utcFeatureFlags.getTransitionMode(this.userId!),
          conflictStrategy: this.conflictResolutionStrategy
        }
      });

      if (response && response.success) {
        this.extensionConnected = true;
        console.log('✅ Extension UTC coordination established');
        
        // Send current timezone context
        await this.sendTimezoneContext();
      }

    } catch (error) {
      console.warn('⚠️ Failed to establish extension connection:', error);
      this.extensionConnected = false;
    }
  }

  /**
   * Handle timezone changes and coordinate with extension
   */
  async handleTimezoneChange(oldTimezone: string, newTimezone: string): Promise<void> {
    if (!this.extensionConnected || !this.userId) return;

    try {
      this.userTimezone = newTimezone;

      await this.sendMessageToExtension({
        type: 'TIMEZONE_CHANGE_COORDINATION',
        data: {
          userId: this.userId,
          oldTimezone,
          newTimezone,
          timestampUTC: timezoneUtils.getCurrentUTC()
        }
      });

      console.log('🌍 Coordinated timezone change with extension:', oldTimezone, '->', newTimezone);
      utcMonitoring.trackOperation('extension_timezone_coordination', true);

    } catch (error) {
      console.error('❌ Failed to coordinate timezone change:', error);
      utcMonitoring.trackOperation('extension_timezone_coordination', false);
    }
  }

  /**
   * Sync data with extension to resolve conflicts
   */
  async syncDataWithExtension(): Promise<SyncResponse> {
    if (!this.extensionConnected || !this.userId) {
      return { success: false, message: 'Extension not connected' };
    }

    try {
      // Get recent web app data for comparison
      const webAppData = await this.getRecentWebAppData();

      // Request extension data and initiate sync
      const response = await this.sendMessageToExtension({
        type: 'UTC_DATA_SYNC_REQUEST',
        data: {
          userId: this.userId,
          webAppData,
          timezone: this.userTimezone,
          syncTimestamp: timezoneUtils.getCurrentUTC()
        }
      });

      if (response && response.success) {
        return await this.processSyncResponse(response.data);
      }

      return { success: false, message: 'Extension sync failed' };

    } catch (error) {
      console.error('❌ Data sync with extension failed:', error);
      utcMonitoring.trackOperation('extension_data_sync', false);
      return { success: false, message: error instanceof Error ? error.message : 'Sync failed' };
    }
  }

  /**
   * Get recent web app data for sync
   */
  private async getRecentWebAppData(): Promise<Record<string, any>> {
    if (!this.userId) return {};

    try {
      const today = new Date();
      const webAppData: Record<string, any> = {};

      // Get last 7 days of work sessions (UTC)
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        try {
          const sessions = await transitionQueryService.getWorkSessionsForDate(this.userId, dateStr);
          if (sessions.length > 0) {
            webAppData[`workSessions_utc_${dateStr}`] = sessions;
          }
        } catch (error) {
          console.warn(`Failed to get work sessions for ${dateStr}:`, error);
        }
      }

      console.log('📊 Retrieved web app data for sync:', Object.keys(webAppData).length, 'entries');
      return webAppData;

    } catch (error) {
      console.error('Failed to get recent web app data:', error);
      return {};
    }
  }

  /**
   * Process sync response from extension
   */
  private async processSyncResponse(syncData: any): Promise<SyncResponse> {
    const conflicts: ExtensionDataConflict[] = [];
    const updates: Record<string, any> = {};

    // Analyze extension data for conflicts
    if (syncData.extensionData) {
      const extensionKeys = Object.keys(syncData.extensionData);
      
      for (const key of extensionKeys) {
        const conflict = await this.detectDataConflict(key, syncData.extensionData[key]);
        if (conflict) {
          conflicts.push(conflict);
        }
      }
    }

    // Resolve conflicts if any
    if (conflicts.length > 0) {
      console.log('⚠️ Detected', conflicts.length, 'data conflicts with extension');
      const resolutions = await this.resolveConflicts(conflicts);
      Object.assign(updates, resolutions);
    }

    const result: SyncResponse = {
      success: true,
      conflicts: conflicts.length > 0 ? conflicts : undefined,
      updates: Object.keys(updates).length > 0 ? updates : undefined,
      message: `Sync completed with ${conflicts.length} conflicts resolved`
    };

    utcMonitoring.trackOperation('extension_data_sync', true);
    return result;
  }

  /**
   * Detect data conflicts between extension and web app
   */
  private async detectDataConflict(key: string, extensionData: any): Promise<ExtensionDataConflict | null> {
    // Convert extension key format to web app equivalent
    const webAppKey = this.convertExtensionKeyToWebApp(key);
    if (!webAppKey) return null;

    try {
      // Get equivalent data from web app
      const webAppData = await this.getWebAppDataByKey(webAppKey);
      if (!webAppData) return null;

      // Compare data structures and timestamps
      const conflictType = this.analyzeConflictType(extensionData, webAppData);
      if (!conflictType) return null;

      const severity = this.assessConflictSeverity(extensionData, webAppData, conflictType);

      return {
        key: webAppKey,
        extensionData,
        webAppData,
        conflictType,
        severity
      };

    } catch (error) {
      console.warn('Failed to detect conflict for key:', key, error);
      return null;
    }
  }

  /**
   * Convert extension storage key to web app equivalent
   */
  private convertExtensionKeyToWebApp(extensionKey: string): string | null {
    // Convert extension keys like "dailyStats_utc_2025-01-16" to web app format
    const match = extensionKey.match(/^(dailyStats|deepFocusSessions)_(?:utc_)?(\d{4}-\d{2}-\d{2})$/);
    if (!match) return null;

    const [, type, date] = match;
    
    // Map to web app data types
    switch (type) {
      case 'dailyStats':
        return `websiteUsage_${date}`;
      case 'deepFocusSessions':
        return `workSessions_${date}`;
      default:
        return null;
    }
  }

  /**
   * Get web app data by key
   */
  private async getWebAppDataByKey(key: string): Promise<any> {
    if (!this.userId) return null;

    const match = key.match(/^(\w+)_(\d{4}-\d{2}-\d{2})$/);
    if (!match) return null;

    const [, type, date] = match;

    try {
      switch (type) {
        case 'websiteUsage':
          // Get website usage data from web app (if available)
          return null; // Not implemented in current system
        case 'workSessions':
          return await transitionQueryService.getWorkSessionsForDate(this.userId, date);
        default:
          return null;
      }
    } catch (error) {
      console.warn('Failed to get web app data for key:', key, error);
      return null;
    }
  }

  /**
   * Analyze conflict type between extension and web app data
   */
  private analyzeConflictType(extensionData: any, webAppData: any): ExtensionDataConflict['conflictType'] | null {
    // Check timestamps
    const extTime = this.extractTimestamp(extensionData);
    const webTime = this.extractTimestamp(webAppData);
    
    if (extTime && webTime && Math.abs(extTime - webTime) > 60000) { // 1 minute difference
      return 'timestamp';
    }

    // Check structure differences
    const extKeys = new Set(Object.keys(extensionData || {}));
    const webKeys = new Set(Object.keys(webAppData || {}));
    
    if (extKeys.size !== webKeys.size || ![...extKeys].every(k => webKeys.has(k))) {
      return 'structure';
    }

    // Check content differences
    if (JSON.stringify(extensionData) !== JSON.stringify(webAppData)) {
      return 'content';
    }

    return null;
  }

  /**
   * Extract timestamp from data object
   */
  private extractTimestamp(data: any): number | null {
    if (!data) return null;
    
    const timeFields = ['timestamp', 'createdAt', 'updatedAt', 'lastModified'];
    
    for (const field of timeFields) {
      if (data[field]) {
        const time = new Date(data[field]).getTime();
        if (!isNaN(time)) return time;
      }
    }

    return null;
  }

  /**
   * Assess conflict severity
   */
  private assessConflictSeverity(
    extensionData: any, 
    webAppData: any, 
    conflictType: ExtensionDataConflict['conflictType']
  ): ExtensionDataConflict['severity'] {
    switch (conflictType) {
      case 'timestamp':
        // Timestamp conflicts are usually low severity
        return 'low';
      case 'structure':
        // Structure conflicts are more serious
        return 'high';
      case 'content':
        // Content conflicts depend on the amount of difference
        const extSize = JSON.stringify(extensionData).length;
        const webSize = JSON.stringify(webAppData).length;
        const sizeDiff = Math.abs(extSize - webSize) / Math.max(extSize, webSize);
        
        return sizeDiff > 0.5 ? 'high' : 'medium';
      default:
        return 'medium';
    }
  }

  /**
   * Resolve conflicts using configured strategy
   */
  private async resolveConflicts(conflicts: ExtensionDataConflict[]): Promise<Record<string, any>> {
    const resolutions: Record<string, any> = {};

    for (const conflict of conflicts) {
      let resolution: any;

      switch (this.conflictResolutionStrategy) {
        case 'prefer_webapp':
          resolution = conflict.webAppData;
          break;
        case 'prefer_extension':
          resolution = conflict.extensionData;
          break;
        case 'merge':
          resolution = this.mergeConflictData(conflict);
          break;
        default:
          resolution = conflict.webAppData;
      }

      resolutions[conflict.key] = {
        ...resolution,
        conflictResolved: true,
        conflictStrategy: this.conflictResolutionStrategy,
        resolvedAt: timezoneUtils.getCurrentUTC()
      };
    }

    console.log('🔧 Resolved', Object.keys(resolutions).length, 'conflicts');
    return resolutions;
  }

  /**
   * Merge conflicting data intelligently
   */
  private mergeConflictData(conflict: ExtensionDataConflict): any {
    const { extensionData, webAppData, conflictType } = conflict;

    switch (conflictType) {
      case 'timestamp':
        // For timestamp conflicts, prefer the newer data
        const extTime = this.extractTimestamp(extensionData) || 0;
        const webTime = this.extractTimestamp(webAppData) || 0;
        return webTime > extTime ? webAppData : extensionData;

      case 'content':
        // For content conflicts, merge arrays or prefer web app for objects
        if (Array.isArray(extensionData) && Array.isArray(webAppData)) {
          return this.mergeArrays(extensionData, webAppData);
        }
        return webAppData;

      case 'structure':
        // For structure conflicts, prefer web app data as it's more likely to be correct
        return webAppData;

      default:
        return webAppData;
    }
  }

  /**
   * Merge arrays by combining unique entries
   */
  private mergeArrays(arr1: any[], arr2: any[]): any[] {
    const merged = [...arr2]; // Start with web app data
    const existingIds = new Set(arr2.map(item => item.id || item.sessionId || JSON.stringify(item)));

    arr1.forEach(item => {
      const itemId = item.id || item.sessionId || JSON.stringify(item);
      if (!existingIds.has(itemId)) {
        merged.push(item);
      }
    });

    // Sort by timestamp if available
    return merged.sort((a, b) => {
      const aTime = this.extractTimestamp(a) || 0;
      const bTime = this.extractTimestamp(b) || 0;
      return bTime - aTime; // Newest first
    });
  }

  /**
   * Send timezone context to extension
   */
  private async sendTimezoneContext(): Promise<void> {
    if (!this.extensionConnected || !this.userId) return;

    await this.sendMessageToExtension({
      type: 'TIMEZONE_CONTEXT_UPDATE',
      data: {
        timezone: this.userTimezone,
        utcOffset: timezoneUtils.getTimezoneOffset(this.userTimezone),
        isValidTimezone: timezoneUtils.isValidTimezone(this.userTimezone),
        timestampUTC: timezoneUtils.getCurrentUTC()
      }
    });
  }

  /**
   * Send message to extension
   */
  private async sendMessageToExtension(message: ExtensionMessage): Promise<any> {
    return new Promise((resolve) => {
      if (!chrome?.runtime) {
        resolve(null);
        return;
      }

      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            console.warn('Extension message error:', chrome.runtime.lastError.message);
            resolve(null);
          } else {
            resolve(response);
          }
        });
      } catch (error) {
        console.warn('Failed to send message to extension:', error);
        resolve(null);
      }
    });
  }

  /**
   * Setup message handlers for extension communication
   */
  private setupMessageHandlers(): void {
    if (typeof window === 'undefined') return;
    if (typeof chrome === 'undefined' || !chrome?.runtime?.onMessage?.addListener) return;

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.source !== 'extension') return;

      switch (message.type) {
        case 'UTC_STATUS_QUERY':
          this.handleUTCStatusQuery(sendResponse);
          return true;

        case 'UTC_DATA_SYNC':
          this.handleDataSyncRequest(message.data, sendResponse);
          return true;

        case 'EXTENSION_TIMEZONE_CHANGE':
          this.handleExtensionTimezoneChange(message.data, sendResponse);
          return true;
      }
    });
  }

  /**
   * Handle UTC status query from extension
   */
  private handleUTCStatusQuery(sendResponse: (response: any) => void): void {
    const response = {
      success: true,
      data: {
        utcEnabled: this.userId ? utcFeatureFlags.isFeatureEnabled('utcExtensionIntegration', this.userId) : false,
        userTimezone: this.userTimezone,
        transitionMode: this.userId ? utcFeatureFlags.getTransitionMode(this.userId) : 'disabled',
        userId: this.userId
      }
    };

    sendResponse(response);
  }

  /**
   * Handle data sync request from extension
   */
  private async handleDataSyncRequest(data: any, sendResponse: (response: any) => void): Promise<void> {
    try {
      const syncResult = await this.processSyncResponse(data);
      sendResponse({
        success: true,
        data: syncResult
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed'
      });
    }
  }

  /**
   * Handle timezone change from extension
   */
  private handleExtensionTimezoneChange(data: any, sendResponse: (response: any) => void): void {
    console.log('🌍 Extension reported timezone change:', data);
    
    // Update internal timezone tracking
    this.userTimezone = data.newTimezone;
    
    sendResponse({ success: true });
    utcMonitoring.trackOperation('extension_reported_timezone_change', true);
  }

  /**
   * Get coordinator status
   */
  getStatus(): {
    connected: boolean;
    timezone: string;
    userId: string | null;
    conflictStrategy: string;
  } {
    return {
      connected: this.extensionConnected,
      timezone: this.userTimezone,
      userId: this.userId,
      conflictStrategy: this.conflictResolutionStrategy
    };
  }

  /**
   * Cleanup coordinator
   */
  cleanup(): void {
    this.extensionConnected = false;
    this.userId = null;
    console.log('🧹 Extension UTC coordinator cleaned up');
  }
}

// Create singleton instance
export const extensionUTCCoordinator = new ExtensionUTCCoordinator();