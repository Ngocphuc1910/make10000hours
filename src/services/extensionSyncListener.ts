/**
 * Extension Sync Listener
 * Handles incoming session data from the Chrome extension
 */

import { siteUsageSessionService } from '../api/siteUsageSessionService';
import { useUserStore } from '../store/userStore';
import { SiteUsageSession } from '../utils/SessionManager';

class ExtensionSyncListener {
  private isInitialized = false;
  private messageHandler: (event: MessageEvent) => void;
  private chromeMessageHandler: (message: any, sender: any, sendResponse: (response?: any) => void) => void;

  constructor() {
    this.messageHandler = this.handleMessage.bind(this);
    this.chromeMessageHandler = this.handleChromeMessage.bind(this);
  }

  initialize() {
    if (this.isInitialized) return;

    try {
      // Listen for postMessage events from extension
      window.addEventListener('message', this.messageHandler);
      
      // Listen for chrome extension messages (if available)
      const chromeGlobal = (globalThis as any).chrome;
      if (typeof chromeGlobal !== 'undefined' && chromeGlobal.runtime && chromeGlobal.runtime.onMessage) {
        chromeGlobal.runtime.onMessage.addListener(this.chromeMessageHandler);
      }

      this.isInitialized = true;
      console.log('✅ Extension sync listener initialized');
    } catch (error) {
      console.error('❌ Failed to initialize extension sync listener:', error);
    }
  }

  private async handleMessage(event: MessageEvent) {
    // Only handle messages from extension
    if (event.data?.type === 'EXTENSION_SITE_USAGE_SESSION_BATCH') {
      await this.processSessions(event.data.payload.sessions);
    }
  }

  private async handleChromeMessage(message: any, sender: any, sendResponse: (response?: any) => void) {
    if (message.type === 'EXTENSION_SITE_USAGE_SESSION_BATCH') {
      await this.processSessions(message.payload.sessions);
      sendResponse({ success: true });
    }
  }

  private async processSessions(sessions: SiteUsageSession[]) {
    try {
      console.log(`🔄 Received ${sessions.length} sessions from extension`);
      
      // Get current user
      const userStore = useUserStore.getState();
      if (!userStore.user?.uid) {
        console.warn('⚠️ No authenticated user, cannot save sessions');
        return;
      }

      console.log(`🔍 Current user: ${userStore.user.uid}`);
      console.log(`🔍 Session user IDs:`, sessions.map(s => `${s.id}: ${s.userId}`));

      // Filter sessions for current user and validate
      const validSessions = sessions.filter(session => {
        const isValid = session.userId === userStore.user?.uid && 
                       session.id && 
                       session.domain && 
                       session.startTime;
        
        if (!isValid) {
          console.log(`❌ Invalid session ${session.id}:`, {
            userIdMatch: session.userId === userStore.user?.uid,
            hasId: !!session.id,
            hasDomain: !!session.domain,
            hasStartTime: !!session.startTime,
            sessionUserId: session.userId,
            currentUserId: userStore.user?.uid
          });
        }
        
        return isValid;
      });

      if (validSessions.length === 0) {
        console.warn('⚠️ No valid sessions to sync');
        return;
      }

      console.log(`📊 Syncing ${validSessions.length} valid sessions to Firebase`);

      // Save sessions to Firebase
      await siteUsageSessionService.batchSaveSessions(validSessions);
      
      console.log(`✅ Successfully synced ${validSessions.length} sessions to Firebase`);
    } catch (error) {
      console.error('❌ Failed to process extension sessions:', error);
    }
  }

  /**
   * Trigger extension to sync its data to the web app
   */
  async triggerExtensionSync(): Promise<void> {
    try {
      // Try Chrome extension API first
      const chromeGlobal = (globalThis as any).chrome;
      if (typeof chromeGlobal !== 'undefined' && chromeGlobal.runtime) {
        console.log('🔄 Requesting extension sync via Chrome API...');
        await new Promise((resolve) => {
          chromeGlobal.runtime.sendMessage(
            { type: 'FORCE_SYNC_SESSIONS' },
            () => {
              // Response received (or error occurred)
              resolve(true);
            }
          );
          // Timeout after 5 seconds
          setTimeout(resolve, 5000);
        });
      } else {
        // Fallback to postMessage
        console.log('🔄 Requesting extension sync via postMessage...');
        window.postMessage({ 
          type: 'FORCE_SYNC_SESSIONS', 
          source: 'webapp' 
        }, '*');
      }
    } catch (error) {
      console.warn('⚠️ Could not trigger extension sync:', error);
    }
  }

  cleanup() {
    if (!this.isInitialized) return;

    try {
      window.removeEventListener('message', this.messageHandler);
      
      const chromeGlobal = (globalThis as any).chrome;
      if (typeof chromeGlobal !== 'undefined' && chromeGlobal.runtime && chromeGlobal.runtime.onMessage) {
        // Chrome extension message listeners are automatically cleaned up
        // when the page unloads, but we can try to remove it if possible
      }
      
      this.isInitialized = false;
      console.log('✅ Extension sync listener cleaned up');
    } catch (error) {
      console.error('❌ Failed to cleanup extension sync listener:', error);
    }
  }
}

// Export singleton instance
export const extensionSyncListener = new ExtensionSyncListener();