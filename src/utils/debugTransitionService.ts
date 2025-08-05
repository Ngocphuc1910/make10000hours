import { transitionQueryService } from '../services/transitionService';
import { utcFeatureFlags } from '../services/featureFlags';
import { timezoneUtils } from '../utils/timezoneUtils';

/**
 * Debug utility to check transition service configuration and current routing
 */
export const debugTransitionService = () => {
  const config = transitionQueryService.getConfig();
  const userTimezone = timezoneUtils.getCurrentTimezone();
  
  console.log('🔍 TRANSITION SERVICE DEBUG:', {
    config,
    userTimezone,
    currentUTC: timezoneUtils.getCurrentUTC(),
    featureFlagsAvailable: !!utcFeatureFlags
  });
  
  // Mock a user ID to test transition mode
  const mockUserId = 'debug-user';
  const transitionMode = utcFeatureFlags.getTransitionMode(mockUserId);
  
  console.log('🎯 TRANSITION ROUTING DEBUG:', {
    mockUserId,
    transitionMode,
    willUseUTC: transitionMode === 'utc-only' || (transitionMode === 'dual' && config.preferUTC),
    willUseLegacy: transitionMode === 'disabled' || (transitionMode === 'dual' && !config.preferUTC),
    routingDecision: transitionMode === 'utc-only' ? 'UTC ONLY' : 
                    transitionMode === 'disabled' ? 'LEGACY ONLY' :
                    config.preferUTC ? 'DUAL (UTC PREFERRED)' : 'DUAL (LEGACY PREFERRED)'
  });
  
  return {
    config,
    transitionMode,
    userTimezone,
    willUseLegacy: transitionMode === 'disabled' || (transitionMode === 'dual' && !config.preferUTC)
  };
};

// Export for console access
(window as any).debugTransitionService = debugTransitionService;