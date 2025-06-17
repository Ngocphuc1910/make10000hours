import { useUserStore } from '../store/userStore';
import { useChatStore } from '../store/chatStore';

/**
 * Integration service to sync user authentication with chat store
 * This ensures chat store is properly initialized/reset based on user auth state
 */
export class ChatIntegrationService {
  private static unsubscribeUserStore: (() => void) | null = null;

  /**
   * Initialize the integration between user store and chat store
   * Should be called once when the app starts
   */
  static initialize(): void {
    // Clean up any existing subscription
    if (this.unsubscribeUserStore) {
      this.unsubscribeUserStore();
    }

    console.log('🤖 Initializing chat integration service...');

    // Subscribe to user store changes
    let previousUser = useUserStore.getState().user;
    
    this.unsubscribeUserStore = useUserStore.subscribe((state) => {
      const currentUser = state.user;
      const chatStore = useChatStore.getState();

      if (currentUser && currentUser.uid) {
        // User is authenticated
        console.log('🤖 User authenticated, initializing chat store for:', currentUser.uid);
        
        // Initialize chat store with user ID
        if ((chatStore as any)._userId !== currentUser.uid) {
          (chatStore as any)._setUserId(currentUser.uid);
        }
      } else if (previousUser && !currentUser) {
        // User logged out
        console.log('🤖 User logged out, resetting chat store');
        (chatStore as any)._reset();
      }

      previousUser = currentUser;
    });
  }

  /**
   * Clean up subscriptions
   * Should be called when the app unmounts
   */
  static cleanup(): void {
    if (this.unsubscribeUserStore) {
      this.unsubscribeUserStore();
      this.unsubscribeUserStore = null;
    }
    console.log('🤖 Chat integration service cleaned up');
  }

  /**
   * Get current user context for chat operations
   */
  static getCurrentUserContext() {
    const userState = useUserStore.getState();
    
    if (!userState.user) {
      return null;
    }

    return {
      userId: userState.user.uid,
      userName: userState.user.userName || 'User',
      isAuthenticated: userState.isAuthenticated,
    };
  }

  /**
   * Check if chat is available for current user
   */
  static isChatAvailable(): boolean {
    const userState = useUserStore.getState();
    return userState.isAuthenticated && !!userState.user;
  }
} 