# Timer Fix Testing Guide

## Fix Applied
The timer has been fixed to compensate for browser throttling when tabs are in the background.

## What Was Fixed

### 1. Added `setCurrentTime` Method
- **File**: `/src/store/timerStore.ts`
- **Line**: 426-430
- Allows the timer to be corrected to the accurate time

### 2. Implemented Time-Based Correction
- **File**: `/src/App.tsx`  
- **Lines**: 446-472
- Calculates actual elapsed time when tab becomes visible
- Corrects any drift automatically
- Updates missed minutes in the session

## How to Test the Fix

### Test Scenario 1: Basic Background Throttling
1. Open the app at http://localhost:3015/
2. Start a 25-minute Pomodoro timer
3. Note the exact time (e.g., 25:00)
4. Switch to another tab (e.g., open Facebook)
5. Wait 60 seconds
6. Switch back to the timer tab
7. **Expected**: Timer should show ~24:00 (not 24:59)
8. **Console**: Should see "Tab visible - correcting time drift" message

### Test Scenario 2: Extended Background Time
1. Start a timer at 25:00
2. Switch to another tab
3. Wait 5 minutes
4. Return to the timer tab
5. **Expected**: Timer should show ~20:00 (not 24:55)
6. **Console**: Should see drift correction applied

### Test Scenario 3: Complete Background Suspension
1. Start a timer
2. Minimize the browser completely
3. Wait 10 minutes
4. Restore the browser and switch to timer tab
5. **Expected**: Timer should show correct remaining time
6. **Console**: Should see large drift correction (e.g., 600 seconds)

## Console Messages to Observe

### When Tab Goes Hidden:
```
📴 Tab hidden at 2025-01-16T01:23:45.123Z - timer may be throttled
```

### When Tab Becomes Visible (with drift):
```
📱 Tab visible - correcting time drift: 58 seconds
⏰ Current: 1499, Expected: 1441, Correcting to: 1441
```

### For Large Drift (>60 seconds):
```
📊 Updating session with 2 missed minutes
```

## How the Fix Works

1. **Session Start Tracking**: When timer starts, we record:
   - `sessionStartTime`: Exact timestamp when timer started
   - `sessionStartTimerValue`: Timer value when it started (e.g., 1500 for 25:00)

2. **Visibility Change Detection**: When tab becomes visible again:
   - Calculate `realElapsed`: Actual seconds elapsed since start
   - Calculate `expectedTime`: What the timer SHOULD show
   - Calculate `drift`: Difference between current and expected

3. **Automatic Correction**: If any drift detected:
   - Call `setCurrentTime(expectedTime)` to correct the timer
   - Update session with missed minutes if drift > 60 seconds

## Benefits of This Fix

1. **Accurate Time Tracking**: Timer always shows correct remaining time
2. **Session Integrity**: Missed minutes are properly recorded
3. **Seamless UX**: Users don't lose track of their Pomodoro sessions
4. **Battery Friendly**: Still allows browser throttling for battery savings
5. **No Rapid Ticking**: Avoids the "rapid tick corruption" issue

## Verification Steps

1. Open browser DevTools Console
2. Start a timer
3. Switch tabs for 1+ minutes
4. Return to timer tab
5. Verify:
   - Timer shows correct time
   - Console shows drift correction
   - No rapid ticking occurs
   - Timer continues normally

## Edge Cases Handled

- Multiple tab switches
- Browser minimization
- Computer sleep/wake
- Extended background time (>5 minutes)
- Page freeze/resume (if supported by browser)

## Future Enhancements (Optional)

1. **Web Worker Implementation**: Run timer in Web Worker for true background execution
2. **Service Worker**: Use Service Worker for persistent timing
3. **Notification API**: Alert users when Pomodoro completes in background
4. **Progressive Correction**: Smooth animation when correcting large drifts