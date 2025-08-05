/**
 * Test script to verify UTC feature flags and transition mode
 */
import { utcFeatureFlags } from '../services/featureFlags';

export const testUTCFeatureFlags = (userId: string = 'test-user-123') => {
  console.log('🚀 Testing UTC Feature Flags');
  console.log('============================');
  
  // Check emergency disable status
  const isEmergencyDisabled = localStorage.getItem('utc-emergency-disable') === 'true';
  console.log('Emergency Disabled:', isEmergencyDisabled);
  
  if (isEmergencyDisabled) {
    console.log('⚠️  UTC features are emergency disabled!');
    console.log('Run clearUTCEmergencyDisable() to enable them.');
  }
  
  // Check feature flags
  const flags = utcFeatureFlags.getFlags();
  console.log('Current Feature Flags:', flags);
  
  // Check user rollout
  const isInRollout = utcFeatureFlags.isUserInRollout ? utcFeatureFlags.isUserInRollout(userId) : true;
  console.log(`User ${userId} in rollout:`, isInRollout);
  
  // Check transition mode
  const transitionMode = utcFeatureFlags.getTransitionMode(userId);
  console.log('Transition Mode:', transitionMode);
  
  // Check specific features
  const features = [
    'utcDataStorage',
    'utcTimerIntegration', 
    'utcDashboard',
    'utcExtensionSync',
    'utcMigrationTools',
    'utcCalendarSync'
  ] as const;
  
  console.log('\nFeature Status:');
  features.forEach(feature => {
    const isEnabled = utcFeatureFlags.isFeatureEnabled(feature, userId);
    console.log(`  ${feature}: ${isEnabled ? '✅' : '❌'}`);
  });
  
  // Test recommendation
  console.log('\n📋 Status Summary:');
  if (isEmergencyDisabled) {
    console.log('❌ UTC features are emergency disabled');
    console.log('   Run: clearUTCEmergencyDisable()');
  } else if (transitionMode === 'disabled') {
    console.log('❌ Transition mode is disabled');
    console.log('   Enable with: enableUTCTransition()');
  } else if (transitionMode === 'dual') {
    console.log('✅ Dual mode active - sessions will use UTC storage');
  } else if (transitionMode === 'utc-only') {
    console.log('✅ UTC-only mode active');
  }
  
  return {
    isEmergencyDisabled,
    transitionMode,
    isInRollout,
    flags
  };
};

export const clearUTCEmergencyDisable = () => {
  localStorage.removeItem('utc-emergency-disable');
  console.log('✅ UTC emergency disable cleared');
  console.log('🔄 Reload the page to apply changes');
};

export const enableUTCTransition = () => {
  utcFeatureFlags.updateFlags({
    transitionMode: 'dual',
    utcDataStorage: true,
    utcTimerIntegration: true
  });
  console.log('✅ UTC transition enabled in dual mode');
};

export const enableUTCOnly = () => {
  utcFeatureFlags.updateFlags({
    transitionMode: 'utc-only',
    utcDataStorage: true,
    utcTimerIntegration: true
  });
  console.log('✅ UTC-only mode enabled');
};

// Export for console usage
if (typeof window !== 'undefined') {
  (window as any).testUTCFeatureFlags = testUTCFeatureFlags;
  (window as any).clearUTCEmergencyDisable = clearUTCEmergencyDisable;
  (window as any).enableUTCTransition = enableUTCTransition;
  (window as any).enableUTCOnly = enableUTCOnly;
}