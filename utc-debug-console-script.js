// UTC Debug Console Script - Run this in browser console
// Copy and paste this entire script into your browser console

console.log('🔍 UTC DEBUG SCRIPT STARTING...');
console.log('====================================');

// 1. Check all localStorage keys related to UTC
console.log('\n1. 📦 LOCALSTORAGE ANALYSIS:');
const allKeys = Object.keys(localStorage);
const utcKeys = allKeys.filter(key => 
  key.includes('utc') || 
  key.includes('timezone') || 
  key.includes('emergency') || 
  key.includes('circuit')
);

console.log('All UTC-related localStorage keys:');
utcKeys.forEach(key => {
  const value = localStorage.getItem(key);
  console.log(`  ${key}: ${value}`);
});

// 2. Check emergency disable status
console.log('\n2. 🚨 EMERGENCY DISABLE CHECK:');
const emergencyFlag = localStorage.getItem('utc-emergency-disable');
const timezoneEmergencyFlag = localStorage.getItem('timezone_emergency_disable');
console.log('utc-emergency-disable:', emergencyFlag);
console.log('timezone_emergency_disable:', timezoneEmergencyFlag);
console.log('isEmergencyDisabled():', emergencyFlag === 'true');

// 3. Clear all emergency flags
console.log('\n3. 🧹 CLEARING ALL EMERGENCY FLAGS:');
const flagsToClear = [
  'utc-emergency-disable',
  'timezone_emergency_disable',
  'app-localStorage-reload',
  'utc-emergency-reload',
  'monitoring-emergency-disable'
];

flagsToClear.forEach(flag => {
  const hadValue = localStorage.getItem(flag) !== null;
  localStorage.removeItem(flag);
  console.log(`  Cleared ${flag}: ${hadValue ? 'had value' : 'was empty'}`);
});

// 4. Clear any circuit breaker related flags
console.log('\n4. ⚡ CLEARING CIRCUIT BREAKER FLAGS:');
const allLocalStorageKeys = Object.keys(localStorage);
const circuitBreakerKeys = allLocalStorageKeys.filter(key => key.includes('circuit'));
circuitBreakerKeys.forEach(key => {
  localStorage.removeItem(key);
  console.log(`  Cleared circuit breaker key: ${key}`);
});

// 5. Verify emergency disable is cleared
console.log('\n5. ✅ VERIFICATION:');
const afterClear = localStorage.getItem('utc-emergency-disable');
console.log('utc-emergency-disable after clear:', afterClear);
console.log('isEmergencyDisabled() after clear:', afterClear === 'true');

// 6. Test the feature flags directly
console.log('\n6. 🏁 FEATURE FLAGS TEST:');
try {
  // Try to access the global utcFeatureFlags if available
  if (typeof window !== 'undefined' && window.utcFeatureFlags) {
    console.log('Found global utcFeatureFlags');
    const transitionMode = window.utcFeatureFlags.getTransitionMode('test-user');
    console.log('Direct call result:', transitionMode);
  } else {
    console.log('Global utcFeatureFlags not found - this is normal');
  }
} catch (error) {
  console.log('Error testing feature flags:', error.message);
}

// 7. Force reload to clear any cached instances
console.log('\n7. 🔄 RECOMMENDATION:');
console.log('After running this script:');
console.log('1. Wait 2 seconds');
console.log('2. Refresh the page (Ctrl/Cmd + R)');
console.log('3. Try creating a work session again');
console.log('4. Look for "isEmergencyDisabled: false" in the debug logs');

// 8. Set up a timer to auto-refresh
console.log('\n8. ⏰ AUTO-REFRESH IN 3 SECONDS...');
setTimeout(() => {
  console.log('Auto-refreshing page to apply changes...');
  window.location.reload();
}, 3000);

console.log('\n====================================');
console.log('🔍 UTC DEBUG SCRIPT COMPLETED');
console.log('Page will refresh in 3 seconds...');