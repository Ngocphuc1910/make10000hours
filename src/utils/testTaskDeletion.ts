import { workSessionService } from '../api/workSessionService';
import { useTaskStore } from '../store/taskStore';
import { useUserStore } from '../store/userStore';

export async function createTestWorkSession(taskId: string = "FIsiHQxJZBD8ROepOskf") {
  const { user } = useUserStore.getState();
  if (!user) {
    console.error('❌ No user logged in');
    return;
  }

  try {
    console.log(`🧪 Creating test work session for task ${taskId}...`);
    
    const sessionId = await workSessionService.createWorkSession({
      userId: user.uid,
      taskId: taskId,
      projectId: "lU2tNDKK0x0aLsfWsvMO",
      date: "2025-06-02",
      duration: 25,
      sessionType: 'manual',
      notes: 'Test session to verify automatic deletion when task is deleted'
    });
    
    console.log(`✅ Created test work session: ${sessionId}`);
    
    // Verify it was created
    const sessions = await workSessionService.getWorkSessionsByTask(user.uid, taskId);
    console.log(`📋 Found ${sessions.length} work sessions for task ${taskId}`);
    
    return sessionId;
  } catch (error) {
    console.error('❌ Failed to create test work session:', error);
  }
}

export async function testTaskDeletion(taskId: string = "FIsiHQxJZBD8ROepOskf") {
  const { user } = useUserStore.getState();
  const { deleteTask } = useTaskStore.getState();
  
  if (!user) {
    console.error('❌ No user logged in');
    return;
  }

  try {
    console.log(`🧪 Testing deletion of task ${taskId}...`);
    
    // Check sessions before deletion
    const sessionsBefore = await workSessionService.getWorkSessionsByTask(user.uid, taskId);
    console.log(`📋 Found ${sessionsBefore.length} work sessions before deletion`);
    
    // Delete the task (this should also delete all work sessions)
    await deleteTask(taskId);
    
    // Check sessions after deletion
    const sessionsAfter = await workSessionService.getWorkSessionsByTask(user.uid, taskId);
    console.log(`📋 Found ${sessionsAfter.length} work sessions after deletion`);
    
    if (sessionsAfter.length === 0) {
      console.log('✅ SUCCESS: All work sessions were deleted with the task!');
    } else {
      console.log('❌ FAILURE: Some work sessions still exist after task deletion!');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Make functions available in browser console
declare global {
  interface Window {
    createTestWorkSession: typeof createTestWorkSession;
    testTaskDeletion: typeof testTaskDeletion;
  }
}

window.createTestWorkSession = createTestWorkSession;
window.testTaskDeletion = testTaskDeletion; 