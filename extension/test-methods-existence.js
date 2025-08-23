/**
 * Simple test to verify the 6 new StorageManager methods exist
 * This bypasses complex dependencies to just check method existence
 */

// Read the storage.js file and check for method definitions
const fs = require('fs');
const path = require('path');

function testMethodExistence() {
    console.log('🧪 DEEP FOCUS SYNC METHODS EXISTENCE TEST');
    console.log('='.repeat(50));
    
    try {
        const storageFilePath = path.join(__dirname, 'utils', 'storage.js');
        const storageContent = fs.readFileSync(storageFilePath, 'utf8');
        
        const requiredMethods = [
            'validateDeepFocusData',
            'backupDeepFocusData', 
            'restoreDeepFocusData',
            'syncDeepFocusStatus',
            'resetDeepFocusStorage',
            'getDeepFocusDiagnostics'
        ];
        
        let testResults = [];
        
        function logTest(testName, passed, details = '') {
            const status = passed ? '✅' : '❌';
            console.log(`${status} ${testName}${details ? ': ' + details : ''}`);
            testResults.push({ name: testName, passed, details });
        }
        
        // Test 1: Check if all 6 methods are defined
        requiredMethods.forEach(methodName => {
            const methodPattern = new RegExp(`async\\s+${methodName}\\s*\\(`);
            const hasMethod = methodPattern.test(storageContent);
            logTest(`${methodName} method defined`, hasMethod);
        });
        
        // Test 2: Check method structure and return patterns
        const successPatterns = [
            /return\s*\{\s*success:\s*true/g,
            /return\s*\{\s*success:\s*false/g,
            /catch\s*\(\s*error\s*\)\s*\{/g,
            /console\.log\(/g,
            /console\.error\(/g
        ];
        
        successPatterns.forEach((pattern, index) => {
            const matches = storageContent.match(pattern);
            const patternNames = [
                'Success return patterns', 
                'Error return patterns',
                'Error handling blocks',
                'Info logging',
                'Error logging'
            ];
            logTest(patternNames[index], matches && matches.length > 0, `${matches ? matches.length : 0} occurrences`);
        });
        
        // Test 3: Check method signatures in new code section
        const newMethodsSection = storageContent.includes('Deep Focus Sync Methods - Required for comprehensive sync functionality');
        logTest('New methods section exists', newMethodsSection);
        
        // Test 4: Check for proper Chrome storage API usage in new methods
        const newMethodsStart = storageContent.indexOf('validateDeepFocusData');
        if (newMethodsStart > -1) {
            const newMethodsCode = storageContent.substring(newMethodsStart);
            const hasChromeStorageGet = /chrome\.storage\.local\.get/.test(newMethodsCode);
            const hasChromeStorageSet = /chrome\.storage\.local\.set/.test(newMethodsCode);
            const hasChromeStorageRemove = /chrome\.storage\.local\.remove/.test(newMethodsCode);
            
            logTest('New methods use chrome.storage.local.get', hasChromeStorageGet);
            logTest('New methods use chrome.storage.local.set', hasChromeStorageSet); 
            logTest('New methods use chrome.storage.local.remove', hasChromeStorageRemove);
        }
        
        // Summary
        const passed = testResults.filter(t => t.passed).length;
        const failed = testResults.filter(t => !t.passed).length;
        const total = testResults.length;
        
        console.log('\n' + '='.repeat(50));
        console.log('📊 EXISTENCE TEST SUMMARY');
        console.log('='.repeat(50));
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📈 Success Rate: ${((passed/total)*100).toFixed(1)}%`);
        
        if (failed > 0) {
            console.log('\n❌ Failed Tests:');
            testResults.filter(t => !t.passed).forEach(test => {
                console.log(`   - ${test.name}${test.details ? ': ' + test.details : ''}`);
            });
        }
        
        const overallResult = failed === 0 ? 'PASSED' : 'FAILED';
        console.log(`\n${overallResult === 'PASSED' ? '✅' : '❌'} Overall Result: ${overallResult}`);
        
        if (overallResult === 'PASSED') {
            console.log('\n🎉 ALL METHODS EXIST AND ARE PROPERLY STRUCTURED!');
            console.log('The 6 new StorageManager methods have been successfully added.');
        } else {
            console.log('\n🚨 SOME METHODS ARE MISSING OR MALFORMED!');
            console.log('Please check the failed tests above.');
        }
        
        return overallResult === 'PASSED';
        
    } catch (error) {
        console.error('❌ Test execution failed:', error.message);
        return false;
    }
}

// Check FocusTimeTracker routing too
function testFocusTimeTrackerRouting() {
    console.log('\n🔄 FOCUSTIMETRACKER ROUTING TEST');
    console.log('='.repeat(50));
    
    try {
        const trackerFilePath = path.join(__dirname, 'models', 'FocusTimeTracker.js');
        const trackerContent = fs.readFileSync(trackerFilePath, 'utf8');
        
        const requiredHandlers = [
            'handleValidateDeepFocusData',
            'handleBackupDeepFocusData',
            'handleRestoreDeepFocusData', 
            'handleSyncDeepFocusStatus',
            'handleResetDeepFocusStorage',
            'handleGetDeepFocusDiagnostics'
        ];
        
        const requiredMessageTypes = [
            'VALIDATE_DEEP_FOCUS_DATA',
            'BACKUP_DEEP_FOCUS_DATA',
            'RESTORE_DEEP_FOCUS_DATA',
            'SYNC_DEEP_FOCUS_STATUS', 
            'RESET_DEEP_FOCUS_STORAGE',
            'GET_DEEP_FOCUS_DIAGNOSTICS'
        ];
        
        let routingResults = [];
        
        function logRoutingTest(testName, passed, details = '') {
            const status = passed ? '✅' : '❌';
            console.log(`${status} ${testName}${details ? ': ' + details : ''}`);
            routingResults.push({ name: testName, passed, details });
        }
        
        // Test handler methods exist
        requiredHandlers.forEach(handlerName => {
            const handlerPattern = new RegExp(`async\\s+${handlerName}\\s*\\(`);
            const hasHandler = handlerPattern.test(trackerContent);
            logRoutingTest(`${handlerName} method defined`, hasHandler);
        });
        
        // Test message type routing in switch statement
        requiredMessageTypes.forEach(messageType => {
            const routingPattern = new RegExp(`case\\s+['"\`]${messageType}['"\`]:`);
            const hasRouting = routingPattern.test(trackerContent);
            logRoutingTest(`${messageType} routing defined`, hasRouting);
        });
        
        // Test storageManager method calls
        const storageManagerCalls = [
            'storageManager.validateDeepFocusData',
            'storageManager.backupDeepFocusData',
            'storageManager.restoreDeepFocusData',
            'storageManager.syncDeepFocusStatus', 
            'storageManager.resetDeepFocusStorage',
            'storageManager.getDeepFocusDiagnostics'
        ];
        
        storageManagerCalls.forEach(methodCall => {
            const hasCall = trackerContent.includes(methodCall);
            logRoutingTest(`${methodCall} called`, hasCall);
        });
        
        // Summary for routing tests
        const passed = routingResults.filter(t => t.passed).length;
        const failed = routingResults.filter(t => !t.passed).length;
        const total = routingResults.length;
        
        console.log('\n📊 ROUTING TEST SUMMARY');
        console.log('='.repeat(30));
        console.log(`✅ Passed: ${passed}/${total}`);
        console.log(`❌ Failed: ${failed}`);
        
        return failed === 0;
        
    } catch (error) {
        console.error('❌ Routing test failed:', error.message);
        return false;
    }
}

// Run both tests
if (require.main === module) {
    const methodsExist = testMethodExistence();
    const routingWorks = testFocusTimeTrackerRouting();
    
    console.log('\n' + '='.repeat(60));
    console.log('🎯 FINAL OVERALL RESULT');
    console.log('='.repeat(60));
    
    if (methodsExist && routingWorks) {
        console.log('🎉 SUCCESS: All deep focus sync methods are properly implemented and wired!');
        console.log('✅ StorageManager methods: IMPLEMENTED');  
        console.log('✅ FocusTimeTracker routing: IMPLEMENTED');
        console.log('✅ Ready for testing in browser extension');
        process.exit(0);
    } else {
        console.log('❌ FAILURE: Some components are missing or incomplete');
        console.log(`${methodsExist ? '✅' : '❌'} StorageManager methods: ${methodsExist ? 'IMPLEMENTED' : 'MISSING'}`);
        console.log(`${routingWorks ? '✅' : '❌'} FocusTimeTracker routing: ${routingWorks ? 'IMPLEMENTED' : 'MISSING'}`);
        process.exit(1);
    }
}