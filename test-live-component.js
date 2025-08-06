// Test Live Component Timezone Usage
// Run this while looking at your task list with "Today" filter active

console.log('🧪 TESTING LIVE COMPONENT TIMEZONE USAGE');
console.log('========================================');

function testLiveComponent() {
  console.log('\n=== 1. CHECKING CURRENT STATE ===');
  
  const userStore = window.useUserStore?.getState();
  const taskStore = window.useTaskStore?.getState();
  
  if (!userStore || !taskStore) {
    console.error('❌ Stores not available');
    return;
  }
  
  console.log('Current view mode:', taskStore.taskListViewMode);
  console.log('User timezone (direct):', userStore.user?.settings?.timezone?.current);
  console.log('User timezone (getTimezone):', userStore.getTimezone());
  
  // Check if they're different
  const directTimezone = userStore.user?.settings?.timezone?.current;  
  const methodTimezone = userStore.getTimezone();
  
  if (directTimezone !== methodTimezone) {
    console.log('🚨 TIMEZONE MISMATCH DETECTED!');
    console.log('Direct access gives:', directTimezone);
    console.log('getTimezone() gives:', methodTimezone);  
  } else {
    console.log('✅ Timezone access methods consistent');
  }
  
  console.log('\n=== 2. FORCE COMPONENT RE-RENDER ===');
  
  // Force the component to re-render by toggling view mode
  const currentMode = taskStore.taskListViewMode;
  console.log('Current mode:', currentMode);
  
  if (currentMode !== 'today') {
    console.log('Switching to "today" mode to test...');
    taskStore.setTaskListViewMode('today');
    
    setTimeout(() => {
      console.log('Now check console for TaskListSorted timezone debug logs');
      console.log('Look for: "TaskListSorted timezone debug:" messages');
    }, 500);
    
  } else {
    console.log('Already in "today" mode - toggling to force re-render...');
    
    taskStore.setTaskListViewMode('pomodoro');
    setTimeout(() => {
      taskStore.setTaskListViewMode('today');
      setTimeout(() => {
        console.log('Component re-rendered - check console for debug logs');
      }, 500);
    }, 100);
  }
  
  console.log('\n=== 3. MONITORING FILTER CALLS ===');
  
  // Override TaskFilteringService temporarily to log calls
  if (window.TaskFilteringService) {
    const originalGetTodaysTasks = window.TaskFilteringService.getTodaysTasks;
    
    window.TaskFilteringService.getTodaysTasks = function(tasks, timezone) {
      console.log('🔍 getTodaysTasks called with timezone:', timezone);
      console.log('🔍 Browser timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
      console.log('🔍 Tasks being filtered:', tasks.length);
      
      const result = originalGetTodaysTasks.call(this, tasks, timezone);
      console.log('🔍 Filtering result:', result.length, 'tasks');
      
      return result;
    };
    
    console.log('✅ TaskFilteringService monitoring enabled');
    console.log('Now interact with your task list to see filtering calls');
    
    // Restore original after 30 seconds
    setTimeout(() => {
      window.TaskFilteringService.getTodaysTasks = originalGetTodaysTasks;
      console.log('TaskFilteringService monitoring disabled');
    }, 30000);
    
  } else {
    console.error('❌ TaskFilteringService not available for monitoring');
  }
  
  console.log('\n=== 4. EXPECTED BEHAVIOR ===');
  console.log('After the fix, you should see:');
  console.log('✅ "TaskListSorted timezone debug" logs in console');
  console.log('✅ Timezone should be "America/Toronto" not "Asia/Saigon"');
  console.log('✅ getTodaysTasks called with "America/Toronto"');
  console.log('✅ Tasks filtered for Toronto date, not Saigon date');
  
  console.log('\nWatch the console as you interact with the task list...');
}

// Make function globally available
window.testLiveComponent = testLiveComponent;

// Auto-run
testLiveComponent();image.png