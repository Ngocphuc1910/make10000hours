import { logger } from 'firebase-functions';
import { LemonSqueezyWebhookEvent, SubscriptionAttributes, WebhookProcessingResult } from '../types';
import { updateUserSubscription, createSubscriptionUpdateData, getUserByEmail, getUserByAuthId } from '../utils';
import { extractUserIdentifier } from '../validation';

/**
 * Handle subscription_expired event
 * This event occurs when a subscription has ended after being cancelled
 * User should be downgraded to free tier immediately
 */
export async function handleSubscriptionExpired(
  event: LemonSqueezyWebhookEvent,
  eventId: string
): Promise<WebhookProcessingResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Processing subscription_expired event:', {
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
    // Firebase UIDs don't contain @ symbol, so check for that instead of length
    if (!userIdentifier.includes('@')) {
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
    
    // Create subscription update data for expired subscription
    const subscriptionData = createSubscriptionUpdateData(attributes, 'subscription_expired');
    
    // Force downgrade to free tier on expiration
    subscriptionData.plan = 'free';
    subscriptionData.status = 'expired';
    subscriptionData.cancelAtPeriodEnd = false; // No longer relevant
    
    // Clear billing information
    subscriptionData.billing = undefined;
    subscriptionData.currentPeriodEnd = undefined;
    subscriptionData.currentPeriodStart = undefined;
    subscriptionData.trialEnd = undefined;
    
    // Update user subscription
    await updateUserSubscription(userId, subscriptionData, 'subscription_expired');

    logger.info('Subscription expired - user downgraded to free:', {
      eventId,
      userId,
      subscriptionId: event.data.id,
      plan: subscriptionData.plan,
      status: subscriptionData.status
    });

    return {
      success: true,
      eventType: 'subscription_expired',
      eventId,
      userId,
      processingTime: Date.now() - startTime
    };

  } catch (error) {
    logger.error('Error processing subscription_expired event:', {
      eventId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return {
      success: false,
      eventType: 'subscription_expired',
      eventId,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    };
  }
}