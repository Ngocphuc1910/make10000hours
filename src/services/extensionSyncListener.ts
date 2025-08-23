/**
 * Extension Sync Listener
 * Handles incoming session data from the Chrome extension
 */

import { siteUsageSessionService } from '../api/siteUsageSessionService';
import { overrideSessionService } from '../api/overrideSessionService';
import { useUserStore } from '../store/userStore';
import { SiteUsageSession, ExtensionSiteUsageSession, SessionManager } from '../utils/SessionManager';

class ExtensionSyncListener {
  private isInitialized = false;
  private messageHandler: (event: MessageEvent) => void;
  private chromeMessageHandler: (message: any, sender: any, sendResponse: (response?: any) => void) => void;
  private syncInProgress = false;
  private pendingSyncPromise: Promise<void> | null = null;

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
      console.log(`🔄 [SYNC-PROTECTION] Processing ${extensionSessions.length} sessions from extension`);
      
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

      // Separate override sessions from site usage sessions
      const siteUsageSessions = validExtensionSessions.filter(session => session.type !== 'override');
      const overrideSessions = validExtensionSessions.filter(session => session.type === 'override');
      
      console.log(`📊 [SYNC-PROTECTION] Found ${siteUsageSessions.length} site usage sessions and ${overrideSessions.length} override sessions`);
      
      // Debug: Log session types for troubleshooting
      if (overrideSessions.length > 0) {
        console.log('🔍 Override sessions to sync:', overrideSessions.map(s => ({ domain: s.domain, duration: s.duration, type: s.type })));
      }

      // Process site usage sessions
      if (siteUsageSessions.length > 0) {
        const firebaseSiteUsageSessions = siteUsageSessions.map(session => 
          SessionManager.convertExtensionToFirebase(session)
        );
        
        console.log(`📊 Syncing ${firebaseSiteUsageSessions.length} site usage sessions to Firebase`);
        await siteUsageSessionService.batchSaveSessions(firebaseSiteUsageSessions);
        console.log(`✅ Successfully synced ${firebaseSiteUsageSessions.length} site usage sessions`);
      }

      // Process override sessions separately
      if (overrideSessions.length > 0) {
        console.log(`📊 Syncing ${overrideSessions.length} override sessions to Firebase`);
        
        for (const overrideSession of overrideSessions) {
          try {
            const durationMinutes = Math.round(overrideSession.duration / 60); // Convert seconds to minutes
            console.log(`🔄 Creating override session for ${overrideSession.domain} (${durationMinutes} minutes)`);
            
            const docId = await overrideSessionService.createOverrideSession({
              userId: overrideSession.userId,
              domain: overrideSession.domain,
              duration: durationMinutes,
              url: overrideSession.url || overrideSession.domain,
              reason: 'manual_override'
            });
            
            console.log(`✅ Synced override session for ${overrideSession.domain} to Firebase (doc ID: ${docId})`);
          } catch (error) {
            console.error(`❌ Failed to sync override session for ${overrideSession.domain}:`, error);
          }
        }
        
        console.log(`✅ Successfully processed ${overrideSessions.length} override sessions`);
      }
      
      console.log(`✅ [SYNC-PROTECTION] Successfully synced all sessions to Firebase`);

      // Trigger dashboard refresh
      const { useDeepFocusDashboardStore } = await import('../store/deepFocusDashboardStore');
      await useDeepFocusDashboardStore.getState().loadSessionData();
      
    } catch (error) {
      console.error('❌ Failed to process extension sessions:', error);
    }
  }

  /**
   * Public method for testing - process sessions manually
   */
  async testProcessSessions(extensionSessions: ExtensionSiteUsageSession[]): Promise<void> {
    return this.processSessions(extensionSessions);
  }

  /**
   * Trigger extension to sync its data to the web app
   * Prevents concurrent sync operations to avoid Firebase race conditions
   */
  async triggerExtensionSync(): Promise<void> {
    // If sync is already in progress, return the pending promise
    if (this.syncInProgress && this.pendingSyncPromise) {
      console.log('⏳ Sync already in progress, waiting for completion...');
      return this.pendingSyncPromise;
    }

    // Mark sync as in progress and create promise
    this.syncInProgress = true;
    this.pendingSyncPromise = this.performSync();

    try {
      await this.pendingSyncPromise;
    } finally {
      // Reset state when sync completes (success or failure)
      this.syncInProgress = false;
      this.pendingSyncPromise = null;
    }
  }

  private async performSync(): Promise<void> {
    try {
      console.log('🔄 Requesting extension sync via postMessage...');
      // Use postMessage to communicate with extension for site usage
      window.postMessage({ 
        type: 'REQUEST_SITE_USAGE_SESSIONS', 
        source: 'web-app',
        timestamp: new Date().toISOString()
      }, '*');
      
      // Also trigger deep focus sync manually since extension doesn't have automatic batch messages
      console.log('🎯 Triggering deep focus sync...');
      await this.triggerDeepFocusSync();
      
      // Give extension time to respond
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.warn('⚠️ Could not trigger extension sync:', error);
      throw error;
    }
  }

  /**
   * Manually trigger deep focus session sync
   */
  private async triggerDeepFocusSync(): Promise<void> {
    try {
      const userStore = await import('../store/userStore');
      const user = userStore.useUserStore.getState().user;
      
      if (!user?.uid) {
        console.log('⚠️ No authenticated user for deep focus sync');
        return;
      }
      
      console.log('🎯 Starting deep focus sync for user:', user.uid);
      const { DeepFocusSync } = await import('../services/deepFocusSync');
      const result = await DeepFocusSync.smartSync(user.uid, 'today');
      
      if (result.success) {
        console.log(`✅ Deep focus sync completed: ${result.syncedSessions} sessions synced`);
      } else {
        console.warn('⚠️ Deep focus sync failed:', result.error);
      }
      
    } catch (error) {
      console.error('❌ Deep focus sync error:', error);
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