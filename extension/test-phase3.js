/**
 * Phase 3 Testing Script
 * Run this in the extension's background page console to test functionality
 */

async function testPhase3Features() {
  console.log('🧪 Testing Phase 3 Features...');
  
  const tests = [];
  
  // Test 1: Analytics Data Handler
  try {
    console.log('📊 Testing analytics data...');
    const analyticsResponse = await chrome.runtime.sendMessage({
      type: 'GET_ANALYTICS_DATA',
      payload: { period: 'week' }
    });
    
    if (analyticsResponse?.success) {
      console.log('✅ Analytics data loaded successfully');
      console.log('📈 Data structure:', Object.keys(analyticsResponse.data));
      tests.push({ name: 'Analytics Data', status: 'PASS' });
    } else {
      throw new Error(analyticsResponse?.error || 'Unknown error');
    }
  } catch (error) {
    console.error('❌ Analytics data test failed:', error);
    tests.push({ name: 'Analytics Data', status: 'FAIL', error: error.message });
  }
  
  // Test 2: Productivity Goals
  try {
    console.log('🎯 Testing productivity goals...');
    const goalsResponse = await chrome.runtime.sendMessage({
      type: 'GET_PRODUCTIVITY_GOALS'
    });
    
    if (goalsResponse?.success) {
      console.log('✅ Productivity goals loaded successfully');
      console.log('🎯 Goals:', Object.keys(goalsResponse.data));
      tests.push({ name: 'Productivity Goals', status: 'PASS' });
    } else {
      throw new Error(goalsResponse?.error || 'Unknown error');
    }
  } catch (error) {
    console.error('❌ Productivity goals test failed:', error);
    tests.push({ name: 'Productivity Goals', status: 'FAIL', error: error.message });
  }
  
  // Test 3: Category Breakdown
  try {
    console.log('🎨 Testing category breakdown...');
    const categoryResponse = await chrome.runtime.sendMessage({
      type: 'GET_CATEGORY_BREAKDOWN'
    });
    
    if (categoryResponse?.success) {
      console.log('✅ Category breakdown loaded successfully');
      console.log('🎨 Categories:', Object.keys(categoryResponse.data.categories));
      tests.push({ name: 'Category Breakdown', status: 'PASS' });
    } else {
      throw new Error(categoryResponse?.error || 'Unknown error');
    }
  } catch (error) {
    console.error('❌ Category breakdown test failed:', error);
    tests.push({ name: 'Category Breakdown', status: 'FAIL', error: error.message });
  }
  
  // Test 4: Site Categorization
  try {
    console.log('🌐 Testing site categorization...');
    const categoryResponse = await chrome.runtime.sendMessage({
      type: 'GET_SITE_CATEGORY',
      payload: { domain: 'github.com' }
    });
    
    if (categoryResponse?.success) {
      console.log('✅ Site categorization working');
      console.log('🌐 GitHub category:', categoryResponse.data.category);
      tests.push({ name: 'Site Categorization', status: 'PASS' });
    } else {
      throw new Error(categoryResponse?.error || 'Unknown error');
    }
  } catch (error) {
    console.error('❌ Site categorization test failed:', error);
    tests.push({ name: 'Site Categorization', status: 'FAIL', error: error.message });
  }
  
  // Summary
  console.log('\n📋 Test Results Summary:');
  console.log('========================');
  
  const passed = tests.filter(t => t.status === 'PASS').length;
  const failed = tests.filter(t => t.status === 'FAIL').length;
  
  tests.forEach(test => {
    const icon = test.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${test.name}: ${test.status}`);
    if (test.error) {
      console.log(`   Error: ${test.error}`);
    }
  });
  
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 All Phase 3 backend features are working correctly!');
  } else {
    console.log('⚠️ Some features need debugging. Check the errors above.');
  }
  
  return { passed, failed, tests };
}

// Test Storage Manager directly
async function testStorageManager() {
  console.log('\n🗃️ Testing Storage Manager...');
  
  try {
    // This should be available in background script
    if (typeof tracker !== 'undefined' && tracker.storageManager) {
      const analyticsData = await tracker.storageManager.getAnalyticsData('week');
      console.log('✅ Storage Manager analytics test passed');
      console.log('📊 Sample data:', analyticsData.summary);
      
      const goals = await tracker.storageManager.getProductivityGoals();
      console.log('✅ Storage Manager goals test passed');
      console.log('🎯 Goals:', Object.keys(goals));
      
      return true;
    } else {
      console.warn('⚠️ Storage Manager not accessible - run this in background script console');
      return false;
    }
  } catch (error) {
    console.error('❌ Storage Manager test failed:', error);
    return false;
  }
}

// Run tests
console.log('🚀 Starting Phase 3 Tests...');
testPhase3Features().then(results => {
  console.log('\n🧪 Backend tests completed');
  console.log('📝 Next: Test the popup interface by opening the extension');
  console.log('💡 Tips:');
  console.log('  - Check browser console for errors');
  console.log('  - Verify tabs switch properly');
  console.log('  - Ensure charts render or show fallbacks');
  console.log('  - Test analytics data loads');
});

// Also test storage manager if available
testStorageManager(); 