// Debug script to inspect task data and timezone conversion issues
// Run this in browser console: copy and paste this entire script

console.log('🔍 Starting Task Data Debug Analysis...');

// Function to analyze all tasks
function analyzeTaskData() {
  console.log('\n=== TASK ANALYSIS ===');
  
  // Try to access the task store from window
  let tasks = [];
  
  if (window.useTaskStore) {
    try {
      const taskStore = window.useTaskStore.getState();
      tasks = taskStore.tasks || [];
      console.log(`📋 Found ${tasks.length} tasks in store`);
    } catch (e) {
      console.log('❌ Could not access task store:', e.message);
    }
  }
  
  if (tasks.length === 0) {
    console.log('⚠️ No tasks found to analyze');
    return;
  }
  
  tasks.forEach((task, index) => {
    console.log(`\n--- Task ${index + 1}: "${task.title}" ---`);
    
    // Basic info
    console.log('ID:', task.id);
    console.log('Status:', task.status);
    console.log('Include Time:', task.includeTime);
    
    // Legacy scheduling fields
    console.log('\n📅 Legacy Scheduling Fields:');
    console.log('  scheduledDate:', task.scheduledDate);
    console.log('  scheduledStartTime:', task.scheduledStartTime);
    console.log('  scheduledEndTime:', task.scheduledEndTime);
    
    // UTC scheduling fields
    console.log('\n🌍 UTC Scheduling Fields:');
    console.log('  scheduledTimeUTC:', task.scheduledTimeUTC);
    console.log('  scheduledEndTimeUTC:', task.scheduledEndTimeUTC);
    console.log('  scheduledTimezone:', task.scheduledTimezone);
    
    // Validate UTC date strings
    if (task.scheduledTimeUTC) {
      const startDate = new Date(task.scheduledTimeUTC);
      console.log('  scheduledTimeUTC validation:', isNaN(startDate.getTime()) ? '❌ INVALID' : '✅ Valid');
      if (!isNaN(startDate.getTime())) {
        console.log('    -> Parsed as:', startDate.toISOString());
      }
    }
    
    if (task.scheduledEndTimeUTC) {
      const endDate = new Date(task.scheduledEndTimeUTC);
      console.log('  scheduledEndTimeUTC validation:', isNaN(endDate.getTime()) ? '❌ INVALID' : '✅ Valid');
      if (!isNaN(endDate.getTime())) {
        console.log('    -> Parsed as:', endDate.toISOString());
      }
    }
    
    // Test TaskDisplayService conversion
    console.log('\n🔄 Testing TaskDisplayService Conversion:');
    try {
      if (window.TaskDisplayService) {
        const userTimezone = 'America/Los_Angeles'; // Test timezone
        console.log(`  Converting to timezone: ${userTimezone}`);
        
        const displayTask = window.TaskDisplayService.convertForDisplay(task, userTimezone);
        console.log('  ✅ Conversion SUCCESS!');
        console.log('    displayScheduledDate:', displayTask.displayScheduledDate);
        console.log('    displayScheduledTime:', displayTask.displayScheduledTime);
        console.log('    displayScheduledEndTime:', displayTask.displayScheduledEndTime);
        console.log('    displayTimezone:', displayTask.displayTimezone);
        
        // Test Vietnam timezone
        const vietnamDisplay = window.TaskDisplayService.convertForDisplay(task, 'Asia/Ho_Chi_Minh');
        console.log('  Vietnam timezone conversion:');
        console.log('    displayScheduledTime:', vietnamDisplay.displayScheduledTime);
        console.log('    displayScheduledEndTime:', vietnamDisplay.displayScheduledEndTime);
        
      } else {
        console.log('  ❌ TaskDisplayService not available in window');
      }
    } catch (error) {
      console.log('  ❌ Conversion FAILED:', error.message);
      console.log('     Stack:', error.stack);
    }
  });
}

// Function to test timezone utilities
function testTimezoneUtils() {
  console.log('\n=== TIMEZONE UTILS TEST ===');
  
  if (window.timezoneUtils) {
    const tz = window.timezoneUtils;
    console.log('✅ timezoneUtils available');
    
    // Test basic conversion
    const testUTC = '2025-08-05T02:00:00.000Z';
    const testTimezone = 'America/Los_Angeles';
    
    try {
      const converted = tz.utcToUserTime(testUTC, testTimezone);
      console.log('Test conversion:', testUTC, '->', converted.toISOString());
    } catch (error) {
      console.log('❌ Basic conversion failed:', error.message);
    }
  } else {
    console.log('❌ timezoneUtils not available in window');
  }
}

// Function to check user settings
function checkUserSettings() {
  console.log('\n=== USER SETTINGS ===');
  
  if (window.useUserStore) {
    try {
      const userStore = window.useUserStore.getState();
      const user = userStore.user;
      console.log('User timezone setting:', user?.settings?.timezone);
      console.log('Browser timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch (e) {
      console.log('❌ Could not access user store:', e.message);
    }
  } else {
    console.log('❌ useUserStore not available');
  }
}

// Run all analyses
try {
  analyzeTaskData();
  testTimezoneUtils();
  checkUserSettings();
  
  console.log('\n✅ Debug analysis complete! Look for any ❌ errors above.');
} catch (error) {
  console.log('❌ Debug script failed:', error.message);
}

// Export functions for manual use
window.debugAnalyzeTaskData = analyzeTaskData;
window.debugTestTimezoneUtils = testTimezoneUtils;
window.debugCheckUserSettings = checkUserSettings;

console.log('\n💡 You can also run these functions manually:');
console.log('  - window.debugAnalyzeTaskData()');
console.log('  - window.debugTestTimezoneUtils()');
console.log('  - window.debugCheckUserSettings()');