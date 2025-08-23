/**
 * Phase 2: StorageManager Validation Methods Unit Tests
 * Tests all 6 new validation methods individually
 */

(async function testStorageManagerValidation() {
    console.log('\n🧪 PHASE 2: STORAGEMANAGER VALIDATION METHODS TESTS');
    console.log('='.repeat(60));
    
    let storageManager;
    let testResults = {
        passed: 0,
        failed: 0,
        errors: []
    };
    
    function logTest(testName, passed, details = '') {
        const status = passed ? '✅' : '❌';
        console.log(`${status} ${testName}${details ? ': ' + details : ''}`);
        if (passed) {
            testResults.passed++;
        } else {
            testResults.failed++;
            testResults.errors.push(testName);
        }
    }
    
    try {
        // Initialize StorageManager
        console.log('\n📋 STEP 1: Initialize StorageManager');
        storageManager = new StorageManager();
        await storageManager.initialize();
        logTest('StorageManager initialization', !!storageManager.initialized);
        
        // Set up test data
        console.log('\n📋 STEP 2: Set up test data');
        const testUserInfo = {
            uid: 'test-user-123',
            email: 'test@example.com',
            timezone: 'America/New_York'
        };
        
        const testSession = {
            id: 'test-session-123',
            userId: 'test-user-123',
            startTime: Date.now() - 3600000, // 1 hour ago
            startTimeUTC: new Date(Date.now() - 3600000).toISOString(),
            timezone: 'America/New_York',
            utcDate: new Date().toISOString().split('T')[0],
            duration: 30,
            status: 'completed',
            createdAt: Date.now() - 3600000,
            updatedAt: Date.now()
        };
        
        await chrome.storage.local.set({
            userInfo: testUserInfo,
            deepFocusSession: {
                [testSession.utcDate]: [testSession]
            }
        });
        
        logTest('Test data setup', true);
        
        // Test 1: validateDeepFocusData
        console.log('\n🔍 STEP 3: Test VALIDATE_DEEP_FOCUS_DATA');
        try {
            const validationResult = await storageManager.validateDeepFocusData();
            logTest('validateDeepFocusData returns result', !!validationResult);
            logTest('validateDeepFocusData has success field', 'success' in validationResult);
            logTest('validateDeepFocusData has validation field', !!validationResult.validation);
            logTest('Validation finds sessions', validationResult.validation.stats?.totalSessions > 0);
            
            console.log('   📊 Validation Stats:', validationResult.validation.stats);
        } catch (error) {
            logTest('validateDeepFocusData', false, error.message);
        }
        
        // Test 2: backupDeepFocusData
        console.log('\n💾 STEP 4: Test BACKUP_DEEP_FOCUS_DATA');
        let backupKey = null;
        try {
            const backupResult = await storageManager.backupDeepFocusData();
            logTest('backupDeepFocusData returns result', !!backupResult);
            logTest('backupDeepFocusData successful', backupResult.success);
            logTest('backupDeepFocusData has backupKey', !!backupResult.backupKey);
            
            backupKey = backupResult.backupKey;
            
            // Verify backup was stored
            const storage = await chrome.storage.local.get([backupKey]);
            logTest('Backup stored in chrome storage', !!storage[backupKey]);
            
            console.log('   💾 Backup Key:', backupKey);
        } catch (error) {
            logTest('backupDeepFocusData', false, error.message);
        }
        
        // Test 3: getSyncDeepFocusStatus
        console.log('\n📊 STEP 5: Test SYNC_DEEP_FOCUS_STATUS');
        try {
            const statusResult = await storageManager.getSyncDeepFocusStatus();
            logTest('getSyncDeepFocusStatus returns result', !!statusResult);
            logTest('getSyncDeepFocusStatus successful', statusResult.success);
            logTest('getSyncDeepFocusStatus has status field', !!statusResult.status);
            logTest('Status recognizes user authentication', statusResult.status.userAuthenticated);
            
            console.log('   📊 Sync Status:', {
                ready: statusResult.status.ready,
                userAuthenticated: statusResult.status.userAuthenticated,
                pendingSessions: statusResult.status.pendingSessions
            });
        } catch (error) {
            logTest('getSyncDeepFocusStatus', false, error.message);
        }
        
        // Test 4: getDeepFocusDiagnostics
        console.log('\n🔧 STEP 6: Test GET_DEEP_FOCUS_DIAGNOSTICS');
        try {
            const diagnosticsResult = await storageManager.getDeepFocusDiagnostics();
            logTest('getDeepFocusDiagnostics returns result', !!diagnosticsResult);
            logTest('getDeepFocusDiagnostics successful', diagnosticsResult.success);
            logTest('getDeepFocusDiagnostics has diagnostics field', !!diagnosticsResult.diagnostics);
            logTest('Diagnostics includes performance data', !!diagnosticsResult.diagnostics.performance);
            logTest('Diagnostics includes session data', !!diagnosticsResult.diagnostics.sessions);
            
            console.log('   🔧 Diagnostics Summary:', {
                totalSessions: diagnosticsResult.diagnostics.sessions.total,
                storageKeys: diagnosticsResult.diagnostics.storage.total,
                performanceMs: Math.round(diagnosticsResult.diagnostics.performance.diagnosticsGenerationTime)
            });
        } catch (error) {
            logTest('getDeepFocusDiagnostics', false, error.message);
        }
        
        // Test 5: restoreDeepFocusData (if we have a backup)
        console.log('\n🔄 STEP 7: Test RESTORE_DEEP_FOCUS_DATA');
        if (backupKey) {
            try {
                const restoreResult = await storageManager.restoreDeepFocusData(backupKey);
                logTest('restoreDeepFocusData returns result', !!restoreResult);
                logTest('restoreDeepFocusData successful', restoreResult.success);
                logTest('restoreDeepFocusData includes verification', !!restoreResult.verification);
                
                console.log('   🔄 Restore Result:', {
                    restored: restoreResult.success,
                    backupUsed: restoreResult.restoredFrom,
                    verification: restoreResult.verification.success
                });
            } catch (error) {
                logTest('restoreDeepFocusData', false, error.message);
            }
        } else {
            logTest('restoreDeepFocusData', false, 'No backup available to test restore');
        }
        
        // Test 6: resetDeepFocusStorage (CAREFUL - requires confirmation key)
        console.log('\n🔄 STEP 8: Test RESET_DEEP_FOCUS_STORAGE (validation only)');
        try {
            // Test without confirmation key (should fail safely)
            const resetResult = await storageManager.resetDeepFocusStorage({
                createBackup: true,
                resetUserInfo: false
            });
            
            logTest('resetDeepFocusStorage without confirmation fails safely', !resetResult.success);
            logTest('resetDeepFocusStorage returns proper error', resetResult.error?.includes('confirmation key'));
            
            console.log('   🔄 Reset safely rejected (as expected)');
            
        } catch (error) {
            logTest('resetDeepFocusStorage error handling', false, error.message);
        }
        
        // Performance Testing
        console.log('\n⚡ STEP 9: Performance Testing');
        const performanceTests = [];
        
        for (let i = 0; i < 3; i++) {
            const start = performance.now();
            await storageManager.validateDeepFocusData();
            const end = performance.now();
            performanceTests.push(end - start);
        }
        
        const avgTime = performanceTests.reduce((a, b) => a + b, 0) / performanceTests.length;
        logTest('Validation performance acceptable', avgTime < 1000, `${Math.round(avgTime)}ms avg`);
        
        console.log('   ⚡ Performance Results:', performanceTests.map(t => Math.round(t) + 'ms'));
        
    } catch (error) {
        console.error('❌ Test suite failed:', error);
        testResults.failed++;
        testResults.errors.push('Test suite execution: ' + error.message);
    }
    
    // Final Results
    console.log('\n📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(40));
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📈 Success Rate: ${Math.round((testResults.passed / (testResults.passed + testResults.failed)) * 100)}%`);
    
    if (testResults.errors.length > 0) {
        console.log('\n❌ Failed Tests:');
        testResults.errors.forEach(error => console.log(`   - ${error}`));
    }
    
    const overallSuccess = testResults.failed === 0;
    console.log(`\n${overallSuccess ? '✅' : '❌'} Overall Result: ${overallSuccess ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
    
    if (overallSuccess) {
        console.log('🎯 Ready to proceed to Phase 3: Message Handler Implementation');
    }
    
    return overallSuccess;
    
})().catch(error => {
    console.error('❌ Storage Manager validation test failed:', error);
});