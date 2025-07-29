import { httpsCallable } from 'firebase/functions';
import { functions, auth } from '../api/firebase';

interface CheckoutRequest {
  billing: 'monthly' | 'annual';
}

interface CheckoutResponse {
  checkoutUrl: string;
  planKey: string;
  billing: string;
}

/**
 * Comprehensive debug script for checkout functionality
 */
export async function debugCheckout() {
  console.log('🔍 Starting comprehensive checkout debug...');
  
  // 1. Check authentication
  console.log('📋 Step 1: Checking authentication...');
  const currentUser = auth.currentUser;
  console.log('Current user:', {
    uid: currentUser?.uid,
    email: currentUser?.email,
    authenticated: !!currentUser,
    emailVerified: currentUser?.emailVerified
  });
  
  if (!currentUser) {
    console.error('❌ User not authenticated - this will cause checkout to fail');
    return;
  }
  
  // 2. Check Firebase Functions connection
  console.log('📋 Step 2: Checking Firebase Functions connection...');
  try {
    const testFunction = httpsCallable(functions, 'webhookHealth');
    const healthResult = await testFunction({});
    console.log('✅ Firebase Functions connection working:', healthResult.data);
  } catch (error) {
    console.error('❌ Firebase Functions connection failed:', error);
  }
  
  // 3. Test createCheckout function specifically
  console.log('📋 Step 3: Testing createCheckout function...');
  const createCheckoutFunction = httpsCallable<CheckoutRequest, CheckoutResponse>(
    functions,
    'createCheckout'
  );
  
  // Test with monthly billing
  console.log('🧪 Testing monthly checkout...');
  try {
    const monthlyResult = await createCheckoutFunction({ billing: 'monthly' });
    console.log('✅ Monthly checkout successful:', monthlyResult.data);
  } catch (error: any) {
    console.error('❌ Monthly checkout failed:', {
      code: error.code,
      message: error.message,
      details: error.details,
      fullError: error
    });
  }
  
  // Test with annual billing
  console.log('🧪 Testing annual checkout...');
  try {
    const annualResult = await createCheckoutFunction({ billing: 'annual' });
    console.log('✅ Annual checkout successful:', annualResult.data);
  } catch (error: any) {
    console.error('❌ Annual checkout failed:', {
      code: error.code,
      message: error.message,
      details: error.details,
      fullError: error
    });
  }
  
  // 4. Check environment configuration
  console.log('📋 Step 4: Checking client environment...');
  console.log('Environment variables:', {
    NODE_ENV: process.env.NODE_ENV,
    firebaseConfig: {
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'make10000hours',
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY ? '***configured***' : 'missing',
      appId: import.meta.env.VITE_FIREBASE_APP_ID ? '***configured***' : 'missing'
    }
  });
  
  // 5. Test with different error scenarios
  console.log('📋 Step 5: Testing error scenarios...');
  
  // Test with invalid billing period
  try {
    await createCheckoutFunction({ billing: 'invalid' as any });
  } catch (error: any) {
    console.log('✅ Invalid billing period correctly rejected:', error.code);
  }
  
  console.log('🔍 Debug complete! Check the logs above for issues.');
}

/**
 * Simple debug function to call from console
 */
export function runCheckoutDebug() {
  debugCheckout().catch(console.error);
}

// Make it available globally for easy console access
if (typeof window !== 'undefined') {
  (window as any).debugCheckout = runCheckoutDebug;
  console.log('💡 Debug function available! Run: debugCheckout() in console');
}