import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';

/**
 * Simple test checkout function to isolate the issue
 */
export const simpleCheckout = onCall(
  { 
    region: 'us-central1',
    enforceAppCheck: false,
  },
  async (request) => {
    logger.info('=== simpleCheckout Function Called ===');
    logger.info('Request.auth exists:', !!request.auth);
    
    if (!request.auth) {
      logger.error('❌ No auth context in simpleCheckout');
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    logger.info('✅ Auth context found in simpleCheckout');
    logger.info('User ID:', request.auth.uid);
    logger.info('User email:', request.auth.token?.email);

    return {
      success: true,
      message: 'Simple checkout test passed',
      userId: request.auth.uid,
      userEmail: request.auth.token?.email
    };
  }
);