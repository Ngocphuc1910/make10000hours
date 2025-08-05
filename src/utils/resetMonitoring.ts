/**
 * Utility to reset UTC monitoring metrics during development
 */
import { utcMonitoring } from '../services/monitoring';
import { utcFeatureFlags } from '../services/featureFlags';

export const resetUTCMonitoring = () => {
  try {
    console.log('🔄 Starting comprehensive UTC system reset...');
    
    // Reset monitoring metrics
    utcMonitoring.reset();
    
    // Use the new comprehensive reset method
    utcFeatureFlags.resetEmergencyState();
    
    // Clear additional error states
    sessionStorage.removeItem('utc-emergency-disable-count');
    localStorage.removeItem('utc_monitoring_errors');
    localStorage.removeItem('utc_circuit_breaker_state');
    localStorage.removeItem('utc_feature_disabled');
    
    // Clear any stored error states in localStorage
    if (typeof window !== 'undefined') {
      const keysToRemove = Object.keys(localStorage).filter(key => 
        key.startsWith('utc-error-') || 
        key.startsWith('utc-circuit-breaker-') ||
        key.startsWith('timezone_') ||
        key.includes('emergency')
      );
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      if (keysToRemove.length > 0) {
        console.log(`🧹 Cleared ${keysToRemove.length} error state entries from localStorage`);
      }
    }
    
    console.log('✅ UTC monitoring and emergency state reset complete');
    console.log('🎯 Try creating a work session now - no page refresh needed');
    console.log('💡 If errors persist, check for underlying timezone conversion issues');
    
    return true;
  } catch (error) {
    console.error('❌ Failed to reset UTC monitoring:', error);
    return false;
  }
};

// Export for console usage
if (typeof window !== 'undefined') {
  (window as any).resetUTCMonitoring = resetUTCMonitoring;
}