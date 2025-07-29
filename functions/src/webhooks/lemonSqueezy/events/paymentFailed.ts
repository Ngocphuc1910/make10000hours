import { logger } from 'firebase-functions';
import { LemonSqueezyWebhookEvent, SubscriptionAttributes, WebhookProcessingResult } from '../types';
import { updateUserSubscription, createSubscriptionUpdateData, getUserByEmail, getUserByAuthId } from '../utils';
import { extractUserIdentifier } from '../validation';

/**
 * Handle subscription_payment_failed event
 * This event occurs when a subscription renewal payment fails
 */
export async function handlePaymentFailed(
  event: LemonSqueezyWebhookEvent,
  eventId: string
): Promise<WebhookProcessingResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Processing subscription_payment_failed event:', {
      eventId,
      subscriptionId: event.data.id
    });

    // Extract user identifier
    const userIdentifier = extractUserIdentifier(event);
    if (!userIdentifier) {
      throw new Error('Could not extract user identifier from webhook payload');
    }

    // Find user in our database
    let userId: string | null = null;
    
    // Try by Firebase Auth UID first (if passed in custom data)
    if (userIdentifier.length === 28) { // Firebase UID format
      userId = await getUserByAuthId(userIdentifier);
    }
    
    // Fallback to email lookup
    if (!userId) {
      userId = await getUserByEmail(userIdentifier);
    }
    
    if (!userId) {
      throw new Error(`User not found for identifier: ${userIdentifier}`);
    }

    const attributes = event.data.attributes as SubscriptionAttributes;
    
    // Validate subscription data
    if (!attributes.status) {
      throw new Error('Missing subscription status in webhook payload');
    }

    // Create subscription update data
    const subscriptionData = createSubscriptionUpdateData(attributes, 'subscription_payment_failed');
    
    // Failed payment typically means past_due status
    subscriptionData.status = 'past_due';
    
    // Keep Pro access during grace period, but mark as past due
    // Lemon Squeezy typically provides a grace period before downgrading
    subscriptionData.plan = 'pro';
    
    // Update user subscription
    await updateUserSubscription(userId, subscriptionData);

    logger.warn('Payment failed - subscription marked as past due:', {
      eventId,
      userId,
      subscriptionId: event.data.id,
      plan: subscriptionData.plan,
      status: subscriptionData.status,
      lemonSqueezyStatus: attributes.status
    });

    return {
      success: true,
      eventType: 'subscription_payment_failed',
      eventId,
      userId,
      processingTime: Date.now() - startTime
    };

  } catch (error) {
    logger.error('Error processing subscription_payment_failed event:', {
      eventId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return {
      success: false,
      eventType: 'subscription_payment_failed',
      eventId,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    };
  }
}