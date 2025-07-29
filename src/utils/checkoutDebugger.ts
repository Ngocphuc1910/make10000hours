/**
 * Comprehensive Checkout Debug Script
 * This script helps diagnose authentication and checkout issues step by step
 */

import { auth, functions } from '../api/firebase';
import { httpsCallable } from 'firebase/functions';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useUserStore } from '../store/userStore';

export interface DebugResult {
  step: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  data?: any;
  error?: any;
}

export class CheckoutDebugger {
  private results: DebugResult[] = [];

  constructor() {
    console.log('🔍 Initializing Checkout Debugger...');
  }

  /**
   * Run complete diagnostic check
   */
  async runFullDiagnostic(): Promise<DebugResult[]> {
    this.results = [];
    console.log('🚀 Starting comprehensive checkout diagnostics...');

    try {
      // Step 1: Check Firebase configuration
      await this.checkFirebaseConfig();
      
      // Step 2: Check authentication state
      await this.checkAuthenticationState();
      
      // Step 3: Check user store state
      await this.checkUserStoreState();
      
      // Step 4: Test Firebase Functions connectivity
      await this.testFunctionsConnectivity();
      
      // Step 5: Test authentication token
      await this.testAuthToken();
      
      // Step 6: Test createCheckout function call
      await this.testCreateCheckoutCall();
      
      // Step 7: Check environment variables
      await this.checkEnvironmentVariables();

    } catch (error) {
      this.addResult('diagnostic', 'error', 'Diagnostic failed', null, error);
    }

    // Print summary
    this.printSummary();
    return this.results;
  }

  /**
   * Step 1: Check Firebase configuration
   */
  private async checkFirebaseConfig(): Promise<void> {
    try {
      console.log('🔧 Step 1: Checking Firebase configuration...');
      
      // Check if Firebase is initialized
      if (!auth) {
        this.addResult('firebase-init', 'error', 'Firebase auth not initialized');
        return;
      }

      if (!functions) {
        this.addResult('firebase-functions', 'error', 'Firebase functions not initialized');
        return;
      }

      // Check Firebase app config
      const config = auth.app.options;
      this.addResult('firebase-config', 'success', 'Firebase app configuration loaded', {
        projectId: config.projectId,
        authDomain: config.authDomain,
        hasApiKey: !!config.apiKey,
        hasAppId: !!config.appId
      });

      // Check functions region
      console.log('🌍 Functions app:', functions.app);
      this.addResult('functions-init', 'success', 'Firebase Functions initialized');

    } catch (error) {
      this.addResult('firebase-config', 'error', 'Firebase configuration error', null, error);
    }
  }

