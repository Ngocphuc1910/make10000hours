import { createHmac } from 'crypto';
import { logger } from 'firebase-functions';
import { LemonSqueezyWebhookEvent, LemonSqueezyWebhookHeaders, WebhookEventType } from './types';

/**
 * Verify the webhook signature using HMAC-SHA256
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    // Remove 'sha256=' prefix if present
    const cleanSignature = signature.startsWith('sha256=') 
      ? signature.slice(7) 
      : signature;

    // Create HMAC hash of the payload
    const expectedSignature = createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');

    // Compare signatures using timing-safe comparison
    return timingSafeEqual(cleanSignature, expectedSignature);
  } catch (error) {
    logger.error('Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Validate webhook headers
 */
export function validateWebhookHeaders(headers: LemonSqueezyWebhookHeaders): {
  isValid: boolean;
  error?: string;
} {
  // Check for required headers
  if (!headers['x-signature']) {
    return {
      isValid: false,
      error: 'Missing X-Signature header'
    };
  }

  if (!headers['x-event-name']) {
    return {
      isValid: false,
      error: 'Missing X-Event-Name header'
    };
  }

  // Validate content type
  if (headers['content-type'] && !headers['content-type'].includes('application/json')) {
    return {
      isValid: false,
      error: 'Invalid content type, expected application/json'
    };
  }

  return { isValid: true };
}

/**
 * Validate webhook payload structure
 */
export function validateWebhookPayload(payload: any): {
  isValid: boolean;
  error?: string;
  event?: LemonSqueezyWebhookEvent;
} {
  try {
    // Check if payload has required structure
    if (!payload || typeof payload !== 'object') {
      return {
        isValid: false,
        error: 'Invalid payload: not an object'
      };
    }

    // Check for required meta section
    if (!payload.meta || typeof payload.meta !== 'object') {
      return {
        isValid: false,
        error: 'Invalid payload: missing meta section'
      };
    }

    // Check for event_name in meta
    if (!payload.meta.event_name || typeof payload.meta.event_name !== 'string') {
      return {
        isValid: false,
        error: 'Invalid payload: missing event_name in meta'
      };
    }

    // Check for required data section
    if (!payload.data || typeof payload.data !== 'object') {
      return {
        isValid: false,
        error: 'Invalid payload: missing data section'
      };
    }

    // Check for required data fields
    if (!payload.data.type || typeof payload.data.type !== 'string') {
      return {
        isValid: false,
        error: 'Invalid payload: missing data.type'
      };
    }

    if (!payload.data.id) {
      return {
        isValid: false,
        error: 'Invalid payload: missing data.id'
      };
    }

    if (!payload.data.attributes || typeof payload.data.attributes !== 'object') {
      return {
        isValid: false,
        error: 'Invalid payload: missing data.attributes'
      };
    }

    return {
      isValid: true,
      event: payload as LemonSqueezyWebhookEvent
    };
  } catch (error) {
    logger.error('Error validating webhook payload:', error);
    return {
      isValid: false,
      error: `Payload validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Check if event type is supported
 */
export function isSupportedEventType(eventType: string): eventType is WebhookEventType {
  const supportedEvents: WebhookEventType[] = [
    'subscription_created',
    'subscription_updated',
    'subscription_cancelled', 
    'subscription_expired',
    'subscription_paused',
    'subscription_unpaused',
    'subscription_resumed',
    'subscription_payment_success',
    'subscription_payment_failed',
    'subscription_payment_recovered',
    'subscription_payment_refunded',
    'order_created',
    'order_refunded'
  ];

  return supportedEvents.includes(eventType as WebhookEventType);
}

/**
 * Extract user identifier from webhook payload
 * This looks for user email or custom data that can identify the user
 */
export function extractUserIdentifier(event: LemonSqueezyWebhookEvent): string | null {
  try {
    // Check custom data for user ID first (if we passed it during checkout)
    if (event.meta.custom_data?.user_id) {
      return event.meta.custom_data.user_id;
    }

    // Fallback to user email from attributes
    if (event.data.attributes.user_email) {
      return event.data.attributes.user_email;
    }

    return null;
  } catch (error) {
    logger.error('Error extracting user identifier:', error);
    return null;
  }
}

/**
 * Check if event has already been processed (idempotency check)
 */
export function generateEventKey(event: LemonSqueezyWebhookEvent): string {
  return `${event.meta.event_name}_${event.data.id}`;
}

/**
 * Validate environment configuration
 */
export function validateEnvironmentConfig(): {
  isValid: boolean;
  error?: string;
} {
  const isTestMode = process.env.NODE_ENV !== 'production';
  const webhookSecret = isTestMode 
    ? process.env.LEMON_SQUEEZY_TEST_WEBHOOK_SECRET || process.env.LEMON_SQUEEZY_WEBHOOK_SECRET
    : process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    return {
      isValid: false,
      error: 'Missing LEMON_SQUEEZY_WEBHOOK_SECRET environment variable'
    };
  }

  if (webhookSecret.length < 10) {
    return {
      isValid: false,
      error: 'LEMON_SQUEEZY_WEBHOOK_SECRET appears to be too short'
    };
  }

  return { isValid: true };
}