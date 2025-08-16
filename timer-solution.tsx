// SOLUTION: Time-based correction for browser throttling
// This code should replace the timer interval implementation in App.tsx (lines 392-491)

useEffect(() => {
  let intervalId: NodeJS.Timeout | null = null;
  let lastTickTime = Date.now();
  let sessionStartTime: number | null = null;
  let sessionStartTimerValue: number | null = null;
  let lastVisibilityChangeTime = Date.now();
  let missedSeconds = 0;

  // Enhanced tick function with time compensation
  const tick = () => {
    const now = Date.now();
    const state = useTimerStore.getState();
    
    if (state.isRunning && state.isActiveDevice) {
      // Calculate actual elapsed time since last tick
      const actualElapsed = Math.floor((now - lastTickTime) / 1000);
      
      // If more than 1 second elapsed, we've been throttled
      if (actualElapsed > 1) {
        console.log(`⚠️ Timer throttled: ${actualElapsed} seconds elapsed since last tick`);
        missedSeconds += (actualElapsed - 1);
      }
      
      // Always update based on actual elapsed time
      for (let i = 0; i < actualElapsed; i++) {
        state.tick();
      }
      
      lastTickTime = now;
    }
  };

  // Manage single interval with recovery mechanism
  const manageInterval = () => {
    const { isRunning, isActiveDevice, currentTime } = useTimerStore.getState();
    
    // Clear existing interval
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }

    if (isRunning && isActiveDevice) {
      // Record session start for accurate time tracking
      if (!sessionStartTime) {
        sessionStartTime = Date.now();
        sessionStartTimerValue = currentTime;
        lastTickTime = Date.now();
        missedSeconds = 0;
        console.log('⏱️ Timer started:', { 
          time: currentTime,
          startTime: new Date(sessionStartTime).toISOString() 
        });
      }
      
      // Use shorter interval to detect throttling faster
      intervalId = setInterval(tick, 1000);
    } else {
      sessionStartTime = null;
      sessionStartTimerValue = null;
      missedSeconds = 0;
    }
  };

  // Enhanced visibility change handler with TIME-BASED CORRECTION
  const handleVisibilityChange = () => {
    const now = Date.now();
    
    // Debounce rapid visibility changes
    if (now - lastVisibilityChangeTime < 100) return;
    lastVisibilityChangeTime = now;
    
    if (document.visibilityState === 'visible') {
      const state = useTimerStore.getState();
      
      if (state.isRunning && state.isActiveDevice && sessionStartTime && sessionStartTimerValue !== null) {
        // Calculate ACTUAL elapsed time
        const realElapsed = Math.floor((now - sessionStartTime) / 1000);
        const expectedTime = Math.max(0, sessionStartTimerValue - realElapsed);
        const currentTime = state.currentTime;
        const drift = currentTime - expectedTime;
        
        // APPLY CORRECTION for any drift
        if (Math.abs(drift) > 0) {
          console.log(`📱 Tab visible - correcting time drift: ${drift} seconds`);
          console.log(`⏰ Current: ${currentTime}, Expected: ${expectedTime}, Correcting to: ${expectedTime}`);
          
          // CRITICAL FIX: Actually correct the time!
          state.setCurrentTime(expectedTime);
          
          // Track missed time for session management
          if (drift > 0 && state.activeSession) {
            const missedMinutes = Math.floor(drift / 60);
            if (missedMinutes > 0) {
              // Update the active session with missed minutes
              state.updateActiveSession().catch(error => {
                console.error('Failed to update missed minutes:', error);
              });
            }
          }
          
          // Update our tracking
          lastTickTime = now;
          missedSeconds = 0;
        }
      }
    } else {
      // Tab going to background - record the time
      console.log('📴 Tab hidden - timer may be throttled');
    }
  };

  // Alternative: Use Page Lifecycle API if available
  const handleFreeze = () => {
    // Page is being frozen (suspended)
    console.log('🧊 Page frozen - timer suspended');
  };
  
  const handleResume = () => {
    // Page is being resumed
    console.log('🔥 Page resumed - checking timer drift');
    handleVisibilityChange();
  };

  // Initial setup
  manageInterval();

  // Event listeners
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Page Lifecycle API (if supported)
  if ('onfreeze' in document) {
    document.addEventListener('freeze', handleFreeze);
    document.addEventListener('resume', handleResume);
  }

  // Subscribe to timer state changes
  const unsubscribe = useTimerStore.subscribe((state, prevState) => {
    // Reset session tracking when timer starts/stops
    if (state.isRunning && !prevState.isRunning) {
      sessionStartTime = Date.now();
      sessionStartTimerValue = state.currentTime;
      lastTickTime = Date.now();
      missedSeconds = 0;
    } else if (!state.isRunning && prevState.isRunning) {
      sessionStartTime = null;
      sessionStartTimerValue = null;
      missedSeconds = 0;
    }
    
    // Restart interval on state change
    setTimeout(manageInterval, 0);
  });

  // Cleanup function
  return () => {
    if (intervalId) clearInterval(intervalId);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    if ('onfreeze' in document) {
      document.removeEventListener('freeze', handleFreeze);
      document.removeEventListener('resume', handleResume);
    }
    unsubscribe();
    ChatIntegrationService.cleanup();
  };
}, []);