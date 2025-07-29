# Lemon Squeezy Webhook Setup Guide

This guide explains how to set up and configure the Lemon Squeezy webhook integration for handling subscription lifecycle events.

## Environment Variables

Add the following environment variable to your Firebase Functions configuration:

### Required Variables

```bash
# Lemon Squeezy Webhook Secret (from Lemon Squeezy dashboard)
LEMON_SQUEEZY_WEBHOOK_SECRET=[YOUR_WEBHOOK_SIGNING_SECRET]
```

### Setting Environment Variables

**For Firebase Functions:**
```bash
firebase functions:config:set lemon.squeezy.webhook.secret="[YOUR_WEBHOOK_SIGNING_SECRET]"
```

**For Local Development:**
Create a `.env` file in the `functions/` directory:
```bash
LEMON_SQUEEZY_WEBHOOK_SECRET=[YOUR_WEBHOOK_SIGNING_SECRET]
```

## Webhook Configuration in Lemon Squeezy

1. Go to your Lemon Squeezy dashboard
2. Navigate to Settings → Webhooks
3. Click "Add webhook"
4. Set the webhook URL to: `https://us-central1-make10000hours.cloudfunctions.net/lemonSqueezyWebhook`
5. Select the following events:
   - `subscription_created`
   - `subscription_updated`
   - `subscription_cancelled`
   - `subscription_expired`
   - `subscription_payment_success`
   - `subscription_payment_failed`
   - `order_created`
6. Copy the webhook signing secret and set it as the environment variable above

## Webhook Events Handled

| Event | Description | Action |
|-------|-------------|--------|
| `subscription_created` | New subscription created | Upgrade user to Pro tier |
| `subscription_updated` | Subscription details changed | Update subscription info |
| `subscription_cancelled` | Subscription cancelled | Set cancellation flag, keep Pro until end date |
| `subscription_expired` | Subscription ended | Downgrade user to free tier |
| `subscription_payment_success` | Payment successful | Confirm active Pro subscription |
| `subscription_payment_failed` | Payment failed | Mark subscription as past_due |
| `order_created` | New order placed | Log transaction for audit |

## Firestore Collections

The webhook integration creates and uses these Firestore collections:

### `webhookLogs`
Stores all webhook events for debugging and audit trail:
```typescript
{
  eventId: string,
  eventType: string,
  userId?: string,
  payload: LemonSqueezyWebhookEvent,
  processingResult: WebhookProcessingResult,
  timestamp: Date,
  signature: string,
  retryCount?: number
}
```

### `transactions`
Stores order information for audit purposes:
```typescript
{
  userId: string,
  orderId: string,
  orderNumber: number,
  status: string,
  total: number,
  currency: string,
  customerEmail: string,
  customerName: string,
  productName: string,
  variantName: string,
  createdAt: Date,
  processedAt: Date,
  eventId: string
}
```

### `users` (updated)
User documents are updated with subscription information:
```typescript
{
  // existing fields...
  subscription: {
    plan: 'free' | 'pro',
    billing?: 'monthly' | 'annual',
    status: 'active' | 'cancelled' | 'past_due' | 'on_trial' | 'expired',
    lemonSqueezyId?: string,
    customerId?: string,
    currentPeriodStart?: Date,
    currentPeriodEnd?: Date,
    cancelAtPeriodEnd?: boolean,
    trialEnd?: Date,
    cardBrand?: string,
    cardLastFour?: string,
    updatedAt: Date
  }
}
```

## User Identification

The webhook handler identifies users using:

1. **Custom Data (Preferred)**: If you pass `user_id` in the checkout custom data
2. **Email Fallback**: Matches the email from the webhook to a user in Firestore

To ensure proper user identification, pass the Firebase Auth UID in the checkout custom data:

```typescript
// In your checkout creation
const checkoutData = {
  // ... other checkout data
  checkout_data: {
    custom: {
      user_id: currentUser.uid // Firebase Auth UID
    }
  }
};
```

## Testing

### Local Testing

1. Start the Firebase emulator:
   ```bash
   cd functions
   npm run serve
   ```

2. Use the webhook tester:
   ```typescript
   import { WebhookTester } from './src/webhooks/lemonSqueezy/test/webhookTester';
   
   const tester = new WebhookTester(
     '[YOUR_WEBHOOK_SECRET]',
     'http://localhost:5001/make10000hours/us-central1/lemonSqueezyWebhook'
   );
   
   await tester.testSubscriptionLifecycle('test_user_id', 'test@example.com');
   ```

### Production Testing

Use Lemon Squeezy's test mode to send real webhook events without affecting live data.

## Deployment

1. Set the environment variable in Firebase:
   ```bash
   firebase functions:config:set lemon.squeezy.webhook.secret="[YOUR_SECRET]"
   ```

2. Deploy the functions:
   ```bash
   npm run deploy
   ```

3. Update the webhook URL in Lemon Squeezy dashboard to point to the deployed function.

## Monitoring

### Health Check

The webhook includes a health check endpoint:
- URL: `https://us-central1-make10000hours.cloudfunctions.net/webhookHealth`
- Returns status of both calendar and Lemon Squeezy webhooks

### Logging

All webhook events are logged in Firebase Functions logs and stored in the `webhookLogs` collection for debugging.

### Error Handling

- Signature verification failures return 401
- Invalid payloads return 400
- Business logic errors return 200 (to prevent Lemon Squeezy retries)
- Server errors return 500 (triggers Lemon Squeezy retries)

## Security

- All webhooks are verified using HMAC-SHA256 signature verification
- Rate limiting prevents abuse (100 requests per 5 minutes per IP)
- Idempotency prevents duplicate event processing
- Sensitive data is logged with appropriate redaction

## Troubleshooting

### Common Issues

1. **Signature Verification Failed**
   - Check that the webhook secret is correct
   - Ensure the secret matches exactly what's in Lemon Squeezy

2. **User Not Found**
   - Verify user identification logic
   - Check that custom data or email matching is working

3. **Event Already Processed**
   - This is normal behavior for duplicate events
   - Check `webhookLogs` collection for processing history

### Debug Information

Check the Firebase Functions logs for detailed processing information:
```bash
firebase functions:log --only lemonSqueezyWebhook
```