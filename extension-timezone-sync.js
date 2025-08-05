// Extension timezone sync implementation
// This ensures extension creates sessions with same date as web app

/**
 * Get user's timezone setting from web app
 * This ensures extension uses same timezone as web app settings
 */
async function getUserTimezoneFromWebApp() {
  return new Promise((resolve) => {
    // Send message to web app requesting timezone
    window.postMessage({
      type: 'EXTENSION_REQUEST',
      messageId: Math.random().toString(36),
      payload: { type: 'GET_USER_TIMEZONE' }
    }, '*');
    
    // Listen for response
    const handleResponse = (event) => {
      if (event.data?.type === 'TIMEZONE_RESPONSE') {
        window.removeEventListener('message', handleResponse);
        resolve(event.data.timezone || 'UTC');
      }
    };
    
    window.addEventListener('message', handleResponse);
    
    // Timeout fallback
    setTimeout(() => {
      window.removeEventListener('message', handleResponse);
      resolve('UTC'); // Fallback to UTC
    }, 2000);
  });
}

/**
 * Create session date using user's timezone (matches web app)
 * This is the CORE FIX for extension consistency
 */
async function createSessionDateInUserTimezone() {
  try {
    // Get user timezone from web app
    const userTimezone = await getUserTimezoneFromWebApp();
    
    // Create date in user timezone (same as web app)
    const userDate = new Date().toLocaleDateString('en-CA', {
      timeZone: userTimezone
    });
    
    console.log('📅 Extension session date created:', {
      userTimezone,
      dateString: userDate,
      physicalTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
    
    return userDate;
    
  } catch (error) {
    console.error('❌ Extension timezone sync failed:', error);
    // Fallback to UTC
    return new Date().toLocaleDateString('en-CA');
  }
}

/**
 * Updated session creation with consistent timezone
 * Replace existing session creation with this
 */
async function createDeepFocusSession(duration, blockedSites = []) {
  try {
    const sessionDate = await createSessionDateInUserTimezone(); // ✅ Consistent date
    
    const session = {
      id: `focus_${Date.now()}`,
      duration: duration,
      startTime: new Date(),
      // 🔧 SIMPLE FIX: Use consistent date creation
      date: sessionDate, // ✅ Same as web app now
      blockedSites: blockedSites,
      distractionAttempts: 0,
      createdAt: new Date()
    };
    
    // Send to web app
    await sendSessionToWebApp(session);
    
    console.log('✅ Extension session created with consistent date:', {
      sessionId: session.id,
      date: session.date
    });
    
    return session;
    
  } catch (error) {
    console.error('❌ Extension session creation failed:', error);
    throw error;
  }
}

/**
 * Send session to web app for storage
 */
async function sendSessionToWebApp(session) {
  window.postMessage({
    type: 'EXTENSION_REQUEST',
    messageId: Math.random().toString(36),
    payload: {
      type: 'CREATE_WORK_SESSION',
      sessionData: session
    }
  }, '*');
}

// Export for use in extension
window.ExtensionTimezoneSync = {
  getUserTimezoneFromWebApp,
  createSessionDateInUserTimezone,
  createDeepFocusSession
};