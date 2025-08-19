// 🔧 FOCUS STREAK FIX TEST
// Run this in browser console after the fix

(async function testFocusStreakFix() {
  console.log('🔧 === TESTING FOCUS STREAK FIX ===');
  
  // Get user
  const userStore = window.useUserStore?.getState?.();
  const userId = userStore?.user?.uid;
  
  if (!userId) {
    console.error('❌ No user found');
    return;
  }
  
  console.log('👤 User ID:', userId.substring(0, 8) + '...');
  
  // Clear ALL caches
  console.log('🧹 Clearing all caches...');
  window.localStorage.removeItem('focus-streak-cache');
  
  // Clear Focus Streak store cache
  const focusStore = window.useFocusStreakStore?.getState?.();
  if (focusStore?.clearCache) {
    focusStore.clearCache();
    console.log('✅ Focus Streak cache cleared');
  }
  
  // Test current year
  const currentYear = new Date().getFullYear();
  const yearStart = new Date(currentYear, 0, 1);
  const yearEnd = new Date(currentYear, 11, 31);
  
  console.log('📅 Testing year:', currentYear);
  console.log('📅 Date range:', {
    start: yearStart.toISOString().split('T')[0],
    end: yearEnd.toISOString().split('T')[0]
  });
  
  try {
    console.log('🔍 Testing Focus Streak getSessionsForYear...');
    const sessions = await focusStore.getSessionsForYear(userId, currentYear);
    
    console.log('📊 Focus Streak Test Results:', {
      totalSessions: sessions.length,
      breakdown: {
        withUTC: sessions.filter(s => s.startTimeUTC).length,
        legacyOnly: sessions.filter(s => !s.startTimeUTC).length
      },
      sample: sessions.slice(0, 5).map(s => ({
        id: s.id.substring(0, 8),
        date: s.date,
        dataSource: s.startTimeUTC ? 'UTC' : 'Legacy',
        hasStartTimeUTC: !!s.startTimeUTC
      }))
    });
    
    // Check data sources
    const hasUTC = sessions.some(s => s.startTimeUTC);
    const hasLegacy = sessions.some(s => !s.startTimeUTC);
    
    console.log('🎯 Data Source Analysis:', {
      hasUTCData: hasUTC,
      hasLegacyData: hasLegacy,
      status: !hasLegacy ? '❌ STILL MISSING LEGACY DATA' : 
              hasLegacy && hasUTC ? '✅ BOTH SOURCES WORKING!' : 
              '⚠️ Only legacy data'
    });
    
    if (hasLegacy && hasUTC) {
      console.log('🎉 SUCCESS! Focus Streak is now getting both UTC and Legacy data!');
    } else if (!hasLegacy) {
      console.log('🚨 ISSUE PERSISTS: Legacy data still missing. Check Firebase indexes.');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.log('💡 This might be due to missing Firebase indexes');
  }
  
  console.log('🔧 === TEST COMPLETE ===');
})();