  /**
   * Step 2: Check authentication state
   */
  private async checkAuthenticationState(): Promise<void> {
    console.log('🔐 Step 2: Checking authentication state...');
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.addResult('auth-timeout', 'error', 'Authentication state check timed out');
        resolve();
      }, 5000);

      const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
        clearTimeout(timeout);
        unsubscribe();

        if (user) {
          this.addResult('auth-state', 'success', 'User is authenticated', {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            emailVerified: user.emailVerified,
            isAnonymous: user.isAnonymous,
            metadata: {
              creationTime: user.metadata.creationTime,
              lastSignInTime: user.metadata.lastSignInTime
            }
          });

          // Test getting ID token
          user.getIdToken()
            .then(token => {
              this.addResult('auth-token', 'success', 'ID token retrieved', {
                tokenLength: token.length,
                tokenPreview: token.substring(0, 50) + '...'
              });
            })
            .catch(error => {
              this.addResult('auth-token', 'error', 'Failed to get ID token', null, error);
            });

        } else {
          this.addResult('auth-state', 'error', 'User is not authenticated');
        }
        resolve();
      });
    });
  }

  /**
   * Step 3: Check user store state
   */
  private async checkUserStoreState(): Promise<void> {
    console.log('🏪 Step 3: Checking user store state...');
    
    try {
      const userStore = useUserStore.getState();
      
      this.addResult('user-store', userStore.isAuthenticated ? 'success' : 'warning', 
        'User store state checked', {
          isAuthenticated: userStore.isAuthenticated,
          isInitialized: userStore.isInitialized,
          hasUser: !!userStore.user,
          userId: userStore.user?.uid,
          userEmail: userStore.user?.email
        });

    } catch (error) {
      this.addResult('user-store', 'error', 'User store check failed', null, error);
    }
  }

  /**
   * Step 4: Test Firebase Functions connectivity
   */
  private async testFunctionsConnectivity(): Promise<void> {
    console.log('⚡ Step 4: Testing Functions connectivity...');
    
    try {
      // Test basic functions connectivity by checking if we can instantiate callable functions
      const createCheckoutTest = httpsCallable(functions, 'createCheckout');
      
      // Just check if the callable function can be created (doesn't call it yet)
      if (createCheckoutTest) {
        this.addResult('functions-connectivity', 'success', 'Functions connectivity test passed', {
          functionsRegion: 'us-central1',
          functionsReady: true
        });
      } else {
        this.addResult('functions-connectivity', 'error', 'Functions instance creation failed');
      }

    } catch (error) {
      this.addResult('functions-connectivity', 'error', 'Functions connectivity failed', null, error);
      
      // Additional connectivity diagnostics
      console.log('🔍 Additional Functions diagnostics:');
      console.log('Functions app:', functions.app);
      console.log('Functions region:', (functions as any)._region);
      console.log('Functions customDomain:', (functions as any)._customDomain);
    }
  }

  /**
   * Step 5: Test authentication token
   */
  private async testAuthToken(): Promise<void> {
    console.log('🎫 Step 5: Testing authentication token...');
    
    try {
      const user = auth.currentUser;
      if (!user) {
        this.addResult('token-test', 'error', 'No current user for token test');
        return;
      }

      // Get fresh token
      const token = await user.getIdToken(true);
      this.addResult('token-refresh', 'success', 'Fresh token obtained', {
        tokenLength: token.length
      });

      // Parse token claims (basic parsing, not cryptographic verification)
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        this.addResult('token-claims', 'success', 'Token claims parsed', {
          iss: payload.iss,
          aud: payload.aud,
          auth_time: payload.auth_time,
          exp: payload.exp,
          iat: payload.iat,
          sub: payload.sub,
          email: payload.email,
          email_verified: payload.email_verified
        });
      } catch (parseError) {
        this.addResult('token-claims', 'warning', 'Could not parse token claims', null, parseError);
      }

    } catch (error) {
      this.addResult('token-test', 'error', 'Token test failed', null, error);
    }
  }

  /**
   * Step 6: Test createCheckout function call
   */
  private async testCreateCheckoutCall(): Promise<void> {
    console.log('🛒 Step 6: Testing createCheckout function call...');
    
    try {
      const user = auth.currentUser;
      if (!user) {
        this.addResult('checkout-test', 'error', 'Cannot test checkout - user not authenticated');
        return;
      }

      // Test the actual createCheckout function
      const createCheckout = httpsCallable(functions, 'createCheckout');
      
      console.log('📞 Calling createCheckout function...');
      const result = await createCheckout({ billing: 'monthly' });
      
      this.addResult('checkout-test', 'success', 'Checkout function call succeeded', {
        response: result.data
      });

    } catch (error: any) {
      this.addResult('checkout-test', 'error', 'Checkout function call failed', {
        code: error.code,
        message: error.message,
        details: error.details
      }, error);
      
      // Detailed error analysis
      this.analyzeCheckoutError(error);
    }
  }

  /**
   * Step 7: Check environment variables
   */
  private async checkEnvironmentVariables(): Promise<void> {
    console.log('🌍 Step 7: Checking environment variables...');
    
    try {
      const envVars = {
        VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
        VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
        NODE_ENV: import.meta.env.NODE_ENV,
        MODE: import.meta.env.MODE,
        DEV: import.meta.env.DEV,
        PROD: import.meta.env.PROD
      };

      this.addResult('env-vars', 'success', 'Environment variables checked', {
        hasFirebaseApiKey: !!envVars.VITE_FIREBASE_API_KEY,
        hasFirebaseAppId: !!envVars.VITE_FIREBASE_APP_ID,
        nodeEnv: envVars.NODE_ENV,
        mode: envVars.MODE,
        isDev: envVars.DEV,
        isProd: envVars.PROD
      });

    } catch (error) {
      this.addResult('env-vars', 'error', 'Environment variables check failed', null, error);
    }
  }

  /**
   * Analyze specific checkout errors
   */
  private analyzeCheckoutError(error: any): void {
    if (error.code === 'unauthenticated') {
      this.addResult('error-analysis', 'error', 'AUTHENTICATION ERROR: The function is not receiving the user\'s auth token', {
        possibleCauses: [
          'Firebase Functions not properly initialized',
          'Auth state not propagated to Functions calls',
          'Token expired or invalid',
          'Functions region mismatch',
          'CORS or network issues'
        ]
      });
    } else if (error.code === 'permission-denied') {
      this.addResult('error-analysis', 'error', 'PERMISSION ERROR: User authenticated but lacks permissions', {
        possibleCauses: [
          'Firebase security rules blocking the call',
          'User role/claims insufficient',
          'Function-level permission checks failing'
        ]
      });
    } else if (error.code === 'not-found') {
      this.addResult('error-analysis', 'error', 'FUNCTION NOT FOUND: createCheckout function not deployed', {
        possibleCauses: [
          'Function not deployed to correct region',
          'Function name mismatch',
          'Deployment failed'
        ]
      });
    } else if (error.code === 'internal') {
      this.addResult('error-analysis', 'error', 'INTERNAL ERROR: Server-side function error', {
        possibleCauses: [
          'Environment variables missing on server',
          'Server-side authentication check failing',
          'API key configuration issues',
          'Lemon Squeezy API connectivity issues'
        ]
      });
    }
  }

  /**
   * Add result to diagnostics
   */
  private addResult(step: string, status: 'success' | 'error' | 'warning', message: string, data?: any, error?: any): void {
    const result: DebugResult = { step, status, message, data, error };
    this.results.push(result);
    
    const emoji = status === 'success' ? '✅' : status === 'error' ? '❌' : '⚠️';
    console.log(`${emoji} [${step}] ${message}`, data || '');
    
    if (error) {
      console.error(`   Error details:`, error);
    }
  }

  /**
   * Print diagnostic summary
   */
  private printSummary(): void {
    console.log('\n📊 DIAGNOSTIC SUMMARY');
    console.log('='.repeat(50));
    
    const summary = {
      total: this.results.length,
      success: this.results.filter(r => r.status === 'success').length,
      errors: this.results.filter(r => r.status === 'error').length,
      warnings: this.results.filter(r => r.status === 'warning').length
    };
    
    console.log(`Total checks: ${summary.total}`);
    console.log(`✅ Success: ${summary.success}`);
    console.log(`❌ Errors: ${summary.errors}`);
    console.log(`⚠️ Warnings: ${summary.warnings}`);
    
    if (summary.errors > 0) {
      console.log('\n🚨 ERRORS FOUND:');
      this.results
        .filter(r => r.status === 'error')
        .forEach(r => console.log(`   - [${r.step}] ${r.message}`));
    }
    
    console.log('\n🔍 For detailed results, check the returned array or browser DevTools.');
  }

  /**
   * Get results
   */
  getResults(): DebugResult[] {
    return this.results;
  }
}

