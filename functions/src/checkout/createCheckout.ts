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
  // Use correct test variant IDs based on API results
  const isTestMode = process.env.NODE_ENV !== 'production';
  
  return {
    'pro-monthly': {
      tier: 'pro',
      billing: 'monthly',
      variantId: isTestMode ? '924211' : (process.env.LEMON_SQUEEZY_PRO_MONTHLY_VARIANT_ID || '903137'),
      price: 1 // Test price
    },
    'pro-annual': {
      tier: 'pro',
      billing: 'annual',
      variantId: isTestMode ? '924217' : (process.env.LEMON_SQUEEZY_PRO_ANNUAL_VARIANT_ID || '922210'),
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
    enforceAppCheck: false, // Disable for debugging
  },
  async (request) => {
    // MINIMAL DEBUG - Just log that we're here
    logger.info('🚀 createCheckout function started');
    
    try {
      logger.info('📋 Checking authentication...');
      
      // Verify user is authenticated
      if (!request.auth) {
        logger.error('❌ No auth context - throwing unauthenticated');
        throw new HttpsError('unauthenticated', 'User must be authenticated');
      }
      
      logger.info('✅ Auth context found');
      logger.info('👤 User ID:', request.auth.uid);

      logger.info('📝 Processing request data...');
      const { billing } = request.data;
      const userId = request.auth.uid;
      const userEmail = request.auth.token?.email;

      logger.info('📊 Request details:', { billing, userId, userEmail });

      // Validate input
      if (!billing || !['monthly', 'annual'].includes(billing)) {
        logger.error('Invalid billing period:', billing);
        throw new HttpsError('invalid-argument', 'Invalid billing period');
      }

      // Check environment variables
      const isTestMode = process.env.NODE_ENV !== 'production';
      const apiKey = isTestMode 
        ? process.env.LEMON_SQUEEZY_TEST_API_KEY || process.env.LEMON_SQUEEZY_API_KEY
        : process.env.LEMON_SQUEEZY_API_KEY;
      const storeId = process.env.LEMON_SQUEEZY_STORE_ID;

      logger.info('🔐 Environment check:', {
        hasApiKey: !!apiKey,
        hasStoreId: !!storeId,
        apiKeyLength: apiKey?.length || 0,
        isTestMode: isTestMode,
        storeId: storeId
      });

      if (!apiKey || !storeId) {
        logger.error('Missing Lemon Squeezy environment variables');
        throw new HttpsError('internal', 'Server configuration error');
      }

      // Get plan configuration
      const planKey = `pro-${billing}`;
      const plans = getSubscriptionPlans();
      const plan = plans[planKey];
      
      if (!plan) {
        logger.error('Invalid plan:', planKey);
        throw new HttpsError('invalid-argument', `Invalid plan: ${planKey}`);
      }

      logger.info('📦 Using plan:', { planKey, variantId: plan.variantId });

      // Create checkout data for Lemon Squeezy
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

      logger.info('🌐 Calling Lemon Squeezy API...');

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
        logger.error('❌ Lemon Squeezy API error:', {
          status: response.status,
          statusText: response.statusText,
          errorData: errorData,
          requestData: checkoutData
        });
        throw new HttpsError('internal', `Checkout creation failed: ${errorData.errors?.[0]?.detail || response.statusText}`);
      }

      const result = await response.json();
      const checkoutUrl = result.data.attributes.url;

      logger.info('✅ Checkout created successfully:', {
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
      logger.error('❌ Error in createCheckout function:', error);
      logger.error('Error type:', typeof error);
      logger.error('Error name:', (error as any)?.name);
      logger.error('Error message:', (error as any)?.message);
      logger.error('Error stack:', (error as any)?.stack);
      
      if (error instanceof HttpsError) {
        logger.error('Rethrowing HttpsError:', { code: error.code, message: error.message });
        throw error;
      }
      
      logger.error('Converting error to internal HttpsError');
      throw new HttpsError('internal', 'Failed to create checkout');
    }
  }
);