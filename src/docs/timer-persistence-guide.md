# Timer Persistence & Cross-Device Synchronization Guide

## Overview

The Pomodoro Timer now includes robust persistence and real-time synchronization across all your devices. Your timer state is automatically saved to the cloud and synchronized in real-time, ensuring you never lose your progress.

## Features

### ✅ **Persistent Timer State**
- Timer countdown continues even after page reload
- Current session mode (Pomodoro/Short Break/Long Break) is preserved
- Session count and selected task remain intact
- Timer settings are synchronized across devices

### ✅ **Cross-Device Synchronization**
- Real-time sync across all logged-in devices
- Seamless handoff between desktop, tablet, and mobile
- Only one device can run the timer at a time (conflict prevention)
- Visual indicators show which device is currently active

### ✅ **Offline Support**
- Timer continues to work without internet connection
- State syncs automatically when connection is restored
- Local backup ensures no data loss during outages

### ✅ **Smart Conflict Resolution**
- Automatic device detection and handoff
- Manual "Take Control" option for switching devices
- Time calculation adjustments for accurate countdown

## How It Works

### For Users

1. **Start a Timer**: Begin a Pomodoro session on any device
2. **Switch Devices**: Open the app on another device - your timer continues seamlessly
3. **Take Control**: Click "Take Control" to switch the active timer to your current device
4. **Monitor Sync**: View sync status in the right sidebar panel

### Visual Indicators

- **Green Check**: Timer synced successfully
- **Blue Spinning**: Currently syncing
- **Orange Device**: Timer running on another device
- **Red Error**: Sync error (manual retry available)

## Technical Implementation

### Database Schema

```typescript
interface TimerState {
  userId: string;
  currentTime: number; // seconds remaining
  totalTime: number; // total seconds for current session
  mode: TimerMode; // 'pomodoro' | 'shortBreak' | 'longBreak'
  sessionsCompleted: number;
  isRunning: boolean;
  currentTaskId: string | null;
  lastUpdated: Date; // for conflict resolution
  sessionStartTime?: Date; // when timer was started
  deviceId?: string; // to track which device is running the timer
}
```

### Architecture Components

1. **TimerService**: Handles Firestore operations and real-time subscriptions
2. **Enhanced TimerStore**: Zustand store with persistence methods
3. **TimerSyncStatus**: UI component for monitoring sync status
4. **Device Management**: Unique device ID generation and tracking

### Key Features

- **Debounced Saves**: Prevents excessive database writes during timer ticks
- **Real-time Listeners**: Firestore onSnapshot for instant synchronization
- **Time Calculation**: Adjusts for elapsed time when switching devices
- **Error Handling**: Graceful fallbacks and retry mechanisms

## User Guide

### Starting a Timer Session

1. Select a task from the task list
2. Choose your timer mode (Pomodoro/Short Break/Long Break)
3. Click "Start" - timer begins and auto-saves

### Switching Between Devices

1. **Automatic**: Open the app on another device - timer state loads automatically
2. **Manual Control**: If another device is active, click "Start (Take Control)"
3. **Monitor Status**: Check the sync status panel for current device information

### Troubleshooting Sync Issues

If you see sync errors:

1. Check your internet connection
2. Click the refresh button in the sync status panel
3. Try the "Take Control" button to reset the session
4. Log out and log back in if issues persist

### Privacy & Security

- Timer state is only accessible to your authenticated account
- Device IDs are generated locally and don't contain personal information
- All data is encrypted in transit and at rest via Firebase Security Rules

## Developer Notes

### Setup Requirements

1. Firebase/Firestore configured with authentication
2. Proper security rules for the `timerStates` collection
3. Real-time subscriptions enabled

### Security Rules Example

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /timerStates/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### Performance Considerations

- Debounced saves (2-second delay) prevent excessive writes
- Real-time listeners are cleaned up on component unmount
- Device detection uses localStorage for persistence

### Error Handling

- Network errors trigger retry mechanisms
- Offline state detection and queued operations
- Graceful degradation when sync is unavailable

## Future Enhancements

- [ ] Push notifications for timer completion across devices
- [ ] Timer history and analytics
- [ ] Shared timer sessions for team work
- [ ] Integration with calendar applications
- [ ] Smart suggestions based on usage patterns

---

*This feature requires user authentication and an active internet connection for synchronization. Local timer functionality remains available offline.* 