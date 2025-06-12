# Extension Integration Debug Guide

## Current Issue
The extension is working and tracking data, but the web app shows "Extension Offline" and can't sync data.

## Steps to Debug and Fix

### 1. Reload Extension with New Permissions
1. Go to `chrome://extensions/`
2. Find "Focus Time Tracker" extension
3. Click the **reload button** (circular arrow icon)
4. This applies the new `externally_connectable` permissions

### 2. Check Browser Console
1. Open the web app at `http://localhost:5173`
2. Go to Deep Focus page
3. Open DevTools (F12) → Console tab
4. Look for these debug messages:
   - `Chrome available: true/false`
   - `Chrome runtime: [object]/undefined`
   - Extension connection test messages

### 3. Test Extension Communication
Open browser console and run:
```javascript
// Test 1: Check chrome API
console.log('Chrome:', chrome);
console.log('Chrome runtime:', chrome.runtime);

// Test 2: Try sending message to extension
chrome.runtime.sendMessage({ type: 'GET_TODAY_STATS' }, (response) => {
  console.log('Extension response:', response);
});
```

### 4. Possible Issues & Solutions

#### Issue 1: `chrome is not defined`
**Cause**: Web app can't access Chrome extension API
**Solution**: Check if extension is externally connectable

#### Issue 2: `Extension context invalidated`
**Cause**: Extension was reloaded/updated
**Solution**: Reload both extension and web app

#### Issue 3: `Could not establish connection`
**Cause**: Extension ID mismatch or permission issue
**Solution**: 
1. Get extension ID from `chrome://extensions/`
2. Check `externally_connectable` in manifest.json

#### Issue 4: Extension response format wrong
**Cause**: Extension sends different data format than expected
**Solution**: Check console logs for actual response structure

### 5. Manual Testing Steps

1. **Check Extension is Active**:
   - Click extension icon in toolbar
   - Verify it shows tracking data
   - Note the "54s Today's Total" indicates it's working

2. **Test Web App Connection**:
   - Refresh Deep Focus page
   - Check browser console for connection logs
   - Try manual refresh button

3. **Verify Extension ID**:
   - Go to `chrome://extensions/`
   - Enable Developer mode
   - Copy the extension ID
   - Add to debugging if needed

### 6. Expected Console Output (Success)
```
Chrome available: true
Chrome runtime: [object Object]
Extension connection test: success
Extension response received: {success: true, data: {...}}
Extension data successfully loaded and mapped
```

### 7. Quick Fix Commands

If debugging shows the extension is reachable but data format is wrong:

1. Check extension response structure:
```javascript
chrome.runtime.sendMessage({ type: 'GET_TODAY_STATS' }, console.log);
```

2. Test different message types:
```javascript
chrome.runtime.sendMessage({ type: 'GET_CURRENT_STATE' }, console.log);
```

## Next Steps After Debugging

Once we identify the specific issue from console logs, we can:
1. Fix data format mapping
2. Update extension permissions
3. Adjust message handling
4. Update connection logic

**Current Status**: Extension tracks data ✅, Web app connection ❌ 