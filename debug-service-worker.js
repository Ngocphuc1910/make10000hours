/**
 * Debug Service Worker Communication (Manifest V3)
 * Run this in extension popup console
 */

console.log('🔍 Testing Service Worker communication...');

async function testServiceWorker() {
  try {
    console.log('=== SERVICE WORKER COMMUNICATION TEST ===');
    
    // Test 1: Check if we can send messages to service worker
    console.log('📡 Testing message to service worker...');
    
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'DEBUG_GET_STATE'
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
    
    console.log('✅ Service worker response:', response);
    
  } catch (error) {
    console.error('❌ Service worker communication failed:', error);
    
    // Alternative: Try to test session creation directly
    console.log('📡 Testing direct session creation via storage...');
    await testDirectStorage();
  }
}

async function testDirectStorage() {
  try {
    console.log('=== DIRECT STORAGE TEST ===');
    
    // Create a test session directly in storage
    const testSessionId = `test_${Date.now()}`;
    const testSession = {
      id: testSessionId,
      userId: 'test-user',
      domain: 'direct-test.com',
      startTime: Date.now(),
      startTimeUTC: new Date().toISOString(),
      endTime: null,
      endTimeUTC: null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      utcDate: new Date().toISOString().split('T')[0],
      duration: 0,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      visits: 1,
      lastSavedTime: Date.now()
    };
    
    // Get current sessions
    const storage = await chrome.storage.local.get(['site_usage_sessions']);
    const sessions = storage.site_usage_sessions || {};
    
    // Add test session
    sessions[testSessionId] = testSession;
    await chrome.storage.local.set({ site_usage_sessions: sessions });
    
    console.log('✅ Test session created:', testSessionId);
    
    // Test duration update
    testSession.duration = 5000;
    testSession.updatedAt = Date.now();
    sessions[testSessionId] = testSession;
    await chrome.storage.local.set({ site_usage_sessions: sessions });
    
    console.log('✅ Test session duration updated to 5000ms');
    
    // Verify update
    const updatedStorage = await chrome.storage.local.get(['site_usage_sessions']);
    const updatedSessions = updatedStorage.site_usage_sessions || {};
    const finalSession = updatedSessions[testSessionId];
    
    if (finalSession && finalSession.duration === 5000) {
      console.log('🎉 SUCCESS! Direct storage manipulation works');
      console.log('📊 Final test session:', finalSession);
      
      // This proves storage works, so the issue is in the service worker
      console.log('💡 CONCLUSION: Storage works, issue is in Service Worker logic');
      
      return true;
    } else {
      console.error('❌ Direct storage test failed');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Direct storage test error:', error);
    return false;
  }
}

async function testServiceWorkerDirect() {
  try {
    console.log('=== CHECKING SERVICE WORKER CONSOLE ===');
    console.log('⚠️ To see Service Worker logs:');
    console.log('1. Go to chrome://extensions/');
    console.log('2. Click "Details" on your extension');
    console.log('3. Click "Inspect views: service worker"');
    console.log('4. Check console for background script logs');
    
    // Send a message that should trigger logging in service worker
    console.log('📡 Sending test message to service worker...');
    
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'TEST_SESSION_CREATION',
        domain: 'popup-test.com'
      });
      
      console.log('✅ Service worker test result:', result);
    } catch (msgError) {
      console.warn('⚠️ Message failed (expected for now):', msgError.message);
    }
    
    // Check current sessions
    console.log('📊 Checking current sessions in storage...');
    const storage = await chrome.storage.local.get(['site_usage_sessions']);
    const sessions = storage.site_usage_sessions || {};
    
    console.log('Current sessions count:', Object.keys(sessions).length);
    
    const activeSessions = Object.values(sessions).filter(s => s.status === 'active');
    console.log('Active sessions:', activeSessions.length);
    
    activeSessions.forEach((session, i) => {
      console.log(`Session ${i + 1}:`, {
        id: session.id,
        domain: session.domain,
        duration: session.duration,
        ageMinutes: Math.round((Date.now() - session.startTime) / 60000),
        lastSaved: session.lastSavedTime ? new Date(session.lastSavedTime).toLocaleTimeString() : 'Never'
      });
    });
    
    return true;
    
  } catch (error) {
    console.error('❌ Service worker check failed:', error);
    return false;
  }
}

// Helper to clean up test data
window.cleanupTestData = async function() {
  const storage = await chrome.storage.local.get(['site_usage_sessions']);
  const sessions = storage.site_usage_sessions || {};
  
  const cleanSessions = {};
  Object.entries(sessions).forEach(([id, session]) => {
    // Keep only non-test sessions
    if (!session.domain.includes('test') && !id.includes('test')) {
      cleanSessions[id] = session;
    }
  });
  
  await chrome.storage.local.set({ site_usage_sessions: cleanSessions });
  console.log('🧹 Test data cleaned up');
};

// Run tests
console.log('Starting Service Worker debugging...');
testServiceWorker();
testServiceWorkerDirect();

console.log('\n📚 Available commands:');
console.log('- cleanupTestData() // Clean up test sessions');