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
 * Enhanced error tracking for monitoring
 */
export async function trackError(
  context: string,
  error: Error | string,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    const errorData = {
      context,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : { message: error },
      metadata,
      timestamp: new Date(),
      severity: getSeverityLevel(context, error),
      environment: process.env.NODE_ENV || 'unknown'
    };

    // Store in errors collection for monitoring
    await getDb().collection('errors').add(errorData);

    // Also log for immediate visibility
    logger.error(`[${context}] Error tracked:`, {
      error: error instanceof Error ? error.message : error,
      metadata,
      severity: errorData.severity
    });
  } catch (trackingError) {
    // Don't let error tracking break the main flow
    logger.error('Failed to track error:', trackingError);
  }
}

/**
 * Get error severity level for prioritization
 */
function getSeverityLevel(context: string, error: Error | string): 'critical' | 'high' | 'medium' | 'low' {
  const errorMessage = error instanceof Error ? error.message : error;
  
  // Critical errors that affect revenue
  if (
    context.includes('payment') ||
    context.includes('subscription') ||
    errorMessage.includes('signature verification') ||
    errorMessage.includes('User not found')
  ) {
    return 'critical';
  }
  
  // High priority errors
  if (
    context.includes('webhook') ||
    errorMessage.includes('database') ||
    errorMessage.includes('Firestore')
  ) {
    return 'high';
  }
  
  // Medium priority
  if (
    context.includes('notification') ||
    context.includes('sync')
  ) {
    return 'medium';
  }
  
  return 'low';
}

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

    // Track error if processing failed
    if (!result.success) {
      await trackError(
        `webhook_${eventType}`,
        result.error || 'Unknown webhook processing error',
        {
          eventId,
          eventType,
          userId,
          processingTime: result.processingTime,
          retryCount
        }
      );
    }
  } catch (error) {
    logger.error('Error logging webhook event:', error);
    await trackError('webhook_logging', error instanceof Error ? error : 'Webhook logging failed');
  }
}

/**
 * Enhanced webhook event deduplication with timing checks
 */
export async function isEventAlreadyProcessed(
  eventId: string,
  eventType: string,
  subscriptionId?: string
): Promise<{ processed: boolean; reason?: string }> {
  try {
    // Check primary event ID
    const primaryDoc = await getDb().collection('webhookLogs').doc(eventId).get();
    if (primaryDoc.exists) {
      const data = primaryDoc.data();
      return {
        processed: true,
        reason: `Event already processed at ${data?.timestamp?.toDate?.()?.toISOString()}`
      };
    }

    // Additional check for similar events in recent timeframe
    if (subscriptionId) {
      const recentCutoff = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      
      const recentEvents = await getDb()
        .collection('webhookLogs')
        .where('eventType', '==', eventType)
        .where('payload.data.id', '==', subscriptionId)
        .where('timestamp', '>', recentCutoff)
        .where('processingResult.success', '==', true)
        .limit(1)
        .get();

      if (!recentEvents.empty) {
        return {
          processed: true,
          reason: `Similar ${eventType} event already processed recently for subscription ${subscriptionId}`
        };
      }
    }

    return { processed: false };
  } catch (error) {
    logger.error('Error checking event processing status:', error);
    await trackError('event_deduplication', error instanceof Error ? error : 'Deduplication check failed');
    return { processed: false }; // Assume not processed if we can't check
  }
}

/**
 * Legacy function for backward compatibility
 */
export async function isEventAlreadyProcessed_legacy(eventId: string): Promise<boolean> {
  const result = await isEventAlreadyProcessed(eventId, '', undefined);
  return result.processed;
}

/**
 * Send user notification about subscription change
 */
export async function sendSubscriptionNotification(
  userId: string,
  subscriptionData: SubscriptionUpdateData,
  eventType: string
): Promise<void> {
  try {
    // Create notification document
    const notification = {
      userId,
      type: 'subscription_change',
      title: getNotificationTitle(eventType, subscriptionData),
      message: getNotificationMessage(eventType, subscriptionData),
      data: {
        plan: subscriptionData.plan,
        status: subscriptionData.status,
        billing: subscriptionData.billing,
        eventType
      },
      read: false,
      createdAt: new Date(),
      priority: getNotificationPriority(eventType)
    };

    // Store notification in user's notifications subcollection
    await getDb()
      .collection('users')
      .doc(userId)
      .collection('notifications')
      .add(notification);

    logger.info('Subscription notification sent:', {
      userId,
      eventType,
      title: notification.title
    });
  } catch (error) {
    logger.error('Error sending subscription notification:', error);
    // Don't throw - notification failure shouldn't block subscription update
  }
}

/**
 * Get notification title based on event type
 */
function getNotificationTitle(eventType: string, data: SubscriptionUpdateData): string {
  switch (eventType) {
    case 'subscription_created':
      return '🎉 Welcome to Pro!';
    case 'subscription_payment_success':
      return '✅ Payment Successful';
    case 'subscription_payment_failed':
      return '⚠️ Payment Failed';
    case 'subscription_cancelled':
      return '📋 Subscription Cancelled';
    case 'subscription_expired':
      return '⏰ Subscription Expired';
    case 'subscription_updated':
      return '🔄 Subscription Updated';
    default:
      return '📢 Subscription Change';
  }
}

