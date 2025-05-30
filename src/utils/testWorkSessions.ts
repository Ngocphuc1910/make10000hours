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
    yesterday.setHours(9, 0, 0, 0);
    
    const session1End = new Date(yesterday);
    session1End.setHours(11, 0, 0, 0);
    
    await workSessionService.createWorkSession({
      userId,
      taskId,
      projectId,
      startTime: yesterday,
      endTime: session1End,
      duration: 120, // 2 hours
      sessionType: 'pomodoro',
      notes: 'Test session - learning React'
    });

    // Session 2: Today, 1.5 hours
    const today = new Date(now);
    today.setHours(10, 0, 0, 0);
    
    const session2End = new Date(today);
    session2End.setHours(11, 30, 0, 0);
    
    await workSessionService.createWorkSession({
      userId,
      taskId,
      projectId,
      startTime: today,
      endTime: session2End,
      duration: 90, // 1.5 hours
      sessionType: 'pomodoro',
      notes: 'Test session - working on dashboard'
    });

    // Session 3: 3 days ago, 45 minutes
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(now.getDate() - 3);
    threeDaysAgo.setHours(14, 0, 0, 0);
    
    const session3End = new Date(threeDaysAgo);
    session3End.setHours(14, 45, 0, 0);
    
    await workSessionService.createWorkSession({
      userId,
      taskId,
      projectId,
      startTime: threeDaysAgo,
      endTime: session3End,
      duration: 45, // 45 minutes
      sessionType: 'manual',
      notes: 'Short focused session'
    });

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