# Timer Throttling Root Cause Analysis

## Problem Statement
The timer gradually slows down and eventually stops when the browser tab loses focus.

## Root Cause Identified

### 1. Browser Throttling Mechanism
Modern browsers implement aggressive throttling for background tabs to save CPU and battery:

#### Chrome/Chromium Throttling Stages:
1. **Active Tab**: setInterval runs normally (every 1000ms)
2. **Background Tab (0-10 seconds)**: Throttled to max 1 Hz (once per second)
3. **Background Tab (10+ seconds)**: Further throttled based on browser heuristics
4. **Background Tab (5+ minutes)**: Can be throttled to once per minute or stopped entirely
5. **Complete Suspension**: After extended periods, timers may stop completely

### 2. Current Implementation Issues

#### Issue #1: Pure setInterval Dependency
```javascript
// App.tsx line 427
intervalId = setInterval(tick, 1000);
```
- Relies entirely on setInterval firing every 1000ms
- No compensation for missed ticks
- Each tick decrements by exactly 1 second regardless of actual elapsed time

#### Issue #2: Drift Detection Without Correction
```javascript
// App.tsx lines 446-456
if (Math.abs(drift) > 2) {
    console.log(`📱 Tab visible - time drift: ${drift} seconds`);
    // For now, just log the drift without auto-correction
    // This prevents the rapid tick corruption
    console.log(`⏰ Current: ${currentTime}, Expected: ${expectedTime}`);
    
    // TODO: Implement safe correction after testing
}
```
- Detects time drift when tab becomes visible
- Does NOT correct the drift
- Comment indicates avoiding correction due to "rapid tick corruption" concerns

#### Issue #3: No Background Execution Strategy
- No Service Worker implementation
- No Web Worker for background timing
- No requestAnimationFrame fallback
- No Page Visibility API compensation

### 3. Evidence of the Problem

#### Browser Throttling Behavior:
1. **Chrome**: Aggressively throttles after 5 minutes to 1 tick/minute
2. **Safari**: Similar throttling with potential complete suspension
3. **Firefox**: Less aggressive but still throttles significantly

#### Current Code Acknowledges Issue:
- Line 426 comment: "Single interval - let browser throttle naturally"
- Line 451 comment: "For now, just log the drift without auto-correction"
- Lines 454-455: TODO comment about implementing safe correction

### 4. Why Timer Stops Completely

The timer stops completely because:

1. **Progressive Throttling**: Browser reduces setInterval frequency over time
2. **No Time Compensation**: Code assumes each tick = 1 second, but throttled ticks happen less frequently
3. **Accumulating Drift**: Each missed tick adds to the drift
4. **Complete Suspension**: After extended background time, browser may stop executing JavaScript entirely

### 5. Mathematical Proof

```
Expected behavior:
- Timer starts at 25:00 (1500 seconds)
- After 60 real seconds: should be at 24:00 (1440 seconds)

Actual behavior with throttling:
- Timer starts at 25:00 (1500 seconds)
- Background throttling: 1 tick per 60 seconds
- After 60 real seconds: timer at 24:59 (1499 seconds)
- Only 1 second counted instead of 60!
```

## Solutions Required

### Solution 1: Time-Based Correction (Recommended)
Instead of counting ticks, calculate actual elapsed time:
```javascript
const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
const newCurrentTime = sessionStartTimerValue - elapsed;
```

### Solution 2: Visibility Change Correction
Apply drift correction when tab becomes visible:
```javascript
if (Math.abs(drift) > 2) {
    state.setCurrentTime(expectedTime);
    state.updateMissedMinutes(drift);
}
```

### Solution 3: Web Worker Timer (Most Robust)
Implement a Web Worker that maintains accurate time even when main thread is throttled.

### Solution 4: Service Worker + Background Sync
Use Service Worker with Background Sync API for persistent timing.

## Conclusion

The timer stops because it relies on setInterval frequency without compensating for browser throttling. When the tab is in the background, the browser progressively reduces timer execution from once per second to once per minute or stops it entirely. The solution requires implementing time-based correction that calculates actual elapsed time rather than counting ticks.