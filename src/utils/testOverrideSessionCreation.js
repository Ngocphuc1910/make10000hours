/**
 * Complete Override Session Testing Script
 * Run this in the web app console to create test override sessions and verify sync
 */

window.testOverrideSessionFlow = async function() {
    console.log('🧪 === OVERRIDE SESSION TESTING SCRIPT ===');
    
    // Step 1: Get current user
    const userStore = window.useUserStore?.getState?.();
    if (!userStore?.user?.uid) {
        console.error('❌ No authenticated user found');
        return;
    }
    
    const userId = userStore.user.uid;
    console.log(`✅ User authenticated: ${userId}`);
    
    // Step 2: Create test override sessions directly in extension storage
    const testSessions = [
        {
            id: `override_${Date.now()}_1`,
            userId: userId,
            domain: 'youtube.com',
            url: 'https://youtube.com',
            startTimeUTC: new Date(Date.now() - 1800000).toISOString(), // 30 min ago
            endTimeUTC: new Date(Date.now() - 600000).toISOString(), // 10 min ago
            duration: 1200, // 20 minutes
            visits: 1,
            utcDate: new Date().toISOString().split('T')[0],
            status: 'completed',
            type: 'override'
        },
        {
            id: `override_${Date.now()}_2`,
            userId: userId,
            domain: 'facebook.com',
            url: 'https://facebook.com',
            startTimeUTC: new Date(Date.now() - 900000).toISOString(), // 15 min ago
            endTimeUTC: new Date(Date.now() - 300000).toISOString(), // 5 min ago
            duration: 600, // 10 minutes
            visits: 1,
            utcDate: new Date().toISOString().split('T')[0],
            status: 'completed',
            type: 'override'
        }
    ];
    
    console.log('📝 Creating test override sessions:', testSessions);
    
    // Step 3: Store sessions in extension via direct injection
    try {
        // First, try to inject user data into extension
        const userSyncMessage = {
            type: 'SYNC_USER_DATA',
            payload: {
                userId: userId,
                timestamp: new Date().toISOString()
            }
        };
        
        console.log('🔄 Attempting to sync user data to extension...');
        window.postMessage(userSyncMessage, '*');
        
        // Wait a moment for user sync
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Now inject test sessions
        const sessionMessage = {
            type: 'INJECT_TEST_SESSIONS',
            payload: {
                sessions: testSessions,
                userId: userId
            }
        };
        
        console.log('💉 Injecting test sessions into extension...');
        window.postMessage(sessionMessage, '*');
        
        // Wait for injection
        await new Promise(resolve => setTimeout(resolve, 1000));
        
    } catch (error) {
        console.error('❌ Error injecting sessions:', error);
    }
    
    // Step 4: Request sessions from extension to verify storage
    console.log('📊 Requesting sessions from extension...');
    const requestMessage = {
        type: 'REQUEST_SITE_USAGE_SESSIONS',
        source: 'web-app',
        timestamp: new Date().toISOString()
    };
    
    // Listen for response
    const responsePromise = new Promise((resolve, reject) => {
        const handler = (event) => {
            if (event.data?.type === 'EXTENSION_SITE_USAGE_SESSION_BATCH') {
                window.removeEventListener('message', handler);
                resolve(event.data.payload);
                return;
            }
        };
        
        window.addEventListener('message', handler);
        
        // Timeout after 5 seconds
        setTimeout(() => {
            window.removeEventListener('message', handler);
            reject(new Error('Timeout waiting for extension response'));
        }, 5000);
    });
    
    // Send the request
    window.postMessage(requestMessage, '*');
    
    try {
        const response = await responsePromise;
        console.log('📨 Received response from extension:', response);
        
        const overrideSessions = response.sessions?.filter(s => s.type === 'override') || [];
        console.log(`🎯 Found ${overrideSessions.length} override sessions:`, overrideSessions);
        
        if (overrideSessions.length === 0) {
            console.warn('⚠️ No override sessions found in extension response');
            
            // Try direct extension storage check
            console.log('🔍 Checking extension storage directly...');
            const storageCheckMessage = {
                type: 'CHECK_STORAGE_DIRECT',
                payload: { userId }
            };
            window.postMessage(storageCheckMessage, '*');
        } else {
            console.log('✅ Override sessions successfully created and retrieved!');
            
            // Step 5: Test Firebase sync
            console.log('🔄 Testing Firebase sync...');
            await testFirebaseSync(overrideSessions);
        }
        
    } catch (error) {
        console.error('❌ Failed to get response from extension:', error);
    }
};

