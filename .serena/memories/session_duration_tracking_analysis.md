# Session Duration Tracking Analysis - 27h vs 2h Issue

## Root Causes Identified

### 1. **Multiple Active Sessions Per Domain**
- **Issue**: The system can create multiple "active" sessions for the same domain
- **Location**: `extension/background.js` - `StorageManager.saveTimeEntry()` method (line 606-681)
- **Problem**: When `saveTimeEntry` is called, it looks for an existing active session but can fail to find it due to timing issues, creating a new one instead
- **Result**: Multiple sessions accumulating time in parallel

### 2. **Frequent Save Intervals with Incremental Duration**
- **Issue**: Sessions are saved every 3 seconds via `setInterval` 
- **Location**: `extension/background.js` - `FocusTimeTracker.setupEventListeners()` line 3257-3261
- **Problem**: Each save adds incremental time (3 seconds worth) but timing calculations can be wrong
- **Current Logic**: 
  ```javascript
  this.saveInterval = setInterval(() => {
    if (this.currentSession.isActive) {
      this.saveCurrentSession();
    }
  }, 3000); // Save every 3 seconds
  ```

### 3. **Incremental Duration Calculation Issues**
- **Issue**: `saveCurrentSession()` calculates incremental duration but may double-count time
- **Location**: `extension/background.js` - lines 4745-4750
- **Problem**: 
  ```javascript
  const incrementalDuration = now - lastSaveTime;
  // This can be wrong if lastSaveTime isn't properly tracked
  ```

### 4. **Session Creation vs Update Logic**
- **Issue**: New sessions created instead of updating existing ones
- **Location**: `StorageManager.saveTimeEntry()` - lines 629-647
- **Problem**: The find logic for existing sessions might miss due to timing or status issues:
  ```javascript
  let activeSession = sessions[today].find(s => 
    s.domain === domain && 
    s.status === 'active'
  );
  ```

## Potential Solutions

### 1. **Ensure Single Active Session Per Domain**
- Add logic to close any existing active sessions before creating new ones
- Use domain+date as unique key

### 2. **Fix Incremental Duration Tracking** 
- Properly track `lastSaveTime` to prevent double-counting
- Add safeguards against unreasonably large incremental durations

### 3. **Session Consolidation**
- Instead of creating multiple sessions, always update the existing active session
- Add cleanup logic for orphaned sessions

### 4. **Add Duration Caps**
- Limit individual session durations to reasonable maximums (e.g., 4 hours)
- Add sleep detection improvements

## Files Requiring Changes
- `extension/background.js` (StorageManager.saveTimeEntry, FocusTimeTracker.saveCurrentSession)
- Session management logic needs comprehensive review

## Testing Required
- Monitor session creation patterns
- Verify only one active session per domain exists
- Test incremental duration calculations
- Validate total time calculations match expected usage