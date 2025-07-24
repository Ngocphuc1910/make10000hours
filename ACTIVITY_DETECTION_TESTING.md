# Activity Detection & Auto-Session Management Testing Guide

## Pre-Testing Setup

### 1. Enable Developer Console
- Open browser DevTools (F12)
- Monitor console logs for activity detection events
- Look for activity state changes: `🔍 Activity state changed`

### 2. Verify Initial State
```typescript
// Check store state in console
const store = useDeepFocusStore.getState();
console.log('Initial state:', {
  isDeepFocusActive: store.isDeepFocusActive,
  autoSessionManagement: store.autoSessionManagement,
  isSessionPaused: store.isSessionPaused
});
```

### 3. Test Environment
- Use Deep Focus page (`/deep-focus`)
- Start a deep focus session
- Ensure auto-management toggle is enabled

## Core Functionality Tests

### Test 1: Basic Activity Detection
**Objective**: Verify activity events are properly detected

**Steps**:
1. Start deep focus session
2. Verify "Active" status shows with green icon
3. Move mouse, click, type
4. Monitor console for activity updates

**Expected**: 
- Status remains "Active"
- Console shows activity events
- No inactivity warnings

### Test 2: Inactivity Timeout
**Objective**: Test automatic session pausing

**Steps**:
1. Start deep focus session
2. Stop all activity (don't touch mouse/keyboard)
3. Wait 5+ minutes
4. Check session status

**Expected**:
- After 5 minutes: Status changes to "Paused (inactive)"
- Yellow icon appears
- Console shows: `⏰ Inactivity timeout detected`
- Console shows: `🛑 Pausing deep focus session`

### Test 3: Activity Resumption
**Objective**: Test automatic session resumption

**Steps**:
1. Follow Test 2 to get paused session
2. Move mouse or click anywhere
3. Check session status immediately

**Expected**:
- Status changes to "Active" immediately
- Green icon returns
- Console shows: `▶️ Resuming deep focus session`

## System Event Tests

### Test 4: Browser Tab Switching
**Objective**: Test page visibility changes

**Steps**:
1. Start deep focus session
2. Switch to another tab for 30 seconds
3. Switch back to deep focus tab

**Expected**:
- Brief tab switches don't trigger pause
- Session remains active
- Console shows visibility changes

### Test 5: Browser Window Minimization
**Objective**: Test window focus/blur events

**Steps**:
1. Start deep focus session
2. Minimize browser window
3. Wait 6+ minutes
4. Restore window

**Expected**:
- Session pauses after inactivity threshold
- Status shows "Paused (inactive)"
- Resumes when window restored and mouse moved

### Test 6: Browser Close/Reopen
**Objective**: Test session persistence across browser sessions

**Steps**:
1. Start deep focus session
2. Close browser completely
3. Reopen and navigate to deep focus page

**Expected**:
- Previous session should be cleaned up as "orphaned"
- New session starts fresh if deep focus was active
- Auto-management setting persists

## Sleep/Hibernate Tests

### Test 7: System Sleep Simulation
**Objective**: Test laptop sleep scenario

**Steps**:
1. Start deep focus session
2. Close laptop lid (sleep mode)
3. Wait 10+ minutes
4. Wake up and open browser

**Expected**:
- Session should be paused when returning
- Page visibility API detects sleep
- Session resumes on activity

### Test 8: Extended Inactivity
**Objective**: Test very long periods of inactivity

**Steps**:
1. Start deep focus session
2. Leave computer untouched for 30+ minutes
3. Return and check status

**Expected**:
- Session paused after 5 minutes
- Remains paused regardless of duration
- Resumes immediately on activity

## Auto-Management Control Tests

### Test 9: Disable Auto-Management
**Objective**: Test manual override of auto-management

**Steps**:
1. Start deep focus session
2. Disable "Auto-pause on inactivity" toggle
3. Wait 10+ minutes without activity
4. Check session status

**Expected**:
- Session remains "Active" despite inactivity
- No automatic pausing occurs
- Manual toggle takes precedence

### Test 10: Enable Auto-Management Mid-Session
**Objective**: Test enabling auto-management during active session

**Steps**:
1. Start session with auto-management disabled
2. Enable auto-management toggle
3. Wait 6+ minutes without activity

**Expected**:
- Auto-management activates immediately
- Session pauses after threshold
- Setting change takes effect without restart

## Edge Case Tests

### Test 11: Rapid Activity/Inactivity Cycles
**Objective**: Test system stability with frequent state changes

**Steps**:
1. Start deep focus session
2. Alternate between 1-minute activity and 6-minute inactivity
3. Repeat cycle 3-5 times

**Expected**:
- System handles rapid pause/resume cycles
- No memory leaks or timer conflicts
- Accurate time tracking maintained

### Test 12: Multiple Tab Instances
**Objective**: Test behavior with multiple deep focus tabs

**Steps**:
1. Open deep focus page in multiple tabs
2. Start session in one tab
3. Switch between tabs
4. Test inactivity in various tabs

**Expected**:
- Activity detection works across tabs
- State synchronizes between instances
- No conflicts between tabs

### Test 13: Network Disconnection
**Objective**: Test offline behavior

**Steps**:
1. Start deep focus session
2. Disconnect network
3. Test activity detection
4. Reconnect network

**Expected**:
- Activity detection continues offline
- Local state management persists
- Database sync resumes when online

## Timing Accuracy Tests

### Test 14: Pause Time Exclusion
**Objective**: Verify paused time isn't counted

**Steps**:
1. Start session and note start time
2. Be active for 5 minutes
3. Let session pause for 10 minutes
4. Resume for 5 more minutes
5. End session and check duration

**Expected**:
- Total session duration: ~10 minutes
- Paused time (10 minutes) excluded
- Database reflects accurate active time

### Test 15: Timer Persistence
**Objective**: Test timer accuracy across pause/resume cycles

**Steps**:
1. Start session
2. Track displayed elapsed time
3. Pause session (inactivity)
4. Resume session
5. Verify timer continuity

**Expected**:
- Timer stops during pause
- Resumes from correct position
- No time gaps or overlaps

## Performance Tests

### Test 16: Long-Running Sessions
**Objective**: Test system stability over extended periods

**Steps**:
1. Start session and leave active for 2+ hours
2. Monitor console for errors
3. Check memory usage
4. Verify timer accuracy

**Expected**:
- No memory leaks
- Timer remains accurate
- System responsive throughout

### Test 17: High Activity Frequency
**Objective**: Test performance with frequent activity

**Steps**:
1. Start session
2. Continuously move mouse and type for 30 minutes
3. Monitor system performance

**Expected**:
- No performance degradation
- Responsive activity detection
- Efficient event handling

## UI/UX Tests

### Test 18: Status Indicator Visibility
**Objective**: Test visual feedback clarity

**Steps**:
1. Start session and verify "Active" indicator
2. Trigger pause and verify "Paused" indicator
3. Resume and verify status change

**Expected**:
- Clear visual distinction between states
- Immediate status updates
- Appropriate icon usage

### Test 19: Auto-Management Toggle
**Objective**: Test toggle functionality and persistence

**Steps**:
1. Toggle auto-management on/off multiple times
2. Refresh page and check setting
3. Start new session and verify behavior

**Expected**:
- Toggle state persists across sessions
- Immediate behavior change
- Clear labeling and functionality

## Regression Tests

### Test 20: Manual Toggle Behavior
**Objective**: Ensure manual toggles still work correctly

**Steps**:
1. Start session with auto-management enabled
2. Manually turn off deep focus
3. Manually turn on deep focus
4. Repeat multiple times

**Expected**:
- Manual toggles work as before
- Auto-management doesn't interfere
- Clean session start/stop

### Test 21: Extension Integration
**Objective**: Test compatibility with browser extension

**Steps**:
1. Enable extension if available
2. Start deep focus session
3. Test activity detection with extension active
4. Verify site blocking still works

**Expected**:
- No conflicts with extension
- Both systems work together
- Activity detection unaffected

## Debugging Scenarios

### Debug Test 1: Console Monitoring
**Steps**:
1. Open console and start session
2. Trigger each major event type
3. Document all console messages

**Look for**:
- Activity state changes
- Inactivity timeouts
- Session pause/resume events
- Error messages

### Debug Test 2: State Inspection
**Steps**:
1. Use browser dev tools to inspect store state
2. Trigger state changes
3. Verify state updates correctly

**Check**:
- `isSessionPaused` updates
- `totalPausedTime` accumulates correctly
- `autoSessionManagement` setting persists

## Test Results Documentation

### Pass/Fail Criteria
- ✅ **Pass**: Feature works as expected
- ⚠️ **Partial**: Works with minor issues
- ❌ **Fail**: Feature doesn't work or causes errors

### Issue Reporting Template
```
**Test**: [Test Number and Name]
**Issue**: [Brief description]
**Steps to Reproduce**: 
1. Step one
2. Step two
3. Step three

**Expected**: [What should happen]
**Actual**: [What actually happened]
**Console Errors**: [Any error messages]
**Browser**: [Browser and version]
**Severity**: [High/Medium/Low]
```

## Automated Testing Considerations

### Unit Tests Needed
- Activity detection event handling
- Timer pause/resume logic
- State management functions
- Database session operations

### Integration Tests
- Activity detection with session management
- UI component updates with state changes
- Cross-component synchronization
- Browser API interactions

This comprehensive testing guide ensures the activity detection system works reliably across all scenarios and edge cases. 
