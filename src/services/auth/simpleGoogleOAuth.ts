// Simplified Google OAuth2 service for per-user Calendar API access
// Each Firebase user gets ONE persistent Google Calendar connection
// Tokens are stored in Firestore for persistence across devices and sessions

import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../../api/firebase';
import { UserGoogleCalendarToken } from '../../types/models';

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
  private tokenClient: any = null;

  constructor() {
    // Try multiple ways to get the client ID for production compatibility
    const viteEnv = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;
    const defineVar = typeof __VITE_GOOGLE_OAUTH_CLIENT_ID__ !== 'undefined' ? __VITE_GOOGLE_OAUTH_CLIENT_ID__ : undefined;
    const hardcoded = '496225832510-4q5t9iogu4dhpsbenkg6f5oqmbgudae8.apps.googleusercontent.com';
    
    this.clientId = viteEnv || defineVar || hardcoded || '';
    
    console.log('🔍 Simple OAuth service initialized:', {
      clientId: this.clientId ? `${this.clientId.substring(0, 10)}...` : 'Not set',
      scope: this.scope,
      configured: !!this.clientId
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
   * Get stored token for current user
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
      
      // Check if token is expired
      if (Date.now() >= tokenData.expiresAt) {
        console.log('🔄 Token expired, attempting refresh...');
        return await this.refreshToken(tokenData);
      }

      return tokenData;
    } catch (error) {
      console.error('Error getting stored token:', error);
      return null;
    }
  }

  /**
   * Check if user has valid Google Calendar access
   */
  async hasCalendarAccess(): Promise<boolean> {
    const token = await this.getStoredToken();
    return !!token && token.syncEnabled;
  }

  /**
   * Request Google Calendar access for current user
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
      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: this.clientId,
        scope: this.scope,
        callback: async (response: any) => {
          try {
            if (response.error) {
              throw new Error(response.error);
            }

            // Get user profile info
            const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
              headers: {
                'Authorization': `Bearer ${response.access_token}`,
              },
            });

            const profile = await profileResponse.json();

            // Create token object
            const tokenData: UserGoogleCalendarToken = {
              userId: user.uid,
              accessToken: response.access_token,
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
            resolve(tokenData);
          } catch (error) {
            console.error('❌ Error processing Google OAuth response:', error);
            reject(error);
          }
        },
      });

      this.tokenClient.requestAccessToken();
    });
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshToken(tokenData: UserGoogleCalendarToken): Promise<UserGoogleCalendarToken | null> {
    if (!tokenData.refreshToken) {
      console.log('No refresh token available, user needs to re-authorize');
      return null;
    }

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          refresh_token: tokenData.refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      const data = await response.json();

      if (data.error) {
        console.error('Token refresh failed:', data.error);
        return null;
      }

      // Update token data
      const updatedToken: UserGoogleCalendarToken = {
        ...tokenData,
        accessToken: data.access_token,
        expiresAt: Date.now() + (data.expires_in * 1000),
        updatedAt: new Date(),
      };

      // Update stored token
      await setDoc(doc(db, 'googleCalendarTokens', tokenData.userId), updatedToken);

      console.log('✅ Token refreshed successfully');
      return updatedToken;
    } catch (error) {
      console.error('Error refreshing token:', error);
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