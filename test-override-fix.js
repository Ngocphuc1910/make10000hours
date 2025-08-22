/**
 * Test Override Session Fix
 * Run this in the browser console at localhost:3006 after loading the app
 */

(function() {
    console.log('🧪 === TESTING OVERRIDE SESSION FIX ===');
    
    async function testOverrideSessionFix() {
        try {
            // Step 1: Verify user authentication
            console.log('\n🔍 Step 1: Verify User Authentication');
            const userStore = window.useUserStore?.getState?.();
            if (!userStore?.user?.uid) {
                console.error('❌ CRITICAL: No authenticated user found');
                return;
            }
            
            const userId = userStore.user.uid;
            console.log(`✅ User authenticated: ${userId}`);
            
            // Step 2: Clear any existing test data
            console.log('\n🧹 Step 2: Clear Existing Test Data');
            await clearExtensionTestData();
            
            // Step 3: Test extension connectivity
            console.log('\n🔍 Step 3: Test Extension Connectivity');
            const connected = await testExtensionConnectivity();
            if (!connected) {
                console.error('❌ CRITICAL: Extension not responding');
                return;
            }
            
            // Step 4: Sync user data to extension
            console.log('\n🔄 Step 4: Sync User Data to Extension');
            await syncUserToExtension(userId, userStore.user.email);
            
            // Step 5: Create and inject test override sessions
            console.log('\n💉 Step 5: Inject Test Override Sessions');
            const testSessions = await injectTestOverrideSessions(userId);
            
            // Step 6: Wait for injection to complete
            console.log('\n⏳ Step 6: Wait for Injection to Complete');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Step 7: Request sessions from extension (this is where the bug was)
            console.log('\n📨 Step 7: Request Sessions from Extension');
            const response = await requestSessionsFromExtension();
            
            // Step 8: Analyze results
            console.log('\n📊 Step 8: Analyze Results');
            analyzeTestResults(testSessions, response);
            
        } catch (error) {
            console.error('❌ Test failed:', error);
        }
    }
    
    async function clearExtensionTestData() {
        // Send clear command to extension
        window.postMessage({
            type: 'CLEAR_TEST_DATA',
            payload: { clearAll: true }
        }, '*');
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('✅ Extension test data clear command sent');
    }
    
    async function testExtensionConnectivity() {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(false), 5000);
            
            const handler = (event) => {
                if (event.data?.type === 'PONG_EXTENSION') {
                    clearTimeout(timeout);
                    window.removeEventListener('message', handler);
                    console.log('✅ Extension connectivity confirmed');
                    resolve(true);
                }
            };
            
            window.addEventListener('message', handler);
            window.postMessage({ type: 'PING_EXTENSION' }, '*');
        });
    }
    
    async function syncUserToExtension(userId, email) {
        window.postMessage({
            type: 'SYNC_USER_DATA',
            payload: {
                userId: userId,
                email: email,
                timestamp: new Date().toISOString()
            }
        }, '*');
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('✅ User sync message sent');
    }
    
    async function injectTestOverrideSessions(userId) {
        const now = Date.now();
        const testSessions = [
            {
                id: `test_override_${now}_1`,
                userId: userId,
                domain: 'youtube.com',
                url: 'https://youtube.com',
                startTimeUTC: new Date(now - 1800000).toISOString(),
                duration: 1200, // 20 minutes in seconds
                visits: 1,
                utcDate: new Date().toISOString().split('T')[0],
                status: 'completed',
                type: 'override'
            },
            {
                id: `test_override_${now}_2`,
                userId: userId,
                domain: 'facebook.com',
                url: 'https://facebook.com',
                startTimeUTC: new Date(now - 900000).toISOString(),
                duration: 600, // 10 minutes in seconds
                visits: 1,
                utcDate: new Date().toISOString().split('T')[0],
                status: 'completed',
                type: 'override'
            }
        ];
        
        console.log(`🎯 Injecting ${testSessions.length} test override sessions`);
        
        window.postMessage({
            type: 'INJECT_TEST_SESSIONS',
            payload: {
                sessions: testSessions,
                userId: userId
            }
        }, '*');
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        console.log('✅ Test session injection completed');
        
        return testSessions;
    }
    
    async function requestSessionsFromExtension() {
        console.log('📤 Requesting sessions from extension...');
        
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                console.warn('⚠️ Extension session request timed out');
                resolve(null);
            }, 8000);
            
            const handler = (event) => {
                if (event.data?.type === 'EXTENSION_SITE_USAGE_SESSION_BATCH') {
                    clearTimeout(timeout);
                    window.removeEventListener('message', handler);
                    
                    console.log('📨 Extension response received:', {
                        sessionCount: event.data.payload?.sessions?.length || 0,
                        hasUserId: !!event.data.payload?.userId,
                        source: event.data.source
                    });
                    
                    resolve(event.data.payload);
                }
            };
            
            window.addEventListener('message', handler);
            
            // Send the request
            window.postMessage({
                type: 'REQUEST_SITE_USAGE_SESSIONS',
                source: 'web-app',
                timestamp: new Date().toISOString()
            }, '*');
        });
    }
    
    function analyzeTestResults(injectedSessions, response) {
        console.log('\n🎯 === FINAL ANALYSIS ===');
        
        if (!response) {
            console.error('❌ CRITICAL: No response received from extension');
            console.log('🔧 Check extension console for errors');
            return;
        }
        
        const receivedSessions = response.sessions || [];
        const overrideSessions = receivedSessions.filter(s => s.type === 'override');
        
        console.log(`📝 Injected override sessions: ${injectedSessions.length}`);
        console.log(`📨 Total sessions received: ${receivedSessions.length}`);
        console.log(`🎯 Override sessions received: ${overrideSessions.length}`);
        
        if (overrideSessions.length === 0) {
            console.error('❌ FAILED: No override sessions received');
            console.log('🔍 Received session types:', [...new Set(receivedSessions.map(s => s.type))]);
            console.log('🔧 Check extension console for storage and processing debug messages');
        } else if (overrideSessions.length !== injectedSessions.length) {
            console.warn(`⚠️ PARTIAL SUCCESS: Expected ${injectedSessions.length}, got ${overrideSessions.length}`);
        } else {
            console.log('✅ SUCCESS: All override sessions retrieved correctly!');
        }
        
        // Detailed session comparison
        if (overrideSessions.length > 0) {
            console.log('\n📊 Override Session Details:');
            overrideSessions.forEach((session, index) => {
                console.log(`${index + 1}. ${session.domain}: ${session.duration}s (${session.type})`);
            });
        }
        
        console.log('\n🎉 Test completed!');
        if (overrideSessions.length > 0) {
            console.log('🚀 Ready for Firebase sync test!');
            console.log('💡 The override session sync issue has been fixed!');
        } else {
            console.log('🔧 Still debugging needed - check extension console');
        }
    }
    
    // Make the test function available globally
    window.testOverrideSessionFix = testOverrideSessionFix;
    
    console.log('\n🚀 Override session fix test loaded!');
    console.log('Run: testOverrideSessionFix()');
    
    // Auto-run the test
    setTimeout(() => {
        console.log('\n🔄 Auto-running fix test...');
        testOverrideSessionFix();
    }, 1000);
    
})();