// Comprehensive Timezone Debug Script
// Run this in browser console to trace timezone issues

console.log('🔍 COMPREHENSIVE TIMEZONE DEBUG STARTED');
console.log('=====================================');

function debugTimezones() {
  console.log('\n=== 1. BROWSER & SYSTEM TIMEZONE ===');
  console.log('Browser timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
  console.log('Date.getTimezoneOffset():', new Date().getTimezoneOffset());
  console.log('Current time:', new Date().toISOString());
  
  console.log('\n=== 2. USER STORE ANALYSIS ===');
  try {
    const userStore = window.useUserStore?.getState();
    if (userStore) {
      console.log('User exists:', !!userStore.user);
      console.log('User settings:', userStore.user?.settings);
      console.log('Timezone settings:', userStore.user?.settings?.timezone);
      console.log('Current timezone from settings:', userStore.user?.settings?.timezone?.current);
      
      // Test getTimezone method
      const timezoneFromMethod = window.useUserStore?.getState().getTimezone();
      console.log('getTimezone() method result:', timezoneFromMethod);
    } else {
      console.log('❌ User store not accessible');
    }
  } catch (error) {
    console.error('❌ Error accessing user store:', error);
  }
  
  console.log('\n=== 3. TIMEZONE UTILS ANALYSIS ===');
  try {
    // Test timezoneUtils directly
    if (window.timezoneUtils) {
      console.log('timezoneUtils.getCurrentTimezone():', window.timezoneUtils.getCurrentTimezone());
      
      // Test timezone conversion
      const now = new Date();
      const utcString = now.toISOString();
      
      console.log('Current UTC time:', utcString);
      
      // Test conversion to user timezone
      const userTimezone = window.useUserStore?.getState().getTimezone();
      if (userTimezone) {
        try {
          const userTime = window.timezoneUtils.utcToUserTime(utcString, userTimezone);
          console.log(`Converted to ${userTimezone}:`, userTime);
          console.log('User time ISO:', userTime.toISOString());
          console.log('User time date only:', userTime.toISOString().split('T')[0]);
          
          // Test format function
          if (window.format) {
            console.log('format(userTime, "yyyy-MM-dd"):', window.format(userTime, 'yyyy-MM-dd'));
          }
        } catch (error) {
          console.error('❌ Error in timezone conversion:', error);
        }
      }
    } else {
      console.log('❌ timezoneUtils not accessible on window');
    }
  } catch (error) {
    console.error('❌ Error testing timezoneUtils:', error);
  }
  
  console.log('\n=== 4. WORK SESSION SERVICE ANALYSIS ===');
  try {
    if (window.workSessionService) {
      console.log('✅ workSessionService accessible');
      
      // Check if we can access the methods
      console.log('Methods available:', Object.getOwnPropertyNames(window.workSessionService));
    } else {
      console.log('❌ workSessionService not accessible on window');
    }
  } catch (error) {
    console.error('❌ Error accessing workSessionService:', error);
  }
  
  console.log('\n=== 5. RECENT FIREBASE DOCUMENTS ===');
  try {
    // Try to access recent work sessions from the store
    const taskStore = window.useTaskStore?.getState();
    if (taskStore?.workSessions) {
      const recentSessions = taskStore.workSessions
        .slice(-3)
        .map(session => ({
          id: session.id,
          date: session.date,
          timezone: session.timezoneContext?.timezone,
          utcOffset: session.timezoneContext?.utcOffset,
          source: session.timezoneContext?.source,
          sessionType: session.sessionType,
          duration: session.duration
        }));
      
      console.log('Recent work sessions:', recentSessions);
    } else {
      console.log('❌ Work sessions not accessible from task store');
    }
  } catch (error) {
    console.error('❌ Error accessing work sessions:', error);
  }
  
  console.log('\n=== 6. TRACE MANUAL TIME ADDITION FLOW ===');
  
  // Create a test function to trace the flow
  window.debugManualTimeAddition = async function(taskId = null, minutes = 1) {
    try {
      console.log('\n🧪 TRACING MANUAL TIME ADDITION FLOW');
      console.log('====================================');
      
      const userStore = window.useUserStore?.getState();
      const user = userStore?.user;
      
      if (!user) {
        console.error('❌ No user found');
        return;
      }
      
      console.log('1. User ID:', user.uid);
      
      // Get timezone
      const userTimezone = userStore.getTimezone();
      console.log('2. User timezone from getTimezone():', userTimezone);
      
      // Test timezone utils
      const browserTimezone = window.timezoneUtils?.getCurrentTimezone();
      console.log('3. Browser timezone from utils:', browserTimezone);
      
      // Test timezone context creation
      if (window.timezoneUtils?.createTimezoneContext) {
        const context1 = window.timezoneUtils.createTimezoneContext(userTimezone, 'browser');
        console.log('4. Timezone context for user timezone:', context1);
        
        const context2 = window.timezoneUtils.createTimezoneContext(browserTimezone, 'browser');
        console.log('5. Timezone context for browser timezone:', context2);
      }
      
      // Test date formatting
      const now = new Date();
      console.log('6. Current time:', now.toISOString());
      
      if (userTimezone && window.timezoneUtils?.utcToUserTime) {
        const userTime = window.timezoneUtils.utcToUserTime(now.toISOString(), userTimezone);
        console.log('7. User time:', userTime.toISOString());
        console.log('8. User date (split):', userTime.toISOString().split('T')[0]);
        
        if (window.format) {
          console.log('9. User date (format):', window.format(userTime, 'yyyy-MM-dd'));
        }
      }
      
      console.log('\n✅ Manual time addition flow traced');
      
    } catch (error) {
      console.error('❌ Error tracing manual time addition:', error);
    }
  };
  
  console.log('\n=== 7. CACHE ANALYSIS ===');
  try {
    // Check if there's any caching that might be causing issues
    if (window.timezoneUtils?.timezoneCache) {
      console.log('Timezone cache entries:', window.timezoneUtils.timezoneCache.size);
      // Try to iterate through cache if possible
      if (window.timezoneUtils.timezoneCache.forEach) {
        console.log('Cache contents:');
        window.timezoneUtils.timezoneCache.forEach((value, key) => {
          console.log(`  ${key}:`, value);
        });
      }
    }
  } catch (error) {
    console.error('❌ Error analyzing cache:', error);
  }
  
  console.log('\n=== INSTRUCTIONS ===');
  console.log('1. Run: debugManualTimeAddition() to trace the manual time flow');
  console.log('2. Add manual time to a task and watch the console');
  console.log('3. Compare the timezone values at each step');
  console.log('\n🔍 COMPREHENSIVE TIMEZONE DEBUG COMPLETED');
}

// Make functions available globally
window.debugTimezones = debugTimezones;

// Auto-run the debug
debugTimezones();