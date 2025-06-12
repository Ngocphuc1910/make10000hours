// Test script for Focus Time Tracker Extension
// Run this in the browser console on any webpage

console.log('🧪 Testing Focus Time Tracker Extension...');

// Test 1: Check if extension is loaded
chrome.runtime.sendMessage({type: 'GET_STATE'}, (response) => {
  console.log('✅ Extension communication test:', response);
});

// Test 2: Test focus mode toggle
setTimeout(() => {
  console.log('🧪 Testing focus mode toggle...');
  chrome.runtime.sendMessage({type: 'TOGGLE_FOCUS_MODE'}, (response) => {
    console.log('✅ Focus mode toggle result:', response);
  });
}, 1000);

// Test 3: Test block current site
setTimeout(() => {
  console.log('🧪 Testing block current site...');
  chrome.runtime.sendMessage({type: 'BLOCK_CURRENT_SITE'}, (response) => {
    console.log('✅ Block current site result:', response);
  });
}, 2000);

// Test 4: Get blocked sites
setTimeout(() => {
  console.log('🧪 Getting blocked sites...');
  chrome.runtime.sendMessage({type: 'GET_BLOCKED_SITES'}, (response) => {
    console.log('✅ Blocked sites:', response);
  });
}, 3000); 