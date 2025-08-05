// 🔍 TIMEZONE SELECTOR DEBUG SCRIPT
// Copy and paste this entire script into your browser console while on the settings page

console.log('🚀 Starting Timezone Selector Debug Script...');
console.log('==========================================');

// Step 1: Check if TimezoneSelector component is mounted
function checkComponentMount() {
    console.log('\n📍 STEP 1: Checking if TimezoneSelector component is mounted');
    
    const timezoneInputs = document.querySelectorAll('input[placeholder*="timezone" i], input[placeholder*="Search timezone" i]');
    const timezoneSelects = document.querySelectorAll('select');
    const timezoneButtons = document.querySelectorAll('button:contains("timezone"), div:contains("Timezone Settings")');
    
    console.log(`Found ${timezoneInputs.length} timezone input(s)`);
    console.log(`Found ${timezoneSelects.length} select element(s)`);
    console.log('Timezone inputs:', timezoneInputs);
    
    if (timezoneInputs.length > 0) {
        console.log('✅ TimezoneSelector appears to be mounted');
        return true;
    } else {
        console.log('❌ TimezoneSelector not found - make sure you\'re on settings page');
        return false;
    }
}

// Step 2: Check React component state
function checkReactState() {
    console.log('\n📍 STEP 2: Checking React component state');
    
    try {
        // Try to access React DevTools or component state
        const reactRoot = document.querySelector('#root');
        if (reactRoot && reactRoot._reactInternalFiber) {
            console.log('✅ React app detected (old version)');
        } else if (reactRoot && reactRoot._reactRootContainer) {
            console.log('✅ React app detected (newer version)');
        } else {
            console.log('⚠️ React state not directly accessible, but that\'s normal');
        }
        
        // Check for any React errors in console
        const errors = window.console.errors || [];
        if (errors.length > 0) {
            console.log('❌ Found console errors:', errors);
        } else {
            console.log('✅ No obvious React errors');
        }
        
    } catch (error) {
        console.log('⚠️ Could not access React internals:', error.message);
    }
}

// Step 3: Check if timezone files are accessible
function checkTimezoneFiles() {
    console.log('\n📍 STEP 3: Checking timezone file availability');
    
    // Try to access the timezone list through module system
    try {
        // This won't work directly, but we can check if the script is loaded
        const scripts = Array.from(document.scripts);
        const hasTimezoneScript = scripts.some(script => 
            script.src.includes('timezone') || 
            script.innerHTML.includes('COMPREHENSIVE_TIMEZONES')
        );
        
        console.log(`Found ${scripts.length} total scripts`);
        console.log('Has timezone-related script:', hasTimezoneScript);
        
        // Check if any global variables exist
        if (window.COMPREHENSIVE_TIMEZONES) {
            console.log('✅ COMPREHENSIVE_TIMEZONES found globally:', window.COMPREHENSIVE_TIMEZONES.length);
        } else {
            console.log('❌ COMPREHENSIVE_TIMEZONES not found globally');
        }
        
    } catch (error) {
        console.log('❌ Error checking timezone files:', error);
    }
}

// Step 4: Test timezone functionality manually
function testTimezoneFunctionality() {
    console.log('\n📍 STEP 4: Testing timezone functionality manually');
    
    try {
        // Test browser timezone detection
        const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
        console.log('✅ Browser timezone detection working:', detected);
        
        // Test a few timezone validations
        const testTimezones = ['UTC', 'America/New_York', 'Asia/Ho_Chi_Minh', 'Europe/London', 'Invalid/Timezone'];
        
        testTimezones.forEach(tz => {
            try {
                new Intl.DateTimeFormat('en-US', { timeZone: tz });
                console.log(`✅ ${tz} - Valid`);
            } catch (error) {
                console.log(`❌ ${tz} - Invalid:`, error.message);
            }
        });
        
        // Test timezone offset calculation
        const now = new Date();
        const utcTime = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
        console.log('✅ UTC time calculation working:', utcTime.toISOString());
        
    } catch (error) {
        console.log('❌ Timezone functionality test failed:', error);
    }
}

// Step 5: Simulate component loading
function simulateComponentLoading() {
    console.log('\n📍 STEP 5: Simulating TimezoneSelector loading process');
    
    // This simulates what the TimezoneSelector component should do
    const COMPREHENSIVE_TIMEZONES = [
        'UTC', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Denver',
        'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai',
        'Asia/Ho_Chi_Minh', 'Australia/Sydney', 'Pacific/Auckland'
    ];
    
    try {
        console.log('Simulating timezone option creation...');
        
        const now = new Date();
        const options = COMPREHENSIVE_TIMEZONES.map(tz => {
            try {
                // This is the same logic as in the component
                const utcDate = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
                const targetDate = new Date(utcDate.toLocaleString('en-US', { timeZone: tz }));
                const offsetMs = targetDate.getTime() - utcDate.getTime();
                const offsetMinutes = offsetMs / (1000 * 60);
                
                const absMinutes = Math.abs(offsetMinutes);
                const hours = Math.floor(absMinutes / 60);
                const minutes = absMinutes % 60;
                const sign = offsetMinutes >= 0 ? '+' : '-';
                const offsetStr = `${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                
                return {
                    value: tz,
                    label: tz.split('/').pop()?.replace('_', ' ') || tz,
                    offset: `UTC${offsetStr}`,
                    region: tz === 'UTC' ? 'UTC' : tz.split('/')[0]
                };
            } catch (error) {
                console.log(`❌ Error processing ${tz}:`, error.message);
                return null;
            }
        }).filter(Boolean);
        
        console.log(`✅ Successfully simulated ${options.length} timezone options`);
        console.log('Sample options:', options.slice(0, 3));
        
        if (options.length < 10) {
            console.log('⚠️ Low timezone count - this might indicate an issue');
        }
        
    } catch (error) {
        console.log('❌ Simulation failed:', error);
        console.log('This error might be what\'s causing the fallback to minimal list');
    }
}

// Step 6: Check for specific error patterns
function checkErrorPatterns() {
    console.log('\n📍 STEP 6: Checking for common error patterns');
    
    // Check for import/module errors
    const commonErrors = [
        'Cannot resolve module',
        'Module not found',
        'Unexpected token',
        'import statement',
        'require is not defined',
        'COMPREHENSIVE_TIMEZONES is not defined',
        'getTimezoneDisplayName is not defined'
    ];
    
    // Get console history (if available)
    const consoleHistory = window.console.history || [];
    commonErrors.forEach(errorPattern => {
        const hasError = consoleHistory.some(entry => 
            entry.toLowerCase().includes(errorPattern.toLowerCase())
        );
        if (hasError) {
            console.log(`❌ Found error pattern: "${errorPattern}"`);
        }
    });
    
    console.log('✅ Error pattern check complete');
}

// Step 7: Provide recommendations
function provideRecommendations() {
    console.log('\n📍 STEP 7: Recommendations');
    console.log('==========================================');
    
    console.log(`
🎯 RECOMMENDATIONS:

1. **Clear Browser Cache**: Hard refresh with Ctrl+Shift+R (or Cmd+Shift+R on Mac)

2. **Check Network Tab**: 
   - Open DevTools → Network tab
   - Refresh page
   - Look for failed requests to timezone files

3. **Check Console Errors**: 
   - Look for any red error messages
   - Pay attention to import/require errors
   - Check if COMPREHENSIVE_TIMEZONES is undefined

4. **Verify Build**: 
   - Make sure npm run build completed successfully
   - Check if src/utils/timezoneList.ts exists and is included in build

5. **Force Component Reload**:
   - Try navigating away from settings and back
   - Or close/reopen settings dialog

6. **Manual Test**:
   - Try clicking on the timezone input field
   - Check if dropdown opens with limited vs comprehensive options
   - Look for any console messages when dropdown opens

7. **If still not working**:
   - The component is likely hitting the catch block and using fallback
   - Check the specific error message in the catch block
   - The error will tell us exactly what's failing
    `);
}

// Run all debug steps
async function runFullDebug() {
    console.log('🔍 FULL TIMEZONE DEBUG REPORT');
    console.log('==========================================');
    
    checkComponentMount();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    checkReactState();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    checkTimezoneFiles();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    testTimezoneFunctionality();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    simulateComponentLoading();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    checkErrorPatterns();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    provideRecommendations();
    
    console.log('\n✅ DEBUG COMPLETE - Check the output above for issues');
    console.log('==========================================');
}

// Auto-run the debug
runFullDebug();

// Make functions available for manual testing
window.timezoneDebug = {
    checkComponentMount,
    checkReactState,
    checkTimezoneFiles,
    testTimezoneFunctionality,
    simulateComponentLoading,
    checkErrorPatterns,
    provideRecommendations,
    runFullDebug
};

console.log('\n💡 TIP: You can also run individual checks with:');
console.log('window.timezoneDebug.checkComponentMount()');
console.log('window.timezoneDebug.testTimezoneFunctionality()');
console.log('etc...');