/**
 * Deep Focus cleanup utilities
 */

import { DeepFocusSync } from '../services/deepFocusSync';
import { useUserStore } from '../store/userStore';

export class DeepFocusCleanup {
  /**
   * Clean up duplicate sessions for the current user
   */
  static async cleanupDuplicatesForCurrentUser(): Promise<{ success: boolean; removedCount: number; error?: string }> {
    const user = useUserStore.getState().user;
    
    if (!user?.uid) {
      return { success: false, removedCount: 0, error: 'User not authenticated' };
    }
    
    console.log('🧹 Starting duplicate cleanup for current user...');
    
    try {
      const result = await DeepFocusSync.removeDuplicateSessions(user.uid);
      
      if (result.success) {
        console.log(`✅ Cleanup completed: ${result.removedCount} duplicate sessions removed`);
      } else {
        console.error('❌ Cleanup failed:', result.error);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Cleanup error:', error);
      return { 
        success: false, 
        removedCount: 0, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }
  
  /**
   * Test the sync process with detailed logging
   */
  static async testSyncProcess(): Promise<void> {
    const user = useUserStore.getState().user;
    
    if (!user?.uid) {
      console.error('❌ User not authenticated');
      return;
    }
    
    console.log('🧪 Testing Deep Focus sync process...');
    
    try {
      // Test today's sync
      const result = await DeepFocusSync.syncTodaySessionsFromExtension(user.uid);
      console.log('🔄 Sync result:', result);
      
      if (result.success) {
        console.log(`✅ Sync test passed: ${result.synced} sessions synced`);
      } else {
        console.error('❌ Sync test failed:', result.error);
      }
    } catch (error) {
      console.error('❌ Sync test error:', error);
    }
  }
}

// Make it available globally for console debugging
if (typeof window !== 'undefined') {
  (window as any).DeepFocusCleanup = DeepFocusCleanup;
  
  // Add convenience functions
  (window as any).cleanupDuplicates = DeepFocusCleanup.cleanupDuplicatesForCurrentUser;
  (window as any).testDeepFocusSync = DeepFocusCleanup.testSyncProcess;
  
  console.log('🔧 Deep Focus cleanup utilities available:');
  console.log('  - cleanupDuplicates() - Remove duplicate sessions');
  console.log('  - testDeepFocusSync() - Test sync process');
}

export default DeepFocusCleanup;