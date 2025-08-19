// Google OAuth2 service for Calendar API access using Google Identity Services
// This is separate from Firebase Auth and uses the proper client-side flow
// Tokens are stored in Firestore for persistence across devices and sessions

import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../api/firebase';
import { UserGoogleToken, UserGoogleAccount, UserSyncSettings, GoogleCalendar } from '../../types/models';
import { MultiAccountStorage } from '../storage/multiAccountStorage';

// Google Identity Services types
declare global {
  interface Window {
    google: any;
  }
  // Vite define variables
  const __VITE_GOOGLE_OAUTH_CLIENT_ID__: string;
}

export class GoogleOAuthService {
  private clientId: string;
  private scope: string = 'https://www.googleapis.com/auth/calendar';
  private tokenClient: any = null;

  constructor() {
    // Try multiple ways to get the client ID for production compatibility
    const viteEnv = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;
    const defineVar = typeof __VITE_GOOGLE_OAUTH_CLIENT_ID__ !== 'undefined' ? __VITE_GOOGLE_OAUTH_CLIENT_ID__ : undefined;
    // Fallback client ID - obfuscated for security
    const fallbackClientId = atob('NDk2MjI1ODMyNTEwLTRxNXQ5aW9ndTRkaHBzYmVua2c2ZjVvcW1iZ3VkYWU4LmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29t');
    
    this.clientId = viteEnv || defineVar || fallbackClientId || '';
    
    console.log('🔍 OAuth service initialized:', {
      clientId: this.clientId ? `${this.clientId.substring(0, 10)}...` : 'Not set',
      scope: this.scope,
      configured: !!this.clientId
    });
  }

  /**
   * Check if OAuth2 client ID is configured
   */
  isConfigured(): boolean {
    const configured = !!this.clientId;
    console.log('🔍 OAuth2 configuration check:', {
      clientId: this.clientId ? `${this.clientId.substring(0, 10)}...` : 'Not set',
      configured
    });
    return configured;
  }

  /**
   * Get current user ID from Firebase auth
   */
  private getCurrentUserId(): string | null {
    try {
      // Primary method: access Firebase auth instance from global scope
      if (typeof window !== 'undefined' && (window as any).firebaseAuth) {
        const currentUser = (window as any).firebaseAuth.currentUser;
        if (currentUser?.uid) {
          return currentUser.uid;
        }
      }
      
      // Fallback: get from Firebase's localStorage keys
      // Firebase stores auth state with project-specific keys
      const authKey = `firebase:authUser:${import.meta.env.VITE_FIREBASE_API_KEY}:[DEFAULT]`;
      
      const firebaseUser = localStorage.getItem(authKey);
      if (firebaseUser && firebaseUser !== 'null') {
        const parsed = JSON.parse(firebaseUser);
        if (parsed?.uid) {
          return parsed.uid;
        }
      }
      
      return null;
    } catch (error) {
      console.warn('Could not get current user ID:', error);
      return null;
    }
  }

  /**
   * Get stored access token from Firestore for current user
   */
  async getStoredToken(): Promise<UserGoogleToken | null> {
    try {
      const currentUserId = this.getCurrentUserId();
      
      if (!currentUserId) {
        console.log('🔍 No current user, cannot check token');
        return null;
      }

      console.log('🔍 Checking Firestore for stored token...');
      const tokenDoc = await getDoc(doc(db, 'userGoogleTokens', currentUserId));
      
      if (!tokenDoc.exists()) {
        console.log('🔍 No token found in Firestore');
        // Check for legacy localStorage token and migrate if found
        await this.migrateLegacyToken();
        return null;
      }

      const tokenData = tokenDoc.data() as UserGoogleToken;
      
      console.log('🔍 Token details:', {
        hasAccessToken: !!tokenData.accessToken,
        userId: tokenData.userId,
        expiresAt: new Date(tokenData.expiresAt).toISOString(),
        isExpired: Date.now() >= tokenData.expiresAt,
        isRevoked: !!tokenData.revokedAt
      });

      // Check if token is revoked
      if (tokenData.revokedAt) {
        console.warn('⚠️ Token has been revoked, removing...');
        await this.deleteTokenFromFirestore(currentUserId);
        return null;
      }
      
      // Check if token is expired
      if (Date.now() >= tokenData.expiresAt) {
        console.warn('⚠️ Token expired, removing...');
        await this.deleteTokenFromFirestore(currentUserId);
        return null;
      }

      // Update last used timestamp
      await this.updateTokenLastUsed(currentUserId);

      console.log('✅ Valid token found for current user');
      return tokenData;
    } catch (error) {
      console.error('Error reading stored token:', error);
      return null;
    }
  }

  /**
   * Store access token in Firestore
   */
  private async storeToken(tokenInfo: { accessToken: string; expiresAt: number; refreshToken?: string }): Promise<void> {
    try {
      const currentUserId = this.getCurrentUserId();
      
      if (!currentUserId) {
        throw new Error('No current user to store token for');
      }

      const userToken: Partial<UserGoogleToken> = {
        userId: currentUserId,
        accessToken: tokenInfo.accessToken,
        expiresAt: tokenInfo.expiresAt,
        grantedAt: new Date(),
        lastUsed: new Date()
      };

      // Only include refreshToken if it exists
      if (tokenInfo.refreshToken) {
        userToken.refreshToken = tokenInfo.refreshToken;
      }

      await setDoc(doc(db, 'userGoogleTokens', currentUserId), userToken);
      console.log('✅ Token stored in Firestore for user:', currentUserId);
      
      // Clean up legacy localStorage token
      localStorage.removeItem('google_calendar_token');
    } catch (error) {
      console.error('Error storing token:', error);
      throw error;
    }
  }

  /**
   * Update token last used timestamp
   */
  private async updateTokenLastUsed(userId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'userGoogleTokens', userId), {
        lastUsed: new Date()
      });
    } catch (error) {
      console.error('Error updating token last used:', error);
    }
  }

  /**
   * Delete token from Firestore
   */
  private async deleteTokenFromFirestore(userId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'userGoogleTokens', userId));
      console.log('✅ Token deleted from Firestore for user:', userId);
    } catch (error) {
      console.error('Error deleting token from Firestore:', error);
    }
  }

  /**
   * Migrate legacy localStorage token to Firestore
   */
  private async migrateLegacyToken(): Promise<void> {
    try {
      const currentUserId = this.getCurrentUserId();
      if (!currentUserId) return;

      const legacyToken = localStorage.getItem('google_calendar_token');
      if (!legacyToken) return;

      console.log('🔄 Migrating legacy localStorage token to Firestore...');
      const parsed = JSON.parse(legacyToken);
      
      if (parsed.userId === currentUserId && parsed.accessToken && Date.now() < parsed.expiresAt) {
        await this.storeToken({
          accessToken: parsed.accessToken,
          refreshToken: parsed.refreshToken,
          expiresAt: parsed.expiresAt
        });
        console.log('✅ Legacy token migrated successfully');
      }
      
      // Clean up localStorage regardless
      localStorage.removeItem('google_calendar_token');
    } catch (error) {
      console.error('Error migrating legacy token:', error);
      localStorage.removeItem('google_calendar_token');
    }
  }

  /**
   * Load Google Identity Services library
   */
  private async loadGoogleIdentityServices(): Promise<void> {
    if (window.google?.accounts) {
      return; // Already loaded
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        console.log('✅ Google Identity Services loaded');
        resolve();
      };
      script.onerror = () => {
        console.error('❌ Failed to load Google Identity Services');
        reject(new Error('Failed to load Google Identity Services'));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Initialize the OAuth2 token client
   */
  private async initTokenClient(): Promise<void> {
    if (this.tokenClient) {
      return; // Already initialized
    }

    await this.loadGoogleIdentityServices();

    this.tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: this.clientId,
      scope: this.scope,
      callback: async (response: any) => {
        if (response.error) {
          console.error('❌ OAuth error:', response.error);
          throw new Error(`OAuth error: ${response.error}`);
        }
        
        console.log('✅ OAuth success:', {
          hasAccessToken: !!response.access_token,
          expiresIn: response.expires_in
        });
        
        // Store the token in Firestore
        try {
          await this.storeToken({
            accessToken: response.access_token,
            expiresAt: Date.now() + (response.expires_in * 1000)
          });
        } catch (error) {
          console.error('❌ Failed to store token:', error);
        }
      }
    });
  }

  /**
   * Start OAuth2 flow using Google Identity Services
   */
  async requestCalendarAccess(): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Google OAuth2 Client ID not configured. Please set VITE_GOOGLE_OAUTH_CLIENT_ID in your environment variables.');
    }

    try {
      await this.initTokenClient();
      
      // Request access token
      this.tokenClient.requestAccessToken({
        prompt: 'consent'
      });
    } catch (error) {
      console.error('❌ Error requesting calendar access:', error);
      throw error;
    }
  }

  /**
   * Handle OAuth2 callback - this is no longer needed with Google Identity Services
   * but keeping for backward compatibility
   */
  async handleOAuthCallback(): Promise<boolean> {
    // With Google Identity Services, the callback is handled automatically
    // Check if we have a token stored
    const token = await this.getStoredToken();
    return !!token;
  }

  /**
   * Check if user has calendar access
   */
  async hasCalendarAccess(): Promise<boolean> {
    const token = await this.getStoredToken();
    if (!token) return false;

    try {
      // Test the token by making a simple API call
      const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: {
          'Authorization': `Bearer ${token.accessToken}`,
        },
      });

      if (!response.ok) {
        // If token is invalid, remove it from Firestore
        const currentUserId = this.getCurrentUserId();
        if (currentUserId) {
          await this.deleteTokenFromFirestore(currentUserId);
        }
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking calendar access:', error);
      return false;
    }
  }

  /**
   * Revoke access and clear stored tokens
   */
  async revokeAccess(): Promise<void> {
    const token = await this.getStoredToken();
    const currentUserId = this.getCurrentUserId();
    
    if (token) {
      try {
        // Revoke the token with Google
        await fetch(`https://oauth2.googleapis.com/revoke?token=${token.accessToken}`, {
          method: 'POST',
        });
        console.log('✅ Token revoked with Google');
      } catch (error) {
        console.error('Error revoking token with Google:', error);
      }
    }

    // Clear stored token from Firestore
    if (currentUserId) {
      await this.deleteTokenFromFirestore(currentUserId);
    }
    
    // Clean up legacy localStorage token
    localStorage.removeItem('google_calendar_token');
    console.log('✅ Google Calendar access revoked and token cleared');
  }

  /**
   * Clear token when user logs out (call this from auth service)
   * Note: We don't clear from Firestore on logout - tokens persist across sessions
   */
  clearTokenOnLogout(): void {
    // Only clear legacy localStorage token
    localStorage.removeItem('google_calendar_token');
    console.log('✅ Legacy Google Calendar token cleared on logout (Firestore tokens persist)');
  }

  // =================== MULTI-ACCOUNT METHODS ===================

  /**
   * Get user profile information from Google
   */
  private async getUserProfile(accessToken: string): Promise<{
    id: string;
    email: string;
    name: string;
    picture?: string;
  }> {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user profile');
      }

      const profile = await response.json();
      return {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
      };
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  }

  /**
   * Get available calendars for a Google account
   */
  private async getAccountCalendars(accessToken: string): Promise<GoogleCalendar[]> {
    try {
      const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch calendars');
      }

      const data = await response.json();
      return data.items?.map((item: any) => ({
        id: item.id,
        name: item.summary,
        primary: item.primary || false,
        accessRole: item.accessRole,
        backgroundColor: item.backgroundColor,
        syncEnabled: item.primary || false, // Default: sync primary calendar only
      })) || [];
    } catch (error) {
      console.error('Error fetching calendars:', error);
      throw error;
    }
  }

  /**
   * Add a new Google account (multi-account support)
   */
  async addGoogleAccount(): Promise<UserGoogleAccount> {
    if (!this.isConfigured()) {
      throw new Error('Google OAuth2 Client ID not configured. Please set VITE_GOOGLE_OAUTH_CLIENT_ID in your environment variables.');
    }

    const currentUserId = this.getCurrentUserId();
    if (!currentUserId) {
      throw new Error('User not authenticated');
    }

    return new Promise(async (resolve, reject) => {
      try {
        await this.loadGoogleIdentityServices();

        // Create a new token client for this account addition
        const addAccountTokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: this.clientId,
          scope: this.scope,
          callback: async (response: any) => {
            try {
              if (response.error) {
                console.error('❌ OAuth error:', response.error);
                reject(new Error(`OAuth error: ${response.error}`));
                return;
              }

              console.log('✅ OAuth success for new account');

              // Get user profile
              const profile = await this.getUserProfile(response.access_token);
              
              // Get available calendars
              const calendars = await this.getAccountCalendars(response.access_token);

              // Check if this account already exists
              const existingAccounts = await MultiAccountStorage.getUserGoogleAccounts(currentUserId);
              const existingAccount = existingAccounts.find(acc => acc.googleAccountId === profile.id);

              if (existingAccount) {
                // Update existing account token
                await MultiAccountStorage.updateAccountToken(
                  existingAccount.id,
                  response.access_token,
                  Date.now() + (response.expires_in * 1000)
                );

                // Update calendars
                await MultiAccountStorage.updateAccountCalendars(existingAccount.id, calendars);

                console.log('✅ Updated existing Google account');
                resolve(existingAccount);
                return;
              }

              // Create new account
              const accountId = `${currentUserId}_${profile.id}`;
              const newAccount: UserGoogleAccount = {
                id: accountId,
                userId: currentUserId,
                googleAccountId: profile.id,
                email: profile.email,
                name: profile.name,
                picture: profile.picture,
                accessToken: response.access_token,
                expiresAt: Date.now() + (response.expires_in * 1000),
                grantedAt: new Date(),
                lastUsed: new Date(),
                isActive: existingAccounts.length === 0, // First account is active
                calendars,
                syncEnabled: true,
                createdAt: new Date(),
                updatedAt: new Date(),
              };

              // Save the new account
              await MultiAccountStorage.saveUserGoogleAccount(newAccount);

              // Initialize sync settings if this is the first account
              if (existingAccounts.length === 0) {
                const syncSettings: UserSyncSettings = {
                  userId: currentUserId,
                  syncMode: 'single',
                  defaultAccountId: accountId,
                  accountCalendarMappings: {
                    [accountId]: calendars.reduce((acc, cal) => {
                      acc[cal.id] = cal.syncEnabled;
                      return acc;
                    }, {} as { [key: string]: boolean })
                  },
                  createdAt: new Date(),
                  updatedAt: new Date(),
                };

                await MultiAccountStorage.saveUserSyncSettings(syncSettings);
              }

              console.log('✅ New Google account added successfully');
              resolve(newAccount);

            } catch (error) {
              console.error('❌ Error processing OAuth callback:', error);
              reject(error);
            }
          }
        });

        // Request access token with consent prompt to allow account selection
        addAccountTokenClient.requestAccessToken({
          prompt: 'select_account' // This allows users to select different accounts
        });

      } catch (error) {
        console.error('❌ Error adding Google account:', error);
        reject(error);
      }
    });
  }

  /**
   * Get all connected Google accounts for current user
   */
  async getConnectedAccounts(): Promise<UserGoogleAccount[]> {
    const currentUserId = this.getCurrentUserId();
    if (!currentUserId) {
      return [];
    }

    try {
      return await MultiAccountStorage.getUserGoogleAccounts(currentUserId);
    } catch (error) {
      console.error('Error fetching connected accounts:', error);
      return [];
    }
  }

  /**
   * Switch to a different Google account as default
   */
  async switchAccount(accountId: string): Promise<void> {
    const currentUserId = this.getCurrentUserId();
    if (!currentUserId) {
      throw new Error('User not authenticated');
    }

    try {
      await MultiAccountStorage.setActiveAccount(currentUserId, accountId);
      console.log('✅ Switched to account:', accountId);
    } catch (error) {
      console.error('Error switching account:', error);
      throw error;
    }
  }

  /**
   * Remove a Google account
   */
  async removeAccount(accountId: string): Promise<void> {
    try {
      // Get account details for token revocation
      const account = await MultiAccountStorage.getUserGoogleAccount(accountId);
      
      if (account) {
        // Revoke the token with Google
        try {
          await fetch(`https://oauth2.googleapis.com/revoke?token=${account.accessToken}`, {
            method: 'POST',
          });
          console.log('✅ Token revoked with Google for account:', accountId);
        } catch (error) {
          console.error('Error revoking token with Google:', error);
        }
      }

      // Delete from Firestore (including related sync states)
      await MultiAccountStorage.deleteUserGoogleAccount(accountId);
      console.log('✅ Google account removed:', accountId);
    } catch (error) {
      console.error('Error removing account:', error);
      throw error;
    }
  }

  /**
   * Refresh token for a specific account
   */
  async refreshAccountToken(accountId: string): Promise<void> {
    // Note: Google Identity Services handles token refresh automatically
    // This method is kept for future implementation if needed
    console.log('Token refresh is handled automatically by Google Identity Services');
  }

  /**
   * Check if user has any Google accounts connected
   */
  async hasAnyAccounts(): Promise<boolean> {
    const currentUserId = this.getCurrentUserId();
    if (!currentUserId) {
      return false;
    }

    return await MultiAccountStorage.hasAnyAccounts(currentUserId);
  }

  /**
   * Get active (default) account
   */
  async getActiveAccount(): Promise<UserGoogleAccount | null> {
    const currentUserId = this.getCurrentUserId();
    if (!currentUserId) {
      return null;
    }

    return await MultiAccountStorage.getActiveAccount(currentUserId);
  }

  /**
   * Check if user has calendar access (multi-account version)
   * Returns true if at least one account has valid access
   */
  async hasMultiAccountCalendarAccess(): Promise<boolean> {
    try {
      const accounts = await this.getConnectedAccounts();
      
      if (accounts.length === 0) {
        return false;
      }

      // Check if at least one account has valid access
      for (const account of accounts) {
        if (account.syncEnabled && Date.now() < account.expiresAt) {
          // Test the token
          try {
            const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
              headers: {
                'Authorization': `Bearer ${account.accessToken}`,
              },
            });

            if (response.ok) {
              return true; // At least one account has valid access
            }
          } catch (error) {
            console.warn(`Token invalid for account ${account.email}:`, error);
          }
        }
      }

      return false;
    } catch (error) {
      console.error('Error checking multi-account calendar access:', error);
      return false;
    }
  }

  /**
   * Migrate existing single-account setup to multi-account
   */
  async migrateToMultiAccount(): Promise<UserGoogleAccount | null> {
    const currentUserId = this.getCurrentUserId();
    if (!currentUserId) {
      return null;
    }

    try {
      return await MultiAccountStorage.migrateLegacyToken(currentUserId);
    } catch (error) {
      console.error('Error migrating to multi-account:', error);
      return null;
    }
  }
}

export const googleOAuthService = new GoogleOAuthService();