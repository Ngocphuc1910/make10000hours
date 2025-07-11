/**
 * Test script to verify blocking screen data integration
 * Run this in the browser console when testing the blocked page
 */

console.log('🧪 Testing Blocking Screen Data Integration...');

// Test function to check if all required elements exist
function testElementsExist() {
  const elements = [
    'screenTime',
    'focusTime', 
    'overrideTime'
  ];
  
  const results = elements.map(id => {
    const element = document.getElementById(id);
    return {
      id,
      exists: !!element,
      content: element?.textContent || 'N/A'
    };
  });
  
  console.table(results);
  return results.every(r => r.exists);
}

// Test function to verify message handlers work
async function testMessageHandlers() {
  const tests = [
    { type: 'GET_TODAY_STATS', description: 'On Screen Time Data' },
    { type: 'GET_LOCAL_DEEP_FOCUS_TIME', description: 'Deep Focus Time Data' },
    { type: 'GET_LOCAL_OVERRIDE_TIME', description: 'Override Time Data' }
  ];
  
  console.log('📡 Testing message handlers...');
  
  for (const test of tests) {
    try {
      const response = await chrome.runtime.sendMessage({ type: test.type });
      console.log(`✅ ${test.description}:`, response);
    } catch (error) {
      console.error(`❌ ${test.description} failed:`, error);
    }
  }
}

// Test function to simulate data loading
async function testDataLoading() {
  console.log('📊 Testing data loading simulation...');
  
  // Simulate BlockedPage class initialization
  if (typeof BlockedPage !== 'undefined') {
    try {
      const blockedPage = new BlockedPage();
      console.log('✅ BlockedPage initialized successfully');
    } catch (error) {
      console.error('❌ BlockedPage initialization failed:', error);
    }
  } else {
    console.log('ℹ️ BlockedPage class not available (run this on the blocked page)');
  }
}

// Run all tests
(async function runTests() {
  console.log('🚀 Starting comprehensive tests...');
  
  console.log('\n1. Testing DOM elements...');
  const elementsOk = testElementsExist();
  
  if (elementsOk) {
    console.log('\n2. Testing message handlers...');
    await testMessageHandlers();
    
    console.log('\n3. Testing data loading...');
    await testDataLoading();
  }
  
  console.log('\n✅ Tests completed!');
})();