import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';

/**
 * Test function to list available variants in your Lemon Squeezy store
 */
export const testVariants = onCall(
  { 
    region: 'us-central1',
    enforceAppCheck: false,
  },
  async (request) => {
    try {
      logger.info('🔍 Testing available variants...');

      const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
      const storeId = process.env.LEMON_SQUEEZY_TEST_STORE_ID || process.env.LEMON_SQUEEZY_STORE_ID;

      if (!apiKey || !storeId) {
        throw new Error('Missing API key or store ID');
      }

      // Get all products in the store
      const productsResponse = await fetch(`https://api.lemonsqueezy.com/v1/products?filter[store_id]=${storeId}`, {
        headers: {
          'Accept': 'application/vnd.api+json',
          'Authorization': `Bearer ${apiKey}`
        }
      });

      if (!productsResponse.ok) {
        const error = await productsResponse.json();
        logger.error('Failed to fetch products:', error);
        throw new Error(`Failed to fetch products: ${productsResponse.statusText}`);
      }

      const products = await productsResponse.json();
      
      // Get all variants for each product
      const allVariants = [];
      for (const product of products.data) {
        const variantsResponse = await fetch(`https://api.lemonsqueezy.com/v1/variants?filter[product_id]=${product.id}`, {
          headers: {
            'Accept': 'application/vnd.api+json',
            'Authorization': `Bearer ${apiKey}`
          }
        });

        if (variantsResponse.ok) {
          const variants = await variantsResponse.json();
          allVariants.push({
            productId: product.id,
            productName: product.attributes.name,
            variants: variants.data.map((v: any) => ({
              id: v.id,
              name: v.attributes.name,
              price: v.attributes.price,
              isSubscription: v.attributes.is_subscription
            }))
          });
        }
      }

      logger.info('Available variants:', allVariants);

      return {
        success: true,
        storeId: storeId,
        products: allVariants
      };

    } catch (error) {
      logger.error('❌ Error testing variants:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
);