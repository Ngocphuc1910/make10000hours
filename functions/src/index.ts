import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { logger } from 'firebase-functions';
import { handleLemonSqueezyWebhook } from './webhooks/lemonSqueezy/handler';

// Initialize Firebase Admin
initializeApp();

/**
 * Secure checkout creation (Callable Function)
 */
export { createCheckout } from './checkout/createCheckout';

/**
 * Subscription sync API for manual reconciliation
 */
export { syncSubscriptions } from './sync/subscriptionSync';

/**
 * Test authentication function for debugging
 */
export { testAuth } from './testAuth';

/**
 * Simple checkout function for debugging
 */
export { simpleCheckout } from './simpleCheckout';

/**
 * Test webhook processing function
 */
export { testWebhookProcessing } from './testWebhookProcessing';

/**
 * Test variants function
 */
export { testVariants } from './testVariants';

/**
 * Lemon Squeezy Webhook Handler
 */
export const lemonSqueezyWebhook = onRequest(
  {
    cors: false,
    timeoutSeconds: 60,
    memory: '256MiB',
    region: 'us-central1',
    invoker: 'public'
  },
  handleLemonSqueezyWebhook
);

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
        services: ['secure-checkout', 'lemon-squeezy-webhook']
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