/**
 * Debug utilities for authentication issues
 */

import { useUserStore } from '../store/userStore';
import { auth } from '../api/firebase';

export const authDebug = {
  /**
   * Monitor authentication state for debugging
   */
  monitorAuthState: () => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      console.log('🔐 [AUTH DEBUG] Firebase Auth State Changed:', {
        user: user ? {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName
        } : null,
        timestamp: new Date().toISOString()
      });
    });
    
    // Monitor user store changes
    const userStoreUnsubscribe = useUserStore.subscribe((state) => {
      console.log('🏪 [AUTH DEBUG] User Store State Changed:', {
        isAuthenticated: state.isAuthenticated,
        isLoading: state.isLoading,
        isInitialized: state.isInitialized,
        hasUser: !!state.user,
        userId: state.user?.uid,
        timestamp: new Date().toISOString()
      });
    });
    
    console.log('🔍 Auth state monitoring started. Call authDebug.stopMonitoring() to stop.');
    
    return () => {
      unsubscribe();
      userStoreUnsubscribe();
    };
  },

  /**
   * Get current authentication state snapshot
   */
  getAuthSnapshot: () => {
    const userState = useUserStore.getState();
    const firebaseUser = auth.currentUser;
    
    return {
      firebase: {
        currentUser: firebaseUser ? {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName
        } : null
      },
      userStore: {
        isAuthenticated: userState.isAuthenticated,
        isLoading: userState.isLoading,
        isInitialized: userState.isInitialized,
        hasUser: !!userState.user,
        userId: userState.user?.uid
      },
      timestamp: new Date().toISOString()
    };
  },

  /**
   * Test page reload behavior
   */
  testPageReload: () => {
    console.log('🔄 [AUTH DEBUG] Testing page reload behavior...');
    const snapshot = authDebug.getAuthSnapshot();
    console.log('🔄 [AUTH DEBUG] State before reload:', snapshot);
    
    // Set up a listener for when the page reloads
    window.addEventListener('beforeunload', () => {
      localStorage.setItem('auth-debug-before-reload', JSON.stringify(snapshot));
    });
    
    // Check if we have data from before reload
    const beforeReload = localStorage.getItem('auth-debug-before-reload');
    if (beforeReload) {
      const prevSnapshot = JSON.parse(beforeReload);
      console.log('🔄 [AUTH DEBUG] State from before reload:', prevSnapshot);
      localStorage.removeItem('auth-debug-before-reload');
    }
  },

  /**
   * Clear all auth-related storage
   */
  clearAuthStorage: () => {
    console.log('🧹 [AUTH DEBUG] Clearing auth storage...');
    
    // Clear Firebase auth
    auth.signOut();
    
    // Clear any auth debug data
    localStorage.removeItem('auth-debug-before-reload');
    
    console.log('✅ [AUTH DEBUG] Auth storage cleared');
  }
};

// Auto-run debugging in development
if (process.env.NODE_ENV === 'development') {
  // Test page reload behavior
  authDebug.testPageReload();
  
  // Make debug tools available globally
  (window as any).authDebug = authDebug;
  console.log('🔧 Auth debug tools available at window.authDebug');
} 