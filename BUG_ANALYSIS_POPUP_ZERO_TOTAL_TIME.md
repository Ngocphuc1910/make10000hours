# Extension Popup "On Screen Time: 0m" Bug Analysis & Fix

## Problem Summary

The Chrome extension popup intermittently displays "On Screen Time: 0m" while the site usage list below shows correct data (e.g., "figma.com 4h 34m"). This creates a confusing user experience where total time appears as zero but individual site times are accurate.

## Root Cause Analysis

After comprehensive investigation, the root cause was identified as **corrupted session data in localStorage causing calculation failures in the `getTodayStats()` method**.

### Technical Details

1. **Data Source**: Both total time and site usage list use the same data source - `getTodayStats()` method
2. **Calculation Logic**: The method loops through stored sessions to calculate:
   - `totalTime` (sum of all session durations)
   - `sites` object (individual site statistics)
3. **Corruption Point**: Some sessions in storage have invalid `duration` values (undefined, null, NaN, or non-numeric)
4. **Failure Mode**: When invalid duration is encountered:
   - `totalTime += (session.duration * 1000)` fails silently or adds NaN/undefined
   - But `sites[domain]` object creation still succeeds
   - Result: totalTime becomes 0/NaN while sites data remains populated

### Why Intermittent?

The bug appeared intermittently because:
- Not all sessions are corrupted, only some
- The corruption depends on when/how sessions were stored
- Extension initialization timing could affect which sessions are processed
- Data corruption may have accumulated over time from various sources

## Code Investigation Evidence

**File: `/extension/background.js`**

**Original problematic code (line 895-908):**
```javascript
sessions.forEach(session => {
  const domain = session.domain;
  
  if (!stats.sites[domain]) {
    stats.sites[domain] = {
      timeSpent: 0,
      visits: 0
    };
  }
  
  stats.sites[domain].timeSpent += (session.duration * 1000); // ❌ No validation
  stats.sites[domain].visits += session.visits || 1;
  stats.totalTime += (session.duration * 1000); // ❌ No validation
});
```

**Issues identified:**
- No validation of `session.duration` type or value
- No handling of undefined/null/NaN duration values
- No error handling for corrupted session objects
- Silent failures that result in incorrect totalTime while sites data succeeds

## Fix Implementation

### 1. Enhanced `getTodayStats()` Method

**File: `/extension/background.js` (lines 879-974)**

Added comprehensive validation:

```javascript
sessions.forEach((session, index) => {
  // Validate session structure
  if (!session || typeof session !== 'object') {
    console.warn(`⚠️ Skipping invalid session at index ${index}:`, session);
    corruptedSessions++;
    return;
  }
  
  // Validate domain
  if (!domain || typeof domain !== 'string') {
    console.warn(`⚠️ Skipping session with invalid domain at index ${index}:`, session);
    corruptedSessions++;
    return;
  }
  
  // Validate duration - CRITICAL FIX
  const duration = session.duration;
  if (typeof duration !== 'number' || isNaN(duration) || duration < 0) {
    console.warn(`⚠️ Skipping session with invalid duration at index ${index}: ${duration} (${typeof duration})`, session);
    corruptedSessions++;
    return;
  }
  
  // Safe calculation only for validated sessions
  const durationMs = duration * 1000;
  stats.sites[domain].timeSpent += durationMs;
  stats.totalTime += durationMs;
  
  validSessions++;
});
```

**Key improvements:**
- ✅ Validates session object structure
- ✅ Validates domain field
- ✅ **Validates duration is a valid number** (critical fix)
- ✅ Skips corrupted sessions instead of failing silently
- ✅ Logs diagnostic information
- ✅ Tracks valid vs corrupted session counts

### 2. Enhanced `getRealTimeStatsWithSession()` Method

**File: `/extension/background.js` (lines 1068-1162)**

Added defensive programming:

```javascript
// Validate stored stats structure
if (!storedStats || typeof storedStats !== 'object') {
  console.warn('⚠️ Invalid storedStats, using defaults');
  storedStats = { totalTime: 0, sitesVisited: 0, sites: {} };
}

// Clone stored stats with validation
const realTimeStats = {
  totalTime: (typeof storedStats.totalTime === 'number' && !isNaN(storedStats.totalTime)) ? storedStats.totalTime : 0,
  sitesVisited: (typeof storedStats.sitesVisited === 'number' && !isNaN(storedStats.sitesVisited)) ? storedStats.sitesVisited : 0,
  sites: (storedStats.sites && typeof storedStats.sites === 'object') ? { ...storedStats.sites } : {}
};

// Final validation before returning
if (typeof realTimeStats.totalTime !== 'number' || isNaN(realTimeStats.totalTime)) {
  console.warn('⚠️ Final totalTime is invalid, resetting to 0');
  realTimeStats.totalTime = 0;
}
```

## Diagnostic Tools Created

### 1. Comprehensive Investigation Script
**File: `debug-popup-totals-investigation.js`**
- Analyzes raw storage structure
- Tests getTodayStats logic manually
- Compares background vs popup calculation
- Checks date key consistency
- Generates detailed report

### 2. Session Cleanup Utility
**File: `debug-session-cleanup.js`**
- Identifies corrupted sessions
- Provides cleanup functionality
- Validates fix effectiveness
- Comprehensive verification

## Testing & Verification

### Run Investigation Script
```javascript
// In extension popup console
// Paste debug-popup-totals-investigation.js content
// It will auto-run and generate report
```

### Run Cleanup if Needed
```javascript
// In extension popup console  
// Paste debug-session-cleanup.js content
cleanupCorruptedSessions(); // Dry run analysis
cleanupCorruptedSessions(false); // Actually clean corrupted data
verifyFix(); // Verify fix works
```

## Expected Outcomes

After applying the fix:

1. **Immediate**: Popup should show consistent non-zero total time when site data exists
2. **Logging**: Console will show validation messages identifying any corrupted sessions
3. **Resilience**: Extension will continue working even with corrupted data
4. **Diagnostic**: Clear logging will help identify any remaining issues

## Prevention

The fix includes:
- ✅ Comprehensive validation to prevent future corruption from causing failures
- ✅ Detailed logging to identify data quality issues
- ✅ Graceful handling of edge cases
- ✅ Defensive programming practices

## Files Modified

1. **`/extension/background.js`**
   - Enhanced `getTodayStats()` method (lines 879-974)
   - Enhanced `getRealTimeStatsWithSession()` method (lines 1068-1162)

2. **Debug Tools Created:**
   - `debug-popup-totals-investigation.js` - Comprehensive bug investigation
   - `debug-session-cleanup.js` - Session cleanup and verification utility

## Conclusion

This was a classic data corruption bug where invalid session duration values caused calculation failures in the totalTime aggregation while allowing sites data to succeed. The fix adds comprehensive validation and error handling to ensure the popup displays accurate data even when some sessions are corrupted.

The bug's intermittent nature was due to the variable presence of corrupted sessions in the storage, making it appear random when in fact it was deterministic based on data quality.