/**
 * Get notification message based on event type
 */
function getNotificationMessage(eventType: string, data: SubscriptionUpdateData): string {
  switch (eventType) {
    case 'subscription_created':
      return `Your Pro ${data.billing} subscription is now active! Enjoy all premium features.`;
    case 'subscription_payment_success':
      return `Your ${data.billing} subscription payment was processed successfully.`;
    case 'subscription_payment_failed':
      return 'We had trouble processing your payment. Please update your payment method to continue your Pro access.';
    case 'subscription_cancelled':
      return data.cancelAtPeriodEnd 
        ? `Your subscription is cancelled but you'll keep Pro access until ${data.currentPeriodEnd?.toLocaleDateString()}.`
        : 'Your subscription has been cancelled.';
    case 'subscription_expired':
      return 'Your Pro subscription has expired and you\'ve been moved to the free plan. Upgrade anytime to restore Pro features.';
    case 'subscription_updated':
      return `Your subscription has been updated to ${data.plan} plan.`;
    default:
      return `Your subscription status has changed to ${data.status}.`;
  }
}

/**
 * Get notification priority based on event type
 */
function getNotificationPriority(eventType: string): 'high' | 'medium' | 'low' {
  switch (eventType) {
    case 'subscription_payment_failed':
    case 'subscription_expired':
      return 'high';
    case 'subscription_created':
    case 'subscription_cancelled':
      return 'medium';
    default:
      return 'low';
  }
}

/**
 * Update user subscription data in Firestore
 */
export async function updateUserSubscription(
  userId: string,
  subscriptionData: SubscriptionUpdateData,
  eventType?: string
): Promise<void> {
  try {
    const userRef = getDb().collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      throw new Error(`User not found: ${userId}`);
    }

    // Log the subscription data before update for debugging
    logger.info('Updating user subscription with data:', {
      userId,
      subscriptionData: JSON.stringify(subscriptionData)
    });

    // Update subscription data with proper serialization
    const updateData = {
      subscription: JSON.parse(JSON.stringify(subscriptionData)), // Ensure proper serialization
      updatedAt: new Date()
    };

    await userRef.update(updateData);

    logger.info('User subscription updated:', {
      userId,
      plan: subscriptionData.plan,
      status: subscriptionData.status
    });

    // Send notification if event type is provided
    if (eventType) {
      await sendSubscriptionNotification(userId, subscriptionData, eventType);
    }
  } catch (error) {
    logger.error('Error updating user subscription:', error);
    throw error;
  }
}

/**
 * Get user by email address with improved fallback logic
 */
export async function getUserByEmail(email: string): Promise<string | null> {
  try {
    const usersRef = getDb().collection('users');
    
    // Try exact match first
    let snapshot = await usersRef.where('email', '==', email).limit(1).get();
    
    if (!snapshot.empty) {
      return snapshot.docs[0].id;
    }
    
    // Try case-insensitive match as fallback
    const emailLower = email.toLowerCase();
    snapshot = await usersRef.where('email', '==', emailLower).limit(1).get();
    
    if (!snapshot.empty) {
      logger.info('User found with case-insensitive email match:', { 
        originalEmail: email, 
        foundEmail: emailLower 
      });
      return snapshot.docs[0].id;
    }
    
    // Try finding by display name or other identifiers as last resort
    // This helps with edge cases where email might have changed
    const allUsers = await usersRef.get();
    for (const doc of allUsers.docs) {
      const userData = doc.data();
      if (userData.email && userData.email.toLowerCase() === emailLower) {
        logger.info('User found with manual case-insensitive search:', { 
          originalEmail: email, 
          foundEmail: userData.email 
        });
        return doc.id;
      }
    }
    
    logger.warn('User not found for email after all fallback attempts:', email);
    return null;
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

/**
 * Determine if an error should trigger webhook retry
 */
export function shouldRetryWebhook(error: string): boolean {
  const retryableErrors = [
    'User not found',                    // User doc might not be created yet
    'Error updating user subscription',  // Temporary database issues
    'Error finding user by email',      // Temporary database issues
    'Error finding user by auth ID',    // Temporary database issues
    'Firestore operation failed',       // Database connectivity issues
    'Database timeout',                  // Temporary performance issues
    'Internal server error'             // Generic server issues
  ];
  
  const nonRetryableErrors = [
    'Could not extract user identifier', // Bad webhook payload - won't fix with retry
    'Invalid webhook signature',         // Security issue - don't retry
    'Missing subscription status',       // Bad webhook data - won't fix
    'Invalid event type'                 // Logic error - won't fix
  ];
  
  // Check if error is explicitly non-retryable
  if (nonRetryableErrors.some(nonRetryable => error.includes(nonRetryable))) {
    return false;
  }
  
  // Check if error is explicitly retryable
  if (retryableErrors.some(retryable => error.includes(retryable))) {
    return true;
  }
  
  // Default: retry unknown errors (conservative approach)
  return true;
}