# Timer Minute Boundary Tracking Fix

## Problem

The original timer logic was losing 1 minute of work tracking in each session due to how minute boundaries were calculated.

### Original Flawed Logic:
- Session starts at 17:35 (1055 seconds) → `sessionStartMinute = 17`
- Timer hits 17:00 (1020 seconds) → `currentMinute = 17`, `minutesCrossed = 17 - 17 = 0` ❌ (no increment)
- Timer hits 16:00 (960 seconds) → `currentMinute = 16`, `minutesCrossed = 17 - 16 = 1` ✅ (1 increment)

**Result**: Lost 1 minute (from 17:35 to 17:00)

## Solution

Implemented individual minute boundary tracking instead of calculating total minutes from session start.

### New Logic:
1. Added `lastCountedMinute` state variable to track the last minute boundary where time was incremented
2. Modified tick function to detect when timer crosses from one minute to the next
3. Increment time for each minute boundary crossed individually

### Key Changes Made:

#### 1. Added New State Variable
```typescript
interface TimerState {
  // ... existing fields
  lastCountedMinute: number | null; // Last minute boundary where time was incremented
}
```

#### 2. Updated Tick Function
```typescript
tick: () => {
  // ... 
  if (activeSession && currentTime !== totalTime) {
    const currentMinute = Math.floor(currentTime / 60);
    
    // Initialize lastCountedMinute on first tick
    if (lastCountedMinute === null) {
      set({ lastCountedMinute: currentMinute });
    } else if (currentMinute < lastCountedMinute) {
      // Crossed minute boundary! (timer counts down)
      const minutesBoundariesCrossed = lastCountedMinute - currentMinute;
      
      if (currentTask && minutesBoundariesCrossed > 0) {
        timeSpentIncrement(currentTask.id, minutesBoundariesCrossed);
        set({ lastCountedMinute: currentMinute });
        get().updateActiveSession();
      }
    }
  }
}
```

#### 3. Updated Session Management
- `createActiveSession`: Initializes `lastCountedMinute: null`
- `updateActiveSession`: Simplified to always increment by 1 minute when called
- `completeActiveSession`: Handles any remaining partial minutes
- `switchActiveSession`: Resets minute tracking
- All state reset functions now include `lastCountedMinute: null`

## Expected Behavior Now

With the fix:
- Session starts at 17:35 → `lastCountedMinute = null` (initialized)
- First tick at 17:34 → `lastCountedMinute = 17` (set to current minute)
- Timer hits 17:00 → `currentMinute = 17`, still no boundary crossed
- Timer hits 16:59 → `currentMinute = 16`, boundary crossed! `minutesBoundariesCrossed = 17 - 16 = 1` ✅ +1 minute
- Timer hits 15:59 → `currentMinute = 15`, boundary crossed! `minutesBoundariesCrossed = 16 - 15 = 1` ✅ +1 minute

**Result**: Every minute boundary crossing is accurately tracked and counted.

## Benefits

1. **Accurate Time Tracking**: No more lost minutes in work sessions
2. **Real-time Tracking**: Each minute boundary is tracked as it happens
3. **Robust Session Management**: Handles task switching, pausing, and resuming correctly
4. **Consistent State**: All session state resets properly handle the new tracking variable

## Testing Scenario

To test the fix:
1. Start a pomodoro at any time (e.g., 17:35)
2. Let the timer run and cross minute boundaries (17:00, 16:00, etc.)
3. Verify that time spent increments by 1 minute for each boundary crossed
4. Test pausing/resuming and task switching to ensure tracking continues correctly 