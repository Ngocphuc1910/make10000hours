import { logger } from 'firebase-functions';
import { LemonSqueezyWebhookEvent, SubscriptionAttributes, WebhookProcessingResult } from '../types';
import { updateUserSubscription, createSubscriptionUpdateData, getUserByEmail, getUserByAuthId } from '../utils';
import { extractUserIdentifier } from '../validation';

/**
 * Handle subscription_payment_success event
 * This event occurs when a subscription payment is successful (including renewals)
 */
export async function handlePaymentSuccess(
  event: LemonSqueezyWebhookEvent,
  eventId: string
): Promise<WebhookProcessingResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Processing subscription_payment_success event:', {
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
    const subscriptionData = createSubscriptionUpdateData(attributes, 'subscription_payment_success');
    
    // Successful payment should ensure active Pro subscription
    subscriptionData.plan = 'pro';
    subscriptionData.status = 'active';
    subscriptionData.cancelAtPeriodEnd = false; // Reset cancellation flag on successful payment
    
    // Update billing period information
    if (attributes.renews_at) {
      subscriptionData.currentPeriodEnd = new Date(attributes.renews_at);
    }
    
    // Update user subscription
    await updateUserSubscription(userId, subscriptionData);

    logger.info('Payment success processed - subscription confirmed active:', {
      eventId,
      userId,
      subscriptionId: event.data.id,
      plan: subscriptionData.plan,
      billing: subscriptionData.billing,
      status: subscriptionData.status,
      renewsAt: attributes.renews_at
    });

    return {
      success: true,
      eventType: 'subscription_payment_success',
      eventId,
      userId,
      processingTime: Date.now() - startTime
    };

  } catch (error) {
    logger.error('Error processing subscription_payment_success event:', {
      eventId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return {
      success: false,
      eventType: 'subscription_payment_success',
      eventId,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    };
  }
}