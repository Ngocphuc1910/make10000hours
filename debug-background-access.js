/**
 * Debug Background Page Access
 * Run this in extension popup console to check background page state
 */

console.log('🔍 Checking background page access...');

async function checkBackgroundAccess() {
  try {
    console.log('=== BACKGROUND PAGE ACCESS TEST ===');
    
    // Method 1: chrome.extension.getBackgroundPage()
    console.log('📡 Trying chrome.extension.getBackgroundPage()...');
    
    if (typeof chrome === 'undefined') {
      console.error('❌ chrome API not available');
      return;
    }
    
    if (!chrome.extension) {
      console.error('❌ chrome.extension not available');
      return;
    }
    
    if (!chrome.extension.getBackgroundPage) {
      console.error('❌ chrome.extension.getBackgroundPage not available');
      return;
    }
    
    const bg = chrome.extension.getBackgroundPage();
    console.log('Background page result:', bg ? 'FOUND' : 'NULL');
    
    if (!bg) {
      console.error('❌ Background page is null');
      return;
    }
    
    console.log('✅ Background page accessible');
    console.log('Background page keys:', Object.keys(bg));
    
    // Check for FocusTimeTracker
    if (bg.focusTimeTracker) {
      console.log('✅ focusTimeTracker found');
      console.log('focusTimeTracker type:', typeof bg.focusTimeTracker);
      
      const tracker = bg.focusTimeTracker;
      
      // Check storageManager on tracker
      if (tracker.storageManager) {
        console.log('✅ storageManager found on focusTimeTracker');
        console.log('storageManager type:', typeof tracker.storageManager);
        
        const sm = tracker.storageManager;
        
        // Test website session methods
        const methods = [
          'createWebsiteSession',
          'updateWebsiteSessionDuration',
          'completeWebsiteSession'
        ];
        
        console.log('=== METHOD AVAILABILITY TEST ===');
        methods.forEach(method => {
          const hasMethod = typeof sm[method] === 'function';
          console.log(`${hasMethod ? '✅' : '❌'} ${method}: ${hasMethod ? 'EXISTS' : 'MISSING'}`);
        });
        
        // Test method call
        console.log('=== TESTING ACTUAL METHOD CALL ===');
        try {
          console.log('🧪 Testing createWebsiteSession...');
          const sessionId = await sm.createWebsiteSession('test.com');
          console.log('✅ createWebsiteSession SUCCESS:', sessionId);
          
          // Try to update duration
          if (sessionId) {
            console.log('🧪 Testing updateWebsiteSessionDuration...');
            const updateResult = await sm.updateWebsiteSessionDuration(sessionId, 5000);
            console.log('✅ updateWebsiteSessionDuration result:', updateResult);
            
            // Check storage
            const storage = await chrome.storage.local.get(['site_usage_sessions']);
            const sessions = storage.site_usage_sessions || {};
            const testSession = sessions[sessionId];
            
            console.log('📊 Test session in storage:', testSession);
            
            if (testSession && testSession.duration > 0) {
              console.log('🎉 SUCCESS! Duration tracking is working:', testSession.duration);
            } else {
              console.log('❌ Duration is still 0 or session not found');
            }
          }
        } catch (methodError) {
          console.error('❌ Method call failed:', methodError);
          console.error('Error details:', {
            name: methodError.name,
            message: methodError.message,
            stack: methodError.stack
          });
        }
      } else {
        console.error('❌ storageManager not found on focusTimeTracker');
        console.log('focusTimeTracker properties:', Object.getOwnPropertyNames(tracker));
      }
    } else {
      console.error('❌ focusTimeTracker not found');
      console.log('Available properties on background page:', Object.getOwnPropertyNames(bg));
    }
    
    // Check global storageManager
    if (bg.storageManager) {
      console.log('✅ Global storageManager found on background page');
    } else {
      console.log('❌ Global storageManager not found on background page');
    }
    
    // Check FocusTimeTracker class
    if (bg.FocusTimeTracker) {
      console.log('✅ FocusTimeTracker class found');
    } else {
      console.log('❌ FocusTimeTracker class not found');
    }
    
    // Check StorageManager class
    if (bg.StorageManager) {
      console.log('✅ StorageManager class found');
    } else {
      console.log('❌ StorageManager class not found');
    }
    
  } catch (error) {
    console.error('❌ Background access test failed:', error);
  }
}

// Run the test
checkBackgroundAccess();

// Also check current context
console.log('=== CURRENT CONTEXT INFO ===');
console.log('Current URL:', window.location?.href);
console.log('Chrome runtime available:', !!chrome?.runtime);
console.log('Chrome extension available:', !!chrome?.extension);
console.log('Chrome storage available:', !!chrome?.storage);