import { workSessionService } from '../api/workSessionService';
import type { WorkSession } from '../types/models';

/**
 * Create test work sessions for demo purposes
 * This helps verify that the dashboard sync is working correctly
 */
export const createTestWorkSessions = async (userId: string, taskId: string, projectId: string) => {
  try {
    // Create some test sessions for the last few days
    const now = new Date();
    
    // Session 1: Yesterday, 2 hours
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayDateStr = yesterday.toISOString().split('T')[0];
    
    await workSessionService.upsertWorkSession({
      userId,
      taskId,
      projectId,
      date: yesterdayDateStr,
    }, 120); // 2 hours

    // Session 2: Today, 1.5 hours
    const today = new Date(now);
    const todayDateStr = today.toISOString().split('T')[0];
    
    await workSessionService.upsertWorkSession({
      userId,
      taskId,
      projectId,
      date: todayDateStr,
    }, 90); // 1.5 hours

    // Session 3: 3 days ago, 45 minutes
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(now.getDate() - 3);
    const threeDaysAgoDateStr = threeDaysAgo.toISOString().split('T')[0];
    
    await workSessionService.upsertWorkSession({
      userId,
      taskId,
      projectId,
      date: threeDaysAgoDateStr,
    }, 45); // 45 minutes

    console.log('✅ Test work sessions created successfully!');
    console.log('🎯 Check your dashboard to see the sync in action');
    
  } catch (error) {
    console.error('❌ Failed to create test work sessions:', error);
  }
};

/**
 * Quick helper to test with current user and first available task
 */
export const createQuickTestSessions = async () => {
  // This would be called from browser console for testing
  // Example: import('./utils/testWorkSessions').then(m => m.createQuickTestSessions())
  console.log('🧪 Use createTestWorkSessions(userId, taskId, projectId) with actual IDs');
}; 