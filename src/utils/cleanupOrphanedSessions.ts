import { deepFocusSessionService } from '../api/deepFocusSessionService';
import { DeepFocusSession } from '../types/models';

/**
 * Clean up orphaned deep focus sessions for a user
 * This utility helps fix issues caused by the previous duplication bug
 */
export async function cleanupOrphanedSessions(userId: string): Promise<number> {
  try {
    console.log('🧹 Starting orphaned session cleanup for user:', userId);
    
    // Use the service's cleanup method
    const cleanedCount = await deepFocusSessionService.cleanupOrphanedSessions(userId);
    
    console.log(`✅ Cleaned up ${cleanedCount} orphaned session(s) for user:`, userId);
    return cleanedCount;
  } catch (error) {
    console.error('❌ Error during orphaned session cleanup:', error);
    throw error;
  }
}

/**
 * Emergency cleanup - removes ALL active sessions for a user
 * Use this only if the regular cleanup doesn't work
 */
export async function emergencyCleanupAllActiveSessions(userId: string): Promise<number> {
  try {
    console.log('🚨 EMERGENCY: Cleaning up ALL active sessions for user:', userId);
    
    // Get all sessions for user and filter for active ones
    const allSessions = await deepFocusSessionService.getUserSessions(userId);
    const activeSessions = allSessions.filter(session => session.status === 'active');
    
    let cleanedCount = 0;
    for (const session of activeSessions) {
      try {
        await deepFocusSessionService.endSession(session.id);
        cleanedCount++;
        console.log(`✅ Emergency cleanup: Ended session ${session.id}`);
      } catch (error) {
        console.error(`❌ Failed to end session ${session.id}:`, error);
      }
    }
    
    console.log(`🚨 Emergency cleanup completed: ${cleanedCount} sessions cleaned`);
    return cleanedCount;
  } catch (error) {
    console.error('❌ Error during emergency cleanup:', error);
    throw error;
  }
}

/**
 * Check for duplicate sessions and report them
 */
export async function checkForDuplicateSessions(userId: string): Promise<void> {
  try {
    console.log('🔍 Checking for duplicate sessions for user:', userId);
    
    // Get all sessions for user and filter for active ones
    const allSessions = await deepFocusSessionService.getUserSessions(userId);
    const activeSessions = allSessions.filter(session => session.status === 'active');
    
    if (activeSessions.length > 1) {
      console.warn(`⚠️ Found ${activeSessions.length} active sessions for user ${userId}:`);
      activeSessions.forEach((session: DeepFocusSession, index: number) => {
        console.log(`  Session ${index + 1}:`, {
          id: session.id,
          startTime: session.startTime,
          duration: session.duration,
          status: session.status
        });
      });
    } else if (activeSessions.length === 1) {
      console.log('✅ Found 1 active session (normal):', {
        id: activeSessions[0].id,
        startTime: activeSessions[0].startTime,
        duration: activeSessions[0].duration
      });
    } else {
      console.log('✅ No active sessions found');
    }
  } catch (error) {
    console.error('❌ Error checking for duplicate sessions:', error);
    throw error;
  }
} 