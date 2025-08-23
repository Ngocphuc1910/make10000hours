/**
 * Cleanup script for legacy override sessions
 * Run this once to clean up old format override sessions from extension storage
 */

async function cleanupLegacyOverrideSessions() {
  try {
    console.log('🧹 Starting cleanup of legacy override sessions...');
    
    // Get current override sessions
    const storage = await chrome.storage.local.get(['override_sessions']);
    const sessions = storage.override_sessions || {};
    
    let totalOriginal = 0;
    let totalCleaned = 0;
    let totalRemaining = 0;
    
    // Process each date
    for (const [dateKey, dateSessions] of Object.entries(sessions)) {
      const originalCount = dateSessions.length;
      totalOriginal += originalCount;
      
      // Filter out old format sessions (missing startTimeUTC)
      const newFormatSessions = dateSessions.filter(session => {
        const isNewFormat = session.startTimeUTC && session.id && session.id.startsWith('override_');
        if (!isNewFormat) {
          console.log(`🗑️ Removing legacy session for ${session.domain} (no startTimeUTC)`);
        }
        return isNewFormat;
      });
      
      const cleanedCount = originalCount - newFormatSessions.length;
      totalCleaned += cleanedCount;
      totalRemaining += newFormatSessions.length;
      
      // Update storage for this date
      sessions[dateKey] = newFormatSessions;
      
      if (cleanedCount > 0) {
        console.log(`📅 ${dateKey}: Cleaned ${cleanedCount}/${originalCount} sessions`);
      }
    }
    
    // Save cleaned sessions back to storage
    await chrome.storage.local.set({ override_sessions: sessions });
    
    console.log('✅ Cleanup completed:', {
      totalOriginal,
      totalCleaned,
      totalRemaining,
      datesProcessed: Object.keys(sessions).length
    });
    
    return {
      success: true,
      totalOriginal,
      totalCleaned,
      totalRemaining
    };
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Export for use in console or background script
if (typeof self !== 'undefined') {
  self.cleanupLegacyOverrideSessions = cleanupLegacyOverrideSessions;
}