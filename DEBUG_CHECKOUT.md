# 🔍 Checkout Debug Guide

This guide will help you diagnose the "Unauthenticated" error when trying to upgrade to Pro.

## Quick Start

### Method 1: Visual Debug Panel
1. **Open the app** in your browser
2. **Look for the blue "🔍 Debug Checkout" button** in the bottom-right corner
3. **Click it** to open the debug panel
4. **Click "Run Full Diagnostics"** to analyze all systems
5. **Review the results** - any ❌ errors will show the problem

### Method 2: Browser Console
1. **Open Developer Tools** (F12 or Ctrl+Shift+I)
2. **Go to the Console tab**
3. **Run these commands**:

```javascript
// Quick authentication check
quickAuthCheck()

// Full diagnostic (most comprehensive)
await debugCheckout()

// Test checkout function directly
await manualCheckoutTest()
```

## What the Debug Script Checks

### 🔧 Step 1: Firebase Configuration
- ✅ Firebase app initialization
- ✅ Functions configuration
- ✅ Project ID and auth domain

### 🔐 Step 2: Authentication State
- ✅ Current user status
- ✅ User ID and email
- ✅ Email verification status
- ✅ Authentication timestamp

### 🏪 Step 3: User Store State
- ✅ Zustand store synchronization
- ✅ User data consistency
- ✅ Authentication flags

### ⚡ Step 4: Functions Connectivity
- ✅ Firebase Functions connection
- ✅ Network connectivity
- ✅ Region configuration

### 🎫 Step 5: Authentication Token
- ✅ ID token generation
- ✅ Token claims and expiration
- ✅ Token format validation

### 🛒 Step 6: Checkout Function Test
- ✅ Actual `createCheckout` function call
- ✅ Authentication token passing
- ✅ Function response

### 🌍 Step 7: Environment Variables
- ✅ Firebase API key
- ✅ App ID configuration
- ✅ Development vs production mode

## Common Issues & Solutions

### ❌ Issue: "User is not authenticated"
**Symptoms**: Debug shows no current user
**Solutions**:
1. **Sign in first**: Click sign in and complete Google authentication
2. **Check popup blockers**: Disable popup blockers for the site
3. **Clear cookies**: Clear browser data and try again

### ❌ Issue: "Functions connectivity failed"
**Symptoms**: Cannot connect to Firebase Functions
**Solutions**:
1. **Check internet connection**
2. **Try different network** (disable VPN if active)
3. **Check if Firebase is down**: Visit [Firebase Status](https://status.firebase.google.com/)

### ❌ Issue: "Token test failed"
**Symptoms**: Cannot get authentication token
**Solutions**:
1. **Sign out and sign in again**
2. **Force token refresh**: Run `auth.currentUser.getIdToken(true)` in console
3. **Check browser compatibility**

### ❌ Issue: "Checkout function call failed - unauthenticated"
**Symptoms**: Function receives no auth token
**Possible Causes**:
1. **Token not being sent**: Check if `auth.currentUser` exists
2. **Region mismatch**: Functions deployed to wrong region
3. **CORS issues**: Network blocking the request
4. **App Check issues**: App Check validation failing

## Advanced Debugging

### Check Authentication Flow
```javascript
// Check current auth state
console.log('Current user:', auth.currentUser)
console.log('User store:', useUserStore.getState())

// Listen for auth changes
auth.onAuthStateChanged(user => {
  console.log('Auth state changed:', user)
})
```

### Test Function Call Manually
```javascript
// Test with explicit auth
const createCheckout = httpsCallable(functions, 'createCheckout')
const result = await createCheckout({ billing: 'monthly' })
console.log(result)
```

### Check Network Requests
1. **Open DevTools** → **Network tab**
2. **Try checkout** and look for requests
3. **Check if requests have Authorization headers**
4. **Look for any 401/403 errors**

## Debug Results Interpretation

### ✅ All Green: System Healthy
If all checks pass but checkout still fails, the issue might be:
- Server-side environment variables missing
- Lemon Squeezy API connectivity issues
- Function deployment problems

### ❌ Multiple Errors: Authentication Problem
If you see authentication-related errors:
1. **Sign out completely**
2. **Clear browser cache/cookies**
3. **Sign in again with Google**
4. **Run diagnostics again**

### ⚠️ Warnings Only: Check Edge Cases
Warnings usually indicate minor issues that might cause problems:
- Token claims missing
- Environment variables not optimal
- Store synchronization delays

## Getting Help

1. **Run the full diagnostic**: `await debugCheckout()`
2. **Copy the results**: Use the "Copy Results" button in the debug panel
3. **Share the results**: Include them when reporting the issue
4. **Include browser info**: Chrome/Firefox version, OS, etc.
5. **Include steps to reproduce**: What you clicked, when it failed

## Console Quick Reference

```javascript
// Essential debug commands
quickAuthCheck()                    // Quick auth status
await debugCheckout()              // Full system check
await manualCheckoutTest()         // Direct function test

// Advanced debugging
auth.currentUser                   // Current Firebase user
functions                         // Functions instance
useUserStore.getState()           // User store state
```

---

**💡 Tip**: Keep the browser console open while testing checkout to see real-time debug information!