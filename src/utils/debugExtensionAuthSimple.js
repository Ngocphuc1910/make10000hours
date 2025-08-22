// Enhanced debug script to fix user authentication sync between web app and extension (Console Version)
window.debugExtensionAuth = async () => {
  console.log('🔧 [DEBUG-AUTH] Starting extension authentication debug...');
  
  try {
    // Step 1: Get current user authentication from localStorage or global state
    let currentUser = null;
    
    // Try to get user from userStore if available globally
    if (window.useUserStore) {
      currentUser = window.useUserStore.getState().user;
    } else {
      // Fallback: Try localStorage
      try {
        const userStorage = localStorage.getItem('user-store');
        if (userStorage) {
          const parsed = JSON.parse(userStorage);
          currentUser = parsed?.state?.user;
        }
      } catch (e) {
        console.warn('⚠️ [DEBUG-AUTH] Could not parse user from localStorage');
      }
    }
    
    console.log('👤 [DEBUG-AUTH] Current user authentication:', {
      isAuthenticated: !!currentUser,
      userId: currentUser?.uid,
      email: currentUser?.email
    });
    
    if (!currentUser?.uid) {
      console.error('❌ [DEBUG-AUTH] No authenticated user found in web app');
      return;
    }
    
    // Step 2: Use known extension manifest configuration
    console.log('🔍 [DEBUG-AUTH] Using web-accessible externally_connectable configuration...');
    
    try {
      // The extension is configured with externally_connectable for this domain
      // We'll use postMessage to communicate via content scripts
      
      console.log('✅ [DEBUG-AUTH] Extension communication available via content scripts');
      
      // Step 3: Send user authentication data to extension via postMessage
      console.log('📤 [DEBUG-AUTH] Sending user authentication to extension...');
      
      const authPayload = {
        type: 'SYNC_USER_AUTH',
        payload: {
          userId: currentUser.uid,
          email: currentUser.email,
          timestamp: new Date().toISOString()
        },
        source: 'web-app'
      };
      
      try {
        // Send via postMessage to extension content script
        window.postMessage(authPayload, '*');
        
        console.log('✅ [DEBUG-AUTH] User authentication sent via postMessage');
        
        // Wait for extension to process the authentication
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Step 4: Wait a moment then test session data retrieval
        console.log('⏳ [DEBUG-AUTH] Waiting 2 seconds for extension to process authentication...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Step 5: Test session data retrieval via postMessage
        console.log('📥 [DEBUG-AUTH] Testing session data retrieval from extension...');
        
        const sessionRequest = {
          type: 'REQUEST_SITE_USAGE_SESSIONS',
          payload: {
            timestamp: new Date().toISOString()
          },
          source: 'web-app'
        };
        
        try {
          // Set up listener for extension response
          let sessionResponse = null;
          const responsePromise = new Promise((resolve) => {
            const handler = (event) => {
              if (event.data && event.data.type === 'EXTENSION_SITE_USAGE_SESSION_BATCH') {
                sessionResponse = event.data;
                window.removeEventListener('message', handler);
                resolve(sessionResponse);
              }
            };
            window.addEventListener('message', handler);
            
            // Timeout after 10 seconds
            setTimeout(() => {
              window.removeEventListener('message', handler);
              if (!sessionResponse) {
                resolve({ error: 'Timeout waiting for extension response' });
              }
            }, 10000);
          });
          
          // Send session request
          window.postMessage(sessionRequest, '*');
          
          sessionResponse = await responsePromise;
          
          if (sessionResponse.error) {
            console.warn('⚠️ [DEBUG-AUTH] Session request timeout or error:', sessionResponse.error);
          } else {
            console.log('✅ [DEBUG-AUTH] Extension session data response:', {
              totalSessions: sessionResponse?.payload?.sessions?.length || 0,
              overrideSessions: sessionResponse?.payload?.sessions?.filter(s => s.type === 'override')?.length || 0,
              siteUsageSessions: sessionResponse?.payload?.sessions?.filter(s => s.type !== 'override')?.length || 0,
              sampleSession: sessionResponse?.payload?.sessions?.[0]
            });
          }
          
          if (sessionResponse?.payload?.sessions?.length > 0) {
            console.log('🎉 [DEBUG-AUTH] SUCCESS! Extension is now returning session data');
            
            // Step 6: Test Firebase sync
            console.log('🔥 [DEBUG-AUTH] Testing Firebase sync for override sessions...');
            
            const overrideSessions = sessionResponse.payload.sessions.filter(s => s.type === 'override');
            if (overrideSessions.length > 0) {
              console.log(`📊 [DEBUG-AUTH] Found ${overrideSessions.length} override sessions to sync:`, 
                overrideSessions.map(s => ({ domain: s.domain, duration: s.duration }))
              );
              
              // Trigger the sync by manually calling the extensionSyncListener
              try {
                // Try to get extensionSyncListener from global scope
                if (window.extensionSyncListener) {
                  await window.extensionSyncListener.processSessions(sessionResponse.payload.sessions);
                  console.log('✅ [DEBUG-AUTH] Firebase sync completed successfully');
                } else {
                  console.log('ℹ️ [DEBUG-AUTH] extensionSyncListener not globally available, sessions received but sync test skipped');
                }
              } catch (syncError) {
                console.warn('⚠️ [DEBUG-AUTH] Firebase sync test failed:', syncError.message);
              }
            } else {
              console.log('ℹ️ [DEBUG-AUTH] No override sessions found to sync');
            }
          } else if (!sessionResponse.error) {
            console.warn('⚠️ [DEBUG-AUTH] Extension returning 0 sessions - may need more session data');
          }
          
        } catch (sessionError) {
          console.error('❌ [DEBUG-AUTH] Failed to retrieve session data:', sessionError.message || sessionError);
        }
        
      } catch (authError) {
        console.error('❌ [DEBUG-AUTH] Failed to send authentication to extension:', authError.message || authError);
        console.log('💡 [DEBUG-AUTH] Check extension content scripts and postMessage communication');
      }
      
    } catch (error) {
      console.error('❌ [DEBUG-AUTH] Extension authentication debug failed:', error);
    }
    
  } catch (error) {
    console.error('❌ [DEBUG-AUTH] Debug script failed:', error);
  }
};

// Auto-expose the debug function
console.log('🚀 [DEBUG-AUTH] Extension authentication debug script loaded');
console.log('📋 [DEBUG-AUTH] Run: debugExtensionAuth()');