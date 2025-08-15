#!/usr/bin/env node

/**
 * Debug script to verify timer session preservation fix
 * 
 * This script tests the core fix that prevents syncFromRemoteState from
 * resetting activeSession and lastCountedMinute during background sync.
 * 
 * Usage: node scripts/debugTimerFix.js
 */

console.log(`
🔍 TIMER SESSION PRESERVATION DEBUG SCRIPT
==========================================

This script will verify that the timer fix is working correctly.
Make sure your app is running on http://localhost:5173 first.

Testing the fix for: syncFromRemoteState destroying session state
`);

const puppeteer = require('puppeteer');

async function debugTimerFix() {
  let browser;
  
  try {
    console.log('🚀 Launching browser...');
    browser = await puppeteer.launch({ 
      headless: false, 
      devtools: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Enable console logging from the page
    page.on('console', msg => {
      const text = msg.text();
      // Only show our debug logs
      if (text.includes('🔄') || text.includes('📡') || text.includes('⚠️') || text.includes('✅')) {
        console.log(`[BROWSER] ${text}`);
      }
    });

    console.log('🌐 Navigating to app...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
    
    console.log('⏳ Waiting for app to initialize...');
    await page.waitForTimeout(3000);
    
    // Check if user is logged in
    console.log('🔐 Checking authentication...');
    const isLoggedIn = await page.evaluate(() => {
      return !!window.useUserStore?.getState?.()?.user;
    });
    
    if (!isLoggedIn) {
      console.log('❌ User not authenticated. Please log in first and rerun the script.');
      return;
    }
    
    console.log('✅ User authenticated. Starting timer test...');
    
    // Step 1: Check initial state
    console.log('\n📊 STEP 1: Checking initial timer state');
    const initialState = await page.evaluate(() => {
      const timerStore = window.useTimerStore?.getState?.();
      return {
        isRunning: timerStore?.isRunning || false,
        activeSession: !!timerStore?.activeSession,
        currentTask: !!timerStore?.currentTask
      };
    });
    
    console.log(`Initial state: Running=${initialState.isRunning}, Session=${initialState.activeSession}, Task=${initialState.currentTask}`);
    
    if (initialState.isRunning) {
      console.log('⏹️ Timer is already running. Stopping it first...');
      await page.evaluate(() => {
        const timerStore = window.useTimerStore?.getState?.();
        if (timerStore?.pause) timerStore.pause();
      });
      await page.waitForTimeout(1000);
    }
    
    // Step 2: Start timer with a task
    console.log('\n🎯 STEP 2: Starting timer with a task');
    const startResult = await page.evaluate(async () => {
      const taskStore = window.useTaskStore?.getState?.();
      const timerStore = window.useTimerStore?.getState?.();
      
      // Find a task or create a test task
      let task = taskStore?.tasks?.[0];
      if (!task || taskStore.tasks.length === 0) {
        console.log('Creating test task...');
        const taskId = await taskStore?.addTask?.({
          text: 'Debug Timer Test Task',
          projectId: 'no-project',
          status: 'pomodoro'
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
        task = taskStore?.tasks?.find(t => t.id === taskId) || taskStore?.tasks?.[0];
      }
      
      if (!task) {
        return { success: false, error: 'No task available' };
      }
      
      // Set current task and start timer
      await timerStore?.setCurrentTask?.(task);
      await new Promise(resolve => setTimeout(resolve, 500));
      await timerStore?.start?.();
      
      const state = timerStore;
      return {
        success: true,
        taskId: task.id,
        isRunning: state?.isRunning,
        activeSession: !!state?.activeSession,
        sessionId: state?.activeSession?.sessionId || state?.activeSession?.id,
        lastCountedMinute: state?.lastCountedMinute,
        deviceId: window.timerService?.getDeviceId?.()
      };
    });
    
    if (!startResult.success) {
      console.log(`❌ Failed to start timer: ${startResult.error}`);
      return;
    }
    
    console.log(`✅ Timer started successfully!`);
    console.log(`   Task ID: ${startResult.taskId}`);
    console.log(`   Session ID: ${startResult.sessionId}`);
    console.log(`   Device ID: ${startResult.deviceId}`);
    console.log(`   Is Running: ${startResult.isRunning}`);
    console.log(`   Active Session: ${startResult.activeSession}`);
    console.log(`   Last Counted Minute: ${startResult.lastCountedMinute}`);
    
    // Step 3: Wait for timer to run for a bit
    console.log('\n⏰ STEP 3: Letting timer run for 2 minutes to establish session...');
    console.log('(Watch for minute boundary logs in browser console)');
    
    let tickCount = 0;
    for (let i = 0; i < 120; i++) { // 2 minutes
      await page.waitForTimeout(1000);
      tickCount++;
      if (tickCount % 30 === 0) {
        console.log(`   Timer running for ${tickCount} seconds...`);
      }
    }
    
    // Step 4: Check state before forcing sync
    console.log('\n📊 STEP 4: Checking state before sync test');
    const preSync = await page.evaluate(() => {
      const state = window.useTimerStore?.getState?.();
      return {
        isRunning: state?.isRunning,
        activeSession: !!state?.activeSession,
        sessionId: state?.activeSession?.sessionId || state?.activeSession?.id,
        lastCountedMinute: state?.lastCountedMinute,
        currentTime: state?.currentTime
      };
    });
    
    console.log(`Pre-sync state: Running=${preSync.isRunning}, Session=${preSync.activeSession}, LastMinute=${preSync.lastCountedMinute}, Time=${preSync.currentTime}s`);
    
    if (!preSync.activeSession) {
      console.log('❌ Session was lost before sync test. The issue may not be fully fixed.');
      return;
    }
    
    // Step 5: Force a sync operation
    console.log('\n🔄 STEP 5: Forcing sync operation (this is the critical test!)');
    console.log('Watch for sync preservation logs...');
    
    const syncResult = await page.evaluate(async () => {
      try {
        const timerStore = window.useTimerStore?.getState?.();
        const userStore = window.useUserStore?.getState?.();
        
        if (!userStore?.user?.uid) {
          return { success: false, error: 'No user ID' };
        }
        
        console.log('🔄 About to trigger syncFromRemoteState...');
        
        // Load timer state from remote and trigger sync
        const timerService = window.timerService;
        if (timerService?.loadTimerState) {
          const remoteState = await timerService.loadTimerState(userStore.user.uid);
          if (remoteState && timerStore?.syncFromRemoteState) {
            await timerStore.syncFromRemoteState(remoteState);
            return { success: true, remoteState: !!remoteState };
          }
        }
        
        return { success: false, error: 'Sync methods not available' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    if (!syncResult.success) {
      console.log(`❌ Sync operation failed: ${syncResult.error}`);
    } else {
      console.log('✅ Sync operation completed');
    }
    
    // Step 6: Check state after sync
    console.log('\n📊 STEP 6: Checking state after sync (THE CRITICAL CHECK!)');
    
    await page.waitForTimeout(1000); // Wait for sync to complete
    
    const postSync = await page.evaluate(() => {
      const state = window.useTimerStore?.getState?.();
      return {
        isRunning: state?.isRunning,
        activeSession: !!state?.activeSession,
        sessionId: state?.activeSession?.sessionId || state?.activeSession?.id,
        lastCountedMinute: state?.lastCountedMinute,
        currentTime: state?.currentTime
      };
    });
    
    console.log(`Post-sync state: Running=${postSync.isRunning}, Session=${postSync.activeSession}, LastMinute=${postSync.lastCountedMinute}, Time=${postSync.currentTime}s`);
    
    // Step 7: Analyze results
    console.log('\n🔍 STEP 7: ANALYSIS');
    
    const sessionPreserved = preSync.activeSession && postSync.activeSession && preSync.sessionId === postSync.sessionId;
    const minutePreserved = preSync.lastCountedMinute === postSync.lastCountedMinute;
    const timerStillRunning = postSync.isRunning;
    
    console.log(`   Session preserved: ${sessionPreserved ? '✅' : '❌'} (${preSync.sessionId} -> ${postSync.sessionId})`);
    console.log(`   Minute tracking preserved: ${minutePreserved ? '✅' : '❌'} (${preSync.lastCountedMinute} -> ${postSync.lastCountedMinute})`);
    console.log(`   Timer still running: ${timerStillRunning ? '✅' : '❌'}`);
    
    // Final verdict
    console.log('\n🏆 FINAL VERDICT:');
    if (sessionPreserved && minutePreserved && timerStillRunning) {
      console.log('✅ SUCCESS! The timer session preservation fix is working correctly!');
      console.log('   - Session state survived the sync operation');
      console.log('   - Minute boundary tracking preserved');
      console.log('   - Timer continues running');
      console.log('\nThe original bug (syncFromRemoteState destroying session state) appears to be FIXED! 🎉');
    } else {
      console.log('❌ FAILURE! The fix is not working correctly:');
      if (!sessionPreserved) console.log('   - Session was lost during sync');
      if (!minutePreserved) console.log('   - Minute tracking was reset');
      if (!timerStillRunning) console.log('   - Timer stopped running');
      console.log('\nThe syncFromRemoteState bug may still be present.');
    }
    
    // Step 8: Continue monitoring
    console.log('\n⏰ STEP 8: Monitoring for 3 more minutes to verify continuous operation...');
    for (let i = 0; i < 180; i++) { // 3 minutes
      await page.waitForTimeout(1000);
      if (i % 60 === 0 && i > 0) {
        const currentState = await page.evaluate(() => {
          const state = window.useTimerStore?.getState?.();
          return {
            isRunning: state?.isRunning,
            activeSession: !!state?.activeSession,
            currentTime: state?.currentTime
          };
        });
        console.log(`   After ${i/60} more minutes: Running=${currentState.isRunning}, Session=${currentState.activeSession}, Time=${currentState.currentTime}s`);
      }
    }
    
    console.log('\n🏁 Test completed! Check the browser console for detailed logs.');
    console.log('Key logs to look for:');
    console.log('   - "📡 Background sync starting (5-min interval)"');
    console.log('   - "🔄 Sync preserving active session (this device owns it)"');
    console.log('   - "🔄 Minute boundary:" logs');
    
  } catch (error) {
    console.error('❌ Script error:', error.message);
  } finally {
    if (browser) {
      console.log('\nKeeping browser open for manual inspection...');
      console.log('Close the browser when you\'re done analyzing the logs.');
      // Don't close automatically: await browser.close();
    }
  }
}

// Check if running directly
if (require.main === module) {
  console.log('Prerequisites:');
  console.log('1. Make sure your app is running on http://localhost:5173');
  console.log('2. Make sure you are logged in');
  console.log('3. Make sure you have puppeteer installed: npm install puppeteer');
  console.log('');
  
  debugTimerFix().catch(console.error);
}

module.exports = { debugTimerFix };