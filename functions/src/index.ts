import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { logger } from 'firebase-functions';

// Initialize Firebase Admin
initializeApp();

/**
 * Secure checkout creation (Callable Function)
 */
export { createCheckout } from './checkout/createCheckout';

/**
 * Placeholder for Calendar Webhook (temporarily disabled)
 */
export const calendarWebhook = onRequest(
  {
    cors: false,
    timeoutSeconds: 60,
    memory: '256MiB',
    region: 'us-central1',
    invoker: 'public'
  },
  async (request, response) => {
    logger.info('Calendar webhook temporarily disabled');
    response.status(200).send('Calendar webhook temporarily disabled');
  }
);

/**
 * Health check endpoint for monitoring
 */
export const webhookHealth = onRequest(
  {
    cors: true,
    timeoutSeconds: 10,
    memory: '128MiB',
    region: 'us-central1',
    invoker: 'public'
  },
  async (request, response) => {
    try {
      response.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: ['secure-checkout']
      });
    } catch (error) {
      logger.error('Health check error:', error);
      response.status(500).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);