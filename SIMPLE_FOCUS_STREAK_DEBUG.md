# 🔍 Simple Focus Streak Debug Script

Copy and paste this into your browser console on the dashboard page:

```javascript
// 🔍 Focus Streak Debug Script - Paste this in browser console
(async function debugFocusStreak() {
  console.log('🔍 === FOCUS STREAK DEBUG ===');
  
  // Get user
  const user = window.useUserStore?.getState?.()?.user;
  if (!user) {
    console.log('❌ No user found');
    return;
  }
  console.log('👤 User:', user.uid.substring(0, 8) + '...');
  
  // Get Focus Streak store
  const store = window.useFocusStreakStore?.getState?.();
  if (!store) {
    console.log('❌ Focus Streak store not found');
    return;
  }
  
  // Check current cache
  const currentYear = new Date().getFullYear();
  const cache = store.yearCache?.get?.(currentYear);
  console.log('📦 Current cache:', cache ? {
    sessions: cache.sessions.length,
    sample: cache.sessions.slice(0, 3).map(s => ({
      id: s.id.substring(0, 8),
      date: s.date,
      hasUTC: !!s.startTimeUTC
    }))
  } : 'No cache');
  
  // Clear cache and fetch fresh
  console.log('🔄 Clearing cache and fetching fresh...');
  store.clearCache();
  
  try {
    const sessions = await store.getSessionsForYear(user.uid, currentYear);
    console.log('📊 Fresh data result:', {
      totalSessions: sessions.length,
      breakdown: {
        withUTC: sessions.filter(s => s.startTimeUTC).length,
        legacyOnly: sessions.filter(s => !s.startTimeUTC).length
      },
      sample: sessions.slice(0, 5).map(s => ({
        id: s.id.substring(0, 8),
        date: s.date,
        dataSource: s.startTimeUTC ? 'UTC' : 'Legacy'
      }))
    });
    
    // Check if we're getting both types
    const hasUTC = sessions.some(s => s.startTimeUTC);
    const hasLegacy = sessions.some(s => !s.startTimeUTC);
    
    console.log('🎯 Data source analysis:', {
      hasUTCData: hasUTC,
      hasLegacyData: hasLegacy,
      issue: !hasLegacy ? 'ONLY UTC DATA - LEGACY MISSING!' : hasLegacy && hasUTC ? 'Both sources working' : 'Only legacy data'
    });
    
  } catch (error) {
    console.log('❌ Error fetching data:', error);
  }
  
  console.log('🎯 === DEBUG COMPLETE ===');
})();
```

## Expected Output Analysis:

**If working correctly, you should see:**
```
📊 Fresh data result: {
  totalSessions: 150,
  breakdown: {
    withUTC: 30,      // New data since UTC implementation  
    legacyOnly: 120   // Historical data before UTC
  }
}
🎯 Data source analysis: {
  hasUTCData: true,
  hasLegacyData: true,
  issue: "Both sources working"
}
```

**If broken (only UTC), you'll see:**
```
📊 Fresh data result: {
  totalSessions: 30,
  breakdown: {
    withUTC: 30,      // Only new data
    legacyOnly: 0     // Missing historical data!
  }
}
🎯 Data source analysis: {
  hasUTCData: true,
  hasLegacyData: false,
  issue: "ONLY UTC DATA - LEGACY MISSING!"
}
```

## Possible Issues to Check:

1. **Build/Deploy Issue**: The updated Focus Streak store file hasn't been deployed
2. **Cache Issue**: Old cached version still running
3. **Import Issue**: TransitionQueryService not properly imported
4. **Service Error**: TransitionQueryService failing silently

**Run the script and share the output - it will pinpoint exactly what's happening!**