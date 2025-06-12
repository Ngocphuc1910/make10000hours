# Chrome Extension Integration Guide

## Overview

The Make10000hours web application now seamlessly integrates with the Focus Time Tracker Chrome Extension to provide real-time website usage tracking and site blocking functionality.

## Features Implemented

### ✅ Real-time Data Sync
- Website usage data from extension appears in Deep Focus page
- Automatic data refresh every 30 seconds
- Manual refresh button for immediate updates
- Data synchronization when web app regains focus

### ✅ Site Blocking Integration
- Block/unblock sites from web app → syncs to extension
- Extension blocking status reflected in web app
- Bidirectional synchronization of blocked sites list

### ✅ Extension Status Monitoring
- Visual indicator showing extension connection status
- Graceful fallback to mock data when extension is offline
- Real-time connection status updates

## Installation Steps

### 1. Install the Chrome Extension
```bash
# Navigate to extension directory
cd extension/

# Load extension in Chrome:
# 1. Open Chrome and go to chrome://extensions/
# 2. Enable "Developer mode" (top right toggle)
# 3. Click "Load unpacked" and select the extension folder
# 4. The Focus Time Tracker extension should now appear in your browser
```

### 2. Web App Setup
The web application is already configured to work with the extension. No additional setup required.

### 3. Verify Integration
1. Open the web app at `http://localhost:5173`
2. Navigate to the Deep Focus page
3. Look for the "Extension Connected" status indicator
4. If connected, you should see real extension data instead of mock data

## Usage Guide

### Website Usage Tracking
- The extension automatically tracks time spent on websites
- Data appears in the "Your Usage" section of Deep Focus page
- Time metrics are updated in real-time
- Historical data is preserved in the extension

### Site Blocking
1. **Block a site from web app:**
   - Click the "+" button in the BLOCKED section
   - Add websites to block
   - Changes are immediately synced to extension

2. **Toggle blocking:**
   - Use the toggle switches in the BLOCKED section
   - Sites are blocked/unblocked in the extension instantly

3. **Remove blocked sites:**
   - Click the remove button (×) on any blocked site
   - Site is unblocked in the extension automatically

### Data Refresh
- **Automatic:** Data refreshes every 30 seconds
- **Manual:** Click the refresh icon next to connection status
- **Focus:** Data refreshes when you return to the web app tab

## Technical Details

### Communication Protocol
The integration uses Chrome's `runtime.sendMessage` API for communication:

```javascript
// Example: Get today's stats
const stats = await chrome.runtime.sendMessage({ 
  type: 'GET_TODAY_STATS' 
});

// Example: Block a site
await chrome.runtime.sendMessage({ 
  type: 'ADD_BLOCKED_SITE', 
  payload: { domain: 'example.com' } 
});
```

### Supported Extension Messages
- `GET_TODAY_STATS` - Retrieve daily usage statistics
- `GET_SETTINGS` - Get extension settings
- `ADD_BLOCKED_SITE` - Block a website
- `REMOVE_BLOCKED_SITE` - Unblock a website
- `TOGGLE_FOCUS_MODE` - Toggle focus mode
- `GET_ANALYTICS_DATA` - Get comprehensive analytics

### Data Mapping
Extension data is automatically mapped to web app format:
- Time is converted from milliseconds to minutes
- Domains get appropriate display names and icons
- Usage percentages are calculated
- Site categories are preserved

## Troubleshooting

### Extension Not Connected
1. **Check extension installation:**
   - Go to `chrome://extensions/`
   - Ensure Focus Time Tracker is enabled
   - Try reloading the extension

2. **Check permissions:**
   - Extension needs `storage`, `tabs`, and `activeTab` permissions
   - Reload the extension if permissions were modified

3. **Browser console errors:**
   - Open DevTools (F12) in the web app
   - Check for extension communication errors
   - Look for CORS or permission issues

### Data Not Syncing
1. **Manual refresh:**
   - Click the refresh button next to extension status
   - Check if data updates

2. **Extension popup:**
   - Click the extension icon in Chrome toolbar
   - Verify data appears in extension popup
   - If extension has no data, issue is with extension tracking

3. **Clear storage:**
   - Reset extension data from extension options
   - Reload both extension and web app

### Site Blocking Not Working
1. **Check blocked sites list:**
   - Verify sites appear in extension's blocked list
   - Check if focus mode is enabled in extension

2. **Domain format:**
   - Ensure domains are in correct format (e.g., 'youtube.com' not 'https://youtube.com')
   - Remove 'www.' prefix if present

3. **Extension permissions:**
   - Extension needs `declarativeNetRequest` permission for blocking
   - Check if permission was granted during installation

## Development Notes

### File Structure
```
src/
├── services/
│   └── extensionDataService.ts    # Extension communication service
├── store/
│   └── deepFocusStore.ts         # Updated store with extension integration
├── hooks/
│   └── useExtensionSync.ts       # Real-time synchronization hook
└── components/pages/
    └── DeepFocusPage.tsx         # Updated page with extension features
```

### Key Components
- **ExtensionDataService:** Handles all extension communication
- **useExtensionSync:** Custom hook for automatic data synchronization
- **deepFocusStore:** Extended with extension data loading and site blocking
- **DeepFocusPage:** Enhanced with extension status and sync features

### Error Handling
- Graceful fallback to mock data when extension is unavailable
- Error logging for debugging integration issues
- User-friendly status indicators for connection state
- Retry mechanisms for failed extension communications

## Future Enhancements

### Planned Features
- [ ] Real-time notifications when sites are blocked
- [ ] Extension popup integration with web app
- [ ] Historical analytics from extension
- [ ] Custom blocking schedules
- [ ] Productivity goal syncing

### Advanced Integration
- [ ] Native messaging for deeper integration
- [ ] Background sync when web app is closed
- [ ] Cross-device synchronization
- [ ] Extension auto-update notifications

## API Reference

### ExtensionDataService Methods
```typescript
// Check if extension is installed
ExtensionDataService.isExtensionInstalled(): boolean

// Get today's usage statistics
ExtensionDataService.getTodayStats(): Promise<ExtensionTimeData>

// Get extension settings
ExtensionDataService.getSettings(): Promise<ExtensionSettings>

// Block/unblock sites
ExtensionDataService.blockSite(domain: string): Promise<void>
ExtensionDataService.unblockSite(domain: string): Promise<void>

// Toggle focus mode
ExtensionDataService.toggleFocusMode(): Promise<boolean>

// Get analytics data
ExtensionDataService.getAnalyticsData(period: string): Promise<any>
```

### Store Actions
```typescript
// Load extension data
loadExtensionData(): Promise<void>

// Extension site management
blockSiteInExtension(domain: string): Promise<void>
unblockSiteInExtension(domain: string): Promise<void>

// Check connection status
isExtensionConnected: boolean
```

---

## Conclusion

The Chrome Extension integration provides a seamless bridge between browser-level website tracking and the Make10000hours productivity platform. Users can now view real browsing data and manage site blocking directly from the web application, creating a unified productivity management experience.

For support or issues, check the browser console for error messages and ensure the extension has proper permissions and is running the latest version. 