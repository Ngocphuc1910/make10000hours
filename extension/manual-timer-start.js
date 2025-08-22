// COPY-PASTE THIS TO MANUALLY START THE MASTER TIMER

console.log('🔧 MANUALLY STARTING MASTER TIMER...');

// First, make sure we have the required functions
if (typeof updateDomainSession === 'undefined') {
  console.error('❌ updateDomainSession function missing - cannot start timer');
} else {
  console.log('✅ updateDomainSession function exists');
}

// Stop any existing timer
if (typeof masterTimer !== 'undefined' && masterTimer) {
  clearInterval(masterTimer);
  console.log('🛑 Cleared existing master timer');
}

// Create and start the master timer manually
window.masterTimer = setInterval(async () => {
  try {
    // Only track if we have a domain and user is active
    if (trackingState?.currentDomain && chromeIdleHelper?.shouldTrackTime()) {
      await updateDomainSession(trackingState.currentDomain, 5); // Add 5 seconds
      console.log(`⏰ Added 5s to ${trackingState.currentDomain}`);
    } else {
      console.log('⏸️ Not tracking:', {
        domain: trackingState?.currentDomain || 'null',
        shouldTrack: chromeIdleHelper?.shouldTrackTime() || false,
        idleState: chromeIdleHelper?.currentState || 'unknown'
      });
    }
  } catch (error) {
    console.error('❌ Master timer error:', error);
  }
}, 5000); // 5 seconds

console.log('✅ Master timer started manually! ID:', masterTimer);

// Set current domain if missing
if (typeof trackingState !== 'undefined' && !trackingState.currentDomain) {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (tabs[0] && tabs[0].url) {
      try {
        const domain = new URL(tabs[0].url).hostname;
        trackingState.currentDomain = domain;
        trackingState.lastHeartbeat = Date.now();
        console.log('🌐 Set currentDomain to:', domain);
        console.log('🎉 Everything is ready! You should see 5-second tracking logs now!');
      } catch (e) {
        console.error('Could not extract domain:', e);
      }
    }
  });
} else {
  console.log('🌐 Current domain:', trackingState?.currentDomain);
  console.log('🎉 Master timer running! You should see 5-second tracking logs now!');
}

console.log('⏰ Watch for "⏰ Added 5s to [domain]" logs every 5 seconds!');