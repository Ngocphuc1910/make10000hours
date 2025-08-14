// Debug Timer Issue - Run this in browser console
// This will help us understand what's happening with the timer state and intervals

window.debugTimer = function() {
  console.log('🔍 Starting Timer Debug Session...');
  console.log('=====================================');
  
  // Store original functions for monitoring
  const originalSetInterval = window.setInterval;
  const originalClearInterval = window.clearInterval;
  
  let activeIntervals = new Map();
  let intervalCounter = 0;
  
  // Monitor interval creation and destruction
  window.setInterval = function(fn, delay, ...args) {
    intervalCounter++;
    const intervalId = originalSetInterval.call(this, fn, delay, ...args);
    
    // Try to identify timer-related intervals
    const fnString = fn.toString();
    const isTimerInterval = fnString.includes('tick') || delay === 1000;
    
    if (isTimerInterval) {
      console.log(`🔧 NEW TIMER INTERVAL CREATED:`, {
        id: intervalId,
        delay,
        counter: intervalCounter,
        fnPreview: fnString.substring(0, 100) + '...'
      });
    }
    
    activeIntervals.set(intervalId, {
      fn,
      delay,
      created: new Date(),
      counter: intervalCounter,
      isTimer: isTimerInterval
    });
    
    return intervalId;
  };
  
  window.clearInterval = function(intervalId) {
    const intervalData = activeIntervals.get(intervalId);
    if (intervalData && intervalData.isTimer) {
      console.log(`🔧 TIMER INTERVAL CLEARED:`, {
        id: intervalId,
        counter: intervalData.counter,
        existed: new Date() - intervalData.created + 'ms'
      });
    }
    activeIntervals.delete(intervalId);
    return originalClearInterval.call(this, intervalId);
  };
  
  // Monitor timer store state changes
  let lastTimerState = null;
  const timerStore = window.useTimerStore?.getState?.();
  
  if (timerStore) {
    console.log('🔍 Initial Timer State:', {
      isRunning: timerStore.isRunning,
      isActiveDevice: timerStore.isActiveDevice,
      currentTime: timerStore.currentTime,
      enableStartPauseBtn: timerStore.enableStartPauseBtn
    });
    
    // Subscribe to state changes
    const unsubscribe = window.useTimerStore.subscribe((state) => {
      const currentState = {
        isRunning: state.isRunning,
        isActiveDevice: state.isActiveDevice,
        currentTime: state.currentTime,
        enableStartPauseBtn: state.enableStartPauseBtn
      };
      
      if (JSON.stringify(currentState) !== JSON.stringify(lastTimerState)) {
        console.log('🔄 TIMER STATE CHANGED:', {
          old: lastTimerState,
          new: currentState,
          timestamp: new Date().toISOString()
        });
        lastTimerState = currentState;
      }
    });
    
    // Store unsubscribe function
    window.debugTimerUnsubscribe = unsubscribe;
  } else {
    console.error('❌ Timer store not found! Make sure you\'re on the app page.');
    return;
  }
  
  // Monitor keyboard events
  const keyboardHandler = (event) => {
    if (event.code === 'Space') {
      console.log('⌨️ SPACE KEY PRESSED:', {
        timestamp: new Date().toISOString(),
        timerState: window.useTimerStore?.getState?.(),
        activeElement: document.activeElement?.tagName,
        path: window.location.pathname
      });
    }
  };
  
  document.addEventListener('keydown', keyboardHandler);
  window.debugKeyboardHandler = keyboardHandler;
  
  // Monitor timer function calls
  const timerStore2 = window.useTimerStore?.getState?.();
  if (timerStore2) {
    const originalPause = timerStore2.pause;
    const originalStart = timerStore2.start;
    const originalTick = timerStore2.tick;
    
    timerStore2.pause = function(...args) {
      console.log('🛑 PAUSE FUNCTION CALLED:', {
        timestamp: new Date().toISOString(),
        stackTrace: new Error().stack?.split('\n')?.slice(1, 4)
      });
      return originalPause.apply(this, args);
    };
    
    timerStore2.start = function(...args) {
      console.log('▶️ START FUNCTION CALLED:', {
        timestamp: new Date().toISOString(),
        stackTrace: new Error().stack?.split('\n')?.slice(1, 4)
      });
      return originalStart.apply(this, args);
    };
    
    timerStore2.tick = function(...args) {
      const state = window.useTimerStore?.getState?.();
      if (state?.currentTime % 5 === 0) { // Log every 5 seconds to avoid spam
        console.log('⏱️ TICK FUNCTION CALLED:', {
          currentTime: state.currentTime,
          isRunning: state.isRunning,
          timestamp: new Date().toISOString()
        });
      }
      return originalTick.apply(this, args);
    };
  }
  
  // Status function
  window.debugTimerStatus = function() {
    const state = window.useTimerStore?.getState?.();
    const timerIntervals = Array.from(activeIntervals.entries())
      .filter(([id, data]) => data.isTimer);
    
    console.log('📊 TIMER DEBUG STATUS:', {
      timerState: state ? {
        isRunning: state.isRunning,
        isActiveDevice: state.isActiveDevice,
        currentTime: state.currentTime,
        enableStartPauseBtn: state.enableStartPauseBtn
      } : 'Timer store not found',
      activeTimerIntervals: timerIntervals.length,
      allActiveIntervals: activeIntervals.size,
      timerIntervalDetails: timerIntervals.map(([id, data]) => ({
        id,
        age: new Date() - data.created + 'ms',
        counter: data.counter
      }))
    });
  };
  
  // Cleanup function
  window.debugTimerCleanup = function() {
    console.log('🧹 Cleaning up timer debug...');
    
    // Restore original functions
    window.setInterval = originalSetInterval;
    window.clearInterval = originalClearInterval;
    
    // Remove event listener
    if (window.debugKeyboardHandler) {
      document.removeEventListener('keydown', window.debugKeyboardHandler);
      delete window.debugKeyboardHandler;
    }
    
    // Unsubscribe from store
    if (window.debugTimerUnsubscribe) {
      window.debugTimerUnsubscribe();
      delete window.debugTimerUnsubscribe;
    }
    
    // Clean up debug functions
    delete window.debugTimerStatus;
    delete window.debugTimerCleanup;
    delete window.debugTimer;
    
    console.log('✅ Timer debug cleanup complete');
  };
  
  console.log('✅ Timer Debug Setup Complete!');
  console.log('Available commands:');
  console.log('  debugTimerStatus() - Show current status');
  console.log('  debugTimerCleanup() - Clean up debug session');
  console.log('📝 Now press SPACE to pause/resume and watch the logs!');
};

// Auto-start if this script is run directly
if (typeof window !== 'undefined') {
  console.log('🔍 Timer Debug Script Loaded');
  console.log('Run debugTimer() to start debugging session');
}