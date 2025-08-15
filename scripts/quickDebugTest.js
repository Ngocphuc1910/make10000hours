#!/usr/bin/env node

/**
 * Quick debug script for timer session preservation fix
 * 
 * This script provides manual testing steps and validates the fix
 * by checking the actual code implementation.
 * 
 * Usage: node scripts/quickDebugTest.js
 */

const fs = require('fs');
const path = require('path');

console.log(`
🔍 QUICK TIMER FIX DEBUG & VALIDATION
====================================

This script validates the code fix and provides manual testing steps.
`);

function validateCodeFix() {
  console.log('📋 STEP 1: Validating code implementation...\n');
  
  const timerStorePath = path.join(__dirname, '../src/store/timerStore.ts');
  
  if (!fs.existsSync(timerStorePath)) {
    console.log('❌ timerStore.ts not found!');
    return false;
  }
  
  const code = fs.readFileSync(timerStorePath, 'utf8');
  
  // Check for key fix components
  const checks = [
    {
      name: 'Recovery flag declaration',
      pattern: /let isRecoveringSession = false/,
      required: true
    },
    {
      name: 'Device ownership check',
      pattern: /const currentDeviceId = timerService\.getDeviceId\(\)/,
      required: true
    },
    {
      name: 'shouldYieldToRemoteDevice logic',
      pattern: /const shouldYieldToRemoteDevice = remoteState\.activeDeviceId/,
      required: true
    },
    {
      name: 'shouldPreserveSession logic',
      pattern: /const shouldPreserveSession = currentState\.isRunning/,
      required: true
    },
    {
      name: 'Session preservation in set()',
      pattern: /activeSession: shouldPreserveSession \? currentState\.activeSession : null/,
      required: true
    },
    {
      name: 'Session recovery in tick()',
      pattern: /if \(isRunning && mode === 'pomodoro' && currentTask && !activeSession && !isRecoveringSession\)/,
      required: true
    },
    {
      name: 'Sync preservation log',
      pattern: /console\.log\('🔄 Sync preserving active session/,
      required: true
    },
    {
      name: 'Background sync log',
      pattern: /console\.log\('📡 Background sync starting/,
      required: true
    },
    {
      name: 'Minute boundary device log',
      pattern: /deviceId: timerService\.getDeviceId\(\)/,
      required: true
    }
  ];
  
  let allPassed = true;
  
  checks.forEach(check => {
    const found = check.pattern.test(code);
    const status = found ? '✅' : '❌';
    console.log(`   ${status} ${check.name}`);
    
    if (check.required && !found) {
      allPassed = false;
    }
  });
  
  console.log(`\n🏆 Code validation: ${allPassed ? 'PASSED ✅' : 'FAILED ❌'}\n`);
  
  if (allPassed) {
    console.log('All required fix components are present in the code.');
  } else {
    console.log('Some required fix components are missing!');
  }
  
  return allPassed;
}

function printManualTestSteps() {
  console.log(`📋 STEP 2: Manual testing steps to verify the fix

🌐 OPEN YOUR APP IN BROWSER:
   1. Go to http://localhost:5173 (or your dev server URL)
   2. Open browser DevTools Console (F12)
   3. Make sure you're logged in

🎯 START TIMER TEST:
   4. Select a task or create a new one
   5. Start the Pomodoro timer
   6. Wait for 2-3 minutes
   7. Look for these logs in console:
      - "🔄 Minute boundary:" (should appear every minute)

🔄 SYNC TEST (THE CRITICAL TEST):
   8. After 5+ minutes, you should see:
      - "📡 Background sync starting (5-min interval)"
      - "🔄 Sync preserving active session (this device owns it)"
   
   OR force sync manually in console:
   \`\`\`javascript
   // In browser console, run:
   const userId = useUserStore.getState().user.uid;
   timerService.loadTimerState(userId).then(remoteState => {
     if (remoteState) {
       console.log('🔄 Forcing sync...');
       useTimerStore.getState().syncFromRemoteState(remoteState);
     }
   });
   \`\`\`

✅ SUCCESS INDICATORS:
   - Timer continues running after sync
   - "🔄 Minute boundary:" logs continue appearing
   - Work session in Firestore shows increasing duration
   - No "⚠️ Active session lost" errors

❌ FAILURE INDICATORS:
   - Timer UI still shows but minute boundaries stop
   - Work session duration stops incrementing
   - "⚠️ Active session lost - starting recovery" appears

🧪 MULTI-TAB TEST:
   9. Open a second tab with the same app
   10. Verify original tab still works
   11. Check for device ownership logs

🔍 DATABASE VERIFICATION:
   12. Check Firestore console
   13. Find your work session document
   14. Verify 'duration' field increases over time
   15. Session should have status: "active"
`);
}

function printDebuggingCommands() {
  console.log(`🛠️ STEP 3: Browser console debugging commands

// Check current timer state
console.log('Timer State:', useTimerStore.getState());

// Check if session is preserved
const state = useTimerStore.getState();
console.log('Session preserved:', {
  isRunning: state.isRunning,
  hasActiveSession: !!state.activeSession,
  sessionId: state.activeSession?.sessionId,
  lastCountedMinute: state.lastCountedMinute
});

// Force a sync to test preservation
const userId = useUserStore.getState().user.uid;
console.log('Forcing sync test...');
timerService.loadTimerState(userId).then(remoteState => {
  console.log('Before sync:', {
    activeSession: useTimerStore.getState().activeSession?.sessionId,
    lastMinute: useTimerStore.getState().lastCountedMinute
  });
  
  useTimerStore.getState().syncFromRemoteState(remoteState).then(() => {
    console.log('After sync:', {
      activeSession: useTimerStore.getState().activeSession?.sessionId,
      lastMinute: useTimerStore.getState().lastCountedMinute
    });
  });
});

// Monitor minute boundaries
let boundaryCount = 0;
const originalLog = console.log;
console.log = function(...args) {
  if (args[0] && args[0].includes('🔄 Minute boundary:')) {
    boundaryCount++;
    originalLog('BOUNDARY COUNT:', boundaryCount, ...args);
  } else {
    originalLog(...args);
  }
};

// Reset recovery flag if stuck
isRecoveringSession = false; // Run this if session recovery seems stuck
`);
}

function main() {
  // Validate the code fix
  const codeValid = validateCodeFix();
  
  if (!codeValid) {
    console.log('❌ Code validation failed. The fix may not be properly implemented.');
    process.exit(1);
  }
  
  // Print manual testing steps
  printManualTestSteps();
  
  // Print debugging commands
  printDebuggingCommands();
  
  console.log(`
🏁 SUMMARY:
-----------
✅ Code fix validation: PASSED
📋 Manual testing steps: PROVIDED ABOVE
🛠️ Debugging commands: PROVIDED ABOVE

The fix appears to be correctly implemented in the code.
Follow the manual testing steps to verify it works in practice.

🔑 KEY THING TO WATCH FOR:
After sync occurs (~5 minutes), the minute boundary logs should 
continue appearing every minute. If they stop, the bug isn't fixed.

💡 TIP: Keep the browser console open and watch for the logs!
`);
}

if (require.main === module) {
  main();
}

module.exports = { validateCodeFix, printManualTestSteps };