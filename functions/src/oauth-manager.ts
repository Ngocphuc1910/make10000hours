import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { config } from 'firebase-functions';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';

// Google OAuth configuration from Firebase Functions config
const GOOGLE_CLIENT_ID = config().google?.oauth_client_id || 
  '496225832510-4q5t9iogu4dhpsbenkg6f5oqmbgudae8.apps.googleusercontent.com';

const GOOGLE_CLIENT_SECRET = config().google?.oauth_client_secret || '';

const REDIRECT_URI = 'postmessage'; // For web applications using authorization code flow

// Initialize Firestore
const db = getFirestore();

// OAuth2 client instance
const oauth2Client = new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  REDIRECT_URI
);

/**
 * Token data interface for secure storage
 */
interface TokenData {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  email: string;
  name?: string;
  picture?: string;
  grantedAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

/**
 * Exchange authorization code for tokens (first-time authorization)
 * This function is called from the client after user authorizes in popup
 */
export const exchangeCodeForTokens = onCall(
  {
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 60,
  },
  async (request) => {
    const { code } = request.data;
    const userId = request.auth?.uid;

    // Validate input
    if (!userId) {
      logger.error('exchangeCodeForTokens: No authenticated user');
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    if (!code) {
      logger.error('exchangeCodeForTokens: No authorization code provided');
      throw new HttpsError('invalid-argument', 'Authorization code is required');
    }

    if (!GOOGLE_CLIENT_ID) {
      logger.error('exchangeCodeForTokens: Google OAuth client ID not configured');
      throw new HttpsError('failed-precondition', 'Google OAuth not configured');
    }

    try {
      logger.info(`exchangeCodeForTokens: Processing code exchange for user ${userId}`);

      // Exchange authorization code for tokens
      const { tokens } = await oauth2Client.getToken(code);
      
      if (!tokens.access_token || !tokens.refresh_token) {
        logger.error('exchangeCodeForTokens: Missing required tokens in response', { 
          hasAccessToken: !!tokens.access_token,
          hasRefreshToken: !!tokens.refresh_token 
        });
        throw new HttpsError('internal', 'Failed to obtain required tokens');
      }

      // Get user info using the access token
      oauth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2('v2');
      const userInfo = await oauth2.userinfo.get({ auth: oauth2Client });

      const email = userInfo.data.email;
      if (!email) {
        logger.error('exchangeCodeForTokens: Failed to get user email');
        throw new HttpsError('internal', 'Failed to get user email');
      }

      // Calculate expiration time
      const expiresIn = (tokens as any).expires_in as number || 3600;
      const expiresAt = Date.now() + expiresIn * 1000;

      // Prepare token data for secure storage
      const tokenData: TokenData = {
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        email,
        name: userInfo.data.name || undefined,
        picture: userInfo.data.picture || undefined,
        grantedAt: FirebaseFirestore.Timestamp.now(),
        updatedAt: FirebaseFirestore.Timestamp.now(),
      };

      // Store tokens securely in private collection
      await db.collection('private_tokens').doc(userId).set(tokenData);

      logger.info(`exchangeCodeForTokens: Successfully stored tokens for user ${userId}`, {
        email,
        expiresAt: new Date(expiresAt).toISOString()
      });

      // Return user info (not tokens for security)
      return {
        success: true,
        email,
        name: userInfo.data.name,
        picture: userInfo.data.picture,
        expiresAt
      };

    } catch (error) {
      logger.error('exchangeCodeForTokens: Error during token exchange', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        stack: error instanceof Error ? error.stack : undefined
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError('internal', 'Failed to exchange authorization code for tokens');
    }
  }
);

/**
 * Get fresh access token with automatic refresh
 * This function ensures the client always gets a valid access token
 */
export const getFreshAccessToken = onCall(
  {
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 30,
  },
  async (request) => {
    const userId = request.auth?.uid;

    if (!userId) {
      logger.error('getFreshAccessToken: No authenticated user');
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    try {
      logger.info(`getFreshAccessToken: Getting fresh token for user ${userId}`);

      // Get stored token data
      const tokenDoc = await db.collection('private_tokens').doc(userId).get();
      
      if (!tokenDoc.exists) {
        logger.warn(`getFreshAccessToken: No tokens found for user ${userId}`);
        throw new HttpsError('not-found', 'No Google Calendar authorization found. Please re-authorize.');
      }

      const tokenData = tokenDoc.data() as TokenData;
      
      // Check if token needs refresh (5 minutes buffer)
      const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
      const needsRefresh = tokenData.expiresAt < fiveMinutesFromNow;

      if (needsRefresh) {
        logger.info(`getFreshAccessToken: Token needs refresh for user ${userId}`, {
          expiresAt: new Date(tokenData.expiresAt).toISOString(),
          currentTime: new Date().toISOString()
        });

        // Set up OAuth client with stored tokens
        oauth2Client.setCredentials({
          access_token: tokenData.accessToken,
          refresh_token: tokenData.refreshToken,
        });

        // Refresh the access token
        const { credentials } = await oauth2Client.refreshAccessToken();
        
        if (!credentials.access_token) {
          logger.error(`getFreshAccessToken: Failed to refresh token for user ${userId}`);
          throw new HttpsError('unauthenticated', 'Failed to refresh token. Please re-authorize.');
        }

        // Calculate new expiration time
        const credentialsExpiresIn = (credentials as any).expires_in as number || 3600;
        const newExpiresAt = Date.now() + credentialsExpiresIn * 1000;

        // Update stored token data
        const updatedTokenData: Partial<TokenData> = {
          accessToken: credentials.access_token,
          expiresAt: newExpiresAt,
          updatedAt: FirebaseFirestore.Timestamp.now(),
        };

        // Update refresh token if provided
        if (credentials.refresh_token) {
          updatedTokenData.refreshToken = credentials.refresh_token;
        }

        await db.collection('private_tokens').doc(userId).update(updatedTokenData);

        logger.info(`getFreshAccessToken: Successfully refreshed token for user ${userId}`, {
          newExpiresAt: new Date(newExpiresAt).toISOString()
        });

        return {
          accessToken: credentials.access_token,
          expiresAt: newExpiresAt,
          refreshed: true
        };
      } else {
        logger.info(`getFreshAccessToken: Token still valid for user ${userId}`, {
          expiresAt: new Date(tokenData.expiresAt).toISOString()
        });

        return {
          accessToken: tokenData.accessToken,
          expiresAt: tokenData.expiresAt,
          refreshed: false
        };
      }

    } catch (error) {
      logger.error('getFreshAccessToken: Error getting fresh token', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        stack: error instanceof Error ? error.stack : undefined
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      // Check if it's an auth error requiring re-authorization
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('invalid_grant') || 
          errorMessage.includes('invalid_token')) {
        throw new HttpsError('unauthenticated', 'Token expired or invalid. Please re-authorize Google Calendar access.');
      }

      throw new HttpsError('internal', 'Failed to get fresh access token');
    }
  }
);

/**
 * Revoke Google Calendar access and delete stored tokens
 */
export const revokeGoogleAccess = onCall(
  {
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 30,
  },
  async (request) => {
    const userId = request.auth?.uid;

    if (!userId) {
      logger.error('revokeGoogleAccess: No authenticated user');
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    try {
      logger.info(`revokeGoogleAccess: Revoking access for user ${userId}`);

      // Get stored token data
      const tokenDoc = await db.collection('private_tokens').doc(userId).get();
      
      if (tokenDoc.exists) {
        const tokenData = tokenDoc.data() as TokenData;

        try {
          // Revoke token with Google
          await oauth2Client.revokeToken(tokenData.accessToken);
          logger.info(`revokeGoogleAccess: Successfully revoked token with Google for user ${userId}`);
        } catch (revokeError) {
          logger.warn(`revokeGoogleAccess: Failed to revoke token with Google for user ${userId}`, {
            error: revokeError instanceof Error ? revokeError.message : String(revokeError)
          });
          // Continue with deletion even if revocation fails
        }

        // Delete stored token data
        await db.collection('private_tokens').doc(userId).delete();
        logger.info(`revokeGoogleAccess: Successfully deleted stored tokens for user ${userId}`);
      } else {
        logger.info(`revokeGoogleAccess: No tokens found for user ${userId}`);
      }

      return { success: true };

    } catch (error) {
      logger.error('revokeGoogleAccess: Error revoking access', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        stack: error instanceof Error ? error.stack : undefined
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError('internal', 'Failed to revoke Google Calendar access');
    }
  }
);

/**
 * Check if user has valid Google Calendar authorization
 */
export const checkGoogleAuth = onCall(
  {
    region: 'us-central1',
    memory: '128MiB',
    timeoutSeconds: 10,
  },
  async (request) => {
    const userId = request.auth?.uid;

    if (!userId) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    try {
      const tokenDoc = await db.collection('private_tokens').doc(userId).get();
      
      if (!tokenDoc.exists) {
        return { 
          hasAccess: false,
          email: null,
          expiresAt: null
        };
      }

      const tokenData = tokenDoc.data() as TokenData;
      
      return {
        hasAccess: true,
        email: tokenData.email,
        name: tokenData.name,
        picture: tokenData.picture,
        expiresAt: tokenData.expiresAt
      };

    } catch (error) {
      logger.error('checkGoogleAuth: Error checking auth status', {
        error: error instanceof Error ? error.message : String(error),
        userId
      });

      throw new HttpsError('internal', 'Failed to check Google authorization status');
    }
  }
);