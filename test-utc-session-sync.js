/**
 * Test UTC Session Sync Script
 * Run this in the browser console to test the new UTC-preserving sync logic
 */

console.log('🧪 Testing UTC Session Sync Implementation...');

// Test function to verify UTC session format
async function testUTCSessionSync() {
  try {
    // Check if services are available
    if (typeof ExtensionDataService === 'undefined') {
      console.error('❌ ExtensionDataService not available - run on Deep Focus page');
      return;
    }

    console.log('📋 Step 1: Reset circuit breaker and test extension communication');
    ExtensionDataService.resetCircuitBreaker();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test extension communication
    try {
      const pingResponse = await ExtensionDataService.ping();
      console.log('✅ Extension ping successful:', pingResponse);
    } catch (error) {
      console.error('❌ Extension communication failed:', error.message);
      return;
    }

    console.log('📋 Step 2: Get current sessions from extension');
    const sessionsResponse = await ExtensionDataService.getLast10DeepFocusSessions();
    
    if (!sessionsResponse.success || !sessionsResponse.data || sessionsResponse.data.length === 0) {
      console.warn('⚠️ No sessions found in extension. Create a deep focus session first.');
      console.log('Instructions:');
      console.log('1. Go to extension popup');
      console.log('2. Start a deep focus session');
      console.log('3. Let it run for a few seconds');
      console.log('4. End the session');
      console.log('5. Run this test again');
      return;
    }

    console.log(`📊 Found ${sessionsResponse.data.length} sessions in extension`);
    
    // Analyze the first session to see its format
    const sampleSession = sessionsResponse.data[0];
    console.log('📋 Step 3: Analyzing extension session format');
    console.table({
      'Session ID': sampleSession.id,
      'Start Time (raw)': sampleSession.startTime,
      'Start Time UTC': sampleSession.startTimeUTC,
      'UTC Date': sampleSession.utcDate,
      'Timezone': sampleSession.timezone,
      'Duration': sampleSession.duration,
      'Status': sampleSession.status
    });

    // Check if this session has proper UTC format
    const hasUTCFormat = !!(sampleSession.startTimeUTC && sampleSession.utcDate);
    console.log(hasUTCFormat ? '✅ Extension session has proper UTC format' : '❌ Extension session missing UTC fields');

    // Test sync to Firebase if DeepFocusSync is available
    console.log('📋 Step 4: Testing Firebase sync (if available)');
    if (typeof DeepFocusSync !== 'undefined') {
      console.log('🔄 DeepFocusSync service found, testing sync...');
      // This would require proper import, so we'll skip for now
      console.log('⚠️ Direct DeepFocusSync test skipped - requires proper module import');
    }

    // Check if we have a way to test the mapping logic
    console.log('📋 Step 5: Summary and recommendations');
    
    if (hasUTCFormat) {
      console.log('✅ GOOD: Extension sessions have UTC fields');
      console.log('🔄 Next: Trigger sync from Deep Focus page and check Firebase');
      console.log('📝 Expected Firebase fields:');
      console.log('  - startTimeUTC: "2025-08-06T08:56:38.263Z"');
      console.log('  - endTimeUTC: "2025-08-06T09:56:38.263Z"'); 
      console.log('  - utcDate: "2025-08-06"');
    } else {
      console.log('❌ ISSUE: Extension sessions missing UTC fields');
      console.log('🔧 Fix needed: Extension should store startTimeUTC and utcDate');
    }

    return {
      success: true,
      sessionsFound: sessionsResponse.data.length,
      hasUTCFormat,
      sampleSession
    };

  } catch (error) {
    console.error('❌ Test failed:', error);
    return { success: false, error: error.message };
  }
}

// Firebase session verification function
function verifyFirebaseSessionFormat(firebaseSession) {
  console.log('🔍 Verifying Firebase session format...');
  
  const checks = {
    'Has startTimeUTC': !!firebaseSession.startTimeUTC,
    'Has utcDate': !!firebaseSession.utcDate,
    'UTC date format valid': firebaseSession.utcDate?.match(/^\d{4}-\d{2}-\d{2}$/),
    'startTimeUTC format valid': firebaseSession.startTimeUTC?.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
    'Has timezone': !!firebaseSession.timezone,
    'Has extensionSessionId': !!firebaseSession.extensionSessionId
  };

  console.table(checks);
  
  const allGood = Object.values(checks).every(Boolean);
  console.log(allGood ? '✅ Firebase session format is correct!' : '❌ Firebase session format needs improvement');
  
  return { checks, allGood };
}

// Manual Firebase session checker (for when you have a Firebase session object)
window.checkFirebaseSession = verifyFirebaseSessionFormat;

// Export test function to global scope
window.testUTCSessionSync = testUTCSessionSync;

// Instructions
console.log(`
🧪 UTC Session Sync Test Commands Available:

1. testUTCSessionSync()        - Test complete UTC sync workflow
2. checkFirebaseSession(obj)   - Verify Firebase session format

Usage Examples:
- testUTCSessionSync()
- checkFirebaseSession(yourFirebaseSessionObject)

Instructions:
1. Make sure you have active deep focus sessions in the extension
2. Run testUTCSessionSync() to verify the format
3. Trigger sync from Deep Focus page
4. Check Firebase documents and use checkFirebaseSession() to verify
`);

// Auto-run basic test
testUTCSessionSync().then(result => {
  if (result.success) {
    console.log('🎉 Basic test completed successfully');
  }
}).catch(error => {
  console.error('💥 Test initialization failed:', error);
});