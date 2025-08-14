// ALTERNATIVE TIMER DEBUG - Works without global timer store
// ============================================================

(function() {
  console.log('🔍 Starting Alternative Timer Debug...');
  
  // 1. Monitor all keyboard events to see space bar detection
  document.addEventListener('keydown', function(event) {
    if (event.code === 'Space') {
      const target = event.target;
      const isFormElement = target.tagName === 'INPUT' || 
                           target.tagName === 'TEXTAREA' || 
                           target.isContentEditable ||
                           target.getAttribute('role') === 'textbox';
      
      console.log('⌨️ SPACE BAR DETECTED:', {
        timestamp: new Date().toISOString(),
        isFormElement,
        targetTag: target.tagName,
        currentPath: window.location.pathname,
        defaultPrevented: event.defaultPrevented
      });
      
      // Check if event gets prevented
      setTimeout(() => {
        console.log('⌨️ Space event after processing - defaultPrevented:', event.defaultPrevented);
      }, 10);
    }
  }, true); // Use capture phase to catch early
  
  // 2. Monitor DOM mutations to see if timer display changes
  const timerDisplays = document.querySelectorAll('[class*="timer"], [class*="time"], .text-4xl, .text-5xl');
  console.log('📱 Found potential timer displays:', timerDisplays.length);
  
  timerDisplays.forEach((element, index) => {
    console.log(`Timer Display ${index}:`, {
      element: element.tagName,
      class: element.className,
      text: element.textContent
    });
    
    // Monitor text changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          console.log(`⏱️ Timer Display ${index} changed:`, element.textContent);
        }
      });
    });
    
    observer.observe(element, { 
      childList: true, 
      subtree: true, 
      characterData: true 
    });
  });
  
  // 3. Monitor button state changes
  const buttons = document.querySelectorAll('button');
  const timerButtons = Array.from(buttons).filter(btn => 
    btn.textContent.includes('Start') || 
    btn.textContent.includes('Pause') || 
    btn.textContent.includes('play') ||
    btn.textContent.includes('pause')
  );
  
  console.log('🔘 Found timer buttons:', timerButtons.length);
  timerButtons.forEach((button, index) => {
    console.log(`Button ${index}:`, {
      text: button.textContent,
      disabled: button.disabled,
      class: button.className
    });
    
    // Monitor button text/state changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        console.log(`🔘 Button ${index} changed:`, {
          text: button.textContent,
          disabled: button.disabled,
          mutation: mutation.type
        });
      });
    });
    
    observer.observe(button, { 
      childList: true, 
      subtree: true, 
      attributes: true,
      attributeFilter: ['disabled', 'class']
    });
  });
  
  // 4. Monitor for React Dev Tools
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    console.log('⚛️ React DevTools detected');
    
    // Try to access React Fiber
    const rootElement = document.getElementById('root');
    if (rootElement && rootElement._reactInternalFiber) {
      console.log('⚛️ React Fiber found, attempting to access timer store...');
    }
  }
  
  // 5. Check for Zustand stores in window
  const possibleStores = Object.keys(window).filter(key => 
    key.includes('store') || key.includes('Store') || key.includes('use')
  );
  console.log('🏪 Possible stores found in window:', possibleStores);
  
  // 6. Monitor console messages for timer-related logs
  const originalConsoleLog = console.log;
  console.log = function(...args) {
    const message = args.join(' ');
    if (message.includes('🔑') || message.includes('timer') || message.includes('Timer')) {
      originalConsoleLog('📋 TIMER-RELATED LOG:', ...args);
    }
    return originalConsoleLog.apply(console, args);
  };
  
  // 7. Check localStorage for timer state
  try {
    const timerState = localStorage.getItem('timerState');
    if (timerState) {
      const parsed = JSON.parse(timerState);
      console.log('💾 Timer state in localStorage:', {
        isRunning: parsed.isRunning,
        currentTime: parsed.currentTime,
        lastSaveTime: parsed.lastSaveTime
      });
    } else {
      console.log('💾 No timer state found in localStorage');
    }
  } catch (e) {
    console.log('💾 Error reading localStorage timer state:', e);
  }
  
  console.log('✅ Alternative debug setup complete!');
  console.log('📝 Now press SPACE and watch for timer-related changes...');
  console.log('📝 Look for button text changes, timer display updates, and keyboard logs');
})();