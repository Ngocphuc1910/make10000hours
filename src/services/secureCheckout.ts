import { httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { functions } from '../api/firebase';

// For now, use production functions even in development
// This allows localhost to work without emulator setup issues
// TODO: Fix emulator setup once webhook dependencies are resolved
if (process.env.NODE_ENV === 'development') {
  console.log('🔧 Using production Firebase Functions for secure checkout');
}

interface CheckoutRequest {
  billing: 'monthly' | 'annual';
}

interface CheckoutResponse {
  checkoutUrl: string;
  planKey: string;
  billing: string;
}

/**
 * Secure checkout service that calls server-side function
 * No sensitive credentials exposed to client
 */
class SecureCheckoutService {
  private createCheckoutFunction = httpsCallable<CheckoutRequest, CheckoutResponse>(
    functions,
    'createCheckout'
  );

  /**
   * Create secure checkout URL via server-side function
   */
  async getCheckoutUrl(billing: 'monthly' | 'annual'): Promise<string> {
    try {
      const result = await this.createCheckoutFunction({ billing });
      return result.data.checkoutUrl;
    } catch (error: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to create secure checkout:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details
        });
      }
      
      // Provide user-friendly error messages
      if (error.code === 'unauthenticated') {
        throw new Error('Please log in to continue with checkout');
      } else if (error.code === 'invalid-argument') {
        throw new Error('Invalid checkout configuration');
      } else if (error.code === 'not-found') {
        throw new Error('Checkout service not available. Please try again later.');
      } else {
        throw new Error(`Unable to create checkout: ${error.message || 'Please try again.'}`);
      }
    }
  }

  /**
   * Get available plans (client-side safe data only)
   */
  getAvailablePlans() {
    return [
      {
        tier: 'pro',
        billing: 'monthly',
        price: 1, // Test price - will be configured server-side
        displayPrice: '$5' // What to show to users
      },
      {
        tier: 'pro', 
        billing: 'annual',
        price: 1.1, // Test price - will be configured server-side
        displayPrice: '$45' // What to show to users
      }
    ];
  }
}

// Export singleton instance
export const secureCheckoutService = new SecureCheckoutService();