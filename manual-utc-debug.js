// MANUAL UTC DEBUG - Copy and paste this into browser console
// This version won't auto-refresh so you can inspect the results

(() => {
  console.log('🔍 MANUAL UTC DEBUG STARTING...');
  
  // Comprehensive localStorage analysis
  const utcKeys = Object.keys(localStorage).filter(key => 
    key.toLowerCase().includes('utc') || 
    key.toLowerCase().includes('timezone') || 
    key.toLowerCase().includes('emergency') || 
    key.toLowerCase().includes('circuit')
  );
  
  console.log('📦 UTC-related localStorage keys:');
  utcKeys.forEach(key => console.log(`  ${key}: "${localStorage.getItem(key)}"`));
  
  // Check emergency status
  const isEmergency = localStorage.getItem('utc-emergency-disable') === 'true';
  console.log(`🚨 Emergency disabled: ${isEmergency}`);
  
  // SOLUTION 1: Clear emergency flags
  window.clearUTCEmergency = () => {
    const flagsToClear = [
      'utc-emergency-disable',
      'timezone_emergency_disable',
      'app-localStorage-reload', 
      'utc-emergency-reload',
      'monitoring-emergency-disable'
    ];
    
    flagsToClear.forEach(flag => {
      localStorage.removeItem(flag);
      console.log(`✅ Cleared: ${flag}`);
    });
    
    console.log('🎉 All emergency flags cleared! Now refresh the page.');
    return 'CLEARED';
  };
  
  // SOLUTION 2: Force UTC enable
  window.forceUTCEnable = () => {
    localStorage.removeItem('utc-emergency-disable');
    localStorage.setItem('utc-feature-flags', JSON.stringify({
      utcDataStorage: true,
      transitionMode: 'dual',
      rolloutPercentage: 100
    }));
    console.log('🚀 Forced UTC enable! Refresh the page.');
    return 'FORCED_ENABLED';
  };
  
  // SOLUTION 3: Nuclear option - clear everything
  window.nuclearUTCReset = () => {
    const allKeys = Object.keys(localStorage);
    const utcRelated = allKeys.filter(key => 
      key.toLowerCase().includes('utc') || 
      key.toLowerCase().includes('timezone') ||
      key.toLowerCase().includes('emergency') ||
      key.toLowerCase().includes('circuit')
    );
    
    utcRelated.forEach(key => {
      localStorage.removeItem(key);
      console.log(`💥 Nuked: ${key}`);
    });
    
    console.log('💥 Nuclear reset complete! Refresh the page.');
    return 'NUCLEAR_RESET';
  };
  
  console.log('\n🛠️  AVAILABLE COMMANDS:');
  console.log('• clearUTCEmergency() - Clear emergency disable flags');
  console.log('• forceUTCEnable() - Force enable UTC features');  
  console.log('• nuclearUTCReset() - Clear ALL UTC-related localStorage');
  console.log('\nTry running: clearUTCEmergency()');
  
})();