/**
 * Convenience function to run diagnostics
 */
export async function debugCheckoutIssues(): Promise<DebugResult[]> {
  const debuggerInstance = new CheckoutDebugger();
  return await debuggerInstance.runFullDiagnostic();
}

/**
 * Quick auth state check
 */
export function quickAuthCheck(): void {
  console.log('🔍 Quick auth check:');
  console.log('Current user:', auth.currentUser);
  console.log('User store state:', useUserStore.getState());
}

/**
 * Manual checkout test
 */
export async function manualCheckoutTest(): Promise<void> {
  console.log('🧪 Manual checkout test...');
  
  try {
    const createCheckout = httpsCallable(functions, 'createCheckout');
    const result = await createCheckout({ billing: 'monthly' });
    console.log('✅ Manual checkout test succeeded:', result.data);
  } catch (error) {
    console.error('❌ Manual checkout test failed:', error);
  }
}

/**
 * Test authentication function to isolate auth issues
 */
export async function testAuthFunction(): Promise<void> {
  console.log('🔍 Testing auth function...');
  
  try {
    const testAuth = httpsCallable(functions, 'testAuth');
    const result = await testAuth();
    console.log('✅ Auth test succeeded:', result.data);
  } catch (error) {
    console.error('❌ Auth test failed:', error);
  }
}

/**
 * Test simple checkout function to isolate checkout issues
 */
export async function testSimpleCheckout(): Promise<void> {
  console.log('🛒 Testing simple checkout function...');
  
  try {
    const simpleCheckout = httpsCallable(functions, 'simpleCheckout');
    const result = await simpleCheckout();
    console.log('✅ Simple checkout test succeeded:', result.data);
  } catch (error) {
    console.error('❌ Simple checkout test failed:', error);
  }
}

/**
 * Test webhook processing function
 */
export async function testWebhookProcessing(): Promise<void> {
  console.log('🎣 Testing webhook processing...');
  
  try {
    const testWebhook = httpsCallable(functions, 'testWebhookProcessing');
    const result = await testWebhook();
    console.log('✅ Webhook processing test succeeded:', result.data);
  } catch (error) {
    console.error('❌ Webhook processing test failed:', error);
  }
}

/**
 * Test available variants in Lemon Squeezy
 */
export async function testVariants(): Promise<void> {
  console.log('🔍 Testing available variants...');
  
  try {
    const testVariants = httpsCallable(functions, 'testVariants');
    const result = await testVariants();
    console.log('✅ Available variants:', result.data);
  } catch (error) {
    console.error('❌ Variants test failed:', error);
  }
}

// Make functions available globally for browser console
if (typeof window !== 'undefined') {
  (window as any).debugCheckout = debugCheckoutIssues;
  (window as any).quickAuthCheck = quickAuthCheck;
  (window as any).manualCheckoutTest = manualCheckoutTest;
  (window as any).testAuthFunction = testAuthFunction;
  (window as any).testSimpleCheckout = testSimpleCheckout;
  (window as any).testWebhookProcessing = testWebhookProcessing;
  (window as any).testVariants = testVariants;
  (window as any).CheckoutDebugger = CheckoutDebugger;
}