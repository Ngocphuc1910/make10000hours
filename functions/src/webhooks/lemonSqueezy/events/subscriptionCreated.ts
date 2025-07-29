import { logger } from 'firebase-functions';
import { LemonSqueezyWebhookEvent, SubscriptionAttributes, WebhookProcessingResult } from '../types';
import { updateUserSubscription, createSubscriptionUpdateData, getUserByEmail, getUserByAuthId } from '../utils';
import { extractUserIdentifier } from '../validation';

/**
 * Handle subscription_created event
 * This event occurs when a new subscription is successfully created
 */
export async function handleSubscriptionCreated(
  event: LemonSqueezyWebhookEvent,
  eventId: string
): Promise<WebhookProcessingResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Processing subscription_created event:', {
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
    const subscriptionData = createSubscriptionUpdateData(attributes, 'subscription_created');
    
    // Special handling for new subscriptions
    subscriptionData.plan = 'pro'; // Always upgrade to Pro on subscription creation
    
    // Update user subscription
    await updateUserSubscription(userId, subscriptionData, 'subscription_created');

    logger.info('Subscription created successfully:', {
      eventId,
      userId,
      subscriptionId: event.data.id,
      plan: subscriptionData.plan,
      billing: subscriptionData.billing,
      status: subscriptionData.status
    });

    return {
      success: true,
      eventType: 'subscription_created',
      eventId,
      userId,
      processingTime: Date.now() - startTime
    };

  } catch (error) {
    logger.error('Error processing subscription_created event:', {
      eventId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return {
      success: false,
      eventType: 'subscription_created',
      eventId,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    };
  }
}