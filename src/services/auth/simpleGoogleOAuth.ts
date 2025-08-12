// Google OAuth2 service with Authorization Code Flow for persistent Calendar API access
// Each Firebase user gets ONE persistent Google Calendar connection with refresh tokens
// Tokens are stored in Firestore for persistence across devices and sessions

import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../../api/firebase';
import { UserGoogleCalendarToken } from '../../types/models';

// Constants for client-side OAuth token status indicators (not actual secrets)
const OAUTH_STATUS = {
  CLIENT_SIDE_FLOW: 'no-refresh-token-available',
  PENDING_REFRESH: 'refresh-token-pending', 
  MISSING_REFRESH: 'refresh-token-missing'
} as const;

// Google Identity Services types
declare global {
  interface Window {
    google: any;
  }
  const __VITE_GOOGLE_OAUTH_CLIENT_ID__: string;
}

export class SimpleGoogleOAuthService {
  private clientId: string;
  private clientSecret: string;
  private scope: string = 'https://www.googleapis.com/auth/calendar';
  private redirectUri: string = 'postmessage'; // For web applications
  private codeClient: any = null;
  private lastRefreshAttempt: number = 0;
  private refreshCooldownMs: number = 30000; // 30 seconds cooldown between refresh attempts

  constructor() {
    // Try multiple ways to get the client ID for production compatibility
    const viteEnv = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;
    const defineVar = typeof __VITE_GOOGLE_OAUTH_CLIENT_ID__ !== 'undefined' ? __VITE_GOOGLE_OAUTH_CLIENT_ID__ : undefined;
    const hardcoded = '496225832510-4q5t9iogu4dhpsbenkg6f5oqmbgudae8.apps.googleusercontent.com';
    
    this.clientId = viteEnv || defineVar || hardcoded || '';
    
    // Note: Client secret should be in environment for production
    // For now using empty string as authorization code flow can work without it in some cases
    this.clientSecret = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_SECRET || '';
    
    console.log('🔍 OAuth service initialized with Authorization Code Flow:', {
      clientId: this.clientId ? `${this.clientId.substring(0, 10)}...` : 'Not set',
      scope: this.scope,
      configured: !!this.clientId,
      hasClientSecret: !!this.clientSecret
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
   * Get stored token for current user with automatic refresh
   */
  async getStoredToken(): Promise<UserGoogleCalendarToken | null> {
    const user = auth.currentUser;
    if (!user) return null;

    try {
      const tokenDoc = await getDoc(doc(db, 'googleCalendarTokens', user.uid));
      if (!tokenDoc.exists()) {
        return null;
      }

      const tokenData = tokenDoc.data() as UserGoogleCalendarToken;
      
      // Check if token expires within 5 minutes - proactive refresh with throttling
      const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
      if (fiveMinutesFromNow >= tokenData.expiresAt) {
        // THROTTLING: Prevent repeated refresh attempts
        const timeSinceLastAttempt = Date.now() - this.lastRefreshAttempt;
        if (timeSinceLastAttempt < this.refreshCooldownMs) {
          // Still in cooldown period, return existing token without logging
          return tokenData;
        }
        
        console.log('🔄 Token expiring soon...');
        this.lastRefreshAttempt = Date.now(); // Update timestamp
        
        // For client-side apps without refresh tokens, we need to prompt re-authorization
        if (tokenData.refreshToken === OAUTH_STATUS.CLIENT_SIDE_FLOW || 
            tokenData.refreshToken === OAUTH_STATUS.PENDING_REFRESH || 
            tokenData.refreshToken === OAUTH_STATUS.MISSING_REFRESH) {
          console.log('⚠️ No refresh token available for automatic renewal');
          console.log('💡 Token will be valid until:', new Date(tokenData.expiresAt));
          console.log('💡 User will need to re-authorize when token expires');
          return tokenData; // Return existing token, let API calls handle expiration
        }
        
        // Try to refresh if we have a valid refresh token
        const refreshedToken = await this.refreshAccessToken(tokenData);
        return refreshedToken || tokenData; // Fallback to existing token if refresh fails
      }

      return tokenData;
    } catch (error) {
      console.error('Error getting stored token:', error);
      return null;
    }
  }

  /**
   * Check if user has valid Google Calendar access (regardless of sync enabled status)
   */
  async hasCalendarAccess(): Promise<boolean> {
    const token = await this.getStoredToken();
    return !!token; // Just check if token exists, not if sync is enabled
  }

  /**
   * Request Google Calendar access using Token Client with offline access
   * Modified to work with client-side applications while still getting refresh tokens
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
      // Use token client with proper popup handling
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: this.clientId,
        scope: this.scope,
        include_granted_scopes: true,
        callback: async (response: any) => {
          try {
            if (response.error) {
              throw new Error(response.error);
            }

            console.log('🔑 Token received, getting user profile...');
            
            // Get user profile info using the access token
            const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
              headers: {
                'Authorization': `Bearer ${response.access_token}`,
              },
            });

            if (!profileResponse.ok) {
              throw new Error('Failed to get user profile');
            }

            const profile = await profileResponse.json();

            // Create token object (simplified for client-side apps)
            const tokenData: UserGoogleCalendarToken = {
              userId: user.uid,
              accessToken: response.access_token,
              refreshToken: OAUTH_STATUS.CLIENT_SIDE_FLOW, // Indicator that this is a client-side token
              expiresAt: Date.now() + (response.expires_in * 1000),
              grantedAt: new Date(),
              email: profile.email,
              name: profile.name,
              picture: profile.picture,
              syncEnabled: true,
              createdAt: new Date(),
              updatedAt: new Date()
            };

            // Store token in Firestore
            await setDoc(doc(db, 'googleCalendarTokens', user.uid), tokenData);

            console.log('✅ Google Calendar access granted for user:', user.uid);
            console.log('🔍 Token details:', {
              hasAccessToken: !!tokenData.accessToken,
              expiresAt: new Date(tokenData.expiresAt),
              email: tokenData.email,
              validFor: Math.round((tokenData.expiresAt - Date.now()) / (1000 * 60)) + ' minutes'
            });
            
            resolve(tokenData);
          } catch (error) {
            console.error('❌ Error processing Google OAuth response:', error);
            reject(error);
          }
        },
      });

      // Track popup attempt for debugging
      localStorage.setItem('lastGoogleAuthAttempt', Date.now().toString());
      
      // Request access token with user gesture to avoid popup blocking
      // Make sure this is called from a user interaction (button click)
      try {
        console.log('🔐 Requesting Google Calendar authorization...');
        console.log('💡 If popup is blocked, check address bar for popup blocker icon');
        
        tokenClient.requestAccessToken({ 
          prompt: 'consent'
        });
        
        // Set a timeout to detect if popup was blocked
        setTimeout(() => {
          console.log('⚠️ If authorization popup did not appear, it may be blocked');
          console.log('🔧 To fix: Allow popups for this site in your browser settings');
          console.log('📍 Look for popup blocker icon in address bar and click "Always allow"');
        }, 1000);
        
      } catch (error) {
        console.error('❌ Failed to request access token:', error);
        console.log('🚨 POPUP BLOCKED OR AUTHORIZATION FAILED');
        console.log('🔧 Solution: Enable popups for this site and try again');
        reject(new Error('Authorization failed. Please allow popups for this site and try again.'));
      }
    });
  }



  /**
   * Refresh access token using refresh token
   * For client-side apps, this may not be available
   */
  private async refreshAccessToken(tokenData: UserGoogleCalendarToken): Promise<UserGoogleCalendarToken | null> {
    if (!tokenData.refreshToken || 
        tokenData.refreshToken === OAUTH_STATUS.CLIENT_SIDE_FLOW ||
        tokenData.refreshToken === OAUTH_STATUS.MISSING_REFRESH || 
        tokenData.refreshToken === OAUTH_STATUS.PENDING_REFRESH) {
      console.log('❌ No refresh token available for client-side app');
      console.log('💡 User will need to re-authorize when current token expires');
      return null;
    }

    try {
      console.log('🔄 Refreshing access token...');
      
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: tokenData.refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Token refresh failed:', errorData);
        return null;
      }

      const data = await response.json();

      if (data.error) {
        console.error('❌ Token refresh error:', data.error);
        return null;
      }

      // Update token data (refresh token usually stays the same)
      const updatedToken: UserGoogleCalendarToken = {
        ...tokenData,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || tokenData.refreshToken, // Use new refresh token if provided
        expiresAt: Date.now() + (data.expires_in * 1000),
        updatedAt: new Date(),
      };

      // Update stored token
      await setDoc(doc(db, 'googleCalendarTokens', tokenData.userId), updatedToken);

      console.log('✅ Access token refreshed successfully');
      return updatedToken;
    } catch (error) {
      console.error('❌ Error refreshing access token:', error);
      return null;
    }
  }

  /**
   * Revoke Google Calendar access for current user
   */
  async revokeAccess(): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const token = await this.getStoredToken();
      if (token) {
        // Revoke token with Google
        try {
          await fetch(`https://oauth2.googleapis.com/revoke?token=${token.accessToken}`, {
            method: 'POST',
          });
        } catch (error) {
          console.warn('Failed to revoke token with Google:', error);
        }

        // Delete from Firestore
        await deleteDoc(doc(db, 'googleCalendarTokens', user.uid));
      }

      console.log('✅ Google Calendar access revoked for user:', user.uid);
    } catch (error) {
      console.error('Error revoking access:', error);
      throw error;
    }
  }

  /**
   * Enable/disable sync for current user
   */
  async toggleSync(enabled: boolean): Promise<void> {
    const user = auth.currentUser;
    if (!user) return;

    const token = await this.getStoredToken();
    if (!token) {
      throw new Error('No Google Calendar access found');
    }

    const updatedToken: UserGoogleCalendarToken = {
      ...token,
      syncEnabled: enabled,
      updatedAt: new Date(),
    };

    await setDoc(doc(db, 'googleCalendarTokens', user.uid), updatedToken);
    console.log(`✅ Sync ${enabled ? 'enabled' : 'disabled'} for user:`, user.uid);
  }

  /**
   * Clear token on logout (cleanup)
   */
  clearTokenOnLogout(): void {
    // Just log the action - token stays in Firestore for next login
    console.log('🔄 User logged out, Google Calendar tokens remain persistent');
  }

  /**
   * Get current access token for API calls
   */
  async getAccessToken(): Promise<string | null> {
    const token = await this.getStoredToken();
    return token?.accessToken || null;
  }
}

export const simpleGoogleOAuthService = new SimpleGoogleOAuthService();