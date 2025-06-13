# Extension Activity Enhancement Plan

## 🎯 **Overview**

This document outlines the implementation plan to solve the critical issue where the browser extension continues tracking time on websites even when the user sleeps their Mac or becomes inactive for extended periods.

## 🚨 **Current Problems Identified**

### **1. Minimal Activity Threshold**
- Extension uses only 5-second inactivity threshold
- Should be 5+ minutes like the web app

### **2. Continuous Time Tracking**
- Background script saves sessions every 30 seconds regardless of activity
- No pause mechanism during extended inactivity

### **3. Missing Sleep Detection**
- No system-level sleep/suspend detection
- Extension keeps counting time during system sleep

### **4. Weak Window Focus Logic**
- Basic pause/resume on window focus/blur
- Doesn't handle complex scenarios

## 📋 **Implementation Phases**

### **Phase 1: Enhanced Activity Detection**

#### **1.1 Background Script Enhancements**
- ✅ Add `EnhancedActivityManager` class
- ✅ Implement 5-minute inactivity threshold
- ✅ Add session pause/resume logic
- ✅ Integrate system suspend/resume detection

#### **1.2 Content Script Improvements**
- ✅ Upgrade to `EnhancedContentActivityDetector`
- ✅ Add 30-second activity threshold (vs current 5 seconds)
- ✅ Implement page freeze/resume detection
- ✅ Enhanced visibility monitoring

#### **1.3 Storage & State Management**
- ✅ Add pause state persistence
- ✅ Track total paused time
- ✅ Auto-recovery on extension restart

### **Phase 2: Integration & Testing**

#### **2.1 Modify Existing Background.js**
```javascript
// Key changes needed:
1. Import EnhancedActivityManager
2. Replace handleActivityDetected() method
3. Add pause/resume session logic
4. Update saveCurrentSession() to exclude paused time
5. Add settings for auto-management toggle
```

#### **2.2 Content Script Replacement**
```javascript
// Replace content.js with enhanced version:
1. Longer activity thresholds
2. Better visibility detection
3. System sleep detection via page lifecycle
4. Immediate reporting for critical events
```

#### **2.3 Manifest Updates**
```json
// Add permissions for:
1. "power" (if available for system events)
2. "background" (for service worker persistence)
3. "storage" (for state persistence)
```

### **Phase 3: Advanced Features**

#### **3.1 Smart Session Management**
- Automatic session splitting on long pauses
- Intelligent resume detection
- Historical pause time analysis

#### **3.2 User Controls**
- Auto-management toggle in popup
- Activity threshold customization
- Pause/resume notifications

#### **3.3 Analytics & Insights**
- Track pause frequency and duration
- Show "actual focus time" vs "total time"
- Sleep pattern insights

## 🔧 **Detailed Implementation**

### **1. Background Script Changes**

```javascript
// Add to FocusTimeTracker class:

class FocusTimeTracker {
  constructor() {
    // ... existing code ...
    this.activityManager = new EnhancedActivityManager();
    this.isSessionPaused = false;
    this.pausedAt = null;
    this.totalPausedTime = 0;
  }

  async initialize() {
    // ... existing code ...
    
    // Initialize activity manager
    await this.activityManager.initialize();
    
    // Set up activity callbacks
    this.activityManager.onSessionPaused = (duration) => {
      this.handleSessionPaused(duration);
    };
    
    this.activityManager.onSessionResumed = (pausedDuration) => {
      this.handleSessionResumed(pausedDuration);
    };
  }

  async handleEnhancedActivityDetected(activityData) {
    // Replace existing handleActivityDetected
    this.activityManager.updateActivity(activityData);
    
    // Continue with existing tracking logic
    if (activityData.isActive && !this.isSessionPaused) {
      await this.continueTracking();
    }
  }

  async handleSessionPaused(duration) {
    if (!this.currentSession.isActive) return;
    
    console.log('🛑 Pausing session due to inactivity:', duration);
    
    // Save current progress before pausing
    await this.saveCurrentSession();
    
    // Mark as paused
    this.isSessionPaused = true;
    this.pausedAt = Date.now();
    
    // Stop timers but keep session data
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }
  }

  async handleSessionResumed(pausedDuration) {
    if (!this.isSessionPaused) return;
    
    console.log('▶️ Resuming session after pause:', pausedDuration);
    
    // Update pause tracking
    this.totalPausedTime += pausedDuration;
    this.isSessionPaused = false;
    this.pausedAt = null;
    
    // Restart save interval
    this.saveInterval = setInterval(() => {
      if (this.currentSession.isActive && !this.isSessionPaused) {
        this.saveCurrentSession();
      }
    }, 30000);
  }

  async saveCurrentSession() {
    try {
      if (this.currentSession.isActive && this.currentSession.startTime && !this.isSessionPaused) {
        const now = Date.now();
        const grossTimeSpent = now - this.currentSession.startTime;
        const netTimeSpent = grossTimeSpent - this.totalPausedTime;
        
        // Only save positive net time
        if (netTimeSpent > 1000) {
          await this.storageManager.saveTimeEntry(
            this.currentSession.domain, 
            netTimeSpent, // Use net time (excluding pauses)
            0
          );
          
          console.log('💾 Session saved:', {
            domain: this.currentSession.domain,
            grossTime: this.storageManager.formatTime(grossTimeSpent),
            pausedTime: this.storageManager.formatTime(this.totalPausedTime),
            netTime: this.storageManager.formatTime(netTimeSpent)
          });
        }
      }
    } catch (error) {
      console.error('Error saving session:', error);
    }
  }
}
```

### **2. Message Handling Updates**

```javascript
// Add to handleMessage method:

case 'ENHANCED_ACTIVITY_DETECTED':
  await this.handleEnhancedActivityDetected(message.payload);
  sendResponse({ success: true });
  break;

case 'ACTIVITY_HEARTBEAT':
  // Handle heartbeat to maintain connection
  this.activityManager.updateActivity(message.payload);
  sendResponse({ success: true });
  break;

case 'GET_ACTIVITY_STATE':
  const activityState = this.activityManager.getActivityState();
  sendResponse({ success: true, data: activityState });
  break;

case 'TOGGLE_AUTO_MANAGEMENT':
  const enabled = message.payload?.enabled ?? true;
  await this.activityManager.setAutoManagement(enabled);
  sendResponse({ success: true, enabled });
  break;
```

## 🧪 **Testing Scenarios**

### **Critical Test Cases**

1. **Mac Sleep Test**
   - Start tracking on a website
   - Close laptop lid (sleep)
   - Wait 30+ minutes
   - Open laptop
   - Verify time tracking paused during sleep

2. **Extended Inactivity Test**
   - Start tracking
   - Leave computer idle for 10+ minutes
   - Return and move mouse
   - Check that 5+ minutes of inactivity were excluded

3. **Browser Minimize Test**
   - Start tracking
   - Minimize browser for 20+ minutes
   - Restore browser
   - Verify pause/resume behavior

4. **Tab Switch Test**
   - Track website A
   - Switch to website B
   - Leave idle for 10+ minutes
   - Return to website A
   - Check activity management

5. **System Restart Test**
   - Start tracking
   - Restart computer
   - Reopen extension
   - Verify state recovery

### **Automated Testing**

```javascript
// Test script for extension
const testScenarios = [
  {
    name: 'Inactivity Pause',
    steps: [
      'Start tracking',
      'Simulate 6 minutes of inactivity',
      'Check session is paused',
      'Simulate activity',
      'Check session is resumed'
    ]
  },
  {
    name: 'Page Visibility',
    steps: [
      'Start tracking',
      'Hide page for 10 minutes',
      'Show page',
      'Verify time tracking accuracy'
    ]
  }
];
```

## 📊 **Success Metrics**

### **Before Implementation**
- ❌ Extension tracks time during Mac sleep
- ❌ No pause during extended inactivity
- ❌ Inflated time metrics
- ❌ Poor user trust in time tracking

### **After Implementation**
- ✅ Automatic pause during system sleep
- ✅ 5-minute inactivity threshold
- ✅ Accurate net focus time tracking
- ✅ User confidence in metrics
- ✅ Exclude paused time from analytics

## 🚀 **Deployment Plan**

### **Phase 1: Development (Day 1-2)**
1. Create enhanced activity classes
2. Modify background.js integration
3. Update content script
4. Add new message handlers

### **Phase 2: Testing (Day 3)**
1. Manual testing of all scenarios
2. Automated test script execution
3. Edge case validation
4. Performance impact assessment

### **Phase 3: Rollout (Day 4)**
1. Update manifest version
2. Package extension
3. Deploy to users
4. Monitor error logs
5. Gather user feedback

## 🔄 **Backward Compatibility**

- Existing time data remains unchanged
- New pause tracking is additive
- Settings include auto-management toggle
- Fallback to existing behavior if issues occur

## 📱 **User Interface Updates**

### **Popup Enhancements**
```javascript
// Add to popup:
- Activity status indicator
- Auto-management toggle
- Pause time display
- "Actual focus time" vs "Total time"
```

### **Options Page**
```javascript
// Add settings:
- Inactivity threshold (default 5 minutes)
- Auto-management enabled (default true)
- Activity sensitivity (default medium)
- Pause notifications (default enabled)
```

## 🎯 **Expected Outcomes**

1. **Accurate Time Tracking**: Users get true focus time excluding sleep/inactivity
2. **Better User Experience**: No more inflated metrics
3. **System Integration**: Proper handling of Mac sleep/wake cycles
4. **Trust & Reliability**: Users can trust the time tracking data
5. **Productivity Insights**: More meaningful analytics and patterns

This enhancement will make the extension significantly more reliable and trustworthy for time tracking, especially for users who frequently sleep their laptops or step away for extended periods. 