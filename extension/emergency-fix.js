// EMERGENCY FIX - PASTE THIS IN EXTENSION BACKGROUND CONSOLE
// This will manually create the missing variables and start tracking

console.log('🚨 APPLYING EMERGENCY FIX...');

// 1. Create missing DateUtils if not defined
if (typeof DateUtils === 'undefined') {
  window.DateUtils = {
    getLocalDateString: function() {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  };
  console.log('✅ DateUtils created');
}

// 2. Create trackingState
if (typeof trackingState === 'undefined') {
  window.trackingState = {
    currentDomain: null,
    currentDate: DateUtils.getLocalDateString(),
    lastHeartbeat: Date.now(),
    lastTabSwitchTime: Date.now(),
    diagnostics: {
      immediateSaves: 0,
      tabSwitches: 0,
      savedFromDataLossSeconds: 0
    }
  };
  console.log('✅ trackingState created');
}

// 3. Create Chrome Idle Helper
if (typeof chromeIdleHelper === 'undefined') {
  window.chromeIdleHelper = {
    currentState: 'active',
    initialized: true,
    shouldTrackTime: function() { return this.currentState === 'active'; }
  };
  
  // Initialize Chrome idle
  if (chrome.idle) {
    chrome.idle.setDetectionInterval(600); // 10 minutes as we set
    chrome.idle.queryState(600, (state) => {
      chromeIdleHelper.currentState = state;
      console.log('🎯 Chrome Idle initialized:', state);
    });
    
    chrome.idle.onStateChanged.addListener((newState) => {
      chromeIdleHelper.currentState = newState;
      console.log('🔄 Idle state changed to:', newState);
    });
  }
  console.log('✅ chromeIdleHelper created');
}

// 4. Create updateDomainSession function
if (typeof updateDomainSession === 'undefined') {
  window.updateDomainSession = async function(domain, incrementalSeconds = 0, isNewVisit = false) {
    try {
      const now = new Date();
      const today = DateUtils.getLocalDateString();
      
      // Get current sessions from storage
      const storage = await chrome.storage.local.get(['site_usage_sessions']);
      const allSessions = storage.site_usage_sessions || {};
      const todaySessions = allSessions[today] || [];
      
      // Find existing session for this domain today
      let existingSession = todaySessions.find(s => s.domain === domain);
      
      if (existingSession) {
        // Update existing session
        existingSession.duration += incrementalSeconds;
        if (isNewVisit) existingSession.visits += 1;
        existingSession.updatedAt = now.toISOString();
        existingSession.currentlyActive = true;
      } else {
        // Create new session
        const sessionId = `${domain}_${today}_default`;
        const newSession = {
          id: sessionId,
          domain: domain,
          startTime: now.getTime(),
          startTimeUTC: now.toISOString(),
          duration: incrementalSeconds,
          visits: isNewVisit ? 1 : 0,
          status: 'active',
          currentlyActive: true,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          utcDate: now.toISOString().split('T')[0]
        };
        todaySessions.push(newSession);
      }
      
      // Update sessions in storage
      allSessions[today] = todaySessions;
      await chrome.storage.local.set({ site_usage_sessions: allSessions });
      
      console.log(`📊 Updated domain session: ${domain} (+${incrementalSeconds}s, visits: ${isNewVisit ? 1 : 0})`);
      
    } catch (error) {
      console.error('❌ Error updating domain session:', error);
    }
  };
  console.log('✅ updateDomainSession function created');
}

// 5. Set current domain from active tab
chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
  if (tabs[0] && tabs[0].url) {
    try {
      const domain = new URL(tabs[0].url).hostname;
      trackingState.currentDomain = domain;
      trackingState.lastHeartbeat = Date.now();
      console.log('🌐 Set current domain to:', domain);
    } catch (e) {
      console.log('⚠️ Could not extract domain from current tab');
    }
  }
});

// 6. Create and start master timer
if (typeof masterTimer === 'undefined') {
  window.masterTimer = setInterval(async () => {
    try {
      // Only track if we have a domain and user is active
      if (trackingState.currentDomain && chromeIdleHelper.shouldTrackTime()) {
        await updateDomainSession(trackingState.currentDomain, 5); // Add 5 seconds
        console.log(`⏰ Added 5s to ${trackingState.currentDomain}`);
      } else {
        console.log('⏸️ Not tracking:', {
          domain: trackingState.currentDomain,
          shouldTrack: chromeIdleHelper.shouldTrackTime(),
          idleState: chromeIdleHelper.currentState
        });
      }
    } catch (error) {
      console.error('❌ Master timer error:', error);
    }
  }, 5000); // 5 seconds as we configured
  
  console.log('✅ Master timer started (5s interval)');
}

// 7. Set initialized flag
window.isInitialized = true;

console.log('🎉 EMERGENCY FIX COMPLETE!');
console.log('📊 You should now see "📊 Updated domain session" logs every 5 seconds');
console.log('🔄 Switch tabs to see domain tracking in action');
console.log('⚠️  Note: This is a temporary fix - the extension needs proper repair');