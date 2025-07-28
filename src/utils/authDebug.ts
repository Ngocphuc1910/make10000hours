/**
 * Comprehensive authentication debugging utility
 */

import { auth } from '../api/firebase';
import { useUserStore } from '../store/userStore';

export class AuthDebugger {
  private static logs: any[] = [];

  static log(stage: string, data: any) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      stage,
      data: JSON.parse(JSON.stringify(data)) // Deep clone to avoid reference issues
    };
    
    this.logs.push(logEntry);
    console.log(`🔍 [${stage}] at ${timestamp}:`, data);
  }

  static logFirebaseUser(user: any, stage: string) {
    if (!user) {
      this.log(`${stage} - Firebase User`, 'null');
      return;
    }

    this.log(`${stage} - Firebase User`, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      emailVerified: user.emailVerified,
      isAnonymous: user.isAnonymous,
      metadata: {
        creationTime: user.metadata?.creationTime,
        lastSignInTime: user.metadata?.lastSignInTime
      },
      providerData: user.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        uid: provider.uid,
        email: provider.email,
        displayName: provider.displayName,
        photoURL: provider.photoURL
      }))
    });
  }

  static logUserStoreState(stage: string) {
    const state = useUserStore.getState();
    this.log(`${stage} - UserStore State`, {
      isAuthenticated: state.isAuthenticated,
      isLoading: state.isLoading,
      isInitialized: state.isInitialized,
      error: state.error?.message,
      user: state.user ? {
        uid: state.user.uid,
        email: state.user.email,
        displayName: state.user.displayName,
        photoURL: state.user.photoURL,
        userName: state.user.userName,
        hasSettings: !!state.user.settings
      } : null
    });
  }

  static async debugCurrentAuth() {
    this.log('=== CURRENT AUTH STATUS DEBUG ===', {});
    
    // Check Firebase Auth current user
    const firebaseUser = auth.currentUser;
    this.logFirebaseUser(firebaseUser, 'Current Firebase User');
    
    // Check UserStore state
    this.logUserStoreState('Current UserStore');
    
    // Check localStorage
    this.log('LocalStorage Auth Data', {
      keys: Object.keys(localStorage).filter(key => 
        key.includes('firebase') || 
        key.includes('auth') || 
        key.includes('user')
      ).map(key => ({
        key,
        valueLength: localStorage.getItem(key)?.length || 0,
        valuePreview: localStorage.getItem(key)?.substring(0, 100)
      }))
    });

    return this.logs;
  }

  static async debugSignInFlow() {
    this.log('=== SIGN IN FLOW DEBUG START ===', {});
    
    // Listen to auth state changes during sign in
    const unsubscribe = auth.onAuthStateChanged((user) => {
      this.logFirebaseUser(user, 'AuthStateChanged During SignIn');
    });

    // Return cleanup function
    return () => {
      unsubscribe();
      this.log('=== SIGN IN FLOW DEBUG END ===', {});
    };
  }

  static getAllLogs() {
    return this.logs;
  }

  static clearLogs() {
    this.logs = [];
  }

  static exportLogs() {
    const logsJson = JSON.stringify(this.logs, null, 2);
    console.log('=== COMPLETE DEBUG LOG EXPORT ===');
    console.log(logsJson);
    
    // Also try to download as file
    try {
      const blob = new Blob([logsJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auth-debug-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.log('Could not download debug file, but logs are in console');
    }
    
    return logsJson;
  }
}

// Global window access for easy debugging
if (typeof window !== 'undefined') {
  (window as any).authDebugger = AuthDebugger;
}