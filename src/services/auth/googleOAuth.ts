// Google OAuth2 service for Calendar API access using Google Identity Services
// This is separate from Firebase Auth and uses the proper client-side flow

interface GoogleTokenInfo {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  userId: string; // Firebase user ID to ensure token belongs to current user
}

// Google Identity Services types
declare global {
  interface Window {
    google: any;
  }
}

export class GoogleOAuthService {
  private clientId: string;
  private scope: string = 'https://www.googleapis.com/auth/calendar';
  private tokenClient: any = null;

  constructor() {
    this.clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID || '';
    console.log('🔍 OAuth service initialized:', {
      clientId: this.clientId ? `${this.clientId.substring(0, 10)}...` : 'Not set',
      scope: this.scope,
      rawEnvValue: import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID,
      envType: typeof import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID,
      allEnvVars: import.meta.env
    });
  }

  /**
   * Check if OAuth2 client ID is configured
   */
  isConfigured(): boolean {
    const configured = !!this.clientId;
    console.log('🔍 OAuth2 configuration check:', {
      clientId: this.clientId ? `${this.clientId.substring(0, 10)}...` : 'Not set',
      configured,
      clientIdLength: this.clientId.length,
      clientIdTrimmed: this.clientId.trim(),
      isEmpty: this.clientId === '',
      isUndefined: this.clientId === undefined,
      isNull: this.clientId === null
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
      const projectId = 'make10000hours'; // Your Firebase project ID
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
   * Get stored access token from localStorage for current user
   */
  getStoredToken(): GoogleTokenInfo | null {
    try {
      const currentUserId = this.getCurrentUserId();
      
      if (!currentUserId) {
        console.log('🔍 No current user, cannot check token');
        return null;
      }

      const stored = localStorage.getItem('google_calendar_token');
      console.log('🔍 Checking stored token:', stored ? 'Found' : 'Not found');
      
      if (!stored) return null;

      const token = JSON.parse(stored);
      
      // Check if token belongs to current user
      if (token.userId !== currentUserId) {
        console.warn('⚠️ Token belongs to different user, removing...');
        localStorage.removeItem('google_calendar_token');
        return null;
      }
      
      console.log('🔍 Token details:', {
        hasAccessToken: !!token.accessToken,
        userId: token.userId,
        currentUserId: currentUserId,
        expiresAt: new Date(token.expiresAt).toISOString(),
        isExpired: Date.now() >= token.expiresAt
      });
      
      // Check if token is expired
      if (Date.now() >= token.expiresAt) {
        console.warn('⚠️ Token expired, removing...');
        localStorage.removeItem('google_calendar_token');
        return null;
      }

      console.log('✅ Valid token found for current user');
      return token;
    } catch (error) {
      console.error('Error reading stored token:', error);
      return null;
    }
  }

  /**
   * Store access token in localStorage with user ID
   */
  private storeToken(tokenInfo: Omit<GoogleTokenInfo, 'userId'>): void {
    try {
      const currentUserId = this.getCurrentUserId();
      
      if (!currentUserId) {
        throw new Error('No current user to store token for');
      }

      const tokenWithUser: GoogleTokenInfo = {
        ...tokenInfo,
        userId: currentUserId
      };

      localStorage.setItem('google_calendar_token', JSON.stringify(tokenWithUser));
      console.log('✅ Token stored in localStorage for user:', currentUserId);
    } catch (error) {
      console.error('Error storing token:', error);
      throw error;
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
      callback: (response: any) => {
        if (response.error) {
          console.error('❌ OAuth error:', response.error);
          throw new Error(`OAuth error: ${response.error}`);
        }
        
        console.log('✅ OAuth success:', {
          hasAccessToken: !!response.access_token,
          expiresIn: response.expires_in
        });
        
        // Store the token
        this.storeToken({
          accessToken: response.access_token,
          expiresAt: Date.now() + (response.expires_in * 1000)
        });
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
    const token = this.getStoredToken();
    return !!token;
  }

  /**
   * Check if user has calendar access
   */
  async hasCalendarAccess(): Promise<boolean> {
    const token = this.getStoredToken();
    if (!token) return false;

    try {
      // Test the token by making a simple API call
      const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: {
          'Authorization': `Bearer ${token.accessToken}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Error checking calendar access:', error);
      return false;
    }
  }

  /**
   * Revoke access and clear stored tokens
   */
  async revokeAccess(): Promise<void> {
    const token = this.getStoredToken();
    if (token) {
      try {
        // Revoke the token
        await fetch(`https://oauth2.googleapis.com/revoke?token=${token.accessToken}`, {
          method: 'POST',
        });
      } catch (error) {
        console.error('Error revoking token:', error);
      }
    }

    // Clear stored token
    localStorage.removeItem('google_calendar_token');
    console.log('✅ Google Calendar access revoked and token cleared');
  }

  /**
   * Clear token when user logs out (call this from auth service)
   */
  clearTokenOnLogout(): void {
    localStorage.removeItem('google_calendar_token');
    console.log('✅ Google Calendar token cleared on logout');
  }
}

export const googleOAuthService = new GoogleOAuthService();