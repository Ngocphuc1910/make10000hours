# Timer Duration Update Fix

## Problem Identified

The timer was correctly detecting minute boundaries and triggering the `updateActiveSession()` method, but the work session duration in the database was not accumulating properly. After the first minute, subsequent minute updates were overwriting the duration instead of incrementing it.

### Root Cause

The issue was in two places:

1. **`updateActiveSession()` in `timerStore.ts`**: Was calling `workSessionService.updateSession()` with `duration: 1`, which **overwrites** the existing duration value instead of adding to it.

2. **`updateSession()` in `workSessionService.ts`**: Uses Firebase's `updateDoc()` which performs a **replace** operation, not an **increment** operation.

### Example of the Bug

- **Minute 1**: Session starts, duration = 0
- **Minute 2**: Timer crosses boundary, calls `updateSession({duration: 1})` → duration = 1 ✅
- **Minute 3**: Timer crosses boundary, calls `updateSession({duration: 1})` → duration = 1 ❌ (should be 2)
- **Minute 4**: Timer crosses boundary, calls `updateSession({duration: 1})` → duration = 1 ❌ (should be 3)

## Solution Implemented

### 1. Added `incrementDuration()` Method

Added a new method to `WorkSessionService` that uses Firebase's `increment()` function to properly add minutes to the existing duration:

```typescript
async incrementDuration(
  sessionId: string,
  minutesToAdd: number
): Promise<void> {
  try {
    const sessionRef = doc(this.workSessionsCollection, sessionId);
    const updateData = {
      duration: increment(minutesToAdd), // Firebase increment function
      updatedAt: new Date()
    };
    await updateDoc(sessionRef, updateData);
  } catch (error) {
    console.error('Error incrementing session duration:', error);
    throw error;
  }
}
```

### 2. Updated `updateActiveSession()` Method

Modified the timer store to use the new increment method:

```typescript
updateActiveSession: async () => {
  const { activeSession } = get();
  if (!activeSession) return;
  
  try {
    // Use increment instead of overwrite
    await workSessionService.incrementDuration(activeSession.sessionId, 1);
    
    // Update local state
    set({
      activeSession: {
        ...activeSession,
        lastUpdateTime: new Date()
      }
    });
  } catch (error) {
    console.error('Failed to update active session:', error);
  }
},
```

### 3. Updated `completeActiveSession()` Method

Also updated the completion method to use increment for any remaining partial minutes:

```typescript
// First, increment any remaining uncounted minutes
if (remainingMinutes > 0) {
  await workSessionService.incrementDuration(activeSession.sessionId, remainingMinutes);
}

// Then update status and end time (without touching duration)
const updates: Partial<Pick<WorkSession, 'status' | 'endTime' | 'notes'>> = {
  status,
  endTime: new Date(),
  notes: `Session ${status}${remainingMinutes > 0 ? `: +${remainingMinutes}m remaining` : ''}`,
};
await workSessionService.updateSession(activeSession.sessionId, updates);
```

## Expected Behavior After Fix

- **Minute 1**: Session starts, duration = 0
- **Minute 2**: Timer crosses boundary, calls `incrementDuration(1)` → duration = 0 + 1 = 1 ✅
- **Minute 3**: Timer crosses boundary, calls `incrementDuration(1)` → duration = 1 + 1 = 2 ✅
- **Minute 4**: Timer crosses boundary, calls `incrementDuration(1)` → duration = 2 + 1 = 3 ✅

## How to Test the Fix

### Manual Testing Steps:

1. **Start a Pomodoro Session**:
   - Select a task
   - Start the timer
   - Let it run for at least 3-4 minutes

2. **Monitor the Console**:
   - Open browser developer tools
   - Watch for "Timer minute boundary crossed" log messages
   - Each should show the boundary detection working

3. **Check Firebase Database**:
   - Look at the active work session in Firebase
   - Verify that the `duration` field increments by 1 for each minute boundary crossed
   - Should see: 0 → 1 → 2 → 3... (not staying at 1)

4. **Test Edge Cases**:
   - Pause and resume the timer
   - Switch tasks during active timer
   - Let timer complete naturally

### Expected Console Output:

```
Timer minute boundary crossed: {
  lastCountedMinute: 17,
  currentMinute: 16,
  minutesBoundariesCrossed: 1,
  currentTime: 959,
  currentTask: "Test Task",
  timer_display: "15:59"
}
Session updated: +1 minute {
  sessionId: "task123_2024-01-15_1705123456789",
  lastUpdateTime: Date
}
```

### Firebase Database Expected Changes:

```json
{
  "duration": 0,  // Initial
  "status": "active",
  "updatedAt": "2024-01-15T10:00:00.000Z"
}

// After 1 minute boundary
{
  "duration": 1,  // Incremented
  "status": "active", 
  "updatedAt": "2024-01-15T10:01:00.000Z"
}

// After 2 minute boundary  
{
  "duration": 2,  // Incremented again
  "status": "active",
  "updatedAt": "2024-01-15T10:02:00.000Z"
}
```

## Files Modified

1. **`src/api/workSessionService.ts`**:
   - Added `incrementDuration()` method
   - Added `increment` import from Firebase

2. **`src/store/timerStore.ts`**:
   - Updated `updateActiveSession()` to use `incrementDuration()`
   - Updated `completeActiveSession()` to use `incrementDuration()` for remaining minutes

## Benefits

- ✅ **Accurate Duration Tracking**: Each minute boundary correctly adds to the total
- ✅ **Firebase Atomic Operations**: Uses Firebase's built-in increment for consistency
- ✅ **No Race Conditions**: Increment operations are atomic and safe
- ✅ **Backward Compatibility**: Existing sessions and functionality unchanged
- ✅ **Real-time Accuracy**: Duration reflects actual time spent working 