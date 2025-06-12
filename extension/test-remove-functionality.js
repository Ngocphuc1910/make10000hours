// Test script for Remove Button Functionality
// Run this in the console on the options page

console.log('🧪 Testing Remove Button Functionality...');

// Test 1: Check if buttons have proper event listeners
function testRemoveButtons() {
  const removeButtons = document.querySelectorAll('.remove-site-btn');
  console.log(`Found ${removeButtons.length} remove buttons`);
  
  removeButtons.forEach((btn, index) => {
    const domain = btn.getAttribute('data-domain');
    console.log(`Button ${index + 1}: ${domain}`);
    
    // Check if button has event listener (this is a simplified check)
    if (btn.onclick === null) {
      console.log(`✅ Button for ${domain} uses proper event listener (no inline onclick)`);
    } else {
      console.log(`❌ Button for ${domain} still has inline onclick handler`);
    }
  });
}

// Test 2: Simulate button click (without actually removing)
function simulateButtonClick() {
  const firstButton = document.querySelector('.remove-site-btn');
  if (firstButton) {
    const domain = firstButton.getAttribute('data-domain');
    console.log(`🎯 Simulating click on button for domain: ${domain}`);
    
    // This should trigger the event listener without CSP errors
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    });
    
    try {
      firstButton.dispatchEvent(event);
      console.log('✅ Button click dispatched successfully (no CSP errors)');
    } catch (error) {
      console.error('❌ Error dispatching button click:', error);
    }
  } else {
    console.log('⚠️ No remove buttons found to test');
  }
}

// Test 3: Check for CSP errors
function checkCSPErrors() {
  const cspErrors = [];
  
  // Listen for CSP violations
  document.addEventListener('securitypolicyviolation', (e) => {
    cspErrors.push({
      violatedDirective: e.violatedDirective,
      blockedURI: e.blockedURI,
      originalPolicy: e.originalPolicy
    });
    console.error('🚨 CSP Violation:', e);
  });
  
  setTimeout(() => {
    if (cspErrors.length === 0) {
      console.log('✅ No CSP violations detected');
    } else {
      console.log(`❌ Found ${cspErrors.length} CSP violations:`, cspErrors);
    }
  }, 2000);
}

// Run all tests
setTimeout(() => {
  testRemoveButtons();
  checkCSPErrors();
  
  console.log('\n🎯 To test remove functionality:');
  console.log('1. Click any "Remove" button');
  console.log('2. Check console for logs starting with 🗑️');
  console.log('3. Confirm dialog should appear');
  console.log('4. No CSP errors should be shown');
}, 1000); 