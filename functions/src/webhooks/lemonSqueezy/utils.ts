import { logger } from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';
import { LemonSqueezyWebhookEvent, SubscriptionUpdateData, WebhookLogEntry, WebhookProcessingResult } from './types';

// Lazy initialize db to avoid initialization issues
let db: any = null;
const getDb = () => {
  if (!db) {
    db = getFirestore();
  }
  return db;
};

/**
 * Log webhook event for debugging and audit trail
 */
export async function logWebhookEvent(
  eventId: string,
  eventType: string,
  payload: LemonSqueezyWebhookEvent,
  result: WebhookProcessingResult,
  signature: string,
  userId?: string,
  retryCount = 0
): Promise<void> {
  try {
    const logEntry: WebhookLogEntry = {
      eventId,
      eventType,
      userId,
      payload,
      processingResult: result,
      timestamp: new Date(),
      signature,
      retryCount
    };

    await getDb().collection('webhookLogs').doc(eventId).set(logEntry);
    
    logger.info('Webhook event logged:', {
      eventId,
      eventType,
      success: result.success,
      userId,
      processingTime: result.processingTime
    });
  } catch (error) {
    logger.error('Error logging webhook event:', error);
    // Don't throw - logging errors shouldn't fail webhook processing
  }
}

/**
 * Check if webhook event has already been processed (idempotency)
 */
export async function isEventAlreadyProcessed(eventId: string): Promise<boolean> {
  try {
    const doc = await getDb().collection('webhookLogs').doc(eventId).get();
    return doc.exists;
  } catch (error) {
    logger.error('Error checking event processing status:', error);
    return false; // Assume not processed if we can't check
  }
}

/**
 * Update user subscription data in Firestore
 */
export async function updateUserSubscription(
  userId: string,
  subscriptionData: SubscriptionUpdateData
): Promise<void> {
  try {
    const userRef = getDb().collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      throw new Error(`User not found: ${userId}`);
    }

    // Update subscription data
    await userRef.update({
      subscription: subscriptionData,
      updatedAt: new Date()
    });

    logger.info('User subscription updated:', {
      userId,
      plan: subscriptionData.plan,
      status: subscriptionData.status
    });
  } catch (error) {
    logger.error('Error updating user subscription:', error);
    throw error;
  }
}

/**
 * Get user by email address
 */
export async function getUserByEmail(email: string): Promise<string | null> {
  try {
    const usersRef = getDb().collection('users');
    const snapshot = await usersRef.where('email', '==', email).limit(1).get();
    
    if (snapshot.empty) {
      logger.warn('User not found for email:', email);
      return null;
    }

    return snapshot.docs[0].id;
  } catch (error) {
    logger.error('Error finding user by email:', error);
    return null;
  }
}

/**
 * Get user by Firebase Auth UID (from custom data)
 */
export async function getUserByAuthId(authId: string): Promise<string | null> {
  try {
    const userDoc = await getDb().collection('users').doc(authId).get();
    return userDoc.exists ? authId : null;
  } catch (error) {
    logger.error('Error finding user by auth ID:', error);
    return null;
  }
}

/**
 * Parse billing period from variant name or ID
 */
export function parseBillingPeriod(variantName?: string, variantId?: string): 'monthly' | 'annual' | undefined {
  const name = (variantName || '').toLowerCase();
  const id = variantId || '';
  
  // Check variant name
  if (name.includes('monthly') || name.includes('month')) {
    return 'monthly';
  }
  if (name.includes('annual') || name.includes('yearly') || name.includes('year')) {
    return 'annual';
  }
  
  // Check variant ID (from our configuration)
  if (id === '903137') { // Pro Monthly variant ID
    return 'monthly';
  }
  if (id === '922210') { // Pro Annual variant ID
    return 'annual';
  }
  
  return undefined;
}

/**
 * Map Lemon Squeezy subscription status to our internal status
 */
export function mapSubscriptionStatus(lemonSqueezyStatus: string): 'active' | 'cancelled' | 'past_due' | 'on_trial' | 'expired' {
  switch (lemonSqueezyStatus.toLowerCase()) {
    case 'active':
      return 'active';
    case 'cancelled':
      return 'cancelled';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'on_trial':
      return 'on_trial';
    case 'expired':
      return 'expired';
    case 'paused':
      return 'cancelled'; // Treat paused as cancelled for our purposes
    default:
      logger.warn('Unknown Lemon Squeezy status:', lemonSqueezyStatus);
      return 'expired'; // Default to expired for unknown statuses
  }
}

/**
 * Create subscription update data from Lemon Squeezy subscription attributes
 */
export function createSubscriptionUpdateData(
  attributes: any,
  eventType: string
): SubscriptionUpdateData {
  const billingPeriod = parseBillingPeriod(attributes.variant_name, attributes.variant_id?.toString());
  const status = mapSubscriptionStatus(attributes.status);
  
  // Determine plan based on status and event type
  let plan: 'free' | 'pro' = 'free';
  if (status === 'active' || status === 'on_trial' || (status === 'cancelled' && eventType !== 'subscription_expired')) {
    plan = 'pro';
  }

  const updateData: SubscriptionUpdateData = {
    plan,
    billing: billingPeriod,
    status,
    lemonSqueezyId: attributes.id?.toString() || attributes.subscription_id?.toString(),
    customerId: attributes.customer_id?.toString(),
    updatedAt: new Date()
  };

  // Add optional fields if available
  if (attributes.renews_at) {
    updateData.currentPeriodEnd = new Date(attributes.renews_at);
  }
  
  if (attributes.created_at) {
    updateData.currentPeriodStart = new Date(attributes.created_at);
  }
  
  if (attributes.trial_ends_at) {
    updateData.trialEnd = new Date(attributes.trial_ends_at);
  }
  
  if (attributes.ends_at) {
    updateData.cancelAtPeriodEnd = true;
  }
  
  if (attributes.card_brand) {
    updateData.cardBrand = attributes.card_brand;
  }
  
  if (attributes.card_last_four) {
    updateData.cardLastFour = attributes.card_last_four;
  }

  return updateData;
}

/**
 * Rate limiting utility
 */
export class RateLimiter {
  private static requests: Map<string, number[]> = new Map();
  
  static isAllowed(identifier: string, maxRequests = 100, windowMs = 5 * 60 * 1000): boolean {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];
    
    // Remove requests outside the window
    const validRequests = requests.filter(time => now - time < windowMs);
    
    if (validRequests.length >= maxRequests) {
      return false;
    }
    
    // Add current request
    validRequests.push(now);
    this.requests.set(identifier, validRequests);
    
    return true;
  }
}

/**
 * Performance timing utility
 */
export class Timer {
  private startTime: number;
  
  constructor() {
    this.startTime = Date.now();
  }
  
  elapsed(): number {
    return Date.now() - this.startTime;
  }
}