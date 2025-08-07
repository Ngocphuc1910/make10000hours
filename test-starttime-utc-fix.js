/**
 * Test script to verify startTimeUTC field is properly preserved in Firebase sync
 * Run this in browser console after the fix
 */

console.log('🔧 Testing startTimeUTC Preservation Fix...');

async function testStartTimeUTCFix() {
  try {
    // Step 1: Reset circuit breaker
    console.log('📋 Step 1: Resetting circuit breaker...');
    if (typeof ExtensionDataService !== 'undefined') {
      ExtensionDataService.resetCircuitBreaker();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Step 2: Get extension sessions and verify format
    console.log('📋 Step 2: Getting sessions from extension...');
    const sessionsResponse = await ExtensionDataService.getLast10DeepFocusSessions();
    
    if (!sessionsResponse.success || !sessionsResponse.data || sessionsResponse.data.length === 0) {
      console.warn('⚠️ No sessions found. Create a deep focus session first.');
      return { success: false, reason: 'no_sessions' };
    }

    const session = sessionsResponse.data[0];
    console.log('📊 Latest extension session format:');
    console.table({
      'ID': session.id,
      'startTime': session.startTime,
      'startTimeUTC': session.startTimeUTC,
      'endTimeUTC': session.endTimeUTC,
      'utcDate': session.utcDate,
      'timezone': session.timezone,
      'duration': session.duration
    });

    // Step 3: Verify extension has UTC fields
    const hasUTCFields = !!(session.startTimeUTC && session.utcDate);
    console.log(hasUTCFields ? '✅ Extension session has UTC fields' : '❌ Extension missing UTC fields');

    if (!hasUTCFields) {
      console.log('💡 Expected extension format:');
      console.log('- startTimeUTC: "2025-08-06T08:56:38.263Z"');
      console.log('- utcDate: "2025-08-06"');
      return { success: false, reason: 'missing_utc_fields' };
    }

    // Step 4: Show what should be synced to Firebase
    console.log('📋 Step 3: Expected Firebase document should include:');
    const expectedFirebaseFields = {
      startTimeUTC: session.startTimeUTC,
      endTimeUTC: session.endTimeUTC || null,
      utcDate: session.utcDate,
      timezone: session.timezone,
      extensionSessionId: session.id,
      duration: session.duration
    };
    console.table(expectedFirebaseFields);

    console.log('🔄 Step 4: Ready to test sync!');
    console.log('💡 Next steps:');
    console.log('1. Trigger sync by refreshing the Deep Focus page or creating new session');
    console.log('2. Check Firebase Firestore console');
    console.log('3. Verify the new document contains startTimeUTC field');
    console.log('4. Use checkFirebaseSession() function to validate format');

    return {
      success: true,
      extensionSession: session,
      expectedFirebaseFields
    };

  } catch (error) {
    console.error('❌ Test failed:', error);
    return { success: false, error: error.message };
  }
}

// Function to validate Firebase session after sync
function validateFirebaseSession(firebaseSession) {
  console.log('🔍 Validating Firebase session format...');
  
  const requiredUTCFields = {
    'startTimeUTC exists': !!firebaseSession.startTimeUTC,
    'startTimeUTC is string': typeof firebaseSession.startTimeUTC === 'string',
    'startTimeUTC format': firebaseSession.startTimeUTC?.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
    'utcDate exists': !!firebaseSession.utcDate,
    'utcDate format': firebaseSession.utcDate?.match(/^\d{4}-\d{2}-\d{2}$/),
    'has extensionSessionId': !!firebaseSession.extensionSessionId,
    'has timezone': !!firebaseSession.timezone
  };

  console.table(requiredUTCFields);
  
  const allValid = Object.values(requiredUTCFields).every(v => !!v);
  
  if (allValid) {
    console.log('✅ SUCCESS: Firebase session has all required UTC fields!');
    console.log(`🎯 startTimeUTC: ${firebaseSession.startTimeUTC}`);
    console.log(`📅 utcDate: ${firebaseSession.utcDate}`);
  } else {
    console.log('❌ FAILURE: Firebase session missing required UTC fields');
    console.log('📋 Current Firebase session:');
    console.table(firebaseSession);
  }
  
  return allValid;
}

// Export to global scope
window.testStartTimeUTCFix = testStartTimeUTCFix;
window.validateFirebaseSession = validateFirebaseSession;

console.log(`
🔧 startTimeUTC Fix Test Commands:

1. testStartTimeUTCFix()           - Check extension format and expectations
2. validateFirebaseSession(doc)    - Validate Firebase document after sync

Usage:
1. Run testStartTimeUTCFix()
2. Create/sync a session
3. Get Firebase document and run validateFirebaseSession(doc)
`);

// Auto-run test
testStartTimeUTCFix().then(result => {
  if (result.success) {
    console.log('🎉 Extension format validation passed!');
  } else {
    console.log('⚠️ Extension format needs attention:', result.reason);
  }
});