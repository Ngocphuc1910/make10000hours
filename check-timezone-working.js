// 🔍 SIMPLE CHECK - Is timezone selector working?
// Run this on the settings page

console.log('🔍 Quick Timezone Check');
console.log('=====================');

// Method 1: Check if dropdown has more options
setTimeout(() => {
    console.log('\n📊 METHOD 1: Counting dropdown options');
    
    // Look for timezone input/dropdown
    const timezoneInput = document.querySelector('input[placeholder*="timezone" i]');
    if (timezoneInput) {
        console.log('✅ Found timezone input field');
        
        // Try to click it to open dropdown
        timezoneInput.click();
        timezoneInput.focus();
        
        setTimeout(() => {
            // Look for dropdown options
            const dropdownOptions = document.querySelectorAll('button, div[role="option"], option');
            const visibleOptions = Array.from(dropdownOptions).filter(el => 
                el.textContent && 
                (el.textContent.includes('UTC') || 
                 el.textContent.includes('America') || 
                 el.textContent.includes('Asia') || 
                 el.textContent.includes('Europe') ||
                 el.textContent.includes('Ho Chi Minh'))
            );
            
            console.log(`Found ${visibleOptions.length} timezone-related options in DOM`);
            
            if (visibleOptions.length > 10) {
                console.log('✅ SUCCESS: Many timezone options found!');
                console.log('Sample options:', visibleOptions.slice(0, 5).map(el => el.textContent.trim()));
                
                // Check specifically for Ho Chi Minh
                const hoChiMinhOption = visibleOptions.find(el => 
                    el.textContent.toLowerCase().includes('ho chi minh') ||
                    el.textContent.toLowerCase().includes('vietnam')
                );
                
                if (hoChiMinhOption) {
                    console.log('✅ Ho Chi Minh City option found:', hoChiMinhOption.textContent.trim());
                } else {
                    console.log('⚠️ Ho Chi Minh City option not found in visible options');
                }
                
            } else if (visibleOptions.length > 0) {
                console.log('⚠️ LIMITED: Only found these options:', 
                    visibleOptions.map(el => el.textContent.trim()));
            } else {
                console.log('❌ No timezone options found - dropdown might not be open');
            }
        }, 1000);
        
    } else {
        console.log('❌ Timezone input field not found');
        console.log('Available inputs:', document.querySelectorAll('input').length);
    }
}, 500);

// Method 2: Check console for success messages
console.log('\n📊 METHOD 2: Look for component success messages');
console.log('Check above for messages like:');
console.log('- "✅ Loaded X timezone options from comprehensive list"');
console.log('- "First 5 timezones: [...]"');
console.log('');
console.log('If you see those messages, the comprehensive list is working!');

// Method 3: Manual test instruction
console.log('\n📊 METHOD 3: Manual visual test');
console.log('1. Click on the timezone input field');
console.log('2. You should see a dropdown with MANY options');
console.log('3. Search for "Ho Chi Minh" or "Vietnam"');
console.log('4. If found, the comprehensive timezone selector is working!');

console.log('\n✅ Check complete - Look at the results above');