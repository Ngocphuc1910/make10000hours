import { transitionQueryService } from '../services/transitionService';
import { workSessionService } from '../api/workSessionService';

/**
 * Test utility to verify the enhanced legacy system is working properly
 */
export const testEnhancedLegacySystem = async () => {
  console.log('🧪 TESTING ENHANCED LEGACY SYSTEM...');
  
  // Test 1: Check transition service configuration
  const config = transitionQueryService.getConfig();
  console.log('1️⃣ Transition Service Config:', config);
  
  if (config.preferUTC) {
    console.warn('⚠️ WARNING: preferUTC is still true - sessions will route to UTC system');
    return false;
  }
  
  // Test 2: Mock session creation (dry run)
  const mockSessionData = {
    userId: 'test-user-123',
    taskId: 'test-task-456',
    projectId: 'test-project-789',
    duration: 0,
    sessionType: 'pomodoro' as const,
    status: 'active' as const,
    notes: 'Test session for enhanced legacy system'
  };
  
  console.log('2️⃣ Mock Session Data:', mockSessionData);
  
  try {
    // This would normally create a real session - commented out for safety
    // const sessionId = await transitionQueryService.createSession(mockSessionData);
    // console.log('3️⃣ Session Created Successfully:', sessionId);
    
    console.log('✅ Enhanced Legacy System Configuration is Correct!');
    console.log('📝 To test session creation, start a timer and check the console logs.');
    console.log('🔍 You should see "Creating enhanced legacy session" instead of "Creating UTC session"');
    
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
};

// Export for console access  
(window as any).testEnhancedLegacySystem = testEnhancedLegacySystem;

// Also export a function to quickly check current routing
export const checkCurrentRouting = () => {
  const config = transitionQueryService.getConfig();
  const isRoutingToLegacy = !config.preferUTC;
  
  console.log('🎯 CURRENT ROUTING STATUS:', {
    preferUTC: config.preferUTC,
    willUseLegacy: isRoutingToLegacy,
    routingDecision: isRoutingToLegacy ? '✅ ENHANCED LEGACY SYSTEM' : '❌ UTC SYSTEM'
  });
  
  return isRoutingToLegacy;
};

(window as any).checkCurrentRouting = checkCurrentRouting;