// 🔍 Focus Streak Debug Script
// Run this in browser console on the dashboard page to diagnose the issue

async function debugFocusStreak() {
  console.log('🔍 === FOCUS STREAK DEBUG ANALYSIS ===');
  
  try {
    // Get current user
    const userStore = window.useUserStore?.getState?.();
    const userId = userStore?.user?.uid;
    
    if (!userId) {
      console.error('❌ No user found. Make sure you are logged in.');
      return;
    }
    
    console.log('👤 User ID:', userId.substring(0, 8) + '...');
    
    // Get current year
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31);
    
    console.log('📅 Testing year range:', {
      year: currentYear,
      startDate: yearStart.toISOString().split('T')[0],
      endDate: yearEnd.toISOString().split('T')[0]
    });
    
    // Import required services
    const { transitionQueryService } = await import('./src/services/transitionService.js');
    const { workSessionService } = await import('./src/api/workSessionService.js');
    const { workSessionServiceUTC } = await import('./src/api/workSessionServiceUTC.js');
    const { timezoneUtils } = await import('./src/utils/timezoneUtils.js');
    
    const userTimezone = timezoneUtils.getCurrentTimezone();
    console.log('🌍 User timezone:', userTimezone);
    
    // Test 1: Check what Focus Streak store is actually calling
    console.log('\n🔍 TEST 1: Focus Streak Store Analysis');
    const focusStreakStore = window.useFocusStreakStore?.getState?.();
    if (focusStreakStore) {
      console.log('✅ Focus Streak store found');
      // Check current cache
      const cache = focusStreakStore.yearCache;
      if (cache && cache.get) {
        const yearCache = cache.get(currentYear);
        if (yearCache) {
          console.log('📦 Current cache for', currentYear, ':', {
            sessionCount: yearCache.sessions?.length || 0,
            lastFetch: yearCache.lastFetch,
          });
        } else {
          console.log('📦 No cache found for', currentYear);
        }
      }
    } else {
      console.log('❌ Focus Streak store not found');
    }
    
    // Test 2: Direct service comparisons
    console.log('\n🔍 TEST 2: Direct Service Comparison');
    
    // Test Legacy service
    console.log('🔹 Testing Legacy workSessionService...');
    try {
      const legacySessions = await workSessionService.getWorkSessionsForRange(
        userId, yearStart, yearEnd
      );
      console.log('📝 Legacy service result:', {
        sessions: legacySessions.length,
        sample: legacySessions.slice(0, 3).map(s => ({
          id: s.id.substring(0, 8),
          date: s.date,
          hasStartTimeUTC: !!s.startTimeUTC
        }))
      });
    } catch (error) {
      console.log('❌ Legacy service error:', error.message);
    }
    
    // Test UTC service
    console.log('🔹 Testing UTC workSessionServiceUTC...');
    try {
      const utcSessions = await workSessionServiceUTC.getSessionsForDateRange(
        yearStart, yearEnd, userId, userTimezone
      );
      console.log('🌍 UTC service result:', {
        sessions: utcSessions.length,
        sample: utcSessions.slice(0, 3).map(s => ({
          id: s.id.substring(0, 8),
          startTimeUTC: s.startTimeUTC?.substring(0, 10)
        }))
      });
    } catch (error) {
      console.log('❌ UTC service error:', error.message);
    }
    
    // Test Transition service (what SHOULD be used)
    console.log('🔹 Testing transitionQueryService...');
    try {
      const unifiedSessions = await transitionQueryService.getSessionsForDateRangeOptimized(
        yearStart, yearEnd, userId, userTimezone
      );
      console.log('🔄 Transition service result:', {
        totalSessions: unifiedSessions.length,
        utcSessions: unifiedSessions.filter(s => s.dataSource === 'utc').length,
        legacySessions: unifiedSessions.filter(s => s.dataSource === 'legacy').length,
        sample: unifiedSessions.slice(0, 3).map(s => ({
          id: s.id.substring(0, 8),
          dataSource: s.dataSource,
          date: s.startTime.toISOString().split('T')[0]
        }))
      });
    } catch (error) {
      console.log('❌ Transition service error:', error.message);
    }
    
    // Test 3: Check Feature Flags
    console.log('\n🔍 TEST 3: Feature Flag Analysis');
    try {
      const { utcFeatureFlags } = await import('./src/services/featureFlags.js');
      const transitionMode = utcFeatureFlags.getTransitionMode(userId);
      console.log('🏷️ User transition mode:', transitionMode);
    } catch (error) {
      console.log('❌ Feature flags error:', error.message);
    }
    
    // Test 4: Force Focus Streak refresh
    console.log('\n🔍 TEST 4: Force Focus Streak Refresh');
    if (focusStreakStore?.clearCache && focusStreakStore?.getSessionsForYear) {
      console.log('🔄 Clearing Focus Streak cache...');
      focusStreakStore.clearCache();
      
      console.log('🔄 Fetching fresh data...');
      try {
        const freshSessions = await focusStreakStore.getSessionsForYear(userId, currentYear);
        console.log('📊 Fresh Focus Streak data:', {
          sessions: freshSessions.length,
          sample: freshSessions.slice(0, 5).map(s => ({
            id: s.id.substring(0, 8),
            date: s.date,
            dataSource: s.startTimeUTC ? 'utc' : 'legacy',
            hasStartTimeUTC: !!s.startTimeUTC
          }))
        });
      } catch (error) {
        console.log('❌ Fresh fetch error:', error.message);
      }
    }
    
    // Test 5: Check imports
    console.log('\n🔍 TEST 5: Import Analysis');
    try {
      // Check if the Focus Streak store file has been properly updated
      const response = await fetch('/src/store/focusStreakStore.ts');
      const content = await response.text();
      
      const hasTransitionImport = content.includes('transitionQueryService');
      const hasTransitionCall = content.includes('transitionQueryService.getSessionsForDateRangeOptimized');
      
      console.log('📁 Focus Streak store file analysis:', {
        hasTransitionImport,
        hasTransitionCall,
        fileSize: content.length
      });
      
      if (!hasTransitionImport || !hasTransitionCall) {
        console.log('❌ ISSUE FOUND: Focus Streak store not using transitionQueryService!');
        console.log('💡 The file may not have been properly updated or needs a rebuild.');
      }
    } catch (error) {
      console.log('❌ File analysis error:', error.message);
    }
    
    console.log('\n🎯 === DEBUG COMPLETE ===');
    console.log('Check the results above to identify the issue.');
    
  } catch (error) {
    console.error('❌ Debug script error:', error);
  }
}

// Export the function and run it
window.debugFocusStreak = debugFocusStreak;
console.log('🔧 Focus Streak debug script loaded!');
console.log('📝 Run: debugFocusStreak()');

// Auto-run the debug
debugFocusStreak();