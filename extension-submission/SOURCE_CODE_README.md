# 10000Hours Chrome Extension - Source Code

This package contains the complete source code for the 10000Hours Chrome Extension for Chrome Web Store review.

## Extension Overview

**Name**: 10000Hours - Website usage tracking & Distraction blocking  
**Version**: 1.0.2  
**Purpose**: Productivity tool that tracks website usage time and blocks distracting sites during focus sessions.

## Core Functionality

### 1. Website Usage Tracking
- **File**: `background.js` (lines 100-400+)
- **Method**: Uses Chrome tabs API and webNavigation API to track time spent on websites
- **Storage**: Local Chrome storage with daily aggregation
- **Features**: 
  - Tracks active tab time
  - Detects tab switches and window focus changes
  - Aggregates daily usage statistics
  - Syncs with main app via Firebase

### 2. Site Blocking During Focus Sessions
- **Files**: `rules.json`, `background.js`, `blocked.html`
- **Method**: Uses Chrome declarativeNetRequest API to redirect blocked sites
- **Blocked Sites**: Facebook, Twitter/X, Instagram, YouTube, Reddit, TikTok (configurable)
- **Features**:
  - Redirects to custom blocked page (`blocked.html`)
  - Shows focus statistics and motivational content
  - Temporary override functionality (5-minute bypass)
  - Deep focus mode integration

### 3. Firebase Integration
- **File**: `vendor/firebase/firebase-bundle.js`
- **Purpose**: Syncs extension data with main web application
- **Data**: Usage statistics, focus session data, user preferences

## File Structure

```
extension/
├── manifest.json           # Extension configuration
├── background.js          # Main service worker (time tracking, blocking logic)
├── content.js            # Content script for page interaction
├── rules.json            # Declarative net request blocking rules
├── blocked.html          # Custom block page with statistics
├── blocked.js            # Block page functionality
├── popup/               # Extension popup interface
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── options/             # Extension options page
│   ├── options.html
│   ├── options.js
│   └── options.css
├── models/              # Data management classes
│   ├── BlockingManager.js
│   ├── StorageManager.js
│   └── FocusTimeTracker.js
├── utils/               # Utility modules
│   ├── dateUtils.js
│   ├── timeUtils.js
│   └── MessageQueueManager.js
└── assets/              # Icons, fonts, styles
    ├── icons/
    └── fonts/
```

## Key Technical Features

1. **Manifest V3 Compliance**: Uses service workers and declarativeNetRequest
2. **Real-time Tracking**: Monitors tab activity and calculates precise usage times
3. **Cross-origin Communication**: Secures communication with main web app
4. **Offline Capability**: Works without internet connection for basic blocking
5. **Data Privacy**: All data stored locally with optional cloud sync

## Permissions Explanation

- `storage`: Store usage statistics and preferences locally
- `tabs`: Track active tabs for time calculation
- `activeTab`: Monitor current tab activity
- `declarativeNetRequest`: Block distracting websites
- `webNavigation`: Detect page navigation for accurate tracking
- `favicon`: Display website icons in statistics
- `<all_urls>`: Required for tracking any website usage

## Testing Instructions

1. Load extension in Chrome Developer mode
2. Visit any tracked website (e.g., facebook.com) - should redirect to blocked page
3. Check popup for usage statistics
4. Verify blocking can be temporarily overridden
5. Test focus mode integration with main app

## Compliance Notes

- No data collection without user consent
- All tracking data stored locally by default
- Optional cloud sync requires user authentication
- Blocking rules clearly defined in rules.json
- Professional blocked page explains functionality

## Build Process

Extension built using:
- Webpack for Firebase bundle creation
- npm script: `npm run build-extension-firebase`
- No minification of main extension files for review transparency

## Contact

- Website: https://app.make10000hours.com
- Support: Available through main application

---

This source code package is provided for Chrome Web Store review purposes. All functionality described in the extension listing is implemented and working as specified.