// Test utility to verify the authentication guard functionality
// This file is for testing purposes and can be removed after verification

import { checkAuthenticationStatus, triggerAuthenticationFlow } from './authGuard';

export const testAuthGuard = () => {
  console.log('🧪 Testing authentication guard...');
  
  // Test 1: Check authentication status
  const authStatus = checkAuthenticationStatus();
  console.log('Auth status:', authStatus);
  
  // Test 2: Test with mock guest user
  if (!authStatus.isAuthenticated && authStatus.shouldShowAuth) {
    console.log('✅ Authentication guard detected guest user');
    console.log('Would trigger authentication flow for guest user');
    // Don't actually trigger the flow in test
  } else if (authStatus.isAuthenticated) {
    console.log('✅ User is already authenticated');
  } else {
    console.log('ℹ️ User store not initialized yet');
  }
  
  return authStatus;
};

// Export a function to manually test the auth flow
export const testAuthFlow = () => {
  console.log('🧪 Testing direct Google authentication flow...');
  triggerAuthenticationFlow();
};

// Export a function to test the direct Google auth
export const testDirectGoogleAuth = async () => {
  console.log('🧪 Testing direct Google authentication...');
  const { directGoogleAuth } = await import('./authGuard');
  return directGoogleAuth();
};

// Export a function to test project creation auth guard
export const testProjectCreationAuth = () => {
  console.log('🧪 Testing project creation authentication guard...');
  const authStatus = checkAuthenticationStatus();
  
  if (!authStatus.isAuthenticated && authStatus.shouldShowAuth) {
    console.log('✅ Project creation would trigger authentication for guest user');
    console.log('Would trigger: triggerAuthenticationFlow()');
    return false; // Would be blocked
  } else if (authStatus.isAuthenticated) {
    console.log('✅ User is authenticated - project creation would proceed');
    return true; // Would proceed
  } else {
    console.log('ℹ️ User store not initialized yet - project creation would be blocked');
    return false; // Would be blocked
  }
};

// Test in development mode
if (process.env.NODE_ENV === 'development') {
  // Add to window for manual testing
  (window as any).testAuthGuard = testAuthGuard;
  (window as any).testAuthFlow = testAuthFlow;
  (window as any).testDirectGoogleAuth = testDirectGoogleAuth;
  (window as any).testProjectCreationAuth = testProjectCreationAuth;
  console.log('🧪 Auth guard test functions available:');
  console.log('  - window.testAuthGuard() - Test auth status detection');
  console.log('  - window.testAuthFlow() - Test auth flow trigger');
  console.log('  - window.testDirectGoogleAuth() - Test direct Google auth');
  console.log('  - window.testProjectCreationAuth() - Test project creation auth');
}