// EXTENSION DIAGNOSTIC SCRIPT
// Run this in the extension's background script console
// Go to chrome://extensions/ → Click "Inspect views: background"

console.log('🚀 EXTENSION DIAGNOSTIC STARTING');
console.log('='.repeat(50));

// Basic environment check
console.log('📋 ENVIRONMENT CHECK:');
console.log('- Chrome version:', chrome?.runtime?.getManifest?.()?.version || 'Unknown');
console.log('- Extension ID:', chrome?.runtime?.id || 'Unknown');
console.log('- Service worker context:', typeof importScripts !== 'undefined');

// Check if our scripts loaded
console.log('\n📦 SCRIPT LOADING CHECK:');
console.log('- DateUtils available:', typeof DateUtils !== 'undefined');
console.log('- UTCCoordinator available:', typeof UTCCoordinator !== 'undefined');
console.log('- TimezoneCoordination available:', typeof TimezoneCoordination !== 'undefined');

if (typeof TimezoneCoordination !== 'undefined') {
    console.log('- TimezoneCoordination methods:', Object.keys(TimezoneCoordination));
} else {
    console.warn('❌ TimezoneCoordination not loaded!');
}

// Check storage manager
console.log('\n💾 STORAGE MANAGER CHECK:');
try {
    if (typeof DeepFocusBackgroundService !== 'undefined' && DeepFocusBackgroundService.storageManager) {
        console.log('- StorageManager available:', true);
        console.log('- StorageManager methods:', Object.getOwnPropertyNames(DeepFocusBackgroundService.storageManager));
    } else {
        console.warn('❌ StorageManager not available!');
    }
} catch (error) {
    console.error('❌ StorageManager check failed:', error);
}

// Test basic message handling
console.log('\n📨 MESSAGE HANDLER TEST:');
try {
    // Simulate a PING message
    const testMessage = { type: 'PING', timestamp: Date.now() };
    console.log('Testing message:', testMessage);
    
    // This should work if the message handler is properly set up
    chrome.runtime.onMessage.hasListeners && console.log('- Message listeners registered:', chrome.runtime.onMessage.hasListeners());
    
} catch (error) {
    console.error('❌ Message handler test failed:', error);
}

// Check recent errors
console.log('\n🔍 ERROR ANALYSIS:');
console.log('Check the console above for any RED error messages');
console.log('Common issues:');
console.log('- ImportScripts failed to load a utility file');
console.log('- Undefined variable usage');
console.log('- Async/await syntax errors');
console.log('- Chrome permissions issues');

// Test timezone coordination specifically
console.log('\n🌍 TIMEZONE COORDINATION TEST:');
if (typeof TimezoneCoordination !== 'undefined') {
    try {
        TimezoneCoordination.getCoordinatedTimezone().then(timezone => {
            console.log('✅ Timezone coordination working:', timezone);
        }).catch(error => {
            console.error('❌ Timezone coordination failed:', error);
        });
    } catch (error) {
        console.error('❌ Timezone coordination test failed:', error);
    }
} else {
    console.warn('⚠️ Cannot test timezone coordination - not loaded');
}

// Test storage operations
console.log('\n💾 STORAGE TEST:');
try {
    chrome.storage.local.get(['test'], (result) => {
        console.log('✅ Chrome storage accessible:', Object.keys(result));
    });
} catch (error) {
    console.error('❌ Chrome storage test failed:', error);
}

console.log('\n' + '='.repeat(50));
console.log('🎯 DIAGNOSTIC COMPLETE');
console.log('Look for any RED error messages above');
console.log('If you see errors, those are likely the cause of the timeout');