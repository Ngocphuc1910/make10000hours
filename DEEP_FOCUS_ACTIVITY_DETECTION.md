# Deep Focus Activity Detection & Auto-Session Management

## Overview

This system automatically manages deep focus sessions based on user activity, solving the critical issue of inaccurate time tracking when users forget to manually turn off deep focus sessions.

## Core Problem Solved

**Before**: Users could start a deep focus session and forget to turn it off when they:
- Put their laptop to sleep
- Shut down their computer
- Close the browser
- Go inactive for extended periods

This resulted in inflated "deep focus" metrics that didn't reflect actual productive time.

**After**: The system automatically pauses sessions during inactivity and resumes them when the user returns.

## Key Features

### 1. Activity Detection (`useActivityDetection`)
- **Mouse/Keyboard Monitoring**: Tracks user interactions (clicks, keypresses, scrolls)
- **Page Visibility Tracking**: Detects when browser/tab loses focus
- **Window Focus Events**: Monitors when browser window gains/loses focus
- **Configurable Thresholds**: 5-minute default inactivity threshold
- **Heartbeat System**: 30-second periodic activity checks

### 2. Smart Session Management
- **Auto-Pause**: Automatically pauses sessions after 5 minutes of inactivity
- **Auto-Resume**: Resumes sessions when user activity is detected
- **Accurate Timing**: Excludes paused time from session duration calculations
- **Manual Override**: Users can disable auto-management if desired

### 3. Enhanced Deep Focus Store
New state properties:
- `isSessionPaused`: Boolean indicating if session is currently paused
- `pausedAt`: Timestamp when session was paused
- `totalPausedTime`: Cumulative paused time in seconds
- `autoSessionManagement`: Boolean to enable/disable auto-management

### 4. Session Status Types
- `active`: Session is running and user is active
- `suspended`: Session paused due to inactivity (not yet implemented in DB)
- `completed`: Session properly ended

## Technical Implementation

### Hook Integration
```typescript
// Enhanced sync hook with activity detection
const enhancedSync = useEnhancedDeepFocusSync();

// Returns activity state for components
const {
  isActive,           // User is currently active
  isVisible,          // Page is visible
  inactivityDuration, // Seconds since last activity
  isSessionPaused,    // Session is paused
  autoSessionManagement // Auto-management enabled
} = enhancedSync;
```

### Store Methods
```typescript
// Pause session due to inactivity
pauseSessionOnInactivity: (inactivityDuration: number) => Promise<void>

// Resume session when activity detected
resumeSessionOnActivity: () => Promise<void>

// Toggle auto-management on/off
setAutoSessionManagement: (enabled: boolean) => void
```

### Database Session Service
```typescript
// New session management methods
suspendSession(sessionId: string): Promise<void>
resumeSession(sessionId: string): Promise<void>
```

## UI Components

### Session Status Indicator
- **Active**: Green icon with "Active" text
- **Paused**: Yellow icon with "Paused (inactive)" text
- Real-time status updates

### Auto-Management Toggle
- Checkbox control to enable/disable auto-pause functionality
- Only visible when deep focus is active
- Setting persisted across sessions

## Activity Detection Configuration

```typescript
{
  inactivityThreshold: 300,  // 5 minutes in seconds
  heartbeatInterval: 30,     // Check every 30 seconds
  onActivityChange: (state) => { /* Handle activity changes */ },
  onInactivityTimeout: (duration) => { /* Handle inactivity */ },
  onVisibilityChange: (isVisible) => { /* Handle visibility changes */ }
}
```

## Edge Cases Handled

### System Events
1. **Laptop Sleep/Hibernate**: Page visibility API detects hidden state
2. **Browser Close**: beforeunload events trigger session cleanup
3. **System Shutdown**: Extended inactivity timeout triggers pause
4. **Network Disconnection**: Local state management continues

### User Scenarios
1. **Tab Switching**: Brief invisibility doesn't trigger pause
2. **Short Breaks**: 5-minute threshold prevents false pauses
3. **Multi-Device Usage**: Each device manages its own session state
4. **Page Reload**: Orphaned session cleanup maintains consistency

### Recovery Mechanisms
1. **Graceful Resumption**: Sessions resume where they left off
2. **Accurate Duration**: Paused time excluded from totals
3. **State Persistence**: Auto-management preference saved
4. **Conflict Prevention**: Manual toggles override auto-management

## Benefits

### For Users
- **Accurate Metrics**: Deep focus time reflects actual productive work
- **Hands-Free Operation**: No need to remember to turn off sessions
- **Flexible Control**: Can disable auto-management if desired
- **Visual Feedback**: Clear status indicators show session state

### For System
- **Data Integrity**: Prevents inflated time tracking
- **Resource Efficiency**: Paused sessions don't consume unnecessary resources
- **Backward Compatibility**: Existing functionality preserved
- **Extensible Design**: Easy to add new activity detection methods

## Configuration Options

### User Settings
- **Auto-Management**: Toggle automatic pause/resume (default: enabled)
- **Inactivity Threshold**: Currently fixed at 5 minutes (configurable in code)
- **Activity Sensitivity**: Mouse/keyboard event thresholds

### Developer Settings
```typescript
// Activity detection customization
const activityOptions = {
  inactivityThreshold: 300,    // Seconds before pause
  heartbeatInterval: 30,       // Check frequency
  activityEvents: [            // Events to monitor
    'mousedown', 'mousemove', 'keypress', 
    'scroll', 'touchstart', 'click'
  ]
};
```

## Future Enhancements

### Planned Features
1. **Smart Thresholds**: Machine learning-based inactivity detection
2. **Activity Categories**: Different thresholds for different work types
3. **Calendar Integration**: Pause sessions during scheduled breaks
4. **Cross-Device Sync**: Coordinate sessions across multiple devices

### Potential Improvements
1. **Background Monitoring**: OS-level activity detection
2. **Predictive Pausing**: Anticipate breaks based on patterns
3. **Productivity Analytics**: Correlation between activity and productivity
4. **Integration APIs**: Connect with other productivity tools

## Migration Guide

### Existing Users
- Auto-management enabled by default
- No action required for basic functionality
- Manual toggle behavior unchanged
- Existing session data unaffected

### Developers
- Replace `useDeepFocusSync` with `useEnhancedDeepFocusSync`
- Add activity detection hooks where needed
- Update components to show session status
- Test inactivity scenarios thoroughly

## Monitoring & Debugging

### Console Logs
- Activity state changes: `🔍 Activity state changed`
- Inactivity detection: `⏰ Inactivity timeout detected`
- Session pause/resume: `🛑 Pausing/▶️ Resuming deep focus session`
- Visibility changes: `👁️ Page visibility changed`

### State Inspection
```typescript
// Check current activity state
const store = useDeepFocusStore.getState();
console.log({
  isSessionPaused: store.isSessionPaused,
  totalPausedTime: store.totalPausedTime,
  autoSessionManagement: store.autoSessionManagement
});
```

This system provides a robust, user-friendly solution to the deep focus session management problem while maintaining flexibility and extensibility for future enhancements. 