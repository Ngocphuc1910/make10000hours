import { logger } from 'firebase-functions';
import { Request } from 'firebase-functions/v2/https';
import { Response } from 'express';
import { 
  verifyWebhookSignature,
  validateWebhookHeaders,
  validateWebhookPayload,
  isSupportedEventType,
  generateEventKey,
  validateEnvironmentConfig
} from './validation';
import { 
  logWebhookEvent,
  isEventAlreadyProcessed,
  RateLimiter,
  Timer
} from './utils';
import { routeWebhookEvent } from './events';
import { LemonSqueezyWebhookHeaders, WebhookEventType } from './types';

/**
 * Main Lemon Squeezy webhook handler
 */
export async function handleLemonSqueezyWebhook(
  request: Request,
  response: Response
): Promise<void> {
  const timer = new Timer();
  
  try {
    // Validate environment configuration
    const envValidation = validateEnvironmentConfig();
    if (!envValidation.isValid) {
      logger.error('Environment validation failed:', envValidation.error);
      response.status(500).json({ 
        error: 'Server configuration error',
        message: envValidation.error 
      });
      return;
    }

    // Only accept POST requests
    if (request.method !== 'POST') {
      logger.warn('Invalid request method:', request.method);
      response.status(405).json({ 
        error: 'Method not allowed',
        message: 'Only POST requests are accepted' 
      });
      return;
    }

    // Rate limiting
    const clientIp = request.ip || 'unknown';
    if (!RateLimiter.isAllowed(clientIp)) {
      logger.warn('Rate limit exceeded for IP:', clientIp);
      response.status(429).json({ 
        error: 'Rate limit exceeded',
        message: 'Too many requests from this IP' 
      });
      return;
    }

    // Extract headers
    const headers = request.headers as LemonSqueezyWebhookHeaders;
    
    // Log incoming request
    logger.info('Incoming Lemon Squeezy webhook:', {
      method: request.method,
      ip: clientIp,
      eventName: headers['x-event-name'],
      userAgent: headers['user-agent'],
      contentLength: request.get('content-length')
    });

    // Validate headers
    const headerValidation = validateWebhookHeaders(headers);
    if (!headerValidation.isValid) {
      logger.error('Header validation failed:', headerValidation.error);
      response.status(400).json({ 
        error: 'Invalid headers',
        message: headerValidation.error 
      });
      return;
    }

    // Get raw body for signature verification
    const rawBody = JSON.stringify(request.body);
    const signature = headers['x-signature']!;
    const webhookSecret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET!;

    // Verify signature
    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      logger.error('Webhook signature verification failed', {
        signature: signature.slice(0, 20) + '...',
        bodyLength: rawBody.length
      });
      response.status(401).json({ 
        error: 'Unauthorized',
        message: 'Invalid webhook signature' 
      });
      return;
    }

    // Validate payload structure
    const payloadValidation = validateWebhookPayload(request.body);
    if (!payloadValidation.isValid || !payloadValidation.event) {
      logger.error('Payload validation failed:', payloadValidation.error);
      response.status(400).json({ 
        error: 'Invalid payload',
        message: payloadValidation.error 
      });
      return;
    }

    const event = payloadValidation.event;
    const eventType = event.meta.event_name;
    const eventId = generateEventKey(event);

    // Check if event type is supported
    if (!isSupportedEventType(eventType)) {
      logger.warn('Unsupported event type received:', eventType);
      response.status(200).json({ 
        message: 'Event type not supported but acknowledged',
        eventType 
      });
      return;
    }

    // Check for duplicate processing (idempotency)
    const alreadyProcessed = await isEventAlreadyProcessed(eventId);
    if (alreadyProcessed) {
      logger.info('Event already processed:', { eventId, eventType });
      response.status(200).json({ 
        message: 'Event already processed',
        eventId,
        eventType 
      });
      return;
    }

    // Process the webhook event
    logger.info('Processing webhook event:', {
      eventId,
      eventType,
      subscriptionId: event.data.id
    });

    const processingResult = await routeWebhookEvent(
      eventType as WebhookEventType,
      event,
      eventId
    );

    // Log the webhook event and result
    await logWebhookEvent(
      eventId,
      eventType,
      event,
      processingResult,
      signature,
      processingResult.userId
    );

    // Send response based on processing result
    if (processingResult.success) {
      logger.info('Webhook processed successfully:', {
        eventId,
        eventType,
        userId: processingResult.userId,
        processingTime: processingResult.processingTime,
        totalTime: timer.elapsed()
      });

      response.status(200).json({
        message: 'Webhook processed successfully',
        eventId,
        eventType,
        processingTime: processingResult.processingTime
      });
    } else {
      logger.error('Webhook processing failed:', {
        eventId,
        eventType,
        error: processingResult.error,
        processingTime: processingResult.processingTime,
        totalTime: timer.elapsed()
      });

      // Return 200 for business logic errors to prevent Lemon Squeezy retries
      // Only return 5xx for actual server errors
      response.status(200).json({
        message: 'Webhook acknowledged but processing failed',
        eventId,
        eventType,
        error: processingResult.error
      });
    }

  } catch (error) {
    const processingTime = timer.elapsed();
    
    logger.error('Unhandled error in webhook processing:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      processingTime,
      method: request.method,
      ip: request.ip
    });

    // Return 500 for unexpected server errors to trigger Lemon Squeezy retries
    response.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while processing the webhook',
      processingTime
    });
  }
}