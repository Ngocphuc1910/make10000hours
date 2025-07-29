import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';

/**
 * Simple test function to debug authentication
 */
export const testAuth = onCall(
  { 
    region: 'us-central1',
    enforceAppCheck: false, // Disabled for testing
  },
  async (request) => {
    logger.info('=== testAuth Function Called ===');
    logger.info('Request exists:', !!request);
    logger.info('Request.auth exists:', !!request.auth);
    logger.info('Request.data exists:', !!request.data);
    
    // Log the entire request structure (safely)
    try {
      logger.info('Request keys:', Object.keys(request));
      if (request.auth) {
        logger.info('Auth keys:', Object.keys(request.auth));
        logger.info('Auth.uid:', request.auth.uid);
        if (request.auth.token) {
          logger.info('Token keys:', Object.keys(request.auth.token));
          logger.info('Token.email:', request.auth.token.email);
        }
      }
    } catch (e) {
      logger.error('Error inspecting request:', e);
    }

    return {
      success: true,
      hasAuth: !!request.auth,
      authUid: request.auth?.uid,
      authEmail: request.auth?.token?.email,
      timestamp: new Date().toISOString()
    };
  }
);