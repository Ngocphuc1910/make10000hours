import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';

// Lemon Squeezy API configuration (server-side only)
const LEMON_SQUEEZY_API_BASE = 'https://api.lemonsqueezy.com/v1';

interface CheckoutRequest {
  billing: 'monthly' | 'annual';
}

interface SubscriptionPlan {
  tier: 'pro';
  billing: 'monthly' | 'annual';
  variantId: string;
  price: number;
}

// Get subscription plans using environment variables
const getSubscriptionPlans = (): Record<string, SubscriptionPlan> => {
  return {
    'pro-monthly': {
      tier: 'pro',
      billing: 'monthly',
      variantId: process.env.LEMON_SQUEEZY_PRO_MONTHLY_VARIANT_ID || '903137',
      price: 1 // Test price
    },
    'pro-annual': {
      tier: 'pro',
      billing: 'annual',
      variantId: process.env.LEMON_SQUEEZY_PRO_ANNUAL_VARIANT_ID || '922210',
      price: 1.1 // Test price
    }
  };
};

/**
 * Secure server-side checkout creation
 */
export const createCheckout = onCall<CheckoutRequest>(
  { 
    region: 'us-central1',
    enforceAppCheck: process.env.NODE_ENV === 'production', // Enable in production
  },
  async (request) => {
    try {
      // Verify user is authenticated
      if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated');
      }

      const { billing } = request.data;
      const userId = request.auth.uid;
      const userEmail = request.auth.token.email;

      logger.info('Creating checkout for user:', {
        userId,
        email: userEmail,
        billing
      });

      // Validate input
      if (!billing || !['monthly', 'annual'].includes(billing)) {
        throw new HttpsError('invalid-argument', 'Invalid billing period');
      }

      // Get environment variables (v2 uses process.env only)
      const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
      const storeId = process.env.LEMON_SQUEEZY_STORE_ID;

      if (!apiKey || !storeId) {
        logger.error('Missing Lemon Squeezy environment variables');
        throw new HttpsError('internal', 'Server configuration error');
      }

      // Get plan configuration
      const planKey = `pro-${billing}`;
      const plans = getSubscriptionPlans();
      const plan = plans[planKey];
      
      if (!plan) {
        throw new HttpsError('invalid-argument', `Invalid plan: ${planKey}`);
      }

      // Create checkout data
      const checkoutData = {
        data: {
          type: 'checkouts',
          attributes: {
            checkout_options: {
              embed: false,
              media: false,
              logo: true,
              desc: true,
              discount: true,
              dark: false,
              subscription_preview: false
            },
            checkout_data: {
              email: userEmail,
              custom: {
                user_id: userId,
                plan_tier: plan.tier,
                plan_billing: plan.billing
              }
            }
          },
          relationships: {
            store: {
              data: {
                type: 'stores',
                id: storeId
              }
            },
            variant: {
              data: {
                type: 'variants',
                id: plan.variantId
              }
            }
          }
        }
      };

      // Call Lemon Squeezy API
      const response = await fetch(`${LEMON_SQUEEZY_API_BASE}/checkouts`, {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(checkoutData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        logger.error('Lemon Squeezy API error:', errorData);
        throw new HttpsError('internal', `Checkout creation failed: ${errorData.errors?.[0]?.detail || response.statusText}`);
      }

      const result = await response.json();
      const checkoutUrl = result.data.attributes.url;

      logger.info('Checkout created successfully:', {
        userId,
        billing,
        checkoutUrl: checkoutUrl.slice(0, 50) + '...'
      });

      return {
        checkoutUrl,
        planKey,
        billing
      };

    } catch (error) {
      logger.error('Error creating checkout:', error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError('internal', 'Failed to create checkout');
    }
  }
);