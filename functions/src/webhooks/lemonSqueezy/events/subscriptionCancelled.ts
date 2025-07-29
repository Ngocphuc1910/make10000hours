import { logger } from 'firebase-functions';
import { LemonSqueezyWebhookEvent, SubscriptionAttributes, WebhookProcessingResult } from '../types';
import { updateUserSubscription, createSubscriptionUpdateData, getUserByEmail, getUserByAuthId } from '../utils';
import { extractUserIdentifier } from '../validation';

/**
 * Handle subscription_cancelled event
 * This event occurs when a subscription is cancelled manually
 * Note: User typically keeps access until end of billing period
 */
export async function handleSubscriptionCancelled(
  event: LemonSqueezyWebhookEvent,
  eventId: string
): Promise<WebhookProcessingResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Processing subscription_cancelled event:', {
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
    
    // Validate subscription data
    if (!attributes.status) {
      throw new Error('Missing subscription status in webhook payload');
    }

    // Create subscription update data
    const subscriptionData = createSubscriptionUpdateData(attributes, 'subscription_cancelled');
    
    // For cancelled subscriptions, keep Pro access until end of period
    subscriptionData.status = 'cancelled';
    subscriptionData.cancelAtPeriodEnd = true;
    
    // If there's an end date, user keeps Pro access until then
    if (attributes.ends_at) {
      const endDate = new Date(attributes.ends_at);
      const now = new Date();
      
      if (endDate > now) {
        subscriptionData.plan = 'pro'; // Keep Pro until end date
        subscriptionData.currentPeriodEnd = endDate;
      } else {
        subscriptionData.plan = 'free'; // Already expired
      }
    } else {
      // No end date specified, keep Pro for now (will be handled by expiration event)
      subscriptionData.plan = 'pro';
    }
    
    // Update user subscription
    await updateUserSubscription(userId, subscriptionData, 'subscription_cancelled');

    logger.info('Subscription cancelled successfully:', {
      eventId,
      userId,
      subscriptionId: event.data.id,
      plan: subscriptionData.plan,
      status: subscriptionData.status,
      endsAt: attributes.ends_at
    });

    return {
      success: true,
      eventType: 'subscription_cancelled',
      eventId,
      userId,
      processingTime: Date.now() - startTime
    };

  } catch (error) {
    logger.error('Error processing subscription_cancelled event:', {
      eventId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return {
      success: false,
      eventType: 'subscription_cancelled',
      eventId,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    };
  }
}