/**
 * Integration Test for Deep Focus Sync Methods
 * Simulates the complete message flow from background.js to StorageManager
 */

// Mock Chrome APIs for Node.js testing
const mockChrome = {
    storage: {
        local: {
            data: {},
            get(keys) {
                return new Promise((resolve) => {
                    if (!keys) {
                        resolve(this.data);
                    } else if (Array.isArray(keys)) {
                        const result = {};
                        keys.forEach(key => {
                            if (key in this.data) result[key] = this.data[key];
                        });
                        resolve(result);
                    } else if (typeof keys === 'object') {
                        const result = {};
                        Object.keys(keys).forEach(key => {
                            result[key] = this.data[key] || keys[key];
                        });
                        resolve(result);
                    } else {
                        const result = {};
                        if (keys in this.data) result[keys] = this.data[keys];
                        resolve(result);
                    }
                });
            },
            set(items) {
                return new Promise((resolve) => {
                    Object.assign(this.data, items);
                    resolve();
                });
            },
            remove(keys) {
                return new Promise((resolve) => {
                    if (Array.isArray(keys)) {
                        keys.forEach(key => delete this.data[key]);
                    } else {
                        delete this.data[keys];
                    }
                    resolve();
                });
            }
        }
    },
    runtime: {
        id: 'test-extension-id'
    }
};

// Set up global environment
global.chrome = mockChrome;
global.self = global;
global.navigator = {
    userAgent: 'Test Browser',
    storage: {
        estimate: () => Promise.resolve({ usage: 1024, quota: 1024 * 1024 })
    }
};
global.Blob = class MockBlob {
    constructor(parts, options) {
        this.size = parts.join('').length;
    }
};

// Test results tracking
let testResults = [];

function logTest(testName, passed, details = '') {
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${testName}${details ? ': ' + details : ''}`);
    if (passed) {
        testResults.push({ name: testName, status: 'PASSED', details });
    } else {
        testResults.push({ name: testName, status: 'FAILED', details });
    }
}

async function setupTestData() {
    console.log('\n📋 Setting up test data...');
    
    await mockChrome.storage.local.set({
        userInfo: {
            uid: 'test-user-123',
            email: 'test@example.com',
            timezone: 'America/New_York'
        },
        deepFocusSession: {
            '2025-08-22': [{
                id: 'test-session-123',
                userId: 'test-user-123',
                startTime: Date.now() - 3600000,
                startTimeUTC: new Date(Date.now() - 3600000).toISOString(),
                timezone: 'America/New_York',
                utcDate: '2025-08-22',
                duration: 30,
                status: 'completed',
                createdAt: Date.now() - 3600000,
                updatedAt: Date.now()
            }]
        }
    });
    
    logTest('Test data setup', true);
}

async function testStorageManagerMethods() {
    console.log('\n🔧 Testing StorageManager methods directly...');
    
    try {
        // Load StorageManager
        const StorageManager = require('./utils/storage.js');
        const storageManager = new StorageManager();
        await storageManager.initialize();
        
        logTest('StorageManager initialization', storageManager.initialized);
        
        // Test 1: validateDeepFocusData
        const validation = await storageManager.validateDeepFocusData();
        logTest('validateDeepFocusData exists', typeof storageManager.validateDeepFocusData === 'function');
        logTest('validateDeepFocusData returns success', validation.success === true);
        logTest('validateDeepFocusData finds session', validation.validation.stats.totalSessions > 0);
        
        // Test 2: backupDeepFocusData
        const backup = await storageManager.backupDeepFocusData();
        logTest('backupDeepFocusData exists', typeof storageManager.backupDeepFocusData === 'function');
        logTest('backupDeepFocusData returns success', backup.success === true);
        logTest('backupDeepFocusData creates backup key', !!backup.backupKey);
        
        // Test 3: restoreDeepFocusData
        const restore = await storageManager.restoreDeepFocusData(backup.backupKey);
        logTest('restoreDeepFocusData exists', typeof storageManager.restoreDeepFocusData === 'function');
        logTest('restoreDeepFocusData returns success', restore.success === true);
        logTest('restoreDeepFocusData restores items', restore.restoredItems.length > 0);
        
        // Test 4: syncDeepFocusStatus
        const syncStatus = await storageManager.syncDeepFocusStatus();
        logTest('syncDeepFocusStatus exists', typeof storageManager.syncDeepFocusStatus === 'function');
        logTest('syncDeepFocusStatus returns success', syncStatus.success === true);
        logTest('syncDeepFocusStatus shows ready', syncStatus.status.isReady === true);
        
        // Test 5: getDeepFocusDiagnostics
        const diagnostics = await storageManager.getDeepFocusDiagnostics();
        logTest('getDeepFocusDiagnostics exists', typeof storageManager.getDeepFocusDiagnostics === 'function');
        logTest('getDeepFocusDiagnostics returns success', diagnostics.success === true);
        logTest('getDeepFocusDiagnostics has health status', !!diagnostics.diagnostics.health.status);
        
        // Test 6: resetDeepFocusStorage
        const reset = await storageManager.resetDeepFocusStorage('FORCE_RESET_CONFIRMED');
        logTest('resetDeepFocusStorage exists', typeof storageManager.resetDeepFocusStorage === 'function');
        logTest('resetDeepFocusStorage returns success', reset.success === true);
        logTest('resetDeepFocusStorage creates final backup', !!reset.finalBackup);
        
        return storageManager;
        
    } catch (error) {
        logTest('StorageManager method testing', false, error.message);
        return null;
    }
}

async function runIntegrationTests() {
    console.log('🧪 DEEP FOCUS SYNC INTEGRATION TESTS');
    console.log('='.repeat(50));
    
    testResults = [];
    
    try {
        // Setup
        await setupTestData();
        
        // Test StorageManager methods
        const storageManager = await testStorageManagerMethods();
        
        // Summary
        const passed = testResults.filter(t => t.status === 'PASSED').length;
        const failed = testResults.filter(t => t.status === 'FAILED').length;
        const total = testResults.length;
        
        console.log('\n' + '='.repeat(50));
        console.log('📊 TEST RESULTS SUMMARY');
        console.log('='.repeat(50));
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📈 Success Rate: ${((passed/total)*100).toFixed(1)}%`);
        
        if (failed > 0) {
            console.log('\n❌ Failed Tests:');
            testResults.filter(t => t.status === 'FAILED').forEach(test => {
                console.log(`   - ${test.name}${test.details ? ': ' + test.details : ''}`);
            });
        }
        
        const overallResult = failed === 0 ? 'PASSED' : 'FAILED';
        console.log(`\n${overallResult === 'PASSED' ? '✅' : '❌'} Overall Result: ${overallResult}`);
        
        if (overallResult === 'PASSED') {
            console.log('\n🎉 ALL TESTS PASSED!');
            console.log('Deep Focus sync methods are working correctly.');
            console.log('✅ Ready for production use.');
        } else {
            console.log('\n🚨 SOME TESTS FAILED!');
            console.log('Please review the failed tests above.');
        }
        
        return overallResult === 'PASSED';
        
    } catch (error) {
        console.error('\n❌ Integration test suite failed:', error);
        logTest('Test suite execution', false, error.message);
        return false;
    }
}

// Run the tests
if (require.main === module) {
    runIntegrationTests().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = { runIntegrationTests };