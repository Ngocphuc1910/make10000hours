// Comprehensive Extension Verification Script
// Copy and paste this entire script into the browser console on any webpage

console.log('🔍 COMPREHENSIVE FOCUS TIME TRACKER VERIFICATION');
console.log('='.repeat(50));

let testResults = [];

// Helper function to add test results
function addTestResult(testName, success, message) {
  testResults.push({ testName, success, message });
  const icon = success ? '✅' : '❌';
  console.log(`${icon} ${testName}: ${message}`);
}

// Helper function to wait
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test 1: Extension Communication
async function testExtensionCommunication() {
  try {
    const response = await chrome.runtime.sendMessage({type: 'GET_STATE'});
    if (response && response.success !== false) {
      addTestResult('Extension Communication', true, 'Extension responding to messages');
      return true;
    } else {
      addTestResult('Extension Communication', false, 'Extension not responding properly');
      return false;
    }
  } catch (error) {
    addTestResult('Extension Communication', false, `Error: ${error.message}`);
    return false;
  }
}

// Test 2: Focus Mode Toggle
async function testFocusModeToggle() {
  try {
    console.log('🧪 Testing Focus Mode Toggle...');
    const response = await chrome.runtime.sendMessage({type: 'TOGGLE_FOCUS_MODE'});
    
    if (response && response.success && response.hasOwnProperty('focusMode')) {
      addTestResult('Focus Mode Toggle', true, `Focus mode: ${response.focusMode ? 'ON' : 'OFF'}`);
      return response.focusMode;
    } else {
      addTestResult('Focus Mode Toggle', false, `Invalid response: ${JSON.stringify(response)}`);
      return false;
    }
  } catch (error) {
    addTestResult('Focus Mode Toggle', false, `Error: ${error.message}`);
    return false;
  }
}

// Test 3: Block Current Site
async function testBlockCurrentSite() {
  try {
    console.log('🧪 Testing Block Current Site...');
    const response = await chrome.runtime.sendMessage({type: 'BLOCK_CURRENT_SITE'});
    
    if (response && response.success && response.domain) {
      addTestResult('Block Current Site', true, `Blocked domain: ${response.domain}`);
      return response.domain;
    } else {
      addTestResult('Block Current Site', false, `Failed: ${response ? response.error : 'No response'}`);
      return false;
    }
  } catch (error) {
    addTestResult('Block Current Site', false, `Error: ${error.message}`);
    return false;
  }
}

// Test 4: Get Blocked Sites
async function testGetBlockedSites() {
  try {
    console.log('🧪 Testing Get Blocked Sites...');
    const response = await chrome.runtime.sendMessage({type: 'GET_BLOCKED_SITES'});
    
    if (response && response.success && Array.isArray(response.data)) {
      addTestResult('Get Blocked Sites', true, `Found ${response.data.length} blocked sites: [${response.data.join(', ')}]`);
      return response.data;
    } else {
      addTestResult('Get Blocked Sites', false, 'Invalid response format');
      return false;
    }
  } catch (error) {
    addTestResult('Get Blocked Sites', false, `Error: ${error.message}`);
    return false;
  }
}

// Test 5: Focus Stats
async function testFocusStats() {
  try {
    console.log('🧪 Testing Focus Stats...');
    const response = await chrome.runtime.sendMessage({type: 'GET_FOCUS_STATS'});
    
    if (response && response.success && response.data) {
      const stats = response.data;
      addTestResult('Focus Stats', true, `Focus mode: ${stats.focusMode}, Blocked attempts: ${stats.blockedAttempts}`);
      return stats;
    } else {
      addTestResult('Focus Stats', false, 'Invalid stats response');
      return false;
    }
  } catch (error) {
    addTestResult('Focus Stats', false, `Error: ${error.message}`);
    return false;
  }
}

// Test 6: Declarative Net Request Rules
async function testDeclarativeNetRequestRules() {
  try {
    console.log('🧪 Testing Declarative Net Request Rules...');
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    addTestResult('Declarative Net Request', true, `Found ${rules.length} active blocking rules`);
    console.log('📋 Active rules:', rules);
    return rules;
  } catch (error) {
    addTestResult('Declarative Net Request', false, `Error: ${error.message}`);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🏃 Starting comprehensive tests...\n');
  
  // Test 1: Basic communication
  const commWorking = await testExtensionCommunication();
  if (!commWorking) {
    console.log('❌ Extension communication failed. Cannot continue tests.');
    return;
  }
  
  await wait(500);
  
  // Test 2: Focus mode toggle
  const focusModeResult = await testFocusModeToggle();
  await wait(500);
  
  // Test 3: Block current site
  const blockedDomain = await testBlockCurrentSite();
  await wait(500);
  
  // Test 4: Get blocked sites
  const blockedSites = await testGetBlockedSites();
  await wait(500);
  
  // Test 5: Focus stats
  const focusStats = await testFocusStats();
  await wait(500);
  
  // Test 6: Declarative net request rules
  const rules = await testDeclarativeNetRequestRules();
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(50));
  
  const successCount = testResults.filter(r => r.success).length;
  const totalTests = testResults.length;
  
  testResults.forEach(result => {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${result.testName}`);
  });
  
  console.log(`\n🎯 Results: ${successCount}/${totalTests} tests passed`);
  
  if (successCount === totalTests) {
    console.log('🎉 ALL TESTS PASSED! Phase 2 functionality is working correctly.');
  } else {
    console.log('⚠️ Some tests failed. Please check the individual test results above.');
  }
  
  // Phase 2 verification
  console.log('\n📋 PHASE 2 VERIFICATION:');
  console.log('✅ Focus Mode Toggle:', focusModeResult !== false ? 'WORKING' : 'FAILED');
  console.log('✅ Block Current Site:', blockedDomain !== false ? 'WORKING' : 'FAILED');
  console.log('✅ Blocked Sites Management:', blockedSites !== false ? 'WORKING' : 'FAILED');
  console.log('✅ Focus Session Tracking:', focusStats !== false ? 'WORKING' : 'FAILED');
  console.log('✅ Dynamic Rule Updates:', rules !== false ? 'WORKING' : 'FAILED');
}

// Start the tests
runAllTests(); 