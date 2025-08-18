/**
 * Debug Extension Data Format
 * Check exactly what data the extension is sending
 */

declare global {
  interface Window {
    debugExtensionData: () => void;
    inspectExtensionMessage: () => void;
    checkExtensionStorage: () => void;
  }
}

// Inspect actual extension messages
window.inspectExtensionMessage = () => {
  console.log('🔍 ===============================');
  console.log('🔍 INSPECTING EXTENSION MESSAGES');
  console.log('🔍 ===============================');
  
  // Override message handler to inspect data
  const originalAddEventListener = window.addEventListener;
  
  window.addEventListener = function(type: string, listener: any, options?: any) {
    if (type === 'message') {
      const wrappedListener = (event: MessageEvent) => {
        if (event.data?.type?.includes('EXTENSION') || event.data?.type?.includes('SITE_USAGE')) {
          console.log('📨 RAW EXTENSION MESSAGE:', {
            type: event.data.type,
            fullData: event.data,
            payload: event.data.payload,
            sessions: event.data.payload?.sessions,
            sessionCount: event.data.payload?.sessions?.length || 0,
            firstSession: event.data.payload?.sessions?.[0],
            origin: event.origin,
            source: event.source
          });
          
          // Check session format
          if (event.data.payload?.sessions?.length > 0) {
            const session = event.data.payload.sessions[0];
            console.log('🔍 FIRST SESSION ANALYSIS:', {
              hasDomain: !!session.domain,
              hasDuration: !!session.duration,
              hasStartTimeUTC: !!session.startTimeUTC,
              hasEndTimeUTC: !!session.endTimeUTC,
              hasStatus: !!session.status,
              hasUtcDate: !!session.utcDate,
              hasUserId: !!session.userId,
              durationValue: session.duration,
              durationType: typeof session.duration,
              statusValue: session.status,
              fields: Object.keys(session)
            });
          }
        }
        
        // Call original listener
        if (typeof listener === 'function') {
          listener(event);
        } else if (listener && typeof listener.handleEvent === 'function') {
          listener.handleEvent(event);
        }
      };
      
      return originalAddEventListener.call(this, type, wrappedListener, options);
    }
    
    return originalAddEventListener.call(this, type, listener, options);
  };
  
  console.log('✅ Extension message inspection enabled');
};

// Check if extension has storage data
window.checkExtensionStorage = () => {
  console.log('🔍 ===========================');
  console.log('🔍 CHECKING EXTENSION STORAGE');
  console.log('🔍 ===========================');
  
  // Send request to extension for storage info
  window.postMessage({
    type: 'DEBUG_EXTENSION_STORAGE',
    request: 'site-usage-sessions',
    source: 'web-app-debug'
  }, '*');
  
  // Send request for all storage keys
  window.postMessage({
    type: 'DEBUG_EXTENSION_ALL_STORAGE',
    source: 'web-app-debug'
  }, '*');
  
  console.log('📤 Storage debug requests sent to extension');
};

// Main debug function for extension data
window.debugExtensionData = () => {
  console.log('🚀 =============================');
  console.log('🚀 DEBUG EXTENSION DATA FORMAT');
  console.log('🚀 =============================');
  
  // 1. Enable message inspection
  window.inspectExtensionMessage();
  
  // 2. Check extension storage
  window.checkExtensionStorage();
  
  // 3. Send test requests
  console.log('🔄 Sending test requests to extension...');
  
  setTimeout(() => {
    window.postMessage({
      type: 'REQUEST_SITE_USAGE_SESSIONS',
      source: 'web-app',
      debug: true
    }, '*');
  }, 1000);
  
  // 4. Log expected format
  console.log('📋 EXPECTED SESSION FORMAT:');
  console.log({
    domain: 'string (required)',
    duration: 'number in seconds (required)',
    startTimeUTC: 'ISO string (required)',
    endTimeUTC: 'ISO string (optional)',
    status: 'completed|active|suspended (required)',
    utcDate: 'YYYY-MM-DD string (required)',
    userId: 'string (required)'
  });
  
  console.log('🔍 Extension data debug active. Watch for message analysis above.');
};

export {};