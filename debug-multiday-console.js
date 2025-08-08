// Multi-Day Feature Debug Script
// Paste this entire script into browser console on localhost:3002

console.log('🔍 Multi-Day Feature Debug Script Starting...');

// Step 1: Check if stores are available
console.log('\n=== STEP 1: Checking Available Stores ===');
const hasUIStore = typeof useUIStore !== 'undefined';
console.log('useUIStore available:', hasUIStore);

if (!hasUIStore) {
  console.log('❌ UIStore not available globally. Trying window object...');
  if (window.useUIStore) {
    console.log('✅ Found useUIStore on window object');
  } else {
    console.log('❌ UIStore not available anywhere');
    console.log('This might be the issue - stores are not exposed globally');
  }
} else {
  console.log('✅ UIStore available globally');
}

// Step 2: Check feature flag state
console.log('\n=== STEP 2: Checking Feature Flag State ===');
try {
  const uiStore = hasUIStore ? useUIStore.getState() : window.useUIStore?.getState();
  
  if (uiStore) {
    console.log('UIStore state found');
    console.log('Full UIStore:', uiStore);
    console.log('Feature flags object:', uiStore.featureFlags);
    console.log('multiDayTasks flag:', uiStore.featureFlags?.multiDayTasks);
    
    // Step 3: Try to enable the feature flag
    console.log('\n=== STEP 3: Enabling Multi-Day Feature ===');
    if (uiStore.setFeatureFlag) {
      console.log('🔄 Enabling multi-day feature...');
      uiStore.setFeatureFlag('multiDayTasks', true);
      console.log('✅ Multi-day feature enabled!');
      console.log('Updated feature flags:', uiStore.featureFlags);
    } else {
      console.log('❌ setFeatureFlag method not available');
    }
  } else {
    console.log('❌ Could not access UIStore');
  }
} catch (error) {
  console.error('❌ Error accessing UIStore:', error);
}

// Step 4: Check if the isMultiDayEnabled function works
console.log('\n=== STEP 4: Testing isMultiDayEnabled Function ===');
try {
  // The function should be importable, but let's try to access it
  const testMultiDay = () => {
    const uiStore = (hasUIStore ? useUIStore : window.useUIStore)?.getState();
    return uiStore?.featureFlags?.multiDayTasks || false;
  };
  
  console.log('isMultiDayEnabled test result:', testMultiDay());
} catch (error) {
  console.error('❌ Error testing isMultiDayEnabled:', error);
}

// Step 5: Instructions for next steps
console.log('\n=== STEP 5: Next Steps ===');
console.log('1. After running this script, try creating a new task');
console.log('2. Click the calendar button in the task form');
console.log('3. You should now see multi-day date range options');
console.log('4. Look for:');
console.log('   - "Date range:" label above the calendar');
console.log('   - Range highlighting when selecting dates');
console.log('   - "Change end date" and "Make single day" buttons');

// Step 6: Create a helper function to check DatePicker state
console.log('\n=== STEP 6: DatePicker Debug Helper ===');
window.debugDatePicker = function() {
  const datePicker = document.querySelector('[data-datepicker]');
  if (datePicker) {
    console.log('✅ DatePicker found');
    const multiDayPanel = datePicker.querySelector('.bg-background-container');
    console.log('Multi-day panel:', multiDayPanel ? '✅ Found' : '❌ Missing');
    
    const rangeInfo = datePicker.querySelector('[class*="Date range"]') || 
                     datePicker.querySelector('[class*="Select end date"]');
    console.log('Range info:', rangeInfo ? '✅ Found' : '❌ Missing');
  } else {
    console.log('❌ DatePicker not found - is it open?');
    console.log('💡 Try: Click "Add Task" → Click calendar button');
  }
};

console.log('✅ Multi-Day Debug Script Complete!');
console.log('💡 Run debugDatePicker() after opening a DatePicker to check its state');