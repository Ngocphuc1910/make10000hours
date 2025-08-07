/**
 * Extension UTC Filtering Diagnostic Script
 * Run this in browser console to diagnose the extension filtering issue
 */

async function diagnoseExtensionFiltering() {
  console.log('🔍 Diagnosing Extension UTC Filtering Issue...\n');
  
  try {
    // Get debug storage info from extension
    const debugResponse = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'DEBUG_STORAGE'
      }, (response) => {
        resolve(response);
      });
    });
    
    if (!debugResponse?.success) {
      console.error('❌ Could not get debug storage from extension');
      return;
    }
    
    const allStorage = debugResponse.data;
    const deepFocusData = allStorage.deepFocusStorage || {};
    
    console.log('📦 Extension Storage Analysis:');
    console.log('Keys in deepFocusStorage:', Object.keys(deepFocusData));
    
    // Analyze date keys
    const dateKeys = Object.keys(deepFocusData).filter(key => key !== 'lastUpdated');
    console.log(`\n📊 Found ${dateKeys.length} date keys:`);
    
    dateKeys.forEach(key => {
      const sessions = deepFocusData[key] || [];
      console.log(`🗓️ Key: "${key}" → ${sessions.length} sessions`);
      
      if (sessions.length > 0) {
        const sample = sessions[0];
        console.log(`   Sample session utcDate: ${sample.utcDate}`);
        console.log(`   Sample session localDate: ${sample.localDate}`);
        console.log(`   Sample session timezone: ${sample.timezone}`);
        console.log(`   Key matches utcDate: ${key === sample.utcDate ? '✅' : '❌'}`);
        console.log(`   Key matches localDate: ${key === sample.localDate ? '✅' : '❌'}`);
      }
    });
    
    // Test the problematic filtering logic
    console.log('\n🧪 Testing Current Filtering Logic:');
    
    // Simulate what happens when web app requests Aug 6th data
    const testInputDate = '2025-08-06';
    const inputAsDate = new Date(testInputDate);
    
    // This is what the current extension filtering does (WRONG):
    const localDateString = inputAsDate.getFullYear() + '-' + 
      String(inputAsDate.getMonth() + 1).padStart(2, '0') + '-' + 
      String(inputAsDate.getDate()).padStart(2, '0');
    
    // This is what it should do (CORRECT):
    const utcDateString = inputAsDate.toISOString().split('T')[0];
    
    console.table({
      'Input from web app': testInputDate,
      'Current extension logic': `Converts to local date: "${localDateString}"`,
      'Sessions stored under': 'UTC date keys (from session.utcDate)', 
      'Extension looks for': `"${localDateString}"`,
      'Sessions actually stored at': dateKeys.includes(utcDateString) ? `"${utcDateString}" ✅` : 'Not found',
      'Problem': 'Extension converts input to local date, but sessions stored by UTC date',
      'Result': 'NO MATCH - Sessions not found'
    });
    
    // Show what timezone the sessions think they're in
    if (dateKeys.length > 0) {
      const sampleSession = deepFocusData[dateKeys[0]]?.[0];
      if (sampleSession) {
        console.log('\n📍 Session Timezone Info:');
        console.table({
          'Session timezone field': sampleSession.timezone,
          'Browser timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
          'UTC Date (storage key)': sampleSession.utcDate,
          'Local Date (display)': sampleSession.localDate
        });
      }
    }
    
    // Provide the exact fix
    console.log('\n💡 THE EXACT FIX:');
    console.log('In extension background.js, the getDeepFocusSessionsForDateRange method needs to:');
    console.log('1. Convert input dates to UTC date strings (not local date strings)');
    console.log('2. Use UTC date logic for storage key lookup');
    console.log('');
    console.log('CURRENT CODE (line ~1393):');
    console.log('  const startStr = DateUtils.getLocalDateStringFromDate(new Date(startDate));');
    console.log('');
    console.log('SHOULD BE:');
    console.log('  const startStr = new Date(startDate).toISOString().split("T")[0];');
    
    // Test if fix would work
    console.log('\n🔧 Testing Proposed Fix:');
    const fixedLookup = utcDateString;
    const wouldFind = deepFocusData[fixedLookup] || [];
    console.log(`✅ With UTC logic: "${fixedLookup}" → Found ${wouldFind.length} sessions`);
    console.log(`❌ With current logic: "${localDateString}" → Found ${(deepFocusData[localDateString] || []).length} sessions`);
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
  }
}

// Make available globally
window.diagnoseExtensionFiltering = diagnoseExtensionFiltering;

console.log(`
🔍 Extension UTC Filtering Diagnostic Ready

Usage: diagnoseExtensionFiltering()

This will show:
- ✅ How sessions are actually stored (by UTC date)
- ✅ How filtering currently works (by local date) 
- ✅ Why they don't match
- ✅ The exact code fix needed

Run this to get the complete diagnosis!
`);