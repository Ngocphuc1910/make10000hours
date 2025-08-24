// Debug script for Chrome Extension Deep Focus sync issues
// Run this in the extension's service worker console (chrome://extensions -> Details -> Inspect views: service worker)

console.log('🔍 Starting Deep Focus Extension Debug Script...');

// Helper function to format output
function debugLog(title, data) {
  console.group(`🔍 ${title}`);
  console.log(data);
  console.groupEnd();
}

async function debugExtensionState() {
  console.log('📊 =========================');
  console.log('📊 EXTENSION STATE ANALYSIS');
  console.log('📊 =========================');

  // 1. Check current storage state
  debugLog('1. Current Chrome Storage', await chrome.storage.local.get());
  
  // 2. Check active rules
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  debugLog('2. Active Blocking Rules', rules.map(r => ({
    id: r.id,
    condition: r.condition,
    action: r.action
  })));

  // 3. Check message listeners
  debugLog('3. Message Listeners', {
    hasMessageListener: chrome.runtime.onMessage.hasListeners(),
    listenerCount: chrome.runtime.onMessage.hasListeners() ? 'Has listeners' : 'No listeners'
  });

  // 4. Check if BlockingManager exists and its state
  if (typeof BlockingManager !== 'undefined') {
    debugLog('4. BlockingManager State', {
      exists: true,
      blockedSites: BlockingManager.blockedSites || 'undefined',
      isActive: BlockingManager.isActive || 'undefined'
    });
  } else {
    debugLog('4. BlockingManager State', { exists: false });
  }

  console.log('\n');
}

// Monitor all message traffic
function setupMessageMonitor() {
  console.log('🎧 =========================');
  console.log('🎧 MESSAGE TRAFFIC MONITOR');
  console.log('🎧 =========================');

  const originalAddListener = chrome.runtime.onMessage.addListener;
  chrome.runtime.onMessage.addListener = function(callback) {
    const wrappedCallback = function(message, sender, sendResponse) {
      console.group('📨 Incoming Message');
      console.log('Type:', message.type);
      console.log('Data:', message);
      console.log('Sender:', sender);
      console.log('Timestamp:', new Date().toISOString());
      console.groupEnd();
      
      const result = callback(message, sender, sendResponse);
      
      console.group('📤 Message Response');
      console.log('Response sent for:', message.type);
      console.groupEnd();
      
      return result;
    };
    return originalAddListener.call(this, wrappedCallback);
  };
}

// Monitor storage changes
function setupStorageMonitor() {
  console.log('💾 =========================');
  console.log('💾 STORAGE CHANGE MONITOR');
  console.log('💾 =========================');

  chrome.storage.onChanged.addListener((changes, area) => {
    console.group('💾 Storage Changed');
    console.log('Area:', area);
    console.log('Changes:', changes);
    console.log('Timestamp:', new Date().toISOString());
    
    // Show before/after values
    Object.keys(changes).forEach(key => {
      console.log(`${key}:`, {
        oldValue: changes[key].oldValue,
        newValue: changes[key].newValue
      });
    });
    console.groupEnd();
  });
}

// Test specific sync scenarios
async function testSyncScenarios() {
  console.log('🧪 =========================');
  console.log('🧪 SYNC SCENARIO TESTS');
  console.log('🧪 =========================');

  // Test 1: Check what happens when we receive SYNC_BLOCKED_SITES_FROM_WEBAPP
  console.group('🧪 Test 1: SYNC_BLOCKED_SITES_FROM_WEBAPP');
  const testMessage1 = {
    type: 'SYNC_BLOCKED_SITES_FROM_WEBAPP',
    sites: [
      { id: 'test-1', name: 'Test Site', url: 'test.com', isActive: true, icon: '', backgroundColor: '#000' }
    ]
  };
  
  // Simulate the message
  console.log('Simulating message:', testMessage1);
  
  // Check storage before
  const beforeSync = await chrome.storage.local.get(['blockedSites', 'userHasInitialized']);
  console.log('Storage before sync:', beforeSync);
  console.groupEnd();

  // Test 2: Check what happens during FORCE_SYNC_FROM_WEBAPP
  console.group('🧪 Test 2: FORCE_SYNC_FROM_WEBAPP');
  const testMessage2 = {
    type: 'FORCE_SYNC_FROM_WEBAPP',
    sites: []
  };
  console.log('Simulating force sync with empty sites:', testMessage2);
  console.groupEnd();

  // Test 3: Check default sites behavior
  console.group('🧪 Test 3: Default Sites Check');
  if (typeof getDefaultBlockedSites === 'function') {
    const defaults = getDefaultBlockedSites();
    console.log('Default sites function returns:', defaults);
  } else {
    console.log('❌ getDefaultBlockedSites function not found');
  }
  console.groupEnd();
}

// Main debug function
async function runFullDebug() {
  console.clear();
  console.log('🚀 Starting Full Extension Debug Analysis...\n');
  
  // Setup monitors first
  setupMessageMonitor();
  setupStorageMonitor();
  
  // Analyze current state
  await debugExtensionState();
  
  // Test scenarios
  await testSyncScenarios();
  
  // Instructions
  console.log('📋 =========================');
  console.log('📋 NEXT STEPS');
  console.log('📋 =========================');
  console.log('1. Go to your web app and toggle Deep Focus ON');
  console.log('2. Watch the console for message traffic');
  console.log('3. Check what changes in storage');
  console.log('4. Toggle Deep Focus OFF');
  console.log('5. Report back what you see in the logs');
  console.log('\n💡 All message traffic and storage changes will be logged above.');
}

// Utility function to check if sync is working
async function quickSyncCheck() {
  const storage = await chrome.storage.local.get(['blockedSites', 'userHasInitialized', 'siteUsageData']);
  
  console.log('⚡ QUICK SYNC CHECK');
  console.log('==================');
  console.log('Blocked Sites Count:', storage.blockedSites ? storage.blockedSites.length : 'None');
  console.log('User Initialized:', storage.userHasInitialized);
  console.log('Site Usage Data:', storage.siteUsageData ? Object.keys(storage.siteUsageData).length + ' sites' : 'None');
  console.log('==================');
  
  if (!storage.blockedSites || storage.blockedSites.length === 0) {
    console.warn('⚠️  No blocked sites in storage - this might be the issue');
  }
  
  if (!storage.siteUsageData) {
    console.warn('⚠️  No site usage data in storage - this might be why it shows 0m 0%');
  }
}

// Run the debug
runFullDebug();

// Also expose utility functions
window.debugExtensionState = debugExtensionState;
window.quickSyncCheck = quickSyncCheck;
window.testSyncScenarios = testSyncScenarios;

console.log('\n🔧 Utility functions available:');
console.log('   - quickSyncCheck() - Quick status check');
console.log('   - debugExtensionState() - Full state analysis');
console.log('   - testSyncScenarios() - Test sync behavior');