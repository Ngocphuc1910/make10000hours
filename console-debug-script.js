// ==================================================
// 🐛 DEEP FOCUS SYNC COMPREHENSIVE DEBUG SCRIPT
// ==================================================
// 
// INSTRUCTIONS:
// 1. Open your Deep Focus page in the browser
// 2. Open Developer Tools (F12)
// 3. Go to Console tab  
// 4. Copy and paste this entire script
// 5. Press Enter to run
// 6. Follow the prompts and check the detailed logs
//
// ==================================================

(async function deepFocusDebugScript() {
    console.log('🚀 DEEP FOCUS SYNC DEBUG SCRIPT STARTED');
    console.log('='.repeat(60));
    
    let debugResults = {};
    
    // =====================================
    // HELPER FUNCTIONS
    // =====================================
    
    function logSection(title) {
        console.log('\n' + '🔍 ' + title);
        console.log('-'.repeat(title.length + 4));
    }
    
    function logSuccess(message) {
        console.log('✅', message);
    }
    
    function logError(message) {
        console.log('❌', message);
    }
    
    function logWarning(message) {
        console.log('⚠️', message);
    }
    
    function logInfo(message) {
        console.log('ℹ️', message);
    }
    
    // =====================================
    // STEP 1: ENVIRONMENT CHECK
    // =====================================
    
    logSection('STEP 1: Environment Check');
    
    try {
        // Check if we're on the right page
        const isDeepFocusPage = window.location.pathname.includes('deep-focus') || 
                               window.location.href.includes('deep-focus') ||
                               document.title.includes('Deep Focus');
        
        logInfo(`Current URL: ${window.location.href}`);
        logInfo(`Is Deep Focus page: ${isDeepFocusPage}`);
        
        if (!isDeepFocusPage) {
            logWarning('You might want to run this on the Deep Focus page for best results');
        }
        
        // Check browser extension API
        const hasChrome = typeof chrome !== 'undefined';
        const hasChromeRuntime = hasChrome && !!chrome.runtime;
        
        logInfo(`Chrome API available: ${hasChrome}`);
        logInfo(`Chrome Runtime available: ${hasChromeRuntime}`);
        
        if (!hasChromeRuntime) {
            logWarning('Chrome extension API not available - this might be the issue!');
        }
        
        debugResults.environment = {
            url: window.location.href,
            isDeepFocusPage,
            hasChrome,
            hasChromeRuntime,
            userAgent: navigator.userAgent,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
        
    } catch (error) {
        logError(`Environment check failed: ${error.message}`);
        debugResults.environmentError = error.message;
    }
    
    // =====================================
    // STEP 2: EXTENSION DATA SERVICE CHECK
    // =====================================
    
    logSection('STEP 2: Extension Data Service Check');
    
    try {
        // Try to import the extension data service
        const ExtensionDataService = (await import('/src/services/extensionDataService.ts')).default;
        logSuccess('ExtensionDataService imported successfully');
        
        // Check circuit breaker status
        const circuitStatus = ExtensionDataService.getCircuitBreakerStatus();
        
        logInfo(`Circuit Breaker State: ${circuitStatus.state}`);
        logInfo(`Circuit Breaker Failure Count: ${circuitStatus.failureCount}`);
        logInfo(`Time Until Retry: ${Math.ceil(circuitStatus.timeUntilRetry / 1000)} seconds`);
        
        if (circuitStatus.state === 'OPEN') {
            logError('🚫 CIRCUIT BREAKER IS OPEN! This is blocking all extension communication.');
            logInfo('💡 This is likely the main issue. Trying to reset...');
            
            // Try to reset circuit breaker
            ExtensionDataService.resetCircuitBreaker();
            logSuccess('Circuit breaker reset attempted');
            
            // Check again
            await new Promise(resolve => setTimeout(resolve, 100));
            const newStatus = ExtensionDataService.getCircuitBreakerStatus();
            logInfo(`New Circuit Breaker State: ${newStatus.state}`);
        }
        
        debugResults.circuitBreaker = {
            initialState: circuitStatus.state,
            failureCount: circuitStatus.failureCount,
            timeUntilRetry: circuitStatus.timeUntilRetry,
            wasReset: circuitStatus.state === 'OPEN'
        };
        
    } catch (error) {
        logError(`Extension Data Service check failed: ${error.message}`);
        debugResults.extensionDataServiceError = error.message;
    }
    
    // =====================================
    // STEP 3: BASIC EXTENSION CONNECTION TEST
    // =====================================
    
    logSection('STEP 3: Basic Extension Connection Test');
    
    try {
        const ExtensionDataService = (await import('/src/services/extensionDataService.ts')).default;
        
        // Test different timeout values
        const timeouts = [500, 1000, 2000, 5000];
        let connectionSuccessful = false;
        
        for (const timeout of timeouts) {
            try {
                logInfo(`Testing connection with ${timeout}ms timeout...`);
                const start = performance.now();
                
                const result = await ExtensionDataService.testRealExtensionConnection(timeout);
                const duration = Math.round(performance.now() - start);
                
                if (result) {
                    logSuccess(`✓ Connection successful with ${timeout}ms timeout (took ${duration}ms)`);
                    connectionSuccessful = true;
                    break;
                } else {
                    logWarning(`✗ Connection failed with ${timeout}ms timeout (took ${duration}ms)`);
                }
                
            } catch (error) {
                logError(`✗ Connection test ${timeout}ms failed: ${error.message}`);
            }
        }
        
        debugResults.connectionTest = {
            successful: connectionSuccessful,
            testedTimeouts: timeouts
        };
        
        if (!connectionSuccessful) {
            logError('🚨 ALL CONNECTION TESTS FAILED!');
            logInfo('This suggests the extension is not responding or not installed properly.');
        }
        
    } catch (error) {
        logError(`Connection test failed: ${error.message}`);
        debugResults.connectionTestError = error.message;
    }
    
    // =====================================
    // STEP 4: MESSAGE TYPE TESTING
    // =====================================
    
    logSection('STEP 4: Message Type Testing');
    
    const messageTests = [
        { type: 'PING', description: 'Basic ping test' },
        { type: 'GET_USER_TIMEZONE', description: 'Timezone coordination test' },
        { type: 'GET_TODAY_STATS', description: 'Today stats test' },
        { type: 'GET_LAST_10_DEEP_FOCUS_SESSIONS', description: 'Last 10 sessions (THE FAILING ONE)' },
        { type: 'GET_TODAY_DEEP_FOCUS_SESSIONS', description: 'Today sessions test' },
        { type: 'GET_RECENT_7_DAYS_DEEP_FOCUS_SESSIONS', description: 'Recent 7 days test' }
    ];
    
    debugResults.messageTests = {};
    
    try {
        const ExtensionDataService = (await import('/src/services/extensionDataService.ts')).default;
        
        for (const test of messageTests) {
            try {
                logInfo(`Testing: ${test.description} (${test.type})`);
                const start = performance.now();
                
                const response = await ExtensionDataService.sendMessage({ 
                    type: test.type 
                }, 3000); // 3 second timeout
                
                const duration = Math.round(performance.now() - start);
                
                if (response && response.success) {
                    logSuccess(`  ✓ ${test.type} succeeded (${duration}ms)`);
                    logInfo(`  📊 Data: ${JSON.stringify(response).substring(0, 150)}...`);
                    
                    debugResults.messageTests[test.type] = {
                        success: true,
                        duration,
                        dataLength: response.data ? (Array.isArray(response.data) ? response.data.length : 'N/A') : 0,
                        responseSize: JSON.stringify(response).length
                    };
                } else {
                    logError(`  ✗ ${test.type} failed: ${response?.error || 'Unknown error'}`);
                    debugResults.messageTests[test.type] = {
                        success: false,
                        error: response?.error || 'Unknown error',
                        duration
                    };
                }
                
            } catch (error) {
                logError(`  ✗ ${test.type} exception: ${error.message}`);
                debugResults.messageTests[test.type] = {
                    success: false,
                    exception: error.message
                };
                
                // Check if this specific error is causing circuit breaker issues
                if (error.message.includes('debounced') || error.message.includes('too frequent')) {
                    logWarning(`  🎯 FOUND ISSUE: ${test.type} is being debounced!`);
                } else if (error.message.includes('circuit breaker')) {
                    logWarning(`  🎯 FOUND ISSUE: ${test.type} triggered circuit breaker!`);
                }
            }
            
            // Small delay between tests to avoid overwhelming
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
    } catch (error) {
        logError(`Message testing failed: ${error.message}`);
        debugResults.messageTestsError = error.message;
    }
    
    // =====================================
    // STEP 5: EXTENSION DATA ANALYSIS
    // =====================================
    
    logSection('STEP 5: Extension Data Analysis');
    
    try {
        const ExtensionDataService = (await import('/src/services/extensionDataService.ts')).default;
        
        // Try to get the problematic data that's causing sync issues
        logInfo('Attempting to fetch extension session data...');
        
        const response = await ExtensionDataService.sendMessage({
            type: 'GET_LAST_10_DEEP_FOCUS_SESSIONS'
        }, 5000);
        
        if (response && response.success && response.data) {
            const sessions = response.data;
            logSuccess(`Successfully fetched ${sessions.length} sessions from extension`);
            
            // Analyze session schemas
            let utcSchemaCount = 0;
            let legacySchemaCount = 0;
            let unknownSchemaCount = 0;
            
            sessions.forEach((session, index) => {
                if (session.startTimeUTC && session.timezone) {
                    utcSchemaCount++;
                    if (index === 0) {
                        logInfo(`Sample NEW schema session: ${JSON.stringify({
                            id: session.id,
                            startTimeUTC: session.startTimeUTC,
                            timezone: session.timezone,
                            status: session.status,
                            duration: session.duration
                        }, null, 2)}`);
                    }
                } else if (session.startTime && typeof session.startTime === 'number') {
                    legacySchemaCount++;
                    if (index === 0) {
                        logInfo(`Sample LEGACY schema session: ${JSON.stringify({
                            id: session.id,
                            startTime: session.startTime,
                            status: session.status,
                            duration: session.duration
                        }, null, 2)}`);
                    }
                } else {
                    unknownSchemaCount++;
                    if (index === 0) {
                        logWarning(`Sample UNKNOWN schema session: ${JSON.stringify(session, null, 2)}`);
                    }
                }
            });
            
            logInfo(`Schema analysis:`);
            logInfo(`  🆕 New UTC schema: ${utcSchemaCount}/${sessions.length} sessions`);
            logInfo(`  🗝️ Legacy schema: ${legacySchemaCount}/${sessions.length} sessions`);
            logInfo(`  ❓ Unknown schema: ${unknownSchemaCount}/${sessions.length} sessions`);
            
            debugResults.extensionData = {
                totalSessions: sessions.length,
                utcSchemaCount,
                legacySchemaCount,
                unknownSchemaCount,
                sampleSession: sessions[0] || null
            };
            
        } else {
            logError(`Failed to fetch extension data: ${response?.error || 'Unknown error'}`);
            debugResults.extensionDataError = response?.error || 'Unknown error';
        }
        
    } catch (error) {
        logError(`Extension data analysis failed: ${error.message}`);
        debugResults.extensionDataAnalysisError = error.message;
    }
    
    // =====================================
    // STEP 6: FIREBASE DATA CHECK
    // =====================================
    
    logSection('STEP 6: Firebase Data Check');
    
    try {
        // Get current user
        const userStore = window.zustand?.getState?.();
        const user = userStore?.user;
        
        if (!user?.uid) {
            logWarning('No authenticated user found - cannot check Firebase data');
        } else {
            logInfo(`Checking Firebase data for user: ${user.uid}`);
            
            const { default: deepFocusSessionService } = await import('/src/api/deepFocusSessionService.ts');
            const firebaseSessions = await deepFocusSessionService.getUserSessions(user.uid);
            
            logSuccess(`Firebase sessions loaded: ${firebaseSessions.length}`);
            
            if (firebaseSessions.length > 0) {
                const sample = firebaseSessions[0];
                logInfo(`Sample Firebase session schema:`);
                Object.keys(sample).forEach(key => {
                    logInfo(`  ${key}: ${typeof sample[key]} = ${sample[key]}`);
                });
            }
            
            // Test timezone conversion
            const { DeepFocusDisplayService } = await import('/src/services/deepFocusDisplayService.ts');
            const { timezoneUtils } = await import('/src/utils/timezoneUtils.ts');
            
            const userTimezone = user.timezone || timezoneUtils.getCurrentTimezone();
            
            logInfo(`Converting sessions for timezone: ${userTimezone}`);
            const convertedSessions = DeepFocusDisplayService.convertSessionsForUser(
                firebaseSessions,
                userTimezone
            );
            
            logSuccess(`Sessions converted successfully: ${convertedSessions.length}`);
            
            debugResults.firebaseData = {
                totalSessions: firebaseSessions.length,
                convertedSessions: convertedSessions.length,
                userTimezone,
                sampleSession: firebaseSessions[0] || null
            };
        }
        
    } catch (error) {
        logError(`Firebase data check failed: ${error.message}`);
        debugResults.firebaseDataError = error.message;
    }
    
    // =====================================
    // STEP 7: SYNC OPERATION TEST
    // =====================================
    
    logSection('STEP 7: Sync Operation Test');
    
    try {
        const userStore = window.zustand?.getState?.();
        const user = userStore?.user;
        
        if (!user?.uid) {
            logWarning('No authenticated user - cannot test sync operations');
        } else {
            logInfo('Testing sync operations...');
            
            const { DeepFocusSync } = await import('/src/services/deepFocusSync.ts');
            
            // Test smart sync
            logInfo('Testing Smart Sync...');
            const start = performance.now();
            
            try {
                const result = await DeepFocusSync.smartSync(user.uid, 'today');
                const duration = Math.round(performance.now() - start);
                
                if (result.success) {
                    logSuccess(`Smart Sync completed successfully (${duration}ms)`);
                    logInfo(`Sync result: ${JSON.stringify(result, null, 2)}`);
                } else {
                    logError(`Smart Sync failed: ${result.error}`);
                }
                
                debugResults.smartSync = {
                    success: result.success,
                    duration,
                    result
                };
                
            } catch (syncError) {
                const duration = Math.round(performance.now() - start);
                logError(`Smart Sync threw exception (${duration}ms): ${syncError.message}`);
                debugResults.smartSyncError = {
                    duration,
                    error: syncError.message,
                    stack: syncError.stack
                };
            }
        }
        
    } catch (error) {
        logError(`Sync operation test failed: ${error.message}`);
        debugResults.syncTestError = error.message;
    }
    
    // =====================================
    // FINAL ANALYSIS & RECOMMENDATIONS
    // =====================================
    
    logSection('FINAL ANALYSIS & RECOMMENDATIONS');
    
    // Analyze the results and provide recommendations
    let primaryIssues = [];
    let recommendations = [];
    
    // Check circuit breaker
    if (debugResults.circuitBreaker?.initialState === 'OPEN') {
        primaryIssues.push('Circuit breaker was OPEN, blocking all communication');
        recommendations.push('Run: resetExtensionConnection() in console');
    }
    
    // Check connection
    if (!debugResults.connectionTest?.successful) {
        primaryIssues.push('Extension connection failed completely');
        recommendations.push('Check if the Chrome extension is installed and enabled');
        recommendations.push('Try refreshing the page');
        recommendations.push('Check browser console for extension errors');
    }
    
    // Check for specific message failures
    const failedMessages = Object.entries(debugResults.messageTests || {})
        .filter(([type, result]) => !result.success)
        .map(([type, result]) => `${type}: ${result.error || result.exception}`);
    
    if (failedMessages.length > 0) {
        primaryIssues.push(`${failedMessages.length} message types failed`);
        failedMessages.forEach(msg => logError(`  - ${msg}`));
    }
    
    // Check for debounce issues
    const debounceIssues = Object.entries(debugResults.messageTests || {})
        .filter(([type, result]) => 
            result.error?.includes('debounced') || 
            result.exception?.includes('debounced') ||
            result.error?.includes('too frequent') ||
            result.exception?.includes('too frequent')
        );
    
    if (debounceIssues.length > 0) {
        primaryIssues.push('Debouncing issues detected');
        recommendations.push('The sync calls are happening too frequently');
        recommendations.push('This is likely fixed in our recent code changes');
    }
    
    // Summary
    if (primaryIssues.length === 0) {
        logSuccess('🎉 No obvious issues found! The sync should be working.');
    } else {
        logError('🚨 Issues detected:');
        primaryIssues.forEach(issue => logError(`  - ${issue}`));
        
        logInfo('💡 Recommendations:');
        recommendations.forEach(rec => logInfo(`  - ${rec}`));
    }
    
    // Final debug data export
    console.log('\n' + '='.repeat(60));
    console.log('🔍 COMPLETE DEBUG DATA:');
    console.log('='.repeat(60));
    console.log(JSON.stringify(debugResults, null, 2));
    
    // Store debug data globally for easy access
    window.deepFocusDebugResults = debugResults;
    
    console.log('\n' + '✅ DEBUG SCRIPT COMPLETED');
    console.log('📊 Results stored in: window.deepFocusDebugResults');
    console.log('🔧 Available debug functions: resetExtensionConnection(), debugSmartSync()');
    
    return debugResults;
})();