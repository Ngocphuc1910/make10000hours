# Timer-Task Synchronization Bug Detection Tests

This comprehensive test suite is designed to expose critical timer-task synchronization bugs in the Pomodoro application where task timeSpent doesn't update properly and work sessions aren't created/updated correctly during timer execution.

## 🐛 Bug Scenarios Tested

### 1. Core Timer-Task Synchronization Issues
- **Timer runs but task timeSpent never updates** - Detects when timer ticks but task minutes aren't incremented
- **Work session creation failures** - Identifies when timer starts without creating active sessions
- **Duration update mismatches** - Catches when work session duration doesn't match actual timer progress
- **Race conditions** - Exposes timing issues between timer ticks and database updates

### 2. Network and Connection Issues  
- **Offline timer operation** - Tests timer behavior during network disconnection
- **Firebase write failures** - Simulates partial database update failures
- **High latency scenarios** - Tests race conditions with slow network requests
- **Retry mechanism failures** - Validates error handling and retry logic

### 3. Multi-Device Synchronization
- **Multiple tabs conflict** - Detects when multiple browser tabs run timers simultaneously  
- **Device takeover issues** - Tests proper device priority and session ownership
- **Remote state conflicts** - Validates sync behavior when devices have conflicting states
- **Cross-device session consistency** - Ensures work sessions are consistent across devices

### 4. Work Session Lifecycle
- **Session creation timeouts** - Tests behavior when session creation is slow/fails
- **Session status inconsistencies** - Detects active sessions not properly closed
- **Duration tracking failures** - Validates minute boundary detection and updates
- **UTC vs Legacy sync issues** - Tests dual session system consistency

## 🧪 Test Files

### `timer-task-sync.test.ts`
**Main synchronization bug detection** - Core timer-task sync issues, race conditions, and state inconsistencies.

**Key Tests:**
- Timer ticks but timeSpent not incrementing
- Active session creation/update failures  
- Race conditions between timer and task updates
- Firebase sync errors during timer operation

### `network-interruption.test.ts`
**Network and connection issues** - Tests timer behavior during network problems.

**Key Tests:**
- Timer continues offline but session updates fail
- Data loss when reconnecting after offline period
- Partial Firebase write failures
- Request timeout handling
- High latency race conditions

### `multi-device-sync.test.ts`
**Multi-device synchronization conflicts** - Tests cross-device timer conflicts and sync issues.

**Key Tests:**
- Multiple tabs starting timers simultaneously
- Device conflict resolution
- Remote state synchronization overwrites
- Session ownership conflicts
- Cross-device work session duplication

### `work-session-tracking.test.ts`
**Work session lifecycle and duration tracking** - Focuses on session creation, updates, and cleanup.

**Key Tests:**
- Work session creation failures
- Duration update consistency
- Session status lifecycle issues
- UTC vs Legacy session routing
- Session timing inconsistencies
- Orphaned session accumulation

## 🚀 Running the Tests

### Prerequisites
```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom
```

### Run All Timer-Task Sync Tests
```bash
npm test -- src/__tests__/timer-task-sync/
```

### Run Individual Test Files
```bash
# Core synchronization bugs
npm test -- timer-task-sync.test.ts

# Network interruption bugs  
npm test -- network-interruption.test.ts

# Multi-device sync bugs
npm test -- multi-device-sync.test.ts  

# Work session tracking bugs
npm test -- work-session-tracking.test.ts
```

### Run with Verbose Output
```bash
npm test -- --verbose src/__tests__/timer-task-sync/
```

### Run in Watch Mode for Development
```bash
npm test -- --watch src/__tests__/timer-task-sync/
```

## 🔍 Understanding Test Results

### 🔴 Critical Bugs (Test Failures)
When tests **FAIL**, they indicate **ACTUAL BUGS** in the synchronization logic:

```bash
🔴 CRITICAL BUG DETECTED: Timer ran for 1 minute but task timeSpent not updated!
{
  taskId: 'task-123',
  initialTimeSpent: 5,
  currentTimeSpent: 5,  // ❌ Should be 6
  timerSecondsElapsed: 60,
  activeSessionExists: true
}
```

### ✅ Passing Tests
When tests **PASS**, the synchronization is working correctly for that scenario.

### ⚠️ Console Warnings
Watch for warning messages that indicate potential issues:

```bash
⚠️ Duration update failures detected: {
  attemptedUpdates: 5,
  successfulUpdates: 3,
  inconsistencyRisk: true
}
```

## 🛠 Debugging Tips

### 1. Enable Debug Logging
Add this to your test file to see detailed sync operations:
```typescript
console.log('Timer State:', useTimerStore.getState());
console.log('Active Session:', timerStore.activeSession);
console.log('Task TimeSpent:', task.timeSpent);
```

### 2. Mock Network Conditions
Tests include network simulation utilities:
```typescript
networkSim.setOnline(false);  // Simulate offline
networkSim.setLatency(5000);  // Add 5s latency  
networkSim.setFailureRate(0.3); // 30% request failure rate
```

### 3. Capture Console Errors
Use the provided utility to catch bug indicators:
```typescript
const errorCapture = captureConsoleErrors();
// ... run test operations ...
const syncErrors = errorCapture.getErrorsContaining('sync');
```

## 🎯 Common Bug Patterns

### Timer Running Without Session
```typescript
// BUG: Timer is running but no active session exists
if (timerState.isRunning && !timerState.activeSession) {
  // This indicates session creation failed
}
```

### Duration Mismatch  
```typescript
// BUG: Timer elapsed time doesn't match session duration
const timerMinutes = Math.floor((initialTime - currentTime) / 60);
const sessionMinutes = durationUpdates.reduce((sum, update) => sum + update, 0);
if (timerMinutes !== sessionMinutes) {
  // Duration tracking is broken
}
```

### Race Conditions
```typescript
// BUG: Multiple rapid updates causing race conditions
if (updateCallCount < expectedUpdates) {
  // Some minute boundaries were missed
}
```

## 📊 Test Coverage

The test suite covers these critical paths:
- ✅ Timer start/stop/pause operations
- ✅ Minute boundary crossing detection  
- ✅ Work session CRUD operations
- ✅ Network failure scenarios
- ✅ Multi-device conflicts
- ✅ State synchronization edge cases
- ✅ UTC/Legacy session routing
- ✅ Error handling and recovery

## 🔧 Extending the Tests

### Adding New Bug Scenarios
1. Create test in appropriate file based on category
2. Use `detectTimerTaskSyncBug()` utility for common patterns
3. Include detailed error logging for debugging
4. Test both success and failure paths

### Custom Mock Scenarios
```typescript
// Create specific failure conditions
mockTransitionService.incrementDuration.mockImplementation(() => {
  if (Math.random() < 0.5) {
    throw new Error('Simulated failure');
  }
  return Promise.resolve();
});
```

## 🎯 Expected Outcomes

Running these tests should help identify:

1. **Root cause of timeSpent not updating** - Pinpoint where the timer-task sync breaks
2. **Work session inconsistencies** - Find why sessions aren't created or updated properly  
3. **Network resilience gaps** - Discover how offline/online transitions affect sync
4. **Multi-device conflicts** - Identify race conditions between browser tabs
5. **Database consistency issues** - Catch Firebase update failures and partial writes

These tests are designed to **FAIL** when bugs are present, making them excellent tools for TDD bug fixing and regression prevention.