/**
 * Phase 0.5: Current State Verification Test
 * Tests current extension state before enhancement
 */

console.log('🔬 Phase 0.5: Current State Verification Starting...');

// Test 1: Verify storage structure
async function testCurrentStorageStructure() {
  console.log('\n📊 Testing current storage structure...');
  
  try {
    // Check if chrome.storage is available
    if (typeof chrome === 'undefined' || !chrome.storage) {
      console.error('❌ Chrome storage API not available');
      return false;
    }

    // Get current deep focus sessions
    const storage = await chrome.storage.local.get(['deepFocusSession']);
    console.log('📁 Current deepFocusSession structure:', storage.deepFocusSession);

    // Check user info
    const userStorage = await chrome.storage.local.get(['userInfo']);
    console.log('👤 Current userInfo:', userStorage.userInfo);

    // Check focus mode state
    const focusStorage = await chrome.storage.local.get(['focusMode', 'blockedSites']);
    console.log('🎯 Current focus state:', {
      focusMode: focusStorage.focusMode,
      blockedSites: focusStorage.blockedSites
    });

    return true;
  } catch (error) {
    console.error('❌ Storage structure test failed:', error);
    return false;
  }
}

// Test 2: Verify current message handlers
async function testCurrentMessageHandlers() {
  console.log('\n📨 Testing current message handlers...');

  const testMessages = [
    'CREATE_DEEP_FOCUS_SESSION',
    'COMPLETE_DEEP_FOCUS_SESSION', 
    'GET_LOCAL_DEEP_FOCUS_TIME',
    'GET_FOCUS_STATE',
    'TOGGLE_FOCUS_MODE'
  ];

  const results = {};

  for (const messageType of testMessages) {
    try {
      console.log(`📤 Testing ${messageType}...`);
      
      // Send message to background script
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: messageType,
          payload: messageType === 'COMPLETE_DEEP_FOCUS_SESSION' ? { duration: 5 } : {}
        }, (response) => {
          resolve(response || { error: 'No response' });
        });
      });

      results[messageType] = response;
      console.log(`✅ ${messageType} response:`, response);
      
    } catch (error) {
      console.error(`❌ ${messageType} failed:`, error);
      results[messageType] = { error: error.message };
    }
  }

  return results;
}

// Test 3: Verify response format compatibility  
function analyzeResponseFormats(responses) {
  console.log('\n🔍 Analyzing response format compatibility...');
  
  const formats = {};
  
  for (const [messageType, response] of Object.entries(responses)) {
    formats[messageType] = {
      hasSuccess: 'success' in response,
      successValue: response.success,
      hasError: 'error' in response,
      keys: Object.keys(response),
      structure: typeof response
    };
  }
  
  console.log('📋 Response format analysis:', formats);
  
  // Check for inconsistencies
  const inconsistencies = [];
  const allResponses = Object.values(formats);
  
  // Check if all have success field
  const allHaveSuccess = allResponses.every(f => f.hasSuccess);
  if (!allHaveSuccess) {
    inconsistencies.push('Not all responses have success field');
  }
  
  // Check success values
  const successValues = allResponses.map(f => f.successValue);
  const mixedSuccess = new Set(successValues).size > 1;
  if (mixedSuccess) {
    inconsistencies.push('Mixed success values detected');
  }
  
  console.log('⚠️ Response format inconsistencies:', inconsistencies);
  return { formats, inconsistencies };
}

// Test 4: Measure current performance baseline
async function measurePerformanceBaseline() {
  console.log('\n⏱️ Measuring performance baseline...');
  
  const measurements = {};
  
  // Test CREATE session performance
  const createStart = performance.now();
  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'CREATE_DEEP_FOCUS_SESSION'
      }, resolve);
    });
    measurements.create_session = performance.now() - createStart;
    console.log(`📊 CREATE_DEEP_FOCUS_SESSION: ${measurements.create_session.toFixed(2)}ms`);
  } catch (error) {
    measurements.create_session = -1;
    console.error('❌ CREATE performance test failed:', error);
  }
  
  // Test GET time performance  
  const getTimeStart = performance.now();
  try {
    await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'GET_LOCAL_DEEP_FOCUS_TIME'
      }, resolve);
    });
    measurements.get_local_time = performance.now() - getTimeStart;
    console.log(`📊 GET_LOCAL_DEEP_FOCUS_TIME: ${measurements.get_local_time.toFixed(2)}ms`);
  } catch (error) {
    measurements.get_local_time = -1;
    console.error('❌ GET time performance test failed:', error);
  }
  
  return measurements;
}

// Test 5: Check current sync triggers
async function verifyCurrentSyncTriggers() {
  console.log('\n🔄 Verifying current sync triggers...');
  
  // Check if ExtensionEventBus is available
  const hasEventBus = typeof ExtensionEventBus !== 'undefined';
  console.log('📡 ExtensionEventBus available:', hasEventBus);
  
  if (hasEventBus) {
    console.log('📡 ExtensionEventBus events:', Object.keys(ExtensionEventBus.EVENTS || {}));
  }
  
  // Check sync-related storage
  try {
    const syncStorage = await chrome.storage.local.get([
      'lastFirebaseSync', 
      'pendingSessions',
      'syncQueue'
    ]);
    console.log('🔄 Sync-related storage:', syncStorage);
  } catch (error) {
    console.error('❌ Sync storage check failed:', error);
  }
}

// Main test execution
async function runCurrentStateVerification() {
  console.log('🚀 Starting Current State Verification...');
  
  const results = {
    timestamp: new Date().toISOString(),
    tests: {}
  };
  
  // Run all tests
  results.tests.storageStructure = await testCurrentStorageStructure();
  results.tests.messageHandlers = await testCurrentMessageHandlers();
  results.tests.responseFormats = analyzeResponseFormats(results.tests.messageHandlers);
  results.tests.performanceBaseline = await measurePerformanceBaseline();
  await verifyCurrentSyncTriggers();
  
  console.log('\n📋 Current State Verification Summary:');
  console.log('✅ Tests completed:', Object.keys(results.tests).length);
  console.log('📊 Results:', results);
  
  // Store results for next phase
  try {
    await chrome.storage.local.set({
      'phase0_5_results': results
    });
    console.log('💾 Results saved for Phase 1');
  } catch (error) {
    console.error('❌ Failed to save results:', error);
  }
  
  return results;
}

// Auto-run if in extension context
if (typeof chrome !== 'undefined' && chrome.runtime) {
  runCurrentStateVerification();
} else {
  console.log('ℹ️ Test script loaded, run runCurrentStateVerification() manually');
}