import * as functions from 'firebase-functions';

/**
 * Get Lemon Squeezy configuration from Firebase Functions config
 * Falls back to environment variables for local development
 */
export function getLemonSqueezyConfig() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // In production, use Firebase Functions config
  if (isProduction) {
    const config = functions.config();
    
    if (!config.lemon_squeezy?.api_key) {
      throw new Error('Lemon Squeezy API key not configured in Firebase Functions');
    }
    
    return {
      apiKey: config.lemon_squeezy.api_key,
      storeId: config.lemon_squeezy.store_id,
      webhookSecret: config.lemon_squeezy.webhook_secret,
      proMonthlyVariantId: config.lemon_squeezy.pro_monthly_variant_id,
      proAnnualVariantId: config.lemon_squeezy.pro_annual_variant_id,
      testStoreId: config.lemon_squeezy.test_store_id,
      testProMonthlyVariantId: config.lemon_squeezy.test_pro_monthly_variant_id,
      testProAnnualVariantId: config.lemon_squeezy.test_pro_annual_variant_id,
    };
  }
  
  // In development, use environment variables
  return {
    apiKey: process.env.LEMON_SQUEEZY_API_KEY || '',
    storeId: process.env.LEMON_SQUEEZY_STORE_ID || '',
    webhookSecret: process.env.LEMON_SQUEEZY_WEBHOOK_SECRET || '',
    proMonthlyVariantId: process.env.LEMON_SQUEEZY_PRO_MONTHLY_VARIANT_ID || '',
    proAnnualVariantId: process.env.LEMON_SQUEEZY_PRO_ANNUAL_VARIANT_ID || '',
    testStoreId: process.env.LEMON_SQUEEZY_TEST_STORE_ID || '',
    testProMonthlyVariantId: process.env.LEMON_SQUEEZY_TEST_PRO_MONTHLY_VARIANT_ID || '',
    testProAnnualVariantId: process.env.LEMON_SQUEEZY_TEST_PRO_ANNUAL_VARIANT_ID || '',
  };
}

/**
 * Check if we're in test mode
 */
export function isTestMode(): boolean {
  return process.env.NODE_ENV !== 'production';
}