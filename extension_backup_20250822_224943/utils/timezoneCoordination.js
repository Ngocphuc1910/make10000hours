/**
 * Timezone Coordination between Extension and Web App
 * Provides coordinated timezone for consistent session creation
 */

/**
 * Get coordinated timezone between extension and web app
 * Tries web app first, falls back to browser detection
 */
async function getCoordinatedTimezone() {
  try {
    // Try to get timezone from web app first (with timeout)
    const response = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for web app timezone'));
      }, 2000);
      
      chrome.runtime.sendMessage({
        type: 'GET_USER_TIMEZONE',
        timestamp: Date.now()
      }, (response) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
    
    if (response?.timezone && isValidTimezone(response.timezone)) {
      console.log('✅ Using web app timezone:', response.timezone);
      return response.timezone;
    }
  } catch (error) {
    console.log('⚠️ Web app not available for timezone coordination:', error.message);
  }
  
  // Fallback to browser detection
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  console.log('📍 Using browser detected timezone:', browserTimezone);
  return browserTimezone;
}

/**
 * Validate timezone string
 */
function isValidTimezone(timezone) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Listen for timezone preference changes from web app
 */
function setupTimezoneCoordination() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TIMEZONE_PREFERENCE_CHANGED') {
      console.log('🔄 Web app timezone changed:', message.timezone);
      
      // Store the new timezone preference for future sessions
      chrome.storage.local.set({
        webAppTimezone: message.timezone,
        webAppTimezoneUpdated: Date.now()
      });
      
      // Update any active sessions with new timezone context if needed
      updateActiveSessionTimezone(message.timezone);
      
      sendResponse({ success: true });
    }
  });
}

/**
 * Update active session timezone context (if any)
 */
async function updateActiveSessionTimezone(newTimezone) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const storage = await chrome.storage.local.get([today]);
    
    if (storage[today]) {
      const sessions = storage[today];
      const updated = sessions.map(session => {
        if (session.status === 'active') {
          console.log('🔄 Updating active session timezone:', session.id);
          return {
            ...session,
            timezone: newTimezone,
            updatedAt: Date.now()
          };
        }
        return session;
      });
      
      await chrome.storage.local.set({ [today]: updated });
    }
  } catch (error) {
    console.error('❌ Failed to update active session timezone:', error);
  }
}

/**
 * Get stored web app timezone preference
 */
async function getStoredWebAppTimezone() {
  try {
    const result = await chrome.storage.local.get(['webAppTimezone', 'webAppTimezoneUpdated']);
    
    // Only use stored timezone if it's recent (within 24 hours)
    const isRecent = result.webAppTimezoneUpdated && 
      (Date.now() - result.webAppTimezoneUpdated) < 24 * 60 * 60 * 1000;
    
    if (result.webAppTimezone && isRecent && isValidTimezone(result.webAppTimezone)) {
      return result.webAppTimezone;
    }
  } catch (error) {
    console.warn('Could not get stored web app timezone:', error);
  }
  
  return null;
}

/**
 * Enhanced coordination that checks stored preference first
 */
async function getCoordinatedTimezoneWithCache() {
  // First try cached web app timezone
  const cachedTimezone = await getStoredWebAppTimezone();
  if (cachedTimezone) {
    console.log('✅ Using cached web app timezone:', cachedTimezone);
    return cachedTimezone;
  }
  
  // Fall back to live coordination
  return await getCoordinatedTimezone();
}

// Export for use in background script (service worker compatible)
const TimezoneCoordination = {
  getCoordinatedTimezone,
  getCoordinatedTimezoneWithCache,
  setupTimezoneCoordination,
  isValidTimezone
};

// Make available in different contexts
if (typeof window !== 'undefined') {
  window.TimezoneCoordination = TimezoneCoordination;
} else if (typeof globalThis !== 'undefined') {
  globalThis.TimezoneCoordination = TimezoneCoordination;
} else if (typeof self !== 'undefined') {
  self.TimezoneCoordination = TimezoneCoordination;
}

// Initialize coordination only when explicitly called (not automatically)
// This prevents issues during importScripts loading