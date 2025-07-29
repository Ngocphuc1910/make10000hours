import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { handleSubscriptionCreated } from './webhooks/lemonSqueezy/events/subscriptionCreated';
import { LemonSqueezyWebhookEvent } from './webhooks/lemonSqueezy/types';

/**
 * Test function to simulate webhook processing
 */
export const testWebhookProcessing = onCall(
  { 
    region: 'us-central1',
    enforceAppCheck: false,
  },
  async (request) => {
    try {
      logger.info('🧪 Testing webhook processing...');

      // Get current user info
      const userEmail = request.auth?.token?.email || 'ngocphuc159tl@gmail.com';
      const userId = request.auth?.uid;

      // Mock webhook event data with proper user identification
      const mockEvent: LemonSqueezyWebhookEvent = {
        meta: {
          event_name: 'subscription_created',
          custom_data: {
            webhook_id: 'test-webhook-123',
            user_id: userId, // Add user ID to custom data
            email: userEmail // Add email to custom data as backup
          }
        },
        data: {
          type: 'subscriptions',
          id: 'test-sub-123',
          attributes: {
            status: 'active',
            product_name: 'Pro Monthly',
            variant_name: 'Monthly Subscription',
            billing_anchor: Date.now(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            user_email: userEmail, // Add user email to attributes
            checkout_data: {
              email: userEmail,
              custom: {
                user_id: userId
              }
            }
          }
        }
      };

      // Test the subscription creation handler directly
      const result = await handleSubscriptionCreated(mockEvent, 'test-event-123');

      logger.info('✅ Webhook processing test completed:', result);

      return {
        success: result.success,
        message: 'Webhook processing test completed',
        result: result
      };

    } catch (error) {
      logger.error('❌ Webhook processing test failed:', error);
      throw error;
    }
  }
);