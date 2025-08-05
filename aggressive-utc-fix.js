// AGGRESSIVE UTC FIX - Run this directly in browser console
// Copy and paste this entire script

console.log('🚀 AGGRESSIVE UTC FIX STARTING...');

// Step 1: Nuclear clear of ALL localStorage
console.log('💥 Step 1: Nuclear localStorage clear...');
const beforeKeys = Object.keys(localStorage).length;
localStorage.clear();
sessionStorage.clear();
console.log(`Cleared ${beforeKeys} localStorage keys and all sessionStorage`);

// Step 2: Set fresh UTC flags
console.log('🔧 Step 2: Setting fresh UTC flags...');
const freshFlags = {
  utcDataStorage: true,
  utcDashboard: true,
  utcTimerIntegration: true,
  utcExtensionSync: true,
  utcMigrationTools: true,
  utcCalendarSync: true,
  transitionMode: 'dual',
  rolloutPercentage: 100
};
localStorage.setItem('utc-feature-flags', JSON.stringify(freshFlags));
console.log('Fresh UTC flags set:', freshFlags);

// Step 3: Force reload to clear all cached instances
console.log('🔄 Step 3: Force reload in 2 seconds...');
setTimeout(() => {
  console.log('🔄 Reloading to clear all cached instances...');
  window.location.reload(true); // Hard reload
}, 2000);

console.log('✅ AGGRESSIVE FIX APPLIED - Page will reload in 2 seconds');
console.log('After reload, the emergency disable should be false');