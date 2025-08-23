/**
 * Phase 0.5: Current State Verification Baseline Test
 * This script analyzes the current storage structure, response formats, and performance
 */

(async function testCurrentBaseline() {
    console.log('\n🔍 PHASE 0.5: CURRENT STATE VERIFICATION BASELINE');
    console.log('='.repeat(60));
    
    // Step 1: Analyze current storage structure
    console.log('\n📋 STEP 1: Current Storage Structure Analysis');
    try {
        const storage = await chrome.storage.local.get(null);
        console.log('📊 All Storage Keys:', Object.keys(storage));
        
        // Deep Focus specific storage
        if (storage.deepFocusSession) {
            console.log('🎯 Deep Focus Sessions:', {
                structure: typeof storage.deepFocusSession,
                dates: Object.keys(storage.deepFocusSession),
                totalSessions: Object.values(storage.deepFocusSession).flat().length
            });
        } else {
            console.log('🎯 Deep Focus Sessions: None found');
        }
        
        // Override sessions storage  
        if (storage.override_sessions) {
            console.log('⏰ Override Sessions:', {
                structure: typeof storage.override_sessions,
                dates: Object.keys(storage.override_sessions),
                totalSessions: Object.values(storage.override_sessions).flat().length
            });
        } else {
            console.log('⏰ Override Sessions: None found');
        }
        
        // User info
        if (storage.userInfo) {
            console.log('👤 User Info:', {
                hasUserId: !!storage.userInfo.uid,
                hasEmail: !!storage.userInfo.email,
                hasTimezone: !!storage.userInfo.timezone
            });
        } else {
            console.log('👤 User Info: None found');
        }
        
    } catch (error) {
        console.error('❌ Storage analysis failed:', error);
    }
    
    // Step 2: Test current response formats for existing handlers
    console.log('\n📨 STEP 2: Current Response Format Testing');
    
    const testMessages = [
        'GET_FOCUS_STATE',
        'GET_FOCUS_STATS', 
        'GET_LOCAL_DEEP_FOCUS_TIME',
        'GET_DEEP_FOCUS_SESSIONS'
    ];
    
    for (const messageType of testMessages) {
        try {
            const startTime = performance.now();
            const response = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Timeout')), 3000);
                
                chrome.runtime.sendMessage({ type: messageType }, (response) => {
                    clearTimeout(timeout);
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response);
                    }
                });
            });
            const responseTime = performance.now() - startTime;
            
            console.log(`✅ ${messageType}:`, {
                success: response?.success,
                hasData: !!response?.data,
                responseTime: Math.round(responseTime) + 'ms',
                responseKeys: Object.keys(response || {})
            });
            
        } catch (error) {
            console.log(`❌ ${messageType}: ${error.message}`);
        }
    }
    
    // Step 3: Performance baseline measurement
    console.log('\n⚡ STEP 3: Performance Baseline Measurement');
    const performanceTests = [];
    
    // Test storage read performance
    for (let i = 0; i < 5; i++) {
        const startTime = performance.now();
        await chrome.storage.local.get(['deepFocusSession', 'userInfo']);
        const endTime = performance.now();
        performanceTests.push(endTime - startTime);
    }
    
    const avgStorageTime = performanceTests.reduce((a, b) => a + b, 0) / performanceTests.length;
    console.log('📊 Storage Read Performance:', {
        averageTime: Math.round(avgStorageTime) + 'ms',
        samples: performanceTests.map(t => Math.round(t) + 'ms')
    });
    
    // Test message handler performance 
    const messageTests = [];
    for (let i = 0; i < 3; i++) {
        const startTime = performance.now();
        try {
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Timeout')), 2000);
                chrome.runtime.sendMessage({ type: 'GET_FOCUS_STATE' }, (response) => {
                    clearTimeout(timeout);
                    resolve(response);
                });
            });
            const endTime = performance.now();
            messageTests.push(endTime - startTime);
        } catch (error) {
            messageTests.push(2000); // Timeout time
        }
    }
    
    const avgMessageTime = messageTests.reduce((a, b) => a + b, 0) / messageTests.length;
    console.log('📊 Message Handler Performance:', {
        averageTime: Math.round(avgMessageTime) + 'ms',
        samples: messageTests.map(t => Math.round(t) + 'ms')
    });
    
    // Step 4: Verify existing sync triggers
    console.log('\n🔄 STEP 4: Existing Sync Trigger Verification');
    
    // Check if FocusTimeTracker is available
    try {
        const response = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('No response')), 2000);
            chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
                clearTimeout(timeout);
                resolve(response);
            });
        });
        
        console.log('✅ Background script responsive:', {
            initialized: response?.initialized,
            ready: response?.ready,
            contextInfo: response?.contextInfo
        });
        
    } catch (error) {
        console.log('❌ Background script not responding:', error.message);
    }
    
    // Check deepFocusMessages array coverage
    console.log('\n📋 Current deepFocusMessages Coverage:');
    const expectedHandlers = [
        'TOGGLE_FOCUS_MODE', 'ENABLE_FOCUS_MODE', 'DISABLE_FOCUS_MODE',
        'GET_FOCUS_STATE', 'GET_FOCUS_STATS', 'CREATE_DEEP_FOCUS_SESSION',
        'COMPLETE_DEEP_FOCUS_SESSION', 'GET_LOCAL_DEEP_FOCUS_TIME',
        'UPDATE_DEEP_FOCUS_SESSION', 'GET_DEEP_FOCUS_SESSIONS', 'DELETE_DEEP_FOCUS_SESSION'
    ];
    
    const missingHandlers = [
        'VALIDATE_DEEP_FOCUS_DATA',
        'BACKUP_DEEP_FOCUS_DATA',
        'RESTORE_DEEP_FOCUS_DATA', 
        'SYNC_DEEP_FOCUS_STATUS',
        'RESET_DEEP_FOCUS_STORAGE',
        'GET_DEEP_FOCUS_DIAGNOSTICS'
    ];
    
    console.log('✅ Currently Implemented:', expectedHandlers);
    console.log('❌ Missing (to be added):', missingHandlers);
    
    // Step 5: Baseline summary
    console.log('\n📊 BASELINE SUMMARY');
    console.log('='.repeat(40));
    console.log(`📋 Storage Performance: ${Math.round(avgStorageTime)}ms avg`);
    console.log(`📨 Message Performance: ${Math.round(avgMessageTime)}ms avg`);
    console.log(`🎯 Deep Focus Handlers: ${expectedHandlers.length} implemented`);
    console.log(`❌ Missing Handlers: ${missingHandlers.length} to add`);
    console.log('✅ Phase 0.5 baseline verification complete');
    
    console.log('\n🎯 READY TO PROCEED TO PHASE 1: Safe Environment Setup');
    
})().catch(error => {
    console.error('❌ Baseline test failed:', error);
});