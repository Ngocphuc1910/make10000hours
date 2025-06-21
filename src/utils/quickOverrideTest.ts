import { overrideSessionService } from '../api/overrideSessionService';

// Quick test function to verify override sessions work
export async function quickOverrideTest(userId: string) {
  console.log('🧪 Quick Override Test');
  console.log('=====================');
  
  try {
    // Test 1: Simple override session
    console.log('📝 Creating simple override session...');
    const result1 = await overrideSessionService.createOverrideSession({
      userId,
      domain: 'test.com',
      duration: 5,
      reason: 'manual_override'
    });
    console.log('✅ Simple session created:', result1);

    // Test 2: Override with full data
    console.log('📝 Creating detailed override session...');
    const result2 = await overrideSessionService.createOverrideSession({
      userId,
      domain: 'example.com',
      url: 'https://example.com/page',
      duration: 3,
      reason: 'break_time'
    });
    console.log('✅ Detailed session created:', result2);

    // Test 3: Retrieve sessions
    console.log('📖 Retrieving user override sessions...');
    const sessions = await overrideSessionService.getUserOverrides(userId);
    console.log('✅ Retrieved sessions:', sessions.length);
    
    sessions.forEach((session, index) => {
      console.log(`📋 Session ${index + 1}:`, {
        domain: session.domain,
        duration: session.duration + 'min',
        reason: session.reason,
        createdAt: session.createdAt.toISOString()
      });
    });

    // Calculate total override time
    const totalMinutes = sessions.reduce((sum, session) => sum + session.duration, 0);
    console.log('⏱️ Total override time:', totalMinutes + ' minutes');

    console.log('🎉 Quick test completed successfully!');
    return { success: true, totalSessions: sessions.length, totalMinutes };

  } catch (error) {
    console.error('❌ Quick test failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Make it available globally for console testing
if (typeof window !== 'undefined') {
  (window as any).quickOverrideTest = quickOverrideTest;
} 