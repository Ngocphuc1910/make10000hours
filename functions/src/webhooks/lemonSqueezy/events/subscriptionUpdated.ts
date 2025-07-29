import { logger } from 'firebase-functions';
import { LemonSqueezyWebhookEvent, SubscriptionAttributes, WebhookProcessingResult } from '../types';
import { updateUserSubscription, createSubscriptionUpdateData, getUserByEmail, getUserByAuthId } from '../utils';
import { extractUserIdentifier } from '../validation';

/**
 * Handle subscription_updated event
 * This event occurs when a subscription's data is changed or updated
 */
export async function handleSubscriptionUpdated(
  event: LemonSqueezyWebhookEvent,
  eventId: string
): Promise<WebhookProcessingResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Processing subscription_updated event:', {
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
    const subscriptionData = createSubscriptionUpdateData(attributes, 'subscription_updated');
    
    // Update user subscription
    await updateUserSubscription(userId, subscriptionData);

    logger.info('Subscription updated successfully:', {
      eventId,
      userId,
      subscriptionId: event.data.id,
      plan: subscriptionData.plan,
      billing: subscriptionData.billing,
      status: subscriptionData.status
    });

    return {
      success: true,
      eventType: 'subscription_updated',
      eventId,
      userId,
      processingTime: Date.now() - startTime
    };

  } catch (error) {
    logger.error('Error processing subscription_updated event:', {
      eventId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return {
      success: false,
      eventType: 'subscription_updated',
      eventId,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    };
  }
}