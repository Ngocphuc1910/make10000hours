// Simple fix for workSessionService.ts
// This shows the minimal changes needed to fix the timezone issue

import { getCurrentUserDate } from '../utils/dateUtils';
// ... other imports remain the same

export class WorkSessionService {
  // ... existing methods remain the same

  /**
   * SIMPLE FIX: Update createActiveSession to use consistent date creation
   */
  async createActiveSession(
    taskId: string,
    projectId: string,
    userId: string,
    sessionType: 'pomodoro' | 'shortBreak' | 'longBreak',
    userTimezone?: string
  ): Promise<string> {
    try {
      const now = new Date();
      
      const sessionData: Omit<WorkSession, 'id' | 'createdAt' | 'updatedAt'> = {
        userId,
        taskId,
        projectId,
        // 🔧 SIMPLE FIX: Use consistent date utility instead of complex timezone conversion
        // OLD: date: userNow.toISOString().split('T')[0],
        // NEW: Use simple utility that ensures consistency
        date: getCurrentUserDate(), // ✅ This fixes the timezone inconsistency
        duration: 0,
        sessionType,
        status: 'active',
        startTime: now,
        notes: `${sessionType} session started`
      };

      const sessionId = await this.createWorkSession(sessionData);
      
      console.log('🎯 Session created with consistent date:', {
        sessionId,
        sessionType,
        dateUsed: sessionData.date,
        utcTime: now.toISOString()
      });

      return sessionId;
    } catch (error) {
      console.error('Error creating active session:', error);
      throw error;
    }
  }

  /**
   * SIMPLE FIX: Update any other session creation methods
   */
  async createWorkSession(sessionData: Omit<WorkSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const timestamp = new Date().getTime();
      const sessionId = `${sessionData.taskId}_${sessionData.date}_${timestamp}`;
      const sessionRef = doc(this.workSessionsCollection, sessionId);

      // If no date provided, use consistent date utility
      const finalSessionData = {
        ...sessionData,
        // 🔧 SIMPLE FIX: Ensure date is always created consistently
        date: sessionData.date || getCurrentUserDate(), // ✅ Fallback to consistent date
        id: sessionId,
        status: sessionData.status || 'completed',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await setDoc(sessionRef, finalSessionData);
      
      console.log('✅ Work session created with consistent date:', {
        sessionId,
        dateUsed: finalSessionData.date
      });
      
      return sessionId;
    } catch (error) {
      console.error('Error creating work session:', error);
      throw error;
    }
  }

  // ... rest of the methods remain unchanged
}

// Export the fixed service
export const workSessionService = new WorkSessionService();