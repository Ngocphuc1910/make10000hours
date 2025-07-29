// Event handler exports
export { handleSubscriptionCreated } from './subscriptionCreated';
export { handleSubscriptionUpdated } from './subscriptionUpdated';
export { handleSubscriptionCancelled } from './subscriptionCancelled';
export { handleSubscriptionExpired } from './subscriptionExpired';
export { handlePaymentSuccess } from './paymentSuccess';
export { handlePaymentFailed } from './paymentFailed';
export { handleOrderCreated } from './orderCreated';

import { LemonSqueezyWebhookEvent, WebhookProcessingResult, WebhookEventType } from '../types';
import { handleSubscriptionCreated } from './subscriptionCreated';
import { handleSubscriptionUpdated } from './subscriptionUpdated';
import { handleSubscriptionCancelled } from './subscriptionCancelled';
import { handleSubscriptionExpired } from './subscriptionExpired';
import { handlePaymentSuccess } from './paymentSuccess';
import { handlePaymentFailed } from './paymentFailed';
import { handleOrderCreated } from './orderCreated';

/**
 * Route webhook events to appropriate handlers
 */
export async function routeWebhookEvent(
  eventType: WebhookEventType,
  event: LemonSqueezyWebhookEvent,
  eventId: string
): Promise<WebhookProcessingResult> {
  
  switch (eventType) {
    case 'subscription_created':
      return handleSubscriptionCreated(event, eventId);
      
    case 'subscription_updated':
      return handleSubscriptionUpdated(event, eventId);
      
    case 'subscription_cancelled':
      return handleSubscriptionCancelled(event, eventId);
      
    case 'subscription_expired':
      return handleSubscriptionExpired(event, eventId);
      
    case 'subscription_payment_success':
      return handlePaymentSuccess(event, eventId);
      
    case 'subscription_payment_failed':
      return handlePaymentFailed(event, eventId);
      
    case 'order_created':
      return handleOrderCreated(event, eventId);
      
    // Less critical events - we'll log them but not process
    case 'subscription_paused':
    case 'subscription_unpaused':
    case 'subscription_resumed':
    case 'subscription_payment_recovered':
    case 'subscription_payment_refunded':
    case 'order_refunded':
      return {
        success: true,
        eventType,
        eventId,
        processingTime: 0
      };
      
    default:
      throw new Error(`Unsupported event type: ${eventType}`);
  }
}