/**
 * Extension Sync Listener
 * Handles incoming session data from the Chrome extension
 */

import { siteUsageSessionService } from '../api/siteUsageSessionService';
import { useUserStore } from '../store/userStore';
import { SiteUsageSession, ExtensionSiteUsageSession, SessionManager } from '../utils/SessionManager';

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
    console.log('📨 Extension message received:', {
      type: event.data?.type,
      hasPayload: !!event.data?.payload,
      hasSessions: !!event.data?.payload?.sessions,
      sessionCount: event.data?.payload?.sessions?.length || 0,
      source: event.source,
      origin: event.origin
    });

    // Only handle messages from extension
    if (event.data?.type === 'EXTENSION_SITE_USAGE_SESSION_BATCH') {
      console.log('✅ Processing extension session batch...');
      await this.processSessions(event.data.payload.sessions);
    } else if (event.data?.type && event.data.source !== 'web-app') {
      console.log('ℹ️ Received other extension message:', event.data.type);
    }
  }

  private async handleChromeMessage(message: any, sender: any, sendResponse: (response?: any) => void) {
    if (message.type === 'EXTENSION_SITE_USAGE_SESSION_BATCH') {
      await this.processSessions(message.payload.sessions);
      sendResponse({ success: true });
    }
  }

  private async processSessions(extensionSessions: ExtensionSiteUsageSession[]) {
    try {
      console.log(`🔄 Received ${extensionSessions.length} sessions from extension`);
      
      // Get current user
      const userStore = useUserStore.getState();
      if (!userStore.user?.uid) {
        console.warn('⚠️ No authenticated user, cannot save sessions');
        return;
      }

      console.log(`🔍 Current user: ${userStore.user.uid}`);

      // Validate and filter sessions for current user
      const validExtensionSessions = extensionSessions.filter(session => {
        const isValid = SessionManager.validateExtensionSession(session) &&
                       session.userId === userStore.user?.uid;
        
        if (!isValid) {
          console.log(`❌ Invalid extension session:`, {
            userIdMatch: session.userId === userStore.user?.uid,
            hasValidFormat: SessionManager.validateExtensionSession(session),
            sessionUserId: session.userId,
            currentUserId: userStore.user?.uid
          });
        }
        
        return isValid;
      });

      if (validExtensionSessions.length === 0) {
        console.warn('⚠️ No valid sessions to sync');
        return;
      }

      // Convert extension sessions to Firebase format
      const firebaseSessions = validExtensionSessions.map(session => 
        SessionManager.convertExtensionToFirebase(session)
      );

      console.log(`📊 Syncing ${firebaseSessions.length} sessions to Firebase`);

      // Save sessions to Firebase
      await siteUsageSessionService.batchSaveSessions(firebaseSessions);
      
      console.log(`✅ Successfully synced ${firebaseSessions.length} sessions to Firebase`);

      // Trigger dashboard refresh
      const { useDeepFocusDashboardStore } = await import('../store/deepFocusDashboardStore');
      await useDeepFocusDashboardStore.getState().loadSessionData();
      
    } catch (error) {
      console.error('❌ Failed to process extension sessions:', error);
    }
  }

  /**
   * Trigger extension to sync its data to the web app
   */
  async triggerExtensionSync(): Promise<void> {
    try {
      console.log('🔄 Requesting extension sync via postMessage...');
      // Use postMessage to communicate with extension
      window.postMessage({ 
        type: 'REQUEST_SITE_USAGE_SESSIONS', 
        source: 'web-app',
        timestamp: new Date().toISOString()
      }, '*');
      
      // Give extension time to respond
      await new Promise(resolve => setTimeout(resolve, 1000));
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