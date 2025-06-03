import { workSessionService } from '../api/workSessionService';
import { useTaskStore } from '../store/taskStore';
import { useUserStore } from '../store/userStore';

/**
 * Test utility to verify project ID update functionality
 */
export async function testProjectIdUpdate(taskId?: string, newProjectId?: string) {
  const { user } = useUserStore.getState();
  const { tasks, projects, updateTask } = useTaskStore.getState();
  
  if (!user) {
    console.error('❌ No user logged in');
    return;
  }

  // Use provided taskId or find first task
  const testTaskId = taskId || tasks[0]?.id;
  if (!testTaskId) {
    console.error('❌ No tasks found to test');
    return;
  }

  // Use provided projectId or find a different project
  const currentTask = tasks.find(t => t.id === testTaskId);
  if (!currentTask) {
    console.error('❌ Task not found');
    return;
  }

  const testProjectId = newProjectId || projects.find(p => p.id !== currentTask.projectId)?.id;
  if (!testProjectId) {
    console.error('❌ No alternative project found');
    return;
  }

  try {
    console.log(`🧪 Starting project ID update test...`);
    console.log(`📋 Task: ${currentTask.title} (${testTaskId})`);
    console.log(`📂 Current Project: ${currentTask.projectId}`);
    console.log(`📂 New Project: ${testProjectId}`);

    // Get existing work sessions before update
    const sessionsBefore = await workSessionService.getWorkSessionsByTask(user.uid, testTaskId);
    console.log(`📊 Found ${sessionsBefore.length} work sessions before update`);

    if (sessionsBefore.length === 0) {
      console.log('📝 Creating a test work session first...');
      await workSessionService.createWorkSession({
        userId: user.uid,
        taskId: testTaskId,
        projectId: currentTask.projectId,
        date: '2024-01-01',
        duration: 25,
        sessionType: 'manual',
        status: 'completed',
        notes: 'Test session for project ID update verification'
      });
      console.log('✅ Test work session created');
    }

    // Update the task's project ID
    console.log(`🔄 Updating task project ID...`);
    await updateTask(testTaskId, { projectId: testProjectId });

    // Verify work sessions were updated
    console.log(`🔍 Checking work sessions after update...`);
    const sessionsAfter = await workSessionService.getWorkSessionsByTask(user.uid, testTaskId);
    
    let successCount = 0;
    let errorCount = 0;

    for (const session of sessionsAfter) {
      if (session.projectId === testProjectId) {
        successCount++;
      } else {
        errorCount++;
        console.error(`❌ Session ${session.id} still has old project ID: ${session.projectId}`);
      }
    }

    console.log(`\n🎯 Test Results:`);
    console.log(`✅ Sessions with correct project ID: ${successCount}`);
    console.log(`❌ Sessions with incorrect project ID: ${errorCount}`);
    console.log(`📊 Total sessions: ${sessionsAfter.length}`);

    if (errorCount === 0 && sessionsAfter.length > 0) {
      console.log(`🎉 SUCCESS: All work sessions updated correctly!`);
    } else if (sessionsAfter.length === 0) {
      console.log(`ℹ️ No work sessions to verify`);
    } else {
      console.log(`❌ FAILED: Some work sessions were not updated`);
    }

    return {
      success: errorCount === 0,
      totalSessions: sessionsAfter.length,
      updatedSessions: successCount,
      failedSessions: errorCount
    };

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    return {
      success: false,
      error: error
    };
  }
}

/**
 * Quick test that creates a task, adds work sessions, then changes project
 */
export async function quickProjectIdTest() {
  const { user } = useUserStore.getState();
  const { tasks, projects, addTask } = useTaskStore.getState();
  
  if (!user) {
    console.error('❌ No user logged in');
    return;
  }

  if (projects.length < 2) {
    console.error('❌ Need at least 2 projects to test');
    return;
  }

  try {
    console.log(`🧪 Starting quick project ID test...`);

    // Create a test task
    const testTaskData = {
      title: 'Test Task for Project ID Update',
      description: 'This task is for testing project ID updates',
      projectId: projects[0].id,
      userId: user.uid,
      completed: false,
      status: 'todo' as const,
      timeSpent: 0,
      timeEstimated: 30
    };

    await addTask(testTaskData);
    console.log(`✅ Created test task`);

    // Find the created task (it should be the last one)
    const updatedTasks = useTaskStore.getState().tasks;
    const testTask = updatedTasks.find(t => t.title === testTaskData.title);
    
    if (!testTask) {
      console.error('❌ Could not find created test task');
      return;
    }

    // Run the test
    await testProjectIdUpdate(testTask.id, projects[1].id);

  } catch (error) {
    console.error('❌ Quick test failed:', error);
  }
}

// Make functions available globally for console testing
(window as any).testProjectIdUpdate = testProjectIdUpdate;
(window as any).quickProjectIdTest = quickProjectIdTest; 