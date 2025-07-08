
// Test script to check extension communication
console.log('Testing extension communication...');
console.log('Extension ID:', chrome?.runtime?.id);

// Test if extension is available
if (typeof chrome !== 'undefined' && chrome.runtime) {
  console.log('Chrome runtime available');
  
  // Send a simple message
  chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Extension communication error:', chrome.runtime.lastError);
    } else {
      console.log('Extension responded:', response);
    }
  });
} else {
  console.log('Chrome runtime not available');
}
