# Firebase Auth Setup Guide

## Issue: "Sign in failed. Please try again."

This guide will help you fix the Firebase Auth Google sign-in issue.

## 🔍 Diagnosis

The current setup has these issues:
1. **Missing Firebase Console Google Sign-in Configuration**
2. **Unauthorized Domain Configuration**
3. **Potential OAuth Client ID Mismatch**

## 🔧 Step-by-Step Fix

### Step 1: Firebase Console Configuration

1. **Go to Firebase Console**: https://console.firebase.google.com/project/make10000hours

2. **Navigate to Authentication**:
   - Click "Authentication" in the left sidebar
   - Click "Sign-in method" tab

3. **Enable Google Sign-in**:
   - Find "Google" in the Sign-in providers list
   - Click on "Google" to configure it
   - Toggle "Enable" to ON
   - You'll see configuration options

4. **Configure Google Sign-in**:
   - **Web SDK configuration**: This will be auto-filled
   - **Web client ID**: May be auto-filled or you might need to select one
   - **Web client secret**: Will be auto-filled from Google Cloud Console

### Step 2: Authorized Domains Configuration

1. **In Firebase Console → Authentication → Settings**:
   - Scroll down to "Authorized domains"
   - Ensure these domains are listed:
     - `localhost` (for development)
     - `make10000hours.firebaseapp.com` (Firebase hosting)
     - `make10000hours.web.app` (Firebase hosting alternative)
     - Your custom domain if you have one

2. **Add localhost if missing**:
   - Click "Add domain"
   - Enter `localhost`
   - Click "Add"

### Step 3: Google Cloud Console Verification

1. **Go to Google Cloud Console**: https://console.cloud.google.com/apis/credentials?project=make10000hours

2. **Find OAuth 2.0 Client IDs**:
   - Look for client IDs that include "make10000hours"
   - You should see at least two:
     - One for Firebase Auth (Web application)
     - One for Google Calendar API (Web application)

3. **Verify Firebase Auth Client ID**:
   - Click on the Firebase Auth client ID
   - Check "Authorized JavaScript origins":
     - Should include: `http://localhost:3005`
     - Should include: `https://make10000hours.firebaseapp.com`
     - Should include: `https://make10000hours.web.app`
   - Check "Authorized redirect URIs":
     - Should include Firebase auth callback URLs

### Step 4: Environment Variables Check

Verify your `.env.local` file has correct values:

```bash
# This is for Google Calendar API (keep this)
VITE_GOOGLE_OAUTH_CLIENT_ID=496225832510-4q5t9iogu4dhpsbenkg6f5oqmbgudae8.apps.googleusercontent.com

# These are for Firebase (in .env - should be correct)
VITE_FIREBASE_API_KEY=AIzaSyCqlF02YJgHBt-uxqAlzF0bYUf5_ihOlUk
VITE_FIREBASE_APP_ID=1:496225832510:web:27dc0adaf5d89a71cd0b6f
```

**Note**: Firebase Auth doesn't need a separate OAuth Client ID in environment variables. It uses the one configured in Firebase Console.

### Step 5: Test the Fix

1. **Clear browser cache and cookies**
2. **Restart your development server**: `npm run dev`
3. **Open browser console** to see specific error messages
4. **Try signing in** - you should now see specific error messages instead of generic ones

## 🐛 Debugging Tools

### Use the Debug Script

1. **Open browser console** while on your app
2. **Copy and paste** the content of `debug-firebase-auth.js`
3. **Run the diagnostic functions**:
   ```javascript
   await debugFirebaseLogin()
   ```

### Common Error Messages and Solutions

| Error Code | Meaning | Solution |
|------------|---------|----------|
| `auth/unauthorized-domain` | Domain not authorized | Add localhost to Firebase Console authorized domains |
| `auth/operation-not-allowed` | Google sign-in not enabled | Enable Google provider in Firebase Console |
| `auth/popup-blocked` | Browser blocked popup | Allow popups for localhost:3005 |
| `auth/configuration-not-found` | Firebase Auth not configured | Complete Firebase Console setup |

## 🔍 Additional Checks

### Verify Firebase Project Settings

1. **Project ID**: Should be `make10000hours`
2. **Web App**: Should exist and be configured
3. **Authentication**: Should be enabled with Google provider

### Check Browser Network Tab

When sign-in fails:
1. Open browser DevTools → Network tab
2. Try signing in
3. Look for failed requests to:
   - `identitytoolkit.googleapis.com`
   - `accounts.google.com`
   - `securetoken.googleapis.com`

## 🎯 Expected Result

After completing these steps:
1. ✅ Specific error messages instead of generic "Sign in failed"
2. ✅ Google sign-in popup should appear
3. ✅ User should be able to complete authentication
4. ✅ User should be logged into the app

## 🚨 If Still Not Working

If you still get errors:
1. **Check Firebase Console logs**: Authentication → Events
2. **Verify Google Cloud Console billing**: Some APIs require billing enabled
3. **Try incognito mode**: Rules out browser extension issues
4. **Check firewall/antivirus**: May block auth requests

## 📞 Support

If all else fails, the issue might be:
- Firebase project configuration
- Google Cloud Console API permissions
- Network/firewall restrictions

Contact the development team with:
- Specific error messages from browser console
- Screenshot of Firebase Console Authentication settings
- Output from the debug script