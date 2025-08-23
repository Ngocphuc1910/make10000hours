/**
 * EMERGENCY CLEANUP: Remove legacy override sessions
 * This utility helps clean up old format override sessions that might be causing duplicates
 */

// Function to clean up extension storage (run in extension console)
window.cleanupExtensionLegacyOverrides = async function() {
  try {
    console.log('🧹 [CLEANUP] Starting extension legacy override cleanup...');
    
    const storage = await chrome.storage.local.get(['override_sessions']);
    const sessions = storage.override_sessions || {};
    
    let totalOriginal = 0;
    let totalRemoved = 0;
    let totalKept = 0;
    
    for (const [date, dateSessions] of Object.entries(sessions)) {
      const originalCount = dateSessions.length;
      totalOriginal += originalCount;
      
      // Only keep sessions with new format
      const newFormatSessions = dateSessions.filter(session => {
        const hasNewFormat = session.startTimeUTC && 
                            session.id && 
                            session.id.startsWith('override_') &&
                            session.id.split('_').length >= 3;
        
        if (!hasNewFormat) {
          console.log(`🗑️ [CLEANUP] Removing legacy session: ${session.domain} (${date})`);
          totalRemoved++;
        } else {
          totalKept++;
        }
        
        return hasNewFormat;
      });
      
      sessions[date] = newFormatSessions;
      
      if (originalCount !== newFormatSessions.length) {
        console.log(`📅 [CLEANUP] ${date}: ${originalCount} → ${newFormatSessions.length} sessions`);
      }
    }
    
    // Save cleaned data back
    await chrome.storage.local.set({ override_sessions: sessions });
    
    const summary = {
      totalOriginal,
      totalRemoved,
      totalKept,
      datesProcessed: Object.keys(sessions).length
    };
    
    console.log('✅ [CLEANUP] Extension cleanup completed:', summary);
    return summary;
    
  } catch (error) {
    console.error('❌ [CLEANUP] Extension cleanup failed:', error);
    throw error;
  }
};

// Function to trigger sync and test (run in web app console)  
window.testOverrideSync = async function() {
  try {
    console.log('🔄 [TEST] Triggering extension sync...');
    
    // Access extension sync listener from global scope (if available)
    if (window.extensionSyncListener) {
      await window.extensionSyncListener.triggerExtensionSync();
      console.log('✅ [TEST] Sync completed - check console for filtering logs');
    } else {
      // Alternative approach - trigger sync via postMessage
      console.log('📤 [TEST] Using postMessage to trigger sync...');
      window.postMessage({ 
        type: 'REQUEST_SITE_USAGE_SESSIONS', 
        source: 'web-app',
        timestamp: new Date().toISOString()
      }, '*');
      console.log('✅ [TEST] Sync request sent - check console for filtering logs');
    }
  } catch (error) {
    console.error('❌ [TEST] Sync test failed:', error);
    throw error;
  }
};

console.log(`
🛡️ LEGACY OVERRIDE CLEANUP UTILITIES LOADED

Extension Console Commands:
  cleanupExtensionLegacyOverrides() - Remove old format sessions from extension storage

Web App Console Commands:  
  testOverrideSync() - Trigger sync and test filtering
`);