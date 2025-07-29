import { logger } from 'firebase-functions';
import { LemonSqueezyWebhookEvent, OrderAttributes, WebhookProcessingResult } from '../types';
import { getUserByEmail, getUserByAuthId } from '../utils';
import { extractUserIdentifier } from '../validation';
import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

/**
 * Handle order_created event
 * This event occurs when a new order is successfully placed
 * Used primarily for transaction logging and preparing for subscription creation
 */
export async function handleOrderCreated(
  event: LemonSqueezyWebhookEvent,
  eventId: string
): Promise<WebhookProcessingResult> {
  const startTime = Date.now();
  
  try {
    logger.info('Processing order_created event:', {
      eventId,
      orderId: event.data.id
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

    const attributes = event.data.attributes as OrderAttributes;
    
    // Validate order data
    if (!attributes.status) {
      throw new Error('Missing order status in webhook payload');
    }

    // Log the transaction for audit purposes
    const transactionData = {
      userId,
      orderId: event.data.id,
      orderNumber: attributes.order_number,
      status: attributes.status,
      total: attributes.total,
      currency: attributes.currency,
      customerEmail: attributes.user_email,
      customerName: attributes.user_name,
      productName: attributes.first_order_item?.product_name || 'Unknown Product',
      variantName: attributes.first_order_item?.variant_name || 'Unknown Variant',
      createdAt: new Date(attributes.created_at),
      processedAt: new Date(),
      eventId
    };

    // Store transaction record
    await db.collection('transactions').doc(event.data.id).set(transactionData);

    logger.info('Order created and transaction logged:', {
      eventId,
      userId,
      orderId: event.data.id,
      orderNumber: attributes.order_number,
      status: attributes.status,
      total: attributes.total,
      currency: attributes.currency,
      productName: attributes.first_order_item?.product_name
    });

    return {
      success: true,
      eventType: 'order_created',
      eventId,
      userId,
      processingTime: Date.now() - startTime
    };

  } catch (error) {
    logger.error('Error processing order_created event:', {
      eventId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return {
      success: false,
      eventType: 'order_created',
      eventId,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime
    };
  }
}