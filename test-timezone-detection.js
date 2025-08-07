/**
 * Test script to validate timezone detection fix
 * Run this in browser console on Deep Focus page
 */

function testTimezoneDetection() {
  console.log('🧪 Testing Timezone Detection Fix...\n');
  
  // Test 1: Check if useUserStore is available
  if (typeof useUserStore === 'undefined') {
    console.error('❌ useUserStore not available');
    return;
  }
  
  // Test 2: Get current user and timezone setting
  const userState = useUserStore.getState();
  const user = userState.user;
  
  console.log('👤 User State Debug:');
  console.table({
    'User exists': !!user,
    'User ID': user?.uid?.substring(0, 8) + '...' || 'None',
    'Settings exist': !!user?.settings,
    'Timezone settings exist': !!user?.settings?.timezone,
    'Timezone current': user?.settings?.timezone?.current || 'Not set',
    'Timezone confirmed': user?.settings?.timezone?.confirmed || false
  });
  
  // Test 3: Check browser-detected timezone
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  console.log('🌐 Browser detected timezone:', browserTimezone);
  
  // Test 4: Test our getUserEffectiveTimezone method
  if (typeof TimezoneFilteringUtils !== 'undefined') {
    const detectedTimezone = TimezoneFilteringUtils.getUserEffectiveTimezone();
    console.log('🎯 Our method detected timezone:', detectedTimezone);
    
    // Test 5: Test with explicit user settings
    const explicitTimezone = TimezoneFilteringUtils.getUserEffectiveTimezone(user?.settings);
    console.log('🎯 With explicit settings timezone:', explicitTimezone);
    
    // Test 6: Compare results
    console.log('\n📊 Timezone Detection Results:');
    console.table({
      'User Setting': user?.settings?.timezone?.current || 'Not set',
      'Browser Detection': browserTimezone,
      'Our Method (auto)': detectedTimezone,
      'Our Method (explicit)': explicitTimezone,
      'Match User Setting': detectedTimezone === user?.settings?.timezone?.current
    });
    
    // Test 7: Test date conversion with correct timezone
    console.log('\n🧪 Testing Date Conversion:');
    const testDate = new Date('2025-08-06');
    const utcRange = TimezoneFilteringUtils.convertLocalDateRangeToUTC(
      testDate, testDate, detectedTimezone
    );
    
    console.log('🌍 Conversion Test Results:');
    console.table({
      'Input Date': testDate.toISOString().split('T')[0],
      'Using Timezone': detectedTimezone,
      'UTC Start': utcRange.utcStart,
      'UTC End': utcRange.utcEnd,
      'Hours Covered': ((new Date(utcRange.utcEnd) - new Date(utcRange.utcStart)) / (1000 * 60 * 60)).toFixed(2)
    });
    
  } else {
    console.error('❌ TimezoneFilteringUtils not available');
  }
  
  // Test 8: Recommendations
  console.log('\n💡 Recommendations:');
  
  if (!user?.settings?.timezone?.current) {
    console.warn('⚠️ User has no saved timezone setting. They should set it in settings.');
  } else if (user.settings.timezone.current === browserTimezone) {
    console.log('✅ User timezone setting matches browser detection.');
  } else {
    console.log('ℹ️ User timezone differs from browser (this is okay - user may have traveled).');
    console.log(`   User setting: ${user.settings.timezone.current}`);
    console.log(`   Browser: ${browserTimezone}`);
  }
}

// Make it available globally
window.testTimezoneDetection = testTimezoneDetection;

console.log(`
🧪 Timezone Detection Test Available

Usage: testTimezoneDetection()

This will test:
- ✅ User timezone setting access
- ✅ Browser timezone detection  
- ✅ Our getUserEffectiveTimezone method
- ✅ Date conversion with correct timezone

Run this to verify the timezone detection fix!
`);