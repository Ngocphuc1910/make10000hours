// SIMPLE TIMER DEBUG - Copy and paste this into browser console
// ================================================================

(function() {
  console.log('🔍 Starting Simple Timer Debug...');
  
  // 1. Check if timer store exists
  if (!window.useTimerStore) {
    console.error('❌ Timer store not found! Make sure you\'re on the app page.');
    return;
  }
  
  // 2. Get current state
  const state = window.useTimerStore.getState();
  console.log('📊 Current Timer State:', {
    isRunning: state.isRunning,
    isActiveDevice: state.isActiveDevice,
    currentTime: state.currentTime,
    enableStartPauseBtn: state.enableStartPauseBtn,
    mode: state.mode
  });
  
  // 3. Monitor pause function calls
  const originalPause = state.pause;
  const originalStart = state.start;
  
  state.pause = function() {
    console.log('🛑 PAUSE CALLED at', new Date().toISOString());
    console.log('📊 State before pause:', {
      isRunning: window.useTimerStore.getState().isRunning,
      currentTime: window.useTimerStore.getState().currentTime
    });
    
    const result = originalPause.call(this);
    
    setTimeout(() => {
      console.log('📊 State after pause (100ms delay):', {
        isRunning: window.useTimerStore.getState().isRunning,
        currentTime: window.useTimerStore.getState().currentTime
      });
    }, 100);
    
    return result;
  };
  
  state.start = function() {
    console.log('▶️ START CALLED at', new Date().toISOString());
    console.log('📊 State before start:', {
      isRunning: window.useTimerStore.getState().isRunning,
      currentTime: window.useTimerStore.getState().currentTime
    });
    
    const result = originalStart.call(this);
    
    setTimeout(() => {
      console.log('📊 State after start (100ms delay):', {
        isRunning: window.useTimerStore.getState().isRunning,
        currentTime: window.useTimerStore.getState().currentTime
      });
    }, 100);
    
    return result;
  };
  
  // 4. Monitor space key presses
  document.addEventListener('keydown', function(event) {
    if (event.code === 'Space') {
      const target = event.target;
      const isFormElement = target.tagName === 'INPUT' || 
                           target.tagName === 'TEXTAREA' || 
                           target.isContentEditable ||
                           target.getAttribute('role') === 'textbox';
      
      console.log('⌨️ SPACE PRESSED:', {
        timestamp: new Date().toISOString(),
        isFormElement,
        targetTag: target.tagName,
        currentPath: window.location.pathname,
        currentState: {
          isRunning: window.useTimerStore.getState().isRunning,
          enableStartPauseBtn: window.useTimerStore.getState().enableStartPauseBtn
        }
      });
    }
  });
  
  // 5. Monitor state changes
  window.useTimerStore.subscribe((state, prevState) => {
    if (state.isRunning !== prevState.isRunning) {
      console.log('🔄 isRunning CHANGED:', {
        from: prevState.isRunning,
        to: state.isRunning,
        timestamp: new Date().toISOString()
      });
    }
    
    if (state.currentTime !== prevState.currentTime) {
      // Only log every 5 seconds to avoid spam
      if (state.currentTime % 5 === 0) {
        console.log('⏱️ Timer tick:', state.currentTime);
      }
    }
  });
  
  console.log('✅ Debug setup complete! Press SPACE to test pause/resume...');
})();