async function testFirebaseSync(sessions) {
    try {
        // Check if overrideSessionService is available
        if (typeof window.overrideSessionService === 'undefined') {
            // Try to access it via the store or import
            const overrideStore = window.useOverrideSessionStore?.getState?.();
            if (!overrideStore) {
                console.error('❌ Override session service not available');
                return;
            }
        }
        
        console.log('🔄 Testing direct Firebase override session creation...');
        
        for (const session of sessions) {
            try {
                const minutes = Math.round(session.duration / 60);
                console.log(`📝 Creating override session for ${session.domain} (${minutes} min)`);
                
                // Use the service to create override session
                if (window.overrideSessionService?.createOverrideSession) {
                    const result = await window.overrideSessionService.createOverrideSession({
                        userId: session.userId,
                        domain: session.domain,
                        duration: minutes,
                        url: session.url,
                        reason: 'test_session'
                    });
                    console.log(`✅ Created Firebase override session: ${result}`);
                } else {
                    console.warn('⚠️ overrideSessionService.createOverrideSession not available');
                }
                
            } catch (error) {
                console.error(`❌ Failed to create Firebase session for ${session.domain}:`, error);
            }
        }
        
        console.log('🎉 Firebase sync test completed!');
        
    } catch (error) {
        console.error('❌ Firebase sync test failed:', error);
    }
}

// Helper function to check extension connectivity
window.checkExtensionConnectivity = function() {
    console.log('🔍 Testing extension connectivity...');
    
    const testMessage = {
        type: 'PING_EXTENSION',
        timestamp: new Date().toISOString()
    };
    
    const responsePromise = new Promise((resolve, reject) => {
        const handler = (event) => {
            if (event.data?.type === 'PONG_EXTENSION') {
                window.removeEventListener('message', handler);
                console.log('✅ Extension responded to ping');
                resolve(true);
                return;
            }
        };
        
        window.addEventListener('message', handler);
        
        setTimeout(() => {
            window.removeEventListener('message', handler);
            console.warn('⚠️ Extension did not respond to ping');
            resolve(false);
        }, 2000);
    });
    
    window.postMessage(testMessage, '*');
    return responsePromise;
};

// Helper to manually sync user to extension
window.syncUserToExtension = async function() {
    const userStore = window.useUserStore?.getState?.();
    if (!userStore?.user?.uid) {
        console.error('❌ No authenticated user');
        return false;
    }
    
    console.log(`🔄 Syncing user ${userStore.user.uid} to extension...`);
    
    const userSyncMessage = {
        type: 'SYNC_USER_DATA',
        payload: {
            userId: userStore.user.uid,
            email: userStore.user.email,
            timestamp: new Date().toISOString()
        }
    };
    
    window.postMessage(userSyncMessage, '*');
    
    // Wait and verify
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if sync worked by requesting sessions
    const requestMessage = {
        type: 'REQUEST_SITE_USAGE_SESSIONS',
        source: 'web-app',
        timestamp: new Date().toISOString()
    };
    
    const responsePromise = new Promise((resolve) => {
        const handler = (event) => {
            if (event.data?.type === 'EXTENSION_SITE_USAGE_SESSION_BATCH') {
                window.removeEventListener('message', handler);
                const hasUserId = event.data.payload?.userId !== undefined;
                console.log(hasUserId ? '✅ User sync successful' : '❌ User sync failed');
                resolve(hasUserId);
                return;
            }
        };
        
        window.addEventListener('message', handler);
        
        setTimeout(() => {
            window.removeEventListener('message', handler);
            resolve(false);
        }, 3000);
    });
    
    window.postMessage(requestMessage, '*');
    return responsePromise;
};

console.log('🧪 Override session testing functions loaded:');
console.log('- testOverrideSessionFlow() - Complete test flow');
console.log('- checkExtensionConnectivity() - Test extension ping');
console.log('- syncUserToExtension() - Force user sync to extension');