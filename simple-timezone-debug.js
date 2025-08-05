// 🔍 SIMPLE TIMEZONE DEBUG - Fixed Version
// Copy and paste this into your browser console

console.log('🚀 Timezone Debug - Fixed Version');
console.log('===============================');

// Check if we're on the right page
const hasTimezoneElements = document.querySelector('input[placeholder*="timezone"]') || 
                           document.querySelector('select') ||
                           document.querySelector('[class*="timezone"]') ||
                           document.textContent.includes('Timezone');

if (hasTimezoneElements) {
    console.log('✅ Found timezone-related elements on page');
} else {
    console.log('❌ No timezone elements found - make sure you\'re on settings page');
}

// Check for React component errors
console.log('\n🔍 Checking for component errors...');

// Look for timezone-related console messages
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

// Capture any new console messages
let capturedMessages = [];

console.error = function(...args) {
    capturedMessages.push({type: 'error', message: args.join(' ')});
    originalConsoleError.apply(console, args);
};

console.warn = function(...args) {
    capturedMessages.push({type: 'warn', message: args.join(' ')});
    originalConsoleWarn.apply(console, args);
};

// Trigger timezone selector if possible
console.log('\n🔍 Looking for timezone dropdown...');
const timezoneInputs = document.querySelectorAll('input');
const foundInput = Array.from(timezoneInputs).find(input => 
    input.placeholder && input.placeholder.toLowerCase().includes('timezone')
);

if (foundInput) {
    console.log('✅ Found timezone input, trying to trigger dropdown...');
    
    // Try to focus the input to trigger loading
    foundInput.focus();
    foundInput.click();
    
    // Wait a bit and check for errors
    setTimeout(() => {
        console.log('\n📊 CAPTURED MESSAGES:');
        capturedMessages.forEach(msg => {
            if (msg.type === 'error') {
                console.log(`❌ ERROR: ${msg.message}`);
            } else if (msg.type === 'warn') {
                console.log(`⚠️ WARNING: ${msg.message}`);
            }
        });
        
        if (capturedMessages.length === 0) {
            console.log('✅ No new error messages captured');
        }
        
        // Restore original console methods
        console.error = originalConsoleError;
        console.warn = originalConsoleWarn;
        console.log = originalConsoleLog;
        
        // Final analysis
        console.log('\n🎯 ANALYSIS:');
        console.log('If you see "TIMEZONE LOADING ERROR" messages above, that\'s the root cause.');
        console.log('If no errors, the issue might be:');
        console.log('1. Import path problem with timezoneList.ts');
        console.log('2. Build didn\'t include the new files');
        console.log('3. Browser cache issue');
        
        console.log('\n💡 NEXT STEPS:');
        console.log('1. Look for any RED error messages above');
        console.log('2. Try hard refresh (Ctrl+Shift+R)');
        console.log('3. Check Network tab for failed file loads');
        
    }, 2000);
    
} else {
    console.log('❌ Could not find timezone input field');
    console.log('Available inputs:', timezoneInputs.length);
}

// Test basic timezone functionality
console.log('\n🧪 Testing basic timezone functions...');
try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    console.log('✅ Browser timezone detection:', detected);
    
    // Test a few timezones
    ['UTC', 'America/New_York', 'Asia/Ho_Chi_Minh'].forEach(tz => {
        try {
            new Intl.DateTimeFormat('en-US', { timeZone: tz });
            console.log(`✅ ${tz} is valid`);
        } catch (e) {
            console.log(`❌ ${tz} failed:`, e.message);
        }
    });
    
} catch (error) {
    console.log('❌ Basic timezone test failed:', error);
}

console.log('\n✅ Debug complete - Check output above');