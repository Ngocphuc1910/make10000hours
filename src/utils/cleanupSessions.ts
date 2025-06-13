import { deepFocusSessionService } from '../api/deepFocusSessionService';
import { useUserStore } from '../store/userStore';

/**
 * Utility function to clean up all orphaned sessions for the current user
 */
export const cleanupAllOrphanedSessions = async (): Promise<void> => {
  try {
    const user = useUserStore.getState().user;
    
    if (!user?.uid) {
      console.error('❌ No user logged in');
      return;
    }

    console.log('🧹 Starting cleanup of orphaned sessions for user:', user.uid);
    
    const cleanedCount = await deepFocusSessionService.cleanupOrphanedSessions(user.uid);
    
    if (cleanedCount > 0) {
      console.log(`✅ Successfully cleaned up ${cleanedCount} orphaned session(s)`);
    } else {
      console.log('✅ No orphaned sessions found - database is clean!');
    }
    
    return;
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
};

// Make it available globally for console access
if (typeof window !== 'undefined') {
  (window as any).cleanupOrphanedSessions = cleanupAllOrphanedSessions;
} 