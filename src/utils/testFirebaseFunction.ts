import { httpsCallable } from 'firebase/functions';
import { functions } from '../api/firebase';

/**
 * Direct test of Firebase Functions to diagnose issues
 */
export async function testFirebaseFunctions() {
  console.log('🧪 Testing Firebase Functions directly...');
  
  try {
    // Test 1: Health check
    console.log('Testing webhookHealth function...');
    const healthCheck = httpsCallable(functions, 'webhookHealth');
    const healthResult = await healthCheck({});
    console.log('✅ Health check result:', healthResult);
    
    // Test 2: createCheckout function exists
    console.log('Testing createCheckout function exists...');
    const createCheckout = httpsCallable(functions, 'createCheckout');
    console.log('✅ createCheckout function callable created');
    
    // Test 3: Call createCheckout with valid data
    console.log('Testing createCheckout with monthly billing...');
    const result = await createCheckout({ billing: 'monthly' });
    console.log('✅ createCheckout result:', result);
    
    return result;
    
  } catch (error: any) {
    console.error('❌ Firebase Functions test failed:', {
      name: error.name,
      code: error.code,
      message: error.message,
      details: error.details,
      stack: error.stack,
      fullError: error
    });
    
    // Additional debugging based on error type
    if (error.code === 'functions/not-found') {
      console.error('🔍 Function not found - check if createCheckout was deployed correctly');
    } else if (error.code === 'functions/unauthenticated') {
      console.error('🔍 Unauthenticated - check if user is logged in');
    } else if (error.code === 'functions/internal') {
      console.error('🔍 Internal error - check function logs and environment variables');
    } else if (error.code === 'functions/permission-denied') {
      console.error('🔍 Permission denied - check function security rules');
    }
    
    throw error;
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  (window as any).testFirebaseFunctions = testFirebaseFunctions;
  console.log('💡 Function test available! Run: testFirebaseFunctions() in console');
}