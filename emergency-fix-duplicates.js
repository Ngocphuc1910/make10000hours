/**
 * EMERGENCY FIX: Stop Override Session Duplicates
 * 
 * This script addresses the critical issue where:
 * 1. Old format override sessions are cached in extension storage
 * 2. These get processed repeatedly on page reload causing massive duplicates
 * 3. Only legacy format sessions reach Firebase (missing extensionSessionId/startTimeUTC)
 */

// === EXTENSION CONSOLE COMMANDS ===

// 1. Clear all old format override sessions from extension storage
window.clearLegacyOverrideSessions = async function() {
  try {
    console.log('🧹 [EMERGENCY] Starting legacy override session cleanup...');
    
    const storage = await chrome.storage.local.get(['override_sessions']);
    const sessions = storage.override_sessions || {};
    
    let totalOriginal = 0;
    let totalRemoved = 0;
    let totalKept = 0;
    
    // Process each date
    for (const [date, dateSessions] of Object.entries(sessions)) {
      if (!Array.isArray(dateSessions)) continue;
      
      const originalCount = dateSessions.length;
      totalOriginal += originalCount;
      
      // Keep only sessions with BOTH extensionSessionId AND startTimeUTC (new format)
      const newFormatSessions = dateSessions.filter(session => {
        const isValidNewFormat = session.extensionSessionId && 
                                session.startTimeUTC && 
                                session.extensionSessionId.startsWith('override_') &&
                                session.reason === 'manual_override';
        
        if (!isValidNewFormat) {
          console.log(`🗑️ [CLEANUP] Removing legacy session: ${session.domain} (${date})`, {
            hasExtensionSessionId: !!session.extensionSessionId,
            hasStartTimeUTC: !!session.startTimeUTC,
            hasOldFields: {
              startTime: !!session.startTime,
              timestamp: !!session.timestamp,
              id: !!session.id
            }
          });
          totalRemoved++;
        } else {
          totalKept++;
        }
        
        return isValidNewFormat;
      });
      
      sessions[date] = newFormatSessions;
    }
    
    // Save cleaned sessions back to storage
    await chrome.storage.local.set({ override_sessions: sessions });
    
    console.log('✅ [EMERGENCY] Legacy cleanup completed:', {
      totalOriginal,
      totalRemoved,
      totalKept,
      datesProcessed: Object.keys(sessions).length
    });
    
    return { success: true, totalOriginal, totalRemoved, totalKept };
    
  } catch (error) {
    console.error('❌ [EMERGENCY] Legacy cleanup failed:', error);
    return { success: false, error: error.message };
  }
};

// 2. Check current storage state
window.checkOverrideStorage = async function() {
  try {
    const storage = await chrome.storage.local.get(['override_sessions']);
    const sessions = storage.override_sessions || {};
    
    let totalSessions = 0;
    let newFormatCount = 0;
    let legacyCount = 0;
    
    console.log('📊 [DIAGNOSTIC] Current override session storage:');
    
    for (const [date, dateSessions] of Object.entries(sessions)) {
      if (!Array.isArray(dateSessions)) continue;
      
      console.log(`📅 ${date}: ${dateSessions.length} sessions`);
      
      dateSessions.forEach((session, index) => {
        totalSessions++;
        
        const hasNewFormat = session.extensionSessionId && session.startTimeUTC;
        if (hasNewFormat) {
          newFormatCount++;
          console.log(`  ✅ ${index + 1}. ${session.domain} - NEW FORMAT (${session.extensionSessionId})`);
        } else {
          legacyCount++;
          console.log(`  ❌ ${index + 1}. ${session.domain} - LEGACY FORMAT`, {
            hasExtensionSessionId: !!session.extensionSessionId,
            hasStartTimeUTC: !!session.startTimeUTC,
            hasOldStartTime: !!session.startTime,
            id: session.id
          });
        }
      });
    }
    
    console.log('📊 [SUMMARY]:', {
      totalSessions,
      newFormatCount,
      legacyCount,
      percentageLegacy: Math.round((legacyCount / totalSessions) * 100) + '%'
    });
    
    return { totalSessions, newFormatCount, legacyCount };
    
  } catch (error) {
    console.error('❌ [DIAGNOSTIC] Storage check failed:', error);
  }
};

// 3. Force create a test new format session
window.createTestNewFormatSession = async function() {
  try {
    const userStorage = await chrome.storage.local.get(['userInfo']);
    const userInfo = userStorage.userInfo || {};
    const currentUserId = userInfo.uid;
    
    if (!currentUserId) {
      console.error('❌ No user ID available for test session');
      return { success: false, error: 'No user ID' };
    }
    
    const now = new Date();
    const sessionId = `override_${Date.now()}_test_${Math.random().toString(36).substr(2, 9)}`;
    
    const testSession = {
      id: sessionId,
      extensionSessionId: sessionId, // Required for new format
      domain: 'test-domain.com',
      startTime: now.getTime(),
      startTimeUTC: now.toISOString(), // Required for new format
      duration: 5,
      durationMs: 5 * 60 * 1000,
      date: new Date().toLocaleDateString(),
      timestamp: Date.now(),
      type: 'override',
      userId: currentUserId,
      reason: 'manual_override' // Required for new format
    };
    
    const today = new Date().toLocaleDateString();
    const storage = await chrome.storage.local.get(['override_sessions']);
    const sessions = storage.override_sessions || {};
    
    if (!sessions[today]) {
      sessions[today] = [];
    }
    
    sessions[today].push(testSession);
    await chrome.storage.local.set({ override_sessions: sessions });
    
    console.log('✅ [TEST] Created new format test session:', testSession);
    return { success: true, session: testSession };
    
  } catch (error) {
    console.error('❌ [TEST] Failed to create test session:', error);
    return { success: false, error: error.message };
  }
};

// === WEB APP CONSOLE COMMANDS ===

// 4. Test sync without duplicates  
window.testCleanSync = async function() {
  try {
    console.log('🔄 [TEST] Testing clean sync process...');
    
    // Send sync request to extension
    window.postMessage({ 
      type: 'REQUEST_SITE_USAGE_SESSIONS', 
      source: 'web-app-clean-test',
      timestamp: new Date().toISOString()
    }, '*');
    
    console.log('📤 [TEST] Clean sync request sent');
    console.log('👀 [TEST] Watch for:');
    console.log('  🚫 [LEGACY-FILTER] - Old format sessions filtered');
    console.log('  ✅ [NEW-FORMAT] - Valid sessions processed');
    console.log('  📊 [DEDUP] - Firebase deduplication working');
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ [TEST] Clean sync test failed:', error);
    return { success: false, error: error.message };
  }
};

console.log(`
🚨 EMERGENCY OVERRIDE SESSION DUPLICATE FIX

=== EXTENSION CONSOLE COMMANDS ===
clearLegacyOverrideSessions() - Remove all old format sessions from storage
checkOverrideStorage()        - Inspect current storage state  
createTestNewFormatSession()  - Create a test session with proper format

=== WEB APP CONSOLE COMMANDS ===
testCleanSync()               - Test sync process for duplicates

=== RECOMMENDED STEPS ===
1. Run checkOverrideStorage() in extension console to see the problem
2. Run clearLegacyOverrideSessions() in extension console to clean storage
3. Run testCleanSync() in web app console to test the fix
4. Check Firebase - should see NO MORE duplicates and proper new format sessions
`);