import { createHmac } from 'crypto';
import { LemonSqueezyWebhookEvent } from '../types';

/**
 * Webhook testing utilities for development and testing
 */
export class WebhookTester {
  private webhookSecret: string;
  private webhookUrl: string;

  constructor(webhookSecret: string, webhookUrl: string) {
    this.webhookSecret = webhookSecret;
    this.webhookUrl = webhookUrl;
  }

  /**
   * Generate webhook signature
   */
  private generateSignature(payload: string): string {
    return createHmac('sha256', this.webhookSecret)
      .update(payload, 'utf8')
      .digest('hex');
  }

  /**
   * Create test subscription_created event
   */
  createSubscriptionCreatedEvent(userId: string, userEmail: string): LemonSqueezyWebhookEvent {
    return {
      meta: {
        event_name: 'subscription_created',
        custom_data: {
          user_id: userId
        }
      },
      data: {
        type: 'subscriptions',
        id: 'test_subscription_123',
        attributes: {
          store_id: 202193,
          customer_id: 12345,
          order_id: 67890,
          order_item_id: 11111,
          product_id: 579250,
          variant_id: 903137, // Pro Monthly
          product_name: 'Make10000Hours Pro',
          variant_name: 'Pro Monthly',
          user_name: 'Test User',
          user_email: userEmail,
          status: 'active',
          status_formatted: 'Active',
          card_brand: 'visa',
          card_last_four: '4242',
          pause: null,
          cancelled: false,
          trial_ends_at: null,
          billing_anchor: 1,
          first_subscription_item: {
            id: 22222,
            subscription_id: 123,
            price_id: 33333,
            quantity: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          urls: {
            update_payment_method: 'https://example.com/update',
            customer_portal: 'https://example.com/portal'
          },
          renews_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
          ends_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      }
    };
  }

  /**
   * Create test subscription_cancelled event
   */
  createSubscriptionCancelledEvent(userId: string, userEmail: string): LemonSqueezyWebhookEvent {
    return {
      meta: {
        event_name: 'subscription_cancelled',
        custom_data: {
          user_id: userId
        }
      },
      data: {
        type: 'subscriptions',
        id: 'test_subscription_123',
        attributes: {
          store_id: 202193,
          customer_id: 12345,
          order_id: 67890,
          order_item_id: 11111,
          product_id: 579250,
          variant_id: 903137,
          product_name: 'Make10000Hours Pro',
          variant_name: 'Pro Monthly',
          user_name: 'Test User',
          user_email: userEmail,
          status: 'cancelled',
          status_formatted: 'Cancelled',
          card_brand: 'visa',
          card_last_four: '4242',
          pause: null,
          cancelled: true,
          trial_ends_at: null,
          billing_anchor: 1,
          first_subscription_item: {
            id: 22222,
            subscription_id: 123,
            price_id: 33333,
            quantity: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          urls: {
            update_payment_method: 'https://example.com/update',
            customer_portal: 'https://example.com/portal'
          },
          renews_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      }
    };
  }

  /**
   * Create test subscription_expired event
   */
  createSubscriptionExpiredEvent(userId: string, userEmail: string): LemonSqueezyWebhookEvent {
    return {
      meta: {
        event_name: 'subscription_expired',
        custom_data: {
          user_id: userId
        }
      },
      data: {
        type: 'subscriptions',
        id: 'test_subscription_123',
        attributes: {
          store_id: 202193,
          customer_id: 12345,
          order_id: 67890,
          order_item_id: 11111,
          product_id: 579250,
          variant_id: 903137,
          product_name: 'Make10000Hours Pro',
          variant_name: 'Pro Monthly',
          user_name: 'Test User',
          user_email: userEmail,
          status: 'expired',
          status_formatted: 'Expired',
          card_brand: 'visa',
          card_last_four: '4242',
          pause: null,
          cancelled: true,
          trial_ends_at: null,
          billing_anchor: 1,
          first_subscription_item: {
            id: 22222,
            subscription_id: 123,
            price_id: 33333,
            quantity: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          urls: {
            update_payment_method: 'https://example.com/update',
            customer_portal: 'https://example.com/portal'
          },
          renews_at: new Date(Date.now() - 1000).toISOString(), // Past date
          ends_at: new Date(Date.now() - 1000).toISOString(), // Past date
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      }
    };
  }

  /**
   * Create test payment_success event
   */
  createPaymentSuccessEvent(userId: string, userEmail: string): LemonSqueezyWebhookEvent {
    return {
      meta: {
        event_name: 'subscription_payment_success',
        custom_data: {
          user_id: userId
        }
      },
      data: {
        type: 'subscriptions',
        id: 'test_subscription_123',
        attributes: {
          store_id: 202193,
          customer_id: 12345,
          order_id: 67890,
          order_item_id: 11111,
          product_id: 579250,
          variant_id: 903137,
          product_name: 'Make10000Hours Pro',
          variant_name: 'Pro Monthly',
          user_name: 'Test User',
          user_email: userEmail,
          status: 'active',
          status_formatted: 'Active',
          card_brand: 'visa',
          card_last_four: '4242',
          pause: null,
          cancelled: false,
          trial_ends_at: null,
          billing_anchor: 1,
          first_subscription_item: {
            id: 22222,
            subscription_id: 123,
            price_id: 33333,
            quantity: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          urls: {
            update_payment_method: 'https://example.com/update',
            customer_portal: 'https://example.com/portal'
          },
          renews_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          ends_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      }
    };
  }

  /**
   * Send test webhook event
   */
  async sendTestWebhook(event: LemonSqueezyWebhookEvent): Promise<Response> {
    const payload = JSON.stringify(event);
    const signature = this.generateSignature(payload);

    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Event-Name': event.meta.event_name,
        'X-Signature': `sha256=${signature}`,
        'User-Agent': 'LemonSqueezy/Webhook-Test'
      },
      body: payload
    });

    return response;
  }

  /**
   * Test complete subscription lifecycle
   */
  async testSubscriptionLifecycle(userId: string, userEmail: string) {
    console.log('🧪 Testing subscription lifecycle...');
    
    // 1. Subscription created
    console.log('1. Testing subscription_created...');
    const createdEvent = this.createSubscriptionCreatedEvent(userId, userEmail);
    const createdResponse = await this.sendTestWebhook(createdEvent);
    console.log(`   Status: ${createdResponse.status}`);
    console.log(`   Response: ${await createdResponse.text()}`);

    // Wait a bit between events
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 2. Payment success
    console.log('2. Testing subscription_payment_success...');
    const paymentEvent = this.createPaymentSuccessEvent(userId, userEmail);
    const paymentResponse = await this.sendTestWebhook(paymentEvent);
    console.log(`   Status: ${paymentResponse.status}`);
    console.log(`   Response: ${await paymentResponse.text()}`);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. Subscription cancelled
    console.log('3. Testing subscription_cancelled...');
    const cancelledEvent = this.createSubscriptionCancelledEvent(userId, userEmail);
    const cancelledResponse = await this.sendTestWebhook(cancelledEvent);
    console.log(`   Status: ${cancelledResponse.status}`);
    console.log(`   Response: ${await cancelledResponse.text()}`);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // 4. Subscription expired
    console.log('4. Testing subscription_expired...');
    const expiredEvent = this.createSubscriptionExpiredEvent(userId, userEmail);
    const expiredResponse = await this.sendTestWebhook(expiredEvent);
    console.log(`   Status: ${expiredResponse.status}`);
    console.log(`   Response: ${await expiredResponse.text()}`);

    console.log('✅ Subscription lifecycle test completed!');
  }
}

// Example usage (for testing):
// const tester = new WebhookTester('your_webhook_secret', 'http://localhost:5001/make10000hours/us-central1/lemonSqueezyWebhook');
// await tester.testSubscriptionLifecycle('test_user_id', 'test@example.com');