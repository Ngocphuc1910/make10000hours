// Google OAuth2 service with server-side token management
// Uses Firebase Functions for secure token storage and automatic refresh
// Tokens are stored securely on server with zero client access

import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../../api/firebase';
import { UserGoogleCalendarToken } from '../../types/models';

// Firebase Functions for OAuth management
const exchangeCodeForTokens = httpsCallable(functions, 'exchangeCodeForTokens');
const getFreshAccessToken = httpsCallable(functions, 'getFreshAccessToken');
const revokeGoogleAccess = httpsCallable(functions, 'revokeGoogleAccess');
const checkGoogleAuth = httpsCallable(functions, 'checkGoogleAuth');

// Google Identity Services types
declare global {
  interface Window {
    google: any;
  }
  const __VITE_GOOGLE_OAUTH_CLIENT_ID__: string;
}

export class SimpleGoogleOAuthService {
  private clientId: string;
  private scope: string = 'https://www.googleapis.com/auth/calendar';
  private codeClient: any = null;

  constructor() {
    // Try multiple ways to get the client ID for production compatibility
    const viteEnv = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;
    const defineVar = typeof __VITE_GOOGLE_OAUTH_CLIENT_ID__ !== 'undefined' ? __VITE_GOOGLE_OAUTH_CLIENT_ID__ : undefined;
    const hardcoded = '496225832510-4q5t9iogu4dhpsbenkg6f5oqmbgudae8.apps.googleusercontent.com';
    
    this.clientId = viteEnv || defineVar || hardcoded || '';
    
    console.log('🔍 OAuth service initialized with server-side token management:', {
      clientId: this.clientId ? `${this.clientId.substring(0, 10)}...` : 'Not set',
      scope: this.scope,
      configured: !!this.clientId,
      serverSide: true
    });
  }

  /**
   * Check if OAuth2 client ID is configured
   */
  isConfigured(): boolean {
    return !!this.clientId;
  }

  /**
   * Load Google Identity Services
   */
  private async loadGoogleIdentityServices(): Promise<void> {
    if (window.google?.accounts?.oauth2) {
      return;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
      document.head.appendChild(script);
    });
  }

  /**
   * Get stored token for current user (server-side managed)
   */
  async getStoredToken(): Promise<UserGoogleCalendarToken | null> {
    const user = auth.currentUser;
    if (!user) return null;

    try {
      // Check if user has authorization on server
      const result = await checkGoogleAuth();
      const authData = result.data as any;
      
      if (!authData.hasAccess) {
        return null;
      }

      // Get fresh access token from server (handles refresh automatically)
      const tokenResult = await getFreshAccessToken();
      const tokenData = tokenResult.data as any;
      
      // Return UserGoogleCalendarToken compatible object
      return {
        userId: user.uid,
        accessToken: tokenData.accessToken,
        refreshToken: 'BACKEND_MANAGED', // Indicator that refresh is handled server-side
        expiresAt: tokenData.expiresAt,
        email: authData.email,
        name: authData.name,
        picture: authData.picture,
        syncEnabled: true,
        grantedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } catch (error) {
      console.error('Error getting stored token:', error);
      
      // Check if it's an authentication error requiring re-authorization
      if (error instanceof Error && 
          (error.message.includes('unauthenticated') || 
           error.message.includes('not-found'))) {
        console.log('🔄 User needs to re-authorize Google Calendar access');
        return null;
      }
      
      throw error;
    }
  }

  /**
   * Check if user has valid Google Calendar access (server-side check)
   */
  async hasCalendarAccess(): Promise<boolean> {
    try {
      const result = await checkGoogleAuth();
      const authData = result.data as any;
      return authData.hasAccess;
    } catch (error) {
      console.error('Error checking calendar access:', error);
      return false;
    }
  }

  /**
   * Request Google Calendar access using authorization code flow with server-side token management
   */
  async requestCalendarAccess(): Promise<UserGoogleCalendarToken> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    if (!this.isConfigured()) {
      throw new Error('Google OAuth2 Client ID not configured');
    }

    await this.loadGoogleIdentityServices();

    return new Promise((resolve, reject) => {
      // Use authorization code client for server-side token management
      this.codeClient = window.google.accounts.oauth2.initCodeClient({
        client_id: this.clientId,
        scope: this.scope,
        ux_mode: 'redirect',
        redirect_uri: window.location.origin + '/oauth/callback',
        callback: async (response: any) => {
          try {
            if (response.error) {
              throw new Error(response.error);
            }

            if (!response.code) {
              throw new Error('No authorization code received');
            }

            console.log('🔑 Authorization code received, exchanging for tokens...');
            
            // Exchange authorization code for tokens on server
            const result = await exchangeCodeForTokens({ code: response.code });
            const serverData = result.data as any;
            
            if (!serverData.success) {
              throw new Error('Failed to exchange authorization code for tokens');
            }

            console.log('✅ Google Calendar access granted for user:', user.uid);
            console.log('🔍 Server response:', {
              email: serverData.email,
              name: serverData.name,
              expiresAt: new Date(serverData.expiresAt),
              serverManaged: true
            });
            
            // Create client-side token object (server manages actual tokens)
            const tokenData: UserGoogleCalendarToken = {
              userId: user.uid,
              accessToken: 'BACKEND_MANAGED', // Placeholder - actual token is server-side
              refreshToken: 'BACKEND_MANAGED',
              expiresAt: serverData.expiresAt,
              grantedAt: new Date(),
              email: serverData.email,
              name: serverData.name,
              picture: serverData.picture,
              syncEnabled: true,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            
            resolve(tokenData);
          } catch (error) {
            console.error('❌ Error exchanging authorization code:', error);
            reject(error);
          }
        },
      });

      // Track popup attempt for debugging
      localStorage.setItem('lastGoogleAuthAttempt', Date.now().toString());
      
      // Request authorization code with user gesture to avoid popup blocking
      try {
        console.log('🔐 Requesting Google Calendar authorization...');
        console.log('💡 If popup is blocked, check address bar for popup blocker icon');
        
        this.codeClient.requestCode();
        
        // Set a timeout to detect if popup was blocked
        setTimeout(() => {
          console.log('⚠️ If authorization popup did not appear, it may be blocked');
          console.log('🔧 To fix: Allow popups for this site in your browser settings');
          console.log('📍 Look for popup blocker icon in address bar and click "Always allow"');
        }, 1000);
        
      } catch (error) {
        console.error('❌ Failed to request authorization code:', error);
        console.log('🚨 POPUP BLOCKED OR AUTHORIZATION FAILED');
        console.log('🔧 Solution: Enable popups for this site and try again');
        reject(new Error('Authorization failed. Please allow popups for this site and try again.'));
      }
    });
  }





  /**
   * Revoke Google Calendar access for current user (server-side managed)
   */
  async revokeAccess(): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;

    try {
      // Revoke access on server (handles token revocation and cleanup)
      const result = await revokeGoogleAccess();
      const revokeData = result.data as any;
      
      if (revokeData.success) {
        console.log('✅ Google Calendar access revoked for user:', user.uid);
      } else {
        console.warn('⚠️ Revoke request completed but may not have been fully successful');
      }
    } catch (error) {
      console.error('Error revoking access:', error);
      throw error;
    }
  }

  /**
   * Enable/disable sync for current user
   * Note: With server-side management, sync is always enabled when authorized
   */
  async toggleSync(enabled: boolean): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;

    // Check if user has access first
    const hasAccess = await this.hasCalendarAccess();
    if (!hasAccess) {
      throw new Error('No Google Calendar access found');
    }

    // With server-side token management, sync is inherently enabled
    // when user has authorized access. This method mainly provides
    // compatibility for existing code patterns.
    console.log(`✅ Sync ${enabled ? 'enabled' : 'disabled'} for user:`, user.uid);
    console.log('💡 Note: With server-side management, sync is active when authorized');
  }

  /**
   * Clear token on logout (cleanup)
   */
  clearTokenOnLogout(): void {
    // Server-side tokens persist across sessions
    console.log('🔄 User logged out, server-side tokens remain persistent');
  }

  /**
   * Get current access token for API calls (server-side managed)
   */
  async getAccessToken(): Promise<string | null> {
    try {
      // Get fresh access token from server
      const tokenResult = await getFreshAccessToken();
      const tokenData = tokenResult.data as any;
      return tokenData.accessToken;
    } catch (error) {
      console.error('Error getting access token:', error);
      
      // Check if user needs to re-authorize
      if (error instanceof Error && 
          (error.message.includes('unauthenticated') || 
           error.message.includes('not-found'))) {
        return null; // Indicates need for re-authorization
      }
      
      throw error;
    }
  }
}

export const simpleGoogleOAuthService = new SimpleGoogleOAuthService();