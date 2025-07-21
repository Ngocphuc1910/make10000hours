// Authentication guard utility to check if user is authenticated before performing actions
// Redirects guest users to authentication flow when needed

import { useUserStore } from '../store/userStore';

export interface AuthGuardResult {
  isAuthenticated: boolean;
  shouldShowAuth: boolean;
}

/**
 * Check if the current user is authenticated and not in guest mode
 * @returns Object with authentication status and whether to show auth UI
 */
export const checkAuthenticationStatus = (): AuthGuardResult => {
  const { user, isAuthenticated, isInitialized } = useUserStore.getState();
  
  // If user store is not initialized yet, don't show auth
  if (!isInitialized) {
    return {
      isAuthenticated: false,
      shouldShowAuth: false
    };
  }
  
  // User is authenticated if they have a valid user object and isAuthenticated is true
  const userIsAuthenticated = isAuthenticated && !!user;
  
  return {
    isAuthenticated: userIsAuthenticated,
    shouldShowAuth: !userIsAuthenticated
  };
};

/**
 * Higher-order function that wraps an action with authentication checking
 * If user is not authenticated, triggers the authentication flow instead
 * @param action The action to perform if authenticated
 * @param onRequiresAuth Callback when authentication is required
 * @returns Function that checks auth before executing the action
 */
export const withAuthGuard = <T extends any[]>(
  action: (...args: T) => void | Promise<void>,
  onRequiresAuth?: () => void
) => {
  return (...args: T) => {
    const authStatus = checkAuthenticationStatus();
    
    if (authStatus.isAuthenticated) {
      // User is authenticated, proceed with the action
      return action(...args);
    } else if (authStatus.shouldShowAuth) {
      // User needs to authenticate
      if (onRequiresAuth) {
        onRequiresAuth();
      } else {
        // Default behavior: trigger authentication flow
        triggerAuthenticationFlow();
      }
    }
    // If shouldShowAuth is false, do nothing (store not initialized)
  };
};

/**
 * Trigger the authentication flow for guest users
 * Directly opens Google authentication popup since it's the only auth method
 */
export const triggerAuthenticationFlow = (): void => {
  // Directly trigger Google authentication without confirmation modal
  // since Google is the only authentication method available
  directGoogleAuth();
};

/**
 * Directly trigger Google authentication popup
 * Bypasses any UI selection since Google is the only auth method
 */
export const directGoogleAuth = async (): Promise<void> => {
  try {
    // Dynamically import Firebase auth
    const { auth } = await import('../api/firebase');
    const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
    
    // Import analytics tracking
    const { trackUserLogin, trackUserSignup } = await import('../utils/analytics');
    
    // Create Google auth provider
    const provider = new GoogleAuthProvider();
    
    // Configure the provider
    provider.addScope('email');
    provider.addScope('profile');
    
    // Trigger the popup
    console.log('🔐 Triggering Google authentication popup...');
    const result = await signInWithPopup(auth, provider);
    
    // Track analytics
    if (result.user) {
      // Check if this is a new user by looking at the creation time
      const isNewUser = result.user.metadata.creationTime === result.user.metadata.lastSignInTime;
      
      if (isNewUser) {
        trackUserSignup('google');
        console.log('✅ New user signed up with Google');
      } else {
        trackUserLogin('google');
        console.log('✅ Existing user signed in with Google');
      }
    }
    
    console.log('✅ Google authentication successful');
  } catch (error: any) {
    console.error('❌ Google authentication failed:', error);
    
    // Handle specific error cases
    if (error.code === 'auth/popup-closed-by-user') {
      console.log('ℹ️ User closed the authentication popup');
      // Don't show an error for this case - user intentionally cancelled
    } else if (error.code === 'auth/popup-blocked') {
      console.error('🚫 Popup was blocked by browser');
      // Fallback to the modal approach if popup is blocked
      showAuthModal();
    } else {
      // Show a user-friendly error message
      alert('Failed to sign in. Please try again.');
    }
  }
};

/**
 * Fallback: Show authentication modal when popup is blocked
 * Only used when direct popup authentication fails
 */
export const showAuthModal = (): void => {
  // Create and mount the auth component dynamically as fallback
  createAuthModal();
};

/**
 * Create and show a modal with authentication UI
 */
export const createAuthModal = (): void => {
  // Check if modal already exists
  if (document.getElementById('auth-modal')) {
    return;
  }
  
  // Create modal overlay
  const modalOverlay = document.createElement('div');
  modalOverlay.id = 'auth-modal';
  modalOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
  `;
  
  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white;
    padding: 2rem;
    border-radius: 8px;
    max-width: 400px;
    width: 90%;
    position: relative;
  `;
  
  // Create close button
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '×';
  closeButton.style.cssText = `
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #666;
  `;
  
  // Create title
  const title = document.createElement('h2');
  title.textContent = 'Sign in to continue';
  title.style.cssText = `
    margin: 0 0 1rem 0;
    color: #333;
  `;
  
  // Create auth container for FirebaseUI
  const authContainer = document.createElement('div');
  authContainer.id = 'modal-firebaseui-auth-container';
  
  // Assemble modal
  modalContent.appendChild(closeButton);
  modalContent.appendChild(title);
  modalContent.appendChild(authContainer);
  modalOverlay.appendChild(modalContent);
  
  // Add event listeners
  closeButton.addEventListener('click', closeAuthModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeAuthModal();
    }
  });
  
  // Add to DOM
  document.body.appendChild(modalOverlay);
  
  // Initialize FirebaseUI in the modal
  initAuthUIInModal();
};

/**
 * Close the authentication modal
 */
export const closeAuthModal = (): void => {
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.remove();
  }
};

/**
 * Initialize FirebaseUI in the modal
 */
const initAuthUIInModal = async (): Promise<void> => {
  try {
    // Dynamically import FirebaseUI and auth
    const [FirebaseUI, { auth }, { GoogleAuthProvider }] = await Promise.all([
      import('firebaseui'),
      import('../api/firebase'),
      import('firebase/auth')
    ]);
    
    // Import analytics tracking
    const { trackUserLogin, trackUserSignup } = await import('../utils/analytics');
    
    // Initialize the FirebaseUI Widget
    const ui = FirebaseUI.auth.AuthUI.getInstance() || new FirebaseUI.auth.AuthUI(auth);
    
    // Configure FirebaseUI
    const uiConfig: firebaseui.auth.Config = {
      signInFlow: 'popup',
      signInOptions: [
        GoogleAuthProvider.PROVIDER_ID,
      ],
      callbacks: {
        signInSuccessWithAuthResult: (authResult) => {
          // Track analytics for login/signup
          if (authResult.additionalUserInfo?.isNewUser) {
            trackUserSignup('google');
          } else {
            trackUserLogin('google');
          }
          
          // Close the modal on successful sign-in
          closeAuthModal();
          
          return false; // Don't redirect after sign-in
        },
      },
    };
    
    // Start the FirebaseUI Auth widget in the modal
    const container = document.getElementById('modal-firebaseui-auth-container');
    if (container) {
      ui.start(container, uiConfig);
    }
  } catch (error) {
    console.error('Failed to initialize FirebaseUI in modal:', error);
    closeAuthModal();
  }
};

/**
 * Hook to check authentication status reactively
 * @returns Current authentication status
 */
export const useAuthGuard = (): AuthGuardResult => {
  const { user, isAuthenticated, isInitialized } = useUserStore();
  
  if (!isInitialized) {
    return {
      isAuthenticated: false,
      shouldShowAuth: false
    };
  }
  
  const userIsAuthenticated = isAuthenticated && !!user;
  
  return {
    isAuthenticated: userIsAuthenticated,
    shouldShowAuth: !userIsAuthenticated
  };
};