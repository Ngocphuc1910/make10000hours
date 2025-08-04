import { utcMonitoring } from '../monitoring';
import { utcFeatureFlags } from '../featureFlags';
import { timezoneUtils } from '../../utils/timezoneUtils';
import type { ExtensionMessage, ExtensionMessageType } from '../../types/extension';

interface UTCExtensionMessage extends ExtensionMessage {
  timezone?: string;
  timestampUTC?: string;
  localTimestamp?: string;
}

interface DeepFocusSessionUTC {
  sessionId: string;
  userId: string;
  startTimeUTC: string;
  endTimeUTC?: string;
  duration?: number;
  blockedSites: string[];
  distractionAttempts: number;
  timezoneContext: {
    timezone: string;
    source: 'browser' | 'user' | 'detected';
    utcOffset: number;
  };
}

export class ExtensionServiceUTC {
  private extensionId: string;
  private isConnected: boolean = false;
  private currentUserTimezone: string;
  private messageQueue: UTCExtensionMessage[] = [];

  constructor(extensionId: string = '') {
    this.extensionId = extensionId;
    this.currentUserTimezone = timezoneUtils.getCurrentTimezone();
    try {
      this.setupMessageHandlers();
    } catch (error) {
      console.warn('Failed to setup extension message handlers:', error);
    }
  }

  /**
   * Initialize UTC extension service
   */
  async initialize(userId: string, userTimezone?: string): Promise<void> {
    try {
      // Update user timezone
      if (userTimezone) {
        this.currentUserTimezone = userTimezone;
      }

      // Check if UTC features are enabled for user
      const utcEnabled = utcFeatureFlags.isFeatureEnabled('utcExtensionIntegration', userId);
      
      if (!utcEnabled) {
        console.log('UTC extension integration disabled for user:', userId);
        return;
      }

      await this.connectToExtension();
      
      // Send timezone context to extension
      await this.sendTimezoneContext();
      
      utcMonitoring.trackOperation('extension_utc_initialize', true);
      
      console.log('UTC Extension service initialized:', {
        userId,
        timezone: this.currentUserTimezone,
        extensionConnected: this.isConnected
      });
      
    } catch (error) {
      console.error('Failed to initialize UTC extension service:', error);
      utcMonitoring.trackOperation('extension_utc_initialize', false);
      throw error;
    }
  }

  /**
   * Start UTC-aware deep focus session
   */
  async startDeepFocusSession(
    userId: string,
    taskId: string,
    blockedSites: string[] = []
  ): Promise<string> {
    try {
      const sessionId = `utc_focus_${taskId}_${Date.now()}`;
      const startTimeUTC = timezoneUtils.getCurrentUTC();
      const timezoneContext = timezoneUtils.createTimezoneContext(this.currentUserTimezone);

      const message: UTCExtensionMessage = {
        type: 'START_DEEP_FOCUS',
        data: {
          sessionId,
          userId,
          taskId,
          blockedSites,
          startTimeUTC,
          timezoneContext
        },
        timestampUTC: startTimeUTC,
        localTimestamp: timezoneUtils.formatInTimezone(startTimeUTC, this.currentUserTimezone),
        timezone: this.currentUserTimezone
      };

      await this.sendMessage(message);
      
      utcMonitoring.trackOperation('extension_start_focus_session', true);
      
      console.log('Started UTC deep focus session:', {
        sessionId,
        taskId,
        startTimeUTC,
        timezone: this.currentUserTimezone,
        blockedSites: blockedSites.length
      });

      return sessionId;
    } catch (error) {
      console.error('Failed to start deep focus session:', error);
      utcMonitoring.trackOperation('extension_start_focus_session', false);
      throw error;
    }
  }

  /**
   * End deep focus session with UTC timestamps
   */
  async endDeepFocusSession(sessionId: string): Promise<DeepFocusSessionUTC | null> {
    try {
      const endTimeUTC = timezoneUtils.getCurrentUTC();

      const message: UTCExtensionMessage = {
        type: 'END_DEEP_FOCUS',
        data: {
          sessionId,
          endTimeUTC
        },
        timestampUTC: endTimeUTC,
        localTimestamp: timezoneUtils.formatInTimezone(endTimeUTC, this.currentUserTimezone),
        timezone: this.currentUserTimezone
      };

      const response = await this.sendMessage(message);
      
      if (response && response.data) {
        const session: DeepFocusSessionUTC = {
          ...response.data,
          timezoneContext: {
            timezone: this.currentUserTimezone,
            source: 'user',
            utcOffset: timezoneUtils.getTimezoneOffset(this.currentUserTimezone)
          }
        };

        utcMonitoring.trackOperation('extension_end_focus_session', true);
        
        console.log('Ended UTC deep focus session:', {
          sessionId,
          duration: session.duration,
          distractionAttempts: session.distractionAttempts
        });

        return session;
      }

      return null;
    } catch (error) {
      console.error('Failed to end deep focus session:', error);
      utcMonitoring.trackOperation('extension_end_focus_session', false);
      throw error;
    }
  }

  /**
   * Track website usage with UTC timestamps
   */
  async trackWebsiteUsage(
    userId: string,
    url: string,
    duration: number,
    category?: string
  ): Promise<void> {
    try {
      const timestampUTC = timezoneUtils.getCurrentUTC();
      const timezoneContext = timezoneUtils.createTimezoneContext(this.currentUserTimezone);

      const message: UTCExtensionMessage = {
        type: 'TRACK_WEBSITE_USAGE',
        data: {
          userId,
          url,
          duration,
          category,
          timestampUTC,
          timezoneContext
        },
        timestampUTC,
        localTimestamp: timezoneUtils.formatInTimezone(timestampUTC, this.currentUserTimezone),
        timezone: this.currentUserTimezone
      };

      await this.sendMessage(message);
      
      utcMonitoring.trackOperation('extension_track_website_usage', true);
      
    } catch (error) {
      console.error('Failed to track website usage:', error);
      utcMonitoring.trackOperation('extension_track_website_usage', false);
    }
  }

  /**
   * Handle timezone changes during extension usage
   */
  async handleTimezoneChange(newTimezone: string): Promise<void> {
    try {
      const oldTimezone = this.currentUserTimezone;
      this.currentUserTimezone = newTimezone;

      // Notify extension of timezone change
      const message: UTCExtensionMessage = {
        type: 'TIMEZONE_CHANGED',
        data: {
          oldTimezone,
          newTimezone,
          timestampUTC: timezoneUtils.getCurrentUTC()
        },
        timestampUTC: timezoneUtils.getCurrentUTC(),
        localTimestamp: timezoneUtils.formatInTimezone(
          timezoneUtils.getCurrentUTC(),
          newTimezone
        ),
        timezone: newTimezone
      };

      await this.sendMessage(message);
      
      utcMonitoring.trackOperation('extension_timezone_change', true);
      
      console.log('Extension timezone change handled:', {
        old: oldTimezone,
        new: newTimezone
      });
      
    } catch (error) {
      console.error('Failed to handle timezone change:', error);
      utcMonitoring.trackOperation('extension_timezone_change', false);
    }
  }

  /**
   * Get extension status and timezone info
   */
  async getExtensionStatus(): Promise<{
    connected: boolean;
    timezone: string;
    utcSupported: boolean;
    lastSync?: string;
  }> {
    try {
      const message: UTCExtensionMessage = {
        type: 'GET_STATUS',
        data: {},
        timestampUTC: timezoneUtils.getCurrentUTC(),
        timezone: this.currentUserTimezone
      };

      const response = await this.sendMessage(message);
      
      return {
        connected: this.isConnected,
        timezone: this.currentUserTimezone,
        utcSupported: response?.data?.utcSupported || false,
        lastSync: response?.data?.lastSync
      };
      
    } catch (error) {
      console.error('Failed to get extension status:', error);
      return {
        connected: false,
        timezone: this.currentUserTimezone,
        utcSupported: false
      };
    }
  }

  /**
   * Send timezone context to extension
   */
  private async sendTimezoneContext(): Promise<void> {
    const message: UTCExtensionMessage = {
      type: 'TIMEZONE_CONTEXT',
      data: {
        timezone: this.currentUserTimezone,
        utcOffset: timezoneUtils.getTimezoneOffset(this.currentUserTimezone),
        isValidTimezone: timezoneUtils.isValidTimezone(this.currentUserTimezone),
        timezoneSource: 'user'
      },
      timestampUTC: timezoneUtils.getCurrentUTC(),
      localTimestamp: timezoneUtils.formatInTimezone(
        timezoneUtils.getCurrentUTC(),
        this.currentUserTimezone
      ),
      timezone: this.currentUserTimezone
    };

    await this.sendMessage(message);
  }

  /**
   * Connect to Chrome extension
   */
  private async connectToExtension(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!chrome?.runtime) {
        reject(new Error('Chrome runtime not available'));
        return;
      }

      try {
        // Check if extension is installed
        chrome.runtime.sendMessage(
          this.extensionId,
          { type: 'PING' },
          (response) => {
            if (chrome.runtime.lastError) {
              console.warn('Extension not available:', chrome.runtime.lastError.message);
              this.isConnected = false;
              resolve(); // Don't reject, just continue without extension
            } else {
              this.isConnected = true;
              console.log('Connected to UTC-aware extension');
              resolve();
            }
          }
        );
      } catch (error) {
        console.warn('Failed to connect to extension:', error);
        this.isConnected = false;
        resolve(); // Don't reject, just continue without extension
      }
    });
  }

  /**
   * Send message to extension
   */
  private async sendMessage(message: UTCExtensionMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !chrome?.runtime) {
        // Queue message for later if not connected
        this.messageQueue.push(message);
        console.warn('Extension not connected, message queued');
        resolve(null);
        return;
      }

      try {
        chrome.runtime.sendMessage(
          this.extensionId,
          message,
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('Extension message error:', chrome.runtime.lastError.message);
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      } catch (error) {
        reject(error);
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
      if (message.type === 'UTC_TIMESTAMP_REQUEST') {
        // Extension requesting UTC timestamp
        sendResponse({
          timestampUTC: timezoneUtils.getCurrentUTC(),
          timezone: this.currentUserTimezone,
          localTimestamp: timezoneUtils.formatInTimezone(
            timezoneUtils.getCurrentUTC(),
            this.currentUserTimezone
          )
        });
        return true;
      }

      if (message.type === 'TIMEZONE_VALIDATION_REQUEST') {
        // Extension requesting timezone validation
        const isValid = timezoneUtils.isValidTimezone(message.timezone);
        sendResponse({
          timezone: message.timezone,
          isValid,
          currentUserTimezone: this.currentUserTimezone
        });
        return true;
      }
    });
  }

  /**
   * Process queued messages when connection is restored
   */
  private async processMessageQueue(): Promise<void> {
    if (!this.isConnected || this.messageQueue.length === 0) return;

    const messages = [...this.messageQueue];
    this.messageQueue = [];

    for (const message of messages) {
      try {
        await this.sendMessage(message);
      } catch (error) {
        console.error('Failed to process queued message:', error);
        // Re-queue failed messages
        this.messageQueue.push(message);
      }
    }
  }

  /**
   * Cleanup extension service
   */
  cleanup(): void {
    this.isConnected = false;
    this.messageQueue = [];
    console.log('UTC Extension service cleaned up');
  }
}

// Create singleton instance
export const extensionServiceUTC = new ExtensionServiceUTC();

// Export for testing
export type { UTCExtensionMessage, DeepFocusSessionUTC };