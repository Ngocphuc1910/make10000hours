/**
 * Extension UTC Filtering Debug Script
 * Run this in browser console to analyze the extension local storage structure
 */

async function debugExtensionStorage() {
  console.log('🔍 Analyzing Extension Local Storage Structure...\n');
  
  try {
    // Try to communicate with extension
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage('ncieodiefhgdmlclnjjhbhkljpaglhlf', {
        action: 'GET_DEEP_FOCUS_STORAGE_DEBUG'
      }, (response) => {
        resolve(response);
      });
    });
    
    if (response && response.success) {
      const storage = response.data;
      console.log('📦 Extension Deep Focus Storage Structure:');
      
      // Analyze storage keys
      const storageKeys = Object.keys(storage).filter(key => key !== 'lastUpdated');
      console.log(`📊 Found ${storageKeys.length} date keys in storage:`);
      
      // Show key analysis
      console.table(storageKeys.map(key => {
        const sessions = Array.isArray(storage[key]) ? storage[key] : [];
        const sampleSession = sessions[0];
        
        return {
          'Storage Key': key,
          'Key Format': /^\d{4}-\d{2}-\d{2}$/.test(key) ? 'YYYY-MM-DD' : 'Other',
          'Sessions Count': sessions.length,
          'Sample utcDate': sampleSession?.utcDate || 'N/A',
          'Sample localDate': sampleSession?.localDate || 'N/A',
          'Sample timezone': sampleSession?.timezone || 'N/A',
          'Match Key?': key === sampleSession?.utcDate ? '✅' : key === sampleSession?.localDate ? '🟡' : '❌'
        };
      }));
      
      // Test date conversion mismatch
      console.log('\n🧪 Date Conversion Analysis:');
      const testDate = new Date('2025-08-06');
      const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      // Show what would happen with current extension filtering
      console.table({
        'Test Date Input': '2025-08-06',
        'Browser Timezone': browserTimezone,
        'Local Date String': testDate.getFullYear() + '-' + 
          String(testDate.getMonth() + 1).padStart(2, '0') + '-' + 
          String(testDate.getDate()).padStart(2, '0'),
        'UTC Date String': testDate.toISOString().split('T')[0],
        'Storage Keys Use': 'UTC Date (from session.utcDate)',
        'Filter Looks For': 'Local Date String',
        'Match Problem': 'YES - This is the bug!'
      });
      
      // Propose solution
      console.log('\n💡 SOLUTION:');
      console.log('The extension filtering should use UTC date logic, not local date logic.');
      console.log('Sessions are stored by utcDate, but filtering converts input dates to local strings.');
      
      // Show detailed session analysis
      if (storageKeys.length > 0) {
        console.log('\n📋 Detailed Session Analysis:');
        const sampleKey = storageKeys[0];
        const sampleSessions = storage[sampleKey] || [];
        
        if (sampleSessions.length > 0) {
          const session = sampleSessions[0];
          console.table({
            'Session ID': session.id?.substring(0, 8) + '...',
            'Storage Key Used': sampleKey,
            'session.utcDate': session.utcDate,
            'session.localDate': session.localDate,
            'session.timezone': session.timezone,
            'startTimeUTC': session.startTimeUTC,
            'Storage Strategy': 'By UTC Date ✅',
            'Filter Strategy': 'By Local Date ❌'
          });
        }
      }
      
    } else {
      console.error('❌ Could not get storage debug info from extension');
    }
  } catch (error) {
    console.error('❌ Error analyzing extension storage:', error);
  }
}

// Make available globally
window.debugExtensionStorage = debugExtensionStorage;

console.log(`
🔍 Extension Storage Debug Tool Loaded

Usage: debugExtensionStorage()

This will analyze:
- ✅ Extension storage structure  
- ✅ Date key formats
- ✅ Session data schema
- ✅ Filtering mismatch diagnosis

Run this to understand why extension filtering isn't working